
import { createStore } from 'solid-js/store';
import { batch } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';
import { cadActions } from './cadStore';

export type PatientCondition = 'CRITICAL' | 'SERIOUS' | 'STABLE' | 'DECEASED';

export type PatientStatus =
  | 'TRIAGE'
  | 'ADMITTED'
  | 'IN_TREATMENT'
  | 'STABLE'
  | 'DISCHARGED'
  | 'TRANSFERRED'
  | 'DECEASED';

export type TriagePriority = 1 | 2 | 3 | 4;

export interface PatientVitals {
  bp: string;
  hr: number;
  temp: number;
  o2: number;
  rr?: number;
  pain?: number;
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
  citizenId?: string;
  dob?: string;
  gender?: 'M' | 'F' | 'OTHER';

  condition: PatientCondition;
  triagePriority: TriagePriority;
  chiefComplaint: string;
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

  caseId?: string;
  callId?: string;

  dischargeNotes?: string;
  dischargeDisposition?: 'HOME' | 'HOSPITAL' | 'POLICE' | 'MORGUE';
  handoffToCase?: boolean;
}

export interface SimplePrescription {
  medication: string;
  instructions: string;
}

export interface MedicalRecord {
  recordId: string;
  citizenId: string;
  citizenName: string;
  visitDate: string;
  diagnosis: string;
  treatmentSummary: string;
  prescriptions: SimplePrescription[];
  treatingMedic: string;
  treatingMedicName: string;
  vitalsSnapshot?: PatientVitals;
  notes?: string;
  createdAt: string;
}

export interface EMSUnit {
  unitId: string;
  unitType: 'AMBULANCE' | 'FIRE' | 'RESCUE' | 'SUPERVISOR';
  status: 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'TRANSPORTING' | 'AT_HOSPITAL' | 'BUSY';
  currentCall?: string;
  crew: string[];
  currentPatient?: string;
}

export interface EMSState {
  patients: Record<string, Patient>;
  units: Record<string, EMSUnit>;
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

  medicalHistory: MedicalRecord[];
  dischargePrescriptions: SimplePrescription[];
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
  currentUser: null,
  activeFilter: 'ALL',
  sortBy: 'PRIORITY',
  selectedPatient: null,
  selectedUnit: null,
  medicalHistory: [],
  dischargePrescriptions: [],
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
      citizenId: patientData.citizenId,
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

    setEmsState('patients', patientId, 'treatments',
      [...patient.treatments, newTreatment]
    );
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
Temp: ${patient.vitals.temp}\u00B0F
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

  selectPatient(patientId: string | null) {
    setEmsState('selectedPatient', patientId);
  },

  setFilter(filter: EMSState['activeFilter']) {
    setEmsState('activeFilter', filter);
  },

  setSortBy(sortBy: EMSState['sortBy']) {
    setEmsState('sortBy', sortBy);
  },

  addDischargePrescription(prescription: SimplePrescription) {
    setEmsState('dischargePrescriptions', prev => [...prev, prescription]);
  },

  removeDischargePrescription(index: number) {
    setEmsState('dischargePrescriptions', prev => prev.filter((_, i) => i !== index));
  },

  clearDischargePrescriptions() {
    setEmsState('dischargePrescriptions', []);
  },

  async fetchMedicalHistory(citizenId: string) {
    try {
      const response = await fetchNui<{
        ok: boolean;
        records?: MedicalRecord[];
      }>('cad:ems:getMedicalHistory', { citizenId });

      if (response?.ok && Array.isArray(response.records)) {
        setEmsState('medicalHistory', response.records);
      } else {
        setEmsState('medicalHistory', []);
      }
    } catch {
      setEmsState('medicalHistory', []);
    }
  },

  async createMedicalRecord(patient: Patient, prescriptions: SimplePrescription[], dischargeNotes?: string): Promise<boolean> {
    const citizenId = patient.citizenId;
    if (!citizenId) return false;

    const treatmentSummary = patient.treatments
      .map(t => `${t.action} (${t.medications.join(', ')}) - ${t.notes}`)
      .join('\n') || 'No treatments recorded';

    const lastVitals = patient.vitalsHistory.length > 0
      ? patient.vitalsHistory[patient.vitalsHistory.length - 1].vitals
      : patient.vitals;

    const record: Omit<MedicalRecord, 'recordId' | 'createdAt'> = {
      citizenId,
      citizenName: patient.name,
      visitDate: new Date().toISOString(),
      diagnosis: `${patient.chiefComplaint}${dischargeNotes ? ` - ${dischargeNotes}` : ''}`,
      treatmentSummary,
      prescriptions,
      treatingMedic: emsState.currentUser?.id || 'UNKNOWN',
      treatingMedicName: emsState.currentUser?.name || 'Unknown',
      vitalsSnapshot: lastVitals,
      notes: dischargeNotes,
    };

    try {
      const response = await fetchNui<{ ok: boolean }>('cad:ems:createMedicalRecord', record);
      return response?.ok === true;
    } catch {
      return false;
    }
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

let emsPersistInterval: number | null = null;
let emsVisibilityHandler: (() => void) | null = null;
let emsUnloadHandler: (() => void) | null = null;

if (typeof window !== 'undefined') {
  let lastPersistedPayload = '';

  const persistEmsState = () => {
    const payload = JSON.stringify({
      patients: emsState.patients,
      units: emsState.units,
    });

    if (payload === lastPersistedPayload) {
      return;
    }

    localStorage.setItem('cad_ems', payload);
    lastPersistedPayload = payload;
  };

  emsPersistInterval = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    persistEmsState();
  }, 30000);

  emsVisibilityHandler = () => {
    if (document.hidden) {
      persistEmsState();
    }
  };

  emsUnloadHandler = () => {
    persistEmsState();
  };

  window.addEventListener('visibilitychange', emsVisibilityHandler);
  window.addEventListener('beforeunload', emsUnloadHandler);

  const saved = localStorage.getItem('cad_ems');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      setEmsState({
        patients: parsed.patients || {},
        units: parsed.units || initialState.units,
      });
      lastPersistedPayload = saved;
    } catch (e) {
      console.error('[EMS] Failed to load saved data:', e);
    }
  }
}

export function cleanupEmsTimers() {
  if (emsPersistInterval !== null) {
    clearInterval(emsPersistInterval);
    emsPersistInterval = null;
  }
  if (emsVisibilityHandler) {
    window.removeEventListener('visibilitychange', emsVisibilityHandler);
    emsVisibilityHandler = null;
  }
  if (emsUnloadHandler) {
    window.removeEventListener('beforeunload', emsUnloadHandler);
    emsUnloadHandler = null;
  }
}
