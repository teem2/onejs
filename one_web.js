"use strict"
// ONEJS Runtime
// Copyright (C) 2014 ONEJS 

window.ONE = {}

// Bootstrap code for the browser, started at the bottom of the file
ONE.browser_boot_ = function(){

	window.addEventListener("load", function(){
		function reloader(){
			var rtime = Date.now()
			var x = new XMLHttpRequest()
			x.onreadystatechange = function(){
				if(x.readyState != 4) return
				if(x.status == 200){
					return location.reload()
				}
				setTimeout(reloader, (Date.now() - rtime) < 1000?500:0)
			}
			x.open('GET', "/_reloader_")
			x.send()
		}

		var dt = Date.now()
		// make self a class
		ONE.base_.apply( ONE )

		ONE.__class__ = 'ONE'
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

		// check if we are on onejs.io, we load the prefix
		var type = "main"
		//var m = location.hostname.match(/(.*?)\.onejs\.io/)
		//if(m) type = m[1]
		
		var root
		if(location.hash){
			reloader()
			root = location.hash.slice(1)
		}
		else root = type

		var obj = ONE.Base.create(ONE,function(){ this.__class__='Root'})
		ONE.$.http_load(obj, root)
		
		//console.log("profile init "+(Date.now() - dt)+'ms')
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
		function on_http_get(code, error){
			if( error ) throw new Error("Could not load "+url+" "+error)

			function run(){
				//obj.profile("eval "+module,1,function evaller(){
					obj.$[module] = obj.eval(ast, module)
				//})
				if(typeof callback == 'function') callback()
				else //obj.profile("run "+module,1,function run(){
					obj.$[module].call(obj)
				//})
			}
			// lets analyze our data and load all our deps.
			var ast = obj.parse('->{'+code+'\n}', url)
			var deps = 0, hasdeps = 0
			// load our dependencies
			var dep = ast.getDependencies()
			ast.getDependencies().forEach(function(file){
				deps++, hasdeps = 1
				ONE.$.http_load( obj, file, function on_http_load(){
					if(!--deps) run()
				})
			})
			if(!hasdeps) run()
		}
		var elem = document.getElementById(module)
		if(elem){
			setTimeout(function(){on_http_get(elem.innerHTML)},0)
		}
		else this.http_get(url, on_http_get)
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

ONE.browser_boot_()