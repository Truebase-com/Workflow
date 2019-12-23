
namespace Moduless
{
	const portChecker = require("portchecker");
	
	/** */
	export interface IPorts
	{
		httpPort: number;
		wsPort: number;
	}
	
	/**
	 * Finds available ports on which to start the HTTP and WebSocket servers.
	 */
	export async function findPorts(): Promise<IPorts>
	{
		const httpPort = await findPortInner(10001);
		const wsPort = await findPortInner(httpPort + 1);
		return { httpPort, wsPort };
	}
	
	/** */
	async function findPortInner(startAt: number): Promise<number>
	{
		return new Promise(resolve =>
		{
			portChecker.getFirstAvailable(startAt + Math.round(Math.random() * 1000), 65536, "localhost", (port: number) =>
			{
				resolve(port);
			});
		});
	}
}
