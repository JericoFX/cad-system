/**
 * NUI Message Types
 * Defines all message interfaces for Lua <-> JS communication
 */

export interface NuiMessage<T = unknown> {
  action: string;
  data: T;
}

// ============================================================
// CAD General
// ============================================================
export interface CadOpenedData {
  terminalId: string;
  location: { x: number; y: number; z: number };
  hasContainer: boolean;
  hasReader: boolean;
}

export interface CadClosedData {
  timestamp: number;
}

// ============================================================
// Dispatch
// ============================================================
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
  createdBy: string;
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

export interface DispatchCallCreatedData {
  call: DispatchCall;
}

export interface DispatchCallUpdatedData {
  callId: string;
  changes: Partial<DispatchCall>;
  updatedBy: string;
  updatedAt: string;
}

export interface DispatchCallClosedData {
  callId: string;
  closedBy: string;
  closedAt: string;
}

export interface DispatchUnitStatusChangedData {
  unitId: string;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
}

export interface DispatchUnitPositionUpdatedData {
  unitId: string;
  x: number;
  y: number;
  z: number;
  updatedAt: string;
}

export interface DispatchCallAssignedData {
  callId: string;
  unitId: string;
  assignedAt: string;
  assignedBy: string;
}

// ============================================================
// Cases
// ============================================================
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
}

export interface CaseNote {
  id: string;
  caseId: string;
  author: string;
  content: string;
  timestamp: string;
  type: 'general' | 'observation' | 'interview' | 'evidence';
}

export interface CaseCreatedData {
  case: Case;
}

export interface CaseUpdatedData {
  caseId: string;
  changes: Partial<Case>;
  updatedBy: string;
  updatedAt: string;
}

export interface CaseClosedData {
  caseId: string;
  closedBy: string;
  closedAt: string;
}

export interface CaseNoteAddedData {
  caseId: string;
  note: CaseNote;
  addedBy: string;
  addedAt: string;
}

export interface CaseEvidenceAttachedData {
  caseId: string;
  evidenceId: string;
  attachedBy: string;
  attachedAt: string;
}

// ============================================================
// Evidence
// ============================================================
export interface Evidence {
  evidenceId: string;
  caseId: string;
  evidenceType: string;
  data: Record<string, unknown>;
  attachedBy: string;
  attachedAt: string;
}

export interface EvidenceStagedData {
  stagingId: string;
  evidenceType: string;
  data: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
}

export interface EvidenceAnalyzedData {
  evidenceId: string;
  caseId: string;
  results: Record<string, unknown>;
  analyst: string;
  analyzedAt: string;
}

export interface EvidenceCollectedData {
  evidenceId: string;
  caseId: string;
  evidenceType: string;
  data: Record<string, unknown>;
  collectedBy: string;
  collectedAt: string;
}

export interface EvidenceTransferredData {
  evidenceId: string;
  fromOfficer: string;
  toOfficer: string;
  location: string;
  transferredAt: string;
}

// ============================================================
// EMS
// ============================================================
export interface EmsAlert {
  alertId: string;
  type: string;
  priority: number;
  message: string;
  location?: { x: number; y: number; z: number };
  createdAt: string;
  createdBy: string;
}

export interface EmsBloodRequest {
  requestId: string;
  bloodType: string;
  units: number;
  hospital: string;
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  fulfilledBy?: string;
  fulfilledAt?: string;
}

export interface EmsCriticalPatientData {
  patientId: string;
  patientName: string;
  condition: 'CRITICAL' | 'STABLE' | 'DECEASED';
  location: { x: number; y: number; z: number };
  hospital: string;
  updatedAt: string;
  updatedBy: string;
}

export interface EmsLowStockData {
  itemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  hospital: string;
  reportedAt: string;
}

export interface EmsAlertCreatedData {
  alert: EmsAlert;
}

export interface EmsBloodRequestCreatedData {
  request: EmsBloodRequest;
}

export interface EmsBloodRequestFulfilledData {
  requestId: string;
  fulfilledBy: string;
  fulfilledAt: string;
}

export interface EmsHandoffCompleteData {
  patientId: string;
  fromUnit: string;
  toUnit: string;
  completedAt: string;
}

// ============================================================
// Forensics
// ============================================================
export interface ForensicAnalysis {
  analysisId: string;
  evidenceId: string;
  evidenceType: string;
  analystId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
  results?: Record<string, unknown>;
}

export interface ForensicTrace {
  traceId: string;
  type: string;
  location: { x: number; y: number; z: number };
  collected: boolean;
  collectedBy?: string;
  collectedAt?: string;
}

export interface ForensicsAnalysisStartedData {
  analysis: ForensicAnalysis;
}

export interface ForensicsAnalysisCompletedData {
  analysisId: string;
  evidenceId: string;
  results: Record<string, unknown>;
  completedBy: string;
  completedAt: string;
}

export interface ForensicsEvidenceComparedData {
  evidenceId: string;
  comparisonId: string;
  matchResults: {
    match: boolean;
    confidence: number;
    details?: Record<string, unknown>;
  };
  comparedAt: string;
}

export interface ForensicsWorldTraceFoundData {
  trace: ForensicTrace;
}

export interface ForensicsTraceBaggedData {
  traceId: string;
  evidenceId: string;
  baggedBy: string;
  baggedAt: string;
}

// ============================================================
// Photos
// ============================================================
export interface PhotoPreviewData {
  imageUrl: string;
  isBase64: boolean;
  location: { x: number; y: number; z: number };
  fov: {
    hit: boolean;
    hitCoords?: { x: number; y: number; z: number };
    distance: number;
    entityType?: string;
  };
  job: 'police' | 'reporter';
}

export interface PhotoMetadata {
  photoId: string;
  photoUrl: string;
  takenBy: string;
  takenByCitizenId: string;
  takenAt: string;
  location: { x: number; y: number; z: number };
  description?: string;
  job: 'police' | 'reporter';
  isEvidence?: boolean;
  attachedCaseId?: string;
}

export interface PhotoCapturedData {
  photo: PhotoMetadata;
}

export interface PhotoViewData {
  url: string;
  metadata: PhotoMetadata;
}

export interface PhotoReleasedToPressData {
  photoId: string;
  releasedBy: string;
  releasedAt: string;
  restrictions?: {
    editLevel: string;
    expiryDate?: string;
  };
}

// ============================================================
// Fines
// ============================================================
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
}

export interface FineCreatedData {
  fine: Fine;
}

export interface FinePaidData {
  fineId: string;
  paidAt: string;
  paidMethod: 'CASH' | 'BANK';
  paidBy: string;
}

// ============================================================
// Police
// ============================================================
export interface JailTransfer {
  transferId: string;
  inmateId: string;
  inmateName: string;
  fromFacility: string;
  toFacility: string;
  reason: string;
  transferredBy: string;
  transferredAt: string;
}

export interface PoliceJailTransferLoggedData {
  transfer: JailTransfer;
}

// ============================================================
// Notifications
// ============================================================
export interface NotificationShowData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

// ============================================================
// Offline Sync
// ============================================================
export interface OfflineSyncData {
  events: Array<{
    action: string;
    data: unknown;
    timestamp: string;
  }>;
}

// ============================================================
// Message Map
// ============================================================
export interface NuiMessageMap {
  // CAD
  'cad:opened': CadOpenedData;
  'cad:closed': CadClosedData;
  
  // Dispatch
  'dispatch:callCreated': DispatchCallCreatedData;
  'dispatch:callUpdated': DispatchCallUpdatedData;
  'dispatch:callClosed': DispatchCallClosedData;
  'dispatch:callAssigned': DispatchCallAssignedData;
  'dispatch:unitStatusChanged': DispatchUnitStatusChangedData;
  'dispatch:unitPositionUpdated': DispatchUnitPositionUpdatedData;
  
  // Cases
  'case:created': CaseCreatedData;
  'case:updated': CaseUpdatedData;
  'case:closed': CaseClosedData;
  'case:noteAdded': CaseNoteAddedData;
  'case:evidenceAttached': CaseEvidenceAttachedData;
  
  // Evidence
  'evidence:staged': EvidenceStagedData;
  'evidence:analyzed': EvidenceAnalyzedData;
  'evidence:collected': EvidenceCollectedData;
  'evidence:transferred': EvidenceTransferredData;
  
  // EMS
  'ems:alertCreated': EmsAlertCreatedData;
  'ems:alertUpdated': EmsAlert;
  'ems:criticalPatient': EmsCriticalPatientData;
  'ems:lowStock': EmsLowStockData;
  'ems:bloodRequestCreated': EmsBloodRequestCreatedData;
  'ems:bloodRequestFulfilled': EmsBloodRequestFulfilledData;
  'ems:handoffComplete': EmsHandoffCompleteData;
  
  // Forensics
  'forensics:analysisStarted': ForensicsAnalysisStartedData;
  'forensics:analysisCompleted': ForensicsAnalysisCompletedData;
  'forensics:evidenceCompared': ForensicsEvidenceComparedData;
  'forensics:worldTraceFound': ForensicsWorldTraceFoundData;
  'forensics:traceBagged': ForensicsTraceBaggedData;
  
  // Photos
  'photo:preview': PhotoPreviewData;
  'photo:view': PhotoViewData;
  'photo:captured': PhotoCapturedData;
  'photo:releasedToPress': PhotoReleasedToPressData;
  
  // Fines
  'fine:created': FineCreatedData;
  'fine:paid': FinePaidData;
  
  // Police
  'police:jailTransferLogged': PoliceJailTransferLoggedData;
  
  // Notifications
  'notification:show': NotificationShowData;
  
  // Offline sync
  'cad:syncOffline': OfflineSyncData;
}

export type NuiAction = keyof NuiMessageMap;
