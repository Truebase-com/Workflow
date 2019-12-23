/// <reference path="Message.ts" />

namespace Moduless
{
	/** */
	export class ReloadMessage extends Message { }
	
	/** */
	export class StartCoverMessage extends Message
	{
		constructor(
			readonly containingFilePath: string,
			readonly coverName: string)
		{ super(); }
	}
	
	/** */
	export class ExecuteVoidMessage extends Message
	{
		constructor(
			readonly voidName: string,
			readonly parameters: any[],
			readonly context: Record<string, any>
		)
		{ super (); }
	}
	
	/** */
	export class EndCoverMessage extends Message
	{
		constructor(
			/**
			 * The name of the cover function that was executed.
			 */
			readonly coverName: string,
			/**
			 * A string containing any exception message that was generated
			 * as a result of running the cover.
			 */
			readonly exceptionDescription: string,
			/**
			 * A string array containing the entries of the stack trace of any
			 * exception that was generated as a result of running this cover.
			 */
			readonly exceptionStack: string[],
			/**
			 * 
			 */
			readonly verifications: IVerificationResult[])
		{ super(); }
	}
	
	/** */
	export interface IVerificationResult
	{
		readonly expression: string;
		readonly pass: boolean;
	}
	
	/**
	 * A message sent back by the browser that reports the size and position
	 * of the window back to the extension, so that the extension can be sure
	 * to launch browser windows in the location where the user last placed them.
	 */
	export class WindowMetricsMessage extends Message
	{
		constructor(
			readonly screenX: number,
			readonly screenY: number,
			readonly width: number,
			readonly height: number)
		{ super(); }
	}
}
