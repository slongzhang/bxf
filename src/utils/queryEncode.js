/**
 * 提取自jQuery3.6里的函数
 */
import { getType } from './index'

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

        // 判断是jQuery的表单数组还是其他
        if (a.every(item => Object.hasOwn(item, 'name') && Object.hasOwn(item, 'value'))) {
            // 序列化表单元素
            for (let [name, value] of a) {
                add(name, value)
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
	else if (typeof a == 'string') {
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