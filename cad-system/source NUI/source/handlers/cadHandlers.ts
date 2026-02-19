import { onNuiMessage } from '~/utils/nuiRouter';
import { appActions } from '~/stores/appStore';
import { userActions, userState } from '~/stores/userStore';
import { sessionState } from '~/stores/sessionStore';
import type { CadOpenedData, CadClosedData } from '~/types/nuiMessages';

export function initCadHandlers(): void {
  onNuiMessage<CadOpenedData>('cad:opened', async (data) => {
    appActions.show();

    const { sessionActions } = await import('~/stores/sessionStore');
    const { terminalActions } = await import('~/stores/terminalStore');

    terminalActions.setVehicleOverlayOwned(false);

    if (data.terminalId) {
      sessionActions.setTerminalContext({
        terminalId: data.terminalId,
        location: data.location,
        hasContainer: data.hasContainer,
        hasReader: data.hasReader,
      });
    }

    await userActions.init();

    if (userState.needsCallsign) {
      terminalActions.setActiveModal('CALLSIGN_PROMPT');
      return;
    }

    await continueCadInit(data);
  });

  onNuiMessage<CadClosedData>('cad:closed', async () => {
    appActions.hide();

    const { homeActions } = await import('~/stores/homeStore');
    const { sessionActions } = await import('~/stores/sessionStore');
    const { terminalActions } = await import('~/stores/terminalStore');

    terminalActions.setVehicleOverlayOwned(false);
    homeActions.reset();
    sessionActions.clearTerminalContext();
    terminalActions.setActiveModal(null);
  });
}

export function openCad(): void {
  appActions.show();
}

export function closeCad(): void {
  appActions.hide();
}

export async function continueCadInit(data: CadOpenedData): Promise<void> {
  const { homeActions } = await import('~/stores/homeStore');
  const { sessionActions } = await import('~/stores/sessionStore');
  const { terminalActions } = await import('~/stores/terminalStore');

  terminalActions.setActiveModal(null);
  homeActions.init();

  if (data.terminalId && !sessionState.terminalId) {
    sessionActions.setTerminalContext({
      terminalId: data.terminalId,
      location: data.location,
      hasContainer: data.hasContainer,
      hasReader: data.hasReader,
    });
  }
}
