
namespace Moduless
{
	/**
	 * This method is called when the extension is activated.
	 * The extension is activated the very first time the command is executed.
	 */
	async function activate(context: Vs.ExtensionContext)
	{
		const bus = new MessageBus();
		const projectGraph = await ProjectGraph.new(bus);
		
		new Server(projectGraph, bus);
		new CaseTreeProvider("", bus);
		new CaseDecorators();
		new ReportingChannel(bus);
		
		const cmd = Vs.commands.registerCommand(
			Constants.tryCommand,
			(functionName: string = "") =>
			{
				if (functionName)
					bus.emit(new StartCaseMessage(functionName));
			});
		
		/*
		This code is how you detect if a debug session started.
		We should detect if the user started a debug session
		to a server listenining on the moduless server port (10001)
		If so, we need to launch a puppeteer host
		We need to then support a control api that looks like:
		
			void "click"
		
		This would send a message through the WebSocket back
		to the extension process to tell puppeteer to do stuff.
		
		Alternatively, Puppeteer has a method called exposeFunction
		that we can use to avoid all this websocket craziness (it still
		needs to be async though)
		
		Vs.debug.onDidStartDebugSession(e =>
		{
			e.configuration.
		});
		*/
		
		context.subscriptions.push(cmd);
		bus.emit(new InitializeMessage());
	}
	
	/**
	 * This method is called when the extension is deactivated.
	 */
	function deactivate(context: Vs.ExtensionContext)
	{
		// This should probably shut down the server.
	}
	
	function coverSomething()
	{
		const ml: any = null;
		
		ml.div(
			void "click()",
			
			void "type('something')",
			
			void "capture()"
		);
	}
	
	exports.activate = activate;
	exports.deactivate = deactivate;
}
