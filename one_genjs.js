ONE.genjs_ = function(modules, parserCache){

	this.typeMap = Object.create(null)
	this.typeMap.bool    = { size:1, slots:1, view:'Int32', name:'bool', prim:1 }
	this.typeMap.int8    = { size:1, slots:1, view:'Int8', name:'int8', prim:1 }
	this.typeMap.uint8   = { size:2, slots:1, view:'Uint8', name:'uint8', prim:1 }
	this.typeMap.int16   = { size:2, slots:1, view:'Int16', name:'int16', prim:1 }
	this.typeMap.uint16  = { size:2, slots:1, view:'Uint16', name:'uint16', prim:1 }
	this.typeMap.int     = { size:4, slots:1, view:'Int32', name:'int', prim:1 }
	this.typeMap.int32   = { size:4, slots:1, view:'Int32', name:'int32', prim:1 }
	this.typeMap.uint32  = { size:4, slots:1, view:'Uint32', name:'uint32', prim:1 }
	this.typeMap.float   = { size:4, slots:1, view:'Float32', name:'float', prim:1 }
	this.typeMap.float32 = { size:4, slots:1, view:'Float32', name:'float32', prim:1 }
	this.typeMap.double  = { size:8, slots:1, view:'Float64', name:'double', prim:1 }
	this.typeMap.float64 = { size:8, slots:1, view:'Float64', name:'float64', prim:1 }
	this.viewSize = {
		Int8:1,
		Uint8:1,
		Int16:2,
		Uint16:2,
		Int32:4,
		Uint32:4,
		Float32:4,
		Float64:8
	}

	this.ToJS = this.ToCode.extend(this, function(outer){
		
		this.newline = '\n'
		
		this.promise_catch = 1
		this.expand_short_object = 1
		
		this.destruc_prefix = '_\u0441'
		this.desarg_prefix = '_\u0430'
		this.tmp_prefix = '_\u0442'
		this.call_tmpvar = '_\u0441'
		this.store_prefix = '_\u0455'
		this.template_marker = '\_\u0445_'
		this.template_regex = /\_\u0445\_/g
		
		this.new_state = function(){
			this.signals = []
			this.line = 0
			this.scope = Object.create(null)
			this.type_methods = Object.create(null)
			this.macro_args = Object.create(null)
			this.module = {
				imports: [],
				types: Object.create(outer.typeMap),
				defines: Object.create(null),
				macros: Object.create(null),
				exports: Object.create(null)
			}
		}
		
		this.pull_flags = function(n){
			var steps
			if(n.body && (steps = n.body.steps) && steps[0] && steps[0].flag == 35){
				var ret = steps[0].name
				steps.splice(0, 1)
				return ret
			}
			return ''
		}
		
		var globals = this.globals = Object.create(null)
		globals.Object = 1
		globals.Array = 1
		globals.String = 1
		globals.Number = 1
		globals.Date = 1
		globals.Boolean = 1
		globals.Error = 1
		globals.Math = 1
		globals.RegExp = 1
		globals.Function = 1
		globals.undefined = 1
		globals.Float32Array = 1
		globals.Float64Array = 1
		globals.Int16Array = 1
		globals.Int32Array = 1
		globals.Int8Array = 1
		globals.Uint16Array = 1
		globals.Uint32Array = 1
		globals.Uint8Array = 1
		globals.Uint8ClampedArray = 1
		globals.ParallelArray = 1
		globals.Map = 1
		globals.Set = 1
		globals.WeakMap = 1
		globals.WeakSet = 1
		globals.ArrayBuffer = 1
		globals.DataView = 1
		globals.JSON = 1
		globals.Iterator = 1
		globals.Generator = 1
		globals.Promise = 1
		globals.XMLHttpRequest = 1
		globals.Intl = 1
		globals.arguments = 1
		globals.isNaN = 1
		globals.isFinite = 1
		globals.parseFloat = 1
		globals.parseInt = 1
		globals.decodeURI = 1
		globals.decodeURIComponent = 1
		globals.encodeURI = 1
		globals.encodeURIComponent = 1
		globals.escape = 1
		globals.unescape = 1
		globals.setInterval = 1
		globals.clearInterval = 1
		globals.setTimeout = 1
		globals.clearTimeout = 1
		globals.console = 1
		globals.module = 1
		globals.window = 1
		globals.document = 1
		globals.Buffer = 1
		globals.require = 1
		globals.__dirname = 1
		globals.ONE = 1
		globals.self = 1
		
		this.find_type = function( name ){
			var type
			if(this.generics){
				type = 	this.generics[name]
				if(type) return type
			}
			type = this.module.types[name]
			if(type) return type
			var im = this.module.imports
			for(var i = 0, l = im.length; i < l;i++){
				var types = im[i].types
				if(types && (type = types[name])) return type
			}
		}
		
		this.find_define = function( name ){
			var def = this.module.defines[name]
			if(def) return def
			var im = this.module.imports
			for(var i = 0, l = im.length; i < l; i++){
				var defines = im[i].defines
				if(defines && (def = defines[name])) return def
			}
		}

		// destructuring helpers
		this._destrucArrayOrObj = function(v, acc, nest, fn, vars){
			// alright we must store our object fetch on a ref
			if(nest >= fn.destruc_vars) fn.destruc_vars = nest + 1
			
			var ret = ''
			var od = this.depth
			this.depth = this.depth + this.indent
			
			ret += '(' + this.destruc_prefix + nest + '=' + this.destruc_prefix +
				(nest-1) + acc + ')===undefined||(' + this.newline + this.depth
			
			if(v.type == 'Object') ret += this._destrucObject(v, nest + 1, fn, vars)
			else ret += this._destrucArray(v, nest + 1, fn, vars)
			
			this.depth = od
			ret += this.newline+this.depth + ')'
			
			return ret
		}
		
		this._destrucArray = function(arr, nest, fn, vars){
			var ret = ''
			var elems = arr.elems
			var midrest
			var tmpvar = this.destruc_prefix +(nest - 1)
			for(var i = 0;i<elems.length;i++){
				var v = elems[i]
				if(!v) continue
				var acc
				if(midrest){
					acc = '['+tmpvar+'.length-'+(elems.length - i)+']'
				}
				else acc = '[' + i + ']'
				
				if(v.type == 'Rest'){
					if(midrest){
						throw new Error('cannot have multiple rest variables in one destructure array')
					}
					if(!v.id){
						midrest = i + 1
						continue
					}
					if(v.id.type !=='Id') throw new Error('Unknown rest id type')
					if(i) ret += ',' + this.newline + this.depth
					var name = v.id.name
					if(vars){ vars.push(v); if(v.flag == 46) name = 'this.'+name}
					else name = this.resolve(name)
					// what if we have elems following?
					ret += name + '=' + tmpvar
					if(i < elems.length - 1) ret += '.slice('+i+')'
					else {
						midrest = i + 1
						ret += '.slice('+i+',' + (elems.length - i)+')'
					}
				}
				else if(v.type == 'Id') {
					if(i) ret += ',' + this.newline + this.depth
					var name = v.name
					if(vars){ vars.push(v); if(v.flag == 46) name = 'this.'+name}
					else name = this.resolve(name)
					ret += name + '='+ tmpvar + acc
				}
				else if(v.type == 'Object' || v.type == 'Array') {
					if(i) ret += ',' + this.newline + this.depth
					ret += this._destrucArrayOrObj(v, acc, nest, fn, vars)
				}  else throw new Error('Cannot destructure array item '+i)
			}
			return ret
		}
		
		this._destrucObject = function( obj, nest, fn, vars ){
			var ret = ''
			var keys = obj.keys
			for(var i = 0;i<keys.length;i++){
				var k = keys[i]
				var acc
				if(k.key.type == 'Value'){
					acc = '['+k.key.raw+']'
				} else acc = '.'+k.key.name
				var v = k.value
				if(k.short){
					// lets output a prop
					if(i) ret += ',' + this.newline + this.depth
					var name = k.key.name
					if(vars) vars.push(k.key)
					else name = this.resolve(name)
					ret += name + '='+this.destruc_prefix+(nest - 1)+acc
				}
				else if(v.type == 'Id') {
					if(i) ret += ',' + this.newline + this.depth
					var name = v.name
					if(vars){ vars.push(v); if(v.flag == 46) name = 'this.'+name}
					else name = this.resolve(name)
					ret += name + '='+this.destruc_prefix +(nest - 1)+acc
				}
				else if(v.type == 'Object' || v.type == 'Array') {
					if(i) ret += ',' + this.newline + this.depth
					ret += this._destrucArrayOrObj(v, acc, nest, fn, vars)
				}
				else throw new Error('Cannot destructure property '+acc)
			}
			return ret
		}
		
		this.destructure = function( n, left, init, fn, vars, def ){
			if(!fn) throw new Error('Destructuring assign cant find enclosing function')
			if(!fn.destruc_vars) fn.destruc_vars = 1
			
			var ret = ''
			var olddepth = this.depth
			this.depth = this.depth + this.indent
			
			if( init )
				ret = '((' + this.destruc_prefix + '0=' + (def? def + '||': '') +
					(typeof init == 'string'?init:this.expand( init, n )) +
					')===undefined || (' + this.newline + this.depth
			else{
				if(!def) throw new Error('Destructuring assignment without init value')
				ret = '(' + this.destruc_prefix + '0=' + (def?def:'') + ',(' + this.newline + this.depth
			}
			
			if( left.type == 'Object' ) ret += this._destrucObject(left, 1, fn, vars)
			else ret += this._destrucArray(left, 1, fn, vars)
			
			this.depth = olddepth
			ret += this.newline + this.depth+'))' + this.newline
			return ret
		}
		
		this.store = function(n, value ){
			var ret = value
			if(n.store & 1){
				var fn = this.find_function( n )
				if(!fn.store_var) fn.store_var = 1
				ret = '(' + this.store_prefix + '=' + ret + ')'
			}
			if(n.store & 2) throw new Error("Postfix ! not implemented")
			if(n.store & 4){
				ret = 'ONE.trace(' + ret + ')'
			}
			return ret
		}
		
		this.resolve = function( name, n ){
			// TODO make this resolve order explicit
			if(this.macro_args && name in this.macro_args){
				return this.macro_args[name]//this.expand(this.macro_args[name], n)
			}
			var type = this.type_method, field
			if(type && (field = type.fields[name])){
				//return '_.'+type.arr+'[_.o+'+(field.off / outer.viewSize[type.view])+']'
				return '_['+(field.off / outer.viewSize[type.view])+']'
			}
			
			if(name in this.scope){
				var type = this.scope[name]
				if(n && typeof type == 'object'){
					n.infer = type
				}
				return name
			}
			
			if(name in this.globals) return name
			
			var type = this.find_type(name)
			if(type){
				// lets make this type av on module
				this.module[type.name] = type
				return 'module.'+type.name
			}

			var def = this.find_define(name)
			
			if(def){
				return this.expand(def, n)
			}
			if(n) n.onthis = 1

			if(this.context_resolve){
				var ret = this.context_resolve(name, n)
				if(ret !== undefined) return ret
			}

			return 'this.'+name
		}
		
		this.block = function( n, parent, noindent ){ // term split array
			var old_depth = this.depth
			if(!noindent) this.depth += this.indent
			var ret = ''
			for(var i = 0; i < n.length; i++){
				var step = n[ i ]
				var blk = this.expand(step, parent)
				
				if(this.template_marked){
					if(blk.indexOf(this.template_marker)!= -1){
						// lets loop blk n times
						var type = this.type_method
						if(!type) throw new Error('template found but no type_method')
						var total = type.slots
						for(var j = 0; j < total; j++){
							ret += this.depth + blk.replace(this.template_regex, j)
						}
						var ch = ret[ret.length - 1]
						if(ch !== '\n' ){
							ret += this.newline, this.line++
						}
					}
					this.template_marked = false
				}
				else if(blk!==''){
					if(blk[0] == '(' || blk[0] == '[') ret += this.depth + ';' + blk
					else ret += this.depth + blk
				}
				
				var ch = ret[ret.length - 1]
				if(ch !== '\n' && (blk!=='') ){
					ret += this.newline, this.line++
				}
			}
			this.depth = old_depth
			return ret
		}
		
		this.Id = function( n ){
			var flag = n.flag
			if( flag ){
				if(flag === -1){
					var fn = this.find_function(n)
					if(!fn.store_var) throw new Error("Storage .. operator read but not set in function")
					return this.store_prefix
				}
				if(flag === 35){
					if(!n.name){
						if(!this.type_method) throw new Error('Type method template found outside of type_method')
						this.template_marked = true
						return this.template_marker
					}
					this.module.vec3 = this.find_type('vec3')
					return 'ONE.color("'+n.name+'", module.vec3)'
				}
				if(flag === 64){
					if(n.name === '') return 'console.log("trace")'
					return 'this.' + n.name
				}
			}
			
			return this.resolve( n.name, n )
		}
		
		this.Value = function( n ){
			if(n.raw === undefined) return n.value
			if(n.kind == 'string' && n.raw[0] == '`'){
				return '"'+n.raw.slice(1,-1).replace(/\n/g,'\\n').replace(/"/g,'\\"')+'"'
			}
			if(n.multi){
				if(n.kind == 'regexp') return n.value
				return n.raw.replace(/\n/g,'\\n')
			}
			if(n.kind == 'num'){
				var ch = n.raw.charCodeAt(1)
				if(ch == 79 || ch == 111 || ch == 66 || ch == 98){
					return n.value
				}
			}
			return n.raw
		}
		
		this.decodeStructAccess = function( n ){
			var node = n
			while(node){
				if(node.type == 'Id'){
					// check
					var base = this.resolve(node.name)
					//var marg = this.macro_args[base]
					//if(marg) base = marg.name
					var type = this.scope[base]
					var isthis
					if(typeof type == 'object' && !type.__class__ || (isthis = type = this.type_method)){
						// alright so now we need to walk back down
						// the parent chain and decode our offset
						if(!isthis) node = node.parent
						else base = '_'
						if(type.size == 0) throw new Error("Trying to access member on abstract value")
						var off = 0, field = type
						var idx = ''
						for(;;){
							// if we are doing an index, we have to have an array type
							if(node.index){
								if(node.object.index) throw new Error('Dont support double indexes on structs')
								// we can only support indexes on fields with primitive
								// subtypes or on fields with dimensions.
								if(!field.dim && field.prim) throw new Error('cannot index primitive field')
								if(!field.size) throw new Error('cannot index 0 size field')
								
								// so if we have dim, we want index calcs.
								if(idx!=='') idx += '+'
								if(field.dim) idx += '('+this.expand(node.index, n) + ')*' + (field.size / outer.viewSize[type.view]) 
								else idx += '('+this.expand(node.index, n) + ')'
							}
							else {
								field = field.fields[node.key && node.key.name || node.name]
								if(!field){
									throw new Error('Invalid field')
									return
								}
								off += field.off
							}
							if(node == n) break
							node = node.parent
						}
						// alright so what we can do is actually take the pointer and assign to it
						// minimize the offset
						var dt =  (off / outer.viewSize[type.view])
						var voff = idx
						if(dt){
							if(voff!=='') voff += '+' + dt
							else voff = dt
						}
						else if(voff == '') voff = '0'
						
						if((!node.index || field.dim) && !field.prim){
							n.infer = field
							n.inferptr = 1
							// translate this to a new Array
							this.find_function(n).call_var = 1
							return '('+this.call_tmpvar+'='+base+'.subarray(' + voff + '),'+
								this.call_tmpvar+'.t=module.'+type.name+','+this.call_tmpvar+')'
							//return '{o:' + voff + ', ' + type.arr + ':' + base + '.' + type.arr + '}'
						}
						//return base + '.'+type.arr+'[' + voff+ ']'
						return base + '[' + voff+ ']'
					}
				}
				if(node.type != 'Key' && node.type != 'Index') break
				node.object.parent = node
				node = node.object
			}
		}
		
		this.Index = function( n ){
			var ret = this.decodeStructAccess(n)
			if(ret) return ret
			var obj = n.object
			var object = this.expand(obj, n)
			var object_t = obj.type
			if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
				object = '(' + object + ')'
			
			return object + '[' + this.expand(n.index, n) + ']'
		}
		
		this.Key = function( n ){
			if(n.key.type !== 'Id') throw new Error('Unknown key type')
			var key = n.key
			var obj = n.object
			
			var object = this.expand(obj, n)
			var object_t = obj.type
			
			if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
				object = '(' + object + ')'
			
			// do static memory offset calculation for typed access
			var ret = this.decodeStructAccess(n)
			if(ret) return ret
			
			if(n.exist){
				var tmp = this.alloc_tmpvar(n)
				return '((' + tmp + '=' + object + ') && ' + tmp + '.' + n.key.name + ')'
			}
			return object + '.' + n.key.name
		}
		
		this.ThisCall = function( n ){
			var obj = n.object
			var object_t = obj.type
			var object = this.expand(obj, n)
			if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This' && object_t !== 'ThisCall')
				object = '(' + object + ')'
			
			return  object + '.' + n.key.name
		}
		
		this.Array = function( n ){
			//!TODO x = [\n[1]\n[2]] barfs up with comments
			
			var elems = n.elems
			var elemlen = n.elems.length
			for(var i = 0; i < elemlen; i++){
				if(elems[i].type == 'Rest') break
			}
			
			// do the splat transform
			if(i != elemlen){
				var ret = ''
				var last = 0
				for(var i = 0; i < elemlen; i++){
					var elem = elems[i]
					if(elem.type == 'Rest'){
						// alright so we check what we have.
						if(i == 0){
							var id = elem.id
							if(id === undefined  || id.name == 'arguments'){
								ret = 'Array.prototype.slice.call(arguments,0)'
							}
							else ret = 'Array.prototype.slice.call('+this.expand(id, n)+',0)'
						}
						else{
							if(last == 1) ret += ']'
							else if(last == 2) ret += ')'
							var id = elem.id
							if(id === undefined  || id.name == 'arguments'){
								ret = 'Array.prototype.concat.apply('+ret+','+this.space+'arguments)'
							}
							else{
								ret = 'Array.prototype.concat.apply('+
									ret+','+this.expand(id, n) +')'
							}
						}
						last = 3
					}
					else { // normal arg
						if(last == 0){ // nothing before us
							ret += '['
							last = 1
						}
						else if(last == 3){ // an array before us
							ret += '.concat('
							last = 2
						}
						else { // a normal value
							ret += ',' + this.space
						}
						ret += this.expand(elem, n)
					}
				}
				if(last == 1) ret += ']'
				else if(last == 2) ret += ')'
			}
			else {
				var ret = '['+
					this.list( n.elems, n ) +
				']'
			}
			return ret
		}
		
		this.Enum = function( n ){
			// okay lets convert our enum structure into an object on this.
			// we can accept a block with steps of type assign
			// and a lefthandside of type id
			// right hand side is auto-enumerated when not provided
			
			var name = n.id.name
			
			this.scope[name] = 1
			
			
			var ret = 'var '+name+' = this.'+name+' = '
			
			var fn = this.find_function(n)
			if(fn && fn.root){
				this.module.exports[name] = n
			}
			
			var olddepth = this.depth
			this.depth += this.indent
			ret += '{'
			var elem = n.enums
			if(!elem || !elem.length) return ret + '}'
			ret += this.newline
			
			var last = 0
			for(var i = 0;i<elem.length;i++){
				var item = elem[i]
				var nocomma = i == elem.length - 1
				var name = ''
				
				if(item.id.type == 'Id') name = item.id.name
				else if(item.id.type == 'Value') name = item.id.raw
				
				if(item.init){
					if(item.init.type !== 'Value') throw new Error("Unexpected enum assign")
					last = item.init.value
					ret += this.depth + ''+last+':"' + name + '",'+this.newline
					ret += this.depth + name + ':' + item.init.raw + (nocomma?'':',')+this.newline
				}
				else{
					ret += this.depth + ''+(++last)+':"' + name + '",'+this.newline
					ret += this.depth + name + ':' + (last) + (nocomma?'':',')+this.newline
				}
			}
			ret += olddepth + '}'
			this.depth = olddepth
			return ret
		}
		
		this.Comprehension = function( n ){
			var ret = '(function(){'
			var odepth = this.depth
			this.depth += this.indent
			
			// allocate a tempvar
			var fn = this.find_function( n )
			
			var tmp = this.tmp_prefix
			ret += 'var '+tmp + '=[]' + this.newline
			
			var old_compr = this.compr_assign
			this.compr_assign = tmp +'.push'
			ret += this.depth + this.expand(n.for, n) + this.newline
			ret += this.depth +'return '+tmp
			this.compr_assign = old_compr
			this.depth = odepth
			
			ret += this.newline + this.depth + '}).call(this)'
			return ret
		}
		
		this.Template = function( n ){
			var ret = '"'
			var chain = n.chain
			var len = chain.length
			for(var i = 0; i < len; i++){
				var item = chain[i]
				if(item.type == 'Block'){
					if(item.steps.length == 1 && outer.IsExpr[item.steps[0].type]){
						ret += '"+(' + this.expand(item.steps[0], n) + ')+"'
					}
					// we dont support non expression blocks
					else {
						throw new Error("Statement block in interpolated string not supported")
						ret += this.expand(item, n)
					}
				}
				else {
					if(item.value !== undefined){
						ret += item.value.replace(/\n/g,'\\n').replace(/"/g,'\\"')
					}
				}
			}
			ret += '"'
			return ret
		}
		
		this.If = function( n ) {
			var ret = 'if('
			ret += this.expand(n.test, n)
			ret +=  ')' + this.space
			
			var then = this.expand(n.then, n)
			
			if(n.compr && outer.IsExpr[n.then.type]){
				ret += this.compr_assign + '(' + then +')'
			}
			else ret += then
			
			if(n.else){
				var ch = ret[ret.length - 1]
				if( ch !== '\n' ) ret += this.newline
				ret += this.depth + 'else ' + this.expand(n.else, n)
			}
			return ret
		}
		
		this.For = function( n ){
			var ret ='for(' + this.expand(n.init, n)+';'+
					this.expand(n.test, n) + ';' +
					this.expand(n.update, n) + ')'
			var loop = this.expand(n.loop, n)
			if(n.compr){
				ret += this.compr_assign + '(' + loop + ')'
			}
			else ret += loop
			return ret
		}
		
		// Complete for of polyfill with iterator and destructuring support
		this.ForOf = function( n ){
			// alright we are going to do a for Of polyfill
			var left = n.left
			var isvar
			var value
			// we can destructure the value
			var destruc
			if(left.type == 'Var'){
				isvar = true
				var defs = left.defs
				if(defs.length !== 1) throw new Error('unsupported iterator syntax for for of')
				var id = defs[0].id
				if(id.type == 'Object' || id.type == 'Array') destruc = id
				else value = id.name, this.scope[value] = 1
			}
			else if(left.type == 'Id'){
				value = this.resolve(left.name)
			}
			else if(left.type == 'List'){
				var items = left.items
				var id = defs[p++].id
				if(id.type == 'Object' || id.type == 'Array') destruc = id
				else value = id.name, this.scope[value] = 1
			}
			else if(left.type == 'Object' || left.type == 'Array'){
				destruc = left
			}
			// alright so now what we need to do is make a for loop.
			var result = this.alloc_tmpvar(n)
			var iter = this.alloc_tmpvar(n)
			
			var ret = 'for('
			ret += iter+'=ONE.iterator(' + this.expand(n.right, n) + '),'+result+'=null;' +
					iter+'&&(!'+result+'||!'+result+'.done);){' + this.newline
			
			var od = this.depth
			this.depth += this.indent
			ret += this.depth + result + '=' + iter + '.next()' + this.newline
			// destructure result.value
			if(destruc){
				var vars = []
				var destr = ';'+this.destructure(n, destruc, result+'.value', this.find_function( n ), vars)
				if( isvar ){
					ret += this.depth + 'var '
					for(var i = 0;i<vars.length;i++){
						var name = vars[i].name
						this.scope[ name ] = 1
						if(i) ret += ','
						ret += name
					}
					//ret += this.newline
				}
				ret += destr
			} else {
				ret += this.depth + value + '=' + result + '.value' + this.newline
			}
			this.depth = od
			var loop = this.expand(n.loop, n)
			if( loop[loop.length-1]=='}' ) ret += loop.slice(1,-1) //!todo fix this
			else{
				ret += this.depth+this.indent
				if(n.compr) ret += this.compr_assign+'('+loop+')'
				else ret += loop
				ret += this.newline+this.depth
			}
			ret += '}'
			return ret
		}
		
		// a high perf for over an array, nothing more.
		this.ForFrom = function( n ){
			// we have 2 values to get
			// the value, and the iterator
			var left = n.left
			var isvar
			var iter
			var value
			var alen
			var arr
			if(left.type == 'Var'){
				isvar = true
				var defs = left.defs
				var len = defs.length
				var p = 0
				if(len > 3) throw new Error('unsupported iterator syntax for for from')
				if(len > 2) alen = defs[p++].id.name, this.scope[alen] = 1
				if(len > 1) iter = defs[p++].id.name, this.scope[iter] = 1
				if(len > 0) value = defs[p++].id.name, this.scope[value] = 1
			}
			else if(left.type == 'Id'){
				value = this.resolve(left.name)
			}
			else if(left.type == 'List'){
				var items = left.items
				var len = items.length
				var p = 0
				if(len > 3)  throw new Error('unsupported iterator syntax for for from')
				if(len > 2) alen = this.resolve(items[p++].name)
				if(len > 1) iter = this.resolve(items[p++].name)
				if(len > 0) value = this.resolve(items[p++].name)
			}
			if(!value) throw new Error('No iterator found in for from')
			if(!iter) iter = this.alloc_tmpvar(n)
			if(!alen) alen = this.alloc_tmpvar(n)
			
			arr = this.alloc_tmpvar(n)
			// and then we have to allocate two or three tmpvars.
			// we fetch the
			var ret = 'for('
			if( isvar ) ret += 'var '
			ret += arr + '=' + this.expand(n.right, n) + ',' + alen + '=' + arr + '.length,' +
				iter + '=0,' + value + '=' + arr + '[0];' + iter + '<' + alen + ';' + value + '=' + arr + '[++' + iter + '])'
			var loop = this.expand(n.loop, n)
			
			if(n.compr) ret += this.comp_assign + '(' + loop + ')'
			else ret += loop
			return ret
		}
		
		// a simple for to loop on integers
		this.ForTo = function( n ){
			
			// lets find the iterator
			var left = n.left
			var iter
			if(left.type == 'Var'){
				if(left.defs.length != 1) throw new Error("for to only supports one argument")
				iter = left.defs[0].id.name
			}
			else if(left.type == 'Id'){
				iter = this.resolve(left.name)
			}
			if(left.type == 'Assign'){
				iter = this.resolve(left.left.name)
			}
			else if(left.type == 'List'){
				if(left.items.length != 1) throw new Error("for to only supports one argument")
				iter = this.resolve(left.items[0].name)
			}
			var ret = 'for(' + this.expand(n.left, n) + ';' +
					iter + '<' + this.expand(n.right, n) + ';' + iter + '++)'
			var loop = this.expand(n.loop, n)
			if(n.compr && outer.IsExpr[n.loop.type]){
				ret += this.compr_assign + '(' + loop + ')'
			}
			else ret += loop
			
			return ret
		}
		
		this.ForIn = function( n ){
			var ret = 'for(' + this.expand(n.left, n) + ' in ' +
				this.expand(n.right, n) + ')'
			var loop = this.expand(n.loop, n)
			if(n.compr && outer.IsExpr[n.loop.type]){
				ret += this.compr_assign +'('+ loop + ')'
			}
			else ret += loop
			
			return ret
		}
		
		this.TypeVar = function( n ){
			var name = n.kind.name
			if(name == 'signal'){
				var ret = ''
				var defs = n.defs
				var len = defs.length
				for( var i = 0; i < len; i++ ){
					var def = defs[i]
					def.parent = n
					if(i) ret += this.newline + this.depth
					ret += 'this.signal("' + def.id.name + '"'
					if(def.init) ret += ',' + this.expand(def.init, def)
					ret += ')'
				}
				return ret
			}
			if(name == 'import'){
				var ret = ''
				var defs = n.defs
				var len = defs.length
				ret += 'var '
				for(var i = 0; i < len; i++){
					var def = defs[i]
					// lets fetch the module
					var name = def.id.name
					ret += name
					ret += ' = this.import("' + name + '")'
					this.scope[name] = 1
					// now lets iterate all the vars
					var module = modules[name]
					if(!module) throw new Error("Module " + name + " not found")
					this.module.imports.push(module)
					var exports = module.exports
					for(var e in exports){
						ret += ', '+ e + ' = ' + name + '.' + e
						this.scope[e] = exports[e]
					}
				}
				ret += this.newline
				return ret
			}
			return 'var ' + this.flat( n.defs, n )
			
			throw new Error("implement TypeVar")
		}
		
		this.Def = function( n ){
			// destructuring
			if(n.id.type == 'Array' || n.id.type == 'Object'){
				var vars = []
				var ret = this.destructure(n, n.id, n.init, this.find_function( n ), vars)
				
				var pre = ''
				for(var i = 0; i < vars.length; i++){
					this.scope[ vars[i].name ] = 1
					if(i) pre += ','+this.space
					pre += this.expand(vars[i], n)
				}
				return pre + ',' + this.space + this.destruc_prefix + '0=' + ret
			}
			else if(n.id.type !== 'Id') throw new Error('Unknown id type')
			
			if(n.dim !== undefined) throw new Error('Dont know what to do with dimensions')
			
			var type
			if(n.parent.type == 'TypeVar'){
				
				var kind = n.parent.kind
				var name
				if(kind.type == 'Index'){
					name = kind.object.name
					type = this.find_type(name)
					if(!type) throw new Error('Cannot find type ' + name)
					type = Object.create(type)
					type.dim = 1
				}
				else{
					name = kind.name
					type = this.find_type(name)
					if(!type) throw new Error('Cannot find type ' + name)
				}
			}
			else if(n.id.kind ){
				type = this.find_type(n.id.kind.name)
				if(!type) throw new Error('Cannot find type ' + n.id.kind.name)
			}
			else type = 1
			this.scope[n.id.name] = type
			
			// if we have a type, we need to check the init call to be a constructor.
			return this.expand(n.id, n) +
				(n.init ? this.space+'='+this.space + this.expand(n.init, n) : '')
		}
		
		this.Define = function( n ){
			// its a macro function
			if(n.id.type == 'Function'){
				var name = n.id.name.name
				var macros = this.module.macros
				while(name in macros){
					name = name + '_'
				}
				macros[name] = n
			}
			// its a macro expression
			if(n.id.type == 'Call'){
				var name = n.id.fn.name
				var macros = this.module.macros
				while(name in macros){
					name = name + '_'
				}
				macros[name] = n
			}
			// its a macro value
			else {
				var name = n.id.name
				this.module.defines[name] = n.value
			}
			return ''
		}
		
		this.Struct = function( n ){
		
			var name = n.id.name
			
			//if(this.typelib[name]) throw new Error('Cant redefine type ' + n.id.name)
			
			// in a baseclass we copy the fields and methods
			var type = this.module.types[name] = {}
			
			type.name = name
			if(n.base){
				var base = type.base = this.find_type(n.base.name)
				if(!base) throw new Error('Struct base '+n.base.name+' undefined ')
				// lets copy the fields
				type.fields = Object.create(base.fields || null)
				type.methods = Object.create(base.methods || null)
				type.construct = Object.create(base.construct || null)
				type.size = base.size
				type.view = base.view
			}
			else {
				type.fields = {}
				type.methods = {}
				type.construct = {}
				type.size = 0
				type.view = undefined
			}
			
			var steps = n.struct.steps
			for(var i = 0, steplen = steps.length; i < steplen; i++){
				var step = steps[i]
				
				// this one adds a field to a struct
				if(step.type == 'TypeVar'){
					// lets fetch the size
					var kind = step.kind
					var typename
					var arraydim
					// float[10] x array defs
					if(kind.type == 'Index'){
						typename = kind.object.name
						arraydim = kind.index && kind.index.value
						if(!arraydim) throw new Error('need array dimensions on type')
					}
					else if(kind.type == 'Id'){
						typename = kind.name
					}
					else throw new Error('Unknown type-kind in struct')
					
					var field = this.find_type(typename)
					
					if(!field) throw new Error('Cant find type ' + step.kind.name )
					// lets add all the defs as fields
					var defs = step.defs
					for(var j = 0, deflen = defs.length; j < deflen; j++){
						var def = defs[j]
						// create field
						var name = def.id.name
						if(name in type.fields) throw new Error('Cant redefine field ' + name)
						var cpy = type.fields[name] = Object.create(field)
						cpy.off = type.size
						cpy.dim = arraydim
						type.size += field.size * (arraydim || 1)
						
						if(type.view === undefined){
							type.view = field.view
							//type.arr = field.arr
						}
						else if(type.view !== field.view){
							throw new Error('Dont support mixed type structs yet in JS')
							type.view = 0
						}
					}
				}
				// this one adds a method
				else if(step.type == 'Function'){
					// store the function on the struct
					var name = step.name.name
					var store = type.methods
					if( name == type.name ) store = type.construct
						while(name in store) name = name + '_'
						store[name] = step
				}
				else {
					throw new Error('Cannot use ' + step.type + ' in struct definition')
				}
			}
			type.slots = type.size / outer.viewSize[type.view]
			
			//if(type.size == 0) throw new Error('Cannot make size 0 structs')
			return ''
		}
		
		this.Class = function( n ){
			
			var base = n.base?this.expand(n.base, n):'this.Base'
			var name = n.id.name
			
			var fn = this.find_function(n)
			if(fn.root){
				// export the class
				this.module.exports[name] = n
			}
			
			this.scope[name] = 2
			var ret = 'var ' + name + ' = this.' + name +
					' = ' + base + '.extend(this,'+
					this.Function( n, null, ['outer'] ) +
					', "' + name + '")'
			return ret
		}
		
		this.Function = function( n, nametag, extparams, type_method ){
			if(n.id) this.scope[n.id.name] = 1
			// make a new scope
			var scope = this.scope
			this.scope = Object.create( scope )
			scope.__sub__ = this.scope
			
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
			if(n.rest){
				if( n.rest.id.type !== 'Id' ) throw new Error('Unknown id type')
				var name = n.rest.id.name
				this.scope[name] = 1
				if(plen)
					str_body += this.depth + 'var '+name+' = arguments.length>' + plen + '?' +
					'Array.prototype.slice.call(arguments,' + plen + '):[]' + this.newline
				else
					str_body += this.depth + 'var '+name+' = Array.prototype.slice.call(arguments,0)' + this.newline
			}
			if(typeof type_method == 'object'){
				this.scope['_'] = type_method
				str_param += '_'
			}
			// do init
			if(plen){
				var split = ',' + this.space
				for(var i = 0;i<plen;i++){
					var param = params[i]
					param.parent = n
					
					// destructuring arguments
					if(param.id.type == 'Array' || param.id.type == 'Object'){
						var vars = []
						var tmp = this.desarg_prefix+i
						var dest = this.destructure(n, param.id, param.init, n, vars, tmp) + this.newline
						
						var vardef = ''
						for(var v = 0;v<vars.length;v++){
							var id = vars[v]
							if(id.flag !== 64){
								this.scope[ id.name ] = 1
								if(vardef) vardef += ',' +this.space
								vardef += id.name
							}
						}
						str_body += this.depth + 'var ' + vardef
						str_body += (vardef?','+this.space:'')+this.destruc_prefix+'0=' + dest
						str_param +=  (str_param?split:'') + tmp
					}
					else {
						var name = param.id.name
						str_param += (str_param?split:'') + name //name
						if( str_param[str_param.length - 1] == '\n' ) str_param += this.depth
						if(param.init){
							str_body += this.depth + 'if(' + name + '===undefined)' + name + '=' + this.expand(param.init, param) + this.newline
						}
						if(param.id.flag == 64){
							str_body += this.depth + 'this.' + name + '=' + name + ';' + this.newline
						}
						else {
							var kind = param.id.kind
							if(kind){
								var kname
								if(kind.type == 'Index') kname = kind.object.name
								else kname = kind.name
								
								var type = this.find_type(kname)
								
								if(!type) throw new Error("Undefined type "+kname+" used on argument "+name)
								this.scope[name] = type
							}
							else this.scope[name] =  1
						}
					}
				}
			}
			if(extparams){
				var split = ','+this.space
				var exlen = extparams.length
				for(var i = 0;i<exlen;i++){
					var name = extparams[i]
					this.scope[name] = 1
					if(str_param) str_param += split
					str_param += name
				}
			}
			
			// expand the function
			if(n.body.type == 'Block'){
				var steps = n.body.steps
				n.body.parent = n
				// we can do a simple wait transform
				str_body += this.block( n.body.steps, n.body, 1 )
			}
			else str_body += this.depth + 'return ' + this.expand(n.body, n)
			
			// Auto function to this bind detection
			var bind = false
			if(n.arrow === '=>' || (n.parent && n.parent.extarg && !n.arrow)) bind = true
			var ret = ''
			var isvarbind
			var isgetset
			if(n.name){
				if(n.name.name == 'bind' && !n.name.flag){
					ret += '('
					isvarbind = true
				}
				else {
					var kind = n.name.kind
					if(kind && (kind.name == 'get' || kind.name == 'set')){
						if(kind.name == 'get') ret += 'this.__defineGetter__("'
						else ret += 'this.__defineSetter__("'
						ret += n.name.name + '",'
						isgetset = true
					}
					else if(!type_method){
						var fn = this.find_function(n.parent)
						if(fn && fn.root){
							// export the method
							this.module.exports[name] = n
						}
						ret += this.expand(n.name, n) + this.space + '=' + this.space
						//console.log(ret)
					}
				}
			}
			
			if(n.await) ret = ret  + 'ONE.await('
			
			ret += 'function'
			
			if(n.gen || n.auto_gen) ret += '*'
			if( nametag === null ) ret += ''
			else if( nametag ) ret += ' '+nametag
			else if(n.id){
				if(n.gen || n.auto_gen){
					ret = 'var ' + this.expand(n.id, n) + ' = ' + ret
				}
				else ret += ' '+this.expand(n.id, n)
			}
			
			if( !str_param ) str_param = ''
			ret += '(' + str_param + '){'
			
			var tmp = ''
			
			if( n.destruc_vars ){
				for(var i = 0;i<n.destruc_vars;i++){
					if(tmp) tmp += ','+this.space
					tmp += this.destruc_prefix + i
				}
			}
			if( n.tmp_vars ){
				for(var i = 0;i<n.tmp_vars;i++){
					if(tmp) tmp += ','+this.space
					tmp += this.tmp_prefix + i
				}
			}
			
			if( n.store_var ){
				if(tmp) tmp += ','+this.space
				tmp += this.store_prefix
			}
			
			if( n.call_var ){
				if(tmp) tmp += ','+this.space
				tmp += this.call_tmpvar
			}
			
			if(tmp){
				ret += 'var ' + tmp + this.newline
			}
			else ret += this.newline
			
			this.depth = olddepth
			this.scope = scope
			
			ret += str_body + this.depth
			
			//if( ret[ret.length - 1] != '\n') ret += this.newline + this.depth
			
			if(typeof type_method == 'object'){
				ret += this.depth+this.indent+'return _'+this.newline + this.depth
			}
			
			ret += '}'
			if( n.await ){
				if( bind ) ret += ',this'
				ret += ')'
			}
			else if( bind ) ret += '.bind(this)'
			if(isgetset) ret += ')'
			if(isvarbind){
				ret += ').call(this'
				for(var i = 0; i < plen;i ++){
					ret += ',' + this.resolve( params[i].id )
				}
				ret += ')'
			}
			
			return ret
		}
		
		this.find_function = function( n ){
			var p = n.parent
			while(p){
				if(p.type == 'Nest') return p
				if(p.type == 'Class') return p
				if(p.type == 'Function') return p
				if(p.root) console.log(p)
				p = p.parent
			}
		}
		
		this.alloc_tmpvar = function( n ){
			var fn = n.tmp_fn || (n.tmp_fn = this.find_function(n))
			if(!fn.tmp_vars) fn.tmp_vars = 0
			return this.tmp_prefix + (fn.tmp_vars++)
		}
		
		this.Yield = function( n ){
			var fn = this.find_function( n )
			if(!fn) throw new Error('Yield cannot find enclosing function')
			fn.auto_gen = 1
			return 'yield' + (n.arg ? ' ' + this.expand(n.arg, n):'')
		}
		
		this.Await = function( n ){
			var fn = this.find_function( n )
			if(!fn) throw new Error('Await cannot find enclosing function')
			fn.auto_gen = 1
			fn.await = 1
			return 'yield'+ (n.arg ? ' ' + this.expand(n.arg, n):'')
		}
		
		this.Update = function( n ){
			var ret
			if( n.prefix ) ret = n.op + this.expand(n.arg, n)
			else {
				if( n.op === '!') throw new Error("Postfix ! not implemented")
				if(n.op ==='~'){
					ret = 'ONE.trace('+this.expand(n.arg, n) + ')'
				}
				else ret = this.expand (n.arg, n) + n.op
			}
			return ret
		}
		
		this.Signal = function( n ){
			
			if(n.left.type != 'Id') throw new Error('Signal assign cant use left hand type')
			
			var id = n.left.name
			if(this.scope[id]) throw new Error('Implement signal assign to local vars')
			
			var ret
			
			ret = 'this.signal("'+id+'",'
			
			// and it also supports local vars
			// we need to check for % vars and pass them into parse.
			var esc = outer.ToEscaped
			var tpl = esc.templates = {}
			var locals = esc.locals = {}
			
			// if we have a variable in scope, we need to bind the expression to it
			esc.scope = this.scope
			
			esc.depth = this.depth
			var body = esc.expand(n.right, n)
			
			// cache the AST for parse()
			parserCache[body] = n.right
			
			var obj = ''
			for( var name in tpl ){
				if(obj) obj += ','
				obj += name+':'+(name in this.scope?name:'this.'+name)
			}
			var localstr = ''
			for( var local in locals ){
				if(local) obj += ','
				localstr += name+':'+name
			}
			
			ret +=  'this._parse("' + body + '",module'
			if( localstr ) ret += ',{' + localstr + '}'
			if( obj ){
				if(!localstr) ret += ',null'
				ret += ',{' + obj + '}'
			}
			ret += '))'
			
			return ret
		}
		
		this.Assign = function( n ){
			var ret = ''
			if(n.op == '?='){
				var left = this.expand(n.left, n)
				ret = '(' + left + '===undefined?(' + left + '='+this.expand(n.right, n) + '):' + left + ')'
			}
			else if(n.left.type == 'Object' || n.left.type == 'Array'){
				return this.destructure(n, n.left, n.right, this.find_function( n ))
			}
			else if(n.left.type == 'Id' || n.left.type == 'Key' || n.left.type == 'Index'){
				var left = this.expand(n.left, n, false)
				if(n.left.onthis){
					var fn = this.find_function(n)
					if(fn.root){
						this.module.exports[n.left.name] = n
					}
				}
				// so what operator are we?
				if(n.left.inferptr){ // we are an assign to a struct type
					// we need to know what the rhs is.
					n.right.assign_type = n.left.infer
					n.right.assign_left = left
					n.right.assign_op = n.op
					var right = this.expand(n.right, n)
					// lhs not consumed by rhs (constructor calls do that)
					if(n.right.assign_left){
						if(!n.right.infer || n.right.infer.slots != n.left.infer.slots)
							throw new Error('Incompatible types in assignment')
						
						// do a structure copy
						// allocate tempvars
						var func = this.find_function(n)
						if(!func.type_nesting) func.type_nesting = 2
						else func.type_nesting += 2
						
						if(!func.destruc_vars || func.type_nesting+1 > func.destruc_vars)
							func.destruc_vars = func.type_nesting
						
						var tmp_l = this.destruc_prefix + (func.destruc_vars - 2)
						var tmp_r = this.destruc_prefix + (func.destruc_vars - 1)
						var nslots = n.left.infer.slots
						//var arr = n.left.infer.arr
						var ret = '(' + tmp_l + '=' + left + ',' + tmp_r + '=' + right
						for(var i = 0;i<nslots;i++){
							//ret += ',' + tmp_l + '.' + arr + '[' + tmp_l +'.o+'+ i + ']'+
							//	n.op + tmp_r + '.' + arr + '[' + tmp_r +'.o+'+ i + ']'
							ret += ',' + tmp_l + '[' + i + ']'+
								n.op + tmp_r + '[' + i + ']'
							
						}
						func.type_nesting -=2
						ret += ','+tmp_r+')'
					}
					else {
						ret = right
					}
				}
				else {
					ret += left
					if(ret[ret.length - 1] == '\n') ret += this.indent + this.depth
					ret += this.space + n.op + this.space + this.expand(n.right, n)
				}
			}
			else {
				ret = 'this[' + this.expand(n.left, n) + ']' + this.space + n.op +
					this.space + this.expand(n.right, n)
			}
			return ret
		}

		this.bin_op_table = {
			'*':'mul'
		}

		this.Binary = function( n ){
			var ret
			var leftstr
			
			// lets check types
			if(n.left.infer && n.left.infer.slots > 1 || 
			   n.right.infer && n.right.infer.slots > 1){
			   	// alright so, we have
				var left_t = n.left.infer
				var right_t = n.right.infer
				var left_name = left_t.name
				var right_name = right_t.name
				var name = this.bin_op_table[n.op]
				var type = this.find_type(left_name)
				if(!name) throw new Error('operator '+n.op+' not supported for type '+left_name)
				// operators are static struct calls
				return this.struct_method(n, type, left_name +'_'+ name + '_' + right_name, [n.left, n.right])
			}
			var left = this.expand(n.left, n)
			var right = this.expand(n.right, n)
			var left_t = n.left.type
			var right_t = n.right.type
			
			// obvious string multiply
			if(n.op == '*' && (((leftstr=left_t == 'Value' && n.left.kind == 'string'))||
				(right_t == 'Value' && n.right.kind == 'string'))){
				if(leftstr) return 'Array(' + left + ').join(' + right + ')'
				return 'Array(' + left + ').join(' + right + ')'
			} // mathematical modulus
			
			if(n.op == '%%') return 'Math._mod(' + left + ',' + right + ')'
			// floor division
			if(n.op == '%/') return 'Math.floor(' + left + '/' + right + ')'
			// pow
			if(n.op == '**') return 'Math.pow(' + left + ',' + right + ')'
			
			// normal binop
			if(left_t == 'Assign' || left_t == 'List' || left_t == 'Condition' ||
				(left_t == 'Binary' || left_t == 'Logic') && n.left.prio < n.prio)
				left = '(' + left + ')'
			
			if(right_t == 'Assign' || right_t == 'List' || right_t == 'Condition' ||
				(right_t == 'Binary' || right_t == 'Logic') &&  n.right.prio < n.prio)
				right = '(' + right + ')'
			
			return left + this.space + n.op + this.space + right
		}
		
		this.Logic = function( n ){
			var left = this.expand(n.left, n)
			var right = this.expand(n.right, n)
			var left_t = n.left.type
			var right_t = n.right.type
			
			if(left_t == 'Assign' || left_t == 'List' || left_t == 'Condition' ||
				(left_t == 'Binary' || left_t == 'Logic') && n.left.prio < n.prio)
				left = '(' + left + ')'
			
			if(right_t == 'Assign' || right_t == 'List' || right_t == 'Condition' ||
				(right_t == 'Binary' || right_t == 'Logic') &&  n.right.prio < n.prio)
				right = '(' + right + ')'
			
			if(n.op == '?|'){
				if(n.left.type == 'Id') return '(' + left + '!==undefined?' + left + ':' + right + ')'
			
				var tmp = this.alloc_tmpvar(n)
				return '((' + tmp + '=' + left + ')!==undefined?' + tmp + ':' + right + ')'
			}
			return left + this.space + n.op + this.space + right
		}
		
		this.Unary = function( n ){
			var arg = this.expand(n.arg, n)
			var arg_t = n.arg.type
			
			if( n.prefix ){
				if(arg_t == 'Assign' || arg_t == 'Binary' || arg_t == 'Logic' || arg_t == 'Condition')
					arg = '(' + arg + ')'
				
				if(n.op == '?') return arg +'!==undefined'
				if(n.op.length != 1) return n.op + ' ' + arg
				return n.op + arg
			}
			return arg + n.op
		}
		
		// convert new
		this.New = function( n ){
			var fn = this.expand(n.fn, n)
			var fn_t = n.fn.type
			if(fn_t == 'Assign' || fn_t == 'Logic' || fn_t == 'Condition')
				fn = '(' + fn + ')'
			
			if(this.globals[fn]){
				var arg = this.list(n.args, n)
				return 'new ' + fn + '(' + arg + ')'
			}
			// forward to Call
			// WARNING we might have double calls if you fetch
			// the class via functioncall.
			n.isnew = true
			return this.expand(n, n.parent, 'Call')
			//return this.Call( n, undefined, undefined, true )
			//return  fn + '.new(this'+(arg?', '+arg:arg)+')'
		}
		
		// struct method call
		this.struct_method = function(n, type, method_name, args, sthis){

			var method = type.methods[method_name]
			while(method){
				//!TODO add type checking here
				if(method.params.length == args.length) break
				method_name = method_name + '_'
				method = type.methods[method_name]
			}
			if(!method) throw new Error('No overload found for '+method_name)
			
			var gen = type.name + '_' + method_name
			// lets make a name from our argument types
			for(var i = 0, l = method.params.length; i < l; i++){
				var kind = method.params[i].id.kind
				gen += '_'+(kind && kind.name || 'var')
			}

			// make a type_method
			if(!this.type_methods[gen]){
				var d = this.depth
				this.depth = ''
				var t = this.type_method
				this.type_method = type
				this.type_methods[gen] = this.Function(method, gen, undefined, type ) + this.newline
				this.type_method = t
				this.depth = d
			}
			
			var ret = ''
			ret += gen+'.call(this'
			if(!sthis){
				// lets allocate a tempvar
				this.find_function(n).call_var = 1
				this.module[type.name] = type
				var alloc = 'new ' + type.view + 'Array(' + type.slots + ')'
				if(this.store_tempid){
					var store = 'this.struct_' + (this.store_tempid++)
					alloc = store + '||(' + store + '=' + alloc + ')'
				}
				ret +=',(' + this.call_tmpvar+'= '+alloc+',' +
					this.call_tmpvar + '.t=module.' + type.name + ',' + this.call_tmpvar + ')'
				//ret += ',{o:0,t:module.'+type.name+','+type.arr+':new ' + type.view + 'Array(' + type.slots + ')}'
			}
			else ret += ', ' + sthis.name
			
			// set up the call and argument list
			for(var i = 0, l = args.length; i < l; i++){
				var arg = args[i]
				ret += ', ' + this.expand(arg, n)
				if(arg.type == 'Rest') throw new Error('... is not supported in typed calls')
			}
			ret += ')'
			return ret
		}
		
		this.struct_constructor = function( n, dims, args, type ){
			// allocate tempvars
			var func = this.find_function(n)
			if(!func.type_nesting) func.type_nesting = 1
			else func.type_nesting ++
			
			if(!func.destruc_vars || func.type_nesting > func.destruc_vars)
				func.destruc_vars = func.type_nesting
			
			var output = this.destruc_prefix + (func.destruc_vars - 1)
			
			var nslots = type.slots
			var ret
			var op = '='
			var off
			// consume a targetptr
			if(n.assign_left){
				ret = '('+output+' = '+n.assign_left
				//off = 1
				n.assign_left = undefined
				op = n.assign_op
			}
			else{
				// store the type on our module for quick reference
				this.module[type.name] = type
				ret = '('+output+'= new '+type.view+'Array('
				
				//ret = '('+output+'= {o:0,t:module.'+type.name+','+type.arr+':new '+type.view+'Array('
				//if(dims) ret += '(' + this.expand(dims, n) + ')*' + nslots + ')}'
				//else ret += nslots + ')}'
				
				if(dims) ret += '(' + this.expand(dims, n) + ')*' + nslots + ')'
				else ret += nslots + ')'
				ret += ',' + output + '.t = module.' + type.name
			}
			var slot = 0

			function walker(elem, n, issingle, type){
				// we have a call
				var ntype
				if(elem.type == 'Call' && elem.fn.type == 'Id' && (ntype = this.find_type(elem.fn.name))){
					if(ntype.view != type.view) throw new Error('Constructor args with different viewtypes are not supported')
					// we have to walk the arguments until we hit individual values
					var args = elem.args
					for(var i = 0, l = args.length; i<l; i++){
						walker.call(this, args[i], elem, l  == 1, ntype)
					}
				}
				// write directly
				else if(elem.type == 'Value'){
					var val = this.expand(elem, n)
					ret += ','
					for(var i = 0, l = issingle?type.slots:1; i < l; i++){
						//ret += output+'.'+type.arr+'['
						//if(off) ret += output+'.o+'
						
						ret += output+'['+ (slot++) +']'+op
					}
					ret += val
				}
				// expand to a var, and decide wether it is compound or primtive.
				else {
					var val = this.expand(elem, n)
					if(!val.infer || !val.infer.methods){ // well assume its a single val
						ret += ','
						for(var i = 0, l = issingle?type.slots:1; i < l; i++){
							//ret += output+'.'+type.arr+'['
							//if(off) ret += output+'.o+'
							ret += output+'[' + (slot++) +']' + op
						}
						ret += val
					}
					else {
						throw new Error('compound error thing')
					}
				}
			}
			for(var i = 0,l = args.length; i < l; i++ ){
				walker.call(this, args[i], n, l == 1, type)
			}
			if(slot%nslots) throw new Error('Incorrect number of fields used in '+name+'() constructor, got '+slot+' expected (multiple of) '+nslots)
			func.type_nesting--
			
			ret += ','+output+')'
			
			n.infer = type
			
			return ret
		}

		this.macro_match_args = function( n, name, body, args ){
			// now we need to expand the args to do the type inference.
			if(!args.expanded){
				var exp = args.expanded = []
				for(var i = 0, l = args.length; i<l; i++){
					exp[i] = this.expand(args[i], n)
				}
			}

			var params
			if(body.type == 'Function') params = body.params
			else if(body.type == 'Call') params = body.args
			if(!params) return
			// match length
			if(params.length !== args.length) return
			var generics = Object.create(null)
			for(var i = 0, l = params.length; i<l; i++){
				var param = params[i]
				var kind
				if(param.type == 'Def') kind = param.id.kind
				else kind = param.kind
				if(kind){
					var infer = args[i].infer
					if(!infer) return
					// what if kind.name == 'T'
					var ch
					var name = kind.name
					if(name.length == 1 && (ch = name.charCodeAt(0)) >= 65 && ch <= 90 ){ // generics
						// lets store kind on our 
						var prev = generics[name]
						if(prev){
							if(prev.name != infer.name) return
						}
						else generics[name] = infer
					}
					else if(infer.name != name) return
				}
			}

			return generics
		}
		
		// lets pattern match 
		this.find_macro = function( n, name, args ){
			var macro
			var found
			
			if(this.context){ // support for context macros
				var obj = this.context[name]
				if(obj && obj.value && obj.value._ast_){
					var ret
					if(ret = this.macro_match_args(n, name, obj.value, args)) return [obj.value, ret]
					found = true
				}
			}
			
			var nm = name
			var macros = this.module.macros
			macro = macros[nm]
			while(macro){
				macro.id.parent = macro
				var ret
				if(ret = this.macro_match_args(n, name, macro.id, args)) return [macro.id, ret]
				found = true
				nm = nm + '_'
				macro = macros[nm]
			}

			var im = this.module.imports
			for(var i = 0, l = im.length; i < l; i++){
				var macros = im[i].macros
				if(macros && (macro = macros[name])){
					var nm = name
					while(macro){
						macro.id.parent = macro
						var ret
						if(ret = this.macro_match_args(n, name, macro.id, args)) return [macro.id, ret]
						found = true
						nm = nm + '_'
						macro = macros[nm]
					}
				}
			}
			if(found) throw new Error('Macro '+name+' used but not matching any arg types')
		}

		this.macro_call = function( n, name, args ){
			
			var ret
			args.expanded = undefined
			if(ret = this.find_macro(n, name, args)){
				// lets check type
				var macro = ret[0], macro_generics = ret[1]
				if(macro.type == 'Function'){
					var params = macro.params
					var gen = 'macro_' + name
					for(var i = 0, l = params.length; i < l; i++){
						var kind = params[i].id.kind
						gen += '_'+(kind && kind.name || 'var')
					}
					if(!this.type_methods[gen]){
						var old_depth = this.depth
						var old_scope = this.scope
						var old_arg = this.macro_args
						var old_generics = this.generics
						this.macro_args = undefined
						this.scope = Object.create(null)
						this.depth = ''
						this.generics = macro_generics
						this.type_methods[gen] = this.Function(macro, gen, undefined, true)
						this.depth = old_depth
						this.scope = old_scope
						this.macro_args = old_arg
						this.generics = old_generics
					}
					var ret = gen + '.call(this'
					// set up the call and argument list
					var exp = args.expanded
					for(var i = 0, l = exp.length; i < l; i++){
						ret += ', ' + exp[i]
					}
					ret += ')'
					return ret
				}
				else if(macro.type == 'Call'){
					// inline macro expansion
					var old_arg = this.macro_args
					var marg = this.macro_args = Object.create(this.macro_args || null)
					var params = macro.args
					// build up macro args
					for(var i = 0; i < params.length; i++){
						var param = params[i]
						if(param.type == 'Assign'){
							throw new Error('implement macro default arg')
						}
						this.macro_args[param.name] = args.expanded[i]
					}
					var old_module = this.module
					var old_generics = this.generics
					this.generics = macro_generics
					if(macro.module && macro.module != old_module) this.module = macro.module
					var ret = this.expand(macro.parent.value, n)
					this.macro_args = old_arg
					this.module = old_module
					this.generics = old_generics
					return ret
				}
				else throw new Error('Macro call, but wrong type '+name+' '+macro.id.type)
			}
		}
		
		this._compile_assert = function( n ){
			var argl = n.args
			if(!argl || argl.length == 0 || argl.length > 2) throw new Error("Invalid assert args")
			
			var arg = this.expand(argl[0], n)
			var msg = argl.length > 1? this.expand(argl[1], n): '""'
			var value = 'undefined'
			
			if(argl[0].type == 'Logic' && argl[0].left.type !== 'Call'){
				value = this.expand( argl[0].left, n )
			}
			
			var body = '(function(){throw new Assert("'+
				arg.replace(/"/g,'\\"').replace(/\n/g,'\\n')+'",'+
				msg+','+value+')}).call(this)'
			
			if(outer.IsExpr[n.parent.type] && argl[0].type == 'Logic'){
				return arg + ' || ' + body
			}
			return '(('+arg+') || '+body+')'
		}
		
		this.Call = function( n ){//, extra, pre, isnew ){
			var fn  = n.fn
			fn.parent = n
			// assert macro
			var mname
			if(fn.type == 'Id' && (mname = '_compile_'+fn.name) in this){
				return this[mname](n)
			}
			
			var args = n.args
			
			// add extra args for processing
			//if(n.first_args) args = Array.prototype.concat.apply(n.first_args, args)
			//if(n.last_args) args = Array.prototype.concat.apply(args, n.last_args)
			if(n.isnew) args = Array.prototype.concat.apply(['this'], args)
			
			var arglen = args.length
			
			if(fn.type == 'Id' || fn.type == 'Index'){
				
				var name
				var dims
				if(fn.type == 'Index'){
					name = fn.object.name
					// dims might be dynamic
					dims = fn.index
				}
				else name = fn.name
				// we support auto-super also for roles.
				// lets check if we are a type constructor
				var type = this.find_type(name)
				if(type) return this.struct_constructor(n, dims, args, type)
				
				// check if its a macro
				var macro_call = this.macro_call(n, name, args)
				if(macro_call !== undefined) return macro_call
				
				if(name == 'super'){
					if(args){
						args = args.slice(0)
						args.unshift('arguments')
					}
					else args = ['arguments']
					arglen = args.length
				}
			}
			
			// new or extend
			if(fn.type == 'Key'){
				// check if we are a property access on a
				// what we need to trace is the root object
				var sthis = fn.isKeyChain()
				if(sthis && sthis.name){
					var isstatic
					var type = this.scope[sthis.name] || (isstatic = this.find_type(sthis.name))
					if(typeof type == 'object' && !type._ast_){
						// alright we are a method call.
						if(fn.object.type !='Id') throw new Error('only 1 deep method calls for now')
						// so first we are going to compile the function
						var method = fn.key.name
						
						return this.struct_method(n, type, method, args, isstatic?undefined:sthis)
					}
				}
				
				if(fn.key.type == 'Id'){
					var name = fn.key.name
					if(name == 'new' || name == 'extend' ){
						if(args){
							args = args.slice(0)
							args.unshift('this')
						}
						else args = ['this']
					}
					// else dont mess with it
					else if(name == 'call' || name == 'apply' || name == 'bind'){
						return this.expand(n.fn, n) + '(' + this.list(n.args, n) + ')'
					}
				}
			}
			
			var isapply = false
			var sarg = ''
			if(arglen){
				for(var i = 0; i < arglen; i++){
					if(args[i].type == 'Rest') break
				}
				// do the splat transform
				if(i != arglen){
					isapply = true
					var last = 0
					for(var i = 0; i < arglen; i++){
						var arg = args[i]
						if(arg.type == 'Rest'){
							if(i == 0){ // is first arg
								if(arglen == 1){ // we are the only one
									var id = arg.id
									if(id === undefined  || id.name == 'arguments'){
										sarg = 'arguments'
									}
									else sarg = this.expand(id, n)
								}
								else{
									var id = arg.id
									if(id === undefined  || id.name == 'arguments'){
										sarg = 'Array.prototype.slice.call(arguments,0)'
									}
									else sarg = this.expand(id, n)
								}
							}
							else{
								if(last == 1) sarg += ']'
								else if(last == 2) sarg += ')'
								var id = arg.id
								if(id === undefined  || id.name == 'arguments'){
									sarg = 'Array.prototype.concat.apply(' + sarg + ', arguments)'
								}
								else{
									sarg = 'Array.prototype.concat.apply('+
										sarg + ',' + this.space + this.expand(id, n) +')'
								}
							}
							last = 3
						}
						else { // normal arg
							if(last == 0){ // nothing before us
								sarg += '['
								last = 1
							}
							else if(last == 3){ // an array before us
								sarg += '.concat('
								last = 2
							}
							else { // a normal value
								sarg += ',' + this.space
							}
							if(typeof arg == 'string') sarg += arg
							else sarg += this.expand(arg, n)
						}
					}
					if(last == 1) sarg += ']'
					else if(last == 2) sarg += ')'
				}
				else {
					for(var i = 0; i < arglen; i++){
						if(i) sarg += ',' + this.space
						var arg = args[i]
						if(typeof arg == 'string') sarg += arg
						else sarg += this.expand(arg, n)
					}
				}
			}
			
			// so if we are a single Id, we call using .call(this')
			var cthis = ''
			var call = ''
			var fastpath
			if(fn.type == 'Id'){
				cthis = 'this'
				call = this.expand(fn, n)
			}
			else {
				// check if we are a property chain
				if(fn.type == 'Key' || fn.type == 'Index'){
					if(fn.isKeyChain()){
						// check if we are doing some native access
						// no tempvar
						cthis = this.expand(fn.object, fn)
						if(this.globals[cthis] || cthis == 'gl') fastpath = 1
						if(fn.type == 'Index') call = cthis + '[' + this.expand(fn.index, fn) + ']'
						else{
							var name = fn.key.name
							if(name in String.prototype) fastpath = 1
							if(name in Array.prototype) fastpath = 1
							if(name in Object.prototype) fastpath = 1
							call = cthis + '.' + name
						}
					}
					else { // we might be a chain on a call.
						// use a tempvar for the object part of the key
						this.find_function(n).call_var = 1
						cthis = this.call_tmpvar
						call = '('+this.call_tmpvar+'=' + this.expand(fn.object, fn) + ')'
						if(fn.type == 'Index') call +=  '[' + this.expand(fn.index, fn) + ']'
						else call += '.' + fn.key.name
					}
				}
				else if(fn.type == 'ThisCall'){
					cthis = 'this'
					call = this.expand(fn, n)
				}
				else{
					cthis = 'this'
					call = this.expand(n.fn, n)
					var ftype = n.fn.type
					if(ftype == 'Assign' || ftype == 'Logic' || ftype == 'Condition')
						call = '(' + call + ')'
				}
			}
			if(n.isnew){
				cthis = call
				call += '.new'
			}
			
			if(isapply) return call +'.apply(' + cthis + (sarg?','+this.space+sarg:'') + ')'
			//fastpath Math
			if(fastpath) return call + '(' + sarg + ')'
			return call +'.call(' + cthis + (sarg?',' + this.space + sarg:'') + ')'
		}
		
		this.Nest = function( n ){
			var fn = n.fn
			
			if(fn.type == 'Id'){
				if(fn.flag == 35){ // function as a block comment
					return ''
				}
				// animation new
				if(fn.flag == 64 && fn.name === undefined){
					return 'this.$.Track.new(this,' + this.Function( n ) +')'
				}
				// a signal block
				if( fn.name == 'signal'){
					return 'this.Signal.try(' + this.Function( n, null, ['end','fail'] ) +'.bind(this))'
				}
			}
			// just use the .call property
			var exp = this.expand(n.fn, n)
			return exp + '.call('+exp+', ' + this.Function( n ) + ', this)'
		}
		
		this.Quote = function( n ){
			// we need to check for % vars and pass them into parse.
			var esc = outer.ToEscaped
			var tpl = esc.templates = {}
			// now we need to set the template object
			esc.depth = this.depth
			var body = esc.expand(n.quote, n)
			// cache the AST for parse()
			parserCache[body] = n.quote
			
			var obj = ''
			for( var name in tpl ){
				if(obj) obj += ','
				obj += name+':'+(name in this.scope?name:'this.'+name)
			}
			return 'this._parse("' + body + '",module,null'+(obj?',{' + obj + '})':')')
		}
		
		this.Rest = function( n ){
			throw new Error("dont know what to do with isolated rest object")
		}
	})
}
