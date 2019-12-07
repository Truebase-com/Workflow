
namespace Moduless
{
	/** */
	export class AddCaseMessage extends Message
	{
		constructor(
			readonly project: Project,
			readonly caseFunctionName: string,
			readonly caseIndex: number)
		{ super(); }
	}
	
	/** */
	export class RemoveCaseMessage extends Message
	{
		constructor(
			readonly project: Project,
			readonly caseFunctionName: string,
			readonly caseIndex: number)
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
