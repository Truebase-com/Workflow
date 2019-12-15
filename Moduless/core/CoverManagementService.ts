
namespace Moduless
{
	/**
	 * A class that deals with detecting cover functions in the active text editor,
	 * possibly adding the necessary decorators around it, and detecting
	 * when the caret moves over one so that it can be set as the active.
	 */
	export class CoverManagementService
	{
		constructor(bus: MessageBus)
		{
			this.decorationType = Vs.window.createTextEditorDecorationType({
				backgroundColor: "rgba(0, 0, 0, 0.033)",
				isWholeLine: true
			});
			
			Vs.window.onDidChangeVisibleTextEditors(e => e.map(v => this.decorate(v.document)));
			Vs.workspace.onDidChangeTextDocument(ev => this.decorate(ev.document));
			Vs.workspace.onDidOpenTextDocument(textDoc => this.decorate(textDoc));
			Vs.workspace.textDocuments.map(doc => this.decorate(doc));
			
			Vs.window.onDidChangeTextEditorSelection(ev =>
			{
				if (ev.selections.length === 0)
					return;
				
				const textEditor = Vs.window.activeTextEditor;
				if (!textEditor)
					return;
				
				const editingFilePath = textEditor.document.uri.fsPath;
				if (!this.filesWithCovers.includes(editingFilePath))
					return;
				
				const caretPos = ev.selections[0].active;
				
				for (let nowLineIdx = caretPos.line; nowLineIdx >= 0; nowLineIdx--)
				{
					const nowLine = textEditor.document.lineAt(nowLineIdx).text;
					const coverName = Util.getCoverNameFromLine(nowLine);
					if (coverName === "")
						continue;
					
					Util.log("Selected cover: " + Util.getCoverFriendlyName(coverName));
					bus.emit(new SelectCoverMessage(editingFilePath, coverName));
					break;
				}
			});
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
			const sourceCodeLines = sourceCode.split("\n");
			
			for (let lineNum = 0; lineNum < sourceCodeLines.length; lineNum++)
			{
				const lineText = sourceCodeLines[lineNum];
				const coverName = Util.getCoverNameFromLine(lineText);
				if (coverName === "")
					continue;
				
				const range = new Vs.Range(
					new Vs.Position(lineNum, 0),
					new Vs.Position(lineNum, 0)
				);
				
				const decoration: Vs.DecorationOptions = {
					range,
					renderOptions: {
						after: {
							contentText: "	Cover function",
							color: new Vs.ThemeColor("descriptionForeground"),
							fontStyle: "italic"
						}
					}
				};
				
				decorationsArray.push(decoration);
			}
			
			if (decorationsArray.length < 1)
				return;
			
			editor.setDecorations(this.decorationType, decorationsArray);
			this.filesWithCovers.push(textDocument.uri.fsPath);
		}
		
		private readonly filesWithCovers: string[] = [];
	}
}
