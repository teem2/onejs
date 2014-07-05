"use strict"
// ONEJS Runtime
// Copyright (C) 2014 ONEJS 

ONE.worker_boot_ = function(root){
	self.onmessage = function(event){
		var msg = event.data
		if(msg.id == 'eval'){ // lets parse and eval a module
			var ast = ONE.root.$['_' + msg.module]
			if(!ast){
				return console.log('Module ' + msg.module + ' not parsed')
			}
			ONE.root.$[msg.module] = ONE.root.eval(ast, msg.module)
			return
		}
		if(msg.id == 'parse'){
			ONE.root.$['_' + msg.module] = ONE.root.parse('->{' + msg.value + '\n}', msg.module)
			return
		}
		if(msg.id == 'run'){
			ONE.root.$[msg.module].call(ONE.root)
			return
		}
	}
	ONE.init_()
	ONE.root = ONE.Base.create(ONE,function(){ this.__class__='Root'})
}

ONE._createWorker = function(root){
	var source =
		'\nONE = {}' +
		'\nvar Assert'+
		'\nONE.init_ = ' + ONE.init_.toString() +
		'\nONE.base_ = ' + ONE.base_.toString() +
		'\nONE.signal_ = ' + ONE.signal_.toString() +
		'\nONE.ast_ = ' + ONE.ast_.toString() + 
		'\nONE.genjs_ = ' + ONE.genjs_.toString() +
		'\nONE.parser_strict_ = ' + ONE.parser_strict_.toString() +
		'\nONE.worker_boot_ = ' + ONE.worker_boot_.toString() +
		'\nONE.worker_boot_("'+root+'")'
	var blob = new Blob([source], { type: "text/javascript" })
	this._worker_url = URL.createObjectURL(blob)
	return new Worker(this._worker_url)
}

// Bootstrap code for the browser, started at the bottom of the file
ONE.browser_boot_ = function(){
	//maximize time parallelism to start a worker
	var worker = ONE._createWorker()
	
	ONE.signal_.call( this.Signal = {} )

	function reloader(){
		var rtime = Date.now()
		var x = new XMLHttpRequest()
		x.onreadystatechange = function(){
			if(x.readyState != 4) return
			if(x.status == 200){
				//console.clear()
				return location.reload()
			}
			setTimeout(reloader, (Date.now() - rtime) < 1000?500:0)
		}
		x.open('GET', "/_reloader_")
		x.send()
	}

	function http_get( url, module ){
		return ONE.Signal.wrap(function(sig){
			// do some XMLHTTP
			var pthis = this
			var req = new XMLHttpRequest()
			req.open("GET",url,true)
			req.onreadystatechange = function(){
				if(req.readyState == 4){
					if(req.status != 200) return sig.throw(req.status)
					var value = req.responseText
					worker.postMessage({id:'parse', module:module, value:value})
					return sig.end(value)
				}
			}
			req.send()
		})
	}
	
	var type = "main"
	var root
	if(location.hash){
		reloader()
		root = location.hash.slice(1)
		var hack = location.hash.indexOf('?')
		if(hack !== -1) root = root.slice(0,hack-1)
	}
	else root = type
	
	var loader = {}
	// when do we resolve a module? when all its deps have been loaded.
	function load_dep( module ){
		// lets load a module
		return ONE.Signal.wrap(function(sig){
			var url = module + '.n'
			var data_sig = loader[module]
			var first = false
			if(!data_sig){
				first = true
				data_sig = loader[module] = http_get(url, module)
			}
			// otherwise we only resolve sig
			data_sig.then(function(value){
				// okay lets scan for our dependencies
				var all = []
				value.replace(/import\s+(\w+)/g, function(m, mod){
					all.push(load_dep(mod))
				})
				ONE.Signal.all(all).then(function(){
					if(first) worker.postMessage({id:'eval', module:module})
					sig.end()
				}, 
				function(err){
					sig.throw(err)
				})
			}, 
			function(err){
				sig.throw(err)	
			})
		})
	}
	
	load_dep(root).then(function(){
		worker.postMessage({id:'run', module:root})	
	})
	
	// initialize ONEJS also on the main thread	
	ONE.init_()

	window.addEventListener("load", function(){
	})

	window.onerror = function(msg, url, line) {
		var name = url.match(/[^\/]*$/)[0]
		ONE.error(msg + ' in '+name+' line '+line)
		return false
	}
} 

ONE.browser_boot_()