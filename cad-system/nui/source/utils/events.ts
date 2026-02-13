import { JSX } from 'solid-js';

export function callEventHandler<ElementType extends HTMLElement, EventType extends Event>(
  handler: JSX.EventHandlerUnion<ElementType, EventType> | undefined,
  event: EventType
): void {
  if (!handler) {
    return;
  }

  if (typeof handler === 'function') {
    (handler as (event: EventType) => void)(event);
    return;
  }

  const handlerObject = handler as { handleEvent?: (event: EventType) => void };
  handlerObject.handleEvent?.(event);
}
