
import { createStore } from 'solid-js/store';
import { batch } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';
import { cadActions } from './cadStore';

export type PatientCondition = 'CRITICAL' | 'SERIOUS' | 'STABLE' | 'DECEASED';

export type PatientStatus = 
  | 'TRIAGE'      // Initial assessment
  | 'ADMITTED'    // Waiting for treatment
  | 'IN_TREATMENT' // Currently being treated
  | 'STABLE'      // Condition stabilized
  | 'DISCHARGED'  // Released
  | 'TRANSFERRED' // Handoff to case/police
  | 'DECEASED';   // Death

export type TriagePriority = 1 | 2 | 3 | 4;

export interface PatientVitals {
  bp: string;        // Blood pressure (e.g., "120/80")
  hr: number;        // Heart rate
  temp: number;      // Temperature in °F
  o2: number;        // O2 saturation %
  rr?: number;       // Respiratory rate
  pain?: number;     // Pain scale 0-10
}

export interface PatientTreatment {
  treatmentId: string;
  timestamp: string;
  medicId: string;
  medicName: string;
  action: string;
  medications: string[];
  notes: string;
  vitalsBefore?: PatientVitals;
  vitalsAfter?: PatientVitals;
}

export interface Patient {
  patientId: string;
  name: string;
  dob?: string;
  gender?: 'M' | 'F' | 'OTHER';
  
  condition: PatientCondition;
  triagePriority: TriagePriority;
  chiefComplaint: string;        // Main symptom/reason
  symptoms: string[];
  allergies: string[];
  currentMedications: string[];
  medicalHistory?: string;
  
  vitals: PatientVitals;
  vitalsHistory: Array<{
    timestamp: string;
    vitals: PatientVitals;
    takenBy: string;
  }>;
  
  status: PatientStatus;
  
  triagedAt: string;
  triagedBy: string;
  admittedAt?: string;
  treatmentStartedAt?: string;
  dischargedAt?: string;
  
  treatments: PatientTreatment[];
  
  caseId?: string;              // Linked CAD case
  callId?: string;              // Linked dispatch call
  
  dischargeNotes?: string;
  dischargeDisposition?: 'HOME' | 'HOSPITAL' | 'POLICE' | 'MORGUE';
  handoffToCase?: boolean;      // Handoff report sent to case
}

export interface InventoryItem {
  itemId: string;
  name: string;
  category: 'MEDICATION' | 'EQUIPMENT' | 'SUPPLIES' | 'BLOOD';
  quantity: number;
  unit: string;
  minStock: number;             // Alert threshold
  usedToday: number;
  lastRestocked: string;
  
  usageHistory: Array<{
    timestamp: string;
    patientId?: string;
    medicId: string;
    quantity: number;
    reason: string;
  }>;
}

export interface EMSUnit {
  unitId: string;
  unitType: 'AMBULANCE' | 'FIRE' | 'RESCUE' | 'SUPERVISOR';
  status: 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'TRANSPORTING' | 'AT_HOSPITAL' | 'BUSY';
  currentCall?: string;
  crew: string[];               // Officer IDs
  currentPatient?: string;      // Patient ID if transporting
}

export interface EMSState {
  patients: Record<string, Patient>;
  units: Record<string, EMSUnit>;
  inventory: Record<string, InventoryItem>;
  currentUser: {
    id: string;
    name: string;
    badge: string;
    unit?: string;
  } | null;
  
  activeFilter: 'ALL' | 'TRIAGE' | 'TREATMENT' | 'CRITICAL' | 'MY_PATIENTS';
  sortBy: 'PRIORITY' | 'TIME' | 'NAME';
  
  selectedPatient: string | null;
  selectedUnit: string | null;
}

export function calculateTriagePriority(
  condition: PatientCondition, 
  vitals: PatientVitals, 
  chiefComplaint: string
): TriagePriority {
  if (condition === 'CRITICAL' || condition === 'DECEASED') return 1;
  
  const hr = vitals.hr;
  const o2 = vitals.o2;
  
  if (hr > 130 || hr < 40 || o2 < 85) return 1;
  
  if (condition === 'SERIOUS') return 2;
  
  if (hr > 110 || hr < 50 || o2 < 90) return 2;
  
  const urgentKeywords = ['chest pain', 'not breathing', 'unconscious', 'bleeding', 'trauma', 'stroke'];
  const isUrgent = urgentKeywords.some(kw => 
    chiefComplaint.toLowerCase().includes(kw)
  );
  
  if (isUrgent && condition === 'STABLE') return 2;
  
  return 3;
}

const initialState: EMSState = {
  patients: {},
  units: {
    'EMS-01': {
      unitId: 'EMS-01',
      unitType: 'AMBULANCE',
      status: 'AVAILABLE',
      crew: [],
    },
    'EMS-02': {
      unitId: 'EMS-02',
      unitType: 'AMBULANCE',
      status: 'AVAILABLE',
      crew: [],
    },
  },
  inventory: {
    'MORPHINE': {
      itemId: 'MORPHINE',
      name: 'Morphine',
      category: 'MEDICATION',
      quantity: 50,
      unit: 'mg',
      minStock: 10,
      usedToday: 0,
      lastRestocked: new Date().toISOString(),
      usageHistory: [],
    },
    'EPINEPHRINE': {
      itemId: 'EPINEPHRINE',
      name: 'Epinephrine',
      category: 'MEDICATION',
      quantity: 20,
      unit: 'doses',
      minStock: 5,
      usedToday: 0,
      lastRestocked: new Date().toISOString(),
      usageHistory: [],
    },
    'BANDAGES': {
      itemId: 'BANDAGES',
      name: 'Bandages',
      category: 'SUPPLIES',
      quantity: 100,
      unit: 'units',
      minStock: 20,
      usedToday: 0,
      lastRestocked: new Date().toISOString(),
      usageHistory: [],
    },
    'SALINE': {
      itemId: 'SALINE',
      name: 'IV Saline',
      category: 'SUPPLIES',
      quantity: 40,
      unit: 'bags',
      minStock: 10,
      usedToday: 0,
      lastRestocked: new Date().toISOString(),
      usageHistory: [],
    },
  },
  currentUser: null,
  activeFilter: 'ALL',
  sortBy: 'PRIORITY',
  selectedPatient: null,
  selectedUnit: null,
};

export const [emsState, setEmsState] = createStore<EMSState>(initialState);

function autoTriagePatient(patient: Patient): Patient {
  const priority = calculateTriagePriority(
    patient.condition,
    patient.vitals,
    patient.chiefComplaint
  );
  
  return {
    ...patient,
    triagePriority: priority,
  };
}

export const emsActions = {
  setCurrentUser(user: EMSState['currentUser']) {
    setEmsState('currentUser', user);
  },

  triagePatient(patientData: Partial<Patient>): Patient {
    const patientId = `PAT_${Date.now()}`;
    const now = new Date().toISOString();
    
    const patient: Patient = {
      patientId,
      name: patientData.name || 'John Doe',
      dob: patientData.dob,
      gender: patientData.gender,
      condition: patientData.condition || 'STABLE',
      triagePriority: 3,
      chiefComplaint: patientData.chiefComplaint || 'Unknown',
      symptoms: patientData.symptoms || [],
      allergies: patientData.allergies || [],
      currentMedications: patientData.currentMedications || [],
      medicalHistory: patientData.medicalHistory,
      vitals: patientData.vitals || {
        bp: '120/80',
        hr: 75,
        temp: 98.6,
        o2: 98,
      },
      vitalsHistory: [{
        timestamp: now,
        vitals: patientData.vitals || {
          bp: '120/80',
          hr: 75,
          temp: 98.6,
          o2: 98,
        },
        takenBy: emsState.currentUser?.name || 'Unknown',
      }],
      status: 'TRIAGE',
      triagedAt: now,
      triagedBy: emsState.currentUser?.id || 'UNKNOWN',
      treatments: [],
    };

    const triagedPatient = autoTriagePatient(patient);
    
    setEmsState('patients', patientId, triagedPatient);
    
    if (triagedPatient.triagePriority <= 2) {
      this.emitEMSEvent('critical_patient', triagedPatient);
    }
    
    return triagedPatient;
  },

  admitPatient(patientId: string) {
    const patient = emsState.patients[patientId];
    if (!patient) return;

    setEmsState('patients', patientId, {
      status: 'ADMITTED',
      admittedAt: new Date().toISOString(),
    });
  },

  startTreatment(patientId: string) {
    const patient = emsState.patients[patientId];
    if (!patient) return;

    setEmsState('patients', patientId, {
      status: 'IN_TREATMENT',
      treatmentStartedAt: new Date().toISOString(),
    });
  },

  addTreatment(patientId: string, treatment: Omit<PatientTreatment, 'treatmentId' | 'timestamp'>) {
    const patient = emsState.patients[patientId];
    if (!patient) return;

    const newTreatment: PatientTreatment = {
      ...treatment,
      treatmentId: `TX_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    batch(() => {
      setEmsState('patients', patientId, 'treatments', 
        [...patient.treatments, newTreatment]
      );

      treatment.medications.forEach(med => {
        this.useInventory(med, 1, patientId, treatment.action);
      });
    });
  },

  updateVitals(patientId: string, vitals: PatientVitals) {
    const patient = emsState.patients[patientId];
    if (!patient) return;

    const now = new Date().toISOString();
    
    batch(() => {
      setEmsState('patients', patientId, 'vitals', vitals);
      setEmsState('patients', patientId, 'vitalsHistory', [
        ...patient.vitalsHistory,
        {
          timestamp: now,
          vitals,
          takenBy: emsState.currentUser?.name || 'Unknown',
        }
      ]);

      const newPriority = calculateTriagePriority(patient.condition, vitals, patient.chiefComplaint);
      if (newPriority !== patient.triagePriority) {
        setEmsState('patients', patientId, 'triagePriority', newPriority);
      }
    });
  },

  dischargePatient(patientId: string, disposition: Patient['dischargeDisposition'], notes?: string) {
    const patient = emsState.patients[patientId];
    if (!patient) return;

    setEmsState('patients', patientId, {
      status: 'DISCHARGED',
      dischargedAt: new Date().toISOString(),
      dischargeDisposition: disposition,
      dischargeNotes: notes,
    });
  },

  handoffToCase(patientId: string, caseId: string): string {
    const patient = emsState.patients[patientId];
    if (!patient) throw new Error('Patient not found');

    const handoffReport = `MEDICAL HANDOFF REPORT
========================
Patient: ${patient.name}
ID: ${patient.patientId}
DOB: ${patient.dob || 'N/A'}

TRIAGE INFO:
Condition: ${patient.condition}
Priority: ${patient.triagePriority}
Chief Complaint: ${patient.chiefComplaint}
Symptoms: ${patient.symptoms.join(', ')}

VITALS (Latest):
BP: ${patient.vitals.bp}
HR: ${patient.vitals.hr}
Temp: ${patient.vitals.temp}°F
O2: ${patient.vitals.o2}%

TREATMENTS PROVIDED:
${patient.treatments.map(t => `- ${t.timestamp}: ${t.action} (${t.medications.join(', ')})`).join('\n')}

ALLERGIES: ${patient.allergies.join(', ') || 'None'}
MEDICATIONS: ${patient.currentMedications.join(', ') || 'None'}

DISPOSITION: ${patient.dischargeDisposition || 'In Treatment'}
Notes: ${patient.dischargeNotes || 'N/A'}

Handoff by: ${emsState.currentUser?.name || 'Unknown'}
Time: ${new Date().toLocaleString()}`;

    cadActions.addCaseNote(caseId, {
      id: `HANDOFF_${Date.now()}`,
      caseId,
      author: emsState.currentUser?.id || 'EMS',
      content: handoffReport,
      timestamp: new Date().toISOString(),
      type: 'general',
    });

    setEmsState('patients', patientId, {
      status: 'TRANSFERRED',
      caseId,
      handoffToCase: true,
    });

    this.emitEMSEvent('handoff_complete', { patientId, caseId });

    return handoffReport;
  },

  useInventory(itemId: string, quantity: number, patientId?: string, reason?: string) {
    const item = emsState.inventory[itemId];
    if (!item) return { success: false, error: 'Item not found' };
    
    if (item.quantity < quantity) {
      return { success: false, error: 'Insufficient stock' };
    }

    const now = new Date().toISOString();
    const newQuantity = item.quantity - quantity;
    
    batch(() => {
      setEmsState('inventory', itemId, {
        quantity: newQuantity,
        usedToday: item.usedToday + quantity,
        usageHistory: [
          ...item.usageHistory,
          {
            timestamp: now,
            patientId,
            medicId: emsState.currentUser?.id || 'UNKNOWN',
            quantity,
            reason: reason || 'Used in treatment',
          }
        ]
      });

      if (newQuantity <= item.minStock) {
        this.emitEMSEvent('low_stock', { itemId, currentStock: newQuantity });
      }
    });

    return { success: true };
  },

  restockInventory(itemId: string, quantity: number) {
    const item = emsState.inventory[itemId];
    if (!item) return;

    setEmsState('inventory', itemId, {
      quantity: item.quantity + quantity,
      lastRestocked: new Date().toISOString(),
    });
  },

  resetDailyUsage() {
    Object.keys(emsState.inventory).forEach(itemId => {
      setEmsState('inventory', itemId, 'usedToday', 0);
    });
  },

  assignUnitToCall(unitId: string, callId: string) {
    setEmsState('units', unitId, {
      status: 'EN_ROUTE',
      currentCall: callId,
    });
  },

  updateUnitStatus(unitId: string, status: EMSUnit['status']) {
    setEmsState('units', unitId, 'status', status);
  },

  getSortedPatients(): Patient[] {
    const patients = Object.values(emsState.patients);
    
    let filtered = patients;
    switch (emsState.activeFilter) {
      case 'TRIAGE':
        filtered = patients.filter(p => p.status === 'TRIAGE');
        break;
      case 'TREATMENT':
        filtered = patients.filter(p => p.status === 'IN_TREATMENT' || p.status === 'ADMITTED');
        break;
      case 'CRITICAL':
        filtered = patients.filter(p => p.triagePriority === 1);
        break;
      case 'MY_PATIENTS':
        const myId = emsState.currentUser?.id;
        filtered = patients.filter(p => 
          p.treatments.some(t => t.medicId === myId)
        );
        break;
    }

    return filtered.sort((a, b) => {
      switch (emsState.sortBy) {
        case 'PRIORITY':
          if (a.triagePriority !== b.triagePriority) {
            return a.triagePriority - b.triagePriority;
          }
          return new Date(a.triagedAt).getTime() - new Date(b.triagedAt).getTime();
        case 'TIME':
          return new Date(b.triagedAt).getTime() - new Date(a.triagedAt).getTime();
        case 'NAME':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  },

  getCriticalPatients(): Patient[] {
    return Object.values(emsState.patients)
      .filter(p => p.triagePriority === 1 && p.status !== 'DISCHARGED' && p.status !== 'TRANSFERRED')
      .sort((a, b) => new Date(a.triagedAt).getTime() - new Date(b.triagedAt).getTime());
  },

  getLowStockItems(): InventoryItem[] {
    return Object.values(emsState.inventory)
      .filter(item => item.quantity <= item.minStock);
  },

  selectPatient(patientId: string | null) {
    setEmsState('selectedPatient', patientId);
  },

  setFilter(filter: EMSState['activeFilter']) {
    setEmsState('activeFilter', filter);
  },

  setSortBy(sortBy: EMSState['sortBy']) {
    setEmsState('sortBy', sortBy);
  },

  emitEMSEvent(event: string, data: unknown) {
    if (typeof window !== 'undefined') {
      fetchNui(`cad:ems:${event}`, data).catch(console.error);
    }
    
    window.dispatchEvent(new CustomEvent(`ems:${event}`, {
      detail: data,
    }));
  },
};

if (typeof window !== 'undefined') {
  let lastPersistedPayload = '';

  const persistEmsState = () => {
    const payload = JSON.stringify({
      patients: emsState.patients,
      inventory: emsState.inventory,
      units: emsState.units,
    });

    if (payload === lastPersistedPayload) {
      return;
    }

    localStorage.setItem('cad_ems', payload);
    lastPersistedPayload = payload;
  };

  setInterval(() => {
    if (document.hidden) {
      return;
    }

    persistEmsState();
  }, 30000);

  window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persistEmsState();
    }
  });

  window.addEventListener('beforeunload', () => {
    persistEmsState();
  });

  const saved = localStorage.getItem('cad_ems');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      setEmsState({
        patients: parsed.patients || {},
        inventory: parsed.inventory || initialState.inventory,
        units: parsed.units || initialState.units,
      });
      lastPersistedPayload = saved;
    } catch (e) {
      console.error('[EMS] Failed to load saved data:', e);
    }
  }
}
