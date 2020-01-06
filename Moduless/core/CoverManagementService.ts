
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
			const guideBg = new Vs.ThemeColor("editorIndentGuide.background");
			const editorBg = new Vs.ThemeColor("editor.background");
			
			this.lineDecoration = Vs.window.createTextEditorDecorationType({
				backgroundColor: "rgba(0, 0, 0, 0.033)",
				isWholeLine: true,
				borderWidth: "0 0 0 1px",
				borderStyle: "solid",
				borderColor: guideBg
			});
			
			this.indentDecoration = Vs.window.createTextEditorDecorationType({
				backgroundColor: editorBg,
				isWholeLine: false,
				borderWidth: "0 0 0 1px",
				borderStyle: "solid",
				borderColor: guideBg
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
		private readonly lineDecoration: Vs.TextEditorDecorationType;
		
		/** */
		private readonly indentDecoration: Vs.TextEditorDecorationType;
		
		/** */
		private decorate(textDocument: Vs.TextDocument)
		{
			const visibleEditors = Vs.window.visibleTextEditors;
			const docPath = textDocument.uri.fsPath;
			const editor = visibleEditors.find(editor => editor.document.uri.fsPath === docPath);
			if (!editor)
				return;
			
			const sourceCode = editor.document.getText();
			const lineDecorations: Vs.DecorationOptions[] = [];
			const indentDecorations: Vs.DecorationOptions[] = [];
			const sourceCodeLines = sourceCode.split("\n");
			
			for (let lineNum = 0; lineNum < sourceCodeLines.length; lineNum++)
			{
				const lineText = sourceCodeLines[lineNum];
				const coverName = Util.getCoverNameFromLine(lineText);
				if (coverName === "")
					continue;
				
				const indentSize = lineText.length - lineText.trimLeft().length;
				
				lineDecorations.push({
					range: new Vs.Range(
						new Vs.Position(lineNum, indentSize),
						new Vs.Position(lineNum, lineText.length)
					),
					renderOptions: {
						after: {
							color: new Vs.ThemeColor("descriptionForeground"),
							fontStyle: "italic",
							contentText: " Cover Function"
						}
					}
				});
				
				indentDecorations.push({
					range: new Vs.Range(
						new Vs.Position(lineNum, 0),
						new Vs.Position(lineNum, indentSize),
					),
				});
			}
			
			if (lineDecorations.length < 1)
				return;
			
			editor.setDecorations(this.lineDecoration, lineDecorations);
			editor.setDecorations(this.indentDecoration, indentDecorations);
			this.filesWithCovers.push(textDocument.uri.fsPath);
		}
		
		private readonly filesWithCovers: string[] = [];
	}
}
