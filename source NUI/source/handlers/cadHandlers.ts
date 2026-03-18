import { onNuiMessage } from '~/utils/nuiRouter';
import { appActions, appState } from '~/stores/appStore';
import { userActions, userState } from '~/stores/userStore';
import { sessionState } from '~/stores/sessionStore';
import { playBootReady, playBootStart, playBootStep } from '~/utils/sounds';
import type { CadOpenedData, CadClosedData } from '~/types/nuiMessages';

type LookupPerson = {
  citizenid: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  createdAt: string;
  lastUpdated: string;
  isDead: boolean;
  phone?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  height?: string;
  weight?: string;
  eyeColor?: string;
  hairColor?: string;
  photo?: string;
  photos?: string[];
  flags?: string[];
  ckDate?: string;
};

type LookupPersonsResponse = {
  ok?: boolean;
  persons?: LookupPerson[];
};

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
    const { restartRadioTimers } = await import('~/stores/radioStore');

    restartRadioTimers();
    terminalActions.setVehicleOverlayOwned(false);

    if (data.terminalId) {
      sessionActions.setTerminalContext({
        terminalId: data.terminalId,
        location: data.location,
        hasContainer: data.hasContainer,
        hasReader: data.hasReader,
      });
    }

    const isWarmBoot = data.bootMode === 'warm';
    const bootEnabled = appActions.isBootEnabled() && !isWarmBoot;

    if (isWarmBoot) {
      appActions.markBootCompleted();
    }
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
    const { sessionActions, disposeSessionEffects } = await import('~/stores/sessionStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    const { cleanupRadioTimers } = await import('~/stores/radioStore');
    const { cleanupEmsTimers } = await import('~/stores/emsStore');
    const { hackerEffects } = await import('~/stores/hackerStore');

    terminalActions.setVehicleOverlayOwned(false);
    homeActions.reset();
    sessionActions.clearTerminalContext();
    terminalActions.setActiveModal(null);

    cleanupRadioTimers();
    cleanupEmsTimers();
    hackerEffects.stopNoise();
    disposeSessionEffects();
  });

  onNuiMessage<{ citizenId?: string; name?: string }>('searchPerson', async (data) => {
    const { terminalActions } = await import('~/stores/terminalStore');
    const { cadActions } = await import('~/stores/cadStore');
    const { fetchNui } = await import('~/utils/fetchNui');

    const citizenId = typeof data?.citizenId === 'string' ? data.citizenId.trim() : '';
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    const query = citizenId || name;

    if (query === '') {
      terminalActions.addLine('ID search failed: missing query', 'error');
      try {
        await fetchNui('personSearchResult', { success: false, citizenId });
      } catch (callbackError) {
        console.error('[NUI] personSearchResult callback failed:', callbackError);
      }
      return;
    }

    let matchedCitizenId = citizenId;
    let found = false;

    try {
      const response = await fetchNui<LookupPersonsResponse>('cad:lookup:searchPersons', {
        query,
        limit: 5,
      });

      const persons = Array.isArray(response?.persons) ? response.persons : [];
      for (const person of persons) {
        cadActions.addPerson(person);
      }

      const normalizedQuery = query.toLowerCase();
      const match = persons.find((person) => {
        const fullName = `${person.firstName} ${person.lastName}`.toLowerCase();
        return person.citizenid.toLowerCase() === normalizedQuery || fullName.includes(normalizedQuery);
      });

      if (match) {
        matchedCitizenId = match.citizenid;
        found = true;
      } else if (citizenId !== '') {
        found = persons.some((person) => person.citizenid.toLowerCase() === citizenId.toLowerCase());
      }

      terminalActions.setActiveModal('PERSON_SEARCH', {
        citizenId: matchedCitizenId || undefined,
        query,
      });

      terminalActions.addLine(
        found
          ? `ID search loaded person ${matchedCitizenId}`
          : `ID search opened Person Search with query: ${query}`,
        found ? 'output' : 'system'
      );
    } catch (error) {
      terminalActions.addLine(`ID search failed: ${String(error)}`, 'error');
    }

    try {
      await fetchNui('personSearchResult', {
        success: found,
        citizenId: matchedCitizenId || citizenId,
      });
    } catch (callbackError) {
      console.error('[NUI] personSearchResult callback failed:', callbackError);
    }
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
