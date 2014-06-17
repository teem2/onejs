// ONEJS AST code generators
ONE.ast_ = function(){

	// include the parser
	var parser = {}
	ONE.parser_strict_.call( parser )

	var parserCache = {}

	var modules = {}

	this.parse = function( source, module, locals, template, filename, noclone ){
		parser.sourceFile = filename || ''

		var node = parserCache[source]
		if(! node ){
			node = parser.parse_strict( source )
			if(node.steps.length == 1){
				node = node.steps[0]
			}
			parserCache[source] = node
		}

		if(!noclone){
			if( template ){
				var template_nodes = []
				node = node.clone( template_nodes )
			} 
			else {
				node = node.clone()
			}
		}
		node.locals = locals
		node.source = source
		node.pthis = this
		node.module = module

		// we now need to process our template-replaces
		if( template ){
			var nodes = template_nodes
			var copy = this.AST.Copy
			// we now need to overwrite the nodes in our tree with 
			// the template nodes
			for( var i = 0; i < nodes.length; i++ ){
				var tgt = nodes[i]
				var src = template[ tgt.arg.name ]
				if(!src) throw new Error("Template variable not found: " + tgt.arg.name)

				// clean ret the node
				tgt.prefix = undefined
				tgt.op = undefined
				tgt.arg = undefined
				if(typeof src == 'object'){
					copy[src.type](src, tgt)
					tgt.pthis = this
				} 
				else{
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

	this.eval = function( ast, filename ){
		if( typeof ast == 'string' ){ 
			// lets first do a local storage scan.
			
			if(code){
				var fn = Function.call(null, code)()
				return fn
			}
			ast = this.parse( ast, undefined, undefined, undefined, filename, true )
		}
		// alright we have to compile us some code!
		var js = this.AST.ToJS

		// set up new compile state
		js.new_state()
		modules[filename] = js.module

		// if passing a function we return that
		if(ast.type == 'Function'){
			ast.root = true
			var flags = js.pull_flags(ast)

			if(flags){
				if(flags.indexOf('ast')!= -1) ONE.log( ast.toDump() )
				if(flags.indexOf('code')!=-1){
					var code = this.AST.ToCode
					ONE.log( code.Function(ast) )
				}
			}
			// name anonmous function with a filename if possible
			var nametag
			if(filename) nametag = 'file__'+filename.replace(/[\.\/]/g,'_')
			var code = 'return ' + js.Function( ast, nametag )

			// prepend type methods
			for(var k in js.typemethods){
				code = js.typemethods[k] + code
			}
			if(flags && flags.indexOf('js')!=-1) ONE.log( code )

			try{
				if( typeof process !== 'undefined'){
					var fn = Function.call(null, 'module', 'require', '__dirname', code)(js.module, require, __dirname)
				}
				else{
					var prof = flags && flags.indexOf('profile') != -1 && Date.now()

					var fn = Function.call(null, 'module', code)(js.module)

					if(prof) console.log('Profile ' +filename + ' '+ (Date.now()-prof)+'ms')
				}

			} 
			catch(e){
				console.log("ERROR",e,code)
			}
			return fn
		}

		var code = (ast.isExpr()?'return ':'') + js.expand( ast )
		for(var k in js.typemethods){
			code = js.typemethods[k] + code
		}

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
	parser.Node = this.AST = this.Base.extend(function(outer){

		// AST nodes can be bound to signals as expressions
		this.bind_signal = function( owner, sig, old ){

			var deps = this.ToSignalExpr.deps = []
			var code = 'return ' + this.ToSignalExpr.expand( this ) 

			// it gets executed on the this of the object
			var recalc = new Function( code )

			function onSig(){
				sig.bypass( recalc.call( owner ) )
			}
			sig.recalc = onSig
			sig.deps = []

			for(var i = 0, l = deps.length; i < l; i+= 2){
				var obj = deps[i]
				var key = deps[i+1]

				if(obj !== null){
					obj = owner.resolve( obj )
				} 
				else obj = owner

				var dep = obj[ key ]
				if(sig.deps.indexOf( dep ) === -1){
					sig.deps.push( dep )
					if( dep !== undefined && typeof dep.on === 'function' ){
						dep.on(onSig)
					}
				}
			}
			// set value
			sig.bypass( recalc.call( owner ) )

			return this
		}
		
		this.unbind_signal = function( sig ){
			var deps = sig.deps
			var fn = sig.recalc
			for(var i = 0, l = deps.length; i < l; i++){
				deps[i].off(fn)
			}
		}

		// AST structure definition
		// 0 is value
		// 1 is node
		// 2 is array
		// 3 is array of [ { key:1, value:1, kind:0, short:0 } ]

		this.Structure = {
			Program:{ steps:2 },
			Empty:{},

			Id: { name:0, flag:0, kind:1 },
			Value: { value:0, raw:0, kind:0, multi:0 },
			This: { },

			Array: { elems:2 },
			Object: { keys:3 },
			Index: { object:1, index:1 },
			Key: { object:1, key:1, exist:0 },
			ThisCall: { object:1, key:1 },

			Block:{ steps:2 },
			List: { items:2 },
			Comprehension:{ for:1, expr:1 },
			Template: { chain:2 },
			Break: { label:1 },
			Continue: { label:1 },
			Label: { label:1, body:1 },

			If: { test:1, then:1, else:1, postfix:0, compr:0 },
			Switch: { on:1, cases:2 },
			Case: { test:1, then:2 },

			Throw: { arg:1 },
			Try: { try:1, arg:1, catch:1, finally:1 },

			While: { test:1, loop:1 },
			DoWhile: { loop:1, test:1 },
			For: { init:1, test:1, update:1, loop:1, compr:0 },
			ForIn: { left:1, right:1, loop:1, compr:0 },
			ForOf: { left:1, right:1, loop:1, compr:0 },
			ForFrom: { left:1, right:1, loop:1, compr:0 },
			ForTo: { left:1, right:1, loop:1, in:1, compr:0 },

			Var: { defs:2, const:0 },
			Const: { defs:2 },
			TypeVar: { kind:1, defs:2, dim:1 },
			Struct: { id:1, struct:1, base:1, defs:2, dim:1 },
			Define: { id:1, value:1 },
			Enum: { id:1, enums:2 },

			Def: { id:1, init:1, dim:1 },

			Function: { id:1, name:1, params:2, rest:1, body:1, arrow:0, gen:0, def:0 },
			Return: { arg:1 },
			Yield: { arg:1 },
			Await: { arg:1 },

			Unary: { op:0, prefix:0, arg:1 },
			Binary: { op:0, prio:0, left:1, right:1 },
			Logic: { op:0, prio:0, left:1, right:1 },
			Signal: { left:1, right:1, lazy:0 },
			Assign: { op:0, prio:0, left:1, right:1 },
			Update: { op:0, prio:0, arg:1, prefix:0 },
			Condition: { test:1, then:1, else:1 },

			New: { fn:1, args:2 },
			Call: { fn:1, args:2 },
			Create: { fn:1, body:1, arrow:0 },

			Class: { id:1, base:1, body:1 },

			Quote: { quote:1 },
			Rest: { id:1, dots:0 },
			Do: { call:1, arg:1, catch:1, then:1, kind:0 },
			Then: { name:1, do:1 },

			Debugger: { },
			With: { object:1, body:1 }
		}

		this.Clone = this.Base.extend("Clone")
		this.Copy = this.Base.extend("Copy")
		this.Walk = this.Base.extend("Walk")

		// Generate AST Tools clone and copy
		function ToolGenerator(){
			var ast = this.Structure;

			var ret = ''
			for( var type in ast ){
				var tag = ast[ type ]
				var walk = '\tn.parent = p\n'

				var copy = '\tc.type = n.type\n'+
							'\tif(n.store) c.store = n.store\n'+
							'\tif(n.parens) c.parens = n.parens\n'+
							'\tif(n.comments) c.comments = n.comments\n'+
							'\tc.start = n.start\n'+
							'\tc.end = n.end\n'

				var clone = '\tvar c = Object.create(this.AST)\n'+
							'\tc.type = n.type\n'+
							'\tif(n.store) c.store = n.store\n'+
							'\tif(n.parens) c.parens = n.parens\n'+
							'\tif(n.comments) c.comments = n.comments\n'+
							'\tc.start = n.start\n'+
							'\tc.end = n.end\n'
				var v = 0
				for( var k in tag ){
					var t = tag[ k ]
					
					copy += '\tvar _'+v+'=n.'+k+';if(_'+v+')c.'+k+'=_'+v+'\n'

					if( t === 0){
						clone += '\tvar _'+v+' = n.'+k+'\n\tif(_'+v+')c.'+k+'=_'+v+'\n'

					} 
					else if( t === 1){
						clone += '\tvar _'+v+' = n.'+k+'\n'+
							'\tif(_'+v+') c.'+k+' = this[_'+v+'.type](_'+v+')\n'

						walk += '\tvar _'+v+' = n.'+k+'\n'+
							'\tif(_'+v+' && this[_'+v+'.type](_'+v+', n)) return 1\n'

					} 
					else if(t === 2){
						clone += '\tvar _'+v+' = n.'+k+'\n'+
							'\tif(_'+v+'){\n'+
								'\t\tvar x, y = []\n'+
								'\t\tfor(var len = _'+v+'.length, i = 0; i < len; i++){\n'+
									'\t\t\tx = _'+v+'[i]\n'+
									'\t\t\tif(x) y[i] = this[x.type](x)\n'+
								'\t\t}\n'+
								'\t\tc.'+k+' = y\n'+
							'\t}\n'

						walk += '\tvar _'+v+' = n.'+k+'\n'+
							'\tif(_'+v+'){\n'+
								'\t\tvar x\n'+
								'\t\tfor(var len = _'+v+'.length, i = 0; i < len; i++){\n'+
									'\t\t\tx = _'+v+'[i]\n'+
									'\t\t\tif(x && this[x.type](x, n)) return 1\n'+
								'\t\t}\n'+
							'\t}\n'

					}
					else if(t === 3){
						clone += '\tvar _'+v+' = n.'+k+'\n'+
								'\tif(_'+v+'){\n'+
								'\t\tvar x, y = []\n'+
								'\t\tfor(var len = _'+v+'.length,i = 0; i < len; i++){\n'+
									'\t\t\tx = _'+v+'[i], y[i] = {key:this[x.key.type](x.key)}\n'+
									'\t\t\tif(x.value) y[i].value = this[x.value.type](x.value)\n'+
									'\t\t\telse y[i].short = x.short\n'+
								'\t\t}\n'+
								'\t\tc.'+k+'=y\n'+
							'\t}\n'

						walk += '\tvar _'+v+' = n.'+k+'\n'+
								'\tif(_'+v+'){\n'+
								'\t\tfor(var len = _'+v+'.length,i = 0; i < len; i++){\n'+
									'\t\t\tvar x = _'+v+'[i]\n'+
									'\t\t\tif(this[x.key.type](x.key, n)) return 1\n'+
									'\t\t\tif(x.value && this[x.value.type](x.value, n)) return 1\n'+
								'\t\t}\n'+
							'\t}\n'							
					}
					v++
				}
				ret += '\n_walk.'+type+'=function(n, p){\n' + walk + '}\n' 
				ret += '\n_clone.'+type+'=function(n){\n' + clone + '\treturn c\n}\n' 
				ret += '\n_copy.'+type+'=function(n, c){\n'+ copy +'\treturn\n}\n'
			}
			(new Function('_clone', '_copy', '_walk', ret))( this.Clone, this.Copy, this.Walk )

			this.Clone.AST = this
			this.Clone.Unary = function( n ){
				var c = Object.create( this.AST )
				c.start = n.start
				c.end = n.end
				c.type = n.type
				c.prefix = n.prefix
				if(n.parens)c.parens = n.parens
				if(n.comments)c.comments = n.comments
				c.op = n.op
				if( n.prefix && n.op == '%'){
					if(n.arg.type !== 'Id') throw new Error('Unknown template & argument type')
					if( this.template ) this.template.push( c )
				}
				c.arg = this[n.arg.type]( n.arg )
				return c
			}
		}
		ToolGenerator.call(this)

		this.getDependencies = function(){
			return this.DepFinder.start( this )
		}

		this.DepFinder = this.Walk.extend(this, function(outer){
			this.start = function(n){
				this.deps = []
				this[ n.type ]( n )
				return this.deps
			}

			this.Call = function( n, p ){
				outer.Walk.Call.call(this, n, p)
				if(n.fn.name == 'load'){
					var arg = n.args[0]
					if(arg && arg.type == 'Value' && arg.kind == 'string'){
						this.deps.push(arg.value)
					}
				}
			}
			this.TypeVar = function( n, p ){
				if(n.kind.name !== 'import') return
				var defs = n.defs
				for(var i = 0, l = defs.length; i < l; i++){
					var def = defs[i]
					this.deps.push(def.id.name)
				}
			}
		},"DepFinder")

		this.clone = function(template){
			this.Clone.template = template
			var clone = this.Clone[ this.type ]( this )
			this.Clone.template = undefined
			return clone
		}

		this.IsExpr = {
			Id: 1,
			Value: 1,
			This: 1,

			Array: 1,
			Object: 1,
			Index: 1,
			Key: 1,

			List: 1,

			Function: 1,

			Unary: 1,
			Binary: 1,
			Logic: 1,
			Assign: 1,
			Update: 1,
			Condition: 1,
			Comprehension:1,
			Template:1,

			New: 1,
			Call: 1,
			Create: 1,

			Quote: 1,
			Path: 1,
			Do: 1,
		}

		this.isExpr = function(){
			return this.IsExpr[ this.type ]
		}

		this.isKeyChain = function(){
			var node = this
			while(node){
				if(node.type == 'Id' || node.type == 'This') return node
				if(node.type != 'Key' && node.type != 'Index') return
				node = node.object
			}
			return
		}

		this.toJS = function(comments){
			var js = this.ToJS
			js.line = 0
			js.scope = {}
			return js.expand( this )
		}

		this.toString =
		this.toCode = function(comments){
			var code = this.ToCode
			code.line = 0
			return code.expand( this )
		}

		this.ToCode = this.Base.extend(function(outer){

			this.space = ' '
			this.newline = '\n'
			this.indent = '\t'
			this.depth = ''
			this.line = 0

			this.expand_short_object = 0

			this.store = function( n, value ){
				var ret = value
				if(n.store & 1) ret = ret + '..'
				if(n.store & 2) ret = ret + '!'
				if(n.store & 4) ret = ret + '~'
				return ret
			}

			this.expand = function( n, parent ){ // recursive expansion
				if( !n || !n.type ) return ''

				n.parent = parent
				n.genstart = this.line

				if(!this[n.type])throw new Error(n.type)

				var ret = this[n.type](n)
				n.genend = this.line
				if(n.store) ret = this.store(n, ret)

				return ret
			}

			this.block = function( n, parent, noindent ){ // term split array
				var old_depth = this.depth
				if(!noindent) this.depth += this.indent
				var ret = ''
				for( var i = 0; i < n.length; i++ ){
					var node = n[ i ]
					var blk = this.expand(node, parent)
					if(blk[0] == '(' || blk[0] == '[') ret += this.depth + ';' + blk
					else ret += this.depth + blk
					var ch = ret[ret.length - 1]
					if(ch !== '\n' ){
						ret += this.newline, this.line++
					}
				}
				this.depth = old_depth
				return ret
			}

			this.flat = function( n, parent ){
				var len = n.length
				if(len == 0) return ''
				var ret = ''

				for(var i = 0; i < len; i++){
					if(i) ret += ',' + this.space
					ret += this.expand(n[i], parent)
				}
				return ret
			}

			this.list = function( n, parent ){
				var len = n.length
				if(len == 0) return ''
				var ret = ''
				var split = ',' + this.space

				for(var i = 0; i < len; i++){
					if(ret !== '') ret += split
					ret += this.expand(n[ i ], parent)
					if(ret[ret.length - 1] == '\n') ret += i == len - 1? this.depth:this.depth+this.indent
				}

				return ret
			}

			this.Program = function( n ){ 
				return this.block(n.steps, n, true)
			}

			this.Empty = function( n ){ 
				return ''
			}

			this.Id = function( n ){
				var flag = n.flag
				if(flag){
					if(flag === -1) return '..'
					if(flag === 46) return '.' + n.name
					if(flag === 126) return n.name + '~'
					if(flag === 33) return n.name + '!'
					if(flag === 64) return '@' + (n.name!==undefined?n.name:'')
					if(flag === 35) return '#' + (n.name!==undefined?n.name:'')
				}
				if(n.kind) return this.expand(n.kind, n) + ' ' + n.name
				return n.name
			}

			this.Define = function( n ){
				return 'define ' + this.expand(n.id, n) + ' ' + this.expand(n.value, n)
			}

			this.Value = function( n ){
				return n.raw 
			}
			 // string, number, bool
			this.This = function( n ){
				return 'this'
			}

			this.Array = function( n ){
				var ret = '[' +
					this.list( n.elems, n) +
				']'
				return ret
			}

			this.Object = function( n ){ 
				var old_depth = this.depth
				this.depth += this.indent

				var k = n.keys
				var len = k.length
				var ret = '{' + this.space
				var lastcm = ''
				var vc = 0

				for(var i = 0; i < len; i++){
					var prop = k[i]
					if(i) ret += ',' + this.space + lastcm
					lastcm = ''
					var ch = ret[ret.length -1]
					if(ch == '\n') ret += this.depth
					else if(ch == '}') ret +=  this.newline + this.depth
					ret += (prop.key.name || prop.key.raw) 

					if(prop.short === undefined){
						ret += ':' + this.expand(prop.value, n)
					}
					else{
						if(this.expand_short_object){
							ret += ':' + this.resolve(prop.key.name)
						}
					}
				}

				var ch = ret[ ret.length - 1 ]
				if( ch == '\n') ret += old_depth +'}'
				else{
					if( ch == '}' ) ret += this.newline + old_depth + '}'
					else ret += this.space + '}'
				}
				this.depth = old_depth

				return ret
			}

			this.Index = function( n ){
				var obj = n.object
				var object_t = obj.type
				var object = this.expand(obj, n)
				if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call' && object_t !== 'This' && object_t !== 'ThisCall')
					object = '(' + object + ')'
				// when do we need parens? if its not a key or block or call
				return object + '[' + this.expand( n.index, n ) + ']'
			}

			this.Key = function( n ){
				var obj = n.object
				var object_t = obj.type
				var object = this.expand(obj, n)
				if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This' && object_t !== 'ThisCall')
					object = '(' + object + ')'

				return  object + (this.exist?'?.':'.') + this.expand(n.key, n)
			}

			this.ThisCall = function( n ){
				var obj = n.object
				var object_t = obj.type
				var object = this.expand(obj, n)
				if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This' && object_t !== 'ThisCall')
					object = '(' + object + ')'

				return  object + '::' + this.expand(n.key, n)
			}

			this.Block = function( n ){
				var ret = '{' + this.newline + this.block(n.steps, n) + this.depth + '}'
				return ret
			}

			this.List = function( n ){
				return this.list(n.items, n)
			}

			this.Comprehension = function( n ){
				return '1'
			}

			this.Template = function( n ){
				var ret = '"'
				var chain = n.chain
				var len = chain.length 
				for(var i = 0; i < len; i++){
					var item = chain[i]
					if(item.type == 'Block'){
						if(item.steps.length == 1 && outer.IsExpr[item.steps[0].type]){
							ret += '{' + this.expand(item.steps[0], n) + '}'
						} 
						else ret += this.expand(item, n)
					}
					else {
						if(item.value !== undefined) ret += item.value
					}
				}
				ret += '"'
				return ret
			}

			this.Break = function( n ){ 
				return 'break'+(n.label?' '+this.expand(n.label, n):'')
			}

			this.Continue = function( n ){
				return 'continue'+(n.label?' '+this.expand(n.label, n):'')
			}

			this.Label = function( n ){
				return this.expand(n.label, n)+':'+this.expand(n.body, n)
			}

			this.If = function( n ) {
				var ret = 'if('
				ret += this.expand( n.test, n )

				if( ret[ret.length - 1] == '\n') ret += this.depth + this.indent
				ret += ')' + this.space + this.expand(n.then, n) 

				if(n.else){
					var ch = ret[ret.length - 1]
					if( ch !== '\n' ) ret += this.newline
					ret += this.depth + 'else ' + this.expand(n.else, n)
				}

				return ret
			}

			this.Switch = function( n ){
				var ret = 'switch(' + this.expand(n.on, n) + '){'

				ret += this.newline

				var old = this.depth
				this.depth += this.indent				

				var cases = n.cases
				if(cases) for( var i = 0; i < cases.length; i++ ) ret += this.depth + this.expand(cases[i], n)

				this.depth = old
				ret += this.depth + '}'

				return ret
			}

			this.Case = function( n ){
				if(!n.test){
					return 'default:' + (n.then.length? this.newline+this.block(n.then, n): this.newline)
				}
				var ret = 'case '

				ret += this.expand(n.test, n) + ':' 
				ret += this.newline

				if(n.then.length) ret += this.block(n.then, n)

				return ret
			}

			this.Throw = function( n ){
				return 'throw ' + this.expand(n.arg, n)
			}

			this.Try = function( n ){
				var ret = 'try' + this.expand(n.try, n)
				if(n.catch){
					if(n.arg.type !== 'Id') throw new Error("unsupported catch type")
					var name = n.arg.name 
					var inscope = this.scope[name]
					if(!inscope) this.scope[name] = 1
					ret += 'catch('+name+')'+this.expand(n.catch, n)
					if(!inscope) this.scope[name] = undefined

				} 

				if(n.finally) ret += 'finally' + this.expand(n.finally, n)
				return ret
			}

			this.While = function( n ){
				return 'while(' + this.expand(n.test, n) + ')' + 
					this.expand(n.loop, n)
			}

			this.DoWhile = function( n ){
				return 'do' + this.expand(n.loop, n) + 
					'while(' + this.expand(n.test, n) + ')'
			}

			this.For = function( n ){
				return 'for(' + this.expand(n.init, n)+';'+
						this.expand(n.test, n) + ';' +
						this.expand(n.update, n) + ')' + 
						this.expand(n.loop, n)
			}

			this.ForIn = function( n ){
				return 'for(' + this.expand(n.left, n) + ' in ' +
					this.expand(n.right, n) + ')' + 
					this.expand(n.loop, n)
			}

			this.ForOf = function( n ){

				return 'for(' + this.expand(n.left, n) + ' of ' +
					this.expand(n.right, n) + ')' + 
					this.expand(n.loop, n)
			}

			this.ForFrom = function( n ){
				return 'for(' + this.expand(n.left, n) + ' from ' +
					this.expand(n.right, n) + ')' + 
					this.expand(n.loop, n)
			}

			this.ForTo = function( n ){
				return 'for(' + this.expand(n.left, n) + ' to ' +
					this.expand(n.right, n) + 
					(n.in?' in ' + this.expand(n.in, n):'') + ')' + 
					this.expand(n.loop, n)
			}

			this.Var = function( n ){
				return (n.const?'const ':'var ') + this.flat(n.defs, n)
			}

			this.Const = function( n ){
				return 'const ' + this.flat(n.defs, n)
			}

			this.TypeVar = function( n ){
				return this.expand(n.kind, n) + ' ' + 
					this.flat(n.defs, n)
			}

			this.Def = function( n ){
				return this.expand(n.id, n) + 
					(n.init ? this.space + '=' + this.space + this.expand(n.init, n) : '')
			}

			this.Struct = function( n ){
				return 'struct ' + this.expand(n.id, n) + this.expand(n.struct, n)
			}

			this.Enum = function( n ){
				return 'enum ' + this.expand( n.id, n) + '{' + this.newline + 
					this.depth + this.indent + this.list(n.enums, n) +'}'
			}

			this.Function = function( n ){
				if(n.arrow){
					var arrow = n.arrow
					// if an arrow has just one Id as arg leave off ( )
					if( !n.rest && n.params && n.params.length == 1 && !n.params[0].init && n.params[0].id.type == 'Id' ){
						return this.expand(n.params[0].id, n) + arrow + this.expand(n.body, n)
					}
					var ret = ''
					if(n.name) ret += this.expand(n.name)

					ret += '(' +(n.params?this.list(n.params, n):'') + 
						(n.rest ? ',' + this.space + this.expand(n.rest, n) : '' )+ ')' 
					if(!n.name || n.body.type != 'Block' || arrow != '->') ret += arrow
					ret += this.expand(n.body, n)
					this.cignore = 1
					return ret
				}
				var ret = 'function'
				if( n.gen ) ret += '*'
				if( n.id ) ret += ' '+this.expand(n.id, n)
				ret += '('+this.list(n.params, n)
				if( n.rest ) ret += ',' + this.expand(n.rest, n) 
				ret += ')'
				ret += this.expand(n.body, n)
				return ret
			}

			this.Return = function( n ){
				if(!n.arg) return 'return'
				return 'return ' + this.expand(n.arg, n)
			}

			this.Yield = function( n ){
				if(!n.arg) return 'yield'
				return 'yield ' + this.expand(n.arg, n)
			}

			this.Await = function( n ){
				if(!n.arg) return 'await'
				return 'await ' + this.expand(n.arg, n)
			}

			this.Unary = function( n ){
				var arg = this.expand(n.arg, n)
				var atype = n.arg.type

				if( n.prefix ){
					if(atype == 'Assign' || atype == 'Binary' ||
						atype == 'Logic' || atype == 'Condition')
						arg = '(' + arg + ')'

					if(n.op.length != 1) return n.op + ' ' + arg

					return n.op + arg
				}
				return arg + n.op
			}

			// alright so how are we going to do parens?
			this.Binary = function( n ){
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

				return left + this.space + n.op + this.space + right
			}

			this.Signal = function( n ){
				var ret
				ret = this.expand(n.left, n) + ':'
				if(!n.lazy) ret += '='
				if(ret[ret.length - 1] == '\n') ret += this.indent + this.depth
				ret += this.space + this.expand(n.right, n)
				return ret
			}

			this.Assign = function( n ){
				var left = this.expand(n.left, n)
				var right = this.expand(n.right, n)
				return left + this.space + n.op + this.space + right
			}

			this.Update = function( n ){
				if(n.prefix) return n.op + this.expand(n.arg, n)
				return this.expand (n.arg, n) + n.op
			}

			this.Condition = function( n ){
				// if we have a test of logic or binary 
				var test = this.expand(n.test, n)
				var test_t = n.test.type

				if(test_t == 'Assign' || test_t == 'List' || 
					test_t == 'Logic' || test_t == 'Binary') test = '(' + test + ')'

				var else_v = this.expand(n.else, n)
				var else_t = n.else.type
				if(else_t == 'Assign' || else_t == 'List' || 
					else_t == 'Logic' || else_t == 'Binary') else_v = '(' + else_v + ')'

				return test + '?' + 
					this.space + this.expand(n.then, n) + ':' + 
					this.space + else_v
			}

			this.New = function( n ){
				var fn = this.expand(n.fn, n)
				var fn_t = n.fn.type
				if(fn_t == 'List' || fn_t == 'Logic' || fn_t == 'Condition') 
					fn = '(' + fn + ')'
				return 'new ' + fn + '(' + this.list(n.args, n) + ')'
			}

			this.Call = function( n ){
				var fn = this.expand(n.fn, n)
				var fn_t = n.fn.type
				if(fn_t == 'List' || fn_t == 'Logic' || fn_t == 'Condition') 
					fn = '(' + fn + ')'
				return fn + '(' + this.list(n.args, n) + ')'
			}

			this.Class = function( n ){
				var ret = 'class ' + n.id.name
				if(n.base) ret += ' extends ' + n.base.name 
				ret += this.expand(n.body, n)
				return ret
			}

			this.Quote = function( n ){
				var ret = ':' + this.expand(n.quote, n)
				return ret
			}

			this.Rest = function( n ){
				return '...' + this.expand(n.id, n)
			}

			this.Do = function( n ){
				var ret = ''
				ret += this.expand(n.call, n) 
				if(ret[ret.length - 1] == '\n') ret += this.depth + 'do '
				else ret += ' do '
				ret += this.expand(n.arg, n)
				if(n.catch){
					if(ret[ret.length - 1] == '\n') ret += this.depth
					ret += 'catch ' + this.expand(n.catch)
				}
				if(n.then){
					if(ret[ret.length - 1] == '}') ret += this.newline + this.depth
					if(ret[ret.length - 1] == '\n') ret += this.depth
					ret += this.expand( n.then )
				}
				return ret
			}

			this.Create = function( n ){
				return this.expand(n.object, n) + this.expand(n.body, n)
			}

			this.Debugger = function( n ){
				return 'debugger'
			}

			this.With = function( n ){
				return 'with(' + this.expand(n.object, n) + ')' + this.expand(n.body, n)
			}
		})

		this.ToEscaped = this.ToCode.extend(this, function(outer){
			
			this.newline = ' \\n\\\n'
			this.indent = '\t'

			this.Unary = function( n ){
				if(n.prefix){
					if(n.op == '%' && this.templates){
						if(n.arg.type != 'Id') throw new Error("Unknown template & variable type")
						this.templates[n.arg.name] = 1
					}
					if(n.op.length != 1)
						return n.op + ' ' + this.expand(n.arg, n)
					return n.op + this.expand(n.arg, n)
				}
				return this.expand(n.arg, n) + n.op
			}

			this.Value = function( n ){
				if(n.kind == 'string' || n.kind == 'regexp'){
					// escape ' and "
					return n.raw.replace(/"/g,'\\"').replace(/'/g,"\\'")
				}
				return n.raw
			}
		})

		this.typeMap = Object.create(null)
		this.typeMap.bool    = { size:1, slots:1, view:'Int32', arr:'i4', prim:1 }
		this.typeMap.int8    = { size:1, slots:1, view:'Int8', arr:'i1', prim:1 }
		this.typeMap.uint8   = { size:2, slots:1, view:'Uint8', arr:'u1', prim:1 }
		this.typeMap.int16   = { size:2, slots:1, view:'Int16', arr:'i2', prim:1 }
		this.typeMap.uint16  = { size:2, slots:1, view:'Uint16', arr:'u2', prim:1 }
		this.typeMap.int     = { size:4, slots:1, view:'Int32', arr:'i4', prim:1 }
		this.typeMap.int32   = { size:4, slots:1, view:'Int32', arr:'i4', prim:1 }
		this.typeMap.uint32  = { size:4, slots:1, view:'Uint32', arr:'u4', prim:1 }
		this.typeMap.float   = { size:4, slots:1, view:'Float32', arr:'f4', prim:1 }
		this.typeMap.float32 = { size:4, slots:1, view:'Float32', arr:'f4', prim:1 }
		this.typeMap.double  = { size:8, slots:1, view:'Float64', arr:'f8', prim:1 }
		this.typeMap.float64 = { size:8, slots:1, view:'Float64', arr:'f8', prim:1 }
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
				this.typemethods = Object.create(null)
				this.macroarg = Object.create(null)
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
					steps.splice(0,1)
					return ret
				}
				return ''
			}

			this.globals = {
				Object:1,
				Array:1, 
				String:1, 
				Number:1,
				Date:1, 
				Boolean:1,
				Error:1,
				Math:1,
				RegExp:1,
				Function:1,
				undefined:1,
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
				XMLHttpRequest:1,
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
				unescape:1,
				setInterval:1,
				clearInterval:1,
				setTimeout:1,
				clearTimeout:1,
				console:1,
				module:1,
				window:1,
				document:1,
				require:1,
				__dirname:1
			}

			this.find_type = function( name ){
				var type = this.module.types[name]
				if(type) return type
				var im = this.module.imports
				for(var i = 0, l = im.length; i < l;i++){
					var types = im[i].types
					if(types && (type = types[name])) return type
				}
			}

			this.find_define = function( name ){
				var def = this.module.defines[name]
				if(def) return
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
					ret = '(' + this.destruc_prefix + '0=' + (def? def + '||': '') + 
						(typeof init == 'string'?init:this.expand( init, n )) + 
						',(' + this.newline + this.depth
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
					ret = 'this.out(' + ret + ')'
				}
				return ret
			}

			this.resolve = function( name, n ){
				if( name in this.macroarg ){
					return this.expand(this.macroarg[name], n)
				}
				var type = this.typemethod, field
				if(type && (field = type.fields[name])){
					return '_.'+type.arr+'[_.o+'+(field.off / outer.viewSize[type.view])+']'
				}
				if( name in this.scope ){
					var type = this.scope[name]
					if(n && typeof type == 'object'){
						n.infer = type
					}
					return name
				}
				if( name in this.globals ) return name
				var def = this.find_define(name)
				if(def){
					return this.expand(def, n)
				}
				if(n) n.onthis = 1
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
							var type = this.typemethod
							if(!type) throw new Error('template found but no typemethod')
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
							if(!this.typemethod) throw new Error('Type method template found outside of typemethod')
							this.template_marked = true
							return this.template_marker
						}
						return 'this.color("'+n.name+'")'
					}
					if(flag === 64){
						if(n.name == undefined) return 'this'
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
						//var marg = this.macroarg[base]
						//if(marg) base = marg.name
						var type = this.scope[base]

						var isthis 
						if(typeof type == 'object' || (isthis = type = this.typemethod)){
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
									if(field.dim) idx += '('+this.expand(node.index, n) + ')*' + (field.size / outer.viewSize[type.view]) + '+'
									else idx += '('+this.expand(node.index, n) + ')+'
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
							// what if its not 
							// check if we terminated at a value field or a compound field
							var voff = base+'.o+' +idx+ (off / outer.viewSize[type.view])
							if((!node.index || field.dim) && !field.prim){
								n.infer = field
								n.inferptr = 1
								return '{o:' + voff+', '+type.arr+':'+base+'.'+type.arr+'}'
							}
							return base + '.'+type.arr+'[' + voff+ ']'
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
				
				this.scope[name] = 3

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
							ret += item.value.replace(/\n/g,'\\n')
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
						if(!modules[name]) throw new Error("Module " + name + " not found")
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
								type.arr = field.arr
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

			this.Function = function( n, nametag, extparams, typemethod ){
				if( n.id ) this.scope[ n.id.name ] = 1
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
				if( n.rest ){
					if( n.rest.id.type !== 'Id' ) throw new Error('Unknown id type')
					var name = n.rest.id.name
					this.scope[name] = 1
					if(plen)
						str_body += this.depth + 'var '+name+' = arguments.length>' + plen + '?' + 
						'Array.prototype.slice.call(arguments,' + plen + '):[]' + this.newline
					else
						str_body += this.depth + 'var '+name+' = Array.prototype.slice.call(arguments,0)' + this.newline
				}
				if(typemethod){
					this.scope['_'] = typemethod
					str_param += '_'
				}
				// do init
				if( plen ){
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
							if(param.id.flag == 46){
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
				if( extparams ){
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
				if( n.body.type == 'Block' ){
					var steps = n.body.steps
					n.body.parent = n
					// we can do a simple wait transform
					str_body += this.block( n.body.steps, n.body, 1 )
				} 
				else str_body += this.depth + 'return ' + this.expand(n.body, n) 

				// Auto function to this bind detection
				var bind = false
				if(n.arrow === '=>' || n.indo && !n.arrow) bind = true
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
							ret += n.name.name+'",'
							isgetset = true
						}
						else if(!typemethod){
							var fn = this.find_function(n.parent)
							if(fn && fn.root){
								// export the method
								this.module.exports[name] = n
							}
							ret += this.expand(n.name, n) + this.space + '=' + this.space
						}
					}
				}

				ret += 'function'

				if(n.await) ret = 'ONE._await(' + ret

				if(n.gen || n.auto_gen) ret += '*'
				if( nametag === null ) ret += ''
				else if( nametag ) ret += ' '+nametag
				else if(n.id) ret += ' '+this.expand(n.id, n)

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

				if(typemethod){
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
					if(p.type == 'Create') return p
					if(p.type == 'Class') return p
					if(p.type == 'Function') return p
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
						ret = 'this.out('+this.expand(n.arg, n) + ')'
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

				ret +=  'this.parse("' + body + '",module'
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
							var arr = n.left.infer.arr
							var ret = '(' + tmp_l + '=' + left + ',' + tmp_r + '=' + right
							for(var i = 0;i<nslots;i++){
								ret += ',' + tmp_l + '.' + arr + '[' + tmp_l +'.o+'+ i + ']'+ 
									n.op + tmp_r + '.' + arr + '[' + tmp_r +'.o+'+ i + ']'
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
						if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
						ret += this.space + n.op + this.space + this.expand(n.right, n)
					}
				} 
				else {
					ret = 'this[' + this.expand(n.left, n) + ']' + this.space + n.op + 
						this.space + this.expand(n.right, n)
				}
				return ret
			}

			this.Binary = function( n ){
				var ret
				var leftstr

				// lets check types
				if(n.left.infer || n.right.infer){
					throw new Error('operator not defined for type')
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

					var tmp = this.alloc_tempvar(n)
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
				var fn = this.expand(n.fn, n, true)
				var fn_t = n.fn.type
				if(fn_t == 'Assign' || fn_t == 'Logic' || fn_t == 'Condition') 
					fn = '(' + fn + ')'				

				var arg = this.list(n.args, n)
				if(this.globals[fn]){
					return 'new ' + fn + '(' + arg + ')'
				}
				// forward to Call
				// WARNING we might have double calls if you fetch
				// the class via functioncall.
				return this.Call( n, undefined, true )
				return  fn + '.new(this'+(arg?', '+arg:arg)+')'
			}

			// struct method call
			this.struct_method = function(n, fn, args, root, type, isstatic){
				// alright we are a method call.
				if(fn.object.type !='Id') throw new Error('only 1 deep method calls for now')
				// so first we are going to compile the function
				var mname = fn.key.name
				
				var method = type.methods[mname]
				while(method){
					//!TODO add type checking here
					if(method.params.length == args.length) break
					mname = mname + '_'
					method = type.methods[mname]
				}
				if(!method) throw new Error('No overload found for '+mname)

				// lets make a name from our argument types
				for(var i = 0, l = method.params.length; i < l; i++){
					var kind = method.params[i].id.kind
					mname += '_'+(kind && kind.name || 'var')
				}

				var gen = type.name + '_' + mname

				// make a typemethod
				if(!this.typemethods[gen]){
					var d = this.depth
					this.depth = ''
					var t = this.typemethod
					this.typemethod = type
					this.typemethods[gen] = this.Function(method, gen, undefined, type ) + this.newline
					this.typemethod = t
					this.depth = d
				}

				var ret = ''
				ret += gen+'.call(this'
				if(isstatic){
					ret += ',{o:0,'+type.arr+':new ' + type.view + 'Array(' + type.slots + ')}'
				} 
				else ret += ', ' + root.name

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
					off = 1
					n.assign_left = undefined
					op = n.assign_op
				}
				else{
					// store the type on our module for quick reference
					this.module[type.name] = type
					ret = '('+output+'= {o:0,t:module.'+type.name+','+type.arr+':new '+type.view+'Array(' 
					if(dims) ret += '(' + this.expand(dims, n) + ')*' + nslots + ')}'
					else ret += nslots + ')}'
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
							ret += output+'.'+type.arr+'['
							if(off) ret += output+'.o+'
							ret += (slot++) +']'+op
						}
						ret += val
					}
					// expand to a var, and decide wether it is compound or primtive.
					else {
						var val = this.expand(elem, n)
						if(!val.infer || !val.infer.methods){ // well assume its a single val
							ret += ','
							for(var i = 0, l = issingle?type.slots:1; i < l; i++){
								ret += output+'.'+type.arr+'['
								if(off) ret += output+'.o+'
								ret += (slot++) +']'+op
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

			this.macro_call = function( n, name, args ){

				var macro
				if(this.context){
					var obj = this.context[name]
					if(obj && obj.bind && obj.bind.__class__ == 'AST') macro = obj.bind
				}
				if(!macro){
					var nm = name
					var macros = this.module.macros
					macro = macros[nm]

					while(macro){
						//!TODO add a real argument matcher here
						params = macro.id.args
						if(args.length == params.length) break
						nm = nm + '_'
						macro = macros[nm]
					}
					if(!macro){
						var im = this.module.imports
						for(var i = 0, l = im.length; i < l; i++){
							var macros = im[i].macros
							if(macros && (macro = macros[name])){
								var nm = name
								while(macro){
									params = macro.id.args
									if(args.length == params.length) break
									nm = nm + '_'
									macro = macros[nm]
								}
							}
							if(macro) break
						}
					}
					if(!macro) return
				}
				if(macro.id && macro.id.type == 'Function') macro = macro.id

				// macro function TODO make this actually safe
				if(macro.type == 'Function'){

					var a = this.macroarg
					var marg = this.macroarg = Object.create(this.macroarg)
					var params = macro.params

					var ret = '{' + this.newline + this.depth + this.indent + 'var '
					var len = args.length
					for(var i = 0; i < len; i++){
						var param = params[i]
						// check if we have a default arg
						if(param.init){
							throw new Error('implement macro default arg')
						}
						var tmp = this.alloc_tmpvar(n)
						if(i) ret += ', '
						ret += tmp + ' = ' + this.expand(args[i], n)
						this.macroarg[param.id.name] = {type:'Id',name:tmp}
						var kind = param.id.kind
						if(kind){
							var type = this.find_type(kind.name)
							if(!type) throw new Error('Cannot find type of macro arg: ' + kind.name)
							this.scope[tmp] = type
						}
						else this.scope[tmp] = 1
					}
					var chk = this.expand(macro.body, n)
					ret += chk.slice(1)
					this.macroarg = a
					return ret
				}
				// macro expressions
				else {
					var len = args.length
					if(!len) return this.expand(macro.value, n)
					var a = this.macroarg
					var marg = this.macroarg = Object.create(this.macroarg)
					var params = macro.id.args
					// build up macro args
					for(var i = 0; i < len; i++){
						var param = params[i]
						if(param.type == 'Assign'){
							throw new Error('implement macro default arg')
						}
						this.macroarg[param.name] = args[i]
					}
					var ret = this.expand(macro.value, n)
					this.macroarg = a
					return ret
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

			this.Call = function( n, extra, isnew ){
				var fn  = n.fn
				fn.parent = n
				// assert macro
				var mname
				if(fn.type == 'Id' && (mname = '_compile_'+fn.name) in this){
					return this[mname](n)
				}

				var args = n.args

				// add extra args for processing
				if(extra) args = Array.prototype.concat.apply(args, extra)
				if(isnew) args = Array.prototype.concat.apply(['this'], args)

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
					var root = fn.isKeyChain()
					if(root && root.name){
						var isstatic
						var type = this.scope[root.name] || (isstatic = this.find_type(root.name))
						if(typeof type == 'object' && type.__class__ !== 'AST'){ 
							return this.struct_method(n, fn, args, root, type, isstatic)
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
							return this.expand( n.fn, n, true ) + '(' + this.list( n.args, n ) + ')'
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
				if(isnew){
					cthis = call
					call += '.new'	
				}

				if(isapply) return call +'.apply(' + cthis + (sarg?','+this.space+sarg:'') + ')'
				//fastpath Math
				if(fastpath) return call+'('+sarg+')'
				return call +'.call(' + cthis + (sarg?','+this.space+sarg:'') + ')'
			}

			this.Create = function( n ){
				var fn = n.fn
				
				if(fn.type == 'Id'){
					// animation new
					if(fn.flag == 64 && fn.name === undefined){
						return 'this.$.Track.new(this,' + this.Function( n ) +')'
					}
					// a signal block
					if( fn.name == 'signal'){
						return 'this.Signal.try(' + this.Function( n, null, ['end','fail'] ) +'.bind(this))'
					}
				} 
				// alright, in general calling Bla{ } instances it.
				return this.expand(n.fn, n) + '.create(this, ' + this.Function( n ) + ')'
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
				return 'this.parse("' + body + '",module,null'+(obj?',{' + obj + '})':')')
			}

			this.Rest = function( n ){
				throw new Error("dont know what to do with isolated rest object")
			}

			this.Do = function( n ){
				var call = n.call
				var extra = [n.arg]
				n.arg.indo = 1
				if(n.catch){
					extra.push( n.catch )
					n.catch.indo = 1
				}

				var then = (n.then ? this.expand(n.then, n) : '')
				if( call.type !== 'Call'){
					// make a fake call node
					call = {
						parent:call.parent,
						fn:call,
						args:[]
					}
				} else call.parent = n

				return this.Call( call, extra ) + then
			}

		})

		// TODO update this
		this.ToSignalExpr = this.ToCode.extend(this, function( outer ){
			this.deps = 0

			this.Call = function( n ){
				if( n.fn.type !== 'Id') throw new Error("Dont know how to do non Id call")
				return 'this.' + n.fn.name + '(' + this.list( n.args, n ) + ')'
			}

			this.Id = function( n ){
				// direct ID's
				this.deps.push( null, n.name )
				return 'this.' + n.name+'.valueOf()'
			}

			this.Key = function( n ){
				// reading properties
				var obj =  outer.ToCode.expand(n.object)
				var key = outer.ToCode.expand(n.key)
				// base + key pairs
				this.deps.push(obj, key)
				return 'this.' + obj + '.' + key + '.valueOf()'
			}

			this.Index = function(n){
				throw new Error("Signals dont do index")
			}
		})

		this.toDump = function(n, tab){
			if(! n ) var log = true
			n  = n || this
			tab = tab || '-';
			var wr = Array.isArray(n) ? '[ ]' : '' ;
			var ret = (n.type?n.type+'('+n.start+' - '+n.end+')'+wr:'')

			var keys = Object.keys(n)
			for( var i = 0;i < keys.length; i++){
				var k = keys[i]
				if(k == 'parent' || k == 'tokens' || k == 'start' || k == 'end' 
					|| k == 'loc' || k == 'type' || k == 'pthis' || k=='source') continue;
				var v = n[k]
				if(typeof v !== 'function'){
					if(typeof v == 'object'){
						if(v !== null && Object.keys(v).length > 0)
							ret += '\n' + tab + k+':' + this.toDump(v, tab + '-')
					} else {
						if(v !== false) ret += '\n' + tab + k+':' + v
					}
				}
			}
			return ret
		}

	}, "AST")
	
	this.color_wikipedia = {
		acidgreen:0xB0BF1A,aero:0x7CB9E8,aeroblue:0xC9FFE5,africanviolet:0xB284BE,airforceblueraf:0x5D8AA8,airforceblueusaf:0x00308F,
		airsuperiorityblue:0x72A0C1,alabamacrimson:0xAF002A,aliceblue:0xF0F8FF,alizarincrimson:0xE32636,alloyorange:0xC46210,
		almond:0xEFDECD,amaranth:0xE52B50,amaranthpink:0xF19CBB,amaranthpurple:0xAB274F,amaranthred:0xD3212D,amazon:0x3B7A57,
		amber:0xFFBF00,ambersaeece:0xFF7E00,americanrose:0xFF033E,amethyst:0x9966CC,androidgreen:0xA4C639,antiflashwhite:0xF2F3F4,
		antiquebrass:0xCD9575,antiquebronze:0x665D1E,antiquefuchsia:0x915C83,antiqueruby:0x841B2D,antiquewhite:0xFAEBD7,aoenglish:0x008000,
		applegreen:0x8DB600,apricot:0xFBCEB1,aqua:0x00FFFF,aquamarine:0x7FFFD4,armygreen:0x4B5320,artichoke:0x8F9779,arylideyellow:0xE9D66B,
		ashgrey:0xB2BEB5,asparagus:0x87A96B,atomictangerine:0xFF9966,auburn:0xA52A2A,aureolin:0xFDEE00,aurometalsaurus:0x6E7F80,
		avocado:0x568203,azure:0x007FFF,azurecolor:0xF0FFFF,azuremist:0xF0FFFF,azureishwhite:0xDBE9F4,babyblue:0x89CFF0,babyblueeyes:0xA1CAF1,
		babypink:0xF4C2C2,babypowder:0xFEFEFA,bakermillerpink:0xFF91AF,ballblue:0x21ABCD,bananamania:0xFAE7B5,bananayellow:0xFFE135,
		bangladeshgreen:0x006A4E,barbiepink:0xE0218A,barnred:0x7C0A02,battleshipgrey:0x848482,bazaar:0x98777B,beaublue:0xBCD4E6,
		beaver:0x9F8170,beige:0xF5F5DC,bdazzledblue:0x2E5894,bigdiporuby:0x9C2542,bisque:0xFFE4C4,bistre:0x3D2B1F,bistrebrown:0x967117,
		bitterlemon:0xCAE00D,bitterlime:0xBFFF00,bittersweet:0xFE6F5E,bittersweetshimmer:0xBF4F51,black:0x000000,blackbean:0x3D0C02,
		blackleatherjacket:0x253529,blackolive:0x3B3C36,blanchedalmond:0xFFEBCD,blastoffbronze:0xA57164,bleudefrance:0x318CE7,
		blizzardblue:0xACE5EE,blond:0xFAF0BE,blue:0x0000FF,bluecrayola:0x1F75FE,bluemunsell:0x0093AF,bluencs:0x0087BD,bluepantone:0x0018A8,
		bluepigment:0x333399,blueryb:0x0247FE,bluebell:0xA2A2D0,bluegray:0x6699CC,bluegreen:0x0D98BA,bluemagentaviolet:0x553592,
		bluesapphire:0x126180,blueviolet:0x8A2BE2,blueyonder:0x5072A7,blueberry:0x4F86F7,bluebonnet:0x1C1CF0,blush:0xDE5D83,
		bole:0x79443B,bondiblue:0x0095B6,bone:0xE3DAC9,bostonuniversityred:0xCC0000,bottlegreen:0x006A4E,boysenberry:0x873260,
		brandeisblue:0x0070FF,brass:0xB5A642,brickred:0xCB4154,brightcerulean:0x1DACD6,brightgreen:0x66FF00,brightlavender:0xBF94E4,
		brightlilac:0xD891EF,brightmaroon:0xC32148,brightnavyblue:0x1974D2,brightpink:0xFF007F,brightturquoise:0x08E8DE,brightube:0xD19FE8,
		brilliantazure:0x3399FF,brilliantlavender:0xF4BBFF,brilliantrose:0xFF55A3,brinkpink:0xFB607F,britishracinggreen:0x004225,
		bronze:0xCD7F32,bronzeyellow:0x737000,browntraditional:0x964B00,brown:0xA52A2A,brownnose:0x6B4423,brunswickgreen:0x1B4D3E,
		bubblegum:0xFFC1CC,bubbles:0xE7FEFF,buff:0xF0DC82,budgreen:0x7BB661,bulgarianrose:0x480607,burgundy:0x800020,burlywood:0xDEB887,
		burntorange:0xCC5500,burntsienna:0xE97451,burntumber:0x8A3324,byzantine:0xBD33A4,byzantium:0x702963,cadet:0x536872,
		cadetblue:0x5F9EA0,cadetgrey:0x91A3B0,cadmiumgreen:0x006B3C,cadmiumorange:0xED872D,cadmiumred:0xE30022,cadmiumyellow:0xFFF600,
		cafeaulait:0xA67B5B,cafenoir:0x4B3621,calpolypomonagreen:0x1E4D2B,cambridgeblue:0xA3C1AD,camel:0xC19A6B,cameopink:0xEFBBCC,
		camouflagegreen:0x78866B,canaryyellow:0xFFEF00,candyapplered:0xFF0800,candypink:0xE4717A,capri:0x00BFFF,caputmortuum:0x592720,
		cardinal:0xC41E3A,caribbeangreen:0x00CC99,carmine:0x960018,carminemp:0xD70040,carminepink:0xEB4C42,carminered:0xFF0038,
		carnationpink:0xFFA6C9,carnelian:0xB31B1B,carolinablue:0x56A0D3,carrotorange:0xED9121,castletongreen:0x00563F,catalinablue:0x062A78,
		catawba:0x703642,cedarchest:0xC95A49,ceil:0x92A1CF,celadon:0xACE1AF,celadonblue:0x007BA7,celadongreen:0x2F847C,celeste:0xB2FFFF,
		celestialblue:0x4997D0,cerise:0xDE3163,cerisepink:0xEC3B83,cerulean:0x007BA7,ceruleanblue:0x2A52BE,ceruleanfrost:0x6D9BC3,
		cgblue:0x007AA5,cgred:0xE03C31,chamoisee:0xA0785A,champagne:0xF7E7CE,charcoal:0x36454F,charlestongreen:0x232B2B,charmpink:0xE68FAC,
		chartreusetraditional:0xDFFF00,chartreuse:0x7FFF00,cherry:0xDE3163,cherryblossompink:0xFFB7C5,chestnut:0x954535,chinapink:0xDE6FA1,
		chinarose:0xA8516E,chinesered:0xAA381E,chineseviolet:0x856088,chocolatetraditional:0x7B3F00,chocolate:0xD2691E,chromeyellow:0xFFA700,
		cinereous:0x98817B,cinnabar:0xE34234,cinnamon:0xD2691E,citrine:0xE4D00A,citron:0x9FA91F,claret:0x7F1734,classicrose:0xFBCCE7,
		cobalt:0x0047AB,cocoabrown:0xD2691E,coconut:0x965A3E,coffee:0x6F4E37,columbiablue:0xC4D8E2,congopink:0xF88379,coolblack:0x000000,
		coolgrey:0x8C92AC,copper:0xB87333,coppercrayola:0xDA8A67,copperpenny:0xAD6F69,copperred:0xCB6D51,copperrose:0x996666,
		coquelicot:0xFF3800,coral:0xFF7F50,coralpink:0xF88379,coralred:0xFF4040,cordovan:0x893F45,corn:0xFBEC5D,cornellred:0xB31B1B,
		cornflowerblue:0x6495ED,cornsilk:0xFFF8DC,cosmiclatte:0xFFF8E7,coyotebrown:0x81613e,cottoncandy:0xFFBCD9,cream:0xFFFDD0,
		crimson:0xDC143C,crimsonglory:0xBE0032,crimsonred:0x990000,cyan:0x00FFFF,cyanazure:0x4E82b4,cyancobaltblue:0x28589C,
		cyancornflowerblue:0x188BC2,cyanprocess:0x00B7EB,cybergrape:0x58427C,cyberyellow:0xFFD300,daffodil:0xFFFF31,dandelion:0xF0E130,
		darkblue:0x00008B,darkbluegray:0x666699,darkbrown:0x654321,darkbyzantium:0x5D3954,darkcandyapplered:0xA40000,darkcerulean:0x08457E,
		darkchestnut:0x986960,darkcoral:0xCD5B45,darkcyan:0x008B8B,darkelectricblue:0x536878,darkgoldenrod:0xB8860B,darkgrayx11:0xA9A9A9,
		darkgreen:0x013220,darkgreenx11:0x006400,darkimperialblue:0x00416A,darkjunglegreen:0x1A2421,darkkhaki:0xBDB76B,darklava:0x483C32,
		darklavender:0x734F96,darkliver:0x534B4F,darkliverhorses:0x543D37,darkmagenta:0x8B008B,darkmediumgray:0xA9A9A9,darkmidnightblue:0x003366,
		darkmossgreen:0x4A5D23,darkolivegreen:0x556B2F,darkorange:0xFF8C00,darkorchid:0x9932CC,darkpastelblue:0x779ECB,darkpastelgreen:0x03C03C,
		darkpastelpurple:0x966FD6,darkpastelred:0xC23B22,darkpink:0xE75480,darkpowderblue:0x003399,darkpuce:0x4F3A3C,darkraspberry:0x872657,
		darkred:0x8B0000,darksalmon:0xE9967A,darkscarlet:0x560319,darkseagreen:0x8FBC8F,darksienna:0x3C1414,darkskyblue:0x8CBED6,
		darkslateblue:0x483D8B,darkslategray:0x2F4F4F,darkspringgreen:0x177245,darktan:0x918151,darktangerine:0xFFA812,darktaupe:0x483C32,
		darkterracotta:0xCC4E5C,darkturquoise:0x00CED1,darkvanilla:0xD1BEA8,darkviolet:0x9400D3,darkyellow:0x9B870C,dartmouthgreen:0x00703C,
		davysgrey:0x555555,debianred:0xD70A53,deepcarmine:0xA9203E,deepcarminepink:0xEF3038,deepcarrotorange:0xE9692C,deepcerise:0xDA3287,
		deepchampagne:0xFAD6A5,deepchestnut:0xB94E48,deepcoffee:0x704241,deepfuchsia:0xC154C1,deepgreen:0x056608,deepgreencyanturquoise:0x0E7C61,
		deepjunglegreen:0x004B49,deeplemon:0xF5C71A,deeplilac:0x9955BB,deepmagenta:0xCC00CC,deepmauve:0xD473D4,deepmossgreen:0x355E3B,
		deeppeach:0xFFCBA4,deeppink:0xFF1493,deeppuce:0xA95C68,deepruby:0x843F5B,deepsaffron:0xFF9933,deepskyblue:0x00BFFF,
		deepspacesparkle:0x4A646C,deepspringbud:0x556B2F,deeptaupe:0x7E5E60,deeptuscanred:0x66424D,deer:0xBA8759,denim:0x1560BD,
		desaturatedcyan:0x669999,desert:0xC19A6B,desertsand:0xEDC9AF,desire:0xEA3C53,diamond:0xB9F2FF,dimgray:0x696969,dirt:0x9B7653,
		dodgerblue:0x1E90FF,dogwoodrose:0xD71868,dollarbill:0x85BB65,donkeybrown:0x664C28,drab:0x967117,dukeblue:0x00009C,duststorm:0xE5CCC9,
		dutchwhite:0xEFDFBB,earthyellow:0xE1A95F,ebony:0x555D50,ecru:0xC2B280,eerieblack:0x1B1B1B,eggplant:0x614051,eggshell:0xF0EAD6,
		egyptianblue:0x1034A6,electricblue:0x7DF9FF,electriccrimson:0xFF003F,electriccyan:0x00FFFF,electricgreen:0x00FF00,electricindigo:0x6F00FF,
		electriclavender:0xF4BBFF,electriclime:0xCCFF00,electricpurple:0xBF00FF,electricultramarine:0x3F00FF,electricviolet:0x8F00FF,
		electricyellow:0xFFFF33,emerald:0x50C878,eminence:0x6C3082,englishgreen:0x1B4D3E,englishlavender:0xB48395,englishred:0xAB4B52,
		englishviolet:0x563C5C,etonblue:0x96C8A2,eucalyptus:0x44D7A8,fallow:0xC19A6B,falured:0x801818,fandango:0xB53389,fandangopink:0xDE5285,
		fashionfuchsia:0xF400A1,fawn:0xE5AA70,feldgrau:0x4D5D53,feldspar:0xFDD5B1,ferngreen:0x4F7942,ferrarired:0xFF2800,fielddrab:0x6C541E,
		firebrick:0xB22222,fireenginered:0xCE2029,flame:0xE25822,flamingopink:0xFC8EAC,flattery:0x6B4423,flavescent:0xF7E98E,
		flax:0xEEDC82,flirt:0xA2006D,floralwhite:0xFFFAF0,fluorescentorange:0xFFBF00,fluorescentpink:0xFF1493,fluorescentyellow:0xCCFF00,
		folly:0xFF004F,forestgreentraditional:0x014421,forestgreen:0x228B22,frenchbeige:0xA67B5B,frenchbistre:0x856D4D,frenchblue:0x0072BB,
		frenchfuchsia:0xFD3F92,frenchlilac:0x86608E,frenchlime:0x9EFD38,frenchmauve:0xD473D4,frenchpink:0xFD6C9E,frenchplum:0x811453,
		frenchpuce:0x4E1609,frenchraspberry:0xC72C48,frenchrose:0xF64A8A,frenchskyblue:0x77B5FE,frenchviolet:0x8806CE,frenchwine:0xAC1E44,
		freshair:0xA6E7FF,fuchsia:0xFF00FF,fuchsiacrayola:0xC154C1,fuchsiapink:0xFF77FF,fuchsiapurple:0xCC397B,fuchsiarose:0xC74375,
		fulvous:0xE48400,fuzzywuzzy:0xCC6666,gainsboro:0xDCDCDC,gamboge:0xE49B0F,gambogeorangebrown:0x996600,genericviridian:0x007F66,
		ghostwhite:0xF8F8FF,giantsorange:0xFE5A1D,ginger:0xB06500,glaucous:0x6082B6,glitter:0xE6E8FA,gogreen:0x00AB66,goldmetallic:0xD4AF37,
		goldgolden:0xFFD700,goldfusion:0x85754E,goldenbrown:0x996515,goldenpoppy:0xFCC200,goldenyellow:0xFFDF00,goldenrod:0xDAA520,
		grannysmithapple:0xA8E4A0,grape:0x6F2DA8,gray:0x808080,grayx11:0xBEBEBE,grayasparagus:0x465945,
		grayblue:0x8C92AC,greencolorwheelx11green:0x00FF00,greencrayola:0x1CAC78,green:0x008000,greenmunsell:0x00A877,
		greenncs:0x009F6B,greenpantone:0x00AD43,greenpigment:0x00A550,greenryb:0x66B032,greenyellow:0xADFF2F,grizzly:0x885818,
		grullo:0xA99A86,guppiegreen:0x00FF7F,halayaube:0x663854,hanblue:0x446CCF,hanpurple:0x5218FA,hansayellow:0xE9D66B,harlequin:0x3FFF00,
		harlequingreen:0x46CB18,harvardcrimson:0xC90016,harvestgold:0xDA9100,heartgold:0x808000,heliotrope:0xDF73FF,heliotropegray:0xAA98A9,
		heliotropemagenta:0xAA00BB,hollywoodcerise:0xF400A1,honeydew:0xF0FFF0,honolulublue:0x006DB0,hookersgreen:0x49796B,hotmagenta:0xFF1DCE,
		hotpink:0xFF69B4,huntergreen:0x355E3B,iceberg:0x71A6D2,icterine:0xFCF75E,illuminatingemerald:0x319177,imperial:0x602F6B,
		imperialblue:0x002395,imperialpurple:0x66023C,imperialred:0xED2939,inchworm:0xB2EC5D,independence:0x4C516D,indiagreen:0x138808,
		indianred:0xCD5C5C,indianyellow:0xE3A857,indigo:0x6F00FF,indigodye:0x091F92,indigo:0x4B0082,internationalkleinblue:0x002FA7,
		internationalorangeaerospace:0xFF4F00,internationalorangeengineering:0xBA160C,internationalorangegoldengatebridge:0xC0362C,
		iris:0x5A4FCF,irresistible:0xB3446C,isabelline:0xF4F0EC,islamicgreen:0x009000,italianskyblue:0xB2FFFF,ivory:0xFFFFF0,
		jade:0x00A86B,japanesecarmine:0x9D2933,japaneseindigo:0x264348,japaneseviolet:0x5B3256,jasmine:0xF8DE7E,jasper:0xD73B3E,
		jazzberryjam:0xA50B5E,jellybean:0xDA614E,jet:0x343434,jonquil:0xF4CA16,jordyblue:0x8AB9F1,junebud:0xBDDA57,junglegreen:0x29AB87,
		kellygreen:0x4CBB17,kenyancopper:0x7C1C05,keppel:0x3AB09E,khaki:0xC3B091,jawad:0xC3B091,lightkhaki:0xF0E68C,
		kobe:0x882D17,kobi:0xE79FC4,kombugreen:0x354230,kucrimson:0xE8000D,lasallegreen:0x087830,languidlavender:0xD6CADD,lapislazuli:0x26619C,
		laserlemon:0xFFFF66,laurelgreen:0xA9BA9D,lava:0xCF1020,lavenderfloral:0xB57EDC,lavender:0xE6E6FA,lavenderblue:0xCCCCFF,
		lavenderblush:0xFFF0F5,lavendergray:0xC4C3D0,lavenderindigo:0x9457EB,lavendermagenta:0xEE82EE,lavendermist:0xE6E6FA,
		lavenderpink:0xFBAED2,lavenderpurple:0x967BB6,lavenderrose:0xFBA0E3,lawngreen:0x7CFC00,lemon:0xFFF700,lemonchiffon:0xFFFACD,
		lemoncurry:0xCCA01D,lemonglacier:0xFDFF00,lemonlime:0xE3FF00,lemonmeringue:0xF6EABE,lemonyellow:0xFFF44F,lenurple:0xBA93D8,
		licorice:0x1A1110,liberty:0x545AA7,lightapricot:0xFDD5B1,lightblue:0xADD8E6,lightbrown:0xB5651D,lightcarminepink:0xE66771,
		lightcoral:0xF08080,lightcornflowerblue:0x93CCEA,lightcrimson:0xF56991,lightcyan:0xE0FFFF,lightdeeppink:0xFF5CCD,lightfrenchbeige:0xC8AD7F,
		lightfuchsiapink:0xF984EF,lightgoldenrodyellow:0xFAFAD2,lightgray:0xD3D3D3,lightgrayishmagenta:0xCC99CC,lightgreen:0x90EE90,
		lighthotpink:0xFFB3DE,lightkhaki:0xF0E68C,lightmediumorchid:0xD39BCB,lightmossgreen:0xADDFAD,lightorchid:0xE6A8D7,lightpastelpurple:0xB19CD9,
		lightpink:0xFFB6C1,lightredochre:0xE97451,lightsalmon:0xFFA07A,lightsalmonpink:0xFF9999,lightseagreen:0x20B2AA,lightskyblue:0x87CEFA,
		lightslategray:0x778899,lightsteelblue:0xB0C4DE,lighttaupe:0xB38B6D,lightthulianpink:0xE68FAC,lightyellow:0xFFFFE0,lilac:0xC8A2C8,
		limecolorwheel:0xBFFF00,limex11green:0x00FF00,limegreen:0x32CD32,limerick:0x9DC209,lincolngreen:0x195905,linen:0xFAF0E6,
		lion:0xC19A6B,liseranpurple:0xDE6FA1,littleboyblue:0x6CA0DC,liver:0x674C47,liverdogs:0xB86D29,liverorgan:0x6C2E1F,liverchestnut:0x987456,
		livid:0x6699CC,lumber:0xFFE4CD,lust:0xE62020,magenta:0xFF00FF,magentacrayola:0xFF55A3,magentadye:0xCA1F7B,magentapantone:0xD0417E,
		magentaprocess:0xFF0090,magentahaze:0x9F4576,magentapink:0xCC338B,magicmint:0xAAF0D1,magnolia:0xF8F4FF,mahogany:0xC04000,
		maize:0xFBEC5D,majorelleblue:0x6050DC,malachite:0x0BDA51,manatee:0x979AAA,mangotango:0xFF8243,mantis:0x74C365,mardigras:0x880085,
		marooncrayola:0xC32148,maroon:0x800000,maroonx11:0xB03060,mauve:0xE0B0FF,mauvetaupe:0x915F6D,mauvelous:0xEF98AA,
		maygreen:0x4C9141,mayablue:0x73C2FB,meatbrown:0xE5B73B,mediumaquamarine:0x66DDAA,mediumblue:0x0000CD,mediumcandyapplered:0xE2062C,
		mediumcarmine:0xAF4035,mediumchampagne:0xF3E5AB,mediumelectricblue:0x035096,mediumjunglegreen:0x1C352D,mediumlavendermagenta:0xDDA0DD,
		mediumorchid:0xBA55D3,mediumpersianblue:0x0067A5,mediumpurple:0x9370DB,mediumredviolet:0xBB3385,mediumruby:0xAA4069,
		mediumseagreen:0x3CB371,mediumskyblue:0x80DAEB,mediumslateblue:0x7B68EE,mediumspringbud:0xC9DC87,mediumspringgreen:0x00FA9A,
		mediumtaupe:0x674C47,mediumturquoise:0x48D1CC,mediumtuscanred:0x79443B,mediumvermilion:0xD9603B,mediumvioletred:0xC71585,
		mellowapricot:0xF8B878,mellowyellow:0xF8DE7E,melon:0xFDBCB4,metallicseaweed:0x0A7E8C,metallicsunburst:0x9C7C38,mexicanpink:0xE4007C,
		midnightblue:0x191970,midnightgreeneaglegreen:0x004953,mikadoyellow:0xFFC40C,mindaro:0xE3F988,mint:0x3EB489,mintcream:0xF5FFFA,
		mintgreen:0x98FF98,mistyrose:0xFFE4E1,moccasin:0xFAEBD7,modebeige:0x967117,moonstoneblue:0x73A9C2,mordantred19:0xAE0C00,
		mossgreen:0x8A9A5B,mountainmeadow:0x30BA8F,mountbattenpink:0x997A8D,msugreen:0x18453B,mughalgreen:0x306030,mulberry:0xC54B8C,
		mustard:0xFFDB58,myrtlegreen:0x317873,nadeshikopink:0xF6ADC6,napiergreen:0x2A8000,naplesyellow:0xFADA5E,navajowhite:0xFFDEAD,
		navy:0x000080,navypurple:0x9457EB,neoncarrot:0xFFA343,neonfuchsia:0xFE4164,neongreen:0x39FF14,newcar:0x214FC6,newyorkpink:0xD7837F,
		nonphotoblue:0xA4DDED,northtexasgreen:0x059033,nyanza:0xE9FFDB,oceanboatblue:0x0077BE,ochre:0xCC7722,officegreen:0x008000,
		oldburgundy:0x43302E,oldgold:0xCFB53B,oldheliotrope:0x563C5C,oldlace:0xFDF5E6,oldlavender:0x796878,oldmauve:0x673147,
		oldmossgreen:0x867E36,oldrose:0xC08081,oldsilver:0x848482,olive:0x808000,olivedrab3:0x6B8E23,olivedrab7:0x3C341F,
		olivine:0x9AB973,onyx:0x353839,operamauve:0xB784A7,orangecolorwheel:0xFF7F00,orangecrayola:0xFF7538,orangepantone:0xFF5800,
		orangeryb:0xFB9902,orange:0xFFA500,orangepeel:0xFF9F00,orangered:0xFF4500,orchid:0xDA70D6,orchidpink:0xF2BDCD,oriolesorange:0xFB4F14,
		otterbrown:0x654321,outerspace:0x414A4C,outrageousorange:0xFF6E4A,oxfordblue:0x002147,oucrimsonred:0x990000,pakistangreen:0x006600,
		palatinateblue:0x273BE2,palatinatepurple:0x682860,paleaqua:0xBCD4E6,paleblue:0xAFEEEE,palebrown:0x987654,palecarmine:0xAF4035,
		palecerulean:0x9BC4E2,palechestnut:0xDDADAF,palecopper:0xDA8A67,palecornflowerblue:0xABCDEF,palegold:0xE6BE8A,palegoldenrod:0xEEE8AA,
		palegreen:0x98FB98,palelavender:0xDCD0FF,palemagenta:0xF984E5,palepink:0xFADADD,paleplum:0xDDA0DD,paleredviolet:0xDB7093,
		palerobineggblue:0x96DED1,palesilver:0xC9C0BB,palespringbud:0xECEBBD,paletaupe:0xBC987E,paleturquoise:0xAFEEEE,paleviolet:0xCC99FF,
		palevioletred:0xDB7093,pansypurple:0x78184A,paoloveronesegreen:0x009B7D,papayawhip:0xFFEFD5,paradisepink:0xE63E62,parisgreen:0x50C878,
		pastelblue:0xAEC6CF,pastelbrown:0x836953,pastelgray:0xCFCFC4,pastelgreen:0x77DD77,pastelmagenta:0xF49AC2,pastelorange:0xFFB347,
		pastelpink:0xDEA5A4,pastelpurple:0xB39EB5,pastelred:0xFF6961,pastelviolet:0xCB99C9,pastelyellow:0xFDFD96,patriarch:0x800080,
		paynesgrey:0x536878,peach:0xFFE5B4,peach:0xFFCBA4,peachorange:0xFFCC99,peachpuff:0xFFDAB9,peachyellow:0xFADFAD,pear:0xD1E231,
		pearl:0xEAE0C8,pearlaqua:0x88D8C0,pearlypurple:0xB768A2,peridot:0xE6E200,periwinkle:0xCCCCFF,persianblue:0x1C39BB,persiangreen:0x00A693,
		persianindigo:0x32127A,persianorange:0xD99058,persianpink:0xF77FBE,persianplum:0x701C1C,persianred:0xCC3333,persianrose:0xFE28A2,
		persimmon:0xEC5800,peru:0xCD853F,phlox:0xDF00FF,phthaloblue:0x000F89,phthalogreen:0x123524,pictonblue:0x45B1E8,pictorialcarmine:0xC30B4E,
		piggypink:0xFDDDE6,pinegreen:0x01796F,pineapple:0x563C5C,pink:0xFFC0CB,pinkpantone:0xD74894,pinklace:0xFFDDF4,pinklavender:0xD8B2D1,
		pinkpearl:0xE7ACCF,pinksherbet:0xF78FA7,pistachio:0x93C572,platinum:0xE5E4E2,plum:0x8E4585,plum:0xDDA0DD,pompandpower:0x86608E,
		popstar:0xBE4F62,portlandorange:0xFF5A36,powderblue:0xB0E0E6,princetonorange:0xF58025,prune:0x701C1C,prussianblue:0x003153,
		psychedelicpurple:0xDF00FF,puce:0xCC8899,pucered:0x722F37,pullmanbrownupsbrown:0x644117,pumpkin:0xFF7518,purple:0x800080,
		purplemunsell:0x9F00C5,purplex11:0xA020F0,purpleheart:0x69359C,purplemountainmajesty:0x9678B6,purplenavy:0x4E5180,purplepizzazz:0xFE4EDA,
		purpletaupe:0x50404D,purpureus:0x9A4EAE,quartz:0x51484F,queenblue:0x436B95,queenpink:0xE8CCD7,quinacridonemagenta:0x8E3A59,
		rackley:0x5D8AA8,radicalred:0xFF355E,rajah:0xFBAB60,raspberry:0xE30B5D,raspberryglace:0x915F6D,raspberrypink:0xE25098,
		raspberryrose:0xB3446C,rawumber:0x826644,razzledazzlerose:0xFF33CC,razzmatazz:0xE3256B,razzmicberry:0x8D4E85,red:0xFF0000,
		redcrayola:0xEE204D,redmunsell:0xF2003C,redncs:0xC40233,redpantone:0xED2939,redpigment:0xED1C24,redryb:0xFE2712,redbrown:0xA52A2A,
		reddevil:0x860111,redorange:0xFF5349,redpurple:0xE40078,redviolet:0xC71585,redwood:0xA45A52,regalia:0x522D80,resolutionblue:0x002387,
		rhythm:0x777696,richblack:0x004040,richbrilliantlavender:0xF1A7FE,richcarmine:0xD70040,richelectricblue:0x0892D0,richlavender:0xA76BCF,
		richlilac:0xB666D2,richmaroon:0xB03060,riflegreen:0x444C38,roastcoffee:0x704241,robineggblue:0x00CCCC,rocketmetallic:0x8A7F80,
		romansilver:0x838996,rose:0xFF007F,rosebonbon:0xF9429E,roseebony:0x674846,rosegold:0xB76E79,rosemadder:0xE32636,rosepink:0xFF66CC,
		rosequartz:0xAA98A9,rosered:0xC21E56,rosetaupe:0x905D5D,rosevale:0xAB4E52,rosewood:0x65000B,rossocorsa:0xD40000,rosybrown:0xBC8F8F,
		royalazure:0x0038A8,royalblue1:0x002366,royalblue2:0x4169E1,royalfuchsia:0xCA2C92,royalpurple:0x7851A9,royalyellow:0xFADA5E,
		ruber:0xCE4676,rubinered:0xD10056,ruby:0xE0115F,rubyred:0x9B111E,ruddy:0xFF0028,ruddybrown:0xBB6528,ruddypink:0xE18E96,
		rufous:0xA81C07,russet:0x80461B,russiangreen:0x679267,russianviolet:0x32174D,rust:0xB7410E,rustyred:0xDA2C43,sacramentostategreen:0x00563F,
		saddlebrown:0x8B4513,safetyorangeblazeorange:0xFF6700,safetyyellow:0xEED202,saffron:0xF4C430,sage:0xBCB88A,stpatricksblue:0x23297A,
		salmon:0xFA8072,salmonpink:0xFF91A4,sand:0xC2B280,sanddune:0x967117,sandstorm:0xECD540,sandybrown:0xF4A460,sandytaupe:0x967117,
		sangria:0x92000A,sapgreen:0x507D2A,sapphire:0x0F52BA,sapphireblue:0x0067A5,satinsheengold:0xCBA135,scarlet:0xFF2400,
		scarlet:0xFD0E35,schausspink:0xFF91AF,schoolbusyellow:0xFFD800,screamingreen:0x76FF7A,seablue:0x006994,seagreen:0x2E8B57,
		sealbrown:0x321414,seashell:0xFFF5EE,selectiveyellow:0xFFBA00,sepia:0x704214,shadow:0x8A795D,shadowblue:0x778BA5,shampoo:0xFFCFF1,
		shamrockgreen:0x009E60,sheengreen:0x8FD400,shimmeringblush:0xD98695,shockingpink:0xFC0FC0,shockingpinkcrayola:0xFF6FFF,
		sienna:0x882D17,silver:0xC0C0C0,silverchalice:0xACACAC,silverlakeblue:0x5D89BA,silverpink:0xC4AEAD,silversand:0xBFC1C2,
		sinopia:0xCB410B,skobeloff:0x007474,skyblue:0x87CEEB,skymagenta:0xCF71AF,slateblue:0x6A5ACD,slategray:0x708090,smaltdarkpowderblue:0x003399,
		smitten:0xC84186,smoke:0x738276,smokyblack:0x100C08,smokytopaz:0x933D41,snow:0xFFFAFA,soap:0xCEC8EF,solidpink:0x893843,
		sonicsilver:0x757575,spartancrimson:0x9E1316,spacecadet:0x1D2951,spanishbistre:0x807532,spanishblue:0x0070B8,spanishcarmine:0xD10047,
		spanishcrimson:0xE51A4C,spanishgray:0x989898,spanishgreen:0x009150,spanishorange:0xE86100,spanishpink:0xF7BFBE,spanishred:0xE60026,
		spanishskyblue:0x00FFFF,spanishviolet:0x4C2882,spanishviridian:0x007F5C,spirodiscoball:0x0FC0FC,springbud:0xA7FC00,springgreen:0x00FF7F,
		starcommandblue:0x007BB8,steelblue:0x4682B4,steelpink:0xCC33CC,stildegrainyellow:0xFADA5E,stizza:0x990000,stormcloud:0x4F666A,
		straw:0xE4D96F,strawberry:0xFC5A8D,sunglow:0xFFCC33,sunray:0xE3AB57,sunset:0xFAD6A5,sunsetorange:0xFD5E53,superpink:0xCF6BA9,
		tan:0xD2B48C,tangelo:0xF94D00,tangerine:0xF28500,tangerineyellow:0xFFCC00,tangopink:0xE4717A,taupe:0x483C32,taupegray:0x8B8589,
		teagreen:0xD0F0C0,tearose:0xF88379,tearose:0xF4C2C2,teal:0x008080,tealblue:0x367588,tealdeer:0x99E6B3,tealgreen:0x00827F,
		telemagenta:0xCF3476,tenne:0xCD5700,terracotta:0xE2725B,thistle:0xD8BFD8,thulianpink:0xDE6FA1,ticklemepink:0xFC89AC,
		tiffanyblue:0x0ABAB5,tigerseye:0xE08D3C,timberwolf:0xDBD7D2,titaniumyellow:0xEEE600,tomato:0xFF6347,toolbox:0x746CC0,
		topaz:0xFFC87C,tractorred:0xFD0E35,trolleygrey:0x808080,tropicalrainforest:0x00755E,trueblue:0x0073CF,tuftsblue:0x417DC1,
		tulip:0xFF878D,tumbleweed:0xDEAA88,tumblr:0x2C4762,turkishrose:0xB57281,turquoise:0x40E0D0,turquoiseblue:0x00FFEF,turquoisegreen:0xA0D6B4,
		tuscan:0xFAD6A5,tuscanbrown:0x6F4E37,tuscanred:0x7C4848,tuscantan:0xA67B5B,tuscany:0xC09999,twilightlavender:0x8A496B,
		tyrianpurple:0x66023C,uablue:0x0033AA,uared:0xD9004C,ube:0x8878C3,uclablue:0x536895,uclagold:0xFFB300,ufogreen:0x3CD070,
		ultramarine:0x120A8F,ultramarineblue:0x4166F5,ultrapink:0xFF6FFF,ultrared:0xFC6C85,umber:0x635147,unbleachedsilk:0xFFDDCA,
		unitednationsblue:0x5B92E5,universityofcaliforniagold:0xB78727,unmellowyellow:0xFFFF66,upforestgreen:0x014421,upmaroon:0x7B1113,
		upsdellred:0xAE2029,urobilin:0xE1AD21,usafablue:0x004F98,usccardinal:0x990000,uscgold:0xFFCC00,universityoftennesseeorange:0xF77F00,
		utahcrimson:0xD3003F,vanilla:0xF3E5AB,vanillaice:0xF38FA9,vegasgold:0xC5B358,venetianred:0xC80815,verdigris:0x43B3AE,
		vermilion:0xE34234,vermilion:0xD9381E,veronica:0xA020F0,verylightblue:0x6666FF,verylightmalachitegreen:0x64E986,verypaleorange:0xFFDFBF,
		verypaleyellow:0xFFFFBF,violet:0x8F00FF,violetcolorwheel:0x7F00FF,violetryb:0x8601AF,violet:0xEE82EE,violetblue:0x324AB2,
		violetred:0xF75394,viridian:0x40826D,viridiangreen:0x009698,vistablue:0x7C9ED9,vividauburn:0x922724,vividburgundy:0x9F1D35,
		vividcerise:0xDA1D81,vividgamboge:0xFF9900,vividmulberry:0xB80CE3,vividorange:0xFF5F00,vividorchid:0xCC00FF,vividraspberry:0xFF006C,
		vividred:0xF70D1A,vividredtangelo:0xDF6124,vividskyblue:0x00CCFF,vividtangelo:0xF07427,vividtangerine:0xFFA089,vividviolet:0x9F00FF,
		vividyellow:0xFFE302,warmblack:0x004242,waterspout:0xA4F4F9,wenge:0x645452,wheat:0xF5DEB3,white:0xFFFFFF,whitesmoke:0xF5F5F5,
		wildblueyonder:0xA2ADD0,wildorchid:0xD470A2,wildstrawberry:0xFF43A4,wildwatermelon:0xFC6C85,willpowerorange:0xFD5800,
		windsortan:0xA75502,wine:0x722F37,winedregs:0x673147,wisteria:0xC9A0DC,woodbrown:0xC19A6B,xanadu:0x738678,yaleblue:0x0F4D92,
		yankeesblue:0x1C2841,yellow:0xFFFF00,yellowcrayola:0xFCE883,yellowmunsell:0xEFCC00,yellowncs:0xFFD300,yellowpantone:0xFEDF00,
		yellowprocess:0xFFEF00,yellowryb:0xFEFE33,yellowgreen:0x9ACD32,yelloworange:0xFFAE42,yellowrose:0xFFF000,zaffre:0x0014A8,
		zinnwalditebrown:0x2C1608,zomp:0x39A78E
	}	

	this.color = function( col ) {
		var c = this.color_wikipedia[col] // color LUT
		var a = new Float32Array(3)
		if( c === undefined ){
			// lets parse the color
			var len = col.length
			var i = 0
			c = 0
			while(i<len){
				var ch = col.charCodeAt(i++)
				if(ch >= 48 && ch <= 57){
					c = c << 4
					c += ch - 48
				}
				else if(ch >= 97 && ch <= 102){
					c = c << 4
					c += ch - 87
				}
				else if(ch >= 65 && ch <= 70){
					c = c << 4
					c += ch - 55
				}
				else{ // try to find the color
					col = col.toLowerCase()
					c = this.color_wikipedia[col]
					if(c === undefined) for(var k in this.color_wikipedia){
						if(k.indexOf(col) != -1){
							c = this.color_wikipedia[k]
							// cache it
							this.color_wikipedia[col] = c
							break
						}
					}
					len = 0
				}
			}
			if(len == 3){ 
				a[0] = ((c&0xf00)>>8|(c&0xf00)>>4) /255
				a[1] = ((c&0xf0)|(c&0xf0)>>4) /255
				a[2] = ((c&0xf)|(c&0xf)<<4) /255 
				return {f4:a, o:0}
			}
		}
		a[0] = ((c >> 16)&0xff) /255
		a[1] = ((c >> 8)&0xff) /255
		a[2] = (c&0xff) /255
		return {f4:a, o:0}
	}

	return this
}