
namespace Moduless
{
	export class GlobalStateStatic
	{
		/** */
		async init(globalStoragePath: string, bus: MessageBus)
		{
			this.globalStoragePath = globalStoragePath;
			
			const coverText = await this.retrieve("selectedCover") || "";
			this._selectedCover = coverText ?
				Message.parse<SelectCoverMessage>(coverText) :
				new SelectCoverMessage("", "");
			
			const metricsText = await this.retrieve("browserWindowMetrics");
			this._browserWindowMetrics = metricsText ?
				Message.parse<WindowMetricsMessage>(metricsText) :
				new WindowMetricsMessage(0, 0, 1024, 768);
			
			this.isBrowserShown = await this.retrieve(States.isBrowserShown) === "true";
			this.isDevtoolsShown = await this.retrieve(States.isDevtoolsShown) === "true";
			
			bus.listen(WindowMetricsMessage, async msg =>
			{
				this.setBrowserWindowMetrics(msg);
			});
			
			bus.listen(SelectCoverMessage, async msg =>
			{
				this.setSelectedCover(msg);
			});
		}
		private globalStoragePath: string = "";
		
		/**
		 * Gets or sets the name of the function to run when
		 * the start command is executed.
		 */
		get selectedCover()
		{
			if (!this._selectedCover)
				this._selectedCover = new SelectCoverMessage("", "");
			
			return this._selectedCover;
		}
		private _selectedCover: SelectCoverMessage | null = null;
		
		/** */
		private setSelectedCover(value: SelectCoverMessage)
		{
			this._selectedCover = value;
			this.store("selectedCover", value);
		}
		
		/**
		 * Gets or sets a WindowMetricsMessage that stores information
		 * about the pixel dimensions of the browser window to launch
		 * when starting a debugging session.
		 */
		get browserWindowMetrics()
		{
			if (!this._browserWindowMetrics)
				this._browserWindowMetrics = new WindowMetricsMessage(0, 0, 1024, 768);
			
			return this._browserWindowMetrics;
		}
		private _browserWindowMetrics: WindowMetricsMessage | null = null;
		
		/** */
		private setBrowserWindowMetrics(value: WindowMetricsMessage)
		{
			this._browserWindowMetrics = value;
			this.store("browserWindowMetrics", value);
		}
		
		/**
		 * Gets or sets whether a browser should
		 * display when a debugging session starts.
		 */
		get isBrowserShown()
		{
			return !!this._isBrowserShown;
		}
		set isBrowserShown(value: boolean)
		{
			this._isBrowserShown = value;
			Extension.setContext(Contexts.browserVisible, value);
			this.store(States.isBrowserShown, value);
		}
		private _isBrowserShown = false;
		
		/**
		 * Gets or sets whether the devtools panel should display
		 * in the browser when a debugging session starts.
		 */
		get isDevtoolsShown()
		{
			return !!this._isDevtoolsShown;
		}
		set isDevtoolsShown(value: boolean)
		{
			this._isDevtoolsShown = value;
			Extension.setContext(Contexts.devtoolsVisible, value);
			this.store(States.isDevtoolsShown, value);
		}
		private _isDevtoolsShown = false;
		
		/** */
		private async retrieve(key: string): Promise<string | null>
		{
			return new Promise(async resolve =>
			{
				const path = await this.getPathOfKey(key);
				
				Fs.exists(path, exists =>
				{
					if (!exists)
						return resolve(null);
					
					Fs.readFile(path, "utf8", (error, data) =>
					{
						if (error)
							return resolve(null);
						
						resolve(data.toString());
					});
				});
			});
		}
		
		/** */
		private async store(key: string, value: { toString(): string })
		{
			const path = await this.getPathOfKey(key);
			await Fs.promises.writeFile(path, value.toString());
		}
		
		/** */
		private async getPathOfKey(key: string): Promise<string>
		{
			return new Promise(resolve =>
			{
				Fs.exists(this.globalStoragePath, async exists =>
				{
					if (!exists)
						await Fs.promises.mkdir(this.globalStoragePath);
					
					resolve(Path.join(this.globalStoragePath, key));
				});
			});
		}
	}
	export const GlobalState = new GlobalStateStatic();
}
