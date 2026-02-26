import { onNuiMessage } from '~/utils/nuiRouter';
import { appActions, appState } from '~/stores/appStore';
import { userActions, userState } from '~/stores/userStore';
import { sessionState } from '~/stores/sessionStore';
import { playBootReady, playBootStart, playBootStep } from '~/utils/sounds';
import type { CadOpenedData, CadClosedData } from '~/types/nuiMessages';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function waitForBootFrame(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (appState.skipBootRequested) {
      return;
    }

    await wait(Math.min(60, end - Date.now()));
  }
}

async function runBootStep(
  label: string,
  line: string,
  progress: number,
  targetMs: number,
  action?: () => Promise<void>
): Promise<void> {
  appActions.setBootStep(label, progress);
  appActions.pushBootLine(line);

  if (appActions.shouldPlayBootSounds()) {
    playBootStep();
  }

  const startedAt = Date.now();
  if (action) {
    await action();
  }

  const elapsed = Date.now() - startedAt;
  await waitForBootFrame(Math.max(0, targetMs - elapsed));
}

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

    const bootEnabled = appActions.isBootEnabled() && !appActions.hasBooted();
    if (bootEnabled) {
      appActions.startBoot();
      if (appActions.shouldPlayBootSounds()) {
        playBootStart();
      }
      await runBootStep(
        'Initializing motherboard bridge',
        '[POST] Southbridge link ......... OK',
        14,
        520
      );
      await runBootStep(
        'Enumerating secure devices',
        '[POST] TPM security module ....... OK',
        26,
        540
      );
    }

    if (bootEnabled) {
      await runBootStep(
        'Validating operator profile',
        '[AUTH] Officer profile checksum ... RUN',
        44,
        780,
        async () => {
        await userActions.init();
        }
      );
    } else {
      await userActions.init();
    }

    appActions.setBootOfficer({
      name: userState.currentUser?.name || 'Unknown Officer',
      rank: userState.currentUser?.rank,
      department: userState.currentUser?.department,
      callsign: userState.callsign,
    });

    if (bootEnabled) {
      await runBootStep(
        'Syncing dispatch context',
        '[NET ] Dispatch uplink ........... LOCKED',
        62,
        620
      );
    }

    if (userState.needsCallsign) {
      if (bootEnabled) {
        await runBootStep(
          'Callsign required to continue',
          '[WARN] Callsign assignment missing',
          78,
          700
        );
        appActions.completeBoot();
      }
      terminalActions.setActiveModal('CALLSIGN_PROMPT');
      return;
    }

    if (bootEnabled) {
      await runBootStep(
        'Loading operational modules',
        '[LOAD] MDT, dispatch, evidence ..... READY',
        84,
        740
      );
    }

    await continueCadInit(data);

    if (bootEnabled) {
      const startedAt = appState.bootStartedAt;
      const elapsed = startedAt ? Date.now() - startedAt : 0;
      const minDuration = appState.bootConfig.minDurationMs;
      await waitForBootFrame(Math.max(0, minDuration - elapsed));
      appActions.pushBootLine('[BOOT] Final integrity check ....... PASS');
      appActions.setBootStep('System ready', 100);
      if (appActions.shouldPlayBootSounds()) {
        playBootReady();
      }
      await waitForBootFrame(120);
      appActions.completeBoot();
    }
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
