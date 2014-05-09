
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

			if(steps && steps[0] && steps[0].expr && steps[0].expr.flag == 35){
				var dump = 'js'///steps[0].expr.name
				steps.splice(0,1)
				if(dump.indexOf('ast')!= -1)
					ONE.out( ast.toDump() )
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

			Id: { name:0, flag:0 },
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
				unescape:1,
				setInterval:1,
				clearInterval:1,
				setTimeout:1,
				clearTimeout:1,
				console:1
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
				return this.Call( call, 0, this.expand(n.arg) )
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
