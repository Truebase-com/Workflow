
namespace Oscilloscope
{	
	export const Logs: [string, object, any[], any][] = [];
	
	let lastId = 0;
	export function nextId()
	{
		return lastId++;
	}
	
	export function captureArgs(id: number, context: any, fnName: string, ...args: any[])
	{
		Logs[id] = [fnName, context, args, undefined];
	}
	
	export function captureReturn(id: number, value: any)
	{
		Logs[id][3] = value;
		return value;
	}
}