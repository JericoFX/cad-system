import { onNuiMessage } from '~/utils/nuiRouter';
import type { DispatchPublicStateData } from '~/types/nuiMessages';

const seenCallIds = new Set<string>();
let dispatchHydrated = false;

export function initDispatchHandlers(): void {
  onNuiMessage<DispatchPublicStateData>('dispatch:publicState', async (data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    const calls = data.calls && typeof data.calls === 'object' ? data.calls : {};
    const units = data.units && typeof data.units === 'object' ? data.units : {};

    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    const nextCallIds = new Set(Object.keys(calls));
    if (dispatchHydrated) {
      nextCallIds.forEach((callId) => {
        if (!seenCallIds.has(callId)) {
          const call = calls[callId];
          notificationActions.notifyNewCall(callId, call?.title || 'Dispatch incident');
        }
      });
    }

    seenCallIds.clear();
    nextCallIds.forEach((callId) => seenCallIds.add(callId));
    dispatchHydrated = true;

    cadActions.setDispatchCalls(calls);
    cadActions.setDispatchUnits(units);
  });
}
