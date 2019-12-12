
namespace Moduless
{
	const disposables: Vs.Disposable[] = [];
	
	/**
	 * This method is called when the extension is activated.
	 * The extension is activated the very first time the command is executed.
	 */
	async function activate(context: Vs.ExtensionContext)
	{
		const bus = new MessageBus();
		GlobalState.init(context.globalStoragePath, bus);
		const projectGraph = await ProjectGraph.new(bus);
		
		const execSvc = new ExecutionService(projectGraph, bus);
		new CoverManagementService(bus);
		new ReportingChannel(bus);
		
		const treeView = Vs.window.createTreeView("moduless.covers", {
			treeDataProvider: new CoverTreeProvider(
				context.extensionPath,
				projectGraph, bus)
		});
		
		context.subscriptions.push(treeView);
		
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
		});
		
		registerCommand(Commands.stop, () =>
		{
			// Lame...
			execSvc.stopDebugging();
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
	
	exports.activate = activate;
	exports.deactivate = deactivate;
	
	Object.assign(Common, Moduless);
}
