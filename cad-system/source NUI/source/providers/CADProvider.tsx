import { createContext, useContext, type ParentComponent } from 'solid-js';
import { createStore } from 'solid-js/store';

export interface Case {
  caseId: string;
  caseType: string;
  title: string;
  description: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  priority: number;
  createdBy: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  personId?: string;
  personName?: string;
  caseCode?: string;
  notes: Note[];
  evidence: Evidence[];
  tasks: CaseTask[];
  linkedCallId?: string;
  linkedUnits?: string[];
}

export interface CustodyEvent {
  eventId: string;
  evidenceId: string;
  eventType: 'COLLECTED' | 'TRANSFERRED' | 'STORED' | 'ANALYZED' | 'SUBMITTED' | 'RELEASED';
  fromOfficer?: string;
  toOfficer?: string;
  location?: string;
  notes?: string;
  timestamp: string;
  recordedBy: string;
}

export interface Evidence {
  evidenceId: string;
  caseId: string;
  evidenceType: string;
  data: Record<string, unknown>;
  attachedBy: string;
  attachedAt: string;
  custodyChain: CustodyEvent[];
  currentLocation?: string;
  currentCustodian?: string;
}

export interface StagingEvidence {
  stagingId: string;
  evidenceType: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface DispatchUnit {
  unitId: string;
  badge: string;
  name: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  type: string;
  location?: { x: number; y: number; z: number };
  currentCall?: string;
}

export interface DispatchCall {
  callId: string;
  type: string;
  priority: number;
  title: string;
  description: string;
  location?: string;
  coordinates?: { x: number; y: number; z: number };
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  assignedUnits: Record<string, { assignedAt: string }>;
  createdAt: string;
}

export interface SecurityCamera {
  cameraId: string;
  cameraNumber: number;
  label: string;
  street: string;
  crossStreet: string;
  zone: string;
  coords: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  status: 'ACTIVE' | 'DISABLED';
  installedBy: string;
  installedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RadioMarker {
  markerId: string;
  message: string;
  sender: string;
  channel: string;
  timestamp: string;
  linkedCaseId?: string;
  linkedCallId?: string;
  markedBy: string;
  markedAt: string;
  notes?: string;
}

export interface Note {
  id: string;
  caseId: string;
  author: string;
  content: string;
  timestamp: string;
  type: 'general' | 'observation' | 'interview' | 'evidence';
}

export interface EntityNote {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

export interface Person {
  citizenid: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  phone?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  height?: string;
  weight?: string;
  eyeColor?: string;
  hairColor?: string;
  photo?: string;
  photos?: string[];
  flags?: string[];
  createdAt: string;
  lastUpdated: string;
  isDead: boolean;
  ckDate?: string;
  notes?: EntityNote[];
}

export interface Vehicle {
  plate: string;
  model: string;
  make: string;
  year: number;
  color: string;
  ownerId: string;
  ownerName: string;
  vin: string;
  registrationStatus: 'VALID' | 'EXPIRED' | 'SUSPENDED';
  insuranceStatus: 'VALID' | 'EXPIRED' | 'NONE';
  stolen: boolean;
  stolenReportedAt?: string;
  flags: string[];
  createdAt: string;
  notes?: EntityNote[];
  photos?: string[];
}

export interface Fine {
  fineId: string;
  targetType: 'PERSON' | 'VEHICLE';
  targetId: string;
  targetName: string;
  fineCode: string;
  description: string;
  amount: number;
  jailTime: number;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
  paid: boolean;
  paidAt?: string;
  paidMethod?: 'CASH' | 'BANK';
  isBail: boolean;
  bailDeadline?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
}

export interface CaseTask {
  taskId: string;
  caseId: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  status: 'PENDING' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

export interface CriminalRecord {
  recordId: string;
  citizenid: string;
  personName: string;
  caseId?: string;
  charges: string[];
  description: string;
  sentence: string;
  fine: number;
  jailTime: number;
  convicted: boolean;
  convictedAt?: string;
  arrestingOfficer: string;
  arrestingOfficerName: string;
  arrestedAt: string;
  notes?: string;
  cleared: boolean;
  clearedAt?: string;
  clearedBy?: string;
}

export interface Warrant {
  warrantId: string;
  citizenid: string;
  personName: string;
  type: 'ARREST' | 'SEARCH';
  reason: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
  expiresAt?: string;
  active: boolean;
  executed: boolean;
  executedAt?: string;
  executedBy?: string;
  clearedBy?: string;
  clearedAt?: string;
}

export interface BOLO {
  boloId: string;
  type: 'PERSON' | 'VEHICLE';
  identifier: string;
  reason: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  active: boolean;
  photos?: string[];
}

export interface CADState {
  cases: Record<string, Case>;
  currentCase: Case | null;
  stagingEvidence: StagingEvidence[];
  caseEvidence: Record<string, Evidence[]>;
  dispatchUnits: Record<string, DispatchUnit>;
  dispatchCalls: Record<string, DispatchCall>;
  securityCameras: Record<string, SecurityCamera>;
  currentCall: DispatchCall | null;
  notes: Note[];
  radioMarkers: Record<string, RadioMarker>;
  persons: Record<string, Person>;
  vehicles: Record<string, Vehicle>;
  fines: Record<string, Fine>;
  criminalRecords: Record<string, CriminalRecord>;
  warrants: Record<string, Warrant>;
  bolos: Record<string, BOLO>;
  searchResults: {
    persons: Person[];
    vehicles: Vehicle[];
    loading: boolean;
  };
  isLoading: boolean;
  error: string | null;
}

export interface CADIndexes {
  casesByStatus: Map<string, Set<string>>;
  casesByPerson: Map<string, Set<string>>;
  vehiclesByOwner: Map<string, Set<string>>;
  recordsByPerson: Map<string, Set<string>>;
  warrantsByPerson: Map<string, Set<string>>;
  bolosByIdentifier: Map<string, string>;
  callsByStatus: Map<string, Set<string>>;
  unitsByStatus: Map<string, Set<string>>;
}

const createInitialIndexes = (): CADIndexes => ({
  casesByStatus: new Map(),
  casesByPerson: new Map(),
  vehiclesByOwner: new Map(),
  recordsByPerson: new Map(),
  warrantsByPerson: new Map(),
  bolosByIdentifier: new Map(),
  callsByStatus: new Map(),
  unitsByStatus: new Map(),
});

const initialState: CADState = {
  cases: {},
  currentCase: null,
  stagingEvidence: [],
  caseEvidence: {},
  dispatchUnits: {},
  dispatchCalls: {},
  securityCameras: {},
  currentCall: null,
  notes: [],
  persons: {},
  vehicles: {},
  fines: {},
  criminalRecords: {},
  warrants: {},
  bolos: {},
  radioMarkers: {},
  searchResults: {
    persons: [],
    vehicles: [],
    loading: false,
  },
  isLoading: false,
  error: null,
};

export interface CADContextValue {
  state: CADState;
  indexes: CADIndexes;
}

const CADContext = createContext<CADContextValue | null>(null);

export function useCAD(): CADContextValue {
  const ctx = useContext(CADContext);
  if (!ctx) throw new Error('useCAD must be used within CADProvider');
  return ctx;
}

export const useCADState = () => useCAD().state;
export const useCADIndexes = () => useCAD().indexes;

export const CADProvider: ParentComponent = (props) => {
  const [state] = createStore<CADState>(initialState);
  const indexes: CADIndexes = createInitialIndexes();
  
  const value: CADContextValue = { state, indexes };
  
  return (
    <CADContext.Provider value={value}>
      {props.children}
    </CADContext.Provider>
  );
};

export const cadSelectors = {
  personsArray: (state: CADState) => Object.values(state.persons),
  vehiclesArray: (state: CADState) => Object.values(state.vehicles),
  casesArray: (state: CADState) => Object.values(state.cases),
  openCases: (state: CADState) => Object.values(state.cases).filter(c => c.status === 'OPEN').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  criminalRecordsArray: (state: CADState) => Object.values(state.criminalRecords),
  recentArrests: (state: CADState) => Object.values(state.criminalRecords).filter(r => !r.cleared).sort((a, b) => new Date(b.arrestedAt).getTime() - new Date(a.arrestedAt).getTime()).slice(0, 10),
  warrantsArray: (state: CADState) => Object.values(state.warrants),
  activeWarrants: (state: CADState) => Object.values(state.warrants).filter(w => w.active && !w.executed).sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()),
  bolosArray: (state: CADState) => Object.values(state.bolos),
  activeBOLOs: (state: CADState) => Object.values(state.bolos).filter(b => b.active),
  impoundedVehicles: (state: CADState) => Object.values(state.vehicles).filter(v => v.flags?.some(f => f === 'IMPOUNDED')),
  dispatchUnitsArray: (state: CADState) => Object.values(state.dispatchUnits),
  availableUnits: (state: CADState) => Object.values(state.dispatchUnits).filter(u => u.status === 'AVAILABLE'),
  dispatchCallsArray: (state: CADState) => Object.values(state.dispatchCalls),
  activeCalls: (state: CADState) => Object.values(state.dispatchCalls).filter(c => c.status === 'ACTIVE' || c.status === 'PENDING').sort((a, b) => a.priority - b.priority || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  stagingEvidenceArray: (state: CADState) => state.stagingEvidence,
  personById: (state: CADState, citizenid: string) => state.persons[citizenid],
  vehicleById: (state: CADState, plate: string) => state.vehicles[plate],
  caseById: (state: CADState, caseId: string) => state.cases[caseId],
  caseEvidence: (state: CADState, caseId: string) => state.cases[caseId]?.evidence || [],
  vehiclesByOwner: (indexes: CADIndexes, state: CADState, ownerId: string) => {
    const plates = indexes.vehiclesByOwner.get(ownerId);
    if (!plates) return [];
    return Array.from(plates).map(plate => state.vehicles[plate]).filter(Boolean);
  },
  recordsByPerson: (indexes: CADIndexes, state: CADState, citizenid: string) => {
    const ids = indexes.recordsByPerson.get(citizenid);
    if (!ids) return [];
    return Array.from(ids).map(id => state.criminalRecords[id]).filter(Boolean);
  },
  warrantsByPerson: (indexes: CADIndexes, state: CADState, citizenid: string) => {
    const ids = indexes.warrantsByPerson.get(citizenid);
    if (!ids) return [];
    return Array.from(ids).map(id => state.warrants[id]).filter(Boolean);
  },
  checkBOLO: (indexes: CADIndexes, state: CADState, _type: 'PERSON' | 'VEHICLE', identifier: string) => {
    const boloId = indexes.bolosByIdentifier.get(identifier);
    if (!boloId) return null;
    const bolo = state.bolos[boloId];
    return bolo?.active ? bolo : null;
  },
};
