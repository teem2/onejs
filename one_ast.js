
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
			
			// scan up to pull ret the essential ast node			
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
			ast = this.parse( ast, undefined, filename, true )

		// alright we have to compile us some code!
		var js = this.AST.js_serialize
		// make a fresh scope and signals store
		js.scope = {}
		js.signals = []
		js.line = 0
		js.comments = comments
		// if passing a function we return that
		if(ast.type == 'Function'){
			var steps = ast.body.steps

			if(steps && steps[0] && steps[0].expr && steps[0].expr.flag == 35){
				var dump = steps[0].expr.name
				steps.splice(0,1)
				if(dump.indexOf('ast')!= -1) ONE.out( ast.toDump() )
				if(dump.indexOf('code')!=-1){
					var code = this.AST.code_serialize
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
	parser.Node = this.AST = this.extend.call({}, this, function(){

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


		// AST structure definition
		// 0 is value
		// 1 is node
		// 2 is array
		// 3 is array of [ { key:1, value:1, kind:0 } ]

		this.ast_structure = {
			Program:{ steps:2 },
			Empty:{},

			Id: { name:0, flag:0, isType:0 },
			Type: { name:0 },
			Value: { value:0, raw:0, kind:0, multi:0 },
			This: { },

			Array: { elems:2 },
			Object: { keys:3 },
			Index: { object:1, index:1 },
			Prototype: { left:1, right:1 },
			Key: { object:1, key:1, exist:0 },

			Block:{ steps:2 },
			Expr: { expr:1 },
			List: { items:2 },
			Interp: { chain:2 },
			Break: { label:1 },
			Continue: { label:1 },
			Label: { label:1, body:1 },

			If: { test:1, then:1, else:1, postfix:0 },
			Switch: { on:1, cases:2 },
			Case: { test:1, then:2 },

			Throw: { arg:1 },
			Try: { try:1, arg:1, catch:1, finally:1 },

			While: { test:1, loop:1 },
			DoWhile: { loop:1, test:1 },
			For: { init:1, test:1, update:1, loop:1 },
			ForIn: { left:1, right:1, loop:1 },
			ForOf: { left:1, right:1, loop:1 },
			ForFrom: { left:1, right:1, loop:1 },
			ForTo: { left:1, right:1, loop:1, in:1 },

			Var: { defs:2, const:0 },
			Const: { defs:2 },
			TypeVar: { kind:1, defs:2, dim:1 },
			Struct: { id:1, struct:1, defs:2, dim:1 },
			Def: { id:1, init:1, dim:1 },

			Function: { id:1, name:1, params:2, rest:1, body:1, arrow:0, gen:0, def:0 },
			Return: { arg:1 },
			Yield: { arg:1 },
			Await: { arg:1 },

			Unary: { op:0, prefix:0, arg:1 },
			Binary: { op:0, prio:0, left:1, right:1 },
			Logic: { op:0, prio:0, left:1, right:1 },
			Assign: { op:0, prio:0, left:1, right:1 },
			Update: { op:0, prio:0, arg:1, prefix:0 },
			Condition: { test:1, then:1, else:1 },

			New: { fn:1, args:2 },
			Call: { fn:1, args:2 },
			Extends: { left:1, right:1, body:1 },

			Quote: { quote:1 },
			Rest: { id:1, dots:0 },
			Path: { left:0, right:0 },
			Do: { call:1, arg:1, catch:1, then:1, kind:0 },
			Then: { name:1, do:1 },
			Callback: { call:1, body:1, arrow:0 },

			Debugger: { },
			With: { object:1, body:1 }
		}

		this.ast_clone = {}
		this.ast_copy = {}
		this.ast_walk = {}

		// Generate AST Tools clone and copy
		this.ASTToolGenerator = function(){
			var ast = this.ast_structure;

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
									'\t\t\telse y[i].enum = x.enum\n'+
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
			(new Function('_clone', '_copy', '_walk', ret))(this.ast_clone, this.ast_copy, this.ast_walk)

			this.ast_clone.AST = this
			this.ast_clone.Unary = function( n ){
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
			this.ast_walk.start = function(n){
				return this[ n.type ]( n )
			}
		}
		this.ASTToolGenerator()

		this.getDependencies = function(){
			// lets find all load
			var ret = this.ast_depfinder.deps = []
			this.ast_depfinder.start( this )
			return ret
		}

		this.ast_depfinder = this.extend.call(this.ast_walk, this, {
			Call:function( n, p ){
				Object.getPrototypeOf(this).Call.call( this, n, p)
				if(n.fn.name == 'apply' || n.fn.name == 'load'){
					var arg = n.args[0]
					if(arg && arg.type == 'Value' && arg.kind == 'string'){
						this.deps.push(arg.value)
					}
				}
			}
		})


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
			no_valueless_object:0,
			store: function( n, value ){
				return value + '..'
			},
			expand:function( n, parent, parens, term ){ // recursive expansion
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
			},
			comments_flush:function( array, term ){
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
			block:function( n, parent, noindent ){ // term split array
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
			},
			flat:function( n, parent ){
				if(n.length == 0) return ''
				var ret = ''
				var len = n.length
				for( var i = 0; i < len; i++ ){
					if(i) ret += ',' + this.space
					ret += this.expand( n[ i ], parent )
				}
				return ret
			},			
			list:function( n, parent ){
				if(n.length == 0) return ''
				//var old_depth = this.depth
				//this.depth += this.indent
				var ret = ''
				var len = n.length
				var term = ',' + this.space
				for( var i = 0; i < len; i++ ){
					ret += this.expand( n[ i ], parent, false, i<len-1?term:'' )
					if( ret[ ret.length - 1 ] == '\n' ) ret += i == len - 1? old_depth:this.depth
				}
				//this.depth = old_depth
				return ret
			},
			Program: function( n ){ 
				return this.block( n.steps, n, true )
			},
			Empty: function( n ){ 
				return ''
			},

			Id: function( n ){
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
					this.list( n.elems, n ) + 
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

					if(prop.enum === undefined){
						ret += ':' + this.expand( prop.value, n )
					}
					else{
						if(this.no_valueless_object){
							ret += ':' + prop.enum
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
			},
			Index: function( n ){
				return this.expand( n.object, n, true ) + '[' + this.expand( n.index, n ) + ']'
			},
			Key: function( n ){
				var left = this.expand( n.object, n, true )
				return  left + (this.exist?'?.':(left[left.length - 1] == '.'?'':'.')) + this.expand( n.key, n )
			},

			Block: function( n ){
				var ret = '{' + this.comments_or_newline( n ) + this.block( n.steps, n ) + this.depth + '}'
				this.cignore =1 
				return ret
			},
			Expr: function( n, parens ){
				return this.expand( n.expr, n, parens )
			},
			List: function( n, parens ){
				if( parens ) '('+this.list( n.items, n ) +')'
				return this.list( n.items, n )
			},
			Interp: function( n, parens ){
				var ret = '"'
				var chain = n.chain
				var len = chain.length 
				for(var i = 0; i < len; i++){
					var item = chain[i]
					if(item.type == 'Block'){
						if(item.steps.length == 1 &&
							item.steps[0].type == 'Expr'){
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
			},
			Break: function( n ){ 
				return 'break'+(n.label?' '+this.expand( n.label, n ):'')
			},
			Continue: function( n ){
				return 'continue'+(n.label?' '+this.expand( n.label, n ):'')
			},
			Label: function( n ){
				return this.expand( n.label, n )+':'+this.expand( n.body, n )
			},

			If: function( n ) {
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
			},
			Switch: function( n ){
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
			},
			Case: function( n ){
				if( !n.test) return 'default:'+( n.then.length ? this.newline+this.block( n.then, n ) : this.newline )
				var ret = 'case '
				var old_cmt = this.comments
				this.comments = 0
				ret += this.expand( n.test, n ) + ':' 
				this.comments = old_cmt
				ret += this.comments_or_newline(n.test)
				if (n.then.length) ret += this.block( n.then, n )
				return ret
			},

			Throw: function( n ){
				return 'throw ' + this.expand( n.arg, n )
			},
			Try: function( n ){
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
			},

			While: function( n ){
				return 'while(' + this.expand( n.test, n ) + ')' + 
					this.expand( n.loop, n )
			},
			DoWhile: function( n ){
				return 'do' + this.expand( n.loop, n ) + 
					'while(' + this.expand( n.test, n ) + ')'
			},
			For: function( n ){
				return 'for(' + this.expand( n.init, n )+';'+
						this.expand( n.test, n ) + ';' +
						this.expand( n.update, n ) + ')' + 
						this.expand( n.loop, n )
			},
			ForIn: function( n ){
				return 'for(' + this.expand( n.left, n ) + ' in ' +
					this.expand( n.right, n ) + ')' + 
					this.expand( n.loop, n )
			},
			ForOf: function( n ){

				return 'for(' + this.expand( n.left, n ) + ' of ' +
					this.expand( n.right, n ) + ')' + 
					this.expand( n.loop, n )
			},
			ForTo: function( n ){
				return 'for(' + this.expand( n.left, n ) + ' to ' +
					this.expand( n.right, n ) + 
					(n.in?' in ' + this.expand( n.in, n ):'') + ')' + 
					this.expand( n.loop, n )
			},

			Var: function( n ){
				return (n.const?'const ':'var ') + this.flat( n.defs, n )
			},
			Const: function( n ){
				return 'const ' + this.flat( n.defs, n )
			},
			TypeVar: function( n ){
				return this.expand(n.kind, n) + 
					( n.dim !== undefined ? '[' + 
						( n.dim ? this.expand(n.dim, n):'') + 
						']': '') + ' ' + 
					this.flat( n.defs, n )
			},
			Def: function( n ){
				return this.expand( n.id, n ) + 
					( n.dim !== undefined ? '[' + 
						(n.dim?this.expand(n.dim, n):'') + 
						']':'') +
					(n.init ? this.space + '=' + this.space + this.expand(n.init, n) : '')
			},
			Struct: function( n ){
				return 'struct ' + this.expand( n.id, n) + 
					(n.struct ? this.expand( n.struct, n): ' '+this.list( n.defs, n ) )
			},

			Function: function( n, parens ){
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
			},
			Return: function( n ){
				return 'return' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			},
			Yield: function( n ){
				return 'yield' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			},
			Await: function( n ){
				return 'await' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			},

			Unary: function( n ){
				if( n.prefix )return n.op + this.space + this.expand( n.arg, n )
				return this.expand ( n.arg, n ) + n.op
			},
			Binary: function( n, parens ){
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
			},
			Logic: function( n, parens ){
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
			},
			Assign: function( n, parens ){
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

			},
			Update: function( n, parens ){
				var ret 
				if( n.prefix ) ret = n.op + this.expand( n.arg, n )
				else ret = this.expand ( n.arg, n ) + n.op
				if( parens ) return '(' + ret + ')'
				return ret
			},
			Condition: function( n ){
				return this.expand( n.test, n )+ this.space +'?'+ this.space +this.expand( n.then, n )+ this.space +':'+ this.space +this.expand( n.else, n )
			},

			New: function( n ){
				return 'new ' + this.expand( n.fn, n, true ) + '(' + this.list( n.args, n ) + ')'
			},
			Call: function( n ){
				return this.expand( n.fn, n, true ) + '(' + this.list( n.args, n ) + ')'
			},
			Extends: function( n ){
				return n.left.name + '::' + (n.right?n.right.name:'') + this.expand( n.body, n )
			},
			Quote: function( n, parens ){
				var ret = ':' + this.expand( n.quote, n )
				if( parens ) return '(' +ret + ')'
				return ret
			},
			Rest: function( n ){
				var ret = ''
				for(var i = 0;i< n.dots;i++) ret += '.'
				ret += this.expand( n.id, n )
				return ret
			},
			Path: function( n ){
				var ret = ''
				for(var i = 0;i< n.dots;i++) ret += '.'
				ret += n.op + this.expand( n.id, n )
				return ret
			},
			Do: function( n ){
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
			},
			Callback: function( n ){
				return this.expand( n.call, n ) + this.expand( n.body, n )
			},
			Debugger: function( n ){
				return 'debugger'
			},
			With: function( n ){
				return 'with(' + this.expand( n.object, n ) + ')' + this.expand( n.body, n )
			}
		}

		this.code_escaped = this.extend.call(this.code_serialize, this, {
			newline:' \\n\\\n',
			indent:'\t',
			Unary: function( n ){
				if( n.prefix ){
					if(n.op == '%' && this.templates){
						if(n.arg.type != 'Id') throw new Error("Unknown template & variable type")
						this.templates[n.arg.name] = 1
					}
					return n.op + this.expand( n.arg, n )
				}
				return this.expand ( n.arg, n ) + n.op
			},			
			Value: function( n ){
				if(n.kind == 'string' || n.kind == 'regexp'){
					// escape ' and "
					return n.raw.replace(/"/g,'\\"').replace(/'/g,"\\'")
				}
				return n.raw
			}
		})

		this.js_serialize = this.extend.call(this.code_serialize, this, {
			
			newline:'\n',
			semi:';',
			scope:{},
			promise_catch:1,
			no_valueless_object:1,
			destruc_prefix:'_\u0441',
			desarg_prefix:'_\u0430',
			tmp_prefix:'_\u0442',
			store_prefix:'_\u0455',
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
			},
			store:function(n, value ){
				var fn = this.find_function( n )
				if(!fn.store_var) fn.store_var = 1
				return '('+this.store_prefix+'='+value + ')'
			},
			resolve:function( name ){
				if( name in this.scope ) return name
				if( name in this.globals ) return name
				return 'this.'+name
			},
			Id: function( n ){
				var flag = n.flag
				if( flag ){
					if(flag === -1){
						var fn = this.find_function( n )
						if(!fn.store_var) throw new Error("Storage .. operator read but not set in function")
						return this.store_prefix
					}
					if(flag === 64) throw new Error("@ Unresolved template vars in AST")
					if(flag === 35) return 'this.color("'+n.name+'")'
				}
				return this.resolve( n.name )
			},
			Value: function( n ){ 
				if(n.multi){
					if(n.kind == 'regexp') return n.value
					return n.raw.replace(/\n/g,'\\n')
				}
				return n.raw 
			},
			Index: function( n ){
				return this.expand( n.object, n, true ) + '[' + this.expand( n.index, n ) + ']'
			},
			Key: function( n, paren ){
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
			},
			Interp: function( n, parens ){
				var ret = '"'
				var chain = n.chain
				var len = chain.length 
				for(var i = 0; i < len; i++){
					var item = chain[i]
					if(item.type == 'Block'){
						if(item.steps.length == 1 &&
							item.steps[0].type == 'Expr'){
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
			},
			// Complete for of polyfill with iterator and destructuring support
			ForOf: function( n ){
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
				else ret += this.depth+this.indent+loop+this.newline+this.depth
				ret += '}'
				return ret
			},
			// a high perf for over an array, nothing more.
			ForFrom: function( n ){
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
				return ret + arr+'='+this.expand(n.right)+','+alen+'='+arr+'.length,'+
					iter+'=0,'+value+'='+arr+'[0];'+iter+'<'+alen+';'+value+'='+arr+'[++'+iter+'])' +
					this.expand(n.loop, n)
			},
			// a simpler from/to loop
			ForTo: function( n ){

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
				return 'for(' + this.expand( n.left, n )+';'+
						iter+'<'+ this.expand( n.right, n)+';'+iter+'++)'+
						this.expand( n.loop, n )
			},

			TypeVar: function( n ){
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
			},

			Def: function( n ){
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
			},

			Struct: function( n ){
				throw new Error("implement Struct")
			},

			Function: function( n, parens, nametag, extparams ){
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
								if(id.flag !== 46){
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
				var trywrap = false
				if(n.arrow === '=>') bind = true
				else if( n.arrow === '->' && n.parent){ // only auto figure ret the straight arrow
					var lhs
					var ptype = n.parent.type

					if(n.name){
						lhs = n.name
					} else {
						if(n.type === 'Callback'){
							if(n.call.name == 'promise') trywrap = true
							lhs = n.call 
							if(lhs.type == 'Call') lhs = lhs.fn
						}
						else if(ptype === 'Assign') lhs = n.parent.left 
						else if(ptype === 'Call') lhs = n.parent.fn
						else if(ptype === 'Do' && n.parent.call.type == 'Call'){
							lhs = n.parent.call.fn
						}
						else if(ptype === 'Do'){
							if(n.parent.call.key && n.parent.call.key.name == 'then') trywrap = true
							lhs = n.parent.call
						} 
						else if(ptype === 'Def') bind = true
						else if(ptype == 'Return') bind = true
					}	

					if(lhs){
						if( (lhs.type === 'Index' || lhs.type  === 'Key') ){
							if((!lhs.key || (lhs.key.name !== 'new' && lhs.key.name !== 'extend')) && 
								lhs.object.type !== 'This') bind = true
						}else 
						if(lhs.type !== 'Id' && lhs.type !== 'Value') bind = true
						if(lhs.type == 'Id'){
							if(lhs.name == 'then') bind = true, trywrap = true
							else if(this.scope[ lhs.name ]) bind = true
						}
					} 
				}
				if(!this.promise_catch) trywrap = false

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
				if( nametag ) ret += ' '+nametag
				else if(n.id) ret += ' '+this.expand( n.id, n )

				if( !str_param ) str_param = ''
				ret += '(' + str_param + '){' 
				if( n.destruc_vars ){
					ret += this.newline + this.depth
					ret += 'var '
					for(var i = 0;i<n.destruc_vars;i++){
						if(i) ret += ','+this.space
						ret += this.destruc_prefix + i
					}
					ret += ';'
				}
				if( n.tmp_vars ){
					ret += this.newline + this.depth
					ret += 'var '
					for(var i = 0;i<n.tmp_vars;i++){
						if(i) ret += ','+this.space
						ret += this.tmp_prefix + i
					}
					ret += ';'
				}
				if( n.store_var ){
					ret += this.newline + this.depth
					ret += 'var '+this.store_prefix+';'
				}

				if( trywrap ) ret += 'try{'

				this.depth = olddepth
				this.scope = scope

				ret += this.comments_or_newline(n.body) + str_body + this.depth 
				if( trywrap ) ret += '}catch(_){console.log(_);throw(_)}'
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
			},
			find_function: function( n ){
				var p = n.parent
				while(p){
					if(p.type == 'Callback') return p
					if(p.type == 'Extends') return p
					if(p.type == 'Function') return p
					p = p.parent
				}
			},
			Yield: function( n ){
				var fn = this.find_function( n )
				if(!fn) throw new Error('Yield cannot find enclosing function')
				fn.auto_gen = 1
				return 'yield' + (n.arg ? ' ' + this.expand( n.arg, n ):'')
			},

			Await: function( n ){
				var fn = this.find_function( n )
				if(!fn) throw new Error('Await cannot find enclosing function')
				fn.auto_gen = 1
				fn.await = 1
				return 'yield'+ (n.arg ? ' ' + this.expand( n.arg, n ):'')
			},

			Update: function( n, parens ){
				var ret 
				if( n.prefix ) ret = n.op + this.expand( n.arg, n )
				else {
					if( n.op === '~' || n.op === '!') throw new Error("Postfix ~ or ! not implemented")					
					ret = this.expand ( n.arg, n ) + n.op
				}
				if( parens ) return '(' + ret + ')'
				return ret
			},
			// destructuring helpers
			_destructureArrayOrObject:function(v, acc, nest, fn, vars){
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
			},
			_destructureArray:function(arr, nest, fn, vars){
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
			},
			_destructureObject:function( obj, nest, fn, vars ){
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
			},
			destructure:function( n, left, init, fn, vars, def ){
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
			},
			Assign: function( n, parens ){

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
			},

			Binary: function( n, parens ){
				var ret
				var leftstr
				// obvious string multiply
				if(n.op == '*' && ((leftstr=n.left.type == 'Value' && n.left.kind == 'string'))||
					(n.right.type == 'Value' && n.right.kind == 'string')){
					if(leftstr) return 'Array('+this.expand(n.right, n,false,').join('+this.expand(n.left,n,false,')'))
					return 'Array('+this.expand(n.left, n,false,').join('+this.expand(n.right,n,false,')'))
				} // mathematical modulus
				else if(n.op == '%%'){
					ret = 'ONE.mod(' + this.expand( n.left, n ) + ',' + this.expand( n.right, n, false, ')') 
				} // floor division
				if(n.op == '%/'){
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
			},
			Logic: function( n, parens ){
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
			},
			Unary: function( n, parens ){
				if( n.prefix ){
					if(n.op == '?'){
						if(parens) return '(' + this.expand(n.arg, n) +'===undefined)'
						return this.expand(n.arg, n) +'===undefined'
					}
					return n.op + this.space + this.expand( n.arg, n )
				}
				return this.expand ( n.arg, n ) + n.op
			},


			Extends: function( n, parens ){
				// define a function.
				var ret = ''
				if(n.left) ret = this.expand(n.left) + this.space+'=' + this.space
				if(n.right) ret += this.expand( n.right )
				else ret += 'this.Base'
				ret += '.extend(this,'+ this.Function( n, false, null, ['outer'] )+',"'+(n.left&&n.left.type=='Id'?n.left.name:'')+'")'
				return ret
			},
			Call: function( n, parens, extra ){
				// auto this forward with local scope functions
				// !TODO fix
				var nargs = n.args.length ? this.list( n.args, n ) : ''
				if( extra ) nargs += nargs? ',' + this.space + extra : extra
				var args = nargs ? ',' + nargs : ''
				var fn  = n.fn
				if(fn.type == 'Extends'){
					return this.expand(fn.left)+'.'+fn.right.name+'(this' + args +')'
				}
				if(fn.type == 'Id'){
					if(fn.name == 'new'){
						return 'this.new(this' + args + ')'
					}
					if(fn.name == 'super'){
						return 'this.super(arguments' + args + ')'
					}
				}
				if(fn.type == 'Key' && fn.key.type == 'Id' && 
					(fn.key.name == 'new' || fn.key.name == 'extend' )){
					return this.expand( fn, n, true ) + '(this' + args + ')'
				}

				if(fn.type != 'Path' && fn.type != 'Key' && (fn.type != 'Id' || fn.flag == -1 || fn.name in this.scope)){
					return this.expand( fn, n, true ) + '.call(this' + args + ')'
				}
				return this.expand( fn, n, true ) + '(' + nargs + ')'
			},

			Quote: function( n ){
				// we need to check for @ vars and pass them into parse.
				var esc = this._.code_escaped
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
				return 'this.parse("' + body + '"'+(obj?',{' + obj + '})':')')
			},
			Rest: function( n ){
				throw new Error("dont know what to do with isolated rest object")
			},
			Prototype: function( n ){
				if( !n.left ){
					if(!n.right) return 'Object.getPrototypeOf(this)'
					if(n.right.type == 'Id')	
						return 'Object.getPrototypeOf(this).'+ n.right.name
				}
				if( !n.right ) return 'Object.getPrototypeOf('+this.expand(n.left,n)+')'
				return 'Object.getPrototypeOf('+this.expand(n.left, n) + ').' + n.right.name
			},
			Path: function( n ){
				if( !n.left ){
					if(!n.right) return 'this._'
					if(n.right.type == 'Id') return 'this._.'+ n.right.name
				}
				if( !n.right )return this.expand(n.left,n)+'._'
				return this.expand(n.left, n) + '._.' + n.right.name
			},
			Do: function( n ){
				var call = n.call

				if(n.catch){
					arg = this.expand(n.arg, n, false, ',')
					if(arg[arg.length - 1] == '\n') arg = arg + this.depth + this.indent
					arg = arg + this.newline + this.depth + this.expand(n.catch, n)
				}	
				else {
					arg = this.expand( n.arg, n )
				}
				var then = (n.then ? this.expand(n.then, n) : '')
				if( call.type == 'Id' && call.name == 'then'){
					return '.then('+arg+')' + then
				}
				else if( call.type != 'Call' ){
					return this.expand( call, n ) + '(' + arg + ')' + then
				}

				return this.Call( call, false, arg ) + then
			},
			Callback: function( n ){
				var call = n.call
				var isassign = false
	
				if(call.type == 'Key' && call.key.type == 'Id'){
					var name = call.key.name
					//special keywords that get the extra short call treatment
					if(name == 'new'){
						return this.expand( call, n ) + '(this).apply(' + this.Function( n ) + ')'
					}
					if(name == 'extend'){
						return this.expand( call, n ) + '(this,' + this.Function( n ) + ')'
					}
					if(name == 'then' ){
						return this.expand( call, n ) + '(' + this.Function( n ) + ')'
					}
					isassign = true
				}
				if( isassign || call.type == 'Id' || call.type == 'Value'){
					if(call.flag == 64 && !call.name){
						return 'this.$.Track.new(this,' + this.Function( n ) +')'
					}
					// check if our Id is new catch or then
					// ifso its a this bound call argument
					if( call.type == 'Value'){
						return 'this['+call.raw+']' + this.space + '=' + this.space + this.Function( n )
					}
					if( call.name == 'promise'){
						return 'new Promise(' + this.Function( n, false, null, ['resolve','reject'] ) +'.bind(this))'
					}
					return this.expand( call, n ) + this.space + '=' + this.space + this.Function( n )
				} 

				if( call.type != 'Call' ) throw new Error("Cant append callback to non call")
				
				return this.Call( call, false, this.Function( n ) )
			}
		})

		// TODO update this
		this.signal_serialize = this.extend.call(this.code_serialize, this, {
			deps:0,
			Call:function( n ){
				if( n.fn.type !== 'Id') throw new Error("Dont know how to do non Id call")
				return 'this.' + n.fn.name + '(' + this.list( n.args, n ) + ')'
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

	// TODO fix this
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


