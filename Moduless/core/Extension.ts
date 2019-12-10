
namespace Moduless.Extension
{
	/**
	 * 
	 */
	export function setContext(key: string, value: boolean)
	{
		Vs.commands.executeCommand("setContext", key, value);
	}
}
