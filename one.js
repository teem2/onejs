// ONEJS Runtime
// Copyright (C) 2014 ONEJS 

// MIT license: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

ONE = {}

// Bootstrap code for the browser, started at the bottom of the file
ONE.browser_boot_ = function(){

	window.addEventListener("load", function(){
		var dt = Date.now()
		// make self a class
		ONE.base_.apply( ONE )

		ONE.__onename__ = 'ONE'
		// create base class
		ONE.base_.apply( ONE.Base = {} )
		ONE.Base.Base = ONE.Base
		// add ast support to the Base class
		ONE.ast_.apply( ONE.Base )
		
		// make ONE the new root scope
		ONE.Base.$ = ONE.$ = Object.create( ONE )
		ONE.Base.out = ONE.out
		ONE.Base.error = ONE.error
		ONE.Base.warn = ONE.warn
		ONE.Base.trace = ONE.trace

		// hide all the props
		ONE.Base.enumfalse.apply(ONE.Base, Object.keys( ONE.Base ) )

		var m = location.pathname.match(/\/([^\/\.]+)/)
		var root = location.hash?location.hash.slice(1):(m?m[0]:"index")

		var obj = ONE.Base.new()
		ONE.$.http_load(obj, root)
		
		console.log("profile init "+(Date.now() - dt)+'ms')
	})

	window.onerror = function(msg, url, line) {
		var name = url.match(/[^\/]*$/)[0]
		ONE.error(msg + ' in '+name+' line '+line)
		return false
	}

	this.http_get = function( url, callback ){
		// do some XMLHTTP
		var pthis = this
		var req = new XMLHttpRequest()
		req.open("GET",url,true)
		req.onreadystatechange = function(){
			if(req.readyState == 4){
				if(req.status != 200) return callback.call(pthis, null, req.status)
				return callback.call(pthis, req.responseText )
			}
		}
		req.send()
	}

	this.http_load = function( obj, module, callback, isroot ){
		var url = module + '.n'
		this.http_get( url, function on_http_get(code, error){
			if( error ) throw new Error("Could not load "+url+" "+error)

			function run(){
				//obj.profile("eval "+module,1,function eval(){
					obj.$[module] = obj.eval(ast, 1, url)
				//})
				if(typeof callback == 'function') callback()
				//obj.profile("run "+module,1,function run(){
				else obj.$[module].call(obj)
				//})
			}
			// lets analyze our data and load all our deps.
			var ast = obj.parse('~>{'+code+'\n}', undefined, url)
			var deps = 0
			// load our dependencies
			obj.each(ast.getDependencies(),function(file){
				deps++
				ONE.$.http_load( obj, file, function on_http_load(){
					if(!--deps) run()
				})
			})
			if(!deps) run()
		})
	}

	this.auto_reloader = function(){
		rtime = Date.now()
		var x = new XMLHttpRequest()
		x.onreadystatechange = function(){
			if(x.readyState != 4) return
			if(x.status == 200) return location.reload()
			setTimeout(function(){this.autoreloader()}.bind(this), (Date.now() - rtime) < 1000?500:0)
		}.bind(this)
		x.open('GET', "/_reloader_")
		x.send()
	}
} 

//  Bootstrap code for Node.JS

ONE.nodejs_boot_ = function(){
	// include other parts
	global.ONE = ONE
	require('./one_base.js')
	require('./one_parser.js')
	require('./one_ast.js')

	// make self a class
	ONE.base_.apply( ONE )

	ONE.__onename__ = 'ONE'
	// create base class
	ONE.base_.apply( ONE.Base = {} )
	ONE.Base.Base = ONE.Base
	// add ast support to the Base class
	ONE.ast_.apply( ONE.Base )
	
	// make ONE the new root scope
	ONE.Base.$ = ONE.$ = Object.create( ONE )

	// hide all the props
	ONE.Base.enumfalse.apply(ONE.Base, Object.keys( ONE.Base ) )
	
	// load our first argument, parse dependencies and fire up
	var args = process.argv.slice()
	var watcher 
	for( var i = 0;i<args.length;i++){
		if(args[i] =='-w') args.splice(i,1), watcher = true
	}
	var root = args.length > 2 ? args[2] : 'index'
	var fs = require('fs')

	// make a little filewatcher and do auto restarting
	var stats = {}
	var watch = 'mtime'
	var watches = {}
	var delta = 0

	function watchFile(file){
		if(watches[file]) return
		stats[file] = fs.statSync(file)[watch].toString()
		watches[file] = setInterval(function(){
			var stat = fs.statSync(file)
			if(stat[watch].toString() != stats[file]){ 
				stats[file] = stat[watch].toString()
				if(Date.now() - delta > 2000){
					delta = Date.now()
					console.log('-- restarting -- '+Date())
					reload()
				}
			}
		},50)
	}

	function loadFile( obj, module ){
		var file = module +'.n'
		try{
			code = fs.readFileSync(file)	
			if(watcher) watchFile( file )
		} catch (e){
			console.log('Cant open '+file)
			process.exit(-1)
		}
		try{
		var ast = obj.parse('~>{'+code+'\n}', undefined, file)
		obj.each(ast.getDependencies(),function(file){
			loadFile( obj,file )
		})
		obj.$[module] = obj.eval(ast, 1, file)
		}catch(e){
			console.log(e)
		}
	}
	function reload(){
		var obj = ONE.Base.new()
		loadFile( obj, root )
		var call = obj.$[root]
		if(call)call.call(obj)
	}
	reload()
}

if(typeof window !== 'undefined') ONE.browser_boot_()
else ONE.nodejs_boot_()