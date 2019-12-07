
namespace Moduless
{
	/** */
	export class MessageBus
	{
		/** */
		emit(message: Message)
		{
			for (const [listenerCtor, listenerFn] of this.listeners)
				if (listenerCtor === message.constructor)
					listenerFn(message);
		}
		
		/** */
		listen<M extends Message>(
			messageCtor: TMessageCtor<M>,
			callbackFn: (message: M) => void)
		{
			this.listeners.push([messageCtor, <(m: Message) => void>callbackFn]);
		}
		
		/** */
		private readonly listeners: [TMessageCtor, (m: Message) => void][] = [];
	}
}
