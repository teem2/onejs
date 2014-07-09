"use strict"
// Base class
if(typeof window !== 'undefined') window.ONE = {}
else ONE = {}

ONE.base_ = function(){

	this.__class__ = 'Base'

	// inherit a new class, whilst passing on the scope
	this.extend = function( outer, role, selfname ){

		if(this.owner) throw new Error("You are extending an instance")

		// variable API
		if(typeof outer == 'string') selfname = outer, outer = this
		else if(typeof outer == 'function')  selfname = role, role = outer, outer = this
		else if(typeof role == 'string') selfname = role, role = outer, outer = this

		var obj = Object.create(this)

		if(outer && outer.$) obj.$ = outer.$

		obj.__class__ = selfname || 'unknown-class'

		// allow reference to self on inherited classes
		if(selfname) obj[selfname] = obj
		
		if( role ){
			if( typeof role == 'function') role.call(obj, outer)
			else obj.import(role)
		}
		return obj
	}

	// new an object with variable arguments and automatic owner
	this.new = function( owner ){

		if(this.owner !== undefined) throw new Error("You are newing an instance")

		var obj = Object.create(this)

		var len = arguments.length
		obj.owner = owner || null

		if(len > 1) {
			if(obj._init) obj._init.apply(obj, Array.prototype.slice.call(arguments, 1))
			else if(obj.init) obj.init.apply(obj, Array.prototype.slice.call(arguments, 1))
		}
		else {
			if(obj._init) obj._init()
			else if(obj.init) obj.init()
		}

		return obj
	}

	// create object with owner and role
	this.create = function( owner, role ){

		if(this.owner !== undefined) throw new Error("You are newing an instance")

		var obj = Object.create(this)

		obj.owner = owner || null

		if(obj._init) obj._init()
		else if(obj.init) obj.init()

		if( role ) role.call( obj )

		return obj
	}

	this.isClass = function(){
		return this.owner === undefined
	}

	this.isInstance = function(){
		return this.owner !== undefined
	}

	this.prototypeOf = function( other ){
		return this.isPrototypeOf( other )
	}

	// plain value storage wrapper for overloads
	function StackValue(v){
		this.v = v
	}
	
	// load a property bag into a new object
	this.load = function( irole ){
		var role = irole
		if(typeof irole == 'string'){// try to read it from scope
			role = this.$[irole]
			if(!role) throw new Error("Cannot find role "+irole+" on this")
		}

		if(typeof role == 'function'){
			var base = this.Base.new(this)
			role.call(base)
			return base
		}

		return role
	}

	// merge a role onto this
	this.import = function( irole ){
		var role = irole
		if( typeof irole == 'string' ){// try to read it from scope
			role = this.$[irole]
			if( !role ) throw new Error("Cannot find role "+irole+" on this")
		}

		if( typeof role == 'function' ){
			role.call( this )
			return this
		}
		
		if( typeof role == 'object' ){
			for( var k in role ) this[ k ] = role[ k ]
			return this
		}

		throw new Error('could not mix in', irole)
	}

	// define something as a mixin
	this.mixin = function( name, init ){

		if( this.__lookupSetter__( name ) ) throw new Error("Cannot redefine mixer " + name )
		if( name in this ){
			//?obj.apply( this[ name ] )
		}
		var storeKey = '__' + name
		this[ storeKey ] = init
		Object.defineProperty(this, name, {
			configurable:true,
			enumerable:true,
			get:function(){
				return this[ storeKey ]
			},
			set:function( value ){
				this[ storeKey ].mixin( value )
			}
		})
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

	// learn a property bag, creates undo stacks so forget works.
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

	// forget a property bag
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
		var ret
		for( var i = 0; i < times; i++ ){
			ret = call.call( this, i )
		}
		tm = this.now() - tm
		console.log("profile " + msg + " " + Math.ceil(tm)+'ms')
		return ret
	}

	// Create a new scope
	this.scoped = function( name ){
		if( this.$.scopeof == this ) throw new Error("Don't scope more than once")
		// create a prototype backed scope chain
		var $ = Object.create( this.$ )
		if( name ) this.$[ name ] = $
		this.$ = $
		$.$ = $ // make scope objects scope itself
		$.scopeof = this
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
		if( arguments.length > 1 ) fnargs = Array.prototype.slice.call( arguments, 1 )
		// look up function name
		var name = me.__supername__
		if( name !== undefined ){ // we can find our overload directly
			var fn = this.overloads(name, me)
			if(fn && typeof fn == 'function') return fn.apply(this, fnargs)
		} 
		else { // we have to find our overload in the entire keyspace
			for(var k in this) {
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

	// keys
	this.keys = function( ){
		return Object.keys(this)
	}

	// flush an entire property stack
	this.stackFlush = function( key ){
		if( !this.hasOwnProperty('__overloads__') ) return
		var overloads = this.__overloads__
		var stack = overloads[ key ]
		if(! stack || !stack.length ) return
		stack.length = 0
	}
	
	// return the property at index in the stack
	this.stackAt = function( key, idx ){
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
		// we bind the signals late

		var sigbinds = this.__$sigbinds
		if( sigbinds ){
			for( var k in sigbinds ){
				this[ k ] = sigbinds[ k ]
			}
		}
	}

	// define a property
	this.defineProperty = function( key, def ){
		Object.defineProperty( this, key, def )
	}

	this.signal = function( key, value, setter ){
		var signalStore = '__' + key
		var fastStore = '__$' + key
		var sig =  this[ signalStore ]
		if( !sig ){ 
			sig = this[ signalStore ] = this.Signal.prop( this, key, setter )

			// make a getter/setter pair
			Object.defineProperty( this, key, {
				configurable:true,
				enumerable:true,
				get:function(){
					var sig = this[ signalStore ]					
					// make an instance copy if needed
					if( sig.owner != this ){
						sig = this[ signalStore ] = sig.fork( this )
						if( fastStore in this ) sig.value = this[fastStore]
					}
					return sig
				},
				set:function(value){
					var sig = this[ signalStore ]
					// fast path property setter
					if(!sig.onSet && sig.setter && 
						(typeof value == 'number' || Array.isArray(value))){
						if( sig.owner != this ){
							sig = this[ signalStore ] = Object.create( sig )
							sig.owner = this
						}
						sig.value = value
						sig.setter.call( this, value )
						return
					}
					// make an instance copy if needed
					if( sig.owner != this ) sig = this[ signalStore ] = sig.fork( this )
					sig.set( value )
				}
			})
		}
		if( value !== undefined ) sig.set( value )
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
	this.log = function(){ ONE.logwrite(2, arguments); return arguments[0];}
	this.warn = function(){ ONE.logwrite(1, arguments) }
	this.error = function(){ ONE.logwrite(0, arguments) }
}

ONE.init_ = function(){
	
	// make self a class
	this.base_()
	
	this.__class__ = 'ONE'
	// create base class
	this.base_.call(this.Base = {})
	this.Base.Base = this.Base
	// add ast support to the Base class
	this.ast_.call(this.Base)
	this.color_()
	
	this.signal_.call(this.Base.Signal = this.Signal = {})
	if(this.proxy_) this.proxy_.call(this.Base)
	// make ONE the new root scope
	this.Base.$ = this.$ = Object.create(this)
	this.Base.out = this.out
	this.Base.error = this.error
	this.Base.warn = this.warn
	this.Base.trace = this.trace

	// hide all the props
	this.Base.enumfalse.apply(ONE.Base, Object.keys( ONE.Base ) )

	this._await = function( generator, bound, _catch ){
		var ret = function(){
			var iter = generator.apply(this, arguments)
			return ONE.Signal.wrap(function(sig){
				function error(e){
					// throw forward
					sig.throw(e)
					// lets not throw in the iterator for now
					//if(!ret) iter.throw(e)
				}
				function next( value ){
					var iterval = iter.next( value )
					if(iterval.done === false){ // we have a promise
						iterval.value.then( next, error )
					}
					else{
						sig.end( iterval.value )
					}
				}
				next()
			})
		}
		if(bound) return ret.bind(bound)
		return ret
	}

	this.iterator = function( what ){
		// check what it is.
		if(what === null || what === undefined) return
		if(typeof what.next == 'function') return what
		if(typeof what != 'object') throw new Error('Cannot iterate over object')
	
		if(!Array.isArray(what)){
			var obj = what
			what = []
			for( var k in obj ) what.push( obj[ k ] )
		}
	
		var len = what.length
		if(!len) return
		return {
			next:function(){
				this.index++
				if(this.index >= this.length - 1) this.done = true
				this.value = what[this.index]
				return this
			},
			done: false,
			index: -1,
			length: len
		}
	}

	var Assert_ =  function(txt, why, value){
		this.toString = function(){
			var msg = "Assert failed: " + txt + 
				(why?"  why: "+why:'')+
				(value!==undefined?"  got value: "+value:"")
			return msg
		}
	}
	if(typeof window !== 'undefined') window.Assert = Assert_
	else if(typeof global !== 'undefined') global.Assert = Assert_
	else Assert = Assert_
	
	// make all constructors compatible with the ONEJS way
	Function.prototype.new = function(){
		var obj = Object.create(this.prototype)
		this.apply(obj, Array.prototype.slice.call(arguments, 1))
		return obj
	}
	
	// all X instanceOf Y is rewritten as Y prototypeOf X
	// to map the simplified ONE class model to JS
	Function.prototype.prototypeOf = function( other ){
		return other instanceof this
	}
	
	Object.defineProperty( Array.prototype, 'last', {
		configurable:false,
		enumerable:false,
		get:function(){
			return this[this.length - 1]
		},
		set:function(value){
			this[this.length - 1] = value
		}
	})
	
	Object.defineProperty( Array.prototype, 'first', {
		configurable:false,
		enumerable:false,
		get:function(){
			return this[0]
		},
		set:function(value){
			this[0] = value
		}
	})
	
	Math._mod = function( x, y ){
		return (x%y+y)%y
	}
}

// the Signal class
// the union of a computed propery, an event, a promise and 
// an Observable and quite possibly a constraint.
ONE.signal_ = function(){

	this.__class__ = 'Signal'
	this._signal_ = 1
	
	// create a new signal
	this.new = function( owner ){
		this.owner = owner
	}

	this.apply = function( sthis, args ){

	}

	this.call = function( sthis, value ){

	}

	// signal wrapper
	this.wrap = function( wrap ){
		var obj = Object.create(this)
		wrap(obj)
		return obj
	}
	
	this.all = function(array){
		var obj = Object.create(this)
		if(!array || !array.length){
			obj.end()
			return obj
		}
		var deps = array.length
		var res = []
		for(var i = 0, l = deps; i < l; i++){
			array[i].then(function(value){
				if(obj){
					res[this] = value
					if(!--deps){
						obj.end(res)
						obj = null
					}
				}
			}.bind(i),
			function(err){
				if(obj) obj.throw(err)
				obj = null
			})
		}
		return obj
	}

	// bind to a property
	this.prop = function( owner, key, setter ){
		var obj = Object.create( this )
		
		obj.owner = owner
		obj.key = key
		obj.setter = setter

		return obj
	}

	// fork a signal
	this.fork = function( owner ){
		var sig = Object.create( this )
		sig.owner = owner
		return sig
	}

	// valueOf aliases signals to values
	this.valueOf = function(){
		return this.value
	}

	// listen to set
	this.on = function( cb, pthis ){
		if(pthis && pthis.owner) cb = cb.bind( pthis )

		if(!this.hasOwnProperty('onSet')) this.onSet = cb
		else if(!Array.isArray(this.onSet)) this.onSet = [this.onSet, cb]
		else this.onSet.push( cb )

		if(this.monitor) this.monitor.call( this.owner, cb )
	}

	this.off = function( cb ){
		var i
		if( this.onSet && (i = this.onSet.indexOf(cb)) !== -1){
			this.onSet.splice(i, 1)
		}
	}

	// listen to the end  / error
	this.then = function( onEnd, onError ){
		if(this.ended){
			if(this.error) window.setTimeout(function(){
					onError.call(this, this.exception)	
				}.bind(this), 0)
			else {
				window.setTimeout(function(){
					onEnd.call(this, this.value)	
				}.bind(this), 0)
			}
			return
		}

		if(onEnd){
			if(!this.hasOwnProperty('onEnd')) this.onEnd = onEnd
			else if(!Array.isArray(this.onEnd)) this.onEnd = [this.onEnd, onEnd]
			else this.onEnd.push( onEnd )
		}

		if(onError){
			if(!this.hasOwnProperty('onError')) this.onError = onError
			else if(!Array.isArray(this.onError)) this.onError = [this.onError, onError]
			else this.onError.push( onError )
		}
	}
	
	// called by bound objects to set the value of the signal
	// without replacing themselves
	this.bypass = function( value ){
		this.value = value

		// call all our listeners
		var proto = this 
		var owner = this.owner
		var s

		if(this.setter) this.setter.call( owner, value, this )

 		while(proto && (s = proto.onSet)){
 			if(proto.hasOwnProperty('onSet')){
				if(!Array.isArray(s)) s.call( owner, value, this )
				else for(var i = 0, l = s.length; i < l; i++){
					s[i].call( owner, value, this )
				}
			}
			proto = Object.getPrototypeOf(proto)
		}
	}
	
	// set the signal value
	this.set = function(value){
		if(this.ended) throw new Error('Cant set an ended signal')
		
		if(typeof value == 'function'){
			return this.on( value )
		}
		
		var owner = this.owner
		
		// if someone assigns something bindable we bind that
		var old_bind
		if(old_bind = this.bound){
			old_bind.unbind_signal( this )
			this.bound = undefined
		}
		
		if(value && value.bind_signal){
			// lets check if we are bound to an instance
			this.bind = value
			if(!this.owner || this.owner.owner){
				this.bound = value.bind_signal( owner, this, old_bind )
			}
			// delay the signal bind by pushing it on a stack
			else this.owner.bind_signals
			return
		}
		
		this.value = value
		
		// call all our listeners
		var proto = this 
		var s
		
		if(this.setter) this.setter.call( owner, value, this )
		
		while(proto && (s = proto.onSet)){
			if(proto.hasOwnProperty('onSet')){
				if(!Array.isArray(s)) s.call( owner, value, this )
				else for(var i = 0, l = s.length; i < l; i++){
					s[i].call( owner, value, this )
				}
			}
			proto = Object.getPrototypeOf(proto)
		}
	}
	
	// end the signal
	this.end = function(value){
		this.set( value )
		this.ended = true
		// call end
		var proto = this 
		var owner = this.owner
		var s
		while(proto && (s = proto.onEnd)){
			if(proto.hasOwnProperty('onEnd')){
				if(!Array.isArray(s)) s.call(owner, value, this)
				else for(var i = 0, l = s.length; i < l; i++){
					s[i].call(owner, value, this)
				}
			}
			proto = Object.getPrototypeOf(proto)
		}
	}
	
	// default allows a throw to be transformed to a value
	this.default = function(onDefault){
		if(onDefault in this) throw new Error('Cannot overload defaults')
		this.onDefault = onDefault
		return this
	}
	
	// default allows a throw to be transformed
	this.catch = function(onError){
		if(onError){
			if(!this.hasOwnProperty('onError')) this.onError = onError
			else if(!Array.isArray(this.onError)) this.onError = [this.onError, onError]
			else this.onError.push( onError )
		}
		return this
	}
	
	// throw and exception in the signal
	this.throw = function(error, next){
		
		if(this.ended) throw new Error('Cant throw on an ended signal')
		if(this.onDefault) return this.end( this.onDefault(error) )
		
		this.ended = true
		this.error = error
		// call error
		var proto = this 
		var owner = this.owner
		var s
		var handled
		while(proto && (s = proto.onError)){
			if(proto.hasOwnProperty('onError')){
				handled = true
				if(!Array.isArray(s)) s.call(owner, error, next, this)
				else for(var i = 0, l = s.length; i < l; i++){
					s[i].call(owner, error, next, this)
				}
			}
			proto = Object.getPrototypeOf(proto)
		}			
		return handled
	}
}
