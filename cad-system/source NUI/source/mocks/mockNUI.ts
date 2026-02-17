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
const mockForensicAnalyses: Record<string, Record<string, unknown>> = {};
const mockJailTransfers: Array<Record<string, unknown>> = [];

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

const buildForensicMockPayload = (evidenceType: string, payload: Record<string, unknown>) => {
  const normalized = evidenceType.toUpperCase();
  if (normalized === 'DNA' || normalized === 'BIOLOGICAL') {
    return {
      description: typeof payload.description === 'string' ? payload.description : 'DNA sample collected',
      labStatus: 'IN_ANALYSIS',
      sampleType: 'Touch DNA',
      sampleSource: 'Door handle',
      dnaHash: `DNA_${Date.now().toString(36).toUpperCase()}`,
      profile: 'Partial profile ready',
      collectedBy: currentUser,
      collectedAt: new Date().toISOString(),
    };
  }

  if (normalized === 'BLOOD') {
    return {
      description: typeof payload.description === 'string' ? payload.description : 'Blood sample collected',
      labStatus: 'IN_ANALYSIS',
      bloodType: typeof payload.bloodType === 'string' ? payload.bloodType : 'O+',
      sampleType: 'Blood drop',
      sampleSource: 'Scene floor',
      collectedBy: currentUser,
      collectedAt: new Date().toISOString(),
    };
  }

  if (normalized === 'FINGERPRINT') {
    return {
      description: typeof payload.description === 'string' ? payload.description : 'Fingerprint lifted from scene',
      quality: typeof payload.quality === 'number' ? payload.quality : 75,
      pattern: 'loop',
      collectedBy: currentUser,
      collectedAt: new Date().toISOString(),
    };
  }

  return {
    description: typeof payload.description === 'string' ? payload.description : 'Forensic sample collected',
    collectedBy: currentUser,
    collectedAt: new Date().toISOString(),
  };
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

  'cad:forensic:checkInLab': () => ({
    enabled: true,
    inLab: true,
  }),

  'cad:forensic:getPendingEvidence': (data: unknown) => {
    const payload = asRecord(data);
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    if (!caseId) return [];
    return mockCaseEvidence[caseId] || [];
  },

  'cad:forensic:collectEvidence': (data: unknown) => {
    const payload = asRecord(data);
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const evidenceType = typeof payload.evidenceType === 'string' ? payload.evidenceType.toUpperCase() : 'DNA';

    if (!caseId || !mockCases[caseId]) {
      return { ok: false, error: 'case_not_found' };
    }

    const evidenceId = `EVID_${Date.now().toString(36).toUpperCase()}`;
    const forensicPayload = buildForensicMockPayload(evidenceType, payload);
    const evidence: Evidence = {
      evidenceId,
      caseId,
      evidenceType,
      data: forensicPayload,
      attachedBy: currentUser,
      attachedAt: new Date().toISOString(),
      custodyChain: [
        {
          eventId: `CUST_${Date.now().toString(36).toUpperCase()}`,
          evidenceId,
          eventType: 'COLLECTED',
          location: 'Crime Scene',
          timestamp: new Date().toISOString(),
          recordedBy: currentUser,
          notes: 'Collected and logged by forensic unit',
        },
      ],
      currentLocation: 'Forensic Locker',
      currentCustodian: currentUser,
    };

    if (!mockCaseEvidence[caseId]) {
      mockCaseEvidence[caseId] = [];
    }
    mockCaseEvidence[caseId].push(evidence);
    mockCases[caseId].evidence = mockCaseEvidence[caseId];
    cadActions.addCaseEvidence(caseId, evidence);

    return { ok: true, evidence };
  },

  'cad:forensic:analyzeEvidence': (data: unknown) => {
    const payload = asRecord(data);
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const evidenceId = typeof payload.evidenceId === 'string' ? payload.evidenceId : '';

    if (!caseId || !evidenceId) {
      return { ok: false, error: 'invalid_payload' };
    }

    const analysisId = `ANL_${Date.now().toString(36).toUpperCase()}`;
    const analysis = {
      analysisId,
      caseId,
      evidenceId,
      startedBy: currentUser,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
    };

    mockForensicAnalyses[analysisId] = analysis;
    return analysis;
  },

  'cad:forensic:completeAnalysis': (data: unknown) => {
    const payload = asRecord(data);
    const analysisId = typeof payload.analysisId === 'string' ? payload.analysisId : '';
    const analysis = mockForensicAnalyses[analysisId];

    if (!analysis) {
      return { ok: false, error: 'analysis_not_found' };
    }

    analysis.status = 'COMPLETED';
    analysis.completedBy = currentUser;
    analysis.completedAt = new Date().toISOString();
    analysis.result = payload.result || {
      confidence: 91,
      summary: 'Mock forensic match generated',
    };

    return analysis;
  },

  'cad:forensic:getAnalysisResults': (data: unknown) => {
    const payload = asRecord(data);
    const evidenceId = typeof payload.evidenceId === 'string' ? payload.evidenceId : '';
    const values = Object.values(mockForensicAnalyses);

    if (!evidenceId) {
      return values;
    }

    return values.filter((entry) => entry.evidenceId === evidenceId);
  },

  'cad:forensic:compareEvidence': (data: unknown) => {
    const payload = asRecord(data);
    return {
      ok: true,
      evidenceA: payload.evidenceA,
      evidenceB: payload.evidenceB,
      confidence: 88,
      summary: 'Mock comparison complete',
    };
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

  'cad:police:getJailTransfers': () => {
    return {
      ok: true,
      transfers: [...mockJailTransfers].sort((a, b) => {
        const aDate = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
        const bDate = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
        return bDate - aDate;
      }),
    };
  },

  'cad:police:logJailTransfer': (data: unknown) => {
    const payload = asRecord(data);
    const citizenId = typeof payload.citizenId === 'string' ? payload.citizenId.trim() : '';
    const personName = typeof payload.personName === 'string' ? payload.personName.trim() : '';
    const jailMonths = Number(payload.jailMonths || 0);

    if (!citizenId || !personName || !Number.isFinite(jailMonths) || jailMonths <= 0) {
      return { ok: false, error: 'invalid_payload' };
    }

    const transfer = {
      transferId: `JAIL_${Date.now().toString(36).toUpperCase()}`,
      citizenId,
      personName,
      caseId: typeof payload.caseId === 'string' && payload.caseId.trim() ? payload.caseId.trim() : undefined,
      jailMonths: Math.floor(jailMonths),
      reason: typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : 'No reason provided',
      facility: typeof payload.facility === 'string' && payload.facility.trim() ? payload.facility.trim() : 'Bolingbroke Penitentiary',
      notes: typeof payload.notes === 'string' ? payload.notes : '',
      createdBy: currentUser,
      createdByName: `Officer ${currentUser}`,
      createdAt: new Date().toISOString(),
    };

    mockJailTransfers.unshift(transfer);
    return { ok: true, transfer };
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

  // Mock vehicle data for radar simulation
  const mockRadarData = [
    {
      id: 1,
      coords: { x: 450.5, y: -980.2, z: 29.6 },
      distance: 25.7,
      isWanted: false
    },
    {
      id: 2,
      coords: { x: 465.8, y: -995.4, z: 29.8 },
      distance: 42.1,
      isWanted: true
    }
  ];

  // Mock person data for ID search
  const mockPersonsData = [
    {
      citizenId: 'CIT-123456',
      name: 'John Doe',
      dob: '1985-07-15',
      address: '123 Main St, Los Santos',
      phone: '555-1234',
      warrants: [
        { id: 'W-001', type: 'Speeding', date: '2024-02-10' },
        { id: 'W-002', type: 'Theft', date: '2024-01-15' }
      ],
      vehicles: [
        { plate: 'ABC123', model: 'police', color: 'Black and White' },
        { plate: 'XYZ789', model: 'blista', color: 'Blue' }
      ],
      notes: [
        { id: 'N-001', content: 'Suspected drug dealer', timestamp: '2024-02-12T14:30:00Z' },
        { id: 'N-002', content: 'Known associate of gang', timestamp: '2024-01-20T09:15:00Z' }
      ]
    },
    {
      citizenId: 'CIT-789012',
      name: 'Jane Smith',
      dob: '1992-11-23',
      address: '456 Oak Ave, Los Santos',
      phone: '555-5678',
      warrants: [],
      vehicles: [
        { plate: 'DEF456', model: 'sultan', color: 'Red' }
      ],
      notes: [
        { id: 'N-003', content: 'Witness to robbery', timestamp: '2024-02-15T11:20:00Z' }
      ]
    }
  ];

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

    // Handle NUI messages from mock environment
    window.addEventListener('message', (event) => {
      if (event.data.action === 'vehicleContext') {
        terminalActions.setVehicleContext(event.data.data.isInVehicle);
        terminalActions.setVehicleSpeed(event.data.data.speed || 0);
        
        if (event.data.data.isInVehicle) {
          terminalActions.addLine('✓ Vehicle CAD activated', 'system');
          terminalActions.setActiveModal('VEHICLE_CAD');
        } else {
          terminalActions.addLine('✓ Vehicle CAD deactivated', 'system');
          if (terminalState.activeModal === 'VEHICLE_CAD') {
            terminalActions.setActiveModal(null);
          }
        }
      }

      if (event.data.action === 'searchPerson') {
        const person = mockPersonsData.find(p => p.citizenId === event.data.data.citizenId);
        if (person) {
          terminalActions.addLine(`✓ Person found: ${person.name}`, 'output');
          terminalActions.setActiveModal('PERSON_SEARCH', {
            personId: person.citizenId,
            personData: person
          });
        } else {
          terminalActions.addLine(`✗ Person not found`, 'error');
        }
      }

      if (event.data.action === 'scanLicense') {
        terminalActions.addLine(`✓ License scan complete: ${event.data.data.plate}`, 'output');
        terminalActions.setActiveModal('VEHICLE_SEARCH', {
          plate: event.data.data.plate,
          vehicle: {
            plate: event.data.data.plate,
            model: 'police',
            color: 'Black and White',
            owner: 'CIT-123456',
            status: 'STOLEN'
          }
        });
      }
    });

    // Auto-simulate vehicle context for browser testing
    setTimeout(() => {
      window.postMessage({
        action: 'vehicleContext',
        data: {
          isInVehicle: true,
          speed: 35
        }
      }, '*');
    }, 1000);

    // Auto-simulate ID search for demonstration
    setTimeout(() => {
      window.postMessage({
        action: 'searchPerson',
        data: {
          citizenId: 'CIT-123456',
          name: 'John Doe'
        }
      }, '*');
    }, 2000);

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
      radarVehicles: mockRadarData.length,
      persons: mockPersonsData.length
    };
  }

  // Mock handlers for new features
  mockHandlers['searchPerson'] = (data: unknown) => {
    const payload = asRecord(data);
    const citizenId = typeof payload.citizenId === 'string' ? payload.citizenId : '';
    const person = mockPersonsData.find(p => p.citizenId === citizenId);
    
    if (!person) {
      throw new Error('Person not found');
    }

    return {
      ok: true,
      person
    };
  };

  mockHandlers['vehicleContext'] = (data: unknown) => {
    const payload = asRecord(data);
    const isInVehicle = payload.isInVehicle === true;
    const speed = typeof payload.speed === 'number' ? payload.speed : 0;
    
    return {
      ok: true,
      isInVehicle,
      speed
    };
  };

  mockHandlers['getRadarData'] = () => {
    // Simulate dynamic radar data
    const updatedData = mockRadarData.map(vehicle => ({
      ...vehicle,
      distance: Math.max(5, vehicle.distance + (Math.random() - 0.5) * 5)
    }));

    // 20% chance to add new vehicle
    if (Math.random() < 0.2) {
      updatedData.push({
        id: Date.now(),
        coords: { 
          x: 450 + Math.random() * 50, 
          y: -980 + Math.random() * 50, 
          z: 29.6 
        },
        distance: 10 + Math.random() * 80,
        isWanted: Math.random() < 0.25
      });
    }

    return {
      ok: true,
      data: updatedData.slice(-5)
    };
  };

  mockHandlers['scanLicense'] = (data: unknown) => {
    const payload = asRecord(data);
    const plate = typeof payload.plate === 'string' ? payload.plate : 'MOCK-PLATE';
    const vehicle = mockVehicles.find(v => v.plate === plate);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return {
      ok: true,
      vehicle
    };
  };

  mockHandlers['createCase'] = (data: unknown) => {
    const payload = asRecord(data);
    const caseId = `CASE_${Date.now().toString(36).toUpperCase()}`;
    const newCase: Case = {
      caseId,
      caseType: typeof payload.caseType === 'string' ? payload.caseType : 'GENERAL',
      title: typeof payload.title === 'string' ? payload.title : 'New Case',
      status: 'OPEN',
      priority: typeof payload.priority === 'number' ? payload.priority : 3,
      createdAt: new Date().toISOString(),
      notes: [],
      evidence: [],
      tasks: []
    };

    mockCases[caseId] = newCase;
    
    // Create dispatch call
    const dispatchData = {
      callId: `CALL_${Date.now()}`,
      type: newCase.caseType,
      priority: newCase.priority,
      location: 'Auto-generated from case',
      description: `Case: ${newCase.title}`,
      status: 'PENDING',
      units: [],
      createdAt: new Date().toISOString(),
      subjects: [{
        id: 'UNKNOWN',
        name: 'Case Subjects',
        description: 'Auto-generated from case'
      }]
    };
    
    mockDispatchCalls[dispatchData.callId] = dispatchData;
    
    return newCase;
  };

  mockHandlers['requestHelp'] = (data: unknown) => {
    const payload = asRecord(data);
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const caseItem = mockCases[caseId];

    if (!caseItem) {
      throw new Error('Case not found');
    }

    const dispatchData = {
      callId: `CALL_${Date.now()}`,
      type: caseItem.caseType,
      priority: 1,
      location: 'Auto-generated help request',
      description: `EMERGENCY: ${caseItem.title} - ${caseItem.caseId}`,
      status: 'PENDING',
      units: [],
      createdAt: new Date().toISOString(),
      subjects: [{
        id: 'UNKNOWN',
        name: 'Case Subjects',
        description: 'Emergency help requested'
      }]
    };
    
    mockDispatchCalls[dispatchData.callId] = dispatchData;
    
    return {
      ok: true,
      dispatchCall: dispatchData
    };
  };

  mockHandlers['generateFine'] = (data: unknown) => {
    const payload = asRecord(data);
    const caseId = typeof payload.caseId === 'string' ? payload.caseId : '';
    const violation = typeof payload.violation === 'string' ? payload.violation : 'Speeding';
    const amount = typeof payload.amount === 'number' ? payload.amount : 250;

    const fineId = `FINE_${Date.now().toString(36).toUpperCase()}`;
    const fine = {
      fineId,
      caseId,
      violation,
      amount,
      notes: typeof payload.notes === 'string' ? payload.notes : '',
      createdAt: new Date().toISOString(),
      status: 'PENDING'
    };

    if (!mockFines[caseId]) {
      mockFines[caseId] = [];
    }
    mockFines[caseId].push(fine);
    
    return {
      ok: true,
      fine
    };
  };
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
