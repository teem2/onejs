"use strict"
// ONEJS Runtime
// Copyright (C) 2014 ONEJS 

ONE.worker_boot_ = function(root){
	self.onmessage = function(event){
		var msg = event.data
		if(msg._id == 'eval'){ // lets parse and eval a module
			var ast = ONE.root.$['_' + msg.module]
			if(!ast){
				return console.log('Module ' + msg.module + ' not parsed')
			}
			ONE.root.$[msg.module] = ONE.root.eval(ast, msg.module)
			return
		}
		if(msg._id == 'parse'){
			ONE.root.$['_' + msg.module] = ONE.root.parse('->{' + msg.value + '\n}', msg.module)
			return
		}
		if(msg._id == 'run'){
			ONE.root.$[msg.module].call(ONE.root)
			return
		}
	}
	ONE._proxy_uid = 1
	ONE._proxy_free = []
	ONE.init_()
	ONE.root = ONE.Base.create(ONE,function(){ this.__class__='Root'})
}


ONE.proxy_ = function(){
	this.Base.Proxy = this.Base.extend(function(){
		this._init = function(){
			// we have to send our object over to the other side
			var uid
			if(!ONE._proxy_free.length) uid = ONE._proxy_uid++
			else uid = ONE._proxy_free.pop()

			var msg = {_id:'create', _uid: uid}

			this._uid = uid
			var proto = this
			var proxy = this.Base.Proxy
			while(proto != proxy){
				var keys = Object.keys(proto)
				for(var i = 0, l = keys.length;i < l;i++){
					var k = keys[i]
					if(k.charAt(0)!='_'){
						var value = proto[k]
						if(value._uid){ // we are an object ref
							msg[k] = value._uid
						}
						else if(value._compiler_){
							msg[k] = value._compiler_.call(this, value, k)
						}
						else if(value.t){
							msg[k] = value
						}
					}
				}
				proto = Object.getPrototypeOf(proto)
			}
			self.postMessage(msg)
		}
		
		this.proxy_compiler = function( value, name ){
			// lets compile the value.bind
			if(!value || !value.bind) throw new Error('cannot compile '+name)
			var ast = value.bind
			var js = this.AST.ToJS
			js.new_state()
			// plug the module of the ast node
			js.module = ast.module
			var code = 'return ' + js.expand(ast)
			return code
		}
		
		// mark signal with a compiler function
		this.compile = function( signal, compiler ){
			signal._compiler_ = compiler || this.proxy_compiler
		}
	})
}

ONE._createWorker = function(root){
	var source =
		'\nONE = {}' +
		'\nvar Assert'+
		'\nONE.init_ = ' + ONE.init_.toString() +
		'\nONE.base_ = ' + ONE.base_.toString() +
		'\nONE.signal_ = ' + ONE.signal_.toString() +
		'\nONE.proxy_ = ' + ONE.proxy_.toString() +
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
	ONE._proxy_cache = {}
	ONE._proxy_uids = {}

	worker.onmessage = function(event){
		var msg = event.data
		// we have to create an object
		if(msg._id == 'create'){
			var obj = Object.create(ONE.Base)
			ONE._proxy_uids[msg._uid] = obj
			// lets look up properties in our cache
			var keys = Object.keys(msg)
			for(var i = 0, l = keys.length;i<l;i++){
				var k = keys[i]
				var v = msg[k]
				if(k.charAt(0) != '_'){
					if(typeof v == 'string'){
						var fn = ONE._proxy_cache[v]
						if(!fn){
							ONE._proxy_cache[v] = fn = 
								Function('module', v)({})
						}
						obj[k] = fn
					}
					else if(typeof v == 'number'){
						obj[k] = ONE._proxy_uids[v]
					}
					else{
						obj[k] = v
					}
				}
			}
			if(obj.init) obj.init()
		}
	}

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

	function module_get( url, module ){
		return ONE.Signal.wrap(function(sig){
			var elem = document.getElementById(module)
			if(elem){
				var value = elem.innerHTML
				worker.postMessage({_id:'parse', module:module, value:value})
				return sig.end(value)
			}
			// do some XMLHTTP
			var pthis = this
			var req = new XMLHttpRequest()
			req.open("GET",url,true)
			req.onreadystatechange = function(){
				if(req.readyState == 4){
					if(req.status != 200) return sig.throw(req.status)
					var value = req.responseText
					worker.postMessage({_id:'parse', module:module, value:value})
					return sig.end(value)
				}
			}
			req.send()
		})
	}
	
	var type = "main"
	var m = location.hostname.match(/(.*?)\.onejs\.io/)
	if(m) type = m[1]
	
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
				data_sig = loader[module] = module_get(url, module)
			}
			// otherwise we only resolve sig
			data_sig.then(function(value){
				// okay lets scan for our dependencies
				var all = []
				value.replace(/import\s+(\w+)/g, function(m, mod){
					all.push(load_dep(mod))
				})
				ONE.Signal.all(all).then(function(){
					if(first) worker.postMessage({_id:'eval', module:module})
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
		worker.postMessage({_id:'run', module:root})	
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