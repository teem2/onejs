/**
 *  ONEJS Auto reloader
 * 
 *  Copyright (C) 2014 ONEJS 
 *
 *  MIT license: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 */

if(typeof process !== "undefined") nodejs()
else browser()

function browser(){
	function reloader(){
		rtime = Date.now()
		var x = new XMLHttpRequest()
		x.onreadystatechange = function(){
			if(x.readyState != 4) return
			if(x.status == 200) return location.reload()
			setTimeout(reloader, (Date.now() - rtime) < 1000?500:0)
		}
		x.open('GET', "/_reloader_")
		x.send()
	}
	reloader()
}

function nodejs(){
	var addr = "0.0.0.0"
	var port = 2000
	
	var http = require('http')
	var fs = require('fs')
	var path = require('path')
	var url = require('url')
	var watch = "mtime" // or use "ctime"
	var root = path.resolve(__dirname)//process.cwd()
	
	var delta = 0
	var watching = {}
	var stats = {}
	var watchRes = []
	
	function watchFile(filename){
		if(watching[filename]) return
		stats[filename] = fs.statSync(filename)[watch].toString()
		console.log('watching',filename)
		watching[filename] = setInterval(function(){
			var stat = fs.statSync(filename)
			var diff = 0
			if(stat[watch].toString() != stats[filename]){ 
				stats[filename] = stat[watch].toString()
				if(Date.now() - delta > 2000){
					delta = Date.now()
					console.log("---- "+filename+" changed, sending reload to frontend ----")
					// signal the frontend to reload.
					for(var i in watchRes){
						var res = watchRes[i]
						res.writeHead(200, {"Content-Type": "text/plain"})
						res.end("")
					}
					watchRes = []
				}
			}
		},50)
	}
	
	var mime = {
		"htm":"text/html",
		"html":"text/html",
		"js":"application/javascript",
		"jpg":"image/jpeg",
		"jpeg":"image/jpeg",
		"txt":"text/plain",
		"css":"text/css",
		"ico": "image/x-icon",			
		"png":"image/png",
		"gif":"image/gif"
	}
	var mimeRx = new RegExp("\\.(" + Object.keys(mime).join("|") + ")$")

	var server = http.createServer(staticServe)
	server.listen(port, addr)
	console.log("Listening on "+addr+":"+port)
	function staticServe(req, res){
		var name = url.parse(req.url).pathname
		var fullpath = path.join(root, name)
		if(name == "/_reloader_"){
			watchRes.push(res)
			return
		}        
		fs.exists(fullpath, function(x) {
			if(!x){
				console.log('File not found:'+fullpath)
				res.writeHead(404)
				res.end("file not found")
				return
			}
			fs.readFile(fullpath, function(err, data) {
				console.log('Serving:'+fullpath)
				if(err){
					res.writeHead(500, {"Content-Type": "text/plain"})
					res.end(err + "\n")
					return
				}
				var ext = fullpath.match(mimeRx), type = ext && mime[ext[1]] || "text/plain"
				res.writeHead(200, {"Content-Type": type})
				res.write(data)
				res.end()
			})
			watchFile(fullpath)
		})
	}
}