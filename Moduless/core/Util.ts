
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
		 * Walks on given string and invokes (fn) for every char,
		 * loops until either getting true or undefined back from (fn) or text ends.
		 * If (fn) returns a number that number is used for new value of iterator.
		 * 
		 * @param text String to walk on
		 * @param start Starting index
		 * @param fn Callback to be invoked for every char
		 * @param reverse Walk backwards
		 */
		export function textWalker(
			text: string,
			start: number, 
			fn: (char: string, index: number) => boolean | number | undefined, 
			reverse = false)
		{
			for (let i = start; reverse ? i >= 0 : i < text.length; )
			{
				const v = fn(text[i], i);
				
				if (v === true)
					return i;
				
				if (v === false)
					reverse ? i-- : i++;
				
				else if (typeof v === "number")
					i = v;
				
				else 
					return undefined;
			}
		}
		
		/**
		 * Returns the name of the cover function at the specified line,
		 * or an empty string in the case when the specified line does not
		 * define a cover function.
		 */
		export function getVoidExpressionFromLine(lineText: string): [string | false, boolean]
		{
			const voidStart = lineText.indexOf("void \"");
			if (voidStart < 0)
				return [false, false];
			
			// 99.9% of non-cover lines will be efficiently ruled out
			// by the above check, but we keep going just to be sure.
			
			const lineWalker = textWalker.bind(null, lineText);
			
			const exprStart = voidStart + 6;
			
			// Walk until next " and skip \"
			let voidEnd = lineWalker(exprStart, (v, i) => 
				v === "\\" ? i + 2 : 
				v === "\""
			);
		
			if(!voidEnd) 
				return [false, false];
				
			const expr = lineText.substring(exprStart, voidEnd);
			
			// Check if there is ")" after void expression
			let fnClose = lineWalker(voidEnd, v => 
				v === ")"
			);
			
			if (!fnClose) 
				return [expr, false];
				
			// Check if there is "(" before void expression
			let fnOpen = lineWalker(voidStart, v => 
				v === "("
			, true);
			
			if (!fnOpen)
				return [expr, false];
			
			return [expr, true];
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
		
		/**
		 * Converts a cover name which is expected to be in the format
		 * "coverSomeSpecificBehavior" to read like "Some specific behavior".
		 */
		export function getCoverFriendlyName(coverName: string)
		{
			return coverName
				.slice(Constants.prefix.length)
				.split(/(?=[A-Z])/)
				.map((v, i) => i > 0 ? v.toLowerCase() : v)
				.join(" ");
		}
		
		/**
		 * Coverts function name to Puppeteer function name
		 */
		export function getPuppeteerName(name: string)
		{
			return name[0].toUpperCase() + name.substr(1);
		}
		
		/**
		 * Logs an information message to the console, using a moduless-specific branding.
		 */
		export function log(message: string)
		{
			const titleCss = "background: blue; color: white; border-radius: 3px; padding: 5px 10px";
			const contentCss = "background: transparent; color: inherit";
			console.log("%cModuless%c\n" + message, titleCss, contentCss);
		}
		
		/**
		 * Logs a warning message to the console, using a moduless-specific branding.
		 */
		export function warn(message: string)
		{
			const titleCss = "background: yellow; color: black; border-radius: 3px; padding: 5px 10px";
			const contentCss = "background: transparent; color: inherit";
			console.warn("%cModuless%c\n" + message, titleCss, contentCss);
		}
		
		/**
		 * Logs an error message to the console, using a moduless-specific branding.
		 */
		export function error(message: string)
		{
			const titleCss = "background: red; color: red; border-radius: 3px; padding: 5px 10px";
			const contentCss = "background: transparent; color: inherit";
			console.warn("%cModuless%c\n" + message, titleCss, contentCss);
		}
		
		export const base64Decode = typeof atob === "undefined" ? 
			((v: string) => Buffer.from(v, "base64").toString("binary")) :
			atob;
	
		export const base64Encode = typeof btoa === "undefined" ?
			((v: string) => Buffer.from(v, "binary").toString("base64")) :
			btoa;
	}
}
