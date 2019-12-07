
namespace Moduless
{
	/**
	 * 
	 */
	export class ProjectGraph
	{
		/** */
		static async new(bus: MessageBus)
		{
			const rootPath = Vs.workspace.rootPath;
			if (!rootPath)
				return new ProjectGraph([], bus);
			
			const files = await Vs.workspace.findFiles("tsconfig*.json");
			return new ProjectGraph(files, bus);
		}
		
		/** */
		private constructor(files: Vs.Uri[], bus: MessageBus)
		{
			this.bus = bus;
			
			for (const file of files)
				this.createRecursive(file.fsPath);
			
			for (const project of this.projects.values())
				console.log(project.filePath);
		}
		
		/** */
		private createRecursive(targetConfigFilePath: string)
		{
			if (!Fs.existsSync(targetConfigFilePath))
			{
				console.warn("File does not exist: " + targetConfigFilePath);
				return null;
			}
			
			if (this.projects.has(targetConfigFilePath))
			{
				console.warn("Circular project reference including: " + targetConfigFilePath);
				return this.projects.get(targetConfigFilePath) || null;
			}
			
			const scripts: ScriptReference[] = [];
			const references: Project[] = [];
			const tsConfig = Util.parseConfigFile(targetConfigFilePath);
			
			for (const refEntry of tsConfig.references)
			{
				const refPath = refEntry.path;
				const prepend = !!refEntry.prepend;
				
				// We have to avoid following projects that are "prepend",
				// because they'll already be in the output.
				if (prepend)
				{
					console.log(`(Found ${refPath}, but skipping because "prepend" is true.)`);
					continue;
				}
				
				if (typeof refPath !== "string")
					continue;
				
				const fullPath = this.resolveReference(targetConfigFilePath, refPath);
				const referencedProject = this.createRecursive(fullPath);
				
				if (referencedProject !== null)
					references.push(referencedProject);
			}
			
			const targetProjectDir = Path.dirname(targetConfigFilePath);
			
			for (const script of tsConfig.moduless.scripts)
			{
				if (typeof script === "string")
				{
					const scriptUrl = Url.parse(script);
					if (scriptUrl.protocol === "http:" || scriptUrl.protocol === "https:")
					{
						scripts.push(new ScriptReference(ScriptKind.external, script));
						continue;
					}
					else if (scriptUrl.protocol === null)
					{
						scripts.push(new ScriptReference(
							ScriptKind.local,
							Path.join(targetProjectDir, script)));
						
						continue;
					}
				}
				
				console.log("Invalid script URL: " + String(script));
			}
			
			let outFile = "";
			
			if (tsConfig.compilerOptions.outFile)
			{
				outFile = Path.join(targetProjectDir, tsConfig.compilerOptions.outFile);
				scripts.push(new ScriptReference(ScriptKind.outFile, outFile));
			}
			
			const project = new Project(
				tsConfig.name,
				targetConfigFilePath,
				outFile,
				scripts,
				references,
				this.bus);
			
			this.projects.set(targetConfigFilePath, project);
			return project;
		}
		
		/**
		 * Returns the fully-qualfied path to a project from
		 * a "references" object within some other config file.
		 */
		private resolveReference(sourcePath: string, referencedPath: string)
		{
			const sourceDir = Path.extname(sourcePath) === ".json" ?
				Path.dirname(sourcePath) :
				sourcePath;
			
			const referencedDir = Path.extname(referencedPath) === ".json" ?
				Path.dirname(referencedPath) :
				referencedPath;
			
			const referencedFile = Path.extname(referencedPath) === ".json" ?
				Path.basename(referencedPath) :
				"tsconfig.json";
			
			return Path.join(sourceDir, referencedDir, referencedFile);
		}
		
		/** */
		[Symbol.iterator]()
		{
			return this.projects.values();
		}
		
		/**
		 * Finds a Project object that relates to the specfied path.
		 * The path parameter may be the path to a tsconfig file,
		 * or it may be the path to an outFile specified within the 
		 * Project's tsconfig.
		 */
		find(path: string)
		{
			const targetProjectConfig = this.resolveReference("", path);
			const projectViaConfig = this.projects.get(targetProjectConfig);
			if (projectViaConfig)
				return projectViaConfig;
			
			for (const project of this.projects.values())
				if (project.outFile === path)
					return project;
			
			return null;
		}
		
		/** */
		private readonly bus: MessageBus;
		
		/**
		 * Stores a map of Project objects, keyed by the corresponding 
		 * absolute file path to it's tsconfig file.
		 */
		private readonly projects = new Map<string, Project>();
	}
	
	/**
	 * 
	 */
	export class CaseInstance
	{
		constructor(
			readonly relatedProject: Project,
			readonly caseFunctionName: string)
		{ }
	}
	
	/** */
	export class CaseChangeInfo
	{
		constructor(
			readonly caseInstance: CaseInstance,
			readonly added: boolean,
			readonly fixtureName: string,
			readonly functionName: string) { }
	}
}
