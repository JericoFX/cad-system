import { 
  mockCases, 
  mockStagingEvidence, 
  mockCaseEvidence, 
  mockDispatchUnits, 
  mockDispatchCalls,
  mockPersons,
  mockVehicles,
  mockWarrants,
  mockCriminalRecords,
  mockBOLOs
} from './mockData';
import { cadActions } from '../stores/cadStore';
import type {
  Case,
  DispatchCall,
  DispatchUnit,
  Evidence,
  Fine,
  StagingEvidence,
} from '../stores/cadStore';

let currentUser = 'OFFICER_101';
let badgeNumber = 'B-101';
const mockFines: Record<string, Fine> = {};
const mockEmsAlerts: Array<Record<string, unknown>> = [];

const mockReaderContext = {
  ok: true,
  terminalId: 'mrpd_frontdesk',
  label: 'MRPD Front Desk PC',
  hasContainer: true,
  hasReader: true,
  reader: {
    enabled: true,
    stashId: 'cad_id_reader_mrpd_frontdesk',
    readSlot: 1,
  },
  container: {
    enabled: true,
    stashId: 'cad_evidence_mrpd_frontdesk',
  },
};

const mockReaderDocument = {
  name: 'id_card',
  slot: 1,
  metadata: {
    info: {
      citizenid: 'CID001',
      firstname: 'John',
      lastname: 'Doe',
      birthdate: '1990-01-15',
      gender: 'M',
      nationality: 'US-SSN-101010',
      phone: '555-0101',
      address: '101 Vinewood Blvd',
      bloodtype: 'O+',
    },
  },
};

type MockBloodRequest = {
  requestId: string;
  caseId?: string;
  citizenId?: string;
  personName: string;
  reason: string;
  location?: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
  requestedBy: string;
  requestedByName: string;
  requestedByJob: string;
  requestedAt: string;
  handledBy?: string;
  handledByName?: string;
  handledAt?: string;
  notes?: string;
};

const mockBloodRequests: MockBloodRequest[] = [
  {
    requestId: 'BLOODREQ_MOCK_001',
    caseId: 'CASE_001',
    citizenId: 'CID003',
    personName: 'Michael Johnson',
    reason: 'Possible DUI and forensic comparison needed',
    location: 'Pillbox Emergency Intake',
    status: 'PENDING',
    requestedBy: 'OFFICER_101',
    requestedByName: 'Officer John Martinez',
    requestedByJob: 'police',
    requestedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    notes: '',
  },
];

const mockEmsUnits: Record<string, Record<string, unknown>> = {
  EMS_01: {
    unitId: 'EMS_01',
    unitType: 'AMBULANCE',
    status: 'AVAILABLE',
    crew: ['EMS_101'],
  },
};

const asRecord = (data: unknown): Record<string, unknown> => {
  if (typeof data === 'object' && data !== null) {
    return data as Record<string, unknown>;
  }
  return {};
};

const asString = (data: unknown): string => (typeof data === 'string' ? data : '');

const mockHandlers: Record<string, (data: unknown) => unknown> = {
  'cad:createCase': (data: unknown) => {
    const payload = asRecord(data);
    const caseId = `CASE_${Date.now().toString(36).toUpperCase()}`;
    const newCase: Case = {
      caseId,
      caseType: typeof payload.caseType === 'string' ? payload.caseType : 'GENERAL',
      title: typeof payload.title === 'string' ? payload.title : 'Untitled Case',
      description: typeof payload.description === 'string' ? payload.description : '',
      status: 'OPEN',
      priority: typeof payload.priority === 'number' ? payload.priority : 2,
      createdBy: currentUser,
      assignedTo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
      evidence: [],
      tasks: [],
    };
    mockCases[caseId] = newCase;
    return newCase;
  },
  
  'cad:getCase': (data: unknown) => {
    const caseId = asString(data);
    return mockCases[caseId] || null;
  },
  
  'cad:searchCases': (data: unknown) => {
    const filters = asRecord(data);
    let results = Object.values(mockCases);
    
    if (filters?.status) {
      results = results.filter(c => c.status === filters.status);
    }
    if (filters?.caseType) {
      results = results.filter(c => c.caseType === filters.caseType);
    }
    if (filters?.priority) {
      results = results.filter(c => c.priority === filters.priority);
    }
    if (filters?.searchTerm) {
      const term = String(filters.searchTerm).toLowerCase();
      results = results.filter(c => 
        c.title.toLowerCase().includes(term) ||
        c.caseId.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term)
      );
    }
    
    return Object.fromEntries(results.map(c => [c.caseId, c]));
  },
  
  'cad:updateCase': (data: unknown) => {
    const payload = asRecord(data);
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const { caseId: _, ...updates } = payload;
    if (mockCases[caseId]) {
      mockCases[caseId] = {
        ...mockCases[caseId],
        ...(updates as Partial<Case>),
        updatedAt: new Date().toISOString(),
      };
      return mockCases[caseId];
    }
    return null;
  },
  
  'cad:closeCase': (data: unknown) => {
    const caseId = asString(data);
    if (mockCases[caseId]) {
      mockCases[caseId].status = 'CLOSED';
      mockCases[caseId].updatedAt = new Date().toISOString();
      return mockCases[caseId];
    }
    return null;
  },

  'cad:getComputerContext': () => {
    return mockReaderContext;
  },

  'cad:idreader:read': () => {
    const info = mockReaderDocument.metadata.info;

    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      stashId: 'cad_id_reader_mrpd_frontdesk',
      item: {
        name: mockReaderDocument.name,
        slot: mockReaderDocument.slot,
      },
      source: 'qb-inventory-info',
      metadata: mockReaderDocument.metadata,
      person: {
        citizenid: info.citizenid,
        firstName: info.firstname,
        lastName: info.lastname,
        dateOfBirth: info.birthdate,
        ssn: info.nationality,
        phone: info.phone,
        address: info.address,
        bloodType: info.bloodtype,
        gender: 'MALE',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isDead: false,
      },
    };
  },
  
  'cad:addEvidenceToStaging': (data: unknown) => {
    const payload = asRecord(data);
    const stagingId = `STAGE_${Date.now().toString(36).toUpperCase()}`;
    const evidence: StagingEvidence = {
      stagingId,
      evidenceType:
        typeof payload.evidenceType === 'string' ? payload.evidenceType : 'PHOTO',
      data: (payload.data as Record<string, unknown>) || {},
      createdAt: new Date().toISOString(),
    };
    mockStagingEvidence.push(evidence);
    cadActions.addStagingEvidence(evidence);
    console.log(`[mockNUI] Added staging evidence: ${stagingId}, Total: ${mockStagingEvidence.length}`);
    return evidence;
  },
  
  'cad:getStagingEvidence': () => {
    return mockStagingEvidence.slice(0, 5);
  },
  
  'cad:removeFromStaging': (data: unknown) => {
    const stagingId = asString(data);
    const index = mockStagingEvidence.findIndex(e => e.stagingId === stagingId);
    if (index > -1) {
      mockStagingEvidence.splice(index, 1);
      return true;
    }
    return false;
  },
  
  'cad:attachEvidence': (data: unknown) => {
    const payload = asRecord(data);
    const stagingId = typeof payload.stagingId === 'string' ? payload.stagingId : '';
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const stagingItem = mockStagingEvidence.find(e => e.stagingId === stagingId);
    
    if (!stagingItem || !mockCases[caseId]) {
      throw new Error('Staging item or case not found');
    }
    
    const evidenceId = `EVID_${Date.now().toString(36).toUpperCase()}`;
    const evidence: Evidence = {
      evidenceId,
      caseId,
      evidenceType: stagingItem.evidenceType,
      data: stagingItem.data,
      attachedBy: currentUser,
      attachedAt: new Date().toISOString(),
      custodyChain: [],
    };
    
    if (!mockCaseEvidence[caseId]) {
      mockCaseEvidence[caseId] = [];
    }
    mockCaseEvidence[caseId].push(evidence);
    
    const index = mockStagingEvidence.findIndex(e => e.stagingId === stagingId);
    if (index > -1) {
      mockStagingEvidence.splice(index, 1);
    }
    
    return evidence;
  },
  
  'cad:getCaseEvidence': (data: unknown) => {
    const caseId = asString(data);
    return mockCaseEvidence[caseId] || [];
  },
  
  'cad:getDispatchSettings': () => {
    return {
      profileName: 'standard',
      refreshIntervalMs: 8000,
      clockTickMs: 15000,
      callTypeOptions: ['GENERAL', '10-31', '10-50', '10-71', 'MEDICAL'],
      sla: {
        enabled: true,
        pending: {
          warningMinutes: { p1: 2, p2: 4, p3: 6, default: 4 },
          breachMinutes: { p1: 7, p2: 8, p3: 9, default: 8 },
        },
        active: {
          warningMinutes: { p1: 9, p2: 10, p3: 11, default: 10 },
          breachMinutes: { p1: 19, p2: 20, p3: 21, default: 20 },
        },
      },
      autoAssignment: {
        enabled: true,
        distanceMetersPerPenaltyPoint: 70,
        unknownDistancePenalty: 15,
        servicePenalties: {
          needsEmsButNotEms: 40,
          nonMedicalEms: 25,
        },
      },
    };
  },

  'cad:registerDispatchUnit': (data: unknown) => {
    const payload = asRecord(data);
    const unitId =
      (typeof payload.unitId === 'string' && payload.unitId) ||
      `UNIT_${Date.now().toString(36).toUpperCase()}`;
    const unit: DispatchUnit = {
      unitId,
      badge: badgeNumber,
      name: `Officer ${currentUser}`,
      status:
        payload.status === 'AVAILABLE' || payload.status === 'BUSY' || payload.status === 'OFF_DUTY'
          ? payload.status
          : 'AVAILABLE',
      type: typeof payload.type === 'string' ? payload.type : 'PATROL',
      location:
        typeof payload.location === 'object' && payload.location !== null
          ? (payload.location as { x: number; y: number; z: number })
          : undefined,
    };
    mockDispatchUnits[unitId] = unit;
    return unit;
  },
  
  'cad:getDispatchUnits': (data: unknown) => {
    const filter = asRecord(data);
    let results = { ...mockDispatchUnits };
    
    if (filter?.status) {
      results = Object.fromEntries(
        Object.entries(results).filter(([_, u]) => u.status === filter.status)
      );
    }
    if (filter?.type) {
      results = Object.fromEntries(
        Object.entries(results).filter(([_, u]) => u.type === filter.type)
      );
    }
    
    return results;
  },
  
  'cad:updateUnitStatus': (data: unknown) => {
    const payload = asRecord(data);
    const unitId = typeof payload.unitId === 'string' ? payload.unitId : '';
    const status = payload.status;
    const location = payload.location;
    if (mockDispatchUnits[unitId]) {
      if (status === 'AVAILABLE' || status === 'BUSY' || status === 'OFF_DUTY') {
        mockDispatchUnits[unitId].status = status;
      }
      if (typeof location === 'object' && location !== null) {
        mockDispatchUnits[unitId].location = location as { x: number; y: number; z: number };
      }
      return mockDispatchUnits[unitId];
    }
    return null;
  },
  
  'cad:createDispatchCall': (data: unknown) => {
    const payload = asRecord(data);
    const callId = `CALL_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${Date.now().toString(36).toUpperCase()}`;
    const call: DispatchCall = {
      callId,
      type: typeof payload.type === 'string' ? payload.type : 'GENERAL',
      priority: typeof payload.priority === 'number' ? payload.priority : 2,
      title: typeof payload.title === 'string' ? payload.title : 'New Call',
      description: typeof payload.description === 'string' ? payload.description : '',
      location: typeof payload.location === 'string' ? payload.location : undefined,
      coordinates:
        typeof payload.coordinates === 'object' && payload.coordinates !== null
          ? (payload.coordinates as { x: number; y: number; z: number })
          : undefined,
      status: 'PENDING',
      assignedUnits: {},
      createdAt: new Date().toISOString(),
    };
    mockDispatchCalls[callId] = call;
    return call;
  },
  
  'cad:getDispatchCalls': (data: unknown) => {
    const filter = asRecord(data);
    let results = { ...mockDispatchCalls };
    
    if (filter?.status) {
      results = Object.fromEntries(
        Object.entries(results).filter(([_, c]) => c.status === filter.status)
      );
    }
    if (filter?.priority) {
      results = Object.fromEntries(
        Object.entries(results).filter(([_, c]) => c.priority === parseInt(String(filter.priority), 10))
      );
    }
    
    return results;
  },
  
  'cad:assignUnitToCall': (data: unknown) => {
    const payload = asRecord(data);
    const callId = typeof payload.callId === 'string' ? payload.callId : '';
    const unitId = typeof payload.unitId === 'string' ? payload.unitId : '';
    const call = mockDispatchCalls[callId];
    const unit = mockDispatchUnits[unitId];
    
    if (!call || !unit) {
      throw new Error('Call or unit not found');
    }
    
    call.assignedUnits[unitId] = { assignedAt: new Date().toISOString() };
    unit.currentCall = callId;
    unit.status = 'BUSY';
    if (call.status === 'PENDING') {
      call.status = 'ACTIVE';
    }
    
    return call;
  },
  
  'cad:unassignUnitFromCall': (data: unknown) => {
    const payload = asRecord(data);
    const callId = typeof payload.callId === 'string' ? payload.callId : '';
    const unitId = typeof payload.unitId === 'string' ? payload.unitId : '';
    const call = mockDispatchCalls[callId];
    const unit = mockDispatchUnits[unitId];
    
    if (!call || !unit) {
      throw new Error('Call or unit not found');
    }
    
    delete call.assignedUnits[unitId];
    unit.currentCall = undefined;
    unit.status = 'AVAILABLE';
    
    if (Object.keys(call.assignedUnits).length === 0 && call.status === 'ACTIVE') {
      call.status = 'PENDING';
    }
    
    return call;
  },
  
  'cad:closeDispatchCall': (data: unknown) => {
    const payload = asRecord(data);
    const callId = typeof payload.callId === 'string' ? payload.callId : '';
    const resolution = typeof payload.resolution === 'string' ? payload.resolution : undefined;
    const call = mockDispatchCalls[callId];
    
    if (!call) {
      throw new Error('Call not found');
    }
    
    for (const unitId in call.assignedUnits) {
      const unit = mockDispatchUnits[unitId];
      if (unit) {
        unit.currentCall = undefined;
        unit.status = 'AVAILABLE';
      }
    }
    
    call.status = 'CLOSED';
    (call as any).resolution = resolution || 'Completed';
    (call as any).closedAt = new Date().toISOString();
    
    return call;
  },
  
  'cad:getNearestUnit': (data: unknown) => {
    const coordinates = asRecord(data) as { x?: number; y?: number; z?: number };
    if (!coordinates) return null;
    if (
      typeof coordinates.x !== 'number' ||
      typeof coordinates.y !== 'number' ||
      typeof coordinates.z !== 'number'
    ) {
      return null;
    }
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const unit of Object.values(mockDispatchUnits)) {
      if (unit.status === 'AVAILABLE' && unit.location) {
        const dx = unit.location.x - coordinates.x;
        const dy = unit.location.y - coordinates.y;
        const dz = unit.location.z - coordinates.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = unit;
        }
      }
    }
    
    return nearest;
  },

  'cad:getFineCatalog': () => {
    return [
      { code: 'T001', description: 'Speeding (10-20 over)', amount: 150, jailTime: 0 },
      { code: 'T002', description: 'Speeding (20+ over)', amount: 300, jailTime: 0 },
      { code: 'C003', description: 'Assault', amount: 1500, jailTime: 20 },
      { code: 'W001', description: 'Illegal Weapon Possession', amount: 3000, jailTime: 30 },
    ];
  },

  'cad:createFine': (data: unknown) => {
    const payload = asRecord(data);
    const fineId = `FINE_${Date.now().toString(36).toUpperCase()}`;
    const fine: Fine = {
      fineId,
      targetType: payload.targetType === 'VEHICLE' ? 'VEHICLE' : 'PERSON',
      targetId: typeof payload.targetId === 'string' ? payload.targetId : 'UNKNOWN',
      targetName: typeof payload.targetName === 'string' ? payload.targetName : 'Unknown',
      fineCode: typeof payload.fineCode === 'string' ? payload.fineCode : 'UNK',
      description: typeof payload.description === 'string' ? payload.description : 'No description',
      amount: typeof payload.amount === 'number' ? payload.amount : 0,
      jailTime: typeof payload.jailTime === 'number' ? payload.jailTime : 0,
      issuedBy: currentUser,
      issuedByName: `Officer ${currentUser}`,
      issuedAt: new Date().toISOString(),
      paid: false,
      isBail: payload.isBail === true,
      status: 'PENDING',
    };
    mockFines[fineId] = fine;
    cadActions.addFine(fine);
    return fine;
  },

  'cad:getFines': (data: unknown) => {
    const payload = asRecord(data);
    const targetId = typeof payload.targetId === 'string' ? payload.targetId : null;
    const mine = payload.mine === true;

    let rows = Object.values(mockFines);
    if (targetId) {
      rows = rows.filter((fine) => fine.targetId === targetId);
    }
    if (mine) {
      rows = rows.filter((fine) => fine.targetId === currentUser);
    }
    return rows;
  },

  'cad:payFine': (data: unknown) => {
    const payload = asRecord(data);
    const fineId = typeof payload.fineId === 'string' ? payload.fineId : '';
    const fine = mockFines[fineId];
    if (!fine) throw new Error('Fine not found');

    fine.paid = true;
    fine.paidAt = new Date().toISOString();
    fine.paidMethod = payload.method === 'CASH' ? 'CASH' : 'BANK';
    fine.status = 'PAID';
    cadActions.updateFine(fine.fineId, fine);
    return fine;
  },

  'cad:payFineByTicket': (data: unknown) => {
    const payload = asRecord(data);
    const fineId = typeof payload.fineId === 'string' ? payload.fineId : '';
    const fine = mockFines[fineId];
    if (!fine) throw new Error('Fine not found');

    fine.paid = true;
    fine.paidAt = new Date().toISOString();
    fine.paidMethod = 'BANK';
    fine.status = 'PAID';
    cadActions.updateFine(fine.fineId, fine);
    return fine;
  },

  'cad:ems:getUnits': () => {
    return mockEmsUnits;
  },

  'cad:ems:getAlerts': () => {
    return mockEmsAlerts;
  },

  'cad:ems:createAlert': (data: unknown) => {
    const payload = asRecord(data);
    const alert = {
      alertId: `EMSALERT_${Date.now().toString(36).toUpperCase()}`,
      title: typeof payload.title === 'string' ? payload.title : 'Medical Alert',
      description: typeof payload.description === 'string' ? payload.description : '',
      severity: typeof payload.severity === 'string' ? payload.severity : 'MEDIUM',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mockEmsAlerts.unshift(alert);
    return alert;
  },

  'cad:ems:updateUnit': (data: unknown) => {
    const payload = asRecord(data);
    const unitId = typeof payload.unitId === 'string' ? payload.unitId : '';
    if (!mockEmsUnits[unitId]) throw new Error('Unit not found');
    mockEmsUnits[unitId] = {
      ...mockEmsUnits[unitId],
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    return mockEmsUnits[unitId];
  },

  'cad:ems:critical_patient': (data: unknown) => {
    const payload = asRecord(data);
    const alert = {
      alertId: `EMSALERT_${Date.now().toString(36).toUpperCase()}`,
      title: `Critical Patient: ${typeof payload.patientName === 'string' ? payload.patientName : 'Unknown'}`,
      description: typeof payload.patientId === 'string' ? payload.patientId : 'N/A',
      severity: 'HIGH',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mockEmsAlerts.unshift(alert);
    return alert;
  },

  'cad:ems:low_stock': (data: unknown) => {
    const payload = asRecord(data);
    const alert = {
      alertId: `EMSALERT_${Date.now().toString(36).toUpperCase()}`,
      title: `Low Stock: ${typeof payload.itemId === 'string' ? payload.itemId : 'Unknown'}`,
      description: `Current: ${String(payload.currentStock ?? 'N/A')}`,
      severity: 'MEDIUM',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mockEmsAlerts.unshift(alert);
    return alert;
  },

  'cad:ems:handoff_complete': (data: unknown) => {
    const payload = asRecord(data);
    const alert = {
      alertId: `EMSALERT_${Date.now().toString(36).toUpperCase()}`,
      title: 'Medical handoff completed',
      description: `Patient ${String(payload.patientId ?? 'N/A')} -> Case ${String(payload.caseId ?? 'N/A')}`,
      severity: 'LOW',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mockEmsAlerts.unshift(alert);
    return alert;
  },

  'cad:ems:createBloodRequest': (data: unknown) => {
    const payload = asRecord(data);
    const now = new Date().toISOString();
    const request: MockBloodRequest = {
      requestId: `BLOODREQ_${Date.now().toString(36).toUpperCase()}`,
      caseId: typeof payload.caseId === 'string' && payload.caseId.trim() !== '' ? payload.caseId : undefined,
      citizenId: typeof payload.citizenId === 'string' && payload.citizenId.trim() !== '' ? payload.citizenId : undefined,
      personName: typeof payload.personName === 'string' && payload.personName.trim() !== '' ? payload.personName : 'UNKNOWN',
      reason: typeof payload.reason === 'string' && payload.reason.trim() !== '' ? payload.reason : 'Blood sample requested by police',
      location: typeof payload.location === 'string' ? payload.location : undefined,
      status: 'PENDING',
      requestedBy: currentUser,
      requestedByName: `Officer ${currentUser}`,
      requestedByJob: 'police',
      requestedAt: now,
      notes: '',
    };

    mockBloodRequests.unshift(request);
    mockEmsAlerts.unshift({
      alertId: `EMSALERT_${Date.now().toString(36).toUpperCase()}`,
      title: `Blood Sample Request: ${request.personName}`,
      description: `${request.requestId} | ${request.reason}`,
      severity: 'MEDIUM',
      status: 'ACTIVE',
      createdAt: now,
    });

    return { ok: true, request };
  },

  'cad:ems:getBloodRequests': (data: unknown) => {
    const payload = asRecord(data);
    const requestedStatus = typeof payload.status === 'string' ? payload.status.toUpperCase() : '';
    const rows = requestedStatus
      ? mockBloodRequests.filter((r) => r.status === requestedStatus)
      : mockBloodRequests;

    return { ok: true, requests: rows };
  },

  'cad:ems:updateBloodRequest': (data: unknown) => {
    const payload = asRecord(data);
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
    const status = typeof payload.status === 'string' ? payload.status.toUpperCase() : '';
    const notes = typeof payload.notes === 'string' ? payload.notes : '';

    const request = mockBloodRequests.find((r) => r.requestId === requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (!['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(status)) {
      throw new Error('Invalid status');
    }

    request.status = status as MockBloodRequest['status'];
    request.handledBy = currentUser;
    request.handledByName = `EMS ${currentUser}`;
    request.handledAt = new Date().toISOString();
    request.notes = notes;

    return { ok: true, request };
  },
};

export function initializeMockNUI(): void {
  // Hook simple para simular callbacks NUI en navegador.
  const originalFetch = window.fetch;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    
    if (url.startsWith('https://cad-system/')) {
      const eventName = url.replace('https://cad-system/', '');
      const handler = mockHandlers[eventName];
      
      if (handler) {
        // Delay cortito para que se sienta mas real.
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        let data: unknown;
        if (init?.body) {
          try {
            data = JSON.parse(init.body as string);
          } catch {
            data = {};
          }
        }
        
        try {
          const result = handler(data);
          return new Response(JSON.stringify({ data: result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ error: (error as Error).message }), 
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ error: 'Unknown NUI event' }), 
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return originalFetch(input, init);
  };
  
  console.log('[MOCK] NUI mock system initialized');
  console.log('[MOCK] Available mock data:');
  console.log(`  - Cases: ${Object.keys(mockCases).length}`);
  console.log(`  - Staging Evidence: ${mockStagingEvidence.length}`);
  console.log(`  - Dispatch Units: ${Object.keys(mockDispatchUnits).length}`);
  console.log(`  - Dispatch Calls: ${Object.keys(mockDispatchCalls).length}`);
  console.log(`  - Persons: ${mockPersons.length}`);
  console.log(`  - Vehicles: ${mockVehicles.length}`);
  console.log(`  - Warrants: ${mockWarrants.length}`);
  console.log(`  - Criminal Records: ${mockCriminalRecords.length}`);
  console.log(`  - BOLOs: ${mockBOLOs.length}`);
  
  cadActions.setCases(mockCases);
  cadActions.setDispatchUnits(mockDispatchUnits);
  cadActions.setDispatchCalls(mockDispatchCalls);
  
  const personsRecord = Object.fromEntries(mockPersons.map(p => [p.citizenid, p]));
  const vehiclesRecord = Object.fromEntries(mockVehicles.map(v => [v.plate, v]));
  const warrantsRecord = Object.fromEntries(mockWarrants.map(w => [w.warrantId, w]));
  const recordsRecord = Object.fromEntries(mockCriminalRecords.map(r => [r.recordId, r]));
  const bolosRecord = Object.fromEntries(mockBOLOs.map(b => [b.boloId, b]));
  
  cadActions.setPersons(personsRecord);
  cadActions.setVehicles(vehiclesRecord);
  cadActions.setWarrants(warrantsRecord);
  cadActions.setCriminalRecords(recordsRecord);
  cadActions.setBOLOs(bolosRecord);
  
  console.log('[MOCK] Synced all mock data to store');
}

export function setMockUser(userId: string, badge: string): void {
  currentUser = userId;
  badgeNumber = badge;
}

export function getMockStats() {
  return {
    cases: Object.keys(mockCases).length,
    stagingEvidence: mockStagingEvidence.length,
    caseEvidence: Object.values(mockCaseEvidence).reduce((sum, arr) => sum + arr.length, 0),
    units: Object.keys(mockDispatchUnits).length,
    calls: Object.keys(mockDispatchCalls).length,
  };
}
