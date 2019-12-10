
namespace Moduless
{
	/** */
	export class CoverDecorationService
	{
		constructor()
		{
			this.decorationType = Vs.window.createTextEditorDecorationType({
				backgroundColor: "rgba(0, 0, 0, 0.033)",
				isWholeLine: true
			});
			
			Vs.window.onDidChangeVisibleTextEditors(e => e.map(v => this.decorate(v.document)));
			Vs.workspace.onDidChangeTextDocument(ev => this.decorate(ev.document));
			Vs.workspace.onDidOpenTextDocument(textDoc => this.decorate(textDoc));
			Vs.workspace.textDocuments.map(doc => this.decorate(doc));
		}
		
		/** */
		private readonly decorationType: Vs.TextEditorDecorationType;
		
		/** */
		private decorate(textDocument: Vs.TextDocument)
		{
			const visibleEditors = Vs.window.visibleTextEditors;
			const docPath = textDocument.uri.fsPath;
			const editor = visibleEditors.find(editor => editor.document.uri.fsPath === docPath);
			if (!editor)
				return;
			
			const sourceCode = editor.document.getText();
			const decorationsArray: Vs.DecorationOptions[] = [];
			const sourceCodeArr = sourceCode.split("\n");
			
			for (let lineNum = 0; lineNum < sourceCodeArr.length; lineNum++)
			{
				const regex = new RegExp(`((async )?function ${Constants.prefix}[A-Z][A-Za-z]+\(\))`);
				
				const lineText = sourceCodeArr[lineNum];
				let match = lineText.match(regex);
				
				if (match !== null && match.index !== undefined)
				{
					const range = new Vs.Range(
						new Vs.Position(lineNum, match.index),
						new Vs.Position(lineNum, match.index + match[1].length + 10000)
					);
					
					const decoration: Vs.DecorationOptions = {
						range,
						renderOptions: {
							after: {
								contentText: "	Cover function",
								color: "rgba(0, 0, 0, 0.18)",
								fontStyle: "italic"
							}
						}
					};
					
					decorationsArray.push(decoration);
				}
			}
			
			editor.setDecorations(this.decorationType, decorationsArray);
		}
	}
}
