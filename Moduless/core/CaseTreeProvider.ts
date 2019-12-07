
namespace Moduless
{
	type VoidableFixture = CaseTreeItem | null | undefined;
	
	/** */
	export class CaseTreeProvider implements Vs.TreeDataProvider<CaseTreeItem>
	{
		/**
		 * An optional event to signal that an element or root has changed.
		 * This will trigger the view to update the changed element/root and
		 * its children recursively (if shown). To signal that root has changed,
		 * do not pass any argument or pass `undefined` or `null`.
		 */
		get onDidChangeTreeData()
		{
			return this.innerEvent.event;
		}
		private readonly innerEvent = new Vs.EventEmitter<VoidableFixture>();
		
		/** */
		constructor(
			workspaceRoot: string,
			bus: MessageBus)
		{
			Vs.window.createTreeView("modulessCases", {
				treeDataProvider: this
			});
			
			bus.listen(AddProjectMessage, msg =>
			{
				this.addProject(msg.project.name);
			});
			
			bus.listen(RemoveProjectMessage, msg =>
			{
				for (let i = this.ordering.length; i-- > 0;)
					if (this.ordering[i][0] === msg.project.name)
						return void this.ordering.splice(i, 1);
			});
			
			bus.listen(AddCaseMessage, msg =>
			{
				const caseItems =
					this.getProjectCaseNames(msg.project.name) ||
					this.addProject(msg.project.name);
				
				const treeItem = new CaseTreeItem(
					msg.project,
					msg.caseFunctionName);
				
				caseItems.splice(msg.caseIndex, 0, treeItem);
			});
			
			bus.listen(RemoveCaseMessage, msg =>
			{
				const caseItems = this.getProjectCaseNames(msg.project.name);
				if (!caseItems)
					return;
				
				caseItems.splice(msg.caseIndex, 1);
			});
		}
		
		/** */
		private addProject(projectName: string)
		{
			const casesArray: CaseTreeItem[] = [];
			this.ordering.push([projectName, casesArray]);
			return casesArray;
		}
		
		/** */
		private getProjectCaseNames(projectName: string)
		{
			const entry = this.ordering.find(v => v[0] === projectName);
			return entry ? entry[1] : null;
		}
		
		/**
		 * An array that stores the names of all the projects with
		 * case functions that are loaded by the extension.
		 * The purpose of this array is to maintain a particular
		 * ordering of the tree items, so that all the case functions
		 * pretaining to a particular project are displayed together.
		 * 
		 * The ordering of projects operates on a "first-loaded, first
		 * displayed" basis. The first time a case is added from a
		 * new project, that project name is added to this array.
		 */
		private readonly ordering: [string, CaseTreeItem[]][] = [];
		
		/** */
		refresh()
		{
			this.innerEvent.fire();
		}
		
		/**
		 * Get [TreeItem](#TreeItem) representation of the `element`
		 *
		 * @param element The element for which [TreeItem](#TreeItem)
		 * representation is asked for.
		 * 
		 * @return [TreeItem](#TreeItem) representation of the element
		 */
		getTreeItem(element: CaseTreeItem): Vs.TreeItem
		{
			return element;
		}
		
		/**
		 * Get the children of `element` or root if no element is passed.
		 *
		 * @param element The element from which the provider gets children.
		 * @return Children of `element` or root if no element is passed.
		 */
		async getChildren(element?: CaseTreeItem): Promise<CaseTreeItem[]>
		{
			if (element)
				return Promise.resolve([]);
			
			const caseItems = this.ordering.flatMap(v => v[1]);
			return Promise.resolve(caseItems);
		}
	}
	
	/**
	 * 
	 */
	export class CaseTreeItem extends Vs.TreeItem
	{
		constructor(
			readonly project: Project,
			readonly caseFunctionName: string)
		{
			super(
				getLabel(project, caseFunctionName),
				Vs.TreeItemCollapsibleState.None);
		}
		
		/** */
		get tooltip() { return "Click to run this case"; }
		
		/**
		 * A human readable string which is rendered less prominent.
		 * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) 
		 * and when `falsy`, it is not shown.
		 */
		get description(): string
		{
			return "";
		}
		
		/** */
		get command(): Vs.Command
		{
			return {
				command: Constants.tryCommand,
				title: "try",
				arguments: [this.caseFunctionName],
				tooltip: ""
			};
		}
	}
	
	/** */
	function getLabel(project: Project, caseFunctionName: string)
	{
		return project.name + ": " + caseFunctionName
			.slice(Constants.prefix.length)
			.split(/(?=[A-Z])/)
			.map((v, i) => i > 0 ? v.toLowerCase() : v)
			.join(" ");
	}
}
