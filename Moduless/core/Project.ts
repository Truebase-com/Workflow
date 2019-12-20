
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
		private parentMap = new WeakMap<ESTree.Node, ESTree.Node | undefined>();
		
		/** */
		private AstWalker<T extends ESTree.Node>(
			node: ESTree.Node, 
			condition: (node: ESTree.Node) => boolean
		){
			const nodes: T[] = [];
			
			const recurseAst = (node: ESTree.Node, parent?: ESTree.Node) =>
			{
				if (!node || typeof node !== "object" || node.constructor !== Object)
					return;
				
				if (condition(node))
				{
					nodes.push(node as T);
					this.parentMap.set(node, parent);
				}
				
				for (const value of Object.values(node))
				{
					if (Array.isArray(value))
						for (const subNode of value)
							recurseAst(subNode, node);
					
					else if (typeof value === "object")
						recurseAst(value, node);
				};
			}
			
			recurseAst(node);
			
			return nodes;
		}
		
		/** */
		private parseScript(script: string)
		{
			return JsParser.parseScript(script, {
				/** The flag to allow module code. */
				module: true,
				/** The flag to enable stage 3 support (ESNext). */
				next: true,
				/** The flag to enable start and end offsets to each node. */
				ranges: true,
				/** The flag to enable line/column location information to each node. */
				loc: true,
				/** The flag to attach raw property to each literal and identifier node. */
				raw: true,
				/** Enabled directives. */
				directives: true,
				/** The flag to enable implied strict mode. */
				impliedStrict: true,
				/** Enable lexical binding and scope tracking. */
				lexical: true,
				/**
				 * Adds a source attribute in every node’s loc object 
				 * when the locations option is `true`.
				 */
				source: true,
				/** Distinguish Identifier from IdentifierPattern. */
				identifierPattern: true
			});
		}
		
		/** */
		private extractCoverFunctions(program: ESTree.Program)
		{
			const coverFunctions: ESTree.FunctionDeclaration[] = 
				this.AstWalker(program, 
					node => node.type === "FunctionDeclaration" 
						&& new RegExp(`^${Constants.prefix}[A-Z]`).test(node.id?.name || ""));
			
			this._coverFunctionNames = [];
			this._coverFunctionPositions = {};
			
			for (const cover of coverFunctions)
			{
				const name = cover.id?.name;
				if (!name)
					continue;
					
				this._coverFunctionNames.push(name);
				this._coverFunctionPositions[name] = cover.loc?.start;
				
				const parsed = this.parseScript(`Moduless.addCover(${name});`);
				const parent = this.parentMap.get(cover);
				if (parent)
					(parent as ESTree.BlockStatement).body.push(...(parsed.body as any[]));
			}
			
			return coverFunctions;
		}
		
		/** */
		private extractVoidStrings(nodes: ESTree.FunctionDeclaration[])
		{
			const voidStrings = nodes.map(node => [
					this.AstWalker<ESTree.UnaryExpression>(
						node, 
						node => node.type === "UnaryExpression" && node.operator === "void"
					).filter((v) => v.argument.type === "Literal"),
					node.id?.name
				]
			) as [ESTree.UnaryExpression[], string | undefined][];
			
			for (const voidString of voidStrings)
			{
				const [nodeExpr, coverName] = voidString;
				for (const expr  of nodeExpr)
				{
					const parent = this.parentMap.get(expr);
					if (!parent)
						continue;
					
					const literal = (expr.argument as ESTree.Literal).value as string;
					const parsed = (
						this.parseScript(literal).body[0] as ESTree.ExpressionStatement
					).expression as ESTree.CallExpression;
					
					const functionName = (parsed.callee as ESTree.Identifier).name;
					const functionArgs = parsed.arguments.map((v) => (v as ESTree.Literal).raw);
					
					const contextData = {
						coverName,
						projectPath: this.projectPath
					};
						
					const context = JSON.stringify(contextData);
					
					if (parent.type === "CallExpression")
						functionArgs.push("e");
					
					const fnExpression = (this.parseScript(`
						async (e) => await Puppeteer.send(${context}, Puppeteer.${functionName}(${functionArgs.join(",")}))
					`).body[0] as ESTree.ExpressionStatement).expression as ESTree.ArrowFunctionExpression;
					
					const awaitExpression = (fnExpression.body as ESTree.AwaitExpression);
					
					switch (parent.type)
					{
						case "CallExpression":
						{
							const index = parent.arguments.indexOf(expr as any);
							if (index < 0)
								continue;
								
							parent.arguments.splice(index, 1, fnExpression);
							break;
						}
						case "ExpressionStatement":
						{
							parent.expression = awaitExpression;
							break;	
						}
						case "ArrowFunctionExpression":
						{
							parent.body = awaitExpression.argument;
							break;
						}
						case "BlockStatement":
						{
							const index = parent.body.indexOf(expr as any);
							if (index < 0)
								continue;
								
							parent.body.splice(index, 1, awaitExpression as any);
							break;
						}
						default: 
							debugger;
							break;
					}
				}
			}
		}
		
		/**
		 * Instruments the specified body of source code so that cover functions
		 * are detected and added to the global cover repository.
		 */
		private async updateProjectCode()
		{
			const originalCode = Fs.readFileSync(this.outFile).toString();
			
			const sourceMapIndex = originalCode.lastIndexOf("\n");
			const lastLine = originalCode.substr(sourceMapIndex + 1);
			const [ header, base64 ] = lastLine.split(",");
			if (header === "//# sourceMappingURL=data:application/json;base64")
			{
				try {
					const parsed = JSON.parse(base64Decode(base64));
					const sourceMap = await new SourceMap.SourceMapConsumer(parsed);
					
					if (this.sourceMap)
						this.sourceMap.destroy();
						
					this.sourceMap = sourceMap;
				}
				catch (ex)
				{
					console.error(ex);
				}
			}
			
			if (!originalCode.includes("function " + Constants.prefix))
				return this._instrumentedCode = originalCode;
			
			const program = this.parseScript(originalCode)
			
			const coverFunctions = this.extractCoverFunctions(program);
			this.extractVoidStrings(coverFunctions);
		
			// JS Generation
			const SourceMapGenerator = this.sourceMap && SourceMap.SourceMapGenerator.fromSourceMap(this.sourceMap);
			
			this._instrumentedCode = JsBuilder.generate(program as any, {
				sourceMap: SourceMapGenerator
			});
			
			this._instrumentedCode += `//# sourceMappingURL=data:application/json;base64,${base64Encode(JSON.stringify(SourceMapGenerator))}`
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
