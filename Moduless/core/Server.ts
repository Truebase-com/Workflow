
namespace Moduless
{
	/**
	 * 
	 */
	export class Server
	{
		constructor(
			private readonly projectGraph: ProjectGraph,
			private readonly bus: MessageBus)
		{
			this.httpServer = Http.createServer((req, res) =>
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
						"Content-Length": result.length
					});
					
					res.write(result);
				}
				else
				{
					res.writeHead(500);
				}
				
				res.end();
			});
			
			this.httpServer.listen(this.httpPort);
			console.log("Moduless HTTP server listening on port: " + this.httpPort);
			
			this.wsServer = new Ws.Server({ port: this.wsPort });
			this.wsServer.on("connection", ws =>
			{
				ws.on("message", socketData =>
				{
					const message = Message.parse(socketData.toString());
					bus.emit(message);
				});
			});
			
			bus.listen(StartCaseMessage, msg => this.broadcastViaSocket(msg));
			bus.listen(ReloadMessage, msg => this.broadcastViaSocket(msg));
			
			console.log("Moduless WebSocket server listening on port: " + this.wsPort);
		}
		
		/** */
		private readonly httpServer: Http.Server;
		
		/** */
		private readonly wsServer: Ws.Server;
		
		// NOTE: This isn't going to work with multiple instances of VS Code
		// We're going to need to do a port scan and find an available port.
		
		/** The port number on which to launch the moduless HTTP server. */
		private readonly httpPort = 10001;
		
		/** The port number on which to launch the moduless WebSocket server. */
		private readonly wsPort = 10002;
		
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
			
			// Return a JavaScript file, likely one produced by an "outFile" setting
			// specified by some tsconfig file somewhere. The JavaScript code may
			// need to be instrumented in order to facilitate the discovery of tests.
			if (path.ext === ".js")
			{
				debugger;
				return "";
				//const jsFileText = Fs.readFileSync(specifier).toString();
				//const jsFileTextProcessed = JsProcessor.process(jsFileText);
				//return jsFileTextProcessed;
			}
			// Other resource file (currently unused).
			else if (path.ext)
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
				.replace(/\s__port__\s=\s\d+;/, ` __wsPort__ = ${this.wsPort};`);
			
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
			{
				Vs.window.showErrorMessage("No connected clients.");
				return;
			}
			
			const messageText = message.serialize();
			for (const client of this.wsServer.clients)
				client.send(messageText);
		}
	}
}
