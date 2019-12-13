
namespace Moduless
{
	/** */
	export class ReportingChannel
	{
		constructor(bus: MessageBus)
		{
			const channel = Vs.window.createOutputChannel("Moduless");
			
			bus.listen(StartCoverMessage, () =>
			{
				channel.clear();
			});
			
			bus.listen(EndCoverMessage, msg =>
			{
				if (msg.verifications.every(v => v.pass))
				{
					const friendlyName = Util.getCoverFriendlyName(msg.coverName);
					Vs.window.showInformationMessage(friendlyName + " (PASS)");
					return;
				}
				
				const lines: string[] = [];
				
				if (msg.exceptionDescription)
				{
					lines.push(
						"ERROR: " + msg.coverName,
						"\t" + msg.exceptionDescription,
						...msg.exceptionStack.map(v => "\t\t" + v)
					);
				}
				else
				{
					lines.push(
						"FAIL: " + msg.coverName,
						...msg.verifications
							.map(v => `\t${v.pass ? "√" : "✗:"} ${v.expression}`)
					);
				}
				
				if (lines.length)
				{
					channel.show(true);
					channel.appendLine(lines.join("\n"));
				}
			});
		}
	}
}
