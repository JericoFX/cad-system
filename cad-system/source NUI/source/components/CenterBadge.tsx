import { Show, createMemo } from 'solid-js';
import { CONFIG } from '~/config';
import { homeState } from '~/stores/homeStore';
import { terminalState } from '~/stores/terminalStore';
import { uiPrefsActions } from '~/stores/uiPreferencesStore';
import { viewerState } from '~/stores/viewerStore';

const BADGE_ASCII = `+------------------------------+
|            C.A.D             |
|                              |
|          [ v1.0.0 ]          |
|         by JericoFX          |
+------------------------------+`;

export function CenterBadge() {
  const isVisible = createMemo(() => {
    if (terminalState.activeModal) return false;
    if (homeState.isVisible) return false;
    if (viewerState.isOpen) return false;

    if (CONFIG.DOCK_ONLY) return true;
    if (!uiPrefsActions.shouldShowTerminal()) return true;

    return uiPrefsActions.isTerminalCompact();
  });

  return (
    <Show when={isVisible()}>
      <div class="center-badge-overlay" aria-hidden="true">
        <pre class="center-badge-ascii">{BADGE_ASCII}</pre>
      </div>
    </Show>
  );
}
