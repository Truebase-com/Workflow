
namespace Moduless
{
	/** */
	export class AddCoverMessage extends Message
	{
		constructor(
			readonly project: Project,
			readonly coverFunctionName: string,
			readonly coverIndex: number)
		{ super(); }
	}
	
	/** */
	export class RemoveCoverMessage extends Message
	{
		constructor(
			readonly project: Project,
			readonly coverFunctionName: string,
			readonly coverIndex: number)
		{ super(); }
	}
	
	/** */
	export class SelectCoverMessage extends Message
	{
		constructor(
			readonly containingFile: string,
			readonly coverFunctionName: string)
		{ super(); }
	}
	
	/** */
	export class InitializeMessage extends Message { }
	
	/** */
	export class AddProjectMessage extends Message
	{
		constructor(
			readonly project: Project)
		{ super(); }
	}
	
	/** */
	export class RemoveProjectMessage extends Message
	{
		constructor(
			readonly project: Project)
		{ super(); }
	}
}
