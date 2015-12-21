function Validate(elem, config, resolved, rejected){
	if(typeof elem==='object'){
		config = elem;
		elem = document.body;
	}
	
	elem = $(elem);
	var promise = util.Promise(),
		async = util.Async('verify'),
		e;
	
	promise.done(resolved)
		.fail(rejected);
	
	//每次校验结束，fire回调函数
	async.fire(function(){
		for(var c in config){
			if(true!==config[c]._passed){
				return promise.reject();
			}
		}
		promise.resolve();
	});
	
	if(Array.isArray(config)){
		
	}else{
		var tmp;
		for(e in config){
			tmp = config[e];
			if(tmp.exists===false)continue;
			elem.delegate(e, (tmp.events || ['blur']).join(" "), doCheck(config, e, tmp))
				.delegate(e, 'focus', reset);
		}
	}
	
	/*
	* rewrite with functional style.
	*/
	var validators = (function(validators){
		
		var results = [];
		
		if(Array.isArray(validators)){
			results = validators.map(function(validator){
				validator.exists = false;
				return makeChecker(validator, null);
			});
		}else{
			var tmp;
			for(var v in validators){
				tmp = validators[v];
				results.push(makeChecker(tmp, tmp.exists===false ? null : elem.find(v)[0]));
			}
		}
		
		return results;
		
		function makeChecker(checker, ctx){
			return function(){
				return verify.call(ctx, checker, ctx, true);
			}
		}
	}(config));
	
	var fn = doCheck(validators);
	
	//fn.isPass()方法用于客户端程序员校验表单是否符合所有验证等同于fn()的形式
	//仅仅适用于不存在异步验证的情况！！
	fn.isPass = function(){
		return fn()===true;
	};
	
	var passAsync = util.Async('passed'),
		asyncQueue = [],
		errorQueue = [];
	
	//always use for async operator.
	//存在异步校验使用这个接口！！
	fn.passed = function(func){
		fn();
		passAsync.fire(func);
	};
	
	//返回给提交按钮绑定的校验函数，用于自行绑定该事件。
	return fn;
	
	function doCheck(validators, e, currentConfig){
		if(e){
			return function(){
				setTimeout(function(){
					verify.call(this, currentConfig, e);
				}.bind(this));
			}
		}else{
			return function(){
				for(var i=0, ret, len=validators.length; i<len; i++){
					ret = validators[i]();
					if(!ret){
						if(ret===0){
							asyncQueue.length++;
							continue;
						}
						errorQueue.length++;
						return ret;
					}else{
						errorQueue.pop();
					}
				}
				return true;
			}
		}
	}
	
	function verify(config, selector, checkAll){
		
		var emptyHooks = {
			'input': {
				isEmpty: function(e) {
					return !$.trim(e.value);
				}
			},
			'textarea': {
				isEmpty: function(e){
					return !$.trim(e.value);
				}
			},
			'select': {
				isEmpty: function(e){
					return !$.trim(e.value) || e.value==-1;
				},
				emptyFn: function(className, msg){
					return util.error(msg);
				}
			}
		};
		
		
		if(config.exists===false){
			var value = undefined;
		}else if(this===window || !this){
			return true;
		}else{
			var value = this.value;
		}
		
		if(typeof config==='string'){
			config = {emptyMsg: config};
		}
		
		var patterns = config.patterns || [],
			i=0,
			len = patterns.length,
			pattern, reg, result,
			hasDeferred = false,
			hook = config.isEmpty ? config : emptyHooks[(this.nodeName||"").toLowerCase()],
			isEmpty;
		if(selector){
			try{
				isEmpty = hook.isEmpty(this);
			}catch(e){
				throw new Error(selector+' doesn\'t exists!');
			}
		}
		config.allPassed = true;
		var required = typeof(config.required)==='function' ? config.required(this) : config.required;

		//config.required默认为true
		if(required!==false&&checkAll&&isEmpty){
			return error(this, config.emptyMsg || selector+"请输入内容", config.emptyFn || hook.emptyFn);
		}else if(required===false&&isEmpty){
			return true;
		}else if(isEmpty){
			return false;
		}
			
		for(; i<len; i++){
			pattern = patterns[i];
			reg = pattern.reg;
			result = $.isFunction(reg) ? reg(value) : reg.test(value);
			if($.isFunction(result.promise)){
				//promise对象调用resolved()方法表示通过该验证，rejected()方法表示未通过该验证
				result.resolved = resolve(config, pattern, this);
				result.rejected = reject(config, pattern, this);
				hasDeferred = true;
				continue;
			}
			if(!result){
				config.allPassed = false;
				break;
			}
		}
		
		function resolve(config, pattern, elem){
			return function(){
				reset.call(elem);
				if(!config.allPassed){
					return false;
				}
				config._passed = true;
				if(checkAll){
					asyncQueue.pop();
					if(!asyncQueue.length&&!errorQueue.length){
						passAsync.done('passed')
					}
				}
				async.done('verify');
			};
		}
		
		function reject(config, pattern, elem){
			return function(){
				config._passed = false;
				return error(elem, pattern.msg || config.errorMsg || config.emptyMsg || selector+"请输入正确的内容", pattern.errorFn || config.errorFn);
			};
		}
		
		if(!config.allPassed){
			return error(this, pattern.msg || config.errorMsg || config.emptyMsg || selector+"请输入正确的内容", pattern.errorFn || config.errorFn);
		}
		config.allPassed = true;
		//deferred 判断
		if(hasDeferred){
			config._passed = false;
			return 0;
		}
		
		reset.call(this);
		config._passed = true;
		async.done('verify');
		return true;
	}
	
	function reset(){
		$(this).removeClass('tip4validateError');
		return true;
	}
	
	function error(elem, msg, fn){
		if($.isFunction(fn)){
			return fn.call(elem, 'tip4validateError', msg);
		}else{
			$(elem).addClass('tip4validateError');
			return false;
		}
	}
};