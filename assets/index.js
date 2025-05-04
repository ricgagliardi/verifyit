// GLOBALS
let g_

function titleCase(str) {
	return str.toLowerCase().split(' ').map( w => w.replace(w[0], w[0].toUpperCase()) ).join(' ')
}
function getParam(name) {
	return (new URLSearchParams(location.search)).get(name)
}
const $ = selector => document.querySelector(selector) 

function today() {
  return (new Date()).toISOString().slice(0,10)
}

const delay = t => new Promise(resolve => setTimeout(resolve, t))

