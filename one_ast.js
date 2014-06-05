// ONEJS AST code generators
ONE.ast_ = function(){

	// include the parser
	var parser = {}
	ONE.parser_strict_.call( parser )

	var parserCache = {}

	this.parse = function( source, bind, template, filename, noclone ){
		parser.sourceFile = filename || ''

		var node = parserCache[source]
		if(! node ){
			node = parser.parse_strict( source )
			// scan up to pull ret the essential ast node			
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
		node.bind = bind
		node.source = source
		node.pthis = this

		// we now need to process our template-replaces
		if( template ){
			var nodes = template_nodes
			var copy = this.AST.Copy
			// we now need to overwrite the nodes in our tree with 
			// the template nodes
			for( var i = 0; i < nodes.length; i++ ){
				var tgt = nodes[ i ]
				var src = template[ tgt.arg.name ]
				// clean ret the node
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

	this.eval = function( ast, filename ){
		if( typeof ast == 'string' ) 
			ast = this.parse( ast, undefined, undefined, filename, true )

		// alright we have to compile us some code!
		var js = this.AST.ToJS
		// make a fresh scope and signals store
		js.scope = {}
		js.typemethods = {}
		js.signals = []
		js.line = 0
		// if passing a function we return that
		if(ast.type == 'Function'){
			var steps = ast.body.steps
			if(steps && steps[0] && steps[0].flag == 35){
				var dump = steps[0].name
				steps.splice(0,1)
				if(dump.indexOf('ast')!= -1) ONE.out( ast.toDump() )
				if(dump.indexOf('code')!=-1){
					var code = this.AST.ToCode
					ONE.out( code.Function(ast) )
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
			if(dump && dump.indexOf('js')!=-1) ONE.out( code )

			try{
				if( typeof process !== 'undefined'){
					var fn = Function.call(null, 'require', '__dirname', code)(require, __dirname)
				}
				else{
					var fn = Function.call(null, 'require', code)()
				}

			} catch(e){
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

			ThisCall: { object:1, key:1 },
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

					copy+'\treturn\n}\n'
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
			this.Walk.start = function(n){
				this.deps = []
				this[ n.type ]( n )
				return this.deps
			}
		}
		ToolGenerator.call(this)

		this.getDependencies = function(){
			return this.DepFinder.start( this )
		}

		this.DepFinder = this.Walk.extend(this, function(outer){
			this.Call = function( n, p ){
				outer.Walk.Call.call(this, n, p)
				if(n.fn.name == 'apply' || n.fn.name == 'load'){
					var arg = n.args[0]
					if(arg && arg.type == 'Value' && arg.kind == 'string'){
						this.deps.push(arg.value)
					}
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
				if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
					object = '(' + object + ')'
				// when do we need parens? if its not a key or block or call
				return object + '[' + this.expand( n.index, n ) + ']'
			}

			this.Key = function( n ){
				var obj = n.object
				var object_t = obj.type
				var object = this.expand(obj, n)
				if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
					object = '(' + object + ')'

				return  object + (this.exist?'?.':'.') + this.expand(n.key, n)
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

			this.scope = {}

			this.typelib = Object.create(outer.typeMap)
			this.defines = Object.create(null)

			this.macros = Object.create(null)
			this.macroarg = Object.create(null)

			this.promise_catch = 1
			this.expand_short_object = 1

			this.destruc_prefix = '_\u0441'
			this.desarg_prefix = '_\u0430'
			this.tmp_prefix = '_\u0442'
			this.call_tmpvar = '_\u0441'
			this.store_prefix = '_\u0455'
			this.template_marker = '\_\u0445_'
			this.template_regex = /\_\u0445\_/g

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
				window:1,
				document:1,
				require:1,
				__dirname:1
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
					return this.expand(this.macroarg[name])
				}
				var type = this.typemethod, field
				if(type && (field = type.fields[name])){
					return '_.'+type.arr+'[_.o+'+(field.off / outer.viewSize[type.view])+']'
				}
				if( name in this.scope ){
					var type = this.scope[name]
					if(n && type !== 1){
						n.infer = type
					}
					return name
				}
				if( name in this.globals ) return name
				if( name in this.defines ){
					return this.expand(this.defines[name])
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
						var base = node.name
						var type = this.scope[base]

						var isthis 
						if(type && type !== 1 || (isthis = type = this.typemethod)){
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
				var cmt = ''

				var object = this.expand(obj, n)
				var object_t = obj.type

				if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
					object = '(' + object + ')'

				// do static memory offset calculation for typed access
				var ret = this.decodeStructAccess(n)
				if(ret) return ret

				if(n.exist){
					var tmp = this.alloc_tmpvar(n)
					return '(' + tmp + '=' + object + ') && ' + tmp + '.' + n.key.name
				}
				return object + '.' + n.key.name
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

				var ret = 'var '+name+' = this.'+name+' = '

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
						type = Object.create(this.typelib[name])
						type.dim = 1
					}
					else{
						name = kind.name
						type = this.typelib[name]
					}
					if(!type) throw new Error('Cannot find type ' + name)
				}
				else if(n.id.kind ){
					type = this.typelib[n.id.kind.name]
					if(!type) throw new Error('Cannot find type ' + n.id.kind.name)
				}
				else type = 1
				this.scope[n.id.name] = type

				// if we have a type, we need to check the init call to be a constructor.
				return this.expand(n.id, n) + 
					(n.init ? this.space+'='+this.space + this.expand(n.init, n) : '')
			}
			
			this.Define = function( n ){
				// alright we got a define
				// lets splice out a macro from a define value.
				// if we are a call, we are a macro.
				if(n.id.type == 'Call'){
					var name = n.id.fn.name
					while(name in this.macros){
						name = name + '_'
					}
					this.macros[name] = n
				}
				else {
					var name = n.id.name
					this.defines[name] = n.value
				}
				return ''
			}

			this.Struct = function( n ){

				var name = n.id.name

				if(this.typelib[name]) throw new Error('Cant redefine type ' + n.id.name)

				// in a baseclass we copy the fields and methods
				var type = this.typelib[name] = {}

				type.name = name
				if(n.base){
					var base = type.base = this.typelib[n.base.name]
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

						var field = this.typelib[typename]

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
				this.scope[ n.id.name ] = 1
				return 'var ' + n.id.name + ' = this.' + n.id.name + 
						' = ' + base + '.extend(this,'+ 
						this.Function( n, null, ['outer'] ) + 
						', "' + n.id.name + '")'
			}

			this.Function = function( n, nametag, extparams, typemethod ){
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
								
									var type = this.typelib[kname]

									if(!type) throw new Error("Undefined type "+kname+" used on argument "+name)
									this.scope[ name ] = type
								}
								else this.scope[ name ] =  1
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
				if(n.arrow === '=>') bind = true

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
							ret += this.expand(n.name, n) + this.space + '=' + this.space
						}
					}
				}

				ret += 'function'

				if(n.await) ret = 'ONE.await(' + ret

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
				var binds = esc.binds = {}

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
				var bind = ''
				for( var name in binds ){
					if(bind) obj += ','
					bind += name+':'+name
				}

				ret +=  'this.parse("' + body + '"'
				if( bind ) ret += ',{' + bind + '}'
				if( obj ){
					if(!bind) ret += ',null'
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

				if(n.op == '%%') return 'this.mod(' + left + ',' + right + ')' 
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
			this.New = function( n, parens ){
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

			this.Call = function( n, extra, isnew ){
				var fn  = n.fn
				fn.parent = n
				// assert macro
				if(fn.type == 'Id' && fn.name == 'assert'){

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
					var type = this.typelib[name]
					if(type){

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
							ret = '('+output+'= {o:0,'+type.arr+':new '+type.view+'Array(' 
							if(dims) ret += '(' + this.expand(dims, n) + ')*' + nslots + ')}'
							else ret += nslots + ')}'
						}
						var slot = 0

						function walker(elem, n, issingle, type){
							// we have a call
							var ntype
							if(elem.type == 'Call' && elem.fn.type == 'Id' && (ntype = this.typelib[elem.fn.name])){
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

					// do macros
					var macro = this.macros[name]
					if(macro){
						var a = this.macroarg
						var marg = this.macroarg = Object.create(this.macroarg)
						var params
						// alright lets go and define the macro args
						while(macro){
							//!TODO add type checking here
							params = macro.id.args
							if(arglen == params.length) break
							name = name + 'params'
							macro = this.macros[name]
						}
						if(!macro) throw new Error('No matching macro found')
						// build up macro args
						for(var i = 0; i < arglen; i++){
							var param = params[i]
							// check if we have a default arg
							if(param.type == 'Assign'){
								throw new Error('implement macro default arg')
							}
							this.macroarg[param.name] = args[i]
						}
						var ret = this.expand( macro.value )
						this.macroarg = a
						return ret
					}

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
						var type = this.scope[root.name] || (isstatic = this.typelib[root.name])
						if(type && type !== 1){ 
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

							if(!this.typemethods[gen]){
								var d = this.depth
								this.depth = ''
								var t = this.typemethod
								this.typemethod = type
								this.typemethods[gen] = this.Function(method, gen, undefined, type ) + this.newline
								this.typemethod = t
								this.depth = d
							}
							// we need to plug this at the head of our generated function.

							var ret = ''
							ret += gen+'.call(this'
							if(isstatic){
								ret += ',{o:0,'+type.arr+':new ' + type.view + 'Array(' + type.slots + ')}'
							} 
							else ret += ', ' + root.name

							// set up the call and argument list
							for(var i = 0; i < arglen; i++){
								var arg = args[i]
								ret += ', ' + this.expand(arg, n)
								if(arg.type == 'Rest') throw new Error('... is not supported in typed calls')
							}
							ret += ')'
							return ret
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
						else if(name == 'call' || name == 'apply'){
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
										else sarg = this.expand(arg, n)
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
				if(fn.type == 'Id'){
					cthis = 'this'
					call = this.expand(fn, n)
				}
				else {
					// check if we are a property chain
					if(fn.type == 'Key' || fn.type == 'Index'){
						if(fn.isKeyChain()){
							// no tempvar
							cthis = this.expand(fn.object, fn)
							if(fn.type == 'Index') call = cthis + '[' + this.expand(fn.index, fn) + ']'
							else call = cthis + '.' + fn.key.name
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
					else if(fn.type == 'Index'){

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
				if(cthis == 'Math'){
					return call+'('+sarg+')'
				}
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
				return 'this.parse("' + body + '",null'+(obj?',{' + obj + '})':')')
			}

			this.Rest = function( n ){
				throw new Error("dont know what to do with isolated rest object")
			}

			this.Do = function( n ){
				var call = n.call

				var extra = [n.arg]
				if(n.catch){
					extra.push( n.catch )
				}

				var then = (n.then ? this.expand(n.then, n) : '')
				if( call.type == 'Id' && call.name == 'then'){
					throw new Error('implement then chaining in codegen')
				}
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

	this.color = (function(){
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
			var a = new Float32Array(3)
			a[0] = (c>>16)/255
			a[1] = ((c>>8)&0xff)/255
			a[2] = (c&0xff)/255
			colors[sl] = colors[s] = {f4:a,o:0}
		}

		// color to array decoder
		return function( col ) {
			if( typeof col == 'string' ) {
				var c = colors[ col ] // color LUT
				if( c ) return c
				var c = parseInt(col, 16)
				var a = new Float32Array(3)
				if(col.length == 4){ 
					a[0] = ((c&0xf00)>>8|(c&0xf00)>>4) /255
					a[1] = ((c&0xf0)|(c&0xf0)>>4) /255
					a[2] = ((c&0xf)|(c&0xf)<<4) /255 
				}
				else {
					a[0] = ((c >> 16)&0xff) /255
					a[1] = ((c >> 8)&0xff) /255
					a[2] = (c&0xff) /255
				}
				return {f4:a, o:0}
			}
			//if( typeof col == 'object' && Array.isArray( col ) && (col.length == 3 || col.length == 4) && typeof col[0] == 'number' ) return col
		}
	})()

	return this

}