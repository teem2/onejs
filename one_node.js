#!/usr/bin/env node --harmony
// ONEJS Runtime
// Copyright (C) 2014 ONEJS 
"use strict"
global.ONE = {}

ONE.nodejs_boot_ = function(){
	// include other parts
	global.ONE = ONE
	require('./one_base.js')
	require('./one_parser.js')
	require('./one_genjs.js')
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
	root = root.replace(/\.n$/,"")
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
			var code = fs.readFileSync(file).toString()
			if(watcher) watchFile( file )
		} 
		catch (e){
			console.log('Cant open '+file, e)
			process.exit(-1)
		}
		// skip #! header
		if(code.charCodeAt(0) == 35 &&
		   code.charCodeAt(1) == 33){
		   	var pos = 0, len = code.length
			while(pos < len) if(code.charCodeAt(++pos)==10) break
			code = code.slice(pos)
		}

		var ast = obj.parse('->{'+code+'\n}', file)
		ast.getDependencies().forEach(function(file){
			loadFile( obj, file )
		})
	//try{
		obj.$[module] = obj.eval(ast, module)

		//}catch(e){
			//console.log(e)
		//}
	}
	function reload(){
		var obj = ONE.Base.new()
		loadFile( obj, root )
		var call = obj.$[root]
		if(call)call.call(obj)
	}

	reload()
}

ONE.nodejs_boot_()
