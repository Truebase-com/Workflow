
namespace Moduless
{
	export namespace Util
	{
		/** */
		export function parseJsonText(jsonText: string): object
		{
			try
			{
				return new Function("return (" + jsonText + ");")();
			}
			catch (e)
			{
				return {};
			}
		}
	}
}
