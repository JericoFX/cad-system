import { Switch, Match, Show, createMemo } from 'solid-js';
import { Terminal } from './components/Terminal';
import { BackgroundTerminal } from './components/BackgroundTerminal';
import { CenterBadge } from './components/CenterBadge';
import { SessionContextBar } from './components/SessionContextBar';
import { DockLauncher } from './components/DockLauncher';
import {
  FlowProgressOverlay,
  FlowMinimizedIndicator,
} from './components/FlowMacros';
import { AuditViewer, AuditQuickButton } from './components/AuditViewer';
import { HomeScreen } from './components/HomeScreen';
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
import { ImageViewer } from './components/modals/ImageViewer';
import { CallsignPrompt } from './components/modals/CallsignPrompt';
import { terminalState } from './stores/terminalStore';
import { viewerState, viewerActions } from './stores/viewerStore';
import { uiPrefsState, uiPrefsActions } from './stores/uiPreferencesStore';
import { featureState } from './stores/featureStore';
import { appState } from './stores/appStore';
import { CONFIG } from './config';
import { MockController } from './mocks';

export function App() {
  const appClasses = createMemo(() => {
    const classes = ['cad-app'];
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

  return (
    <div class={appClasses()}>
      {/* Main CAD Application - Only visible when appState.isVisible is true */}
      <Show when={appState.isVisible}>
        {/* Hacker background terminal - visible behind everything */}
        <BackgroundTerminal />

        <Show when={!CONFIG.DOCK_ONLY && uiPrefsActions.shouldShowTerminal()}>
          <div class={terminalClasses()}>
            <Terminal />
          </div>
        </Show>

        <CenterBadge />

        <Switch>
          <Match when={terminalState.activeModal === 'CALLSIGN_PROMPT'}>
            <CallsignPrompt mode="setup" />
          </Match>
          <Match when={terminalState.activeModal === 'CALLSIGN_CHANGE'}>
            <CallsignPrompt mode="change" />
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
          <Match
            when={
              terminalState.activeModal === 'FORENSIC_COLLECTION' &&
              featureState.forensics.visible
            }
          >
            <ForensicCollection />
          </Match>
        </Switch>

        {viewerState.isOpen && (
          <ImageViewer
            images={viewerState.images}
            title={viewerState.title}
            onClose={viewerActions.close}
          />
        )}

        <SessionContextBar />

        <DockLauncher />

        <HomeScreen />

        <FlowProgressOverlay />
        <FlowMinimizedIndicator />

        <AuditViewer />

        <AuditQuickButton />
      </Show>

      {/* Mock controller - always visible for development testing */}
      <MockController />
    </div>
  );
}
