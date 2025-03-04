import vento from "jsr:@vento/vento"
import { DatabaseSync } from "node:sqlite";
import config from "./config.json" with { type: "json" };

const db = new DatabaseSync(config.dbPath)

db.all = function(sql) {
const result = db.prepare(sql).all()
return JSON.stringify(result, null, 2)
}

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
	
	try {
		const result = await env.run(`.${filepath}.vto`, {db, params})
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

const env = vento()

if (config.stage.toLowerCase() == 'production') {
	const cert = await Deno.readTextFile(config.certs.cert)
	const key  = await Deno.readTextFile(config.certs.key)
	Deno.serve({cert, key}, handleReq)
}
else {
	Deno.serve(handleReq)
}
