
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
					Vs.window.showInformationMessage("Cover passed: " + friendlyName);
					return;
				}
				
				channel.appendLine("FAIL: " + msg.coverName);
				
				msg.verifications
				.map(this.verificaitonMessage)
				.forEach(v => channel.appendLine(v));
				
				channel.show(true);
			});
		}
		
		verificaitonMessage(v: IVerificationResult)
		{	
			let expression = `\t${v.pass ? "√" : "✗"}:`;
			
			if (!v.pass)
			{
				if (v.expression === "return")
					expression += ` ${v.exceptionDescription}`;
				else if (v.expression === "throw")
					expression += ` ${v.expression} (${v.exceptionDescription}) \n${v.exceptionStack.join("\n\t\t")}`;
				else 
					expression += `${v.expression} (${v.exceptionDescription})`;
			}
			else
			{
				expression += ` ${v.expression}`;
			}
			
			return expression;
		}
	}	
}
