import { Show, createMemo, onCleanup, onMount } from 'solid-js';
import { appActions, appState } from '~/stores/appStore';

export function BootScreen() {
  const officerName = createMemo(() => appState.bootOfficer?.name || 'Unknown Operator');
  const officerRank = createMemo(() => appState.bootOfficer?.rank || 'Officer');
  const officerDepartment = createMemo(
    () => appState.bootOfficer?.department || 'Los Santos Department'
  );

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      appActions.requestBootSkip();
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div class='cad-boot-screen'>
      <div class='cad-boot-shell'>
        <div class='cad-boot-header'>
          <span class='cad-boot-pill'>JERICOFX CAD</span>
          <span class='cad-boot-version'>v1.0</span>
        </div>

        <pre class='cad-boot-ascii'>
{` __  ___  ____  ___  ______    _______  __   ___
/  |/  / / __ \/ _ \/_  __/   / ____/ |/ /  /   |
/ /|_/ / / / / / / / / /_____/ __/  |   /  / /| |
/ /  / / /_/ / /_/ / / /_____/ /___ /   |  / ___ |
/_/  /_/\____/\____/ /_/     /_____//_/|_| /_/  |_|`}
        </pre>

        <div class='cad-boot-operator'>
          <div>
            <span>Operator</span>
            <strong>{officerName()}</strong>
          </div>
          <div>
            <span>Rank</span>
            <strong>{officerRank()}</strong>
          </div>
          <div>
            <span>Department</span>
            <strong>{officerDepartment()}</strong>
          </div>
          <div>
            <span>Callsign</span>
            <strong>{appState.bootOfficer?.callsign || 'UNASSIGNED'}</strong>
          </div>
        </div>

        <div class='cad-boot-step'>{appState.bootStep}</div>

        <div class='cad-boot-progress'>
          <div class='cad-boot-progress-track'>
            <div
              class='cad-boot-progress-fill'
              style={{ width: `${Math.round(appState.bootProgress)}%` }}
            />
          </div>
          <span>{Math.round(appState.bootProgress)}%</span>
        </div>

        <Show when={appState.bootConfig.skippable}>
          <button type='button' class='cad-boot-skip' onClick={appActions.requestBootSkip}>
            Skip boot
          </button>
        </Show>
      </div>
    </div>
  );
}
