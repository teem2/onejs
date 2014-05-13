
// Base class

ONE.base_ = function(){

	this.__onename__ = 'Base'

	// inherit a new class, whilst passing on the scope
	this.extend = function( pthis, role, selfname ){

		var obj = Object.create( this )
		obj.$ = pthis.$
		obj._ = pthis
		obj.__onename__ = 'unknown-class'
		if(! obj.apply ){
			obj.apply = pthis.apply
			obj.extend = pthis.extend
			obj.new = pthis.new
		}
		if(selfname) obj[selfname] = obj
		if( typeof role == 'function') role.call( obj, pthis )
		else obj.apply( role )

		return obj
	}

	// create a new object
	this.new = function(){

		var obj = Object.create( this )

		var arg
		var len = arguments.length
		if(len){
			obj.owner = arguments[0]
			if(len > 1) arg = Array.prototype.slice.call( arguments, 1 )
		}

		if(obj._init) obj._init.apply( obj, arg )
		else if(obj.init) obj.init.apply( obj, arg )

		return obj
	}
	
	this.isClass = function(){
		return this.hasOwnProperty('__onename__')
	}

	// plain value storage wrapper for overloads
	function StackValue(v){
		this.v = v
	}
	
	// load a property bag into a new object
	this.load = function( irole ){
		var role = irole
		if( typeof irole == 'string' ){// try to read it from scope
			role = this.$[irole]
			if( !role ) throw new Error("Cannot find role "+irole+" on this")
		}

		if( typeof role == 'function' ){
			var base = this.Base.new()
			role.call( base )
			return base
		}

		return role
	}

	// apply a property bag onto this. its the same as function.apply(this) == this.apply(function)
	this.apply = function( irole ){
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
		} 
		else { // we have to find our overload in the entire keyspace
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

	// keys
	this.keys = function( ){
		return Object.keys(this)
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

ONE._await = function( generator, bound, _catch ){
	var ret = function(){
		var iter = generator.apply(this, arguments)
		return new Promise(function(resolve, reject){
			function error(e){
				reject(e)
				iter.throw( e )
			}
			function next( value ){
				promise = iter.next( value )
				if(promise.done === false){
					promise.value.then( next, error )
				}
				else{
					resolve( promise.value )
				}
			}
			next()
		})
	}
	if(bound) return ret.bind(bound)
	return ret
}

ONE.iterator = function( what ){
	// check what what is.
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

if(typeof Promise === 'undefined'){
	function Promise(fn) {
		var state = 'pending'
		var value
		var deferred = null

		function resolve(newValue) {
			try {
				if(newValue && typeof newValue.then === 'function') {
					newValue.then(resolve, reject)
					return
				}
				state = 'resolved'
				value = newValue

				if(deferred) {
					handle(deferred)
				}
			} catch(e) {
				reject(e);
			}
		}

		function reject(reason) {
			state = 'rejected'
			value = reason

			if(deferred) {
				handle(deferred)
			}
		}

		function handle(handler) {
			if(state === 'pending') {
				deferred = handler
				return
			}
			setTimeout(function(){
				var handlerCallback

				if(state === 'resolved') {
					handlerCallback = handler.onResolved
				} else {
					handlerCallback = handler.onRejected
				}

				if(!handlerCallback) {
					if(state === 'resolved') {
						handler.resolve(value)
					} else {
						handler.reject(value)
					}
				}
	
				var ret
				try {
					ret = handlerCallback(value)
				} catch(e) {
					handler.reject(e)
					return
				}

				handler.resolve(ret)
			},0)
		}

		this.then = function(onResolved, onRejected) {
			return new Promise(function(resolve, reject) {
				handle({
					onResolved: onResolved,
					onRejected: onRejected,
					resolve: resolve,
					reject: reject
				})
			})
		}

		fn(resolve, reject)
	}
}
