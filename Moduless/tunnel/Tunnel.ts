
namespace Moduless
{
	/** */
	type MaybePromise<T> = T | Promise<T>;
	
	/** */
	type VerifierFn = () => MaybePromise<boolean>;
	
	/** */
	type CoverReturn = 
		MaybePromise<
			VerifierFn |
			VerifierFn[] |
			string |
			Error |
			undefined
		>;

	// This value is replaced before it's sent down from
	// the server. The naming of it is therefore intentional.
	const __wsPort__ = 10002;
	const ws = new WebSocket("ws://localhost:" + __wsPort__, "json");
	
	// Stores all cover functions loaded into the browser.
	const coverRepository: { [name: string]: Function; } = {};
	
	const verifierReg = /^\(\)\s*=>/;
	const stackReg = /^\s*at\s.+\s\(.+:\d+\)$/;
	
	/**
	 * This function is called from the code that is injected 
	 * in the HTML page generated by the moduless server.
	 */
	export function addCover(coverFn: Function)
	{
		const coverName = coverFn.name;
		coverRepository[coverName] = coverFn;
	}
	
	/** */
	function parseErrorStack(text?: string)
	{
		return (text || "")
		.split("\n")
		.filter(line => stackReg.test(line))
	}
	
	/** */
	function generateError(expression: string, error: Error)
	{
		return { 
			expression: expression, 
			pass: false,
			exceptionDescription: error.message,
			exceptionStack: parseErrorStack(error.stack)
		}
	}
	
	/** */
	async function processCoverReturn(value: CoverReturn)
	{
		const verifications: IVerificationResult[] = [];
		if (value instanceof Promise)
			value = await value;
			
		if (value === void 0)
		{
			verifications.push(generateError("return", new Error("Expression returns undefined!")));
		}
		else if (typeof value === "string")
		{
			verifications.push(generateError("return", new Error(value)));
		}
		else if (value instanceof Error)
		{
			verifications.push(generateError("throw", value));
		}
		else if (value instanceof Array)
		{
			const promises = value.map(async v => await processCoverReturn(v));
			const verificationResults = await Promise.all(promises);
			verifications.push(...verificationResults.flat());
		}		
		else if (value instanceof Function)
		{
			const newValue = await value();
			const newName = String(value)
				.trim()
				.replace(verifierReg, "")
				.trim();
			
			const error = new Error(`Verifier function returned an unexpected ${typeof newValue}(${newValue})`);
			verifications.push({
				expression: newName,
				pass: !!newValue,
				exceptionDescription: error.message,
				exceptionStack: parseErrorStack(error.stack)
			});
		}
		else 
		{
			const error = new Error(`Cover function returned an unexpected ${typeof value}(${value})`);
			verifications.push({
				expression: "return",
				pass: !!value,
				exceptionDescription: error.message,
				exceptionStack: parseErrorStack(error.stack)
			})
		}
		
		return verifications;
	}
	
	/**
	 * Executes the test with the specified function name.
	 */
	export async function runCover(coverFunctionName: string)
	{
		const coverFn = coverRepository[coverFunctionName];
		if (typeof coverFn !== "function")
			throw new Error("Unknown cover function: " + coverFunctionName);
		
		
		try
		{
			const coverReturnValue = await coverFn();
			const verifications = await processCoverReturn(coverReturnValue);
			return new EndCoverMessage(coverFunctionName, verifications);
		}
		catch (e)
		{
			return new EndCoverMessage(coverFunctionName, [
				generateError(e.name, e)
			]);
		}
	}
	
	let autoRunTestOnReload = setTimeout(async () => 
	{
		const lastCover = localStorage.getItem("lastCover");
		if (lastCover)
		{
			const endCoverMessage = await runCover(lastCover);
			ws.send(endCoverMessage.toString());
		}
	}, 750);
	
	/**
	 * 
	 */
	async function handleStartCoverMessage(coverFunctionName: string)
	{
		localStorage.setItem("lastCover", coverFunctionName);
		clearTimeout(autoRunTestOnReload);
		const endCoverMessage = await runCover(coverFunctionName);
		ws.send(endCoverMessage.toString());
	}
	
	/**
	 * 
	 */
	async function handleStartCompleteCoverageMessage()
	{
		clearTimeout(autoRunTestOnReload);
		for (const coverFunctionName in coverRepository)
		{	
			const endCoverMessage = await runCover(coverFunctionName);
			ws.send(endCoverMessage.toString());
		}
	}
	
	/**
	 * 
	 */
	async function handleExecuteVoidMessage(message: ExecuteVoidMessage)
	{
		const result = await (VoidStrings).send(
			JSON.stringify(message.context),
			(VoidStrings as any)[message.voidName](...message.parameters)
		);
	}
	
	ws.addEventListener("message", ev =>
	{
		const message = Message.parse(ev.data);
		
		if (message instanceof StartCoverMessage)
			handleStartCoverMessage(message.coverName);
			
		else if (message instanceof StartCompleteCoverageMessage)
			handleStartCompleteCoverageMessage();
		
		else if (message instanceof ReloadMessage)
			window.location.reload();
		
		else if (message instanceof ExecuteVoidMessage)
			handleExecuteVoidMessage(message);
			
		else
			throw new Error("Unsupported message: " + message.constructor.name);
	});
	
}
