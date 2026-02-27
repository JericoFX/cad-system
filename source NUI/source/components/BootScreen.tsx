import { For, Show, createMemo, onCleanup, onMount } from 'solid-js';
import { appActions, appState } from '~/stores/appStore';

export function BootScreen() {
  const officerName = createMemo(() => appState.bootOfficer?.name || 'Unknown Operator');
  const officerRank = createMemo(() => appState.bootOfficer?.rank || 'Officer');
  const officerDepartment = createMemo(
    () => appState.bootOfficer?.department || 'Los Santos Department'
  );
  const progressLabel = createMemo(() => {
    const latestLine = appState.bootLines[appState.bootLines.length - 1] || '';
    const bracketLabelMatch = latestLine.match(/^\[([^\]]+)\]/);

    if (bracketLabelMatch) {
      return bracketLabelMatch[1].trim().toUpperCase();
    }

    const stepHead = appState.bootStep.trim().split(/\s+/)[0] || 'BOOT';
    return stepHead.toUpperCase();
  });

  const progressLine = createMemo(() => {
    const totalBlocks = 20;
    const percent = Math.min(100, Math.max(0, Math.round(appState.bootProgress)));
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(totalBlocks - filledBlocks);

    return `[${progressLabel()}] ${bar} ${percent}%`;
  });

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
      <div class='cad-boot-shell bios-shell'>
        <div class='cad-boot-header'>
          <span class='cad-boot-pill'>JERICOFX CAD BIOS</span>
          <span class='cad-boot-version'>Phoenix-Compatible v1.0</span>
        </div>

        <div class='cad-boot-meta'>
          <span>{officerDepartment()}</span>
          <span>{officerRank()}</span>
          <span>{officerName()}</span>
          <span>{appState.bootOfficer?.callsign || 'UNASSIGNED'}</span>
        </div>

        <div class='cad-boot-terminal'>
          <For each={appState.bootLines}>
            {(line) => <div class='cad-boot-line'>{line}</div>}
          </For>
          <div class='cad-boot-line cad-boot-line-active'>
            {`> ${appState.bootStep}`}
            <span class='cad-boot-cursor'>_</span>
          </div>
        </div>

        <div class='cad-boot-progress'>
          <div class='cad-boot-line cad-boot-line-active'>{progressLine()}</div>
        </div>

        <Show when={appState.bootConfig.skippable}>
          <button type='button' class='cad-boot-skip' onClick={appActions.requestBootSkip}>
            Skip boot (Enter)
          </button>
        </Show>
      </div>
    </div>
  );
}
