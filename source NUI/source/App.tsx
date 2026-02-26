// PREPARE FOR THE IMPORT SEA!!!

import { Show, createMemo, onMount, onCleanup } from 'solid-js';
import { Terminal } from './components/Terminal';
import HackerTerminalBg from './components/HackerTerminalBg';
import { CenterBadge } from './components/CenterBadge';
import { SessionContextBar } from './components/SessionContextBar';
import { DockLauncher } from './components/DockLauncher';
import {
  FlowProgressOverlay,
  FlowMinimizedIndicator,
} from './components/FlowMacros';
import { AuditViewer, AuditQuickButton } from './components/AuditViewer';
import { ImageViewer } from './components/modals/ImageViewer';
import { MediaPlayer } from './components/modals/MediaPlayer';
import { ModalHost } from './components/modals/ModalHost';
import { BrowserHelper } from './components/BrowserHelper';
import { VehicleQuickDock } from './components/VehicleQuickDock';
import { terminalState, terminalActions } from './stores/terminalStore';
import { viewerState, viewerActions } from './stores/viewerStore';
import { uiPrefsState, uiPrefsActions } from './stores/uiPreferencesStore';
import { appState, appActions } from './stores/appStore';
import { CONFIG } from './config';
import { MockController } from './mocks';
import { fetchNui } from './utils/fetchNui';

export function App() {
  const isVehicleOverlayMode = createMemo(() => {
    return CONFIG.FEATURES.VEHICLE_DOCK && terminalState.isInPoliceVehicle;
  });

  const appClasses = createMemo(() => {
    const classes = ['cad-app'];

    if (isVehicleOverlayMode()) {
      classes.push('vehicle-dock-shell');
    }

    classes.push(`nav-mode-${uiPrefsState.navigationMode}`);
    if (uiPrefsActions.isTerminalCompact()) {
      classes.push('terminal-compact');
    }
    return classes.join(' ');
  });

  const terminalClasses = createMemo(() => {
    const classes = [];
    if (uiPrefsActions.isTerminalCompact()) {
      classes.push('compact');
    }
    return classes.join(' ');
  });

  // Handle Escape key to close CAD or active modal << bring this from my old computermdt
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (
        terminalState.activeModal === 'VEHICLE_CAD' &&
        terminalState.isInPoliceVehicle
      ) {
        void fetchNui('cad:vehicle:setOpen', { open: false }).catch(() => {});
        terminalActions.closeVehicleCAD();
        return;
      }

      if (terminalState.isInPoliceVehicle) {
        return;
      }
      if (terminalState.activeModal) {
        terminalActions.setActiveModal(null);
        return;
      }

      appActions.hide();

      // this cause me a lot of "why the fuck the mouse is in my screen yet!"
      fetch('https://cad-system/closeUI', {
        method: 'POST',
        body: '{}',
      }).catch(() => {});
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <>
      <Show when={appState.isVisible}>
        <div class={appClasses()}>
          <Show when={!isVehicleOverlayMode()}>
            {/* This was taken from a friend, if him used IA i dont know, but it work*/}
            <HackerTerminalBg maxLines={250} intervalMs={500} seed={20260215} />
          </Show>

          <Show
            when={
              !CONFIG.DOCK_ONLY &&
              uiPrefsActions.shouldShowTerminal() &&
              !isVehicleOverlayMode()
            }
          >
            <div class={terminalClasses()}>
              <Terminal />
            </div>
          </Show>

          <Show when={!isVehicleOverlayMode()}>
            <CenterBadge />
          </Show>

          <Show
            when={
              isVehicleOverlayMode() &&
              terminalState.activeModal !== 'VEHICLE_CAD' &&
              terminalState.showVehicleQuickDock
            }
          >
            <VehicleQuickDock />
          </Show>

          <ModalHost />

          {viewerState.isOpen && viewerState.mediaType === 'image' && (
            <ImageViewer
              images={viewerState.images}
              title={viewerState.title}
              onClose={viewerActions.close}
            />
          )}

          {viewerState.isOpen &&
            (viewerState.mediaType === 'video' ||
              viewerState.mediaType === 'audio') && <MediaPlayer />}

          <Show when={!isVehicleOverlayMode()}>
            <SessionContextBar />

            <DockLauncher />

            <FlowProgressOverlay />
            <FlowMinimizedIndicator />

            <AuditViewer />

            <AuditQuickButton />
          </Show>
        </div>
      </Show>
      <MockController />
      <BrowserHelper />
    </>
  );
}
