import type { Scenario } from '../types';
import { 
  setMockCases, 
  setMockCalls, 
  setMockUnits,
  setMockEmsUnits,
  setMockEmsAlerts,
  setMockBloodRequests,
  setMockWorldTraces,
  setMockStagingEvidence,
  setMockPersons,
  setMockVehicles,
  setMockFines,
  setMockWarrants,
  clearMockCases,
  clearMockDispatch,
  clearMockEms,
  clearMockForensics,
  clearMockPersonsVehicles,
  clearMockFines,
} from '../handlers';
import { injectMockEvent } from './eventBus';
import { cadActions } from '~/stores/cadStore';
import { terminalActions, terminalState } from '~/stores/terminalStore';

export async function loadScenario(scenario: Scenario): Promise<void> {
  console.log(`[MOCK] Loading scenario: ${scenario.name}`);

  const isVehicleScenario = scenario.id === 'VEHICLE_COMPACT';
  terminalActions.setVehicleContext(isVehicleScenario);
  terminalActions.setUIMode(isVehicleScenario ? 'compact' : 'normal');
  terminalActions.setVehicleSpeed(isVehicleScenario ? 35 : 0);
  if (!isVehicleScenario && terminalState.activeModal === 'VEHICLE_CAD') {
    terminalActions.setActiveModal(null);
  }
  
  // Clear all existing mock data
  clearMockCases();
  clearMockDispatch();
  clearMockEms();
  clearMockForensics();
  clearMockPersonsVehicles();
  clearMockFines();
  
  // Small delay to simulate processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Load Cases
  if (scenario.data.cases && Object.keys(scenario.data.cases).length > 0) {
    setMockCases(scenario.data.cases);
    
    // Update the cadStore
    Object.values(scenario.data.cases).forEach(caseData => {
      cadActions.addCase(caseData);
    });
    
    console.log(`[MOCK] Loaded ${Object.keys(scenario.data.cases).length} cases`);
  }
  
  // Load Dispatch Calls and Units
  if (scenario.data.calls) {
    setMockCalls(scenario.data.calls);
  }
  
  if (scenario.data.units) {
    // Separate dispatch units from EMS units
    const dispatchUnits: any = {};
    const emsUnits: any = {};
    
    Object.entries(scenario.data.units).forEach(([id, unit]) => {
      if (unit.type === 'AMBULANCE' || unit.type === 'EMS') {
        emsUnits[id] = unit;
      } else {
        dispatchUnits[id] = unit;
      }
    });
    
    setMockUnits(dispatchUnits);
    setMockEmsUnits(emsUnits);
    
    // Update cadStore
    Object.values(dispatchUnits).forEach((unit: any) => {
      cadActions.updateDispatchUnit(unit.unitId, unit);
    });
  }
  
  // Load EMS Data
  if (scenario.data.alerts) {
    setMockEmsAlerts(scenario.data.alerts);
  }
  
  if (scenario.data.bloodRequests) {
    setMockBloodRequests(scenario.data.bloodRequests);
  }
  
  // Load Forensics Data
  if (scenario.data.traces) {
    setMockWorldTraces(scenario.data.traces);
  }
  
  if (scenario.data.evidence && scenario.data.evidence.length > 0) {
    setMockStagingEvidence(scenario.data.evidence);
  }
  
  // Load Persons and Vehicles
  if (scenario.data.persons) {
    setMockPersons(scenario.data.persons);
  }
  
  if (scenario.data.vehicles) {
    setMockVehicles(scenario.data.vehicles);
  }
  
  // Load Fines and Warrants
  if (scenario.data.fines) {
    setMockFines(scenario.data.fines);
  }
  
  if (scenario.data.warrants) {
    setMockWarrants(scenario.data.warrants);
  }
  
  // Emit events to update stores
  injectMockEvent('cad:mock:scenarioLoaded', {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    timestamp: new Date().toISOString(),
  }, 200);
  
  console.log(`[MOCK] Scenario ${scenario.name} loaded successfully`);

  // Special handling for vehicle compact scenario
  if (isVehicleScenario) {
    terminalActions.setActiveModal('VEHICLE_CAD');

    // Simulate radar data
    window.postMessage({
      action: 'radarData',
      data: [
        { id: 1, coords: { x: 450, y: -980, z: 0 }, distance: 25, isWanted: false },
        { id: 2, coords: { x: 465, y: -995, z: 0 }, distance: 42, isWanted: true }
      ]
    }, '*');

    terminalActions.addLine('✓ Vehicle CAD activated', 'system');
    terminalActions.addLine('  Speed: 35 MPH | Radar active', 'system');
  }
}

export function resetMockData(): void {
  clearMockCases();
  clearMockDispatch();
  clearMockEms();
  clearMockForensics();
  clearMockPersonsVehicles();
  clearMockFines();
  
  injectMockEvent('cad:mock:reset', {
    timestamp: new Date().toISOString(),
  });
  
  console.log('[MOCK] All mock data reset');
}
