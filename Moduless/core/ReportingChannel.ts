
namespace Moduless
{
	/** */
	export class ReportingChannel
	{
		constructor(bus: MessageBus)
		{
			const channel = Vs.window.createOutputChannel("Moduless");
			
			bus.listen(StartCoverMessage, msg =>
			{
				channel.clear();
			});
			
			bus.listen(EndCoverMessage, msg =>
			{
				channel.show(true);
				
				const lines: string[] = [];
				
				if (msg.exceptionDescription)
				{
					lines.push(
						"ERROR: " + msg.coverName,
						"\t" + msg.exceptionDescription,
						...msg.exceptionStack.map(v => "\t\t" + v)
					);
				}
				else if (msg.verifications.every(v => v.pass))
				{
					lines.push("PASS: " + msg.coverName);
				}
				else
				{
					lines.push(
						"FAIL: " + msg.coverName,
						...msg.verifications.map(v => `\t${v.pass ? "√" : "✗:"} ${v.expression}`)
					);
				}
				
				channel.appendLine(lines.join("\n"));
			});
		}
	}
}
