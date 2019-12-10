
namespace Moduless
{
	const disposables: Vs.Disposable[] = [];
	
	/**
	 * This method is called when the extension is activated.
	 * The extension is activated the very first time the command is executed.
	 */
	async function activate(context: Vs.ExtensionContext)
	{
		GlobalState.init(context.globalStoragePath);
		
		const bus = new MessageBus();
		const projectGraph = await ProjectGraph.new(bus);
		const execService = new ExecutionService(projectGraph, bus);
		
		new CoverDecorationService();
		new ReportingChannel(bus);
		
		const treeView = Vs.window.createTreeView("moduless.covers", {
			treeDataProvider: new CoverTreeProvider("", projectGraph, bus)
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
			
			const projectPath = "";
			const coverName = "";
			
			bus.emit(new SelectCoverMessage(projectPath, coverName));
			bus.emit(new StartCoverMessage(projectPath, coverName));
		});
		
		registerCommand(Commands.stop, () =>
		{
			debugger;
		});
		
		registerCommand(Commands.setBrowserVisible, () =>
		{
			execService.isBrowserShown = true;
		});
		
		registerCommand(Commands.setBrowserInvisible, () =>
		{
			execService.isBrowserShown = false;
		});
		
		registerCommand(Commands.setDevtoolsVisible, () =>
		{
			execService.isDevtoolsShown = true;
		});
		
		registerCommand(Commands.setDevtoolsInvisible, () =>
		{
			execService.isDevtoolsShown = false;
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
	
	
	
	function coverSomething()
	{
		const ml: any = null;
		
		ml.div(
			void "click()",
			void "type('something')",
			void "capture()"
		);
	}
}
