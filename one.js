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
					obj.$[module].call(obj)
				//})
			}
			// lets analyze our data and load all our deps.
			var ast = obj.parse('->{'+code+'\n}', undefined, url)
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
		var ast = obj.parse('->{'+code+'\n}', undefined, file)
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

// Base class

ONE.base_ = function(){

	this.__onename__ = 'Base'

	// inherit a new class, whilst passing on the scope

	this.extends = function( proto, role, last ){

		if( arguments.length == 0 ) return ONE.Base
		if( arguments.length == 1 ){
			role = proto
			proto = ONE.Base
		}

		if(arguments.length == 3){
			var setter = proto
			proto = role
			role = last
		}
		
		if( typeof proto == 'string' ) proto = this.resolve( proto )

		if( !proto || typeof proto != 'object' ) throw new Error("Cannot create new class from this prototype")

		var obj = Object.create( proto )
		obj.$ = this.$
		obj._ = this
		obj.__onename__ = 'unknown-class'
		if(! obj.load ){
			obj.load = this.load
			obj.extends = this.extends
			obj.new = this.new
		}
		obj.load( role )

		if(setter){
			if( this.__lookupSetter__( setter ) ) throw new Error("Cannot redefine class " + setter )
			if( setter in this ){
				obj.load( this[ setter ] )
			}
			var storeKey = '__' + setter
			this[ storeKey ] = obj
			Object.defineProperty( this, setter, {
				configurable:true,
				enumerable:true,
				get:function(){
					return this[ storeKey ]
				},
				set:function( value ){
					this[ storeKey ].load( value )
				}
			})
		}

		return obj
	}

	// Internal prefixes:
	// __xx = computed value storage
	// $$xx = expression storage
	// __xx__ = class datastructures
	// __$xx = system private, not copied by learn/forget
	// _$Oxx = Object that needs to be merged by learn/forget
	// _$Axx = Array that needs to be merged by learn/forget
	// $_xx = system private, but copied by learn/forget
	// $ = scope object

	// Currently in use:
	// _$AHkey = Signal hooks array
	// __$exprs = Expressions to init
	// __$sigbinds = $_sigbind signals to init
	// $_sigbind = bind to signal (used by Track)
	// $_sigunbind == unbind from signal
	// $_Mkey = monitoring listeners callback
	// __onename__ = class/role name if available
	// __roles__ = roles object
	// __overloads__ = role overloading stacks

	this.extend = function( role ){
		return this.extends( this, role )
	}

	// create a new object

	this.new = function(){
		var obj = Object.create( this )

		var arg
		var len = arguments.length
		if(len){
			this.__maker__ = arguments[0]
			if(len > 1) arg = Array.prototype.slice.call( arguments, 1 )
		}

		if(obj._make) obj._make.apply( obj, arg )
		else if(obj.make) obj.make.apply( obj, arg )
		else if( arg ) obj.load.apply( obj, arg )
		
		return obj
	}
	
	// plain value storage wrapper for overloads
	function StackValue(v){
		this.v = v
	}
	
	// load a property bag
	
	this.load = function( irole ){
		var role = irole
		if( typeof irole == 'string' ){// try to read it from scope
			role = this.$[irole]
			if( !role ) throw new Error("Cannot find role "+irole+" on this")
		}

		if( typeof role == 'function' ){
			// if we have arguments, we need to execute the
			// function on a clean object and pull out the right props.
			if( arguments.length > 1 ){
				var base = this.Base.new()
				role.call( base )
				for( var i = 1;i< arguments.length;i++){
					var k = arguments[i]
					var as = k
					if( typeof k == 'object') as = k.as, k = k.key
					var v = base[ k ]
					if(v === undefined) throw new Error("Cannot load specific "+k+" from "+irole)
					this[ as ] = v
				}
			}
			else role.call( this )
		}
		
		if( typeof role == 'object' ){
			if( arguments.length > 1 ){
				for( var i = 1;i< arguments.length;i++){
					var k = arguments[i]
					var as = k
					if( typeof k == 'object') as = k.as, k = k.key
					var v = role[ k ]
					if(v === undefined) throw new Error("Cannot load specific "+k+" from "+irole)
					this[ as ] = v
				}
			}else 
			for( var k in role ) this[ k ] = role[ k ]
		}
	}
	
	// learn a role, creates undo stacks so forget works.
	 
	this.learn = function( ){

		var roles
		var overloads
		var isfirst
		if( !this.hasOwnProperty('__roles__') ){
			roles = this.__roles__ = [ ] 
			isfirst = true
			Object.defineProperty( this, '__roles__', {enumerable:false, configurable:false} )
			if(! this.hasOwnProperty('__overloads__') ){
				overloads = this.__overloads__ = { }
				Object.defineProperty( this, '__overloads__', {enumerable:false, configurable:false} )
			}
		} else {
			roles = this.__roles__
			overloads = this.__overloads__
		}
		
		var learn = [ ]
		for( var i = 0, len = arguments.length; i < len; i++ ){
			var role = arguments[ i ]
			if( typeof role == 'string' ){// try to resolve it on the scope
				role = this.resolve( role )
				if( !role ) throw new Error("Cannot find role "+arguments[i]+" on this")
			}
			
			if( typeof role == 'function' ){
				var obj = Object.create( ONE.Base )
				obj.__teach__ = this
				obj.__role__ = role
				if( i == 0 && arguments.length > 1 ) role.apply( obj, Array.prototype.slice( arguments, 1 ) )
				else role.call( obj, this )
				role = obj
			} 
			
			if( typeof role != 'object' ) throw new Error("Cannot learn role " + role)

			if( roles.indexOf( role ) == -1 ){
				roles.push( role )
				learn.push( role )
			}
		}

		if( !learn.length ) return this
		for( var i = 0, len = learn.length; i < len; i++ ){
			
			var source = learn[ i ]
			
			var keys = Object.getOwnPropertyNames( source )
			var klen = keys.length
	
			for( var ki = 0; ki < klen; ki ++ ){
				var k = keys[ ki ]

				if( k[ 0 ] === '$ ' ){
					if( k.length == 1 || k[1] == '$' ) continue // scope
				}
				if( k[ 0 ] === '_' && ( k[ 1 ] === '$' || k[ 1 ] === '_' ) ){ // merge arrays
					if( k[ 1 ] == '_' ) continue //private storage
					// array merging code
					if( k [ 2 ] == 'O' ){ // object merge
						if( !this.hasOwnproperty( k ) ) this[ k ] = Object.create( source[ k ] )
						else {
							var out = this[ k ]
							if( typeof out != 'object' ) throw new Error("Trying to assign object on non object "+k)
							var obj = source[ k ]
							for( var kk in obj ) out[ kk ] = obj[ kk ]
						}
					} else if( k[ 2 ] == 'A') { // array merge
						if( !this.hasOwnProperty( k ) ) this[ k ] = source[ k ].slice()
						else  Array.prototype.push.apply( this[ k ], source[ k ] )
					}
					continue
				}
				
				// what we do is we take a look at whats in 'this' now 
				// and if something exists, we write it into our overload array
				var stack = overloads[ k ] || ( overloads[ k ] = [ ] )
				var val = this['$$'+k] || this[ k ]
				
				// harmless __supername__ property for usable this.super
				if( typeof val == 'function' ) val.__supername__ = k
				
				if( val !== undefined ){
					if( stack.length ){ // compare to stack top
						var top = stack[ stack.length - 1 ]
						if( top instanceof StackValue ) top = top.v
						else top = top[ k ]
						if( top !== val ){
							stack.push( new StackValue( val ) )
						}  // compare to prototype
					} else if( Object.getPrototypeOf( this )[ k ] !== val ){
						stack.push( new StackValue( val ) )
					}
				}
				// overlay the role
				stack.push( source )
				
				if( this.__lookupSetter__( k ) ){ // we have a setter so just call it
					this[ k ] = source[ '$$' + k ] || source[ k ]
					continue
				} 

				if( source.__lookupSetter__( k ) ){ // target has a setter, copy the whole descriptor
					Object.defineProperty( this, k, Object.getOwnPropertyDescriptor( source, k ) )
					if( val !== undefined ) this[ k ] = val // trigger setter of parent with my value
					continue
				}

				this[ k ] = source[ k ] // normal assign
				
				if( !source.propertyIsEnumerable( k ) ){
					Object.defineProperty( this, k, {enumerable:false, configurable:true})
				}
			}
		}
		return this
	}

	// forget a role

	this.forget = function( role ){
	   if( !this.hasOwnProperty('__roles__') ) return
		
		var forget = [ ]
		var roles = this.__roles__
		var overloads = this.__overloads__

		if( !roles.length ) return
		var num = 0
		for( var i = 0, len = arguments.length; i < len; i++ ){

			var role = arguments[ i ]

			if( typeof role == 'number'){
				num = role
				continue
			}

			if( typeof role == 'string' ){// try to resolve it on the scope
				role = this.resolve( role )
			} 
		
			if( typeof role == 'function'){
				for( var i = 0; i < roles.length; i++ ){
					if( roles[ i ].__role__ ===  role ){
						forget.push( roles[ i ] )
						roles.splice( i, 1 )
						break
					}
				}
			} else if ( typeof role == 'object' ){
				var i = roles.indexOf( role )
				if( i !== -1 ) { 
					forget.push( role )
					roles.splice( i, 1 )
				}
			} 
		}

		if( num !== 0 ) forget.push.apply( forget, roles.splice( -num, num ) )

		if( !forget.length ) return

		for( var i = forget.length -1; i >= 0; i-- ){
			// restore a property as best we can
			var source = forget[ i ]
			
			var keys = Object.getOwnPropertyNames( source )
			var klen = keys.length
			
			for( var ki = 0; ki< klen; ki++ ){
				var k = keys[ ki ]

				if( k[ 0 ] === '$' ){
					if( k.length == 1 || k[ 1 ] === '$' ) continue // scope
				}
				
				if( k[ 0 ] === '_' && ( k[ 1 ] === '$' || k[ 1 ] === '_' ) ){ // unmerge arrays
					if( k[ 1 ] == '_' ) continue //private storage
					
					if( !this.hasOwnProperty( k ) ) continue
					if( k[ 2 ] != 'A' ) continue
					
					// remove our array items
					var roleArray = source[ k ]
					var myArray = this[ k ]
					for( var i = roleArray.length - 1; i >= 0; i-- ){
						var idx = myArray.indexOf( roleArray[ i ] )
						if( idx !== -1 ) myArray.splice( idx, 1 )
					}
				} else { // see if we have to restore our property from the overload stack
					var stack = overloads[ k ] // the overload stack
					// our top of the stack
					var top = stack[ stack.length - 1 ]
					if( top instanceof StackValue ) top = top.v
					else top = top[ k ]

					// get our current value
					var val = this['$$'+k] || this[ k ]
					
					var srcidx = stack.indexOf( source )
					// check if we are like the top of the stack, and we are removing that one
					if( val === top && srcidx === stack.length - 1 ){ 
						// fetch overloaded value
						var newtop = stack[ srcidx - 1 ]
						// restore property from overload stack
						if( newtop === undefined ) this[ k ] = undefined
						else {
							if( newtop instanceof StackValue ) this[ k ] = newtop.v
							else this[ k ] = newtop[ k ]
						}                            
					}
					// remove our source from the overlay stack
					stack.splice( srcidx, 1 )
				}
			}
		}
	}

	// export copies properties onto the scope

	this.export = function( ){
		for( var i = 0, len = arguments.length; i < len; i++ ){
			var key = arguments[ i ]
			if( typeof key != 'string' ) throw new Error("Cannot export "+key)
			var obj = this.resolve( key )
			if( obj === undefined ) throw new Error("Cannot find "+key)
			this.$[ key ] = obj
		}
	}

	// Make properties non enumerable

	this.enumfalse = function(){
		for( var i = arguments.length - 1; i>=0; i--){
			Object.defineProperty( this, arguments[i], {enumerable:false, configurable:true})
		}
	}

	this.now = (function(){
		var p = typeof window !== 'undefined' && window.performance || {}
		return (p.now && p.now.bind(p)) ||
			(p.webkitNow && p.webkitNow.bind(p)) ||
			(p.msNow && p.oNow.bind(p)) ||
			(p.oNow && p.oNow.bind(p)) ||
			(p.mozNow && p.mozNow.bind(p)) ||
			function(){ return Date.now() }
	})()

	// Quickly profile things

	this.profile = function( msg, times, call ){
		var tm = this.now()
		if(arguments.length == 1) call = msg, times = 1, msg = ''
		if(arguments.length == 2) call = times, times = msg, msg = ''
		for( var i = 0; i < times; i++ ){
			call.call( this, i )
		}
		tm = this.now() - tm
		console.log("profile " + msg + " " + Math.ceil(tm)+'ms')
		return tm
	}

	// Create a new scope

	this.scoped = function( name ){
		if( this.$.__owner__ == this ) throw new Error("Don't scope more than once")
		// create a prototype backed scope chain
		var $ = Object.create( this.$ )
		if( name ) this.$[ name ] = $
		this.$ = $
		$.$ = $ // make scope objects scope itself
		$.__owner__ = this
		return $
	}

	// Finding the thing you overloaded, for anything besides objects
	// and functions this is a 'probably' since it cant uniquely identify the value
	
	this.overloads = function( key, me ){
		var proto = this
		var next // flags if the next item is the one i want
		var ret // return value of recur
		// recursive Role scanner
		function recur( obj ){
			if( obj.hasOwnProperty( key ) ){
				var val = obj[ key ]
				if( next && val != me ) return ret = val
				if( val == me ) next = 1
			}
			if( obj.hasOwnProperty( '__overloads__') ){
				var stack = obj.__overloads__[ key ]
				if( stack ) for( var i = stack.length - 1; i >= 0; i-- ){
					var item = stack[ i ]
					if( next ){
					   var val = item instanceof StackValue ? item.v : item[ key ]
					   if( val != me ) return ret = val
					}
					if(item instanceof StackValue){
						if( item.v == me ) next = 1
					} else if( recur( item ) ) return ret
				}
			}
		}
		while( proto ){
			if( recur( proto ) ) return ret
			proto = Object.getPrototypeOf( proto )
		}
	}
	 
	// Calls the function you overloaded, works with roles and prototypes
	// utilizes a __supername__ property on your function to quickly find out
	// the name of function to traverse the prototype and overload objects
	// Call as this.super( arguments ) in the overloaded function 
	// Depends on arguments.callee to fetch the function you want to
	// call super on
	// or to change the args: this.super( arguments, newarg1, newarg2 )

	this.super = function( args ){
		// figure out arguments
		var me = args.callee || args
		var fnargs = args
		// someone passed in replacement arguments
		if( arguments.length > 1 ) fnargs = Array.prototype.slice.apply( arguments, 1 )
		// look up function name
		var name = me.__supername__
		if( name !== undefined ){ // we can find our overload directly
			var fn = this.overloads( name, me )
			if( fn && typeof fn == 'function' ) return fn.apply( this, fnargs )
		} else { // we have to find our overload in the entire keyspace
			for( var k in this ) {
				// filter out the internal properties
				if( !(k in ONE.Base) && k[0] != '_' && (k[1] != '$' || k[1] != '_') && 
					(k[0] != '$' || k.length > 1 )){
					fn = this.overloads( k, me )
					if( fn && typeof fn == 'function' ) {
						me.__supername__ = k // store it for next time
						return fn.apply( this, fnargs )
					}
				}
			}
		}
	}

	// resolves a string multipart object a.b.c.d on this

	this.resolve = function( str ){
		var parts = str.split('.')
		var t = this
		for( var i = 0, l = parts.length; t && i < l; i++ ) t = t[ parts[ i ] ]
		return t
	}

	// push a property on the overload stack
	 
	this.push = function( key, value ){
		var overloads
		if( !this.hasOwnProperty('__overloads__') ){
			overloads = this.__overloads__ = { }
			Object.defineProperty( this, '__overloads__', {enumerable:false, configurable:false} )
		} else overloads = this.__overloads__
		
		var stack = overloads[ key ] || (overloads[ key ] = [ ])

		stack.push( new StackValue( this[ '$$'+key ] || this[ key ] ) )
		
		this[ key ] = value
	}
	
	// pop a property off the overload stack
	 
	this.pop = function( key ){
		if( !this.hasOwnProperty('__overloads__') ) return
		var overloads = this.__overloads__
		var stack = overloads[ key ]
		if(! stack || !stack.length ) return
		var top = stack[ stack.length - 1]
		top = top instanceof StackValue ? top.v : top[ key ] 
		this[ key ] = top
		stack.pop()
	}

	// map

	this.map = function( array, callback ){
		var out = []
		for( var i = 0; i < array.length; i++){
			out[i] = callback.call(this, array[ i ])
		}
		return out
	}

	// each
	 
	this.each = function( array, callback ){
		var len = array.length
		for( var i = 0; i < len; i++){
			callback.call(this, array[ i ])
		}
	}

	// flush an entire property stack

	this.flush = function( key ){
		if( !this.hasOwnProperty('__overloads__') ) return
		var overloads = this.__overloads__
		var stack = overloads[ key ]
		if(! stack || !stack.length ) return
		stack.length = 0
	}
	
	// return the property at index in the stack
	 
   this.index = function( key, idx ){
		if( !this.hasOwnProperty('__overloads__') ) return
		var overloads = this.__overloads__
		var stack = overloads[ key ]
		if(! stack || !stack.length ) return
		if( idx < 0 ) var last = stack[ stack.length - idx ]
		else var last = stack[ idx ]
		if( !last ) return
		return last instanceof StackValue ? last.v : last[ key ] 
	}
   
	// bind the signals

	this.bind_signals = function(){
		var sigbinds = this.__$sigbinds
		if( sigbinds ){
			for( var k in sigbinds ){
				this[ k ] = sigbinds[ k ]
			}
		}
	}
		
	// hook / define a signal callback

	this.hook = function( key, func ){
		if( !this.__lookupSetter__( key ) ) this.signal( key )
		this[ key ] = func
	}

	// unhook a signal

	this.unhook = function( key, func ){
		var hookKey = '_$AH' + key
		if( this.hasOwnProperty( hookKey ) ){
			if( !func ) return this[ hookKey ].length = 0
			// find my event and remove it
			var arr = this[ hookKey ], idx
			while( (idx = arr.indexOf( func ) ) != -1) arr.splice( idx, 1 )
		}
	}

	//  hook a signal callback that only lasts n times

	this.times = function( times, key, func ){
		if( !this.__lookupSetter__( key ) ) this.signal( key )
		function fn( value, old ){
			if( --times <= 0  ) this.unhook( key, fn )
			func.call( this, value, old )
		}
		this[ key ] = fn
	}

	// hook a signal callback that only gets called once

	this.once = function( key, func ){
		return this.times( 1, key, func )
	}
	
	// emit a signal
	
	this.emit = function( key, value, old ){
		var hookKey = '_$AH' + key
		var valueKey = '__' + key
		this[ valueKey ] = value
		var n = this[ hookKey ] // next key 
		if( n ){
			var p = this // proto walker
			while( p && n ){
				if( p.hasOwnProperty( hookKey ) ){
					for( var i = n.length - 1; i >= 0; i-- ) n[ i ].call( this, value, old )
					p = Object.getPrototypeOf( p )
					n = p[ hookKey ]
				} else p = Object.getPrototypeOf( p )
			}
		}
	}
	
	//  make a signal conditional callback

	this.when = function( expr, fn ){
		if(!fn){ 
			if ( expr ) return 1
			return undefined
		}
		var key
		while( !key || key in this ) key = '_when' + parseInt(Math.random()*10000)
		this.signal( key )
		this[ key ] = expr
		this[ key ] = function(v){
			if( v ) fn.call( this, v )
		}
		return key
	}

	// monitor hooks

	this.monitorHooks = function( key, cb ){
		var monitorKey = '$_M' + key
		this[ monitorKey ] = cb
	}

	// fetch the listener array

	this.getHooks = function( key ){
		var hookKey = '_$AH' + key
		return this[ hookKey ]
	}

	// define all arguments as signals

	this.signals = function(){
		for( var i = 0;i < arguments.length; i++) this.signal( arguments[i] )
	}
	
	function empty(){}
	
	// define a property

	this.defineProperty = function( key, def ){
		Object.defineProperty( this, key, def )
	}

	// define key as a signal

	this.signal = function( key, initvalue, setter ){

		if( arguments.length == 2 && typeof initvalue == 'function') setter == initvalue, initvalue = undefined

		var hookKey = '_$AH' + key
		var monitorKey = '$_M' + key
		var valueKey = '__' + key
		var exprKey = '$$' + key            
		
		// set a value and call all listeners
		function setValue( v ){
			var o = this[ valueKey ]
			if(o !== v){
				this[ valueKey ] = v
				if( setter ) setter.call( this, v )
				// inlined .emit signal
				var n = this[ hookKey ]
				if( n ){
					var p = this
					while( p && n ){
						if( p.hasOwnProperty(hookKey) ){
							for( var i = n.length - 1; i >= 0; i-- ) n[ i ].call(this, v, o)
							p = Object.getPrototypeOf( p )
							n = p[ hookKey ]
						}
						else p = Object.getPrototypeOf(p)
					}
				}
			}
		}

		// setter for array components with expressions
		function compGen( comp, i ){
			Object.defineProperty( this, comp, {
				configurable:true,
				enumerable:true,
				get:function(){ return this[ valueKey ][ i ] },
				set:function( value ){
					var arr = this[ valueKey ]
					var old = arr[ i ]
					if( old !== value ){
						arr = this[ valueKey ] = arr.slice()
						arr[ i ] = value
						if( setter ) setter.call( this, arr )
					}
				}
			})
		}
		
		function setSignal( value, bypass ){
			
			if( value === undefined ){
				// set to undefined but dont fire signal
				// this allows you to implement signal filtering in-line
				this[ valueKey ] = undefined
				return
			}

			if( bypass ){
				setValue.call( this, value )
				return 
			}

			if( typeof value === 'function' ){
				// add a listener
				var list = this.hasOwnProperty( hookKey ) ? this[ hookKey ] : (this[ hookKey] = [] )
				list.push( value )
				if( this[ monitorKey ] ) this[ monitorKey ]( value )
				return
			}
			
			var oldbind
			if( this.hasOwnProperty( exprKey ) ){ // clean up expressions
			
				var expr = this[ exprKey ]
				if( Array.isArray( expr ) ){
					for(var i = 0; i < expr.length; i++ ){
						if( typeof expr[ i ] === 'object' ){
							var comp = key + '$' + i
							var obj = expr[i]
							if(obj.$_sigunbind){
								oldbind = oldbind || []
								oldbind[i] = obj
								obj.$_sigunbind( this, comp )
							}
							Object.defineProperty( this, comp, {
								configurable:true, enumerable:true,
								get:empty, set:empty
							})
						}
					}
				} else if( typeof expr === 'object' && expr.$_sigunbind){ 
					oldbind = expr
					expr.$_sigunbind( this, key )
				}
				this[ exprKey ] = undefined
			}
			
			if( Array.isArray(value) ){
				// we got assigned an array. 
				// lets iterate the array for typeof != number
				var len = value.length
				for( var i = 0; i < len && typeof value[i] !== 'object'; i++ );
				if( i == len ){
					setValue.call( this, value )
					return
				}

				// sigbind the whole array if we have one sigbind
				if( this.hasOwnProperty('__onename__')){
					for( var i = 0; i< len; i++ ) if( value[i].$_sigbind ){
						if( !this.hasOwnProperty('__$sigbinds') ) {
							this.__$sigbinds = Object.create( this.__$sigbinds || null )
						}
						this.__$sigbinds[ key ] = value
						return
					}
				}
				
				// else process the array
				var exprs = this[ exprKey ] = Array( value.length )
				var out = Array( value.length )
				for( var i = 0; i< len; i++ ){
					var v = value[ i ]
					if(v.$_sigbind ){
						var comp = key + '$' + i
						// bind right now
						v = v.$_sigbind( this, comp, '__'+ comp, oldbind && oldbind[i] )
						exprs[i] = v
						// generate getter and setters for component
						compGen.call( this, comp, i )
						// store some computed values
						out[ i ] = this[ '__' + comp ]
					} else {
						out[ i ] = exprs[i] = v
					}
				}
				setValue.call( this, out )
				return
			}
			if( typeof value === 'number' || typeof value === 'boolean' || value == 'string'){
				setValue.call( this, value )
				return
			}
			if( typeof value === 'object' ){
				// check if object has a sigbind function
				if( value.$_sigbind ){
					// check if we are a class
					if( this.hasOwnProperty('__onename__')){
						if( !this.hasOwnProperty('__$sigbinds') ) {
							this.__$sigbinds = Object.create( this.__$sigbinds || null )
						}
						this.__$sigbinds[ key ] = value
					} else {
						value = value.$_sigbind( this, key, valueKey, oldbind )
						this[ exprKey ] = value
					}
				} else {
					setValue.call( this, value ) // normal object
				}
			}
		}
		
		var prev = this[ key ]

		Object.defineProperty( this, key, {
			configurable:true,
			enumerable:true,
			get:function(){
				return this[ valueKey ]
			},
			set:setSignal
		})
		if( prev !== undefined ) this[ key ] = prev
		if( setter ){
			if( initvalue !== undefined ) this[ valueKey ] = initvalue
		}
		else if( initvalue !== undefined ) this[ key ] = initvalue

	}

	// debug logging
	this.__out = []
	this.logwrite = function( level, args ){
		if(this.$ && this.$._logwrite){
			if(this.__out){
				var o = this.__out
				for(var i = 0;i<o.length;i+=2) this.$._logwrite.call( this.$, o[i], o[i+1] )
				this.__out = undefined
			}
			return this.$._logwrite.call( this.$, level, args )
		}
		this.__out.push(level, args)
		console.log.apply( console, args )
	}

	this.trace = function(){ ONE.logwrite(3, arguments); return arguments[0];}
	this.out = function(){ ONE.logwrite(2, arguments); return arguments[0];}
	this.warn = function(){ ONE.logwrite(1, arguments) }
	this.error = function(){ ONE.logwrite(0, arguments) }
}

// ONEJS AST code generators

ONE.ast_ = function(){

	// include the parser
	var parser = {}
	ONE.parser_strict_.call( parser )

	var parserCache = {}

	this.parse = function( source, template, filename, noclone ){
		parser.sourceFile = filename || ''

		var node = parserCache[source]
		if (! node ){
			node = parser.parse_strict( source )
			
			// scan up to pull out the essential ast node			
			if(node.steps.length == 1){
				var cm = node.comments
				node = node.steps[0]
				if(cm) node.comments = cm
			}
			if(node.type === 'Expr'){
				var cm = node.comments
				node = node.expr
				if(cm) node.comments = cm
			}
			parserCache[source] = node
		}

		if(!noclone){
			if( template ){
				var template_nodes = []
				node = node.clone( template_nodes )
			} else {
				node = node.clone()
			}
		}

		node.source = source
		node.pthis = this

		// we now need to process our template-replaces
		if( template ){
			var nodes = template_nodes
			var copy = this.AST.ast_copy;
			// we now need to overwrite the nodes in our tree with 
			// the template nodes
			for( var i = 0; i < nodes.length; i++ ){
				var tgt = nodes[ i ]
				var src = template[ tgt.arg.name ]
				// clean out the node
				tgt.prefix = undefined
				tgt.op = undefined
				tgt.arg = undefined
				if(!src) throw new Error("Template variable not found: " + tgt.arg.name)
				if(typeof src == 'object'){
					copy[src.type]( src, tgt )
					tgt.pthis = this
				} else {
					tgt.type = 'Value'
					if(typeof src == 'string')
						tgt.raw = '"'+src+'"'
					else
						tgt.raw = src
				}
			}
		}
		return node
	}

	this.eval = function( ast, comments, filename ){
		if( typeof ast == 'string' ) 
			ast = this.parse( ast, undefined, filename, true )
		// alright we have to compile us some code!
		var js = this.AST.js_serialize
		// make a fresh scope and signals store
		js.scope = {}
		js.signals = []
		js.line = 0
		js.comments = comments
		// if passing a function we return that
		if(ast.type == 'Arrow' || ast.type == 'Function'){
			var steps = ast.body.steps
			if(steps && steps[0].expr && steps[0].expr.flag == 35){
				var dump = steps[0].expr.name
				steps.splice(0,1)
				if(dump.indexOf('ast')!= -1)
					ONE.out( ast.dump() )
			}
			// name anonmous function with a filename if possible
			var nametag
			if(filename) nametag = 'file__'+filename.replace(/[\.\/]/g,'_')
			var code = 'return ' + js.Function( ast, 0, nametag )
			if( dump ){
				if(dump.indexOf('code')!=-1){
					var code = this.AST.code_serialize
					code.comments = comments
					ONE.out( code.Function(ast) )
				}
				else if(dump.indexOf('js')!=-1)
					ONE.out( code )
			}
			try{
				var fn = Function.call(null, code)()
			} catch(e){
				console.log("ERROR",e,code)
			}
			return fn
		}
		var code = (ast.isExpr()?'return ':'') + js.expand( ast )
		var run = Function(code)
		return run.call(this)
	}

	// im sure this is slow, but who cares.
	//Error.stackTraceLimit=Infinity 
	//Error.prepareStackTrace = function( err, stack ){
	//	return stack
	//}

	// do a callstack trace including all file/line number info of all running code
	// including template evals
	this.trace = function(){
		return
		var stack = new Error().stack
		for(var i = 0;i<stack.length;i++){
			//console.log(stack[i].getFunction(),stack[i].getLineNumber())
			console.log(stack[i].getThis())
		}
	}

	// AST node
	parser.Node = this.AST = this.extends({}, function(){

		// AST nodes can be bound to signals
		this.$_sigbind = function( pthis, key, valkey, old ){

			// compile
			var sig_expr = this.sig_expr = this_signal_compile.call( this, this.source )
			// store info
			this.sig_pthis = pthis
			this.sig_key = key
			this.sig_valkey = valkey
			this.sig_listen = []
			
			// init and compute expression
			sig_expr.init.call( pthis, this.sig_listen, '$$' + key, valkey, key )
			sig_expr.call( pthis, 0, valkey, key )

			return this
		}
		
		this.$_sigunbind = function(){
			var listen = this.sig_listen
			for(var i = 0; i< listen.length; i += 3){
				var tgt = listen[ i ]
				var prop = listen[ i + 1 ]
				var fn = listen[ i + 2 ]
				tgt.unhook( prop, fn )
			}
		}

		this.getDependencies = function(){
			// lets find all load
			var out = []
			var steps = this.body.steps
			for( var i =0;i<steps.length;i++){
				var step = steps[i]
				if(step.type == 'Expr' && 
					step.expr.type == 'Call' &&
					step.expr.fn.name == 'load' &&
					step.expr.args &&
					step.expr.args[0].type == 'Value' &&
					step.expr.args[0].kind == 'string'){
					var file = step.expr.args[0].value
					// lets load our dependency
					out.push(file)
				}
			}
			return out
		}

		// AST structure definition
		// 0 is value
		// 1 is node
		// 2 is array
		// 3 is array of [ { key:1, value:1, kind:0 } ]

		this.ast_structure = {
			Program:{ steps:2 },
			Empty:{},

			Id: { name:0, flags:0 },
			Type: { name:0 },
			Value: { value:0, raw:0, kind:0 },
			This: { },

			Array: { elems:2 },
			Object: { keys:3 },
			Index: { object:1, index:1 },
			Key: { object:1, key:1 },

			Block:{ steps:2 },
			Expr: { expr:1 },
			List: { items:2 },

			Break: { label:1 },
			Continue: { label:1 },
			Label: { label:1, body:1 },

			If: { test:1, then:1, else:1 },
			Switch: { on:1, cases:2 },
			Case: { test:1, then:2 },

			Throw: { arg:1 },
			Try: { try:1, arg:1, catch:1, finally:1 },

			While: { test:1, loop:1 },
			DoWhile: { loop:1, test:1 },
			For: { init:1, test:1, update:1, loop:1 },
			ForIn: { left:1, right:1, loop:1 },
			ForOf: { left:1, right:1, loop:1 },
			ForTo: { left:1, right:1, loop:1, in:1 },

			Var: { defs:2 },
			Const: { defs:2 },
			TypeVar: { kind:1, defs:2, dim:1 },
			Struct: { id:1, struct:1, defs:2, dim:1 },
			Def: { id:1, init:1, dim:1 },

			Function: { id:1, params:2, rest:1, body:1, arrow:0, def:0 },
			Return: { arg:1 },

			Unary: { op:0, prefix:0, arg:1 },
			Binary: { op:0, prio:0, left:1, right:1 },
			Logic: { op:0, prio:0, left:1, right:1 },
			Assign: { op:0, prio:0, left:1, right:1 },
			Update: { op:0, prio:0, arg:1, prefix:0 },
			Condition: { test:1, then:1, else:1 },

			New: { fn:1, args:2 },
			Call: { fn:1, args:2 },

			Quote: { quote:1 },
			Rest: { id:1, dots:0 },
			Path: { dots:0, op:0, id:1 },
			Extends: { id:1, extend:1 },
			Do: { call:1, arg:1 },
			Callback: { call:1, body:1 },

			Debugger: { },
			With: { object:1, body:1 }
		}

		this.ast_clone = {}
		this.ast_copy = {}

		// Generate AST Tools clone and copy
		this.ASTToolGenerator = function(){
			var ast = this.ast_structure;

			var out = ''
			for( type in ast ){
				var tag = ast[ type ]
				var copy = ''
				var code = 'var c = Object.create( this.AST );\n'+
							   'c.type = n.type\n'+
							   'if(n.comments) c.comments = n.comments\n'+
							   'c.start = n.start\n'+
							   'c.end = n.end\n'
				var v = 0
				for( var k in tag ){
					var t = tag[ k ]
					copy += 'var _'+v+'=n.'+k+';if(_'+v+')c.'+k+'=_'+v+'\n'
					if( t === 0){
						code += 'var _'+v+' = n.'+k+';if(_'+v+')c.'+k+'=_'+v+'\n'
					} else if( t === 1){
						code += 'var _'+v+' = n.'+k+'\n'+
							'if(_'+v+')c.'+k+'=this[_'+v+'.type](_'+v+')\n'
					} else if(t === 2){
						code += 'var _'+v+' = n.'+k+'\n'+
							'if(_'+v+'){\n'+
								'\tvar x,y=[]\n'+
								'\tfor(var len = _'+v+'.length,i = 0;i<len;i++)'+
									'x = _'+v+'[i], y[i] = this[x.type](x)\n'+
								'\tc.'+k+'=y\n'+
							'}\n'
					}else if(t === 3){
						code += 'var _'+v+' = n.'+k+'\n'+
							'if(_'+v+'){\n'+
								'\tvar x,y=[]\n'+
								'\tfor(var len = _'+v+'.length,i = 0;i<len;i++)'+
									'x = _'+v+'[i], y[i] = {key:this[x.key.type](x.key),value:this[x.value.type](x.value)}\n'+
								'\tc.'+k+'=y\n'+
							'}\n'
					}
					v++
				}
				out += '_clone.'+type+'=function(n){\n' + code + '\nreturn c}\n' 
				out += '_copy.'+type+'=function(n, c){'+
					'c.type = n.type\n'+
					'if(n.comments) c.comments = n.comments\n'+
					'c.start = n.start\n'+
					'c.end = n.end\n'+
					copy+'\n return\n}\n'
			}
			(new Function('_clone', '_copy', out))(this.ast_clone, this.ast_copy)

			this.ast_clone.AST = this
			this.ast_clone.Unary = function( n ){
				var c = Object.create( this.AST )
				c.start = n.start
				c.end = n.end
				c.type = n.type
				c.prefix = n.prefix
				c.op = n.op
				if( n.prefix && n.op == '%'){
					if(n.arg.type !== 'Id') throw new Error('Unknown template & argument type')
					if( this.template ) this.template.push( c )
				}
				c.arg = this[n.arg.type]( n.arg )
				return c
			}
		}
		this.ASTToolGenerator()

		this.clone = function(template){
			this.ast_clone.template = template
			var clone = this.ast_clone[ this.type ]( this )
			this.ast_clone.template = undefined
			return clone
		}

		this.ast_isexpr = {
			Id: 1,
			Value: 1,
			This: 1,

			Array: 1,
			Object: 1,
			Index: 1,
			Key: 1,

			Expr: 1,
			List: 1,

			Function: 1,

			Unary: 1,
			Binary: 1,
			Logic: 1,
			Assign: 1,
			Update: 1,
			Condition: 1,

			New: 1,
			Call: 1,

			Quote: 1,
			Path: 1,
			Do: 1,
			Callback: 1,
		}

		this.isExpr = function(){
			return this.ast_isexpr[ this.type ]
		}

		this.toJS = function(comments){
			var js = this.js_serialize
			js.line = 0
			js.scope = {}
			js.comments = comments
			return js.expand( this )
		}

		this.toString =
		this.toCode = function(comments){
			var code = this.code_serialize
			code.line = 0
			code.comments = comments
			return code.expand( this )
		}

		this.code_serialize = {

			space:' ',
			newline:'\n',
			indent:'\t',
			semi:'',
			depth:'',
			// comment restoration
			cignore:0,
			comments:1,
			line:0,
			array_fix:0, //!TODO do this nicely

			// flag can be -1 0 or 1 meaning 'need parenthes, nothing, is statement'
			expand:function( n, term, flag ){ // recursive expansion
				if( !n || !n.type ) return ''
				n.genstart = this.line
				var ret = this[ n.type ]( n, flag )
				n.genend = this.line
				// do some comments restoration
				var comments = n.comments
				if( this.comments && comments && !this.cignore ){
					ret += this.comments_flush( n.comments, term )
				} 
				else if( term ) return ret + term
				if( this.cignore ) this.cignore--

				return ret
			},
			comments_flush:function( array, term ){
				if(!this.comments) return ''
				var cmt = array
				var out = ''
				var len = cmt.length
				if( term && len ) out += term
				for(var j = 0;j<len;j++){
					var c = cmt[j]
					if( c === -1 ) out += this.newline, this.line++
					else out += (j?this.depth:' ') + '// ' + c
				}
				return out
			},
			comments_or_newline : function( n ){
				if(n.comments && n.comments.length && this.comments){
					var ret 
					var old = this.depth
					this.depth += this.indent
					ret = this.comments_flush( n.comments )
					this.depth = old
					return ret
				}
				return this.newline
			},
			block:function( n, noindent ){ // term split array
				var old_depth = this.depth
				if(!noindent) this.depth += this.indent
				var out = ''
				for( var i = 0; i < n.length; i++ ){
					var b = n[ i ]
					var ret = this.expand( b, null, 1 ) 
					if(ret[0] == '(' || ret[0] == '[') out += this.depth + this.semi + ret
					else out += this.depth + ret
					var ch = out[out.length - 1]
					if(!this.comments || ch !== '\n' ){
						//if( ch == '}') out += this.newline, this.line++
						out += this.newline, this.line++
					}
				}
				this.depth = old_depth
				return out
			},
			flat:function( n ){
				if(n.length == 0) return ''
				var out = ''
				var len = n.length
				for( var i = 0; i < len; i++ ){
					if(i) out += ',' + this.space
					out += this.expand( n[ i ] )
				}
				return out
			},			
			list:function( n ){
				if(n.length == 0) return ''
				//var old_depth = this.depth
				//this.depth += this.indent
				var out = ''
				var len = n.length
				var term = ',' + this.space
				for( var i = 0; i < len; i++ ){
					out += this.expand( n[ i ], i<len-1?term:'' )
					if( out[ out.length - 1 ] == '\n' ) out += i == len - 1? old_depth:this.depth
				}
				//this.depth = old_depth
				return out
			},
			Program: function( n ){ 
				return this.block( n.steps, true )
			},
			Empty: function( n ){ 
				return ''
			},

			Id: function( n ){
				var flag = n.flag
				if(flag){
					if(flag === 126) return n.name+'~'
					if(flag === 33) return n.name+'!'
					if(flag === 64) return '@'+n.name
					if(flag === 35) return '#'+n.name
				}
				return n.name
			},
			Type: function( n ){
				return n.name
			},
			Value: function( n ){ 
				return n.raw 
			}, // string, number, bool
			This: function( n ){ 
				return 'this'
			},

			Array: function( n ){
				//!TODO x = [\n[1]\n[2]] barfs up with comments
				var old_cmt = this.comments
				if(this.array_fix++>0) this.comments = 0
				var ret = '['+ 
					(n.comments&&this.comments?this.comments_flush( n.comments )+this.depth+(n.elems.length?this.indent:''):'') + 
					this.list( n.elems ) + 
				']' 
				this.array_fix--
				this.comments = old_cmt
				this.cignore = 1
				return ret
			},
			Object: function( n ){ 
				var old_cmt = this.comments
				if(this.array_fix++>0) this.comments = 0
				var old_depth = this.depth
				this.depth += this.indent
				var k = n.keys
				var len = k.length
				var out = '{'
				if(n.comments){
					out += this.comments_flush( n.comments )
					if( !len ) out += old_depth
				}
				for( var i = 0; i < len; i++ ){
					var ch = out[ out.length -1 ]
					if( i ) out += ','
					if( ch == '\n' ) out += this.depth
					else if( ch == '}' ) out +=  this.newline + this.depth
					out += (k[i].key.name || k[i].key.raw) + ':' + this.expand( k[i].value )
				}
				var ch = out[ out.length - 1 ]
				if( ch == '\n') out += old_depth +'}'
				else{
					if( ch == '}' ) out += this.newline + old_depth + '}'
					else out += ' }'
				}
				this.depth = old_depth
				this.array_fix--
				this.comments = old_cmt
				this.cignore = 1
				return out
			},
			Index: function( n ){
				return this.expand( n.object, null, -1 ) + '[' + this.expand( n.index ) + ']'
			},
			Key: function( n ){
				return this.expand( n.object, null, -1 ) + '.' + this.expand( n.key )
			},

			Block: function( n ){
				var ret = '{' + this.comments_or_newline( n ) + this.block( n.steps ) + this.depth + '}'
				this.cignore =1 
				return ret
			},
			Expr: function( n, flag ){ 
				return this.expand( n.expr, null, flag )
			},
			List: function( n, flag ){
				if( flag>0 ) return this.list( n.items )
				return '('+this.list( n.items ) +')'
			},

			Break: function( n ){ 
				return 'break'+(n.label?' '+this.expand( n.label ):'')
			},
			Continue: function( n ){
				return 'continue'+(n.label?' '+this.expand( n.label ):'')
			},
			Label: function( n ){
				return this.expand( n.label )+':'+this.expand( n.body )
			},

			If: function( n ) {
				var out = 'if('
				out += this.expand( n.test )
				if( out[out.length - 1] == '\n') out += this.depth + this.indent
				out += ')' + this.space + this.expand( n.then, null, true )
				if(n.else){
					var ch = out[out.length - 1]
					if( ch !== '\n' ) out += this.newline
					out += this.depth + 'else ' + this.expand( n.else, null, true )
				}
				return out
			},
			Switch: function( n ){
				var old_cmt = this.comments
				this.comments = 0 // dont allow comments in the switch on
				var out = 'switch('+this.expand( n.on )+'){'
				this.comments = old_cmt
				out += this.comments_or_newline( n.on )
				var old = this.depth
				this.depth += this.indent				
				var cases = n.cases
				if(cases) for( var i = 0; i < cases.length; i++ ) out += this.depth + this.expand( cases[ i ] )
				this.depth = old
				out += this.depth + '}'
				return out
			},
			Case: function( n ){
				if( !n.test) return 'default:'+( n.then.length ? this.newline+this.block( n.then ) : this.newline )
				var out = 'case '
				var old_cmt = this.comments
				this.comments = 0
				out += this.expand( n.test ) + ':' 
				this.comments = old_cmt
				out += this.comments_or_newline(n.test)
				if (n.then.length) out += this.block( n.then )
				return out
			},

			Throw: function( n ){
				return 'throw ' + this.expand( n.arg )
			},
			Try: function( n ){
				return 'try' + this.expand( n.try ) +
						(n.catch?'catch('+this.expand( n.arg )+')'+this.expand( n.catch ):'')+
						(n.finally?'finally'+this.expand( n.finally ):'')
			},

			While: function( n ){
				return 'while(' + this.expand( n.test ) + ')' + 
					this.expand( n.loop )
			},
			DoWhile: function( n ){
				return 'do' + this.expand( n.loop ) + 
					'while(' + this.expand( n.test ) + ')'
			},
			For: function( n ){
				return 'for(' + this.expand( n.init )+';'+
						this.expand( n.test ) + ';' +
						this.expand( n.update ) + ')' + 
						this.expand( n.loop )
			},
			ForIn: function( n ){
				return 'for(' + this.expand( n.left ) + ' in ' +
					this.expand( n.right ) + ')' + 
					this.expand( n.loop )
			},
			ForOf: function( n ){
				return 'for(' + this.expand( n.left ) + ' of ' +
					this.expand( n.right ) + ')' + 
					this.expand( n.loop )
			},
			ForTo: function( n ){
				return 'for(' + this.expand( n.left ) + ' to ' +
					this.expand( n.right ) + 
					(n.in?' in ' + this.expand( n.in ):'') + ')' + 
					this.expand( n.loop )
			},

			Var: function( n ){
				return 'var ' + this.flat( n.defs )
			},
			Const: function( n ){
				return 'const ' + this.flat( n.defs )
			},
			TypeVar: function( n ){
				return this.expand(n.kind) + 
					( n.dim !== undefined ? '[' + 
						( n.dim ? this.expand(n.dim):'') + 
						']': '') + ' ' + 
					this.flat( n.defs )
			},
			Def: function( n ){
				return this.expand( n.id ) + 
					( n.dim !== undefined ? '[' + 
						(n.dim?this.expand(n.dim):'') + 
						']':'') +
					(n.init ? this.space + '=' + this.space + this.expand(n.init) : '')
			},
			Struct: function( n ){
				return 'struct ' + this.expand( n.id ) + 
					(n.struct ? this.expand( n.struct): ' '+this.list( n. defs ) )
			},

			Function: function( n, flag ){
				if(n.arrow){
					var arrow = n.arrow
					// if an arrow has just one Id as arg leave off ( )
					if( !n.rest && n.params && n.params.length == 1 && !n.params[0].init && n.params[0].id.type == 'Id' ){
						return this.expand( n.params[0].id ) + arrow + this.expand( n.body )
					}
					var ret = '(' +(n.params?this.list( n.params ):'') + (n.rest ? ',' + this.space + this.expand( n.rest ) : '' )+ ')' +
						arrow + this.expand( n.body )
					this.cignore = 1
					return ret
				}
				var ret = 'function'+(n.id?' '+this.expand( n.id ):'') +
							'('+this.list( n.params )+(n.rest ? ',' + this.expand(n.rest) : '' ) + ')' +
							this.expand( n.body )
				this.cignore = 1
				if( flag < 0) return '(' +ret + ')'
				return ret
			},
			Return: function( n ){
				return 'return' + (n.arg ? ' ' + this.expand( n.arg ):'')
			},

			Unary: function( n ){
				if( n.prefix )return n.op + this.space + this.expand( n.arg )
				return this.expand ( n.arg ) + n.op
			},
			Binary: function( n, flag ){
				var ret
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left ) + ')' + this.space + n.op + this.space + this.expand( n.right )
				} 
				else {
					ret = this.expand( n.left, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right )
				}
				if( flag < 0 ) return '(' + ret + ')'
				return ret
			},
			Logic: function( n, flag ){
				var ret
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left ) + ')' + this.space + n.op + this.space + this.expand( n.right )
				} 
				else {
					ret = this.expand( n.left, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right )
				}
				if( flag < 0 ) return '(' + ret + ')'
				return ret
			},
			Assign: function( n, flag ){
				var ret
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left ) + ')' + this.space + n.op + this.space + this.expand( n.right )
				} 
				else {
					ret = this.expand( n.left, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right )
				}
				if( flag < 0 ) return '(' + ret + ')'
				return ret

			},
			Update: function( n, flag ){
				var ret 
				if( n.prefix ) ret = n.op + this.expand( n.arg )
				else ret = this.expand ( n.arg ) + n.op
				if( flag < 0 ) return '(' + ret + ')'
				return ret
			},
			Condition: function( n ){
				return this.expand( n.test )+ this.space +'?'+ this.space +this.expand( n.then )+ this.space +':'+ this.space +this.expand( n.else )
			},

			New: function( n ){
				return 'new ' + this.expand( n.fn, null, -1 ) + '(' + this.list( n.args ) + ')'
			},
			Call: function( n ){
				return this.expand( n.fn, null, -1 ) + '(' + this.list( n.args ) + ')'
			},

			Quote: function( n, flag ){
				var ret = ':' + this.expand( n.quote )
				if( flag < 0) return '(' +ret + ')'
				return ret
			},
			Rest: function( n ){
				var out = ''
				for(var i = 0;i< n.dots;i++) out += '.'
				out += this.expand( n.id )
				return out
			},
			Path: function( n ){
				var out = ''
				for(var i = 0;i< n.dots;i++) out += '.'
				out += n.op + this.expand( n.id )
				return out
			},
			Extends: function( n ){
				return this.expand( n.id ) + ' extends '+this.expand( n.extend )
			},
			Do: function( n ){
				return this.expand( n.call ) + ' do ' + this.expand( n.arg )
			},
			Callback: function( n ){
				return this.expand( n.call ) + this.expand( n.body )
			},
			Debugger: function( n ){
				return 'debugger'
			},
			With: function( n ){
				return 'with(' + this.expand( n.object ) + ')' + this.expand( n.body )
			}
		}

		this.code_escaped = this.extends( this.code_serialize,{
			newline:' \\n\\\n',
			indent:'\t',
			Unary: function( n ){
				if( n.prefix ){
					if(n.op == '%' && this.templates){
						if(n.arg.type != 'Id') throw new Error("Unknown template & variable type")
						this.templates[n.arg.name] = 1
					}
					return n.op + this.expand( n.arg )
				}
				return this.expand ( n.arg ) + n.op
			},			
			Value: function( n ){
				if(n.kind == 'string' || n.kind == 'regexp'){
					// escape ' and "
					return n.raw.replace(/"/g,'\\"').replace(/'/g,"\\'")
				}
				return n.raw
			}
		})

		this.js_serialize = this.extends( this.code_serialize, {
			
			newline:'\n',
			semi:';',
			scope:{},
			signals:[],
			globals:{
				Object:1,
				Array:1, 
				String:1, 
				Date:1, 
				Boolean:1,
				Error:1,
				Math:1,
				RegExp:1,
				Float32Array:1,
				Float64Array:1,
				Int16Array:1,
				Int32Array:1,
				Int8Array:1,
				Uint16Array:1,
				Uint32Array:1,
				Uint8Array:1,
				Uint8ClampedArray:1,
				ParallelArray:1,
				Map:1,
				Set:1,
				WeakMap:1,
				WeakSet:1,
				ArrayBuffer:1,
				DataView:1,
				JSON:1,
				Iterator:1,
				Generator:1,
				Promise:1,
				Intl:1,
				arguments:1,
				isNaN:1,
				isFinite:1,
				parseFloat:1,
				parseInt:1,
				decodeURI:1,
				decodeURIComponent:1,
				encodeURI:1,
				encodeURIComponent:1,
				escape:1,
				unescape:1
			},

			Id: function( n ){
				var flag = n.flag
				if( flag ){
					if( flag == 126 ){
						if(n.name in this.scope) throw new Error('Signal '+n.name+' defined but also in scope')
						this.signals.push( n.name )
					} else 
					if(flag === 33) throw new Error("! postfix not implemented")
					if(flag === 64) throw new Error("@ Unresolved template vars in AST")
					if(flag === 35) return 'this.color("'+n.name+'")'
				}
				if( n.name in this.scope ) return n.name
				if( n.name in this.globals ) return n.name
				return 'this.'+n.name
			},

			Index: function( n ){
				return this.expand( n.object, null, -1 ) + '[' + this.expand( n.index ) + ']'
			},
			Key: function( n ){
				if( n.key.type !== 'Id' ) throw new Error('Unknown key type')
				var key = n.key
				var comments = key.comments
				var cmt = ''
				if( comments ) cmt = this.comments_flush( comments )
				return this.expand( n.object, null, -1 ) + '.' + n.key.name + cmt
			},

			ForTo: function( n ){
				throw new Error("implement ForTo")
			},

			TypeVar: function( n ){
				throw new Error("implement TypeVar")
			},

			Def: function( n ){
				if( n.id.type !== 'Id' ) throw new Error('Unknown id type')
				if( n.dim !== undefined ) throw new Error('Dont know what to do with dimensions')

				this.scope[ n.id.name ] = 1

				return this.expand( n.id ) + 
					(n.init ? this.space+'='+this.space + this.expand(n.init) : '')
			},

			Struct: function( n ){
				throw new Error("implement Struct")
			},

			Function: function( n, flag, nametag ){
				if( n.id ) this.scope[ n.id.name ] = 1
				// make a new scope
				var scope = this.scope
				this.scope = Object.create( scope )
				var signals = this.signals
				this.signals = []

				var olddepth = this.depth
				this.depth += this.indent
				
				var str_body = ''
				var str_param = ''

				// and we have rest
				var params = n.params
				var plen = params ? params.length : 0
				// do rest parameters
				if( n.rest ){
					if( n.rest.id.type !== 'Id' ) throw new Error('Unknown id type')
					if(plen)
						str_body += this.depth + 'var '+n.rest.id.name+' = arguments.length>' + plen + '?' + 
						'Array.prototype.slice.call(arguments,' + plen + '):[]' + this.newline
					else
						str_body += this.depth + 'var '+n.rest.id.name+' = Array.prototype.slice.call(arguments,0)' + this.newline
				}
				// do init
				if( plen ){
					var split = ','+this.space
					for(var i = 0;i<plen;i++){
						var param = params[i]
						var name = param.id.name
						this.scope[ name ] = 1
						str_param += this.expand( param.id, i == plen - 1?'':split )//name
						if( str_param[str_param.length - 1] == '\n' ) str_param += this.depth
						if(param.init){
							str_body += this.depth + 'if('+name+'===undefined)' +name+'='+this.expand( param.init ) + this.newline 
						}
					}
				}

				// expand the function
				if( n.body.type == 'Block' ){
					var steps = n.body.steps
					str_body += this.block( n.body.steps, 1 )
					//for( var i = 0; i < steps.length; i++ ){
					//	str_body += this.depth + this.expand( steps[ i ] ) + this.semi + this.newline
					//}
				} else str_body += this.depth + 'return ' + this.expand( n.body ) + this.semi + this.newline

				var sig = this.signals
				var str_sig = sig.length?this.depth + "this.signals('"+sig.join("','")+"')" + this.semi + this.newline : ''

				this.depth = olddepth
				this.scope = scope
				this.signals = signals

				var ret = 'function'+(nametag?' '+nametag:(n.id?' '+this.expand( n.id ):'')) +
							'(' + str_param + '){'  + this.comments_or_newline(n.body) + str_sig + str_body + this.depth + '}' +
							(n.arrow=='=>'?'.bind(this)':'')
				this.cignore = 1
				if( flag < 0 ) return '('+ret+')'
				return ret
			},

			Assign: function( n, flag ){
				if(n.left.type == 'Array' || n.left.type == 'Object'){
					throw new Error("Destructuring not implemented")
				}
				var ret 
				if(n.left.type == 'Id' || n.left.type == 'Key' || n.left.type == 'Index'){
					ret = this.expand( n.left, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right )
				} else {
					ret = 'this['+this.expand( n.left )+']' + this.space + n.op + this.space + this.expand( n.right )
				}
				if( flag < 0) return '('+ret+')'
				return ret
			},

			Call: function( n, flag, extra ){
				// auto this forward with local scope functions
				if(n.fn.type != 'Path' && n.fn.type != 'Key' && (n.fn.type != 'Id' || n.fn.name in this.scope)){
					return this.expand( n.fn, null, -1 ) + '.call(this' + (n.args.length?','+this.space+this.list( n.args ):'') + 
							(extra?','+this.space+extra+')':')')
				} // auto this inject with new
				else if(n.fn.type == 'Key' && n.fn.key.type == 'Id' && n.fn.key.name == 'new'){
					return this.expand( n.fn, null, -1 ) + '(this' + (n.args.length?','+this.list( n.args ):'') + 
						(extra?','+this.space+extra+')':')')
				}
				return this.expand( n.fn, null, -1 ) + '(' + this.list( n.args ) + 
					(extra?(n.args.length?','+this.space:'')+extra+')':')')
			},

			Quote: function( n ){
				// we need to check for @ vars and pass them into parse.
				var esc = this._.code_escaped
				var tpl = esc.templates = {}
				// now we need to set the template object
				esc.depth = this.depth
				esc.comments = 0
				var body = esc.expand( n.quote )
				// cache the AST for parse()
				parserCache[body] = n.quote

				var obj = ''
				for( var name in tpl ){
					if(obj) obj += ','
					obj += name+':'+(name in this.scope?name:'this.'+name)
				}
				return 'this.parse("' + body + '"'+(obj?',{' + obj + '})':')')
			},
			Rest: function( n ){
				throw new Error("dont know what to do with isolated rest object")
			},
			Path: function( n ){
				if( n.id.type !== 'Id' ) throw new Error('Unknown id type')
				// check op. if we have / we use ._.
				// if we have | we use parent
				var join = ''
				if( n.op == '/') join = '_'
				else if( n.op == '<') join = 'parent'
				else throw new Error("Unknown path operand")

				var dots = n.dots - 1
				var out = 'this.'
				for(var i = 0; i < dots; i++ ) out += join + '.'
				return out + n.id.name
			},
			Extends: function( n ){
				// n.extend should be callback
				var ext = n.extend
				if(ext.type != 'Callback') throw new Error("Dont know what to do with extend")
				if(n.id.type != 'Id') throw new Error("Extend cant define left part")
				if(ext.call.type != 'Id') throw new Error("Extend cant use right part")

				return 'this.extends(\'' + n.id.name + '\',' +this.space + this.expand( ext.call )+','+ this.space +
					this.Function( ext )+')'
			},
			Do: function( n ){
				var call = n.call
				if( call.type != 'Call' ) throw new Error("Cant do on non function call")
				return this.expand( call.fn ) + '(' + (call.args.length?this.list( call.args ) + ',':'') + 
					this.expand( n.arg ) + ')'
			},
			Callback: function( n ){
				var call = n.call
				if( call.type == 'Id'){
					if(call.flag == 64 && !call.name){
						return 'this.$.Track.new(this,' + this.Function( n ) +')'
					}
					return this.expand( call ) + this.space + '=' + this.space + this.Function( n )
				} else 
				if( call.type != 'Call' ) throw new Error("Cant append callback to non call")
				
				return this.Call( call, false, this.Function( n ) )
			}
		})

		// TODO update this
		this.signal_serialize = this.extends( this.code_serialize, {
			deps:0,
			Call:function( n ){
				if( n.fn.type !== 'Id') throw new Error("Dont know how to do non Id call")
				return 'this.' + n.fn.name + '(' + this.list( n.args ) + ')'
			},
			Id:function( n ){
				// direct ID's
				this.deps.push( 'this', n.name )
				return 'this.__' + n.name
			},
			Key:function( n ){
				// reading properties
				var obj = 'this.'+this._.code_serialize.expand( n.object )
				var key = this._.code_serialize.expand( n.key )
				// base + key pairs
				this.deps.push( obj, key )
				return obj+'.__'+key
			},
			Index:function(n){
				throw new Error("Signals dont do index")
			}
		})

		var exprCache = {}
		function this_signal_compile( source ){

			var cache = exprCache[ this.source ]
			if( cache ) return cache

			//if( this.type == 'Program' || this.type == 'List') throw new Error("Signals only support expressions")
			// use signal_tracer serializer
			var deps = this.signal_serialize.deps = []
			var code = this.signal_serialize.expand( this )

			var init = 'var _this = this\n'
			for( var i = 0, l = deps.length; i < l; i+=2 ){
				var base = deps[i]
				var prop = deps[i+1]
				init +=
					'tgt = ' + base + '\n'+
					'if( !tgt.__lookupSetter__("' + prop +'") ) tgt.signal("' + prop + '")\n'+
					'listen.push(tgt, "'+prop+'", tgt.' + prop + '=function(val){\n'+
					'   _this[exprKey].sig_expr.call(_this, 0, valKey, key)\n'+
					'})\n'
			}

			// make dependency exceptions useful
			var ex = ''
			for( var i = 0, l = deps.length; i < l; i+=2 ){
				var base = deps[i]
				var prop = deps[i+1]
				ex += (ex?'+':'') + '(' + base+'.__'+prop + '===undefined?"' + prop + ' is undefined ":"")'
			}
			
			// the actual calculate value function
			var calc =
				'var v = ' + code + '\n' +
				'if( v!== undefined && !Array.isArray(v) && isNaN(v)) throw new Error( " Dependency error in "+valKey+" ' + (ex?' :"+'+ex:'"')+')\n'+
				'if( this[valKey] != v ){\n' +
				'   var set = this.__lookupSetter__(key)\n'+
				'   if(set) set.call( this, v, true )\n'+ // call setter
				'   else this[valKey] = v\n' + 
				'   if(cyc++>20) throw new Error("Cyclic dependency error in "+valKey)\n'+
				'}'

			// create the compute calculation function
			var expr = exprCache[ source ] = new Function( 'cyc','valKey','key', calc )
			expr.init = new Function( 'listen','exprKey','valKey','key', init )
			expr.deps = deps
			return expr
		}

		this.toDump = function(n, tab){
			if(! n ) var log = true
			n  = n || this
			tab = tab || '-';
			var wr = Array.isArray(n) ? '[ ]' : '' ;
			var out = (n.type?n.type+'('+n.start+' - '+n.end+')'+wr:'')

			var keys = Object.keys(n)
			for( var i = 0;i < keys.length; i++){
				var k = keys[i]
				if(k == '_parent' || k == 'tokens' || k == 'start' || k == 'end' 
					|| k == 'loc' || k == 'type' || k == 'pthis' || k=='source') continue;
				var v = n[k]
				if(typeof v !== 'function'){
					if(typeof v == 'object'){
						if(v !== null && Object.keys(v).length > 0)
							out += '\n' + tab + k+':' + this.toDump(v, tab + '-')
					} else {
						if(v !== false) out += '\n' + tab + k+':' + v
					}
				}
			}
			return out
		}

	})

	// generate all AST subclasses
	for( var k in this.AST.structure){

	}

	this.clamp = function(v, min, max){
		return v < min ? min : ( v > max ? max : v )
	}

	this.E = Math.E
	this.LN2 = Math.LN2
	this.LN10 = Math.LN10
	this.LOG2E = Math.LOG2E
	this.LOG10E = Math.LOG10E
	this.PI = Math.PI
	this.SQRT1_2 = Math.SQRT1_2
	this.SQRT2 = Math.SQRT2
	
	this.abs   = function(v){ return Array.isArray(v)?v.map( Math.abs ):Math.abs(v) }
	this.acos  = function(v){ return Array.isArray(v)?v.map( Math.acos ):Math.acos(v) }
	this.asin  = function(v){ return Array.isArray(v)?v.map( Math.asin ):Math.asin(v) }
	this.atan  = function(v){ return Array.isArray(v)?v.map( Math.atan ):Math.atan(v) }
	this.sin   = function(v){ return Array.isArray(v)?v.map( Math.sin ):Math.sin(v) }
	this.cos   = function(v){ return Array.isArray(v)?v.map( Math.cos ):Math.cos(v) }
	this.tan   = function(v){ return Array.isArray(v)?v.map( Math.tan ):Math.tran(v) }
	this.sqrt  = function(v){ return Array.isArray(v)?v.map( Math.sqrt ):Math.sqrt(v) }
	this.ceil  = function(v){ return Array.isArray(v)?v.map( Math.ceil ):Math.ceil(v) }
	this.floor = function(v){ return Array.isArray(v)?v.map( Math.floor ):Math.floor(v) }

	this.atan2 = function(v){ return Array.isArray(v)?v.map( Math.atan2 ):Math.atan2(v) }
	this.exp   = function(v){ return Array.isArray(v)?v.map( Math.exp ):Math.exp(v) }
	this.imul  = function(v){ return Array.isArray(v)?v.map( Math.imul ):Math.imul(v) }
	this.log   = function(v){ return Array.isArray(v)?v.map( Math.log ):Math.log(v) }
	this.max   = function(v){ return Array.isArray(v)?v.map( Math.max ):Math.max(v) }
	this.min   = function(v){ return Array.isArray(v)?v.map( Math.min ):Math.min(v) }
	this.pow   = function(v){ return Array.isArray(v)?v.map( Math.pow ):Math.pow(v) }
	this.random= function(v){ return Array.isArray(v)?v.map( Math.random ):Math.random(v) }
	this.round = function(v){ return Array.isArray(v)?v.map( Math.round ):Math.round(v) }

	// compressed version of CSS color name lookup table
	var ci = [130,15792383,388,16444375,5,65535,6,8388564,7,15794175,8,16119260,9,16770244,10,0,1420,16772045,2,255,269,
		9055202,14,10824234,1936,14596231,2178,6266528,18,8388352,19,13789470,20,16744272,2690,6591981,22,16775388,23,14423100,
		24,65535,3202,139,3224,35723,412955,12092939,3228,11119017,3229,25600,3230,11119017,3231,12433259,3232,9109643,413853,
		5597999,3234,10040012,3235,9109504,3236,15308410,414365,9419919,414466,4734347,414492,3100495,414494,3100495,3239,52945,
		3213,9699539,40,16747520,5290,16716947,677250,49151,5660,6908265,5662,6908265,5762,2003199,5935,11674146,6148,16775920,
		6301,2263842,50,16711935,51,14474460,6660,16316671,53,16766720,3355,14329120,28,8421504,29,32768,3766,11403055,30,
		8421504,7096,15794160,7338,16738740,7459,13458524,59,4915330,60,16777200,31,15787660,61,15132410,7870,16773365,8093,
		8190976,8257,16775885,8450,11393254,8468,15761536,8472,14745599,138841526,16448210,8476,13882323,8477,9498256,8478,
		13882323,8490,16758465,8484,16752762,1086109,2142890,1086850,8900346,1086236,7833753,1086238,7833753,1089922,11584734,
		8502,16777184,68,65280,8733,3329330,69,16445670,32,16711935,70,8388608,1163976,6737322,9090,205,9122,12211667,9161,
		9662680,1168029,3978097,1168130,8087790,1172765,64154,9127,4772300,1164963,13047173,9602,1644912,9805,16121850,10063,
		16770273,80,16770229,10372,16768685,82,128,10708,16643558,33,8421376,4309,7048739,86,16753920,11043,16729344,34,14315734,
		1428763,15657130,11165,10025880,11175,11529966,1427107,14184595,11353,16773077,11611,16767673,92,13468991,42,16761035,93,
		14524637,12034,11591910,73,8388736,35,16711680,12174,12357519,12290,4286945,12430,9127187,36,16416882,12558,16032864,
		4765,3050327,4835,16774638,100,10506797,101,12632256,5506,8900331,4866,6970061,4892,7372944,4894,7372944,102,16775930,
		9501,65407,8578,4620980,103,13808780,104,32896,105,14204888,106,16737095,39,4251856,13,15631086,107,16113331,4,16777215,
		620,16119285,54,16776960,6941,10145074]
	// word index
	var wd = ['','Alice','Blue','Antique','White','Aqua','Aquamarine','Azure','Beige','Bisque','Black','Blanched','Almond','Violet',
		'Brown','Burly','Wood','Cadet','Chartreuse','Chocolate','Coral','Cornflower','Cornsilk','Crimson','Cyan','Dark','Golden',
		'Rod','Gray','Green','Grey','Khaki','Magenta','Olive','Orchid','Red','Salmon','Sea','Slate','Turquoise','Darkorange',
		'Deep','Pink','Sky','Dim','Dodger','Fire','Brick','Floral','Forest','Fuchsia','Gainsboro','Ghost','Gold','Yellow',
		'Honey','Dew','Hot','Indian','Indigo','Ivory','Lavender','Blush','Lawn','Lemon','Chiffon','Light','Steel','Lime',
		'Linen','Maroon','Medium','Marine','Purple','Spring','Midnight','Mint','Cream','Misty','Rose','Moccasin','Navajo',
		'Navy','Old','Lace','Drab','Orange','Pale','Papaya','Whip','Peach','Puff','Peru','Plum','Powder','Rosy','Royal',
		'Saddle','Sandy','Shell','Sienna','Silver','Snow','Tan','Teal','Thistle','Tomato','Wheat','Smoke']

	// decompress colortable
	var colors = {}
	for(var i = 0;i < ci.length;i += 2){
		var s = ''    // output string
		var p = ci[i] // fetch the 8 bytes per lookup word combiner 
		while( p ) s = wd[ p & 0x7f ] + s, p = p >> 7 // rebuild the strange word
		var c = ci[i + 1]
		var sl = s.toLowerCase()
		colors[sl] = colors[s] = [(c>>16)/255,((c>>8)&0xff)/255, (c&0xff)/255]
	}

	// color to array decoder
	this.color = function( col ) {
		if( typeof col == 'string' ) {
			var c = colors[ col ] // color LUT
			if( c ) return c
			var c = parseInt(col, 16)
			if(col.length == 4) return [ ((c&0xf00)>>8|(c&0xf00)>>4) /255, ((c&0xf0)|(c&0xf0)>>4) /255, ((c&0xf)|(c&0xf)<<4) /255 ]
			else return [ ((c >> 16)&0xff) /255, ((c >> 8)&0xff) /255, (c&0xff) /255 ]
		}
		if( typeof col == 'object' && Array.isArray( col ) && (col.length == 3 || col.length == 4) && typeof col[0] == 'number' ) return col
	}   

	return this

}

//  ONEJS parser
// 
//  Parts Copyright (C) Marijn Haverbeke
//  Parts Copyright (C) 2014 ONEJS
//
//  MIT license
//
// This parser is a modified version of Acorn
// It parses a loose superset of JavaScript
// with added ES6/7, Julia, Coffeescript, CSS, XML and GLSL feel.
// It targets JS, Asm.js and GLSL as output languages
// It aims to be backwards compatible with valid JS, atleast for the parser
//
// The Parser AST has been designed to be human friendly,
// and with the quote operator makes ASTs a first class citizen of the language
// check one_ast.js for structural definition of the AST
// 
// This is JavaScript, plus:
//
// Callback subscript block 'x(){code}' and 'x{code}'
// AST Quote operator 'var x = :y = 10' quotes entire expression rhs, priority below = 
// Arrow function '->x', 'x->x', '()->x', '(x)->x' and all ->{}
// Typed var 'float x' 'float x[10]' 'struct x{float y}'
//
// Paren free if form 'if x then y'
// Commas are optional when you have newlines '[1\n2] {x:1\x:2}'
// Logic words 'if x and y', 'if x or y', 'if x is y', 'if x isnt y' 'if not x'
// Booleans 'yes == true' 'on == true' 'no == false' 'off == false'
// Class extends 'x extends y{}'
// Default arguments for functions '(x=10)->x'
// ES6 Fat arrow '=>' with no this.empty arg () required
// Rest prefix '...name' '(x, ...y) -> {}''
// Path prefix '...(operator)name' 'var x = .../y'
// For To 'for(x = 0 to 10 in 3){}'
// Casting/Type annotation expressions 'x = float' 'x = float(10)'
// @, # prefix flags and ! and ~ postfix flags on identifiers
// Automatic// insertion in '2word' -> '2*word' for units or math
// 
// Code generation features depend on the target language
//
// TODO items for the parser:
// Destructuring assignment of arrays and objects
// Splats '[1 2 3]^^'
// Ranges '[0..1]' '[0...3]'
// Multiline strings ' no interpolation
// Multiline strings "{}" w interpolation 
// Interpolated markdown """markdown{code}"""
// Interpolated XML <div>{code}</div>
// Array slicing x[0..2] x[3..-2]
// Conditional assignments '||=''
// Existential object traverse  'x.?y.?z
// Generators/yield "yield x" "function//" "(x)*->"
// Array comprehensions as in ES6
// Let as in ES6
// Allow if/else/try/catch in expressions 
// for each syntax
// const
// Add a step to for to
// Pow '**'
// Integer modulus '%%'
// Obvious string multiply 'x'// 10
// 
// Acorn was written by Marijn Haverbeke and released under an MIT
// license. The Unicode regexps (for identifiers and whitespace) were
// taken from [Esprima](http:*esprima.org) by Ariya Hidayat.
//
// Git repositories for Acorn are available at
//
//     http:*marijnhaverbeke.nl/git/acorn
//     https:*github.com/marijnh/acorn.git
//
// A second optional argument can be given to further configure
// the parser process. These options are recognized:

ONE.parser_strict_ = function(){

	this.input = ''
	this.inputLen = 0

	// `ecmaVersion` indicates the ECMAScript version to parse. Must
	// be either 3 or 5. This
	// influences support for this.strict mode, the set of reserved words, and
	// support for getters and setter.
	this.ecmaVersion = 5
	// Turn on `strictSemicolons` to prevent the parser from doing
	// automatic this.semicolon insertion.
	this.strictSemicolons = false
	// When `allowTrailingCommas` is false, the parser will not allow
	// trailing commas in array and object literals.
	this.allowTrailingCommas = true
	// By default, reserved words are not enforced. Enable
	// `forbidReserved` to enforce them. When this option has the
	// value "everywhere", reserved words and keywords can also not be
	// used as property names.
	this.forbidReserved = false
	// Parses { } in top level scope as JS objects, not blocks.
	// Fixes use for throwing in plain JSON without switching
	// to expression mode
	this.objectInTopLevel = true
	// When enabled, commas are injected where possible
	this.injectCommas = true
	// When enabled, a return at the top level is not considered an
	// error.
	this.allowReturnOutsideFunction = true
	// stores comments on the AST as best as we can
	this.storeComments = true
	
	this.sourceFile = ''

	// The current position of the tokenizer in the this.input.
	this.tokPos = 0

	// The start and end offsets of the current token.

	this.tokStart = 0
	this.tokEnd = 0

	// The type and value of the current token. Token types are objects,
	// named by variables against which they can be compared, and
	// holding properties that describe them (indicating, for example,
	// the precedence of an infix operator, and the original name of a
	// keyword token). The kind of value that's held in `this.tokVal` depends
	// on the type of the token. For literals, it is the literal value,
	// for operators, the operator name, and so on.

	this.tokType
	this.tokVal

	// Interal state for the tokenizer. To distinguish between division
	// operators and regular expressions, it remembers whether the last
	// token was one that is allowed to be followed by an expression.
	// (If it is, a slash is probably a regexp, if it isn't it's a
	// division operator. See the `this.parseStatement` function for a
	// caveat.)

	this.tokRegexpAllowed

	// These store the position of the previous token, which is useful
	// when finishing a node and assigning its `end` position.
	this.lastTok
	this.lastStart
	this.lastEnd

	// used by comma insertion and subscripts
	this.skippedNewlines
	this.lastSkippedNewlines

	// This is the parser's state. `this.inFunction` is used to reject
	// `return` statements outside of functions, `this.labels` to verify that
	// `break` and `continue` have somewhere to jump to, and `this.strict`
	// indicates whether this.strict mode is on.

	this.inFunction
	this.labels
	this.strict

	// This function is used to this.raise exceptions on parse errors. It
	// takes an offset integer (into the current `this.input`) to indicate
	// the location of the error, attaches the position to the end
	// of the error message, and then raises a `SyntaxError` with that
	// message.
	this.lastComments = []
	this.lastNodes = []

	this.parse_strict = function(inpt) {
		this.input = String(inpt)
		this.inputLen = this.input.length
		this.initTokenState()
		return this.parseTopLevel()
	}

	// The `this.getLineInfo` function is mostly useful when the
	// `locations` option is off (for performance reasons) and you
	// want to find the line/column position for a given character
	// offset. `this.input` should be the code string that the offset refers
	// into.

	this.getLineInfo = function( input, offset ) {
		for (var line = 1, cur = 0;;) {
			this.lineBreak.lastIndex = cur
			var match = this.lineBreak.exec(this.input)
			if (match && match.index < offset) {
				++line
				cur = match.index + match[0].length
			} else break
		}
		return {line: line, column: offset - cur}
	}

	this.raise = function(pos, message) {
		var loc = this.getLineInfo(this.input, pos)
		message += " in " + this.sourceFile + " line " + loc.line + " column " + loc.column 
		var err = new SyntaxError(message)
		err.pos = pos; err.loc = loc; err.raisedAt = this.tokPos

		console.log(message, this.input.split("\n")[loc.line-1])

		throw err
	}

	// Reused this.empty array added for node fields that are always this.empty.

	this.empty = []

	// ## Token types

	// The assignment of fine-grained, information-carrying type objects
	// allows the tokenizer to store the information it has about a
	// token in a way that is very cheap for the parser to look up.

	// All token type variables start with an underscore, to make them
	// easy to recognize.

	// These are the general types. 

	this._num = {type: "num"}
	this._regexp = {type: "regexp"}
	this._string = {type: "string"}
	this._name = {type: "name"}
	this._eof = {type: "eof"}

	// Keyword tokens. The `keyword` property (also used in keyword-like
	// operators) indicates that the token originated from an
	// identifier-like word, which is used when parsing property names.
	//
	// The `beforeExpr` property is used to disambiguate between regular
	// expressions and divisions. It is set on all token types that can
	// be followed by an expression (thus, a slash after them would be a
	// regular expression).
	//
	// `isLoop` marks a keyword as starting a loop, which is important
	// to know when parsing a label, in order to allow or disallow
	// continue jumps to that label.

	this._break = {keyword: "break"}
	this._case = {keyword: "case", beforeExpr: true}
	this._catch = {keyword: "catch"}
	this._continue = {keyword: "continue"}
	this._debugger = {keyword: "debugger"}
	this._default = {keyword: "default"}
	this._do = {keyword: "do", isLoop: true}
	this._else = {keyword: "else", beforeExpr: true}
	this._finally = {keyword: "finally"}
	this._for = {keyword: "for", isLoop: true}
	this._function = {keyword: "function"}
	this._if = {keyword: "if"}
	this._return = {keyword: "return", beforeExpr: true}
	this._switch = {keyword: "switch"}
	this._throw = {keyword: "throw", beforeExpr: true}
	this._try = {keyword: "try"}
	this._var = {keyword: "var"}
	this._while = {keyword: "while", isLoop: true}
	this._with = {keyword: "with"}
	this._new = {keyword: "new", beforeExpr: true}
	this._this = {keyword: "this"}

	// glsl keywords
	this._float = {keyword: "float", isType:1}
	this._double = {keyword: "double", isType:1}
	this._bool = {keyword:"bool", isType:1}
	this._int = {keyword:"int", isType:1}
	this._uint = {keyword:"uint"}

	this._bvec2 = {keyword:"bvec2", isType:1}
	this._bvec3 = {keyword:"bvec3", isType:1}
	this._bvec4 = {keyword:"bvec4", isType:1}
	this._ivec2 = {keyword:"ivec2", isType:1}
	this._ivec3 = {keyword:"ivec3", isType:1}
	this._ivec4 = {keyword:"ivec4", isType:1}
	this._uvec2 = {keyword:"uvec2", isType:1}
	this._uvec3 = {keyword:"uvec3", isType:1}
	this._uvec4 = {keyword:"uvec4", isType:1}
	this._dvec2 = {keyword:"dvec2", isType:1}
	this._dvec3 = {keyword:"dvec3", isType:1}
	this._dvec4 = {keyword:"dvec4", isType:1}
	this._vec2 = {keyword:"vec2", isType:1}
	this._vec3 = {keyword:"vec3", isType:1}
	this._vec4 = {keyword:"vec4", isType:1}
	this._mat2x2 = {keyword:"mat2x2", isType:1}
	this._mat2x3 = {keyword:"mat2x3", isType:1}
	this._mat2x4 = {keyword:"mat2x4", isType:1}
	this._mat3x2 = {keyword:"mat3x2", isType:1}
	this._mat3x3 = {keyword:"mat3x3", isType:1}
	this._mat3x4 = {keyword:"mat3x4", isType:1}
	this._mat4x2 = {keyword:"mat4x2", isType:1}
	this._mat4x3 = {keyword:"mat4x3", isType:1}
	this._mat4x4 = {keyword:"mat4x4", isType:1}
	this._mat2 = {keyword:"mat2", isType:1}
	this._mat3 = {keyword:"mat3", isType:1}
	this._mat4 = {keyword:"mat4", isType:1}

	// struct
	this._struct = {keyword:"struct", isType:1}

	// class extends 
	this._extends = {keyword:"extends"}

	// The keywords that denote values.
	this._null = {keyword: "null", isValue:1, atomValue: null}
	this._true = {keyword: "true", isValue:1, atomValue: true}
	this._false = {keyword: "false", isValue:1, atomValue: false}
	this._yes = {keyword:"yes", isValue:1, atomValue: true}
	this._no = {keyword:"no", isValue:1, atomValue: false}
	this._on = {keyword:"on", isValue:1, atomValue: true}
	this._off = {keyword:"off", isValue:1, atomValue: false}

	// Some keywords are treated as regular operators. `in` sometimes
	// (when parsing `for`) needs to be tested against specifically, so
	// we assign a variable name to it for quick comparing.

	this._in = {keyword: "in", binop: 7, beforeExpr: true}
	this._to = {keyword: "to", binop: 7, beforeExpr: true}
	this._of = {keyword: "of", binop: 7, beforeExpr: true}

	this._instanceof = {keyword: "instanceof", binop: 7, beforeExpr: true}, 
	this._typeof = {keyword: "typeof", prefix: true, beforeExpr: true}
	this._void = {keyword: "void", prefix: true, beforeExpr: true}
	this._delete = {keyword: "delete", prefix: true, beforeExpr: true}

	// Punctuation token types.
	this._bracketL = {type: "[", beforeExpr: true}
	this._bracketR = {type: "]"}
	this._braceL = {type: "{", beforeExpr: true}
	this._braceR = {type: "}"}
	this._parenL = {type: "(", beforeExpr: true}
	this._parenR = {type: ")"}
	this._comma = {type: ",", beforeExpr: true}
	this._semi = {type: ";", beforeExpr: true}
	this._colon = {type: ":", prefix: 1, beforeExpr: true}
	this._dot = {type: "."}
	this._question = {type: "?", beforeExpr: true}
	this._thinArrow = {type:"->"}
	this._fatArrow = {type:"=>"}
	
	// Operators. These carry several kinds of properties to help the
	// parser use them properly (the presence of these properties is
	// what categorizes them as operators).
	//
	// `binop`, when present, specifies that this operator is a binary
	// operator, and will refer to its precedence.
	//
	// `prefix` and `postfix` mark the operator as a prefix or postfix
	// unary operator. `isUpdate` specifies that the node produced by
	// the operator should be of type UpdateExpression rather than
	// simply UnaryExpression (`++` and `--`).
	//
	// `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
	// binary operators with a very low precedence, that should result
	// in AssignmentExpression nodes.

	this._slash = {binop: 10, beforeExpr: true}
	this._eq = {isAssign: true, beforeExpr: true}
	this._assign = {isAssign: true, binop:0, beforeExpr: true}
	this._incDec = {postfix: true, prefix: true, isUpdate: true}
	this._prefix = {prefix: true, beforeExpr: true}
	this._logicalOR = {binop: 1, beforeExpr: true}
	this._logicalAND = {binop: 2, beforeExpr: true}
	this._bitwiseOR = {binop: 3, beforeExpr: true}
	this._bitwiseXOR = {binop: 4, beforeExpr: true}
	this._bitwiseAND = {binop: 5, prefix:true, beforeExpr: true}
	this._equality = {binop: 6, beforeExpr: true}
	this._relational = {binop: 7, beforeExpr: true}
	this._bitShift = {binop: 8, beforeExpr: true}
	this._plusMin = {binop: 9, prefix: true, beforeExpr: true}
	this._multiplyModulo = {binop: 10, prefix:true, beforeExpr: true}

	this._is = {keyword: "is", replace:'===', replaceOp:this._equality, binop: 6, beforeExpr: true}
	this._isnt = {keyword: "isnt", replace:'!==', replaceOp:this._equality,  binop: 6, beforeExpr: true}
	this._or = {keyword: "or", replace:'||', replaceOp:this._logicalOR, binop: 1, beforeExpr: true}
	this._and = {keyword: "and", replace:'&&', replaceOp:this._logicalAND, binop: 2, beforeExpr: true}
	this._not = {keyword: "not", replace:'!', prefix: 1, beforeExpr: true}

	// This is a trick taken from Esprima. It turns out that, on
	// non-Chrome browsers, to check whether a string is in a set, a
	// predicate containing a big ugly `switch` statement is faster than
	// a regular expression, and on Chrome the two are about on par.
	// This function uses `eval` (non-lexical) to produce such a
	// predicate from a space-separated string of words.
	//
	// It starts by sorting the words by length.

	this.makePredicate = function(words) {
		words = words.split(" ")
		var f = "", cats = []
		out: for (var i = 0; i < words.length; ++i) {
			for (var j = 0; j < cats.length; ++j)
				if (cats[j][0].length == words[i].length) {
					cats[j].push(words[i])
					continue out
				}
			cats.push([words[i]])
		}
		this.compareTo = function(arr) {
			if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";"
			f += "switch(str){"
			for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":"
			f += "return true}return false;"
		}

		// When there are more than three length categories, an outer
		// switch first dispatches on the lengths, to save on comparisons.

		if (cats.length > 3) {
			cats.sort(function(a, b) {return b.length - a.length;})
			f += "switch(str.length){"
			for (var i = 0; i < cats.length; ++i) {
				var cat = cats[i]
				f += "case " + cat[0].length + ":"
				this.compareTo(cat)
			}
			f += "}"

		// Otherwise, simply generate a flat `switch` statement.

		} else {
			this.compareTo(words)
		}
		return new Function("str", f)
	}

	this._isReservedWord3 = "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile"
	this._isReservedWord5 = "class enum extends super const export import"
	this._isStrictReservedWord = "implements interface let package private protected public static yield"
	this._isStrictBadIdWord = "eval arguments"

	this.initKeywords = function(){
		var isKeyword = ''
		this.keywordTypes = {}
		var tokTypes = {}
		for( k in this ){
			var v = this[ k ]
			if(k[0] == '_' && (v.binop || v.type || v.keyword)){ // its a token
				tokTypes[ k.slice(1) ] = v
				if(v.keyword){
					this.keywordTypes[ v.keyword ] = v
					isKeyword += (isKeyword.length?' ':'') + v.keyword
				}
			}
		}
		this.isKeyword = this.makePredicate(isKeyword)
		this.isReservedWord3 = this.makePredicate(this._isReservedWord3)
		this.isReservedWord5 = this.makePredicate(this._isReservedWord5)
		this.isStrictReservedWord = this.makePredicate(this._isStrictReservedWord)
		this.isStrictBadIdWord = this.makePredicate(this._isStrictBadIdWord)
	}

	// If you externally modify things, call this again
	this.initKeywords()

	// ## Character categories

	// Big ugly regular expressions that match characters in the
	// whitespace, identifier, and identifier-start categories. These
	// are only applied when a character is found to actually have a
	// code point above 128.

	this.nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/
	this.nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc"
	this.nonASCIIidentifierChars = "\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u0620-\u0649\u0672-\u06d3\u06e7-\u06e8\u06fb-\u06fc\u0730-\u074a\u0800-\u0814\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0840-\u0857\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09d7\u09df-\u09e0\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5f-\u0b60\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2-\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d46-\u0d48\u0d57\u0d62-\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e34-\u0e3a\u0e40-\u0e45\u0e50-\u0e59\u0eb4-\u0eb9\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f41-\u0f47\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1029\u1040-\u1049\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u170e-\u1710\u1720-\u1730\u1740-\u1750\u1772\u1773\u1780-\u17b2\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1920-\u192b\u1930-\u193b\u1951-\u196d\u19b0-\u19c0\u19c8-\u19c9\u19d0-\u19d9\u1a00-\u1a15\u1a20-\u1a53\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b46-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1bb0-\u1bb9\u1be6-\u1bf3\u1c00-\u1c22\u1c40-\u1c49\u1c5b-\u1c7d\u1cd0-\u1cd2\u1d00-\u1dbe\u1e01-\u1f15\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2d81-\u2d96\u2de0-\u2dff\u3021-\u3028\u3099\u309a\ua640-\ua66d\ua674-\ua67d\ua69f\ua6f0-\ua6f1\ua7f8-\ua800\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8f3-\ua8f7\ua900-\ua909\ua926-\ua92d\ua930-\ua945\ua980-\ua983\ua9b3-\ua9c0\uaa00-\uaa27\uaa40-\uaa41\uaa4c-\uaa4d\uaa50-\uaa59\uaa7b\uaae0-\uaae9\uaaf2-\uaaf3\uabc0-\uabe1\uabec\uabed\uabf0-\uabf9\ufb20-\ufb28\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f"
	this.nonASCIIidentifierStart = new RegExp("[" + this.nonASCIIidentifierStartChars + "]")
	this.nonASCIIidentifier = new RegExp("[" + this.nonASCIIidentifierStartChars + this.nonASCIIidentifierChars + "]")

	// Whether a single character denotes a this.newline.

	this.newline = /[\n\r\u2028\u2029]/

	// Matches a whole line break (where CRLF is considered a single
	// line break). Used to count lines.

	this.lineBreak = /\r\n|[\n\r\u2028\u2029]/g

	// Test whether a given character code starts an identifier.

	this.isIdentifierStart = function(code) {
		if (code < 65) return code === 36 || code === 35 || code === 64
		if (code < 91) return true
		if (code < 97) return code === 95
		if (code < 123)return true
		return code >= 0xaa && this.nonASCIIidentifierStart.test(String.fromCharCode(code))
	}

	// Test whether a given character is part of an identifier.

	this.isIdentifierChar = function(code) {
		if (code < 48) return code === 36 || code === 35
		if (code < 58) return true
		if (code < 65) return code === 64
		if (code < 91) return true
		if (code < 97) return code === 95
		if (code < 123)return true

		return code >= 0xaa && this.nonASCIIidentifier.test(String.fromCharCode(code))
	}

	// ## Tokenizer

	// Reset the token state. Used at the start of a parse.

	this.initTokenState = function() {
		this.lastTok = undefined
		this.skippedNewlines = false
		this.lastSkippedNewlines = false
		this.lastComments.length = 0 
		this.lastNodes.length = 0
		this.tokPos = 0
		this.tokRegexpAllowed = true
		this.skipSpace()
	}

	// Called at the end of every token. Sets `this.tokEnd`, `this.tokVal`, and
	// `this.tokRegexpAllowed`, and skips the space after the token, so that
	// the next one's `this.tokStart` will point at the right position.

	this.finishToken = function(type, val) {
		this.tokEnd = this.tokPos
		this.tokType = type
		this.skipSpace()
		this.tokVal = val
		this.tokRegexpAllowed = type.beforeExpr
	}
	
	this.skipBlockComment = function() {
		var start = this.tokPos, end = this.input.indexOf("*/", this.tokPos += 2)
		if (end === -1) this.raise(this.tokPos - 2, "Unterminated comment")
		if( this.input.indexOf("\n", this.tokPos ) < end ) this.skippedNewlines = 1
		this.tokPos = end + 2
		
		if(this.storeComments){
			var block = this.input.slice(start + 2, end).split("\n")
			for( var i = 0;i<block.length;i++){
				this.lastComments.push( start, block[ i ] )
				if(i < block.length - 1) this.lastComments.push( start, -1 )
			}
			this.lastComments.push( start, -1)
		}
	}

	this.skipLineComment = function() {
		var start = this.tokPos
		var ch = this.input.charCodeAt(this.tokPos+=2)
		while (this.tokPos < this.inputLen && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
			++this.tokPos
			ch = this.input.charCodeAt(this.tokPos)
		}
		// store the comment
		if(this.storeComments){
			var strip = start + 2
			var ch = this.input.charCodeAt(strip)
			while(strip < this.tokPos && ( ch > 8 && ch < 14 || ch == 32)){
				 ch = this.input.charCodeAt(++strip)
			}
			var cmt = this.input.slice(strip, this.tokPos)
			this.lastComments.push( start, cmt )
		}
	}

	// Called at the start of the parse and after every token. Skips
	// whitespace and comments, and.

	this.skipSpace = function() {
		this.lastSkippedNewlines = this.skippedNewlines
		this.skippedNewlines = 0
		while (this.tokPos < this.inputLen) {
			var ch = this.input.charCodeAt(this.tokPos)
			if (ch === 32) { // ' '
				++this.tokPos
			} else if (ch === 13) {
				++this.tokPos
				var next = this.input.charCodeAt(this.tokPos)
				if (next === 10) {
					++this.tokPos
				}
				this.skippedNewlines++
				if(this.storeComments) this.lastComments.push(this.tokPos-2, -1)
			} else if (ch === 10 || ch === 8232 || ch === 8233) {
				++this.tokPos
				this.skippedNewlines++
				if(this.storeComments) this.lastComments.push(this.tokPos-1, -1)
			} else if (ch > 8 && ch < 14) {
				++this.tokPos
			} else if (ch === 47) { // '/'
				var next = this.input.charCodeAt(this.tokPos + 1)
				if (next === 42) { // '*'
					this.skipBlockComment()
				} else if (next === 47) { // '/'
					this.skipLineComment()
				} else break
			} else if (ch === 160) { // '\xa0'
				++this.tokPos
			} else if (ch >= 5760 && this.nonASCIIwhitespace.test(String.fromCharCode(ch))) {
				++this.tokPos
			} else {
				break
			}
		}
	}

	// ### Token reading

	// This is the function that is called to fetch the next token. It
	// is somewhat obscure, because it works in character codes rather
	// than characters, and because operator parsing has been inlined
	// into it.
	//
	// All in the name of speed.
	//
	// The `forceRegexp` parameter is used in the one case where the
	// `this.tokRegexpAllowed` trick does not work. See `this.parseStatement`.

	this.readToken_dot = function() {
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (next >= 48 && next <= 57) return this.readNumber(true)
		++this.tokPos
		return this.finishToken(this._dot)
	}

	this.readToken_slash = function() {// '/'
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (this.tokRegexpAllowed) {++this.tokPos; return this.readRegexp();}
		if (next === 61) return this.finishOp(this._assign, 2)
		return this.finishOp(this._slash, 1)
	}

	this.readToken_mult_modulo = function() { // '%*'
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (next === 61) return this.finishOp(this._assign, 2)
		return this.finishOp(this._multiplyModulo, 1)
	}

	this.readToken_pipe_amp = function(code) { // '|&'
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (next === code) return this.finishOp(code === 124 ? this._logicalOR : this._logicalAND, 2)
		if (next === 61) return this.finishOp(this._assign, 2)
		return this.finishOp(code === 124 ? this._bitwiseOR : this._bitwiseAND, 1)
	}

	this.readToken_caret = function() { // '^'
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (next === 61) return this.finishOp(this._assign, 2)
		return this.finishOp(this._bitwiseXOR, 1)
	}

	this.readToken_plus_min = function(code) { // '+-'
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (next === code) {
			if (next == 45 && this.input.charCodeAt(this.tokPos + 2) == 62 &&
					this.newline.test(this.input.slice(this.lastEnd, this.tokPos))) {
				// A `-->` line comment
				this.tokPos += 3
				this.skipLineComment()
				this.skipSpace()
				return this.readToken()
			}
			return this.finishOp(this._incDec, 2)
		}
		if (next === 61) return this.finishOp(this._assign, 2)
		return this.finishOp(this._plusMin, 1)
	}

	this.readToken_lt_gt = function(code) { // '<>'
		var next = this.input.charCodeAt(this.tokPos + 1)
		var size = 1
		if (next === code) {
			size = code === 62 && this.input.charCodeAt(this.tokPos + 2) === 62 ? 3 : 2
			if (this.input.charCodeAt(this.tokPos + size) === 61) return this.finishOp(this._assign, size + 1)
			return this.finishOp(this._bitShift, size)
		}
		if (next == 33 && code == 60 && this.input.charCodeAt(this.tokPos + 2) == 45 &&
				this.input.charCodeAt(this.tokPos + 3) == 45) {
			// `<!--`, an XML-style comment that should be interpreted as a line comment
			this.tokPos += 4
			this.skipLineComment()
			this.skipSpace()
			return this.readToken()
		}
		if (next === 61)
			size = this.input.charCodeAt(this.tokPos + 2) === 61 ? 3 : 2
		return this.finishOp(this._relational, size)
	}

	this.readToken_eq_excl = function(code) { // '=!'
		var next = this.input.charCodeAt(this.tokPos + 1)
		if (next === 61) return this.finishOp(this._equality, this.input.charCodeAt(this.tokPos + 2) === 61 ? 3 : 2)
		return this.finishOp(code === 61 ? this._eq : this._prefix, 1)
	}

	this.getTokenFromCode = function(code) {
		switch(code) {
			// The interpretation of a dot depends on whether it is followed
			// by a digit.
		case 46: // '.'
			return this.readToken_dot()

			// Punctuation tokens.
		case 40: ++this.tokPos; return this.finishToken(this._parenL)
		case 41: ++this.tokPos; return this.finishToken(this._parenR)
		case 59: ++this.tokPos; return this.finishToken(this._semi)
		case 44: ++this.tokPos; return this.finishToken(this._comma)
		case 91: ++this.tokPos; return this.finishToken(this._bracketL)
		case 93: ++this.tokPos; return this.finishToken(this._bracketR)
		case 123: ++this.tokPos; return this.finishToken(this._braceL)
		case 125: ++this.tokPos; return this.finishToken(this._braceR)
		case 58: ++this.tokPos; return this.finishToken(this._colon)
		case 63: ++this.tokPos; return this.finishToken(this._question)

			// '0x' is a hexadecimal number.
		case 48: // '0'
			var next = this.input.charCodeAt(this.tokPos + 1)
			if (next === 120 || next === 88) return this.readHexNumber()
			// Anything else beginning with a digit is an integer, octal
			// number, or float.
		case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
			return this.readNumber(false)

			// Quotes produce strings.
		case 34: case 39: // '"', "'"
			return this.readString(code)

		// Operators are parsed inline in tiny state machines. '=' (61) is
		// often referred to. `this.finishOp` simply skips the amount of
		// characters it is given as second argument, and returns a token
		// of the type given by its first argument.

		case 47: // '/'
			return this.readToken_slash(code)

		case 37: case 42: // '%*'
			return this.readToken_mult_modulo()

		case 124: case 38: // '|&'
			return this.readToken_pipe_amp(code)

		case 94: // '^'
			return this.readToken_caret()

		case 43: 
			return this.readToken_plus_min(code)
		case 45: // '+-'
			var next = this.input.charCodeAt(this.tokPos + 1)
			if( next == 62 ){
				this.tokPos += 2
				return this.finishToken(this._thinArrow, '->')
			}
			return this.readToken_plus_min(code)

		case 60: case 62: // '<>'
			return this.readToken_lt_gt(code)

		case 61: 
			var next = this.input.charCodeAt(this.tokPos + 1)
			if(next == 62){
				this.tokPos += 2
				return this.finishToken(this._fatArrow, '=>')
			}
		
		case 33: // '=!'
			return this.readToken_eq_excl(code)

		case 126: // '~'
			return this.finishOp(this._prefix, 1)
		}

		return false
	}

	this.readToken = function(forceRegexp) {
		if (!forceRegexp) this.tokStart = this.tokPos
		else this.tokPos = this.tokStart + 1
		if (forceRegexp) return this.readRegexp()
		if (this.tokPos >= this.inputLen) return this.finishToken(this._eof)

		var code = this.input.charCodeAt(this.tokPos)
		// Identifier or keyword. '\uXXXX' sequences are allowed in
		// identifiers, so '\' also dispatches to that.
		if (this.isIdentifierStart(code) || code === 92 /* '\' */) return this.readWord()

		var tok = this.getTokenFromCode(code)

		if (tok === false) {
			// If we are here, we either found a non-ASCII identifier
			// character, or something that's entirely disallowed.
			var ch = String.fromCharCode(code)
			if (ch === "\\" || this.nonASCIIidentifierStart.test(ch)) return this.readWord()
			this.raise(this.tokPos, "Unexpected character '" + ch + "'")
		}
		return tok
	}

	this.finishOp = function(type, size) {
		var str = this.input.slice(this.tokPos, this.tokPos + size)
		this.tokPos += size
		this.finishToken(type, str)
	}

	// Parse a regular expression. Some context-awareness is necessary,
	// since a '/' inside a '[]' set does not end the expression.

	this.readRegexp = function() {
		var content = "", escaped, inClass, start = this.tokPos
		for (;;) {
			if (this.tokPos >= this.inputLen) this.raise(start, "Unterminated regular expression")
			var ch = this.input.charAt(this.tokPos)
			if (this.newline.test(ch)) this.raise(start, "Unterminated regular expression")
			if (!escaped) {
				if (ch === "[") inClass = true
				else if (ch === "]" && inClass) inClass = false
				else if (ch === "/" && !inClass) break
				escaped = ch === "\\"
			} else escaped = false
			++this.tokPos
		}
		var content = this.input.slice(start, this.tokPos)
		++this.tokPos
		// Need to use `this.readWord1` because '\uXXXX' sequences are allowed
		// here (don't ask).
		var mods = this.readWord1()
		if (mods && !/^[gmsiy]*$/.test(mods)) this.raise(start, "Invalid regular expression flag")
		try {
			var value = new RegExp(content, mods)
		} catch (e) {
			if (e instanceof SyntaxError) this.raise(start, "Error parsing regular expression: " + e.message)
			this.raise(e)
		}
		return this.finishToken(this._regexp, value)
	}

	// Read an integer in the given radix. Return null if zero digits
	// were read, the integer value otherwise. When `len` is given, this
	// will return `null` unless the integer has exactly `len` digits.

	this.readInt = function(radix, len) {
		var start = this.tokPos, total = 0
		for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
			var code = this.input.charCodeAt(this.tokPos), val
			if (code >= 97) val = code - 97 + 10; // a
			else if (code >= 65) val = code - 65 + 10; // A
			else if (code >= 48 && code <= 57) val = code - 48; // 0-9
			else val = Infinity
			if (val >= radix) break
			++this.tokPos
			total = total * radix + val
		}
		if (this.tokPos === start || len != null && this.tokPos - start !== len) return null

		return total
	}

	this.readHexNumber = function() {
		this.tokPos += 2; // 0x
		var val = this.readInt(16)
		if (val == null) this.raise(this.tokStart + 2, "Expected hexadecimal number")
		if (this.isIdentifierStart(this.input.charCodeAt(this.tokPos))) this.raise(this.tokPos, "Identifier directly after number")
		return this.finishToken(this._num, val)
	}

	// Read an integer, octal integer, or floating-point number.

	this.readNumber = function(startsWithDot) {
		var start = this.tokPos, isFloat = false, octal = this.input.charCodeAt(this.tokPos) === 48
		if (!startsWithDot && this.readInt(10) === null) this.raise(start, "Invalid number")
		if (this.input.charCodeAt(this.tokPos) === 46) {
			++this.tokPos
			this.readInt(10)
			isFloat = true
		}
		var next = this.input.charCodeAt(this.tokPos)
		if (next === 69 || next === 101) { // 'eE'
			next = this.input.charCodeAt(++this.tokPos)
			if (next === 43 || next === 45) ++this.tokPos; // '+-'
			if (this.readInt(10) === null) this.raise(start, "Invalid number")
			isFloat = true
		}

		if (this.isIdentifierStart(this.input.charCodeAt(this.tokPos))){
			this.injectMul = true
			return this.finishToken(this._num, val)
			// inject a *
		}

		var str = this.input.slice(start, this.tokPos), val
		if (isFloat) val = parseFloat(str)
		else if (!octal || str.length === 1) val = parseInt(str, 10)
		else if (/[89]/.test(str) || this.strict) this.raise(start, "Invalid number")
		else val = parseInt(str, 8)
		return this.finishToken(this._num, val)
	}
	// Read a string value, interpreting backslash-escapes.

	this.readString = function(quote) {
		this.tokPos++
		var out = ""
		for (;;) {
			if (this.tokPos >= this.inputLen) this.raise(this.tokStart, "Unterminated string constant")
			var ch = this.input.charCodeAt(this.tokPos)
			if (ch === quote) {
				++this.tokPos
				return this.finishToken(this._string, out)
			}
			if (ch === 92) { // '\'
				ch = this.input.charCodeAt(++this.tokPos)
				var octal = /^[0-7]+/.exec(this.input.slice(this.tokPos, this.tokPos + 3))
				if (octal) octal = octal[0]
				while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, -1)
				if (octal === "0") octal = null
				++this.tokPos
				if (octal) {
					if (this.strict) this.raise(this.tokPos - 2, "Octal literal in this.strict mode")
					out += String.fromCharCode(parseInt(octal, 8))
					this.tokPos += octal.length - 1
				} else {
					switch (ch) {
					case 110: out += "\n"; break; // 'n' -> '\n'
					case 114: out += "\r"; break; // 'r' -> '\r'
					case 120: out += String.fromCharCode(this.readHexChar(2)); break; // 'x'
					case 117: out += String.fromCharCode(this.readHexChar(4)); break; // 'u'
					case 85: out += String.fromCharCode(this.readHexChar(8)); break; // 'U'
					case 116: out += "\t"; break; // 't' -> '\t'
					case 98: out += "\b"; break; // 'b' -> '\b'
					case 118: out += "\u000b"; break; // 'v' -> '\u000b'
					case 102: out += "\f"; break; // 'f' -> '\f'
					case 48: out += "\0"; break; // 0 -> '\0'
					case 13: if (this.input.charCodeAt(this.tokPos) === 10) ++this.tokPos; // '\r\n'
					case 10: // ' \n'
						this.skippedNewlines = true
						break
					default: out += String.fromCharCode(ch); break
					}
				}
			} else {
				if (ch === 13 || ch === 10 || ch === 8232 || ch === 8233) this.raise(this.tokStart, "Unterminated string constant")
				out += String.fromCharCode(ch); // '\'
				++this.tokPos
			}
		}
	}

	// Used to read character escape sequences ('\x', '\u', '\U').

	this.readHexChar = function(len) {
		var n = this.readInt(16, len)
		if (n === null) this.raise(this.tokStart, "Bad character escape sequence")
		return n
	}

	// Used to signal to callers of `this.readWord1` whether the word
	// contained any escape sequences. This is needed because words with
	// escape sequences must not be interpreted as keywords.

	this.containsEsc

	// reads ~ and ! as a flag on a word 
	this.containsFlag

	// injects a * as the next token
	this.injectMul

	// Read an identifier, and return it as a string. Sets `this.containsEsc`
	// to whether the word contained a '\u' escape.
	//
	// Only builds up the word character-by-character when it actually
	// containeds an escape, as a micro-optimization.


	this.readWord1 = function() {
		this.containsEsc = false
		this.containsFlag = false
		var word, first = true, start = this.tokPos
		for (;;) {
			var ch = this.input.charCodeAt(this.tokPos)
			if (this.isIdentifierChar(ch)) {
				if ( ch == 35 || ch == 64){
					if( !first ) this.raise(this.tokPos, "# and @ cannot be used in the middle of a word")
					this.containsFlag = ch
					start++
				}
				if (this.containsEsc) word += this.input.charAt(this.tokPos)
				++this.tokPos
			} else if (ch === 92) { // "\"
				if (!this.containsEsc) word = this.input.slice(start, this.tokPos)
				this.containsEsc = true
				if (this.input.charCodeAt(++this.tokPos) != 117) // "u"
					this.raise(this.tokPos, "Expecting Unicode escape sequence \\uXXXX")
				++this.tokPos
				var esc = this.readHexChar(4)
				var escStr = String.fromCharCode(esc)
				if (!escStr) this.raise(this.tokPos - 1, "Invalid Unicode escape")
				if (!(first ? this.isIdentifierStart(esc) : this.isIdentifierChar(esc)))
					this.raise(this.tokPos - 4, "Invalid Unicode escape")
				word += escStr
			} else {
				break
			}
			first = false
		}
		var ret = this.containsEsc ? word : this.input.slice(start, this.tokPos)
		
		if(start != this.tokPos && (ch == 126 || ch == 33 ) ){ // add the flag
			if(this.containsFlag ) throw new Error("Cannot have # @ prefix and ! ~ postfix")
			this.containsFlag = ch
			++this.tokPos
		}

		return ret
	}

	// Read an identifier or keyword token. Will check for reserved
	// words when necessary.

	this.readWord = function() {
		var word = this.readWord1()
		var type = this._name
		if (!this.containsEsc && this.isKeyword(word))
			type = this.keywordTypes[word]
		return this.finishToken(type, word)
	}

	// ## Parser

	// A recursive descent parser operates by defining functions for all
	// syntactic elements, and recursively calling those, each function
	// advancing the this.input stream and returning an AST node. Precedence
	// of constructs (for example, the fact that `!x[1]` means `!(x[1])`
	// instead of `(!x)[1]` is handled by the fact that the parser
	// function that parses unary prefix operators is called first, and
	// in turn calls the function that parses `[]` subscripts — that
	// way, it'll receive the node for `x[1]` already parsed, and wraps
	// *that* in the unary operator node.
	//
	// Acorn uses an [operator precedence parser][opp] to handle binary
	// operator precedence, because it is much more compact than using
	// the technique outlined above, which uses different, nesting
	// functions to specify precedence, for all of the ten binary
	// precedence levels that JavaScript defines.
	//
	// [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

	// ### Parser utilities

	// Continue to the next token.

	this.next = function() {
		this.lastStart = this.tokStart
		this.lastEnd = this.tokEnd
		this.lastTok = this.tokType
		if(this.injectMul){
			this.finishToken(this._multiplyModulo, "*")
			this.injectMul = false
			return	
		}
		this.readToken()
	}

	// Enter this.strict mode. Re-reads the next token to please pedantic
	// tests ("use this.strict"; 010; -- should fail).

	this.setStrict = function(strct) {
		this.strict = strct
		this.tokPos = this.tokStart
		this.skipSpace()
		this.readToken()
	}

	// Start an AST node, attaching a start offset.
	this.Node = {}
	this.lastDeferred = []

	this.finishComments = function(){
		// we take a comment, then walk lastNodes 
		var comments = this.lastComments
		var nodes    = this.lastNodes
		var clen = comments.length
		var nlen = nodes.length
		if(!clen || !nlen) return
		var c = 0
		var n = 0
		while( c < clen ){
			// we have a comment we want a place for
			var cpos = comments[c]
			while( n < nlen && nodes[n].end <= cpos ) n++
			if( n == nlen ){ // apply all our comments on the last node
				n--
				var out = nodes[n].comments = []
				while( c < clen ){
					if(nodes[n].end <= comments[c]) out.push( comments[c+1])
					c+=2
				}	
				break
			} else {
				n--
				if(n < 0) n = 0
				var out = nodes[n].comments || (nodes[n].comments = [])
				out.push( comments[ c+1 ])
			}
			c += 2
		}
		this.lastComments.length = 0
		this.lastNodes.length = 0
	}

	this.startNode = function() {

		var node = Object.create(this.Node)
		node.type = null
		node.start = this.tokStart
		node.end = node.start
		// lets process lastNodes against lastComments
		if(this.storeComments && this.lastComments.length){
			this.lastNodes.push(node)
			this.finishComments()
		}

		return node
	}

	// Start a node whose start offset information should be based on
	// the start of another node. For example, a binary operator node is
	// only started after its left-hand side has already been parsed.

	this.startNodeFrom = function(other) {

		var node = Object.create(this.Node)
		node.type = null
		node.end = null
		node.start = other.start
		return node
	}

	// Finish an AST node, adding `type` and `end` properties.

	this.finishNode = function(node, type) {
		node.type = type
		node.end = this.lastEnd
		if(this.storeComments) this.lastNodes.push( node )
		return node
	}

	// Test whether a statement node is the string literal `"use this.strict"`.

	this.isUseStrict = function(stmt) {
		return this.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" &&
			stmt.expression.type === "Literal" && stmt.expression.value === "use this.strict"
	}

	// Predicate that tests whether the next token is of the given
	// type, and if yes, consumes it as a side effect.

	this.eat = function(type) {
		if (this.tokType === type) {
			this.next()
			return true
		}
	}

	// Test whether a this.semicolon can be inserted at the current position.

	this.canInsertSemicolon = function() {
		return !this.strictSemicolons &&
			(this.tokType === this._eof || this.tokType === this._braceR || this.newline.test(this.input.slice(this.lastEnd, this.tokStart)))
	}

	// Consume a this.semicolon, or, failing that, see if we are allowed to
	// pretend that there is a this.semicolon at this position.

	this.semicolon = function() {
		if (!this.eat(this._semi) && !this.canInsertSemicolon()) this.unexpected()
	}

	// Expect a token of a given type. If found, consume it, otherwise,
	// this.raise an this.unexpected token error.

	this.expect = function(type) {
		if (this.tokType === type) this.next()
		else this.unexpected()
	}

	// Raise an this.unexpected token error.

	this.unexpected = function() {
		this.raise(this.tokStart, "Unexpected token")
	}

	// Verify that a node is an lval — something that can be assigned
	// to.

	this.checkLVal = function(expr) {
		if( expr.type === "Array" ){ // destructuring assignment
			this.raise(expr.start, "TODO add destructuring assignment")
		}
		if (expr.type !== "Id" && expr.type !== "Key" && expr.type !== "Index")
			this.raise(expr.start, "Assigning to rvalue" + expr.type)

		if (this.strict && expr.type === "Ident" && this.isStrictBadIdWord(expr.name))
			this.raise(expr.start, "Assigning to " + expr.name + " in this.strict mode")
	}

	// ### Statement parsing

	// Parse a program. Initializes the parser, reads any number of
	// statements, and wraps them in a Program node.  Optionally takes a
	// `program` argument.  If present, the statements will be appended
	// to its body instead of creating a new node.

	this.parseTopLevel = function() {
		this.lastStart = this.lastEnd = this.tokPos
		this.inFunction = this.strict = null
		this.labels = []
		this.readToken()

		var node = this.startNode(), first = true
		node.steps = []
		while (this.tokType !== this._eof) {
			var stmt = this.parseStatement( this.objectInTopLevel )
			node.steps.push(stmt)
			if (first && this.isUseStrict(stmt)) this.setStrict(true)
			first = false
		}
		var ret = this.finishNode(node, "Program")
		this.finishComments()
		return ret
	}

	this.loopLabel = {kind: "loop"} 
	this.switchLabel = {kind: "switch"}

	// parse array dimensions
	this.parseDims = function( node, check ) {
		 if( this.eat(this._bracketL) ){
			if( check && check.dim !== undefined ) this.unexpected()
			if( this.tokType == this._num ){
				var num = this.startNode()
				num.value = this.tokVal
				num.raw = this.input.slice(this.tokStart, this.tokEnd)
				this.next()
				node.dim = this.finishNode(num, "Value")
			} 
			else node.dim = 0
			if( !this.eat(this._bracketR) ) this.unexpected()
		}
	}

	// parse function args or variable defines with inits
	this.parseDefs = function( noIn, node ) {
		var defs = []

		for (;;) {
			if(this.tokType == this._parenR) break
			if(this.tokType == this._dot) break
			var def = this.startNode()
			def.id = this.parseIdent()
			if (this.strict && this.isStrictBadIdWord(def.id.name))
				this.raise(def.id.start, "Binding " + def.id.name + " in this.strict mode")
			
			this.parseDims(def, node)

			def.init = this.eat(this._eq) ? this.parseExpression(true, noIn) : null
			defs.push(this.finishNode(def, "Def"))
			if (!this.canInjectComma(this.tokType) && !this.eat(this._comma)) break
		}
		return defs
	}

	this.parseTypeVar = function( noIn, noSemi ) {

		var kind = this.tokType
		var kind_node = this.startNode()
		kind_node.name = kind.keyword
		var node = this.startNode()
		var type = 'TypeVar'
		this.next()
		node.kind = this.finishNode(kind_node, 'Type')

		// if we are a struct, we can this.eat a struct identifier or a {
		if( kind === this._struct ){
			if( this.tokType !== this._name ) this.unexpected()
			node.id = this.parseIdent()
			if( this.tokType === this._braceL ){
				node.struct = this.parseBlock()
				return this.finishNode(node, "Struct")
			}
			type = "Struct"
		}

		this.parseDims(node)
	 
		node.defs = this.parseDefs( noIn, node )

		if(!noSemi) this.semicolon()
		return this.finishNode(node, type)
	}

	// Parse a single statement.
	//
	// If expecting a statement and finding a slash operator, parse a
	// regular expression literal. This is to handle cases like
	// `if (foo) /blah/.exec(foo);`, where looking at the previous token
	// does not help.

	this.parseStatement = function( blockIsObject ) {
		if (this.tokType === this._slash || this.tokType === this._assign && this.tokVal == "/=")
			this.readToken(true)

		if( this.tokType.isType ) return this.parseTypeVar()

		var starttype = this.tokType, node = this.startNode()

		this.currentStatement = node

		// Most types of statements are recognized by the keyword they
		// start with. Many are trivial to parse, some require a bit of
		// complexity.

		switch (starttype) {
		case this._break: case this._continue:
			this.next()
			var isBreak = starttype === this._break
			if (this.eat(this._semi) || this.canInsertSemicolon()) node.label = null
			else if (this.tokType !== this._name) this.unexpected()
			else {
				node.label = this.parseIdent()
				this.semicolon()
			}

			// Verify that there is an actual destination to break or
			// continue to.
			for (var i = 0; i < this.labels.length; ++i) {
				var lab = this.labels[i]
				if (node.label == null || lab.name === node.label.name) {
					if (lab.kind != null && (isBreak || lab.kind === "loop")) break
					if (node.label && isBreak) break
				}
			}
			if (i === this.labels.length) this.raise(node.start, "Unsyntactic " + starttype.keyword)
			return this.finishNode(node, isBreak ? "Break" : "Continue")

		case this._debugger:
			this.next()
			this.semicolon()
			return this.finishNode(node, "Debugger")

		case this._do:
			this.next()
			this.labels.push(this.loopLabel)
			node.loop = this.parseStatement()
			this.labels.pop()
			this.expect(this._while)
			node.test = this.parseParenExpression()
			this.semicolon()
			return this.finishNode(node, "DoWhile")

			// Disambiguating between a `for` and a `for`/`in` loop is
			// non-trivial. Basically, we have to parse the init `var`
			// statement or expression, disallowing the `in` operator (see
			// the second parameter to `this.parseExpression`), and then check
			// whether the next token is `in`. When there is no init part
			// (this.semicolon immediately after the opening parenthesis), it is
			// a regular `for` loop.

		case this._for:
			this.next()
			this.labels.push(this.loopLabel)
			this.expect(this._parenL)
			if (this.tokType === this._semi) return this.parseFor(node, null)
			if (this.tokType === this._var || this.tokType.isType) {
				if( this.tokType.isType ){
					var init = this.parseTypeVar(true,true)
				} else {
					var init = this.startNode()
					this.next()
					this.parseVar(init, true)
					this.finishNode(init, "Var")
				}
				if( init.defs.length === 1 ){
					if (this.eat(this._in)) return this.parseForIn(node, init)
					if (this.eat(this._to)) return this.parseForTo(node, init)
					if (this.eat(this._of)) return this.parseForOf(node, init)
				}

				return this.parseFor(node, init)
			}
			var init = this.parseExpression(false, true)
			if (this.eat(this._in)) return this.parseForIn(node, init)
			if (this.eat(this._to)) return this.parseForTo(node, init)
			if (this.eat(this._of)) return this.parseForOf(node, init)

			return this.parseFor(node, init)

		case this._function:
			this.next()
			return this.parseFunction(node, true)

		case this._if:
			this.next()
			// if we dont have a paren, we switch to if .. then
			if( this.tokType !== this._parenL ){
				node.test = this.parseExpression(true)
				if( this.tokVal != 'then' ) this.unexpected()
				this.next()
			} else {
				node.test = this.parseParenExpression()
			}
			node.then = this.parseStatement()
			node.else = this.eat(this._else) ? this.parseStatement() : null
			return this.finishNode(node, "If")

		case this._return:
			if (!this.inFunction && !this.allowReturnOutsideFunction)
				this.raise(this.tokStart, "'return' outside of function")
			this.next()

			// In `return` (and `break`/`continue`), the keywords with
			// optional arguments, we eagerly look for a this.semicolon or the
			// possibility to insert one.

			if (this.eat(this._semi) || this.canInsertSemicolon()) node.arg = null
			else { node.arg = this.parseExpression(); this.semicolon(); }
			return this.finishNode(node, "Return")

		case this._switch:
			this.next()
			node.on = this.parseParenExpression()
			node.cases = []
			this.expect(this._braceL)
			this.labels.push(this.switchLabel)
			// Statements under must be grouped (by label) in SwitchCase
			// nodes. `cur` is used to keep the node that we are currently
			// adding statements to.

			for (var cur, sawDefault; this.tokType != this._braceR;) {
				if (this.tokType === this._case || this.tokType === this._default) {
					var isCase = this.tokType === this._case
					if (cur) this.finishNode(cur, "Case")
					node.cases.push(cur = this.startNode())
					cur.then = []
					this.next()
					if (isCase) cur.test = this.parseExpression(false, false, true)
					else {
						if (sawDefault) this.raise(this.lastStart, "Multiple default clauses"); sawDefault = true
						cur.test = null
					}
					this.expect(this._colon)
				} else {
					if (!cur) this.unexpected()
					cur.then.push(this.parseStatement())
				}
			}

			if (cur) this.finishNode(cur, "Case")
			this.next(); // Closing brace
			this.labels.pop()
			return this.finishNode(node, "Switch")

		case this._throw:
			this.next()
			if (this.newline.test(this.input.slice(this.lastEnd, this.tokStart)))
				this.raise(this.lastEnd, "Illegal this.newline after throw")
			node.arg = this.parseExpression()
			this.semicolon()
			return this.finishNode(node, "Throw")

		case this._try:
			this.next()
			node.try = this.parseBlock()
			if (this.tokType === this._catch) {
				this.next()
				this.expect(this._parenL)
				node.arg = this.parseIdent()
				if (this.strict && this.isStrictBadIdWord(clause.arg.name))
					this.raise(clause.param.start, "Binding " + clause.param.name + " in this.strict mode")
				this.expect(this._parenR)
				node.catch = this.parseBlock()
			}
			node.finally = this.eat(this._finally) ? this.parseBlock() : null
			if (!node.catch && !node.finally)
				this.raise(node.start, "Missing catch or finally clause")
			return this.finishNode(node, "Try")

		case this._var:
			this.next()
			this.parseVar(node)
			this.semicolon()
			return this.finishNode(node, "Var")

		case this._while:
			this.next()
			node.test = this.parseParenExpression()
			this.labels.push(this.loopLabel)
			node.loop = this.parseStatement()
			this.labels.pop()
			return this.finishNode(node, "While")

		case this._with:
			if (this.strict) this.raise(this.tokStart, "'with' in this.strict mode")
			this.next()
			node.object = this.parseParenExpression()
			node.body = this.parseStatement()
			return this.finishNode(node, "With")

		case this._braceL:
			if(blockIsObject) return this.parseObj()
			return this.parseBlock()
		case this._semi:
			this.next()
			return this.finishNode(node, "Empty")

			// If the statement does not start with a statement keyword or a
			// brace, it's an ExpressionStatement or LabeledStatement. We
			// simply start parsing an expression, and afterwards, if the
			// next token is a colon and the expression was a simple
			// Identifier node, we switch to interpreting it as a label.

		default:
			var maybeName = this.tokVal, expr = this.parseExpression()
			if (starttype === this._name && expr.type === "Id" && this.eat(this._colon)) {
				for (var i = 0; i < this.labels.length; ++i)
					if (this.labels[i].name === maybeName) this.raise(expr.start, "Label '" + maybeName + "' is already declared")
				var kind = this.tokType.isLoop ? "loop" : this.tokType === this._switch ? "switch" : null
				this.labels.push({name: maybeName, kind: kind})
				node.body = this.parseStatement()
				this.labels.pop()
				node.label = expr
				return this.finishNode(node, "Label")
			} else {
				if(this.tokType == this._extends){
					this.next()
					node.id = expr
					node.extend = this.parseExpression()
					this.semicolon()
					return this.finishNode(node, "Extends")
				} else {
					node.expr = expr
					if(this.tokType != this._else) this.semicolon()

					return this.finishNode(node, "Expr")
				}
			}
		}
	}

	// Used for constructs like `switch` and `if` that insist on
	// parentheses around their expression.
	this.parseParenExpression = function() {
		this.expect(this._parenL)
		var val = this.parseExpression()
		this.expect(this._parenR)
		return val
	}

	// Parse a this.semicolon-enclosed block of statements, handling `"use
	// this.strict"` declarations when `allowStrict` is true (used for
	// function bodies).

	this.parseBlock = function(allowStrict) {
		var node = this.startNode(), first = true, strict = false, oldStrict
		node.steps = []
		this.expect(this._braceL)
		while (!this.eat(this._braceR)) {
			var stmt = this.parseStatement()
			node.steps.push(stmt)
			if (first && allowStrict && this.isUseStrict(stmt)) {
				oldStrict = strict
				this.setStrict(strict = true)
			}
			first = false
		}
		if (this.strict && !oldStrict) this.setStrict(false)

		return this.finishNode(node, "Block", true)
	}

	// Parse a regular `for` loop. The disambiguation code in
	// `this.parseStatement` will already have parsed the init statement or
	// expression.

	this.parseFor = function(node, init) {
		node.init = init
		this.expect(this._semi)
		node.test = this.tokType === this._semi ? null : this.parseExpression()
		this.expect(this._semi)
		node.update = this.tokType === this._parenR ? null : this.parseExpression()
		this.expect(this._parenR)
		node.loop = this.parseStatement()
		this.labels.pop()
		return this.finishNode(node, "For")
	}

	// Parse a `for`/`in` loop.

	this.parseForIn = function(node, init) {
		node.left = init
		node.right = this.parseExpression()
		this.expect(this._parenR)
		node.loop = this.parseStatement()
		this.labels.pop()
		return this.finishNode(node, "ForIn")
	}

	// Parse a `for`/`to` loop.

	this.parseForTo = function(node, init) {
		node.left = init
		node.right = this.parseExpression(true, true)
		if( this.eat(this._in) ){
			node.in = this.parseExpression(true, true)
		}
		this.expect(this._parenR)
		node.loop = this.parseStatement()
		this.labels.pop()
		return this.finishNode(node, "ForTo")
	}

	// Parse a `for`/`of` loop.

	this.parseForOf = function(node, init) {
		node.left = init
		node.right = this.parseExpression()
		this.expect(this._parenR)
		node.loop = this.parseStatement()
		this.labels.pop()
		return this.finishNode(node, "ForOf")
	}

	// Parse a list of variable declarations.
	this.parseVar = function(node, noIn) {
		node.kind = "var"
		node.defs = this.parseDefs( noIn )
		return node
	}
	
	// Determines if a comma injection is safe

	this.canInjectComma = function( type, ignoreNewLine ) {
		if(this.lastSkippedNewlines && !ignoreNewLine || !this.injectCommas) return false
		// if we are a this._name but our previous token was a prefixable one,
		// throw an error
		return  this.lastSkippedNewlines && (
			type === this._name || 
			type === this._braceL ||
			type === this._bracketL ||
			type === this._parenL || 
			type === this._num || 
			type === this._string ||
			type === this._regexp || 
			type === this._dot ||
			type.isValue ||
			type.isType ||
			type.prefix)
	}

	// ### Expression parsing

	// These nest, from the most general expression type at the top to
	// 'atomic', nondivisible expression types at the bottom. Most of
	// the functions will simply let the function(s) below them parse,
	// and, *if* the syntactic construct they handle is present, wrap
	// the AST node that the inner parser gave them in another node.

	// Parse a full expression. The arguments are used to forbid comma
	// sequences (in argument lists, array literals, or object literals)
	// or the `in` operator (in for loops initalization expressions).

	this.parseExpression = function(noComma, noIn, termColon) {
		var expr = this.parseMaybeQuote(noIn, termColon)

		if ( (this.tokType !== this._colon || !termColon) && !noComma && (this.tokType === this._comma || this.canInjectComma(this.tokType) ) ) {

			var node = this.startNodeFrom(expr)
			node.items = [expr]

			while( (this.tokType !== this._colon || !termColon) && (this.canInjectComma(this.tokType) || this.eat(this._comma))) {
				if( this.tokType === this._else ) break
				node.items.push(this.parseMaybeQuote(noIn, termColon))
			}
			//while (this.eat(this._comma)) node.expressions.push(this.parseMaybeAssign(noIn))
			return this.finishNode(node, "List")
		}
		return expr
	}

	// parse quoting of expressions

	this.parseMaybeQuote = function(noIn) {
		if(this.tokType == this._colon ){
			var node = this.startNode()
			this.next()
			if( this.tokType.binop ){
				var sub = this.startNode()
				sub.op = this.tokType.replace || this.tokVal
				sub.prio = this.tokType.binop
				node.quote = this.finishNode(sub, "Binary")
				return this.finishNode(node, "Quote")
				this.next()
			} else {
				node.quote = this.parseMaybeAssign(noIn)
				return this.finishNode(node, "Quote")
			}
		}
		return this.parseMaybeAssign(noIn)
	}

	// Parse an assignment expression. This includes applications of
	// operators like `+=`.

	this.parseMaybeAssign = function(noIn) {
		var left = this.parseMaybeConditional(noIn)
		if (this.tokType.isAssign) {
			var node = this.startNodeFrom(left)
			node.op = this.tokVal
			node.left = left
			this.next()
			node.right = this.parseMaybeQuote(noIn)
			if(node.op != '=') this.checkLVal(left)
			return this.finishNode(node, "Assign")
		}
		return left
	}

	// Parse a ternary conditional (`?:`) operator.

	this.parseMaybeConditional = function(noIn) {
		var expr = this.parseExprOps(noIn)
		if (this.eat(this._question)) {
			var node = this.startNodeFrom(expr)
			node.test = expr
			node.then = this.parseExpression(true)
			this.expect(this._colon)
			node.else = this.parseExpression(true, noIn)
			return this.finishNode(node, "Condition")
		}
		return expr
	}

	// Start the precedence parser.

	this.parseExprOps = function(noIn) {
		return this.parseExprOp(this.parseMaybeUnary(), -1, noIn)
	}

	// Parse binary operators with the operator precedence parsing
	// algorithm. `left` is the left-hand side of the operator.
	// `minPrec` provides context that allows the function to stop and
	// defer further parser to one of its callers when it encounters an
	// operator that has a lower precedence than the set it is parsing.

	this.parseExprOp = function(left, minPrec, noIn) {
		var prec = this.tokType.binop
		if (prec != null && (!noIn || (this.tokType !== this._in && this.tokType !== this._of && this.tokType !== this._to) )) {
			if (prec > minPrec) {
				var node = this.startNodeFrom(left)
				node.left = left
				node.op = this.tokType.replace || this.tokVal
				node.prio = this.tokType.binop
				var op = this.tokType.replaceOp || this.tokType
				this.next()
				node.right = this.parseExprOp(this.parseMaybeUnary(), prec, noIn)
				var exprNode = this.finishNode(node, 
					(op === this._logicalOR || op === this._logicalAND || op === this._relational || op === this._equality) ? "Logic" : "Binary")
				return this.parseExprOp(exprNode, minPrec, noIn)
			}
		}
		return left
	}

	// Parse unary operators, both prefix and postfix.

	this.parseMaybeUnary = function() {
		if (this.tokType.prefix) {
			var node = this.startNode(), update = this.tokType.isUpdate
			
			node.op = this.tokType.replace || this.tokVal

			node.prefix = true
			this.tokRegexpAllowed = true
			this.next()
			node.arg = this.parseMaybeUnary()
			if (update) this.checkLVal(node.arg)
			else if (this.strict && node.op === "delete" &&
							 node.arg.type === "Id")
				this.raise(node.start, "Deleting local variable in this.strict mode")
			return this.finishNode(node, update ? "Update" : "Unary")
		}
		var expr = this.parseExprSubscripts()
		while (this.tokType.postfix && !this.canInsertSemicolon()) {
			var node = this.startNodeFrom(expr)
			node.op = this.tokVal
			node.prefix = false
			node.arg = expr
			this.checkLVal(expr)
			this.next()
			expr = this.finishNode(node, "Update")
		}
		return expr
	}

	// Parse call, dot, and `[]`-subscript expressions.

	this.parseExprSubscripts = function() {
		return this.parseSubscripts(this.parseExprAtom())
	}

	this.parseSubscripts = function(base, noCalls) {
		if (this.tokType == this._dot) {
			// dots on new line are ok.
			if( this.input.charCodeAt(this.tokPos) == 46 ) return base
			this.eat(this._dot)
			var node = this.startNodeFrom(base)
			node.object = base
			node.key = this.parseIdent(true)
			return this.parseSubscripts(this.finishNode(node, "Key"), noCalls)
		} else if (this.tokType == this._bracketL) {
			// we also dont do this._bracketL on new line
			if( this.lastSkippedNewlines ) return base
			this.eat(this._bracketL)
			var node = this.startNodeFrom(base)
			node.object = base
			if( this.tokType != this._bracketR){
				node.index = this.parseExpression()
			}
			this.expect(this._bracketR)
			return this.parseSubscripts(this.finishNode(node, "Index"), noCalls)
		} else if (this.tokType == this._braceL){
			// we also dont do this._braceL on new line
			if( this.lastSkippedNewlines ) return base
			var node = this.startNodeFrom(base)
			node.call = base
			node.body = this.parseBlock(true)
			return this.finishNode(node, "Callback")
		} else if( this.tokType == this._thinArrow ){
			// you cant separate an arrow from its args with a this.newline
			if( this.lastSkippedNewlines ) return base
			this.next()
			var node = this.startNodeFrom(base)
			node.arrow = '->'
			return this.parseArrowFunction(node, base)
		} else if( this.tokType == this._fatArrow ){
			// you cant separate an arrow from its args with a this.newline
			if( this.lastSkippedNewlines ) return base
			this.next()
			var node = this.startNodeFrom(base)
			node.arrow = '=>'
			return this.parseArrowFunction( node, base )
		} else if( this.tokType == this._do ){
			// do cant be on the next line or it can be a do while
			if( this.lastSkippedNewlines )return base
			this.next()
			var node = this.startNodeFrom(base)
			node.call = base
			node.arg = this.parseExpression()
			return this.finishNode( node, 'Do')
		} else if (!noCalls && this.tokType == this._parenL) {
			// we dont do calls on the next line. Never seen one that wasnt a bug. Just say no.
			if( this.lastSkippedNewlines ) return base
			this.eat(this._parenL)
			var node = this.startNodeFrom(base)
			node.fn = base
			node.args = this.parseExprList(this._parenR, false)
			return this.parseSubscripts(this.finishNode(node, "Call"), noCalls)
		} else return base
	}

	// Parse an atomic expression — either a single token that is an
	// expression, an expression started by a keyword like `function` or
	// `new`, or an expression wrapped in punctuation like `()`, `[]`,
	// or `{}`.

	this.parseExprAtom = function() {

		if( this.tokType.isType ) return this.parseType()

		switch (this.tokType) {
		case this._this:
			var node = this.startNode()
			this.next()
			return this.finishNode(node, "This")
		case this._name:
			return this.parseIdent()
		case this._num: case this._string: case this._regexp:
			var node = this.startNode()
			node.kind = this.tokType.type
			node.value = this.tokVal
			node.raw = this.input.slice(this.tokStart, this.tokEnd)
			this.next()
			return this.finishNode(node, "Value")

		case this._null: case this._true: case this._false:
			var node = this.startNode()
			node.value = this.tokType.atomValue
			node.raw = this.tokType.keyword
			this.next()
			return this.finishNode(node, "Value")

		case this._parenL:
			var tokStart1 = this.tokStart
			this.next()

			if( this.tokType == this._parenR){// this.empty parens
				this.eat(this._parenR)
				if( this.tokType !== this._thinArrow && this.tokType !== this._fatArrow ) this.unexpected()
				var val = this.startNode()
				val.start = tokStart1
				return this.finishNode(val, "Empty" )
			}

		  var val = this.parseExpression()
		  val.start = tokStart1
		  val.end = this.tokEnd
			this.expect(this._parenR)
			return val

		case this._bracketL:
			var node = this.startNode()
			this.next()
			node.elems = this.parseExprList(this._bracketR, true, true)
			return this.finishNode(node, "Array")

		case this._braceL:
			return this.parseObj()

		case this._function:
			var node = this.startNode()
			this.next()
			return this.parseFunction(node, false)

		case this._new:
			return this.parseNew()
		
		case this._thinArrow:
			var node = this.startNode()
			node.arrow = '->'
			this.next()
			return this.parseArrowFunction(node)
		
		case this._fatArrow:
			var node = this.startNode()
			node.arrow = '=>'
			this.next()
			return this.parseArrowFunction(node)

		case this._dot:
			return this.parseDots()

		default:
			this.unexpected()
		}
	}


	this.parseDots = function( onlyRest ) {
			var node = this.startNode()
			var dots = 0
			while( this.tokType == this._dot ){
				this.next()
				dots++
			}
			node.dots = dots

			if( this.tokType == this._name){ // its a ...rest thing
				if( onlyRest && dots !== 3) this.raise(this.tokPos, "Have to use 3 dots to define rest parameter")
				node.id = this.parseIdent()
				return this.finishNode(node, "Rest" )
			} 
			else if( onlyRest || !this.tokType.binop ) this.unexpected()

			node.op = this.tokVal
			this.next()
			node.id = this.parseIdent()

			return this.finishNode(node, "Path")
	}

	// New's precedence is slightly tricky. It must allow its argument
	// to be a `[]` or dot subscript expression, but not a call — at
	// least, not without wrapping it in parentheses. Thus, it uses the

	this.parseNew = function() {
		var node = this.startNode()
		this.next()
		node.fn = this.parseSubscripts(this.parseExprAtom(), true)
		if (this.eat(this._parenL)) node.args = this.parseExprList(this._parenR, false)
		else node.args = this.empty
		return this.finishNode(node, "New")
	}

	// Parse an object literal.

	this.parseObj = function() {
		var node = this.startNode(), first = true, sawGetSet = false
		node.keys = []
		this.next()
		while (!this.eat(this._braceR)) {
			if (!first) {
				this.canInjectComma( this.tokType, true ) || this.expect(this._comma)
				if (this.allowTrailingCommas && this.eat(this._braceR)) break
			} else first = false

			var prop = {key: this.parsePropertyName()}, isGetSet = false, kind
			if (this.eat(this._colon)) {
				prop.value = this.parseExpression(true)
				kind = prop.kind = "init"
			} else if (this.ecmaVersion >= 5 && prop.key.type === "Id" &&
								 (prop.key.name === "get" || prop.key.name === "set")) {
				isGetSet = sawGetSet = true
				kind = prop.kind = prop.key.name
				prop.key = this.parsePropertyName()
				if (this.tokType !== this._parenL) this.unexpected()
				prop.value = this.parseFunction(this.startNode(), false)
			} else this.unexpected()

			// getters and setters are not allowed to clash — either with
			// each other or with an init property — and in this.strict mode,
			// init properties are also not allowed to be repeated.

			if (prop.key.type === "Id" && (this.strict || sawGetSet)) {
				for (var i = 0; i < node.keys.length; ++i) {
					var other = node.keys[i]
					if (other.key.name === prop.key.name) {
						var conflict = kind == other.kind || isGetSet && other.kind === "init" ||
							kind === "init" && (other.kind === "get" || other.kind === "set")
						if (conflict && !this.strict && kind === "init" && other.kind === "init") conflict = false
						if (conflict) this.raise(prop.key.start, "Redefinition of property")
					}
				}
			}
			node.keys.push(prop)
		}
		return this.finishNode(node, "Object")
	}

	this.parsePropertyName = function() {
		if (this.tokType === this._num || this.tokType === this._string) return this.parseExprAtom()
		return this.parseIdent(true)
	}

	// Parse a function declaration or literal (depending on the
	// `isStatement` parameter).
	
	this.argToDef = function( node ) {
		var o = this.startNodeFrom(node)
		o.end = node.end
		o.type = 'Def'

		if( node.type === 'Id'){
			o.id = node
		} else if( node.type === 'Assign' && node.op === '=' && 
				node.left.type == 'Id'){
			o.id = node.left
			o.init = node.right
		} else this.raise(node.start, "Invalid function argument definition")
		return o
	}

	this.parseArrowFunction = function(node, args) {
		if(args && args.type !== 'Empty'){
			// convert args to a List of Defs
			if( args.type === 'List'){
				var items = args.items
				for( var i = 0, l = items.length; i < l; i++){
					if( items[ i ].type == 'Rest'){
						if( i < l - 1) this.raise(items[i].start, "Cannot use rest prefix befor last parameter")
						node.rest = items[ i ]
						if(node.rest.dots !== 3) this.raise(items[i].start, "Have to use 3 dots to define rest parameter")
						items.length --
					} else items[ i ] = this.argToDef( items[ i ] )
				}
				node.params = items
			} else {
				if( args.type == 'Rest'){
					node.rest = args
					if(node.rest.dots !== 3) this.raise(items[i].start, "Have to use 3 dots to define rest parameter")
				}
				else node.params = [this.argToDef( args )]
			} 
		} 
		if(this.tokType == this._braceL) node.body = this.parseBlock(true)
		else  node.body = this.parseExpression(true)

		return this.finishNode(node, 'Function')
	}

	// Parse a function declaration or literal (depending on the
	// `isStatement` parameter).

	this.parseFunction = function(node, isStatement) {
		if (this.tokType === this._name) node.id = this.parseIdent()
		else node.id = null

		this.expect(this._parenL)
		node.params = this.parseDefs( )

		if(this.tokType == this._dot) node.rest = this.parseDots(true)

		this.expect(this._parenR)

		// Start a new scope with regard to this.labels and the `this.inFunction`
		// flag (restore them to their old value afterwards).
		var oldInFunc = this.inFunction, oldLabels = this.labels
		this.inFunction = true; this.labels = []
		node.body = this.parseBlock(true)
		this.inFunction = oldInFunc; this.labels = oldLabels

		// If this is a this.strict mode function, verify that argument names
		// are not repeated, and it does not try to bind the words `eval`
		// or `arguments`.
		if (this.strict || node.body.steps.length && this.isUseStrict(node.body.steps[0])) {
			for (var i = node.id ? -1 : 0; i < node.args.length; ++i) {
				var id = i < 0 ? node.id : node.args[i]
				if (this.isStrictReservedWord(id.name) || this.isStrictBadIdWord(id.name))
					this.raise(id.start, "Defining '" + id.name + "' in this.strict mode")
				if (i >= 0) for (var j = 0; j < i; ++j) if (id.name === node.args[j].name)
					this.raise(id.start, "Argument name clash in this.strict mode")
			}
		}
		node.def = isStatement && node.id !== undefined

		return this.finishNode(node, "Function")
	}

	// Parses a comma-separated list of expressions, and returns them as
	// an array. `close` is the token type that ends the list, and
	// `allowEmpty` can be turned on to allow subsequent commas with
	// nothing in between them to be parsed as `null` (which is needed
	// for array literals).

	this.parseExprList = function(close, allowTrailingComma, allowEmpty) {
		var elts = [], first = true
		while (!this.eat(close)) {
			if (!first) {
				this.canInjectComma( this.tokType, true ) || this.expect(this._comma)
				if (allowTrailingComma && this.allowTrailingCommas && this.eat(close)) break
			} else first = false

			if (allowEmpty && this.tokType === this._comma) elts.push(null)
			else elts.push(this.parseExpression(true))
		}
		return elts
	}

	// Parse the next token as a type
	this.parseType = function() {
		var node = this.startNode()
		if( !this.tokType.isType ) this.unexpected()
		node.name = this.tokType.keyword
		this.next()
		return this.finishNode(node, "Type")
	}

	// Parse the next token as an identifier. If `liberal` is true (used
	// when parsing properties), it will also convert keywords into
	// identifiers.

	this.parseIdent = function(liberal) {
		var node = this.startNode()
		if (liberal && this.forbidReserved == "everywhere") liberal = false
		if (this.tokType === this._name) {
			if (!liberal &&
					(this.forbidReserved &&
					 (this.ecmaVersion === 3 ? this.isReservedWord3 : this.isReservedWord5)(this.tokVal) ||
					 this.strict && this.isStrictReservedWord(this.tokVal)) &&
					this.input.slice(this.tokStart, this.tokEnd).indexOf("\\") == -1)
				this.raise(this.tokStart, "The keyword '" + this.tokVal + "' is reserved")
			node.name = this.tokVal
		} else if (liberal && this.tokType.keyword) {
			node.name = this.tokType.keyword
		} else {
			console.log(this.tokType)
			this.unexpected()
		}
		this.tokRegexpAllowed = false
		if( this.containsFlag ){
			node.flag = this.containsFlag
		}
		this.next()
		return this.finishNode(node, "Id")
	}
}

if(typeof window !== 'undefined') ONE.browser_boot_()
else ONE.nodejs_boot_()