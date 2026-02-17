import { Show } from 'solid-js';
import { terminalState } from '~/stores/terminalStore';
import { CaseManager } from './modals/CaseManager';
import { EvidenceManager } from './modals/EvidenceManager';
import { RadioPanel } from './modals/RadioPanel';
import { VehicleCAD } from './modals/VehicleCAD';

export function ModalManager() {
  return (
    <>
      <Show when={terminalState.activeModal === 'CASE_MANAGER'}>
        <CaseManager />
      </Show>
      
      <Show when={terminalState.activeModal === 'EVIDENCE_MANAGER'}>
        <EvidenceManager />
      </Show>
      
      <Show when={terminalState.activeModal === 'RADIO_PANEL'}>
        <RadioPanel />
      </Show>
      
      <Show when={terminalState.activeModal === 'VEHICLE_CAD'}>
        <VehicleCAD />
      </Show>
    </>
  );
}