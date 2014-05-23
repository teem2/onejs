
// ONEJS AST code generators
ONE.ast_ = function(){

	// include the parser
	var parser = {}
	ONE.parser_strict_.call( parser )

	var parserCache = {}

	this.parse = function( source, bind, template, filename, noclone ){
		parser.sourceFile = filename || ''

		var node = parserCache[source]
		if (! node ){
			node = parser.parse_strict( source )
			
			// scan up to pull ret the essential ast node			
			if(node.steps.length == 1){
				var cm = node.comments
				node = node.steps[0]
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

	this.eval = function( ast, comments, filename ){
		if( typeof ast == 'string' ) 
			ast = this.parse( ast, undefined, undefined, filename, true )

		// alright we have to compile us some code!
		var js = this.AST.ToJS
		// make a fresh scope and signals store
		js.scope = {}
		js.signals = []
		js.line = 0
		js.comments = comments
		// if passing a function we return that
		if(ast.type == 'Function'){
			var steps = ast.body.steps

			if(steps && steps[0] && steps[0].flag == 35){
				var dump = steps[0].name
				steps.splice(0,1)
				if(dump.indexOf('ast')!= -1) ONE.out( ast.toDump() )
				if(dump.indexOf('code')!=-1){
					var code = this.AST.ToCode
					code.comments = comments
					ONE.out( code.Function(ast) )
				}
			}
			// name anonmous function with a filename if possible
			var nametag
			if(filename) nametag = 'file__'+filename.replace(/[\.\/]/g,'_')
			var code = 'return ' + js.Function( ast, false, nametag )
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

			Id: { name:0, flag:0, isType:0 },
			Type: { name:0 },
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
			Struct: { id:1, struct:1, defs:2, dim:1 },
			Enum: { id:1, enums:1 },

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
			for( type in ast ){
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

					} else if( t === 1){
						clone += '\tvar _'+v+' = n.'+k+'\n'+
							'\tif(_'+v+') c.'+k+' = this[_'+v+'.type](_'+v+')\n'

						walk += '\tvar _'+v+' = n.'+k+'\n'+
							'\tif(_'+v+' && this[_'+v+'.type](_'+v+', n)) return 1\n'

					} else if(t === 2){
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

					}else if(t === 3){
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
				if(node.type == 'Id') return true
				if(node.type != 'Key') return false
				node = node.object
			}
			return false
		}

		this.toJS = function(comments){
			var js = this.ToJS
			js.line = 0
			js.scope = {}
			js.comments = comments
			return js.expand( this )
		}

		this.toString =
		this.toCode = function(comments){
			var code = this.ToCode
			code.line = 0
			code.comments = comments
			return code.expand( this )
		}

		this.ToCode = this.Base.extend(function(outer){

			this.space = ' '
			this.newline = '\n'
			this.indent = '\t'
			this.semi = ''
			this.depth = ''
			
			// comment restoration
			this.cignore = 0
			this.comments = 1
			this.line = 0

			this.array_fix = 0 //!TODO do this nicely
			this.expand_short_object = 0


			this.store = function( n, value ){
				return value + '..'
			}

			this.expand = function( n, parent, parens, term ){ // recursive expansion
				if( !n || !n.type ) return term || ''
				n.parent = parent
				n.genstart = this.line
				var ret = this[ n.type ]( n, parens )
				n.genend = this.line

				if(n.store){ // someone wants a tempstore
					ret = this.store(n, ret)
				}
				// do some comments restoration
				var comments = n.comments
				if( this.comments && comments && !this.cignore ){
					ret += this.comments_flush( n.comments, term )
				} 
				else if( term ) return ret + term
				if( this.cignore ) this.cignore--

				return ret
			}

			this.comments_flush = function( array, term ){
				if(!this.comments) return ''
				var cmt = array
				var ret = ''
				var len = cmt.length
				if( term && len ) ret += term
				for(var j = 0;j<len;j++){
					var c = cmt[j]
					if( c === -1 ) ret += this.newline, this.line++
					else ret += (j?this.depth:' ') + '// ' + c
				}
				return ret
			}

			this.comments_or_newline = function( n ){
				if(n.comments && n.comments.length && this.comments){
					var ret 
					var old = this.depth
					this.depth += this.indent
					ret = this.comments_flush( n.comments )
					this.depth = old
					return ret
				}
				return this.newline
			}

			this.block = function( n, parent, noindent ){ // term split array
				var old_depth = this.depth
				if(!noindent) this.depth += this.indent
				var ret = ''
				for( var i = 0; i < n.length; i++ ){
					var b = n[ i ]
					var blk = this.expand( b, parent )
					if(blk[0] == '(' || blk[0] == '[') ret += this.depth + this.semi + blk
					else ret += this.depth + blk
					var ch = ret[ret.length - 1]
					if(!this.comments || ch !== '\n' ){
						//if( ch == '}') ret += this.newline, this.line++
						ret += this.newline, this.line++
					}
				}
				this.depth = old_depth
				return ret
			}

			this.flat = function( n, parent ){
				if(n.length == 0) return ''
				var ret = ''
				var len = n.length
				for( var i = 0; i < len; i++ ){
					if(i) ret += ',' + this.space
					ret += this.expand( n[ i ], parent )
				}
				return ret
			}

			this.list = function( n, parent ){
				if(n.length == 0) return ''
				//var old_depth = this.depth
				//this.depth += this.indent
				var ret = ''
				var len = n.length
				var term = ',' + this.space
				for( var i = 0; i < len; i++ ){
					ret += this.expand( n[ i ], parent, false, i<len-1?term:'' )
					if( ret[ ret.length - 1 ] == '\n' ) ret += i == len - 1? this.depth:this.depth+this.indent
				}
				//this.depth = old_depth
				return ret
			}

			this.Program = function( n ){ 
				return this.block( n.steps, n, true )
			}

			this.Empty = function( n ){ 
				return ''
			}

			this.Id = function( n ){
				var flag = n.flag
				if(flag){
					if(flag === -1) return '..'
					if(flag === 46) return '.' + n.name
					if(flag === 126) return n.name+'~'
					if(flag === 33) return n.name+'!'
					if(flag === 64) return '@'+n.name
					if(flag === 35) return '#'+n.name
				}
				return n.name
			}

			this.Type = function( n ){
				return n.name
			}

			this.Value = function( n ){ 
				return n.raw 
			}
			 // string, number, bool
			this.This = function( n ){ 
				return 'this'
			}

			this.Array = function( n ){
				//!TODO x = [\n[1]\n[2]] barfs up with comments
				var old_cmt = this.comments
				if(this.array_fix++>0) this.comments = 0
				var ret = '['+ 
					(n.comments&&this.comments?this.comments_flush( n.comments )+this.depth+(n.elems.length?this.indent:''):'') + 
					this.list( n.elems, n ) + 
				']' 
				this.array_fix--
				this.comments = old_cmt
				this.cignore = 1
				return ret
			}

			this.Object = function( n ){ 
				var old_cmt = this.comments
				if(this.array_fix++>0) this.comments = 0
				var old_depth = this.depth
				this.depth += this.indent
				var k = n.keys
				var len = k.length
				var ret = '{' + this.space
				if(n.comments){
					ret += this.comments_flush( n.comments )
					if( !len ) ret += old_depth
				}
				var lastcm = ''
				var vc = 0
				for( var i = 0; i < len; i++ ){
					var prop = k[i]
					if( i ) ret += ',' + this.space + lastcm
					lastcm = ''
					var ch = ret[ ret.length -1 ]
					if( ch == '\n' ) ret += this.depth
					else if( ch == '}' ) ret +=  this.newline + this.depth
					ret += (prop.key.name || prop.key.raw) 

					if(prop.short === undefined){
						ret += ':' + this.expand( prop.value, n )
					}
					else{
						if(this.expand_short_object){
							ret += ':' + this.resolve( prop.key.name )
						}
						if( prop.key.comments ){
							lastcm = this.comments_or_newline( prop.key )
							if( i == len - 1) ret += lastcm
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
				this.array_fix--
				this.comments = old_cmt
				this.cignore = 1
				return ret
			}

			this.Index = function( n ){
				return this.expand( n.object, n, true ) + '[' + this.expand( n.index, n ) + ']'
			}

			this.Key = function( n ){
				var left = this.expand( n.object, n, true )
				return  left + (this.exist?'?.':(left[left.length - 1] == '.'?'':'.')) + this.expand( n.key, n )
			}

			this.Block = function( n ){
				var ret = '{' + this.comments_or_newline( n ) + this.block( n.steps, n ) + this.depth + '}'
				this.cignore =1 
				return ret
			}

			this.List = function( n, parens ){
				if( parens ) '('+this.list( n.items, n ) +')'
				return this.list( n.items, n )
			}

			this.Comprehension = function( n, parens ){
				return '1'
			}

			this.Template = function( n, parens ){
				var ret = '"'
				var chain = n.chain
				var len = chain.length 
				for(var i = 0; i < len; i++){
					var item = chain[i]
					if(item.type == 'Block'){
						if(item.steps.length == 1 &&
							outer.IsExpr[item.steps[0].type]){
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
				return 'break'+(n.label?' '+this.expand( n.label, n ):'')
			}

			this.Continue = function( n ){
				return 'continue'+(n.label?' '+this.expand( n.label, n ):'')
			}

			this.Label = function( n ){
				return this.expand( n.label, n )+':'+this.expand( n.body, n )
			}

			this.If = function( n ) {
				var ret = 'if('
				ret += this.expand( n.test, n )
				if( ret[ret.length - 1] == '\n') ret += this.depth + this.indent
				ret += ')' + this.space + this.expand( n.then, n, true ) 
				if(n.else){
					var ch = ret[ret.length - 1]
					if( ch !== '\n' ) ret += this.newline
					ret += this.depth + 'else ' + this.expand( n.else, n, true )
				}
				return ret
			}

			this.Switch = function( n ){
				var old_cmt = this.comments
				this.comments = 0 // dont allow comments in the switch on
				var ret = 'switch('+this.expand( n.on, n )+'){'
				this.comments = old_cmt
				ret += this.comments_or_newline( n.on )
				var old = this.depth
				this.depth += this.indent				
				var cases = n.cases
				if(cases) for( var i = 0; i < cases.length; i++ ) ret += this.depth + this.expand( cases[ i ], n )
				this.depth = old
				ret += this.depth + '}'
				return ret
			}

			this.Case = function( n ){
				if( !n.test) return 'default:'+( n.then.length ? this.newline+this.block( n.then, n ) : this.newline )
				var ret = 'case '
				var old_cmt = this.comments
				this.comments = 0
				ret += this.expand( n.test, n ) + ':' 
				this.comments = old_cmt
				ret += this.comments_or_newline(n.test)
				if (n.then.length) ret += this.block( n.then, n )
				return ret
			}

			this.Throw = function( n ){
				return 'throw ' + this.expand( n.arg, n )
			}

			this.Try = function( n ){
				var ret = 'try' + this.expand( n.try, n )
				if(n.catch){
					if(n.arg.type !== 'Id') throw new Error("unsupported catch type")
					var name = n.arg.name 
					var inscope = this.scope[ name ]
					if(!inscope) this.scope[ name ] = 1
					ret += 'catch('+name+')'+this.expand( n.catch, n )
					if(!inscope) this.scope[ name ] = undefined

				} 

				if(n.finally) ret += 'finally'+this.expand( n.finally, n )
				return ret
			}

			this.While = function( n ){
				return 'while(' + this.expand( n.test, n ) + ')' + 
					this.expand( n.loop, n )
			}

			this.DoWhile = function( n ){
				return 'do' + this.expand( n.loop, n ) + 
					'while(' + this.expand( n.test, n ) + ')'
			}

			this.For = function( n ){
				return 'for(' + this.expand( n.init, n )+';'+
						this.expand( n.test, n ) + ';' +
						this.expand( n.update, n ) + ')' + 
						this.expand( n.loop, n )
			}

			this.ForIn = function( n ){
				return 'for(' + this.expand( n.left, n ) + ' in ' +
					this.expand( n.right, n ) + ')' + 
					this.expand( n.loop, n )
			}

			this.ForOf = function( n ){

				return 'for(' + this.expand( n.left, n ) + ' of ' +
					this.expand( n.right, n ) + ')' + 
					this.expand( n.loop, n )
			}

			this.ForTo = function( n ){
				return 'for(' + this.expand( n.left, n ) + ' to ' +
					this.expand( n.right, n ) + 
					(n.in?' in ' + this.expand( n.in, n ):'') + ')' + 
					this.expand( n.loop, n )
			}

			this.Var = function( n ){
				return (n.const?'const ':'var ') + this.flat( n.defs, n )
			}

			this.Const = function( n ){
				return 'const ' + this.flat( n.defs, n )
			}

			this.TypeVar = function( n ){
				return this.expand(n.kind, n) + 
					( n.dim !== undefined ? '[' + 
						( n.dim ? this.expand(n.dim, n):'') + 
						']': '') + ' ' + 
					this.flat( n.defs, n )
			}

			this.Def = function( n ){
				return this.expand( n.id, n ) + 
					( n.dim !== undefined ? '[' + 
						(n.dim?this.expand(n.dim, n):'') + 
						']':'') +
					(n.init ? this.space + '=' + this.space + this.expand(n.init, n) : '')
			}

			this.Struct = function( n ){
				return 'struct ' + this.expand( n.id, n) + 
					(n.struct ? this.expand( n.struct, n): ' '+this.list( n.defs, n ) )
			}

			this.Enum = function( n ){
				return 'enum ' + this.expand( n.id, n) + this.expand( n.enums, n)
			}

			this.Function = function( n, parens ){
				if(n.arrow){
					var arrow = n.arrow
					// if an arrow has just one Id as arg leave off ( )
					if( !n.rest && n.params && n.params.length == 1 && !n.params[0].init && n.params[0].id.type == 'Id' ){
						return this.expand( n.params[0].id, n ) + arrow + this.expand( n.body, n )
					}
					var ret = ''
					if(n.name)  ret += this.expand(n.name)

					ret += '(' +(n.params?this.list( n.params, n ):'') + 
						(n.rest ? ',' + this.space + this.expand( n.rest, n ) : '' )+ ')' 
					if(!n.name || n.body.type != 'Block' || arrow != '->') ret += arrow
					ret += this.expand( n.body, n )
					this.cignore = 1
					return ret
				}
				var ret = 'function'
				if( n.gen ) ret += '*'
				if( n.id ) ret += ' '+this.expand( n.id, n )
				ret += '('+this.list( n.params, n )
				if( n.rest ) ret += ',' + this.expand(n.rest, n) 
				ret += ')'
				ret += this.expand( n.body, n )
				this.cignore = 1
				if( parens ) return '(' +ret + ')'
				return ret
			}

			this.Return = function( n ){
				return 'return' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			}

			this.Yield = function( n ){
				return 'yield' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			}

			this.Await = function( n ){
				return 'await' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			}

			this.Unary = function( n ){
				if( n.prefix ){
					if(n.op.length != 1)
						return n.op + ' ' + this.expand( n.arg, n )
					return n.op + this.expand( n.arg, n )
				}
				return this.expand ( n.arg, n ) + n.op
			}

			this.Binary = function( n, parens ){
				var ret
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left, n ) + ')' + this.space + n.op + this.space + this.expand( n.right, n )
				} 
				else {
					ret = this.expand( n.left, n, false, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right, n )
				}
				if( parens ) return '(' + ret + ')'
				return ret
			}

			this.Logic = function( n, parens ){
				var ret
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left, n ) + ')' + this.space + n.op + this.space + this.expand( n.right, n )
				} 
				else {
					ret = this.expand( n.left, n, false, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right, n )
				}
				if( parens ) return '(' + ret + ')'
				return ret
			}

			this.Signal = function( n, parens ){
				var ret
				ret = this.expand( n.left, n, false, ':')
				if(!n.lazy) ret += '='
				if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
				ret += this.space + this.expand( n.right, n )
				if( parens ) return '(' + ret + ')'
				return ret
			}

			this.Assign = function( n, parens ){
				var ret
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left, n ) + ')' + this.space + n.op + this.space + this.expand( n.right, n )
				} 
				else {
					ret = this.expand( n.left, n, false, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right, n )
				}
				if( parens ) return '(' + ret + ')'
				return ret

			}

			this.Update = function( n, parens ){
				var ret 
				if( n.prefix ) ret = n.op + this.expand( n.arg, n )
				else ret = this.expand ( n.arg, n ) + n.op
				if( parens ) return '(' + ret + ')'
				return ret
			}

			this.Condition = function( n ){
				return this.expand( n.test, n )+ this.space +'?'+ this.space +this.expand( n.then, n )+ this.space +':'+ this.space +this.expand( n.else, n )
			}

			this.New = function( n ){
				return 'new ' + this.expand( n.fn, n, true ) + '(' + this.list( n.args, n ) + ')'
			}

			this.Call = function( n ){
				return this.expand( n.fn, n, true ) + '(' + this.list( n.args, n ) + ')'
			}

			this.Class = function( n ){
				var ret = 'class ' + n.id.name
				if(n.base) ret += ' extends ' + n.base.name 
				ret += this.expand( n.body, n )
				return ret
			}

			this.Quote = function( n, parens ){
				var ret = ':' + this.expand( n.quote, n )
				if( parens ) return '(' +ret + ')'
				return ret
			}

			this.Rest = function( n ){
				var ret = ''
				for(var i = 0;i< n.dots;i++) ret += '.'
				ret += this.expand( n.id, n )
				return ret
			}

			this.Path = function( n ){
				var ret = ''
				for(var i = 0;i< n.dots;i++) ret += '.'
				ret += n.op + this.expand( n.id, n )
				return ret
			}

			this.Do = function( n ){
				var ret = ''
				ret += this.expand( n.call, n ) 
				if(ret[ ret.length -1 ] == '\n') ret += this.depth + 'do '
				else ret += ' do '
				ret += this.expand( n.arg, n )
				if( n.catch ){
					if( ret[ ret.length -1 ] == '\n') ret += this.depth
					ret += 'catch ' + this.expand( n.catch )
				}
				if( n.then ){
					if(ret[ ret.length - 1] == '}') ret += this.newline + this.depth
					if(ret[ ret.length -1 ] == '\n') ret += this.depth
					ret += this.expand( n.then )
				}
				return ret
			}

			this.Create = function( n ){
				return this.expand( n.object, n ) + this.expand( n.body, n )
			}

			this.Debugger = function( n ){
				return 'debugger'
			}

			this.With = function( n ){
				return 'with(' + this.expand( n.object, n ) + ')' + this.expand( n.body, n )
			}
		})

		this.ToEscaped = this.ToCode.extend(this, function(outer){
			
			this.newline = ' \\n\\\n'
			this.indent = '\t'

			this.Unary = function( n ){
				if( n.prefix ){
					if(n.op == '%' && this.templates){
						if(n.arg.type != 'Id') throw new Error("Unknown template & variable type")
						this.templates[n.arg.name] = 1
					}
					if(n.op.length != 1)
						return n.op + ' ' + this.expand( n.arg, n )
					return n.op + this.expand( n.arg, n )
				}
				return this.expand ( n.arg, n ) + n.op
			}

			this.Value = function( n ){
				if(n.kind == 'string' || n.kind == 'regexp'){
					// escape ' and "
					return n.raw.replace(/"/g,'\\"').replace(/'/g,"\\'")
				}
				return n.raw
			}
		})

		this.ToJS = this.ToCode.extend(this, function(outer){
			
			this.newline = '\n'
			this.semi = ';'
			this.scope = {}
			this.promise_catch = 1
			this.expand_short_object = 1
			this.destruc_prefix = '_\u0441'
			this.desarg_prefix = '_\u0430'
			this.tmp_prefix = '_\u0442'
			this.call_tmpvar = '_\u0441'
			this.store_prefix = '_\u0455'

			this.globals = {
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
				require:1,
				__dirname:1
			}

			this.store = function(n, value ){
				var fn = this.find_function( n )
				if(!fn.store_var) fn.store_var = 1
				return '('+this.store_prefix+'='+value + ')'
			}

			this.resolve = function( name ){
				if( name in this.scope ) return name
				if( name in this.globals ) return name
				return 'this.'+name
			}

			this.Id = function( n ){
				var flag = n.flag
				if( flag ){
					if(flag === -1){
						var fn = this.find_function( n )
						if(!fn.store_var) throw new Error("Storage .. operator read but not set in function")
						return this.store_prefix
					}
					if(flag === 35) return 'this.color("'+n.name+'")'
					if(flag === 64){
						if(n.name == undefined) return 'this'
						return 'this.' + n.name
					}
				}

				return this.resolve( n.name )
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

			this.Index = function( n ){
				return this.expand( n.object, n, true ) + '[' + this.expand( n.index, n ) + ']'
			}

			this.Key = function( n, paren ){
				if( n.key.type !== 'Id' ) throw new Error('Unknown key type')
				var key = n.key
				var comments = key.comments
				var cmt = ''
				if( comments ) cmt = this.comments_flush( comments )
				if( n.exist ){
					var fn = this.find_function( n )
					if(!fn.tmp_vars) fn.tmp_vars = 0
					var tmp = this.tmp_prefix + (fn.tmp_vars++)
					var ret = '('+tmp+'='+this.expand( n.object, n, true )+') && '+tmp+'.'+n.key.name+cmt
					if(paren) return '(' + ret + ')'
					return ret
				} 
				return this.expand( n.object, n, true ) + '.' + n.key.name + cmt
			}
			
			this.Array = function( n ){
				//!TODO x = [\n[1]\n[2]] barfs up with comments
				var old_cmt = this.comments
				if(this.array_fix++>0) this.comments = 0

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
						(n.comments&&this.comments?this.comments_flush( n.comments )+this.depth+(n.elems.length?this.indent:''):'') + 
						this.list( n.elems, n ) + 
					']' 
				}
				this.array_fix--
				this.comments = old_cmt
				this.cignore = 1
				return ret
			}
					
			this.Enum = function( n ){
				// okay lets convert our enum structure into an object on this.
				// we can accept a block with steps of type assign
				// and a lefthandside of type id
				// right hand side is auto-enumerated when not provided

				var name = n.id.name 

				ret = 'var '+name+' = this.'+name+' = '

				var olddepth = this.depth
				this.depth += this.indent
				ret += '{'
				var elem = n.enums.steps
				if(!elem || !elem.length) return ret + '}'
				ret += this.newline

				var last = 0
				for(var i = 0;i<elem.length;i++){
					var item = elem[i]
					var nocomma = i == elem.length - 1
					if(! outer.IsExpr[ item.type ] ) throw new Error("Unexpected enum item")
					// lets check our property 
					if(item.type == 'Id'){
						ret += this.depth + item.name + ':' + (++last) + (nocomma?'':',')+this.newline
					}
					else if(item.type == 'Assign'){
						if(item.left.type !== 'Id') throw new Error("Unexpected enum assign")
						if(item.right.type !== 'Value') throw new Error("Unexpected enum assign")
						ret += this.depth + item.left.name + ':' + item.right.raw + (nocomma?'':',')+this.newline
						last = item.right.value
					} 
					else throw new Error("Unexpected enum item "+item.type)
				}
				ret += olddepth + '}'
				this.depth = olddepth
				return ret
			}

			this.Comprehension = function( n, parens ){
				var ret = '(function(){'
				var odepth = this.depth
				this.depth += this.indent

				// allocate a tempvar
				var fn = this.find_function( n )

				var tmp = this.tmp_prefix
				ret += 'var '+tmp + '=[]' + this.newline

				var old_compr = this.compr_assign
				this.compr_assign = tmp +'.push'
				ret += this.depth + this.expand(n.for) +this.newline
				ret += this.depth +'return '+tmp
				this.compr_assign = old_compr
				this.depth = odepth

				ret += this.newline+this.depth + '}).call(this)'
				return ret
			}

			this.Template = function( n, parens ){
				var ret = '"'
				var chain = n.chain
				var len = chain.length 
				for(var i = 0; i < len; i++){
					var item = chain[i]
					if(item.type == 'Block'){
						if(item.steps.length == 1 &&
							outer.IsExpr[item.steps[0].type]){
							ret += '"+' + this.expand(item.steps[0], n, true) + '+"'
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
				ret += this.expand( n.test, n )
				if( ret[ret.length - 1] == '\n') ret += this.depth + this.indent
				var then = this.expand( n.then, n, true ) 
				ret +=  ')' + this.space

				if(n.compr && outer.IsExpr[n.then.type]){
					ret += this.compr_assign + '(' + then +')'
				} else ret += then

				if(n.else){
					var ch = ret[ret.length - 1]
					if( ch !== '\n' ) ret += this.newline
					ret += this.depth + 'else ' + this.expand( n.else, n, true )
				}
				return ret
			}

			this.For = function( n ){
				var ret ='for(' + this.expand( n.init, n )+';'+
						this.expand( n.test, n ) + ';' +
						this.expand( n.update, n ) + ')'	
				var loop = this.expand( n.loop, n )
				if(n.compr){
					ret += this.compr_assign + '(' + loop + ')'
				}
				else ret += loop
				return ret
			}
			// Complete for of polyfill with iterator and destructuring support
			this.ForOf = function( n ){
				// lets allocate some 
				var fn = this.find_function( n )
				if(!fn.tmp_vars) fn.tmp_vars = 0

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
				var result = this.tmp_prefix + (fn.tmp_vars++)
				var iter = this.tmp_prefix + (fn.tmp_vars++)
				
				var ret = 'for('
				ret += iter+'=ONE.iterator(' + this.expand(n.right) + '),'+result+'=null;' +
						iter+'&&(!'+result+'||!'+result+'.done);){'+this.newline
				var odepth = this.depth
				this.depth += this.indent 
				ret += this.depth + result + '=' + iter + '.next()' + this.newline
				// destructure result.value
				if(destruc){
					var vars = []
					var destr = this.depth+';'+this.destructure(n, destruc, result+'.value', this.find_function( n ), vars)
					if( isvar ){
						ret += this.depth + 'var '
						for(var i = 0;i<vars.length;i++){
							var name = vars[i].name
							this.scope[ name ] = 1
							if(i) ret += ','
							ret += name
						}
						ret += this.newline
					}
					ret += destr
				} else {
					ret += this.depth + value + '=' + result + '.value' + this.newline
				}			
				this.depth = odepth
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
			},
			// a high perf for over an array, nothing more.
			this.ForFrom = function( n ){
				// lets allocate some 
				var fn = this.find_function( n )
				if(!fn.tmp_vars) fn.tmp_vars = 0

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
				if(!iter) iter = this.tmp_prefix + (fn.tmp_vars++)
				if(!alen) alen = this.tmp_prefix + (fn.tmp_vars++)
				arr = this.tmp_prefix + (fn.tmp_vars++)
				// and then we have to allocate two or three tmpvars.
				// we fetch the 
				var ret = 'for('
				if( isvar ) ret += 'var '
				ret += arr+'='+this.expand(n.right)+','+alen+'='+arr+'.length,'+
					iter+'=0,'+value+'='+arr+'[0];'+iter+'<'+alen+';'+value+'='+arr+'[++'+iter+'])' 
				var loop = this.expand(n.loop, n)

				if(n.compr) ret += this.comp_assign +'('+loop+')'
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
				var ret = 'for(' + this.expand( n.left, n )+';'+
						iter+'<'+ this.expand( n.right, n)+';'+iter+'++)'
				var loop = this.expand( n.loop, n )
				if(n.compr && outer.IsExpr[n.loop.type]){
					ret += this.compr_assign +'('+loop+')'
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
						if(def.init) ret += ',' + this.expand( def.init, def )
						ret += ')'
					}
					return ret
				}else 
				if(name == 'get' || name == 'set'){
					var fn = name == 'get' ? '__defineGetter__' : '__defineSetter__'
					var ret = ''
					var defs = n.defs
					var len = defs.length
					for( var i = 0; i < len; i++ ){
						var def = defs[i]
						def.parent = n
						if(i) ret += this.newline + this.depth
						if(!def.init || def.init.type !== 'Function') throw new Error('Cannot define non function getter/setter')
						ret += 'this.'+fn+'("' + def.id.name + '",'+
							this.expand( def.init, def) + ')'
					}
					return ret
				}
				
				throw new Error("implement TypeVar")
			}

			this.Def = function( n ){
				// destructuring
				if(n.id.type == 'Array' || n.id.type == 'Object'){
					var vars = []
					var ret = this.destructure(n, n.id, n.init, this.find_function( n ), vars)
					for(var i = 0;i<vars.length;i++){
						this.scope[ vars[i].name ] = 1
					}
					return vars.join(','+this.space)+','+this.space+this.destruc_prefix+'0='+ret
				}
				else if( n.id.type !== 'Id' ) throw new Error('Unknown id type')

				if( n.dim !== undefined ) throw new Error('Dont know what to do with dimensions')

				this.scope[ n.id.name ] = 1

				return this.expand( n.id, n ) + 
					(n.init ? this.space+'='+this.space + this.expand(n.init, n) : '')
			}

			this.Struct = function( n ){
				throw new Error("implement Struct")
			}

			this.Class = function( n ){
				
				var base = n.base?this.expand(n.base, n):'this.Base'
				this.scope[ n.id.name ] = 1
				return 'var ' + n.id.name + ' = this.' + n.id.name + 
						' = ' + base + '.extend(this,'+ 
						this.Function( n, false, null, ['outer'] ) + 
						', "' + n.id.name + '")'
			}

			this.Function = function( n, parens, nametag, extparams ){
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
					this.scope[ name ] = 1
					if(plen)
						str_body += this.depth + 'var '+name+' = arguments.length>' + plen + '?' + 
						'Array.prototype.slice.call(arguments,' + plen + '):[]' + this.newline
					else
						str_body += this.depth + 'var '+name+' = Array.prototype.slice.call(arguments,0)' + this.newline
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
							str_param += tmp + (i == plen - 1?'':split)
						} else {
							var name = param.id.name
							str_param += name + (i == plen - 1?'':split )//name
							if( str_param[str_param.length - 1] == '\n' ) str_param += this.depth
							if(param.init){
								str_body += this.depth + 'if('+name+'===undefined)' +name+'='+this.expand( param.init, param ) + this.newline 
							}
							if(param.id.flag == 46){
								str_body += this.depth +'this.'+name+'='+name+';'+this.newline 
							} 
							else this.scope[ name ] = 1
	
						}
					}
				}
				if( extparams ){
					var split = ','+this.space
					var exlen = extparams.length
					for(var i = 0;i<exlen;i++){
						var name = extparams[i]
						this.scope[name] = 1
						if(i) str_param += split
						str_param += name
					}
				}

				// expand the function
				if( n.body.type == 'Block' ){
					var steps = n.body.steps
					n.body.parent = n
					// we can do a simple wait transform
					str_body += this.block( n.body.steps, n.body, 1 )
					//for( var i = 0; i < steps.length; i++ ){
					//	str_body += this.depth + this.expand( steps[ i ] ) + this.semi + this.newline
					//}
				} else str_body += this.depth + 'return ' + this.expand( n.body, n ) //+ this.semi + this.newline

				// Auto function to this bind detection
				var bind = false
				if(n.arrow === '=>') bind = true

				var ret = ''
				var isvarbind
				if(n.name){
					if(n.name.name == 'bind' && !n.name.flag){
						ret += '('
						isvarbind = true
					} 
					else {
						ret += this.expand(n.name, n) + this.space + '=' + this.space
					}
				}

				ret += 'function'

				if(n.await) ret = 'ONE.await(' + ret

				if(n.gen || n.auto_gen) ret += '*'
				if( nametag === null ) ret += ''
				else if( nametag ) ret += ' '+nametag
				else if(n.id) ret += ' '+this.expand( n.id, n )

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
					ret += 'var ' + tmp +';' + this.newline
				}

				this.depth = olddepth
				this.scope = scope

				ret += this.comments_or_newline(n.body) + str_body + this.depth 

				if( ret[ret.length - 1] != '\n') ret += this.newline + this.depth
				ret += '}'
				if( n.await ){
					if( bind ) ret += ',this'
					ret += ')'
				}
				else if( bind )ret += '.bind(this)'

				if(isvarbind){
					ret += ').call(this'
					for(var i = 0; i < plen;i ++){
						ret += ',' + this.resolve( params[i].id )
					}
					ret += ')'
				} else if( parens ) return '('+ret+')'
				this.cignore = 1
				
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

			this.Yield = function( n ){
				var fn = this.find_function( n )
				if(!fn) throw new Error('Yield cannot find enclosing function')
				fn.auto_gen = 1
				return 'yield' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			}

			this.Await = function( n ){
				var fn = this.find_function( n )
				if(!fn) throw new Error('Await cannot find enclosing function')
				fn.auto_gen = 1
				fn.await = 1
				return 'yield'+ (n.arg ? ' ' + this.expand( n.arg, n ):'')
			}

			this.Update = function( n, parens ){
				var ret 
				if( n.prefix ) ret = n.op + this.expand( n.arg, n )
				else {
					if( n.op === '~' || n.op === '!') throw new Error("Postfix ~ or ! not implemented")					
					ret = this.expand ( n.arg, n ) + n.op
				}
				if( parens ) return '(' + ret + ')'
				return ret
			}

			// destructuring helpers
			this._destructureArrayOrObject = function(v, acc, nest, fn, vars){
				// alright we must store our object fetch on a ref
				if(nest >= fn.destruc_vars) fn.destruc_vars = nest + 1
				var ret = ''
				var od = this.depth
				this.depth = this.depth + this.indent
				ret += '('+this.destruc_prefix+nest+'='+this.destruc_prefix+(nest-1)+acc+')===undefined||('+this.newline+this.depth
				if(v.type == 'Object') ret += this._destructureObject(v, nest + 1, fn, vars)
				else ret += this._destructureArray(v, nest + 1, fn, vars)
				this.depth = od
				ret += this.newline+this.depth + ')'
				return ret
			}

			this._destructureArray = function(arr, nest, fn, vars){
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
						ret += this._destructureArrayOrObject(v, acc, nest, fn, vars)
					}  else throw new Error('Cannot destructure array item '+i)
				}
				return ret
			}

			this._destructureObject = function( obj, nest, fn, vars ){
				var ret = ''
				var keys = obj.keys
				for(var i = 0;i<keys.length;i++){
					k = keys[i]
					var acc
					if(k.key.type == 'Value'){
						acc = '['+k.key.raw+']'
					} else acc = '.'+k.key.name
					var v = k.value
					if(k.enum){
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
						ret += this._destructureArrayOrObject(v, acc, nest, fn, vars)
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

				var oldcmt = this.comments
				this.comments = 0
				if( init )
					ret = '('+this.destruc_prefix+'0='+(def?def+'||':'') + 
						(typeof init == 'string'?init:this.expand( init, n, true)) + 
						',('+this.newline+this.depth
				else{
					if(!def) throw new Error('Destructuring assignment without init value')
					ret = '('+this.destruc_prefix+'0='+(def?def:'') +',('+this.newline+this.depth
				}
				this.comments = 1

				if( left.type == 'Object' ) ret += this._destructureObject(left, 1, fn, vars)
				else ret += this._destructureArray(left, 1, fn, vars)

				this.depth = olddepth
				ret += this.newline+this.depth+'))' + this.comments_or_newline( left )
				return ret
			}

			this.Signal = function( n, parens ){

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
				esc.comments = 0
				var body = esc.expand( n.right, n )

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

			this.Assign = function( n, parens ){

				if(n.left.type == 'Object' || n.left.type == 'Array'){
					return this.destructure(n, n.left, n.right, this.find_function( n ))
				}
				if(n.left.type == 'Id' || n.left.type == 'Key' || n.left.type == 'Index'){
					ret = this.expand( n.left, n, false, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right, n )
				} else {
					ret = 'this['+this.expand( n.left, n )+']' + this.space + n.op + 
						this.space + this.expand( n.right, n )
				}
				if( parens ) return '('+ret+')'
				return ret
			}

			this.Binary = function( n, parens ){
				var ret
				var leftstr
				// obvious string multiply
				if(n.op == '*' && (((leftstr=n.left.type == 'Value' && n.left.kind == 'string'))||
					(n.right.type == 'Value' && n.right.kind == 'string'))){
					if(leftstr) return 'Array('+this.expand(n.right, n,false,').join('+this.expand(n.left,n,false,')'))
					return 'Array('+this.expand(n.left, n,false,').join('+this.expand(n.right,n,false,')'))
				} // mathematical modulus
				else if(n.op == '%%'){
					ret = 'this.mod(' + this.expand( n.left, n ) + ',' + this.expand( n.right, n, false, ')') 
				} // floor division
				else if(n.op == '%/'){
					ret = 'Math.floor(' + this.expand( n.left, n ) + '/' + this.expand( n.right, n, false, ')') 
				}
				else if(n.op == '**'){
					ret = 'Math.pow(' + this.expand( n.left, n ) + ',' + this.expand( n.right, n, false, ')') 
				} // existential assign
				else if(n.op == '?='){
					var left = this.expand( n.left, n )
					ret = '('+left+'===undefined?('+left+'='+this.expand(n.right)+'):'+left+')'

				} // normal
				else if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left, n ) + ')' + this.space + n.op + 
						this.space + this.expand( n.right, n )
				} 
				else {
					ret = this.expand( n.left, n, false, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right, n )
				}
				if( parens ) return '(' + ret + ')'
				return ret
			}

			this.Logic = function( n, parens ){
				var ret
				if(n.op == '?|'){
					var left = this.expand( n.left, n )
					if(n.left.type == 'Id')
						ret = '('+left+'!==undefined?'+left+':'+this.expand(n.right)+')'
					else{
						var fn = this.find_function( n )
						if(!fn.tmp_vars) fn.tmp_vars = 0
						var tmp = this.tmp_prefix + (fn.tmp_vars++)
						ret = '(('+tmp+'='+left+')!==undefined?'+tmp+':'+this.expand(n.right)+')'
					}

				} else				
				if( n.left.op && n.left.prio < n.prio ){
					ret = '(' + this.expand( n.left, n ) + ')' + this.space + n.op + this.space + this.expand( n.right, n )
				} 
				else {
					ret = this.expand( n.left, n, false, this.space + n.op )
					if(ret[ ret.length - 1 ] == '\n') ret += this.indent + this.depth
					ret += this.space + this.expand( n.right, n )
				}
				if( parens ) return '(' + ret + ')'
				return ret
			}

			this.Unary = function( n, parens ){
				if( n.prefix ){
					if(n.op == '?'){
						if(parens) return '(' + this.expand(n.arg, n) +'!==undefined)'
						return this.expand(n.arg, n) +'!==undefined'
					}
					if(n.op.length != 1)
						return n.op + ' ' + this.expand( n.arg, n, true )
					return n.op + this.expand( n.arg, n, true )
				}
				return this.expand ( n.arg, n ) + n.op
			}

			// convert new
			this.New = function( n ){
				var fn = this.expand( n.fn, n, true )
				var arg = this.list( n.args, n )
				if(this.globals[fn]){
					return 'new ' + fn + '(' + arg + ')'
				}
				// forward to Call
				return  fn + '.new(this'+(arg?', '+arg:arg)+')'
			}

			this.Call = function( n, parens, extra ){
				var fn  = n.fn
				fn.parent = this
				// assert macro
				if(fn.type == 'Id' && fn.name == 'assert'){
					var argl = n.args
					if(!argl || argl.length == 0 || argl.length > 2) throw new Error("Invalid assert args")
					var arg = this.expand(argl[0], n)
					var msg = argl.length>1?this.expand(argl[1], n):'""'
					var value = 'undefined'
					var paren
					if(argl[0].type == 'Logic' && argl[0].left.type !== 'Call'){
						value = this.expand( argl[0].left, n )
					}

					var body = '(function(){throw new Assert("'+
						arg.replace(/"/g,'\\"').replace(/\n/g,'\\n')+'",'+
						msg+','+value+')}).call(this)'

					if(outer.IsExpr[n.parent.type] && argl[0].type == 'Logic'){
						if(parens) return '(' + arg + ' || ' + body + ')'
						return arg + ' || ' + body
					}
					return '(('+arg+') || '+body+')'
				}

				// alright so. we need to support splatting arrays into arguments.
				// lets support a single ...bla 
				// or ones anywhere using splices?
				// lets also 'always' do a .call or .apply
				var args = n.args
				// add extra args for processing
				if(extra) args = Array.prototype.concat.apply(args, extra)

				if(fn.type == 'Id'){
					var name = fn.name
					// we support auto-super also for roles.
					if(name == 'super'){
						if(args){
							args = args.slice(0)
							args.unshift('arguments')
						}
						else args = ['arguments']
					}
				}

				// new or extend
				if(fn.type == 'Key' && fn.key.type == 'Id'){
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

				var arglen = args.length
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
								// alright so we check what we have.
								if(i == 0){
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
					call = this.expand(fn, n, true)
				}
				else {
					// check if we are a property chain
					if(fn.type == 'Key'){
						if(fn.isKeyChain()){
							// no tempvar
							cthis = this.expand(fn.object, fn)
							call = cthis + '.' + fn.key.name
						}
						else { // we might be a chain on a call.
							// use a tempvar for the object part of the key
							this.find_function(n).call_var = 1
							cthis = this.call_tmpvar
							call = '('+this.call_tmpvar+'=' + this.expand(fn.object, fn) + ')' +
								'.' + fn.key.name
						}
					}
					else {
						cthis = 'this'
						call = this.expand(fn, n)
					}
				}
				if(isapply) return call +'.apply(' + cthis + (sarg?','+this.space+sarg:'') + ')'
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
						return 'this.Signal.try(' + this.Function( n, false, null, ['end','fail'] ) +'.bind(this))'
					}
				} 
				// alright, in general calling Bla{ } instances it.
				return this.expand( n.fn, n ) + '.create(this, ' + this.Function( n ) + ')'
			}

			this.Quote = function( n ){
				// we need to check for % vars and pass them into parse.
				var esc = outer.ToEscaped
				var tpl = esc.templates = {}
				// now we need to set the template object
				esc.depth = this.depth
				esc.comments = 0
				var body = esc.expand( n.quote, n )
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
				return this.Call( call, false, extra ) + then
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
				var obj =  outer.ToCode.expand( n.object )
				var key = outer.ToCode.expand( n.key )
				// base + key pairs
				this.deps.push( obj, key )
				return 'this.' +obj+'.'+key+'.valueOf()'
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

	// TODO fix this and add all GLSL functions

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
	this.mod = function(a,b){ return (a%b+b)%b }

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
			colors[sl] = colors[s] = [(c>>16)/255,((c>>8)&0xff)/255, (c&0xff)/255]
		}

		// color to array decoder
		return function( col ) {
			if( typeof col == 'string' ) {
				var c = colors[ col ] // color LUT
				if( c ) return c
				var c = parseInt(col, 16)
				if(col.length == 4) return [ ((c&0xf00)>>8|(c&0xf00)>>4) /255, ((c&0xf0)|(c&0xf0)>>4) /255, ((c&0xf)|(c&0xf)<<4) /255 ]
				else return [ ((c >> 16)&0xff) /255, ((c >> 8)&0xff) /255, (c&0xff) /255 ]
			}
			if( typeof col == 'object' && Array.isArray( col ) && (col.length == 3 || col.length == 4) && typeof col[0] == 'number' ) return col
		}
	})()

	return this

}


