// this version is before I had claude make improvements.

import vento from "jsr:@vento/vento"
import { DatabaseSync } from "node:sqlite";
// import config from "./config.json" with { type: "json" };

const config = JSON.parse(await Deno.readTextFile('./config.json'))
const db = new DatabaseSync(config.dbPath)
const env = vento({includes: './view'})
const wsClients = {}

function gatherParams(url) {
	function parseParam(v) {
		if (v === "") { return true }
		else if (v === "true") { return true } 
		else if (v === "false") { return false }
		else if (!isNaN(Number(v))) { return +v }
		return v;
	}
	const params = {}
	for (const p of url.searchParams) {
		params[p[0]] = parseParam(p[1])
	}
	return params
}

function prepWebSocket(req, params) {
	const { socket, response } = Deno.upgradeWebSocket(req);
	socket.onopen = () => {
		socket.username = params.username
		socket.channels = params.channels == '<none>' ? [] : params.channels.split(/\s*,\s*/)
		socket.sources  = params.sources == '<none>' ? []  : params.sources.split(/\s*,\s*/)
		wsClients[params.username] = socket
		console.log("CONNECTED", params.username, params.channels, params.sources, Object.keys(wsClients))
	}
	socket.onmessage = (event) => {
		const data = JSON.parse(event.data)
		data.source = socket.username
		console.log('RECEIVED: ', data)
		Object.values(wsClients).forEach( client => {
			if (client.username !== socket.username) {
				console.log('  checking source', data.source, 'channel', data.channel)
				console.log('    client sources', client.sources, 'channels', client.channels)
				if(client.sources.includes(data.source) || client.channels.includes(data.channel)) {
					console.log('    matched. sending to ', client.username)
					client.send(JSON.stringify(data)) 
				}
				else console.log('    no match.')
			}
		})
	}
	socket.onclose = () => {
		delete wsClients[socket.username]
		console.log("DISCONNECTED", socket.username, Object.keys(wsClients))
	}
	socket.onerror = (error) => console.error("ERROR:", error)

	return response
}


async function handleReq(req) {
	const url = new URL(req.url);
	const filepath = url.pathname === "/" ? '/index' : 
			url.pathname == '/favicon.ico' ? '/assets/logo.png' :
			decodeURIComponent(url.pathname)

	const params = gatherParams(url)
	console.log(req.method, filepath, params)

	if (filepath.startsWith('/assets/')) {
		try {
			const file = await Deno.open("." + filepath, { read: true });
			return new Response(file.readable);
		}
		catch(error) {
			console.error(`Problem with ${filepath}:`, error)
			return new Response("404 Not Found: " + filepath, { status: 404 });
		}		
	}
	if (req.headers.get("upgrade") == "websocket") return prepWebSocket(req, params)
	
	try {
		const result = await env.run(`./view${filepath}.vto`, {db, params, config: config.public})
		return new Response(result.content, {
			status: 200,
			headers: {
				"Content-Type": "text/html",
			}
		})
	}
	catch(error) {
		console.error(`Problem with ${filepath}:`, error)
		return new Response("404 Not Found: " + filepath, { status: 404 });
	}		

}

console.log('stage', config.public.stage.toLowerCase())

if (config.public.stage.toLowerCase() == 'production') {
	const cert = await Deno.readTextFile(config.certs.cert)
 	const key  = await Deno.readTextFile(config.certs.key)
	Deno.serve({cert, key, port: 443}, handleReq)
}
else {
	Deno.serve({port:3000}, handleReq)
}
