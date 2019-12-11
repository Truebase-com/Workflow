
namespace Moduless
{
	export namespace Util
	{
		/**
		 * Parses a TypeScript configuration file (typically called "tsconfig.json"),
		 * and returns an object containing the relevant information.
		 */
		export function parseConfigFile(configFilePath: string)
		{
			type TReference = {
				path: string;
				prepend: boolean;
			};
			
			type TRelevantConfig = {
				name: string,
				compilerOptions: {
					outFile: string
				},
				references: TReference[],
				moduless: {
					scripts: string[]
				}
			};
			
			const tsConfig = <TRelevantConfig>parseJsonFile(configFilePath);
			
			if (!tsConfig.compilerOptions)
				tsConfig.compilerOptions = { outFile: "" };
			
			else if (!tsConfig.compilerOptions.outFile)
				tsConfig.compilerOptions.outFile = "";
			
			if (!tsConfig.name)
			{
				const outFile = tsConfig.compilerOptions.outFile;
				tsConfig.name = Path.basename(outFile, Path.extname(outFile));
			}
			
			if (!tsConfig.references)
				tsConfig.references = [];
			
			if (!tsConfig.moduless)
				tsConfig.moduless = { scripts: [] };
			
			else
			{
				const scripts = tsConfig.moduless.scripts;
				tsConfig.moduless.scripts = 
					Array.isArray(scripts) ? scripts :
					typeof scripts === "string" ? [scripts] :
					[];
			}
			
			return tsConfig;
		}
		
		/** */
		export function parseJsonFile(jsonFilePath: string)
		{
			const fileText = Fs.readFileSync(jsonFilePath, "utf8");
			return fileText ? 
				Util.parseJsonText(fileText) :
				{};
		}
		
		/**
		 * Finds the common path between an array of 
		 * absolute paths.
		 */
		export function findCommonPath(paths: string[])
		{
			if (paths.length < 2)
				return "";
			
			const pathsBroken = paths
				.map(p => p.split(Path.sep))
				.sort((a, b) => a.length - b.length);
			
			const minPathLength = pathsBroken[0].length;
			let maxCommonPart = 0;
			
			outer: for (;;)
			{
				let currentPathItem: string | null = null;
				
				for (const path of pathsBroken)
				{
					if (currentPathItem === null)
						currentPathItem = path[maxCommonPart];
					
					else if (path[maxCommonPart] !== currentPathItem)
						break outer;
				}
				
				if (++maxCommonPart >= minPathLength)
					break;
			}
			
			return pathsBroken[0].slice(0, maxCommonPart).join(Path.sep);
		}
		
		/**
		 * Returns the name of the cover function at the specified line,
		 * or an empty string in the case when the specified line does not
		 * define a cover function.
		 */
		export function getCoverNameFromLine(lineText: string)
		{
			const searchString = "function " + Constants.prefix;
			const functionStart = lineText.indexOf(searchString);
			if (functionStart < 0)
				return "";
			
			// 99.9% of non-cover lines will be efficiently ruled out
			// by the above check, but we keep going just to be sure.
			
			const lineLeft = lineText.slice(0, functionStart).trimLeft();
			
			if (lineLeft !== "" &&
				lineLeft !== "export async " &&
				lineLeft !== "async ")
				return "";
			
			const lineRight = lineText.slice(functionStart + searchString.length);
			if (!/^[A-Z0-9][A-Za-z0-9]*\(\)/.test(lineRight))
				return "";
			
			return Constants.prefix + lineRight.slice(0, lineRight.indexOf("("));
		}
	}
}
