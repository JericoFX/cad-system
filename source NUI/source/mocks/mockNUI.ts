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
  SecurityCamera,
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

const mockReaderContainer: Record<number, typeof mockReaderDocument> = {
  1: { ...mockReaderDocument },
};

const mockEvidenceLocker: Array<{
  slot: number;
  label: string;
  itemName: string;
  metadata: {
    evidenceType?: string;
    stagingId?: string;
    data?: Record<string, unknown>;
    createdAt?: string;
  };
}> = [];

let mockVehicleTabletOpen = true;
const mockEntityNotes: Array<{
  id: string;
  entityType: 'PERSON' | 'VEHICLE';
  entityId: string;
  author: string;
  authorName: string;
  content: string;
  important: boolean;
  timestamp: string;
}> = [];

const mockVehicleStops: Array<{
  stopId: string;
  plate: string;
  vehicleModel: string;
  ownerIdentifier?: string;
  ownerName?: string;
  riskLevel: 'NONE' | 'MEDIUM' | 'HIGH';
  riskTags: string[];
  noteHint?: string;
  createdAt: string;
  officer: string;
}> = [];

const mockSecurityCameras: Record<string, SecurityCamera> = {
  CAM_MOCK_0001: {
    cameraId: 'CAM_MOCK_0001',
    cameraNumber: 1,
    label: 'Camera 0001',
    street: 'Mission Row',
    crossStreet: 'Sinner St',
    zone: 'Mission Row',
    coords: { x: 439.12, y: -981.45, z: 33.9 },
    rotation: { x: -12.0, y: 0.0, z: 145.0 },
    fov: 55,
    status: 'ACTIVE',
    installedBy: 'OFFICER_101',
    installedByName: 'Officer Mock',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  CAM_MOCK_0002: {
    cameraId: 'CAM_MOCK_0002',
    cameraNumber: 2,
    label: 'Camera 0002',
    street: 'Integrity Way',
    crossStreet: 'Power St',
    zone: 'Downtown',
    coords: { x: 242.75, y: -1073.22, z: 35.0 },
    rotation: { x: -8.0, y: 0.0, z: 90.0 },
    fov: 60,
    status: 'ACTIVE',
    installedBy: 'OFFICER_102',
    installedByName: 'Officer Mock 2',
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
  },
  CAM_MOCK_0003: {
    cameraId: 'CAM_MOCK_0003',
    cameraNumber: 3,
    label: 'Camera 0003',
    street: 'Vespucci Blvd',
    crossStreet: 'San Andreas Ave',
    zone: 'Vespucci',
    coords: { x: -1061.2, y: -851.4, z: 13.2 },
    rotation: { x: -15.0, y: 0.0, z: 220.0 },
    fov: 50,
    status: 'DISABLED',
    installedBy: 'OFFICER_103',
    installedByName: 'Officer Mock 3',
    createdAt: new Date(Date.now() - 21600000).toISOString(),
    updatedAt: new Date(Date.now() - 10800000).toISOString(),
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

  'cad:idreader:read': (data: unknown) => {
    const payload = asRecord(data);
    const slot = typeof payload.slot === 'number' ? payload.slot : 1;
    const item = mockReaderContainer[slot] || mockReaderContainer[1] || mockReaderDocument;
    const info = item.metadata.info;

    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      containerKey: 'terminal:mrpd_frontdesk',
      documentType: 'PERSON',
      item: {
        name: item.name,
        slot: slot,
      },
      source: 'qb-inventory-info',
      metadata: item.metadata,
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

  'cad:idreader:listDocuments': () => ({
    ok: true,
    terminalId: mockReaderContext.terminalId,
    containerKey: 'terminal:mrpd_frontdesk',
    expectedSlot: 1,
    documents: [
      {
        slot: 3,
        name: 'id_card',
        label: 'ID Card',
        count: 1,
        documentType: 'PERSON',
      },
    ],
  }),

  'cad:idreader:insert': (data: unknown) => {
    const payload = asRecord(data);
    const slot = typeof payload.slot === 'number' ? payload.slot : 1;
    mockReaderContainer[slot] = { ...mockReaderDocument, slot };
    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      containerKey: 'terminal:mrpd_frontdesk',
      slot,
      documentType: 'PERSON',
      item: {
        name: 'id_card',
        label: 'ID Card',
        sourceSlot: typeof payload.inventorySlot === 'number' ? payload.inventorySlot : 3,
      },
    };
  },

  'cad:idreader:eject': (data: unknown) => {
    const payload = asRecord(data);
    const slot = typeof payload.slot === 'number' ? payload.slot : 1;
    const item = mockReaderContainer[slot] || mockReaderContainer[1];
    if (!item) {
      return { ok: false, error: 'no_document_in_reader' };
    }

    delete mockReaderContainer[slot];
    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      containerKey: 'terminal:mrpd_frontdesk',
      slot,
      item: {
        name: item.name,
        label: 'ID Card',
      },
    };
  },

  'cad:idreader:getContainer': () => ({
    ok: true,
    terminalId: mockReaderContext.terminalId,
    containerKey: 'terminal:mrpd_frontdesk',
    slotCount: 5,
    readSlot: 1,
    slots: Object.entries(mockReaderContainer).map(([slot, value]) => ({
      slot: Number(slot),
      itemName: value.name,
      label: 'ID Card',
      metadata: value.metadata,
    })),
  }),

  'cad:vehicle:getContext': () => ({
    ok: true,
    isInPoliceVehicle: true,
    tabletOpen: mockVehicleTabletOpen,
    vehicleSpeed: 36.8,
  }),

  'cad:vehicle:getReaderContext': () => ({
    ok: true,
    hasReader: true,
    endpointType: 'vehicle',
    endpointId: 'vehicle:9001',
    vehicleNetId: 9001,
  }),

  'cad:vehicle:setOpen': (data: unknown) => {
    const payload = asRecord(data);
    mockVehicleTabletOpen = payload.open === true;
    return {
      ok: true,
      tabletOpen: mockVehicleTabletOpen,
    };
  },

  'cad:vehicle:scanFront': () => {
    const sample = mockVehicles[Math.floor(Math.random() * mockVehicles.length)] || mockVehicles[0];
    return {
      ok: true,
      plate: sample?.plate || 'TEST123',
      model: sample?.model || 'Sultan',
      distance: Math.floor((Math.random() * 32 + 8) * 10) / 10,
      scannedAt: Date.now(),
    };
  },

  'cad:vehicle:playAlert': () => ({
    ok: true,
  }),

  'cad:lookup:searchVehicles': (data: unknown) => {
    const payload = asRecord(data);
    const query = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : '';
    const rows = mockVehicles.filter((vehicle) => {
      if (!query) return true;
      return (
        vehicle.plate.toLowerCase().includes(query) ||
        vehicle.model.toLowerCase().includes(query) ||
        vehicle.make.toLowerCase().includes(query) ||
        vehicle.ownerId.toLowerCase().includes(query) ||
        vehicle.ownerName.toLowerCase().includes(query)
      );
    });
    return { ok: true, vehicles: rows.slice(0, 15) };
  },

  'cad:lookup:searchPersons': (data: unknown) => {
    const payload = asRecord(data);
    const query = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : '';
    const rows = mockPersons.filter((person) => {
      if (!query) return true;
      return (
        person.citizenid.toLowerCase().includes(query) ||
        person.firstName.toLowerCase().includes(query) ||
        person.lastName.toLowerCase().includes(query) ||
        person.ssn.toLowerCase().includes(query)
      );
    });
    return { ok: true, persons: rows.slice(0, 15) };
  },

  'cad:entityNotes:list': (data: unknown) => {
    const payload = asRecord(data);
    const entityType = payload.entityType === 'PERSON' ? 'PERSON' : 'VEHICLE';
    const entityId = typeof payload.entityId === 'string' ? payload.entityId : '';
    const notes = mockEntityNotes
      .filter((note) => note.entityType === entityType && note.entityId === entityId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return { ok: true, notes };
  },

  'cad:entityNotes:add': (data: unknown) => {
    const payload = asRecord(data);
    const entityType: 'PERSON' | 'VEHICLE' = payload.entityType === 'PERSON' ? 'PERSON' : 'VEHICLE';
    const entityId = typeof payload.entityId === 'string' ? payload.entityId : '';
    const content = typeof payload.content === 'string' ? payload.content.trim() : '';

    if (!entityId || !content) {
      return { ok: false, error: 'invalid_note_payload' };
    }

    const note = {
      id: `NOTE_${Date.now()}`,
      entityType,
      entityId,
      author: currentUser,
      authorName: currentUser,
      content,
      important: payload.important === true,
      timestamp: new Date().toISOString(),
    };

    mockEntityNotes.unshift(note);
    return { ok: true, note };
  },

  'cad:vehicle:quickSummary': (data: unknown) => {
    const payload = asRecord(data);
    const plate = typeof payload.plate === 'string' ? payload.plate.trim().toUpperCase() : '';
    const fallbackModel = typeof payload.model === 'string' ? payload.model : 'UNKNOWN';
    const vehicle = mockVehicles.find((row) => row.plate.toUpperCase() === plate);

    const vehicleNotes = mockEntityNotes.filter(
      (note) => note.entityType === 'VEHICLE' && note.entityId.toUpperCase() === plate && note.important
    );

    const ownerId = vehicle?.ownerId || '';
    const personNotes = mockEntityNotes.filter(
      (note) => note.entityType === 'PERSON' && note.entityId === ownerId && note.important
    );

    const hasImportant = vehicleNotes.length + personNotes.length > 0;
    const hasWarrant = [...vehicleNotes, ...personNotes].some((note) => note.content.toLowerCase().includes('warrant'));
    const hasStolen = Boolean(vehicle?.stolen) || [...vehicleNotes, ...personNotes].some((note) => note.content.toLowerCase().includes('stolen'));

    const riskLevel = hasStolen || hasWarrant ? 'HIGH' : hasImportant ? 'MEDIUM' : 'NONE';
    const riskTags: string[] = [];
    if (hasStolen) riskTags.push('STOLEN');
    if (hasWarrant) riskTags.push('WARRANT');
    if (hasImportant) riskTags.push('IMPORTANT_NOTE');

    return {
      ok: true,
      plate,
      model: vehicle?.model || fallbackModel,
      ownerId: vehicle?.ownerId,
      ownerName: vehicle?.ownerName,
      riskLevel,
      riskTags,
      noteHint: vehicleNotes[0]?.content || personNotes[0]?.content,
      vehicle,
    };
  },

  'cad:vehicle:logStop': (data: unknown) => {
    const payload = asRecord(data);
    const stop = {
      stopId: `STOP_${Date.now()}`,
      plate: typeof payload.plate === 'string' ? payload.plate : 'UNKNOWN',
      vehicleModel: typeof payload.model === 'string' ? payload.model : 'UNKNOWN',
      ownerIdentifier: typeof payload.ownerId === 'string' ? payload.ownerId : undefined,
      ownerName: typeof payload.ownerName === 'string' ? payload.ownerName : undefined,
      riskLevel: (typeof payload.riskLevel === 'string' ? payload.riskLevel : 'NONE') as 'NONE' | 'MEDIUM' | 'HIGH',
      riskTags: Array.isArray(payload.riskTags) ? (payload.riskTags as string[]) : [],
      noteHint: typeof payload.noteHint === 'string' ? payload.noteHint : undefined,
      createdAt: new Date().toISOString(),
      officer: currentUser,
    };

    mockVehicleStops.unshift(stop);
    return { ok: true, stopId: stop.stopId, createdAt: stop.createdAt };
  },

  'cad:vehicle:getRecentStops': (data: unknown) => {
    const payload = asRecord(data);
    const plate = typeof payload.plate === 'string' ? payload.plate.trim().toUpperCase() : '';
    const rows = plate
      ? mockVehicleStops.filter((stop) => stop.plate.toUpperCase() === plate)
      : mockVehicleStops;
    return { ok: true, stops: rows.slice(0, 8) };
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

  'cad:evidence:container:list': () => {
    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      containerKey: 'terminal:mrpd_frontdesk:evidence',
      slotCount: 200,
      slots: [...mockEvidenceLocker],
    };
  },

  'cad:evidence:container:store': (data: unknown) => {
    const payload = asRecord(data);
    const stagingId = typeof payload.stagingId === 'string' ? payload.stagingId : '';
    if (!stagingId) {
      return { ok: false, error: 'staging_id_required' };
    }

    const stagingItem = mockStagingEvidence.find((item) => item.stagingId === stagingId);
    if (!stagingItem) {
      return { ok: false, error: 'staging_not_found' };
    }

    let targetSlot = typeof payload.slot === 'number' ? payload.slot : 0;
    if (targetSlot <= 0) {
      for (let i = 1; i <= 200; i++) {
        if (!mockEvidenceLocker.find((entry) => entry.slot === i)) {
          targetSlot = i;
          break;
        }
      }
    }

    if (targetSlot <= 0) {
      return { ok: false, error: 'container_full' };
    }

    if (mockEvidenceLocker.find((entry) => entry.slot === targetSlot)) {
      return { ok: false, error: 'slot_occupied' };
    }

    mockEvidenceLocker.push({
      slot: targetSlot,
      label: `${stagingItem.evidenceType} Evidence`,
      itemName: 'cad_evidence_record',
      metadata: {
        evidenceType: stagingItem.evidenceType,
        stagingId: stagingItem.stagingId,
        data: stagingItem.data,
        createdAt: stagingItem.createdAt,
      },
    });

    const index = mockStagingEvidence.findIndex((item) => item.stagingId === stagingId);
    if (index > -1) {
      mockStagingEvidence.splice(index, 1);
    }
    cadActions.removeStagingEvidence(stagingId);

    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      containerKey: 'terminal:mrpd_frontdesk:evidence',
      slot: targetSlot,
      stagingId,
    };
  },

  'cad:evidence:container:pull': (data: unknown) => {
    const payload = asRecord(data);
    const slot = typeof payload.slot === 'number' ? payload.slot : 0;
    if (slot <= 0) {
      return { ok: false, error: 'container_empty' };
    }

    const index = mockEvidenceLocker.findIndex((entry) => entry.slot === slot);
    if (index === -1) {
      return { ok: false, error: 'container_empty' };
    }

    const entry = mockEvidenceLocker[index];
    const staging: StagingEvidence = {
      stagingId: `STAGE_${Date.now().toString(36).toUpperCase()}`,
      evidenceType: entry.metadata.evidenceType || 'PHYSICAL',
      data: entry.metadata.data || {},
      createdAt: entry.metadata.createdAt || new Date().toISOString(),
    };

    mockEvidenceLocker.splice(index, 1);
    mockStagingEvidence.push(staging);
    cadActions.addStagingEvidence(staging);

    return {
      ok: true,
      terminalId: mockReaderContext.terminalId,
      containerKey: 'terminal:mrpd_frontdesk:evidence',
      slot,
      staging,
    };
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

  'cad:cameras:getNextNumber': () => {
    const cameraNumbers = Object.values(mockSecurityCameras).map((camera) => camera.cameraNumber || 0);
    const highest = cameraNumbers.length > 0 ? Math.max(...cameraNumbers) : 0;
    return {
      ok: true,
      nextNumber: highest + 1,
    };
  },

  'cad:cameras:list': () => {
    return {
      ok: true,
      cameras: Object.values(mockSecurityCameras).sort((a, b) => a.cameraNumber - b.cameraNumber),
    };
  },

  'cad:cameras:get': (data: unknown) => {
    const payload = asRecord(data);
    const cameraId = typeof payload.cameraId === 'string' ? payload.cameraId : '';
    const camera = mockSecurityCameras[cameraId];

    if (!camera) {
      return {
        ok: false,
        error: 'camera_not_found',
      };
    }

    return {
      ok: true,
      camera,
    };
  },

  'cad:cameras:watch': (data: unknown) => {
    const payload = asRecord(data);
    const cameraId = typeof payload.cameraId === 'string' ? payload.cameraId : '';
    const camera = mockSecurityCameras[cameraId];

    if (!camera) {
      return {
        ok: false,
        error: 'camera_not_found',
      };
    }

    if (camera.status !== 'ACTIVE') {
      return {
        ok: false,
        error: 'camera_disabled',
      };
    }

    return {
      ok: true,
      camera,
    };
  },

  'cad:cameras:stopWatch': () => {
    return {
      ok: true,
    };
  },

  'cad:cameras:setStatus': (data: unknown) => {
    const payload = asRecord(data);
    const cameraId = typeof payload.cameraId === 'string' ? payload.cameraId : '';
    const status = typeof payload.status === 'string' ? payload.status.toUpperCase() : '';
    const camera = mockSecurityCameras[cameraId];

    if (!camera) {
      return {
        ok: false,
        error: 'camera_not_found',
      };
    }

    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      return {
        ok: false,
        error: 'invalid_status',
      };
    }

    camera.status = status;
    camera.updatedAt = new Date().toISOString();

    return {
      ok: true,
      camera,
    };
  },

  'cad:cameras:remove': (data: unknown) => {
    const payload = asRecord(data);
    const cameraId = typeof payload.cameraId === 'string' ? payload.cameraId : '';
    if (!mockSecurityCameras[cameraId]) {
      return {
        ok: false,
        error: 'camera_not_found',
      };
    }

    delete mockSecurityCameras[cameraId];

    return {
      ok: true,
      cameraId,
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
