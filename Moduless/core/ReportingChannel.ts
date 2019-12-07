
namespace Moduless
{
	/** */
	export class ReportingChannel
	{
		constructor(bus: MessageBus)
		{
			const channel = Vs.window.createOutputChannel("Moduless");
			
			bus.listen(StartCaseMessage, msg =>
			{
				channel.clear();
			});
			
			bus.listen(EndCaseMessage, msg =>
			{
				channel.show(true);
				
				const lines: string[] = [];
				
				if (msg.exceptionDescription)
				{
					lines.push(
						"ERROR: " + msg.caseName,
						"\t" + msg.exceptionDescription,
						...msg.exceptionStack.map(v => "\t\t" + v)
					);
				}
				else if (msg.verifications.every(v => v.pass))
				{
					lines.push("PASS: " + msg.caseName);
				}
				else
				{
					lines.push(
						"FAIL: " + msg.caseName,
						...msg.verifications.map(v => `\t${v.pass ? "√" : "✗:"} ${v.expression}`)
					);
				}
				
				channel.appendLine(lines.join("\n"));
			});
		}
	}
}
