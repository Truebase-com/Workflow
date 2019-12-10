
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
				console.log(`Discovered ${ScriptKind[sr.kind]} script: ` + sr.uri);
			
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
		private onOutFileChange()
		{
			const existingCoverNames = this.coverFunctionNames.slice();
			this.updateProjectCode();
			
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
		
		/**
		 * Instruments the specified body of source code so that cover functions
		 * are detected and added to the global cover repository.
		 */
		private updateProjectCode()
		{
			const originalCode = Fs.readFileSync(this.outFile).toString();
			
			if (!originalCode.includes("function " + Constants.prefix))
				return this._instrumentedCode = originalCode;
			
			const program = JsParser.parseScript(originalCode, {
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
			
			const coverFunctions: ESTree.FunctionDeclaration[] = [];
			
			const recurseAst = (node: ESTree.Node) =>
			{
				if (!node || typeof node !== "object" || node.constructor !== Object)
					return;
				
				if (node.type === "FunctionDeclaration")
					if (new RegExp(`^${Constants.prefix}[A-Z]`).test(node.id?.name || ""))
						coverFunctions.push(node);
				
				for (const value of Object.values(node))
				{
					if (Array.isArray(value))
						for (const subNode of value)
							recurseAst(subNode);
					
					else if (typeof value === "object")
						recurseAst(value);
				}
			};
			
			for (const node of program.body)
				recurseAst(node);
			
			const splits: { position: number; functionName: string; }[] = [];
			for (const decl of coverFunctions)
			{
				const functionName = decl.id?.name;
				if (!functionName)
					continue;
				
				splits.push({
					position: decl.end || originalCode.length,
					functionName
				});
			}
			
			const outChunks: string[] = [];
			let lastPosition = 0;
			
			for (let i = -1; ++i < splits.length;)
			{
				const { position, functionName } = splits[i];
				const sourceChunk = originalCode.slice(lastPosition, position);
				const injectChunk = `;Moduless.addCover(${functionName});`;
				outChunks.push(sourceChunk, injectChunk);
				lastPosition = position;
			}
			
			outChunks.push(originalCode.slice(lastPosition));
			this._instrumentedCode = outChunks.join("");
			this._coverFunctionNames = splits.map(v => v.functionName);
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
	}
}
