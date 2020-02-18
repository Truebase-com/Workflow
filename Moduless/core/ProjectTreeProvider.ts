
namespace Moduless
{	
	type VoidableFixture = ProjectTreeItem | null | undefined;
	/** */
	export class ProjectTreeProvider implements Vs.TreeDataProvider<ProjectTreeItem>
	{
		get onDidChangeTreeData()
		{
			return this.innerEvent.event;
		}
		
		private readonly innerEvent = new Vs.EventEmitter<VoidableFixture>();
		private items: ProjectTreeItem[] = [];
		
		constructor(
			private readonly projectGraph: ProjectGraph,
			readonly bus: MessageBus)
		{
			bus.listen(AddProjectMessage, msg =>
			{
				const treeItem = new ProjectTreeItem(msg.project);
				this.items.push(treeItem);
				this.innerEvent.fire();
			});
		}
		
		getTreeItem(element: ProjectTreeItem)
		{
			return element;
		}
		
		async getChildren(element?: ProjectTreeItem)
		{
			if (element instanceof ProjectTreeItem)
				return Promise.resolve([]);
			
			const projects = Array.from(this.projectGraph);
			const items = projects
				.filter(v => v.name)
				.map(v => new ProjectTreeItem(v));
			
			return Promise.resolve(items);
		}
	}
	
	/**
	 * 
	 */
	export class ProjectTreeItem extends Vs.TreeItem
	{
		constructor(readonly project: Project)
		{
			super(project.name || "???", Vs.TreeItemCollapsibleState.None);
			this.id = project.outFile;
		}
		
		get command(): Vs.Command
		{
			return {
				command: Commands.startAll,
				arguments: [this.project.outFile],
				title: "Start all coverage functions in this project.",
				tooltip: ""
			};
		}
	}
}