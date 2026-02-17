import { Show } from 'solid-js';
import { terminalState } from '~/stores/terminalStore';
import { CaseManager } from './CaseManager';
import { EvidenceManager } from './EvidenceManager';
import { RadioPanel } from './RadioPanel';
import { VehicleCAD } from './VehicleCAD';

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