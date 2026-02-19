// PREPARE FOR THE IMPORT SEA!!!

import { Switch, Match, Show, createMemo, onMount, onCleanup } from 'solid-js';
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
import { DispatchTable } from './components/modals/DispatchTable';
import { CaseCreator } from './components/modals/CaseCreator';
import { CaseManager } from './components/modals/CaseManager';
import { MapModal } from './components/modals/MapModal';
import { EvidenceManager } from './components/modals/EvidenceManager';
import { NotesEditor } from './components/modals/NotesEditor';
import { NotesFileManager } from './components/modals/NotesFileManager';
import { EvidenceUploader } from './components/modals/EvidenceUploader';
import { EvidenceDocumentViewer } from './components/modals/EvidenceDocumentViewer';
import { PersonSearch } from './components/modals/PersonSearch';
import { VehicleSearch } from './components/modals/VehicleSearch';
import { FineManager } from './components/modals/FineManager';
import { PoliceDashboard } from './components/modals/PoliceDashboard';
import { EMSDashboard } from './components/modals/EMSDashboard';
import { NewsManager } from './components/modals/NewsManager';
import { RadioPanel } from './components/modals/RadioPanel';
import { LicenseManager } from './components/modals/LicenseManager';
import { PropertyManager } from './components/modals/PropertyManager';
import { FleetManager } from './components/modals/FleetManager';
import { ArrestForm } from './components/modals/ArrestForm';
import { ArrestWizard } from './components/modals/ArrestWizard';
import { PersonSnapshot } from './components/modals/PersonSnapshot';
import { RadioMarkers } from './components/modals/RadioMarkers';
import { BoloManager } from './components/modals/BoloManager';
import { ForensicCollection } from './components/modals/ForensicCollection';
import { PhotoCapturePreview } from './components/modals/PhotoCapturePreview';
import { ImageViewer } from './components/modals/ImageViewer';
import { MediaPlayer } from './components/modals/MediaPlayer';
import { VehicleCAD } from './components/modals/VehicleCAD';
import { CallsignPrompt } from './components/modals/CallsignPrompt';
import { BrowserHelper } from './components/BrowserHelper';
import { VehicleQuickDock } from './components/VehicleQuickDock';
import { terminalState, terminalActions } from './stores/terminalStore';
import { viewerState, viewerActions } from './stores/viewerStore';
import { uiPrefsState, uiPrefsActions } from './stores/uiPreferencesStore';
import { featureState } from './stores/featureStore';
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

  const photoPreviewData = createMemo(() => {
    if (terminalState.activeModal !== 'PHOTO_PREVIEW') {
      return null;
    }

    const payload = terminalState.modalData as {
      photoId?: string;
      photoUrl?: string;
      job?: 'police' | 'reporter';
      description?: string;
      location?: { x?: number; y?: number; z?: number };
      fov?: {
        hit?: boolean;
        hitCoords?: { x?: number; y?: number; z?: number };
        distance?: number;
        entityType?: string;
      };
    } | null;

    if (!payload?.photoId || !payload.photoUrl || !payload.job) {
      return null;
    }

    const location = payload.location || { x: 0, y: 0, z: 0 };
    return {
      photoId: payload.photoId,
      photoUrl: payload.photoUrl,
      job: payload.job,
      description: payload.description,
      location: {
        x: Number(location.x) || 0,
        y: Number(location.y) || 0,
        z: Number(location.z) || 0,
      },
      fov: {
        hit: payload.fov?.hit === true,
        hitCoords: payload.fov?.hitCoords
          ? {
              x: Number(payload.fov.hitCoords.x) || 0,
              y: Number(payload.fov.hitCoords.y) || 0,
              z: Number(payload.fov.hitCoords.z) || 0,
            }
          : undefined,
        distance: Number(payload.fov?.distance) || 0,
        entityType: payload.fov?.entityType,
      },
    };
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

          <Switch>
            <Match when={terminalState.activeModal === 'CALLSIGN_PROMPT'}>
              <CallsignPrompt mode='setup' />
            </Match>
            <Match when={terminalState.activeModal === 'CALLSIGN_CHANGE'}>
              <CallsignPrompt mode='change' />
            </Match>
            <Match
              when={
                terminalState.activeModal === 'DISPATCH_PANEL' &&
                featureState.dispatch.visible
              }
            >
              <DispatchTable />
            </Match>
            <Match when={terminalState.activeModal === 'CASE_CREATOR'}>
              <CaseCreator />
            </Match>
            <Match when={terminalState.activeModal === 'CASE_MANAGER'}>
              <CaseManager />
            </Match>
            <Match when={terminalState.activeModal === 'MAP'}>
              <MapModal />
            </Match>
            <Match when={terminalState.activeModal === 'EVIDENCE'}>
              <EvidenceManager />
            </Match>
            <Match when={terminalState.activeModal === 'NOTES'}>
              <NotesEditor />
            </Match>
            <Match when={terminalState.activeModal === 'NOTES_FILE'}>
              <NotesFileManager />
            </Match>
            <Match when={terminalState.activeModal === 'UPLOAD'}>
              <EvidenceUploader />
            </Match>
            <Match when={terminalState.activeModal === 'EVIDENCE_DOCUMENT'}>
              <EvidenceDocumentViewer />
            </Match>
            <Match when={terminalState.activeModal === 'PERSON_SEARCH'}>
              <PersonSearch />
            </Match>
            <Match when={terminalState.activeModal === 'VEHICLE_SEARCH'}>
              <VehicleSearch />
            </Match>
            <Match when={terminalState.activeModal === 'FINE_MANAGER'}>
              <FineManager />
            </Match>
            <Match when={terminalState.activeModal === 'POLICE_DASHBOARD'}>
              <PoliceDashboard />
            </Match>
            <Match when={terminalState.activeModal === 'EMS_DASHBOARD'}>
              <EMSDashboard />
            </Match>
            <Match
              when={
                terminalState.activeModal === 'NEWS_MANAGER' &&
                featureState.news.visible
              }
            >
              <NewsManager />
            </Match>
            <Match when={terminalState.activeModal === 'RADIO_PANEL'}>
              <RadioPanel />
            </Match>
            <Match when={terminalState.activeModal === 'LICENSE_MANAGER'}>
              <LicenseManager />
            </Match>
            <Match when={terminalState.activeModal === 'PROPERTY_MANAGER'}>
              <PropertyManager />
            </Match>
            <Match when={terminalState.activeModal === 'FLEET_MANAGER'}>
              <FleetManager />
            </Match>
            <Match when={terminalState.activeModal === 'ARREST_FORM'}>
              <ArrestForm />
            </Match>
            <Match when={terminalState.activeModal === 'ARREST_WIZARD'}>
              <ArrestWizard />
            </Match>
            <Match when={terminalState.activeModal === 'PERSON_SNAPSHOT'}>
              <PersonSnapshot />
            </Match>
            <Match when={terminalState.activeModal === 'RADIO_MARKERS'}>
              <RadioMarkers />
            </Match>
            <Match when={terminalState.activeModal === 'BOLO_MANAGER'}>
              <BoloManager />
            </Match>
            <Match when={terminalState.activeModal === 'VEHICLE_CAD'}>
              <VehicleCAD />
            </Match>
            <Match
              when={
                terminalState.activeModal === 'FORENSIC_COLLECTION' &&
                featureState.forensics.visible
              }
            >
              <ForensicCollection />
            </Match>
            <Match
              when={
                terminalState.activeModal === 'PHOTO_PREVIEW' &&
                photoPreviewData()
              }
            >
              <PhotoCapturePreview
                photoData={photoPreviewData()!}
                onClose={() => terminalActions.setActiveModal(null)}
              />
            </Match>
          </Switch>

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
