
namespace Moduless
{
	const disposables: Vs.Disposable[] = [];

	const takeSnapshotButton = Vs.window.createStatusBarItem(); 
	
	/**
	 * This method is called when the extension is activated.
	 * The extension is activated the very first time the command is executed.
	 */
	async function activate(context: Vs.ExtensionContext)
	{
		const bus = new MessageBus();
		GlobalState.init(context.globalStoragePath, bus);
		const projectGraph = await ProjectGraph.new(bus);
		
		const execSvc = await ExecutionService.new(projectGraph, bus);
		new CoverManagementService(bus);
		new VoidManagementService(bus);
		new ReportingChannel(bus);
		
		const treeView = Vs.window.createTreeView("moduless.covers", {
			treeDataProvider: new CoverTreeProvider(
				context.extensionPath,
				projectGraph, bus)
		});
		
		context.subscriptions.push(treeView);
		context.subscriptions.push(takeSnapshotButton);
		takeSnapshotButton.hide();
		
		takeSnapshotButton.command = Commands.snapshot;
		takeSnapshotButton.text = "$(screen-full)";
		
		const registerCommand = (name: string, callback: (...args: any[]) => void) =>
		{
			const cmd = Vs.commands.registerCommand(name, callback);
			context.subscriptions.push(cmd);
			disposables.push(cmd);
		};
		
		registerCommand(Commands.start, () =>
		{
			// This should automatically run the cover within which the caret is positioned.
			// It should then save this as the last-run cover, so that if you try to run again
			// from some other non-cover function, it uses the last one. (You still need to
			// be able to click to run a specific cover)
			
			const selected = GlobalState.selectedCover;
			bus.emit(new StartCoverMessage(
				selected.containingFile,
				selected.coverFunctionName));
			takeSnapshotButton.show();
		});
		
		
		registerCommand(Commands.focusCover, async (project: Project, symbol: SourceMap.NullableMappedPosition) =>
		{
			if (!symbol.source) return;
			
			const editor = await Vs.window.showTextDocument(Vs.Uri.file(Path.join(project.folder, symbol.source)));
			const pos = new Vs.Position(symbol.line || 0, symbol.column || 0);
			editor.revealRange(new Vs.Range(pos, pos), Vs.TextEditorRevealType.InCenter);
			editor.selection = new Vs.Selection(pos, pos);
		});
		
		registerCommand(Commands.snapshot, async () =>
		{	
			const project = projectGraph.find(GlobalState.selectedCover.containingFile);
			
			if (!execSvc.activePage || !project) 
				return;
			
			const PNG = require('pngjs').PNG;
			const ss = PNG.sync.read(await execSvc.activePage.screenshot());
			await Fs.promises.writeFile(
				Path.join(project.projectPath, "../captures", `${GlobalState.selectedCover.coverFunctionName}.png`)
			, PNG.sync.write(ss));
		});
		
		registerCommand(Commands.stop, () =>
		{
			// Lame...
			execSvc.stopDebugging();
			takeSnapshotButton.hide();
		});
		
		registerCommand(Commands.setBrowserVisible, () =>
		{
			GlobalState.isBrowserShown = true;
		});
		
		registerCommand(Commands.setBrowserInvisible, () =>
		{
			GlobalState.isBrowserShown = false;
		});
		
		registerCommand(Commands.setDevtoolsVisible, () =>
		{
			GlobalState.isDevtoolsShown = true;
		});
		
		registerCommand(Commands.setDevtoolsInvisible, () =>
		{
			GlobalState.isDevtoolsShown = false;
		});
		
		const tasks = await Vs.tasks.fetchTasks();
		const mainWatchTask = tasks.find(task =>
		{
			const def = task.definition as ITypeScriptTaskDefinition;
			return def.type === "typescript" &&
				def.option === "watch" &&
				def.tsconfig === "tsconfig.json";
		});
		
		if (mainWatchTask)
			Vs.tasks.executeTask(mainWatchTask);
		
		bus.emit(new InitializeMessage());
	}
	
	/**
	 * This method is called when the extension is deactivated.
	 */
	function deactivate(context: Vs.ExtensionContext)
	{
		// This should probably shut down the server.
		
		for (const disposable of disposables)
			disposable.dispose();
	}
	
	/** */
	interface ITypeScriptTaskDefinition
	{
		option: "watch" | "build";
		tsconfig: string;
		type: string;
	}
	
	exports.activate = activate;
	exports.deactivate = deactivate;
	
	Object.assign(Common, Moduless);
}
