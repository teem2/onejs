#!/usr/bin/env node --harmony
// ONEJS Runtime
// Copyright (C) 2014 ONEJS 

// MIT license: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

ONE = {}

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

	if(global.Promise === undefined) global.Promise = Promise
	
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

ONE.nodejs_boot_()