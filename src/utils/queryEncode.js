/**
 * 提取自jQuery3.6里的函数
 */
import { getType } from './index.js'

const 
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	let name;

	if ( Array.isArray( obj ) ) {
		for (let [i, v] of Object.entries(obj)) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		}

	} else if ( !traditional && getType( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}


/**
 * 将表单元素数组或一组键/值序列化为查询字符串
 * jQuery.param
 * @param {*} a 
 * @param {*} traditional 
 * @returns 
 */
export const queryEncode = function( a, traditional ) {
	let prefix,
		s = [];

	// URLSearchParams 是 WHATWG 标准入参（axios / fetch 用户常用）。
	// 不能走下面的 for...in：它会遍历到原型上的 append/get/set 等方法，
	// 取出来当普通函数调用时 this 丢失，抛 ERR_INVALID_THIS。
	if ( typeof URLSearchParams !== 'undefined' && a instanceof URLSearchParams ) {
		return a.toString();
	}

	const add = function( key, valueOrFunction ) {
			// 如果value是一个函数，则调用它并使用其返回值
			var value = typeof valueOrFunction == 'function' ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	if ( a == null ) {
		return "";
	}

	// 如果传入了一个数组，则假设它是一个表单元素数组(jQuery('form').serializeArray)。
	if ( Array.isArray( a ) ) {

		// 判断是 jQuery 表单数组 [{name,value}] 还是其它数组。
		// 两个历史坑：① Object.hasOwn(null, ...) 会抛 TypeError，必须逐项判空；
		// ② 表单项是普通对象，不能用 for (let [name,value] of a) 数组解构（会抛
		//    ".for is not iterable"）。正确写法是遍历项再读 .name / .value。
		const isFormArray = a.length > 0 && a.every( item =>
			item !== null && typeof item === 'object' &&
			Object.hasOwn( item, 'name' ) && Object.hasOwn( item, 'value' )
		);
		if ( isFormArray ) {
			// 序列化表单元素
			for ( const item of a ) {
				add( item.name, item.value );
			}
		}
		else {
            // 其他类型的数组
            for (let item of a) {
                let itemType = getType(item);
                if (itemType === 'string') {
                    s.push(item)
                }
                else if (itemType === 'object') {
                    s.push(queryEncode(item, traditional))
                }
            }
        }
	} 
	else if (typeof a === 'string') {
		s = [a]
	}
	else {

		// 如果是传统方式，则采用“旧”方式（1.3.2或更早版本的方式）进行编码，否则递归编码参数。
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// 返回结果序列化
	return s.join( "&" );
};

export default queryEncode;