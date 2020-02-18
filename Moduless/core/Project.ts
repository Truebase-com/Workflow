
namespace Moduless
{
	/** */
	export enum ScriptKind
	{
		external,
		local,
		outFile
	};
	
	/**
	 * 
	 */
	export class ScriptReference
	{
		constructor(
			readonly kind: ScriptKind,
			readonly uri: string)
		{ }
	}
	
	/** */
	export type CoverChangedFn = (
		project: Project,
		coverFunctionName: string,
		index: number) => void;
		
	const coverFunctionRegex = new RegExp(`^${Constants.prefix}[A-Z]`);
	
	/**
	 * A "Project" loosely corresponds to a tsconfig.json file.
	 * It refers to a compilation unit that has a series of input 
	 * files, and an output file.
	 */
	export class Project
	{
		/** */
		constructor(
			/**
			 * Stores the name of the project, which is calculated either by taking the
			 * extensionless version of the project's outFile, or by reading the custom
			 * "name" key in the project's associated tsconfig file.
			 */
			readonly name: string,
			/**
			 * Stores the fully qualified path and file name of the file specified in the
			 * .fileName field.
			 */
			readonly filePath: string,
			/**
			 * 
			 */
			readonly projectPath: string,
			/**
			 * Stores a fully-qualified version of the outFile value specified
			 * in the compilerOptions section of the corresponding config file.
			 * 
			 * Stores an empty string in the case when no .outFile value was
			 * not found in the corresponding config file.
			 */
			readonly outFile: string,
			/**
			 * An array containing the JavaScript files to include in the
			 * generated HTML page.
			 */
			readonly scripts: ScriptReference[],
			/**
			 * An array containing the references to the other projects.
			 */
			readonly referencedProjects: readonly Project[],
			/**
			 * 
			 */
			private readonly bus: MessageBus)
		{
			this.fileName = Path.basename(filePath);
			this.folder =  Path.dirname(filePath);
			
			if (outFile)
			{
				Fs.watchFile(outFile, this.onOutFileChange.bind(this));
				this.updateProjectCode();
				
				bus.listen(InitializeMessage, () =>
				{
					for (const [i, coverName] of this.coverFunctionNames.entries())
						this.bus.emit(new AddCoverMessage(this, coverName, i));
				});
			}
			
			if (!name && outFile)
				this.name = outFile.replace(/\.js$/, "");
		}
		
		/**
		 * The name of the TypeScript configuration file that corresponds to this Project.
		 * Typically stores something like "tsconfig.json".
		 */
		readonly fileName: string;
		
		/**
		 * Stores the fully qualified folder path of the project.
		 */
		readonly folder: string;
		
		/**
		 * Returns an array that contains all nested script references
		 * within the project sub graph.
		 */
		eachScript()
		{
			const yielded: string[] = [];
			const scripts: ScriptReference[] = [];
			
			for (const project of this.recurse())
				for (const scriptRef of project.scripts)
					if (!yielded.includes(scriptRef.uri))
						yielded.push(scriptRef.uri),
						scripts.push(scriptRef);
			
			return scripts;
		}
		
		/**
		 * Finds the common left-side URI path between this Project,
		 * and all it's referenced descendents.
		 */
		findCommonPath()
		{
			const allScripts = this.eachScript();
			
			for (const sr of allScripts)
				Util.log(`Discovered ${ScriptKind[sr.kind]} script: ` + sr.uri);
			
			const localScriptPaths = allScripts
				.filter(sc => sc.kind !== ScriptKind.external)
				.map(sc => sc.uri);
			
			const commonPath = localScriptPaths.length === 1 ?
				Util.findCommonPath(localScriptPaths.concat(process.cwd())) :
				Util.findCommonPath(localScriptPaths);
			
			return commonPath;
		}
		
		/**
		 * Performs a deep, depth-first traversal on the 
		 * Project references of this Project.
		 */
		*recurse()
		{
			function* recurseInner(project: Project): Iterable<Project>
			{
				for (const ref of project.referencedProjects)
					yield* recurseInner(ref);
				
				yield project;
			}
			
			yield* recurseInner(this);
		}
		
		/**
		 * 
		 */
		private async onOutFileChange()
		{
			const existingCoverNames = this.coverFunctionNames.slice();
			await this.updateProjectCode();
			
			const steps = Moduless.calculateMigrationSteps(
				existingCoverNames,
				this.coverFunctionNames);
			
			for (const idx of steps.indexesToDelete)
				this.bus.emit(new RemoveCoverMessage(
					this, 
					existingCoverNames[idx],
					idx));
			
			for (const { index, item } of steps.itemsToAdd)
				this.bus.emit(new AddCoverMessage(
					this,
					item,
					index));
			
			this.bus.emit(new ReloadMessage());
		}
		
		private sourceMap?: import("source-map").BasicSourceMapConsumer;
		
		scriptMap = new WeakMap();
		
		/** */
		private parseScript(script: string)
		{
			const ast = JsParser.parse(script);
			this.scriptMap.set(ast.program, ast);
			return ast.program;
		}
		
		private injectOscilloscopeCaptures(
			node: 
				import("ast-types").namedTypes.FunctionDeclaration | 
				import("ast-types").namedTypes.FunctionExpression ,
			defaultName = "Anonymous"
		) {
			return;
			
			const name = `${this.name}:${node.id?.name || defaultName}`;
			
			const args = [
				"__Moduless__fId___",
				"this",
				`"${name}"`,
				...node.params.map(v => 
					((v.type === "AssignmentPattern" ? v.left : v) as ESTree.Identifier).name
				)
			];
			
			const functionName = name.split(".");
			
			if (functionName.length == 2 && functionName[1] === "constructor")
			{
				const superIndex = node.body.body
					.findIndex(v => (v.type === "ExpressionStatement" 
						&& v.expression.type === "CallExpression" 
						&& v.expression.callee.type === "Super"));
					
				if (superIndex >= 0)
				{				
					node.body.body.splice(superIndex + 1, 0, 
						`const __Moduless__fId___ = Oscilloscope.nextId();` as any,
						`Oscilloscope.captureArgs(${args.join(", ")});` as any);
				}
				else 
				{
					node.body.body.unshift(
						`const __Moduless__fId___ = Oscilloscope.nextId();` as any,
						`Oscilloscope.captureArgs(${args.join(", ")});` as any
					);
				}
			}
			else 
			{
				node.body.body.unshift(
					`const __Moduless__fId___ = Oscilloscope.nextId();` as any,
					`Oscilloscope.captureArgs(${args.join(", ")});` as any
				);
			}
			
			JsParser.visit(node, {
				visitFunction()
				{
					return false;
				},
				visitReturnStatement(returnPath)
				{
					const returnNode = returnPath.node;
					
					let printed = "";
					try 
					{
						printed = returnNode.argument 
							&& (typeof returnNode.argument === "string" ?
							 returnNode.argument :
							 JsParser.prettyPrint(returnNode.argument).code 
							) || "";
					}
					catch (e) 
					{
						debugger;
					}
					
					const args = ["__Moduless__fId___"];
					if (printed) 
						args.push(printed);
					
					returnNode.argument = printed.startsWith("Oscilloscope.captureReturn") ? 
						printed : `Oscilloscope.captureReturn(${args.join(", ")})` as any;
					
					return false;
				}
			});
		}
		
		/** */
		private extractCoverFunctions(program: ESTree.Program)
		{
			const coverFunctions: import("ast-types").namedTypes.FunctionDeclaration[] = [];
			
			const cFN = this._coverFunctionNames = [] as string[];
			const cFP = this._coverFunctionPositions = {} as Record<string, ESTree.Position | undefined>;
			
			const project = this;
			
			JsParser.visit(program, {
				visitClassDeclaration(path)
				{
					const className = path.node.id?.name;
					JsParser.visit(path.node, {
						visitMethodDefinition(path)
						{
							const methodName = (path.node.key as ESTree.Identifier).name;
							project.injectOscilloscopeCaptures(path.node.value as any, `${className}.${methodName}`);
							return false;
						}
					})
					return false;
				},
				visitClassExpression(path)
				{
					const className = path.node.id?.name;
					JsParser.visit(path.node, {
						visitMethodDefinition(path)
						{
							const methodName = (path.node.key as ESTree.Identifier).name;
							project.injectOscilloscopeCaptures(path.node.value as any, `${className}.${methodName}`);
							return false;
						}
					})
					return false;
				},
				visitFunctionExpression(path)
				{
					project.injectOscilloscopeCaptures(path.node);
					this.traverse(path);
				},
				visitFunctionDeclaration(path)
				{
					const node = path.node;
					const id = node.id;
					const name = id.name;
									
					project.injectOscilloscopeCaptures(node);
					
					if (coverFunctionRegex.test(name))
					{
						coverFunctions.push(node);
						path.insertAfter(
							`Moduless.addCover(${name})`
						);
						
						cFN.push(name);
						cFP[name] = node.loc?.start;
					}
					this.traverse(path);
				}
			});
			
			return coverFunctions;
		}
		
		/** */
		private extractVoidStrings(nodes: import("ast-types").namedTypes.FunctionDeclaration[])
		{	
			const project = this;
			for (const coverNode of nodes)
				JsParser.visit(coverNode, {
					visitUnaryExpression(path)
					{
						const node = path.node;
						const operator = node.operator;
						const expression = node.argument as ESTree.Literal;
						if (operator === "void" && expression.type === "Literal" && typeof expression.value === "string")
						{
							const parent = path.parent.node as (
								ESTree.CallExpression |
								ESTree.ExpressionStatement |
								ESTree.ArrowFunctionExpression |
								ESTree.BlockStatement);
								
							const contextData = {
								coverName: coverNode.id?.name,
								projectPath: project.projectPath
							};
						
							const program = project.parseScript(expression.value as string);
							const parsed = program.body[0].expression as ESTree.CallExpression;
														
							const functionName = (parsed.callee as ESTree.Identifier).name;
							
							const awaitExpression = JsBuilder.awaitExpression(
								JsBuilder.callExpression(
									JsBuilder.memberExpression(
										JsBuilder.identifier("VoidStrings"),
										JsBuilder.identifier("Eval")
									),
									[
										JsBuilder.stringLiteral(JSON.stringify(contextData)),
										JsBuilder.stringLiteral(functionName),
										...(parsed.arguments as any[])
									]
								)
							);
							
							const fnExpression = JsBuilder.arrowFunctionExpression([
								JsBuilder.identifier("e")
							], awaitExpression);
									
							switch (parent.type)
							{
								case "CallExpression":
								{
									((fnExpression.body as ESTree.AwaitExpression)
										.argument as ESTree.CallExpression)
										.arguments
										.push(JsBuilder.identifier("e"));
										
									path.replace(fnExpression);
									break;
								}
								case "ExpressionStatement":
								{
									path.replace(awaitExpression);
									break;	
								}
								case "ArrowFunctionExpression":
								{
									path.replace(awaitExpression.argument as any);
									break;
								}
								case "BlockStatement":
								{
									path.replace(awaitExpression);
									break;
								}
								default: 
									debugger;
									break;
							}
						}
						this.traverse(path);
					}
				});
		}
		
		/**
		 * Instruments the specified body of source code so that cover functions
		 * are detected and added to the global cover repository.
		 */
		private async updateProjectCode()
		{
			const originalCode = Fs.readFileSync(this.outFile).toString();
			const [ code, sourceMapBase64 ] = originalCode.split("//# sourceMappingURL=data:application/json;base64,");
			
			const parsedSourceMap = JSON.parse(base64Decode(sourceMapBase64));
			const sourceMap = await new SourceMap.SourceMapConsumer(parsedSourceMap);
			
			if (this.sourceMap)
				this.sourceMap.destroy();
				
			this.sourceMap = sourceMap;
							
			const program = JsParser.parse(code, {
				sourceFileName: Path.basename(this.outFile)
			});
			
			const coverFunctions = this.extractCoverFunctions(program);
			this.extractVoidStrings(coverFunctions);
			
			const jsCode = JsParser.print(program, {
				sourceMapName: "map.json"
			});
			
			const composedMap = JsParserUtils.composeSourceMaps(parsedSourceMap, jsCode.map);
			
			this._instrumentedCode = jsCode.code + 
				"//# sourceMappingURL=data:application/json;base64," + 
				base64Encode(JSON.stringify(composedMap));
			
		}
		
		/** */
		resolveSymbol(coverFunctionName: string)
		{
			const pos = this._coverFunctionPositions[coverFunctionName];
			if (!pos) return null;
			const result = this.sourceMap?.originalPositionFor(pos);
			return result || null;
		}
		
		/** */
		get instrumentedCode()
		{
			return this._instrumentedCode;
		}
		private _instrumentedCode: string = "";
		
		/** */
		get coverFunctionNames()
		{
			return this._coverFunctionNames;
		}
		private _coverFunctionNames: string[] = [];
		
		private _coverFunctionPositions: Record<string, ESTree.Position | undefined> = {};
	}
}
