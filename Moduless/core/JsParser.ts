
namespace Moduless
{
	/** */
	export interface IParserOptions
	{
		/** The flag to allow module code. */
		module?: boolean;
		
		/** The flag to enable stage 3 support (ESNext). */
		next?: boolean;
		
		/** The flag to enable start and end offsets to each node. */
		ranges?: boolean;
		
		/** Enable web compability. */
		webcompat?: boolean;
		
		/** The flag to enable line/column location information to each node. */
		loc?: boolean;
		
		/** The flag to attach raw property to each literal and identifier node. */
		raw?: boolean;
		
		/** Enabled directives. */
		directives?: boolean;
		
		/** The flag to allow return in the global scope. */
		globalReturn?: boolean;
		
		/** The flag to enable implied strict mode. */
		impliedStrict?: boolean;
		
		/** Enable non-standard parenthesized expression node. */
		preserveParens?: boolean;
		
		/** Enable lexical binding and scope tracking. */
		lexical?: boolean;
		
		/** Adds a source attribute in every node’s loc object when the locations option is `true`. */
		source?: boolean;
		
		/** Distinguish Identifier from IdentifierPattern. */
		identifierPattern?: boolean;
	};
	
	declare var require: any;
	export const JsParser = <typeof import("meriyah")>require("meriyah");

	export const JsBuilder = <typeof import("recast")>require("recast");
}
