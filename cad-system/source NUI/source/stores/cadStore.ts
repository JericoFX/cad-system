import { createStore, produce } from 'solid-js/store';
import { batch, untrack } from 'solid-js';
import { 
  updateEntity, 
  addToArray, 
  createTransferEvent, 
  createAnalysisRequestEvent,
  createAnalysisCompletionEvent,
  createSearchFilter
} from '~/utils/storeHelpers';

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
  targetId: string; // citizenid or plate
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
  identifier: string; // citizenid or plate
  reason: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  active: boolean;
  photos?: string[];
}

interface CADState {
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

export const [cadState, setCADState] = createStore(initialState);

const normalizeCaseRecord = (caseData: Case): Case => ({
  ...caseData,
  notes: caseData.notes || [],
  evidence: caseData.evidence || [],
  tasks: caseData.tasks || [],
});

export const cadActions = {
  setLoading: (loading: boolean) => setCADState('isLoading', loading),
  setError: (error: string | null) => setCADState('error', error),
  
  setCases: (cases: Record<string, Case>) => {
    const normalized = Object.fromEntries(
      Object.entries(cases).map(([caseId, caseData]) => [
        caseId,
        normalizeCaseRecord(caseData),
      ])
    );
    setCADState('cases', normalized);
  },
  addCase: (caseData: Case) => {
    const normalized = normalizeCaseRecord(caseData);
    batch(() => {
      setCADState('cases', normalized.caseId, normalized);
      setCADState('currentCase', normalized);
    });
  },
  setCurrentCase: (caseData: Case | null) => setCADState('currentCase', caseData),
  updateCase: (caseId: string, data: Partial<Case>) => {
    setCADState('cases', caseId, (prev) => ({ ...prev, ...data }));
  },
  
  setStagingEvidence: (evidence: StagingEvidence[]) => setCADState('stagingEvidence', evidence),
  addStagingEvidence: (evidence: StagingEvidence) => 
    setCADState('stagingEvidence', (prev) => [...prev, evidence]),
  removeStagingEvidence: (stagingId: string) =>
    setCADState('stagingEvidence', (prev) => prev.filter(e => e.stagingId !== stagingId)),
  
  setDispatchUnits: (units: Record<string, DispatchUnit>) => setCADState('dispatchUnits', units),
  updateDispatchUnit: (unitId: string, data: Partial<DispatchUnit>) => {
    setCADState('dispatchUnits', unitId, (prev) => ({ ...prev, ...data }));
  },
  
  setDispatchCalls: (calls: Record<string, DispatchCall>) => setCADState('dispatchCalls', calls),
  addDispatchCall: (call: DispatchCall) => setCADState('dispatchCalls', call.callId, call),
  updateDispatchCall: (callId: string, data: Partial<DispatchCall>) => {
    setCADState('dispatchCalls', callId, (prev) => ({ ...prev, ...data }));
  },
  removeDispatchCall: (callId: string) => {
    setCADState('dispatchCalls', (prev) => {
      const { [callId]: _, ...rest } = prev;
      return rest;
    });
  },
  setCurrentCall: (call: DispatchCall | null) => setCADState('currentCall', call),

  setSecurityCameras: (cameras: Record<string, SecurityCamera>) => setCADState('securityCameras', cameras),
  upsertSecurityCamera: (camera: SecurityCamera) => setCADState('securityCameras', camera.cameraId, camera),
  removeSecurityCamera: (cameraId: string) => {
    setCADState('securityCameras', (prev) => {
      const { [cameraId]: _, ...rest } = prev;
      return rest;
    });
  },
  
  addCaseNote: (caseId: string, note: Note) => {
    setCADState('cases', caseId, 'notes', produce((notes) => {
      notes.push(note);
    }));
  },
  updateCaseNote: (caseId: string, noteId: string, data: Partial<Note>) => {
    setCADState('cases', caseId, 'notes', produce((notes) => {
      const note = notes.find(n => n.id === noteId);
      if (note) Object.assign(note, data);
    }));
  },
  removeCaseNote: (caseId: string, noteId: string) => {
    setCADState('cases', caseId, 'notes', produce((notes) => {
      const idx = notes.findIndex(n => n.id === noteId);
      if (idx !== -1) notes.splice(idx, 1);
    }));
  },
  
  addCaseEvidence: (caseId: string, evidence: Evidence) => {
    const evidenceWithCustody = {
      ...evidence,
      custodyChain: evidence.custodyChain || [{
        eventId: `CUSTODY_${Date.now()}`,
        evidenceId: evidence.evidenceId,
        eventType: 'COLLECTED' as const,
        location: 'Field/Scene',
        notes: 'Evidence collected and logged',
        timestamp: new Date().toISOString(),
        recordedBy: evidence.attachedBy,
      }],
      currentLocation: 'Evidence Storage',
      currentCustodian: evidence.attachedBy,
    };
    setCADState('cases', caseId, 'evidence', produce((evidenceList) => {
      evidenceList.push(evidenceWithCustody);
    }));
  },
  removeCaseEvidence: (caseId: string, evidenceId: string) => {
    setCADState('cases', caseId, 'evidence', produce((evidenceList) => {
      const idx = evidenceList.findIndex(e => e.evidenceId === evidenceId);
      if (idx !== -1) evidenceList.splice(idx, 1);
    }));
  },
  addCustodyEvent: (caseId: string, evidenceId: string, event: CustodyEvent) => {
    setCADState('cases', caseId, 'evidence', produce((evidenceList) => {
      const e = evidenceList.find(e => e.evidenceId === evidenceId);
      if (e) {
        e.custodyChain = [...(e.custodyChain || []), event];
        e.currentLocation = event.location || e.currentLocation;
        e.currentCustodian = event.toOfficer || event.recordedBy;
      }
    }));
  },
  transferEvidence: (caseId: string, evidenceId: string, fromOfficer: string, toOfficer: string, notes?: string) => {
    const event = createTransferEvent(evidenceId, fromOfficer, toOfficer, notes);
    cadActions.addCustodyEvent(caseId, evidenceId, event);
  },
  analyzeEvidence: (caseId: string, evidenceId: string, analystId: string, location: string, notes?: string) => {
    const event = createAnalysisCompletionEvent(evidenceId, analystId, location, notes);
    cadActions.addCustodyEvent(caseId, evidenceId, event);
  },
  requestEvidenceAnalysis: (caseId: string, evidenceId: string, requestedBy: string, notes?: string) => {
    const event = createAnalysisRequestEvent(evidenceId, requestedBy, notes);
    cadActions.addCustodyEvent(caseId, evidenceId, event);
  },
  getEvidenceCustodyChain: (caseId: string, evidenceId: string): CustodyEvent[] => {
    return untrack(() => {
      const evidence = cadState.cases[caseId]?.evidence?.find(e => e.evidenceId === evidenceId);
      return evidence?.custodyChain || [];
    });
  },
  
  searchCases: (query: string) => {
    const searchFilter = createSearchFilter<Case>(['caseId', 'title', 'personName', 'personId']);
    return searchFilter(Object.values(cadState.cases), query);
  },
  
  setPersons: (persons: Record<string, Person>) => setCADState('persons', persons),
  addPerson: (person: Person) => setCADState('persons', person.citizenid, { ...person, notes: person.notes || [] }),
  updatePerson: (citizenid: string, data: Partial<Person>) => {
    updateEntity(setCADState, 'persons', citizenid, data);
  },
  addPersonNote: (citizenid: string, note: EntityNote) => {
    addToArray(setCADState, 'persons', citizenid, 'notes', note);
  },
  
  setVehicles: (vehicles: Record<string, Vehicle>) => setCADState('vehicles', vehicles),
  addVehicle: (vehicle: Vehicle) => setCADState('vehicles', vehicle.plate, { ...vehicle, notes: vehicle.notes || [] }),
  updateVehicle: (plate: string, data: Partial<Vehicle>) => {
    updateEntity(setCADState, 'vehicles', plate, data);
  },
  addPersonPhoto: (citizenid: string, photoUrl: string) => {
    setCADState('persons', citizenid, (prev) => {
      const photos = prev?.photos || [];
      return {
        ...prev,
        photos: [...photos, photoUrl],
        lastUpdated: new Date().toISOString(),
      };
    });
  },
  
  addVehiclePhoto: (plate: string, photoUrl: string) => {
    setCADState('vehicles', plate, (prev) => {
      const photos = prev?.photos || [];
      return {
        ...prev,
        photos: [...photos, photoUrl],
      };
    });
  },
  
  setFines: (fines: Record<string, Fine>) => setCADState('fines', fines),
  addFine: (fine: Fine) => setCADState('fines', fine.fineId, fine),
  updateFine: (fineId: string, data: Partial<Fine>) => {
    setCADState('fines', fineId, (prev) => ({ ...prev, ...data }));
  },
  removeFine: (fineId: string) => {
    setCADState('fines', (prev) => {
      const { [fineId]: _, ...rest } = prev;
      return rest;
    });
  },
  
  addVehicleNote: (plate: string, note: EntityNote) => {
    addToArray(setCADState, 'vehicles', plate, 'notes', note);
  },
  
  setCriminalRecords: (records: Record<string, CriminalRecord>) => setCADState('criminalRecords', records),
  addCriminalRecord: (record: CriminalRecord) => setCADState('criminalRecords', record.recordId, record),
  updateCriminalRecord: (recordId: string, data: Partial<CriminalRecord>) => {
    setCADState('criminalRecords', recordId, (prev) => ({ ...prev, ...data }));
  },
  
  setWarrants: (warrants: Record<string, Warrant>) => setCADState('warrants', warrants),
  addWarrant: (warrant: Warrant) => setCADState('warrants', warrant.warrantId, warrant),
  updateWarrant: (warrantId: string, data: Partial<Warrant>) => {
    setCADState('warrants', warrantId, (prev) => ({ ...prev, ...data }));
  },
  
  setBOLOs: (bolos: Record<string, BOLO>) => setCADState('bolos', bolos),
  addBOLO: (bolo: BOLO) => setCADState('bolos', bolo.boloId, bolo),
  updateBOLO: (boloId: string, data: Partial<BOLO>) => {
    setCADState('bolos', boloId, (prev) => ({ ...prev, ...data }));
  },
  removeBOLO: (boloId: string) => {
    setCADState('bolos', (prev) => {
      const { [boloId]: _, ...rest } = prev;
      return rest;
    });
  },
  getActiveBOLOs: (): BOLO[] => {
    return untrack(() => Object.values(cadState.bolos).filter(b => b.active));
  },
  checkBOLO: (type: 'PERSON' | 'VEHICLE', identifier: string): BOLO | null => {
    return untrack(() => 
      Object.values(cadState.bolos).find(b => 
        b.active && b.type === type && b.identifier === identifier
      ) || null
    );
  },
  
  addRadioMarker: (marker: RadioMarker) => {
    setCADState('radioMarkers', marker.markerId, marker);
  },
  removeRadioMarker: (markerId: string) => {
    setCADState('radioMarkers', (prev) => {
      const { [markerId]: _, ...rest } = prev;
      return rest;
    });
  },
  linkMarkerToCase: (markerId: string, caseId: string) => {
    setCADState('radioMarkers', markerId, 'linkedCaseId', caseId);
  },
  linkMarkerToCall: (markerId: string, callId: string) => {
    setCADState('radioMarkers', markerId, 'linkedCallId', callId);
  },
  getMarkersForCase: (caseId: string): RadioMarker[] => {
    return untrack(() => Object.values(cadState.radioMarkers).filter(m => m.linkedCaseId === caseId));
  },
  getMarkersForCall: (callId: string): RadioMarker[] => {
    return untrack(() => Object.values(cadState.radioMarkers).filter(m => m.linkedCallId === callId));
  },
  getAllMarkers: (): RadioMarker[] => {
    return untrack(() => Object.values(cadState.radioMarkers).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  },
  
  addCaseTask: (caseId: string, task: CaseTask) => {
    setCADState('cases', caseId, 'tasks', produce((tasks) => {
      tasks.push(task);
    }));
  },
  updateCaseTask: (caseId: string, taskId: string, data: Partial<CaseTask>) => {
    setCADState('cases', caseId, 'tasks', produce((tasks) => {
      const task = tasks.find(t => t.taskId === taskId);
      if (task) Object.assign(task, data);
    }));
  },
  removeCaseTask: (caseId: string, taskId: string) => {
    setCADState('cases', caseId, 'tasks', produce((tasks) => {
      const idx = tasks.findIndex(t => t.taskId === taskId);
      if (idx !== -1) tasks.splice(idx, 1);
    }));
  },
  completeCaseTask: (caseId: string, taskId: string) => {
    setCADState('cases', caseId, 'tasks', produce((tasks) => {
      const task = tasks.find(t => t.taskId === taskId);
      if (task) {
        task.status = 'COMPLETED';
        task.completedAt = new Date().toISOString();
      }
    }));
  },
  getPendingTasks: (caseId: string): CaseTask[] => {
    return untrack(() => cadState.cases[caseId]?.tasks?.filter(t => t.status === 'PENDING') || []);
  },
  getOverdueTasks: (caseId: string): CaseTask[] => {
    return untrack(() => {
      const now = new Date().toISOString();
      return cadState.cases[caseId]?.tasks?.filter(t => 
        t.status === 'PENDING' && t.dueDate < now
      ) || [];
    });
  },
  
  setSearchResults: (results: { persons: Person[]; vehicles: Vehicle[] }) => {
    batch(() => {
      setCADState('searchResults', 'persons', results.persons);
      setCADState('searchResults', 'vehicles', results.vehicles);
      setCADState('searchResults', 'loading', false);
    });
  },
  setSearchLoading: (loading: boolean) => setCADState('searchResults', 'loading', loading),
  clearSearchResults: () => setCADState('searchResults', { persons: [], vehicles: [], loading: false }),
  
  clearAll: () => {
    setCADState({ ...initialState });
  },
};
