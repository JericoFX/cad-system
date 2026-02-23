import { createMemo } from 'solid-js';
import { cadState, type CriminalRecord, type Warrant, type BOLO } from './cadStore';

export const $personsArray = createMemo(() => Object.values(cadState.persons));

export const $vehiclesArray = createMemo(() => Object.values(cadState.vehicles));

export const $casesArray = createMemo(() => Object.values(cadState.cases));

export const $openCases = createMemo(() => 
  $casesArray().filter(c => c.status === 'OPEN')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);

export const $criminalRecordsArray = createMemo(() => 
  Object.values(cadState.criminalRecords) as CriminalRecord[]
);

export const $recentArrests = createMemo(() => 
  $criminalRecordsArray()
    .filter(r => !r.cleared)
    .sort((a, b) => new Date(b.arrestedAt).getTime() - new Date(a.arrestedAt).getTime())
    .slice(0, 10)
);

export const $warrantsArray = createMemo(() => 
  Object.values(cadState.warrants) as Warrant[]
);

export const $activeWarrants = createMemo(() => 
  $warrantsArray()
    .filter(w => w.active && !w.executed)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
);

export const $bolosArray = createMemo(() => 
  Object.values(cadState.bolos) as BOLO[]
);

export const $activeBOLOs = createMemo(() => 
  $bolosArray().filter(b => b.active)
);

export const $impoundedVehicles = createMemo(() => 
  $vehiclesArray().filter(v => v.flags?.some(f => f === 'IMPOUNDED'))
);

export const $dispatchUnitsArray = createMemo(() => 
  Object.values(cadState.dispatchUnits)
);

export const $availableUnits = createMemo(() => 
  $dispatchUnitsArray().filter(u => u.status === 'AVAILABLE')
);

export const $dispatchCallsArray = createMemo(() => 
  Object.values(cadState.dispatchCalls)
);

export const $activeCalls = createMemo(() => 
  $dispatchCallsArray().filter(c => c.status === 'ACTIVE' || c.status === 'PENDING')
    .sort((a, b) => a.priority - b.priority || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);

export const $stagingEvidenceArray = createMemo(() => 
  cadState.stagingEvidence
);

export function $personById(citizenid: string) {
  return createMemo(() => cadState.persons[citizenid]);
}

export function $vehicleById(plate: string) {
  return createMemo(() => cadState.vehicles[plate]);
}

export function $caseById(caseId: string) {
  return createMemo(() => cadState.cases[caseId]);
}

export function $caseEvidence(caseId: string) {
  return createMemo(() => {
    const c = cadState.cases[caseId];
    return c?.evidence || [];
  });
}
