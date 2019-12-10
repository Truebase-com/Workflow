
namespace Moduless
{
	export class GlobalStateStatic
	{
		/** */
		init(globalStoragePath: string)
		{
			this.globalStoragePath = globalStoragePath;
		}
		private globalStoragePath: string = "";
		
		/** */
		async get(key: string): Promise<string | null>
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
		async set(key: string, value: { toString(): string })
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
