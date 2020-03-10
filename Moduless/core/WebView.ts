
namespace Moduless
{
	/**
	 * 
	 */
	export class WebView
	{
		/** */
		static view?: WebView;
		
		/**
		 * 
		 */
		static show(project: Project, baseUrl: string)
		{
			const column = 
				Vs.window.activeTextEditor?.viewColumn 
				|| Vs.ViewColumn.One;
			
			if (WebView.view)
			{
				WebView.view.panel.reveal(column);
				return;
			}
			
			const panel = Vs.window.createWebviewPanel(
				"modulessPreview",
				'Moduless Preview',
				column,
				{
					enableScripts: true
				}
			);
			
			WebView.view = new WebView(panel, project, baseUrl);
		}
		
		private readonly disposables: Vs.Disposable[] = [];
		private readonly standardFiles = {
			common: "moduless.common.js",
			tunnel: "moduless.tunnel.js"
		};
		
		/** */
		constructor(
			readonly panel: Vs.WebviewPanel, 
			private readonly project: Project, 
			private readonly baseUrl: string)
		{
			this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
			this.panel.webview.html = this.getHtml(project);
		}
		
		/** */
		public dispose() 
		{
			WebView.view = undefined;
			this.panel.dispose();
			
			for (
				let disposable = this.disposables.pop(); 
				disposable = this.disposables.pop();)
					disposable.dispose();
		}
		
		/** */
		private getHtml(project: Project)
		{
			const scripts = project.eachScript().map(v => v.uri);
			scripts.unshift(...Object.values(this.standardFiles).map(v => "/??" + v));
			
			const scriptLines = scripts.map(v => `<script src="${v}"></script>`).join("\n");
			
			return `
				<!DOCTYPE html>
				<html>
					<head>
						<base href="${this.baseUrl}">
						<title>${project.name}</title>
					</head>
					<body>
						${scriptLines}
					</body>
				</html>
				`;
		}
	}
}
