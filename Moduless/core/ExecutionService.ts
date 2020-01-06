
namespace Moduless
{
	/**
	 * A long-lived class that deals with executing cover functions.
	 */
	export class ExecutionService
	{
		/** */
		static async new(
			projectGraph: ProjectGraph,
			bus: MessageBus)
		{
			const ports = await Moduless.findPorts();
			return await new ExecutionService(projectGraph, bus, ports);
		}
		
		/** */
		private constructor(
			private readonly projectGraph: ProjectGraph,
			private readonly bus: MessageBus,
			ports: IPorts)
		{
			this.httpPort = ports.httpPort;
			this.wsPort = ports.wsPort;
			this.httpServer = this.setupHttpServer();
			this.wsServer = this.setupSocketServer();
			this.setupPuppeteerListeners();
		}
		
		/** */
		private setupHttpServer()
		{
			const httpServer = Http.createServer((req, res) =>
			{
				const urlParsed = Url.parse(req.url || "");
				const query = urlParsed.query;
				const path = urlParsed.path || "";
				
				let mime: string = "";
				let result: string | Buffer = "";
				
				const relatedProject = this.projectGraph.find(path);
				
				if (relatedProject)
				{
					mime = this.getMimeType(path);
					result = relatedProject.instrumentedCode;
				}
				else if (query && query.startsWith("?"))
				{
					const queryCut = query.replace(/^\?*/, "");
					const modulessResult = this.handleModulessRequest(queryCut);
					if (modulessResult)
					{
						mime = this.getMimeType(queryCut);
						result = modulessResult;
					}
				}
				else
				{
					const standardResult = this.handleStandardRequest(path);
					if (standardResult)
					{
						mime = this.getMimeType(path);
						result = standardResult;
					}
				}
				
				if (result)
				{
					res.writeHead(200, {
						"Content-Type": mime,
						"Content-Length": Buffer.byteLength(result)
					});
					
					res.write(result);
				}
				else
				{
					res.writeHead(500);
				}
				
				res.end();
			});
			
			httpServer.listen(this.httpPort);
			Util.log("Moduless HTTP server listening on port: " + this.httpPort);
			
			return httpServer;
		}
		
		/** */
		private setupSocketServer()
		{
			const wsServer = new Ws.Server({ port: this.wsPort });
			wsServer.on("connection", ws =>
			{
				ws.on("message", socketData =>
				{
					const message = Message.parse(socketData.toString());
					this.bus.emit(message);
				});
			});
			
			Util.log("Moduless WebSocket server listening on port: " + this.wsPort);
			return wsServer;
		}
		
		/** */
		dispose()
		{
			this.stopDebugging();
		}
		
		//# HTTP and Socket Server Members
		
		/** */
		private readonly httpServer: Http.Server;
		
		/** */
		private readonly wsServer: Ws.Server;
		
		// NOTE: This isn't going to work with multiple instances of VS Code
		// We're going to need to do a port scan and find an available port.
		
		/** The port number on which to launch the moduless HTTP server. */
		private readonly httpPort: number;
		
		/** The port number on which to launch the moduless WebSocket server. */
		private readonly wsPort: number;
		
		/** */
		private readonly standardFiles = {
			common: "moduless.common.js",
			tunnel: "moduless.tunnel.js"
		};
		
		/**
		 * Handles a moduless-specific request, specifically, one whose request URL
		 * has a double ?? for the query string, forming a URL that looks like:
		 * http://localhost:10001/??/path/goes/here
		 */
		private handleModulessRequest(specifier: string): string | Buffer
		{
			if (specifier === this.standardFiles.tunnel)
				return this.getTunnelScript();
			
			if (specifier === this.standardFiles.common)
				return this.getCommonScript();
			
			const path = Path.parse(specifier);
			
			// Other resource file (currently unused).
			if (path.ext)
			{
				return Fs.readFileSync(specifier);
			}
			// Return an HTML file, which loads the project dependencies
			// in <script> tags:
			else
			{
				const project = this.projectGraph.find(specifier);
				return project ?
					this.getHtml(project) :
					"";
			}
		}
		
		/** */
		private handleStandardRequest(specifier: string): string | Buffer
		{
			if (specifier === "/favicon.ico")
				return new Buffer(0);
			
			if (Fs.existsSync(specifier))
				return Fs.readFileSync(specifier);
			
			// This probably needs to make the specifier relative to the workspaceRoot.
			return "";
		}
		
		/** */
		private getMimeType(path: string)
		{
			if (path.lastIndexOf(".") < 0)
				return Moduless.mimeTypes.html;
			
			const ext = Path.extname(path).replace(/^\./, "");
			return Moduless.mimeTypes[ext] || Moduless.mimeTypes.txt;
		}
		
		/** */
		private getHtml(project: Project)
		{
			const scripts = project.eachScript().map(v => v.uri);
			scripts.unshift(...Object.values(this.standardFiles).map(v => "/??" + v));
			
			const htmlLines = scripts.map(v => `<script src="${v}"></script>`);
			htmlLines.unshift("<!doctype html>");
			
			return htmlLines.join("\n");
		}
		
		/** */
		private getTunnelScript()
		{
			if (this.tunnelScript)
				return this.tunnelScript;
			
			const tunnelFilePath = require.resolve("./" + this.standardFiles.tunnel);
			const tunnelScript = Fs.readFileSync(tunnelFilePath, "utf8")
				.replace(/\s__wsPort__\s=\s\d+;/, ` __wsPort__ = ${this.wsPort};`);
			
			return this.tunnelScript = tunnelScript;
		}
		private tunnelScript = "";
		
		/** */
		private getCommonScript()
		{
			const tunnelFilePath = require.resolve("./" + this.standardFiles.common);
			return Fs.readFileSync(tunnelFilePath, "utf8");
		}
		
		/**
		 * Sends the specified message to all clients connected via WebSocket.
		 */
		private broadcastViaSocket(message: Message)
		{
			if (this.wsServer.clients.size === 0)
				return;
			
			const messageText = message.toString();
			for (const client of this.wsServer.clients)
				client.send(messageText);
		}
		
		//# Puppeteer Members
		
		/** */
		private async setupPuppeteerListeners()
		{
			Vs.debug.onDidTerminateDebugSession(() =>
			{
				this.stopDebugging();
			});
			
			this.bus.listen(StartCoverMessage, async msg =>
			{
				const project = this.projectGraph.find(msg.containingFilePath);
				if (!project)
					throw new Error("No project contains the file: " + msg.containingFilePath);
				
				const url = this.getDebugUrl(project.folder);
				
				if (!this.activeBrowser)
					await this.maybeStartBrowser(url);
				
				await this.maybeStartDebugging(url);
				this.broadcastViaSocket(msg);
			});
			
			// We can expose the entire Puppeteer API to the browser 
			// by looping through the activePage object and adding functions
			// that look like this:
			// this.activePage!.exposeFunction("??", (...args: any[]) => { });
		}
		
		/**
		 * 
		 */
		private async maybeStartBrowser(url: string)
		{
			return new Promise(resolve =>
			{
				if (this.activeBrowser)
					return resolve();
				
				Pup.launch({
					ignoreHTTPSErrors: true,
					headless: !GlobalState.isBrowserShown,
					devtools: GlobalState.isDevtoolsShown,
					defaultViewport: null,
					userDataDir: Path.join(GlobalState.globalStoragePath, "./userData"),
					env: {
						cwd: GlobalState.globalStoragePath
					},
					args: [
						`--remote-debugging-port=9222`,
						url
					]
				}).then(async browser =>
				{
					this.activeBrowser = browser;
					const pages = await this.activeBrowser.pages();
					const page = pages[0];
					this.activePage = page;
					
					page.exposeFunction("puppeteerEval", 
						(contextData: {coverName: string}, args: [string, ...any[]]) => 
						{
							const fn = eval(args.shift());
							const context = {
								page,
								fs: Fs,
								path: Path,
								...contextData
							};
							return fn(context, ...args);
						});
					
					resolve();
				})
				.catch(reason =>
				{
					Util.error(reason);
					resolve();
				});
			});
		}
		
		/**
		 * 
		 */
		private async maybeStartDebugging(url: string)
		{
			await Vs.debug.startDebugging(
				undefined,
				{
					name: "(Auto-generated debug configuration)",
					type: "chrome",
					request: "attach",
					port: 9222,
					url,
					webRoot: "${workspaceRoot}",
					timeout: 30000,
					smartStep: true,
					sourceMaps: true
				}
			);
		}
		
		/** */
		private getDebugUrl(folder: string)
		{
			return `http://localhost:${this.httpPort}/??` + folder;
		}
		
		private activeBrowser: Pup.Browser | null = null;
		public activePage: Pup.Page | null = null;
		
		/** */
		stopDebugging()
		{
			if (this.activeBrowser)
			{
				this.activeBrowser.close();
				this.activeBrowser = null;
				this.activePage = null;
			}
		}
	}
}
