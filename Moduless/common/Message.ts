
namespace Moduless
{
	/** */
	export type TMessageCtor<M extends Message = Message> =
		new (...args: any[]) => M;
	
	/**
	 * Unique Markers to pass values through to the server.
	 */
	export const enum JsValue
	{
		undefined = "#__value_is_undefined™__#",
		null = "#__value_is_null™__#",
		nan = "#__value_is_not_a_number™__#"
	}
	
	/** */
	export abstract class Message
	{
		/**
		 * Parses a raw message array coming from the tunnel into a Message instance.
		 * The format of the message array is expected to be:
		 * ["MessageConstructorName", ...messageConstructorArguments]
		 */
		static parse<T extends Message = Message>(messageJsonText: string): T
		{
			const messageJsonTextAdjust = messageJsonText
				.replace(new RegExp(JsValue.undefined, "gm"), "undefined")
				.replace(new RegExp(JsValue.null, "gm"), "null")
				.replace(new RegExp(JsValue.nan, "gm"), "NaN");
			
			const raw = <any[]>Util.parseJsonText(messageJsonTextAdjust);
			if (!Array.isArray(raw) || raw.length < 1)
				throw new Error("Invalid message received.");
			
			const ctorName: keyof typeof Moduless = raw[0];
			const ctorArgs: any[] = raw.slice(1);
			
			if (typeof ctorName !== "string" || 
				!(ctorName in Moduless) || 
				!ctorName.endsWith("Message"))
				throw new Error("Invalid message type: " + String(ctorName));
			
			const ctor = <TMessageCtor>Moduless[ctorName];
			if (ctor.length !== ctorArgs.length)
				throw new Error(`Constructor for ${ctorName} expects ${ctor.length} ` +
					`arguments, but ${ctorArgs.length} were specified.`);
			
			return new ctor(...ctorArgs) as any;
		}
		
		/**
		 * Converts this message into a string representation so
		 * that it may be sent though a WebSocket connection.
		 */
		toString()
		{
			const ctorName = this.constructor.name;
			return JSON.stringify([ctorName, ...Object.values(this)], (key, value) =>
			{
				return value === void 0 ? JsValue.undefined :
					value === null ? JsValue.null :
					value === null ? JsValue.nan :
					value;
			});
		}
	}
}
