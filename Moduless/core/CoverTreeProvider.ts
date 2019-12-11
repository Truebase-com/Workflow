
namespace Moduless
{
	export type TreeItem = ProjectTreeItem | CoverTreeItem;
	
	type VoidableFixture = CoverTreeItem | null | undefined;
	
	/** */
	export class CoverTreeProvider implements Vs.TreeDataProvider<TreeItem>
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
			private readonly projectGraph: ProjectGraph,
			private readonly bus: MessageBus)
		{
			bus.listen(AddProjectMessage, msg =>
			{
				this.addProject(msg.project);
			});
			
			bus.listen(RemoveProjectMessage, msg =>
			{
				for (let i = this.ordering.length; i-- > 0;)
					if (this.ordering[i][0] === msg.project)
						return void this.ordering.splice(i, 1);
			});
			
			bus.listen(AddCoverMessage, msg =>
			{
				const coverTreeItems = this.getProjectCoverNames(msg.project);
				
				if (!coverTreeItems.length)
					coverTreeItems.push(...this.addProject(msg.project));
				
				const treeItem = new CoverTreeItem(
					workspaceRoot,
					msg.project,
					msg.coverFunctionName);
				
				coverTreeItems.splice(msg.coverIndex, 0, treeItem);
				this.refresh();
			});
			
			bus.listen(RemoveCoverMessage, msg =>
			{
				const coverItems = this.getProjectCoverNames(msg.project);
				if (coverItems.length === 0)
					return;
				
				coverItems.splice(msg.coverIndex, 1);
				this.refresh();
			});
			
			bus.listen(SelectCoverMessage, () =>
			{
				this.refresh();
			});
		}
		
		/** */
		private addProject(project: Project)
		{
			const coversArray: CoverTreeItem[] = [];
			this.ordering.push([project, coversArray]);
			return coversArray;
		}
		
		/** */
		private getProjectCoverNames(project: Project)
		{
			const entry = this.ordering.find(v => v[0] === project);
			return entry ? entry[1] : [];
		}
		
		/**
		 * An array that stores the names of all the projects with
		 * cover functions that are loaded by the extension.
		 * The purpose of this array is to maintain a particular
		 * ordering of the tree items, so that all the cover functions
		 * pretaining to a particular project are displayed together.
		 * 
		 * The ordering of projects operates on a "first-loaded, first
		 * displayed" basis. The first time a cover function is added
		 * from a new project, that project name is added to this array.
		 */
		private readonly ordering: [Project, CoverTreeItem[]][] = [];
		
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
		getTreeItem(element: TreeItem): Vs.TreeItem
		{
			return element;
		}
		
		/**
		 * Get the children of `element` or root if no element is passed.
		 *
		 * @param element The element from which the provider gets children.
		 * @return Children of `element` or root if no element is passed.
		 */
		async getChildren(element?: TreeItem): Promise<TreeItem[]>
		{
			if (element instanceof ProjectTreeItem)
			{
				for (const [project, treeItems] of this.ordering)
					if (project === element.project)
						return Promise.resolve(treeItems);
				
				return Promise.resolve([]);
			}
			
			const projects = Array.from(this.projectGraph);
			const items = projects
				.filter(v => v.name)
				.filter(v => this.getProjectCoverNames(v).length > 0)
				.map(v => new ProjectTreeItem(v));
			
			return Promise.resolve(items);
		}
		
		/**
		 * 
		 */
		dispose()
		{
			
		}
	}
	
	/**
	 * 
	 */
	export class ProjectTreeItem extends Vs.TreeItem
	{
		constructor(readonly project: Project)
		{
			// There should always be a project.name
			// The || is for disaster handling.
			super(project.name || "???");
			this.id = project.outFile;
			this.collapsibleState = Vs.TreeItemCollapsibleState.Expanded;
		}
		
		/** */
		readonly id: string;
		
		/** */
		readonly collapsibleState: any; // Deal with the any...
	}
	
	/**
	 * 
	 */
	export class CoverTreeItem extends Vs.TreeItem
	{
		/**
		 * Returns the text to display in the user interface in the tree
		 */
		private static getLabel(coverFunctionName: string)
		{
			return coverFunctionName
				.slice(Constants.prefix.length)
				.split(/(?=[A-Z])/)
				.map((v, i) => i > 0 ? v.toLowerCase() : v)
				.join(" ");
		}
		 
		/** */
		constructor(
			private readonly workspaceRoot: string,
			readonly project: Project,
			readonly coverFunctionName: string)
		{
			super(
				CoverTreeItem.getLabel(coverFunctionName),
				Vs.TreeItemCollapsibleState.None);
			
			this.id = project.outFile + ":" + coverFunctionName;
		}
		
		/** */
		readonly id: string;
		
		/** */
		get iconPath()
		{
			const cov = GlobalState.selectedCover;
			
			if (cov.coverFunctionName !== this.coverFunctionName)
				return "";
			
			if (!cov.containingFile.startsWith(this.project.folder))
				return "";
			
			return {
				light: Path.join(this.workspaceRoot, "icons/start-light.png"),
				dark: Path.join(this.workspaceRoot, "icons/start-dark.png")
			};
		}
		
		/** */
		get tooltip() { return "Click to run this cover."; }
		
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
				command: Commands.start,
				title: "try",
				arguments: [this.project.folder, this.coverFunctionName],
				tooltip: ""
			};
		}
	}
}
