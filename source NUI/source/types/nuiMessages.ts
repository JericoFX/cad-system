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
  location?: { x: number; y: number; z: number };
  hasContainer: boolean;
  hasReader: boolean;
  bootMode?: 'cold' | 'warm';
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

export interface DispatchPublicStateData {
  rev: number;
  generatedAt: string;
  calls: Record<string, DispatchCall>;
  units: Record<string, DispatchUnit>;
}

// ============================================================
// Security Cameras
// ============================================================
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

export interface CameraCreatedData {
  camera: SecurityCamera;
}

export interface CameraUpdatedData {
  camera: SecurityCamera;
}

export interface CameraRemovedData {
  cameraId: string;
}

export interface CameraViewStartedData {
  camera: SecurityCamera;
}

export interface CameraViewStoppedData {
  timestamp: number;
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
  notes?: CaseNote[];
  evidence?: Evidence[];
  tasks?: Array<Record<string, unknown>>;
}

export interface CustodyEvent {
  eventId: string;
  evidenceId: string;
  eventType:
    | 'ATTACHED'
    | 'COLLECTED'
    | 'TRANSFERRED'
    | 'STORED'
    | 'ANALYZED'
    | 'SUBMITTED'
    | 'RELEASED';
  recordedBy: string;
  timestamp: string;
  notes?: string;
  fromOfficer?: string;
  toOfficer?: string;
  location?: string;
}

export interface CaseNote {
  id: string;
  caseId: string;
  author: string;
  content: string;
  timestamp: string;
  type: 'general' | 'observation' | 'interview' | 'evidence';
}

export interface CasePublicStateData {
  rev: number;
  generatedAt: string;
  cases: Record<string, Case>;
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
  custodyChain?: CustodyEvent[];
  currentLocation?: string;
  currentCustodian?: string;
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
  attachedBy?: string;
  attachedAt?: string;
  custodyChain?: Array<Record<string, unknown>>;
}

export interface EvidenceTransferredData {
  evidenceId: string;
  caseId?: string;
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
  title?: string;
  description?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  coords?: { x: number; y: number; z: number };
  status?: 'ACTIVE' | 'RESOLVED' | string;
  type?: string;
  priority?: number;
  message?: string;
  location?: { x: number; y: number; z: number };
  createdAt: string;
  createdBy?: string;
}

export interface EmsBloodRequest {
  requestId: string;
  caseId?: string;
  citizenId?: string;
  personName: string;
  reason: string;
  location?: string;
  requestedBy?: string;
  requestedByName?: string;
  requestedByJob?: string;
  requestedAt: string;
  handledBy?: string;
  handledByName?: string;
  handledAt?: string;
  notes?: string;
  analysisStartedAt?: string;
  analysisStartedAtMs?: number;
  analysisDurationMs?: number;
  analysisEndsAt?: string;
  analysisEndsAtMs?: number;
  analysisCompletedAt?: string;
  analysisCompletedAtMs?: number;
  analysisRemainingMs?: number;
  analysisReady?: boolean;
  sampleStashId?: string;
  sampleSlot?: number;
  sampleItemName?: string;
  sampleMetadata?: Record<string, unknown>;
  evidenceId?: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
  bloodType?: string;
  units?: number;
  hospital?: string;
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
  caseId?: string;
  evidenceId: string;
  evidenceType?: string;
  analystId?: string;
  startedBy?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
  results?: Record<string, unknown>;
}

export interface ForensicTrace {
  traceId: string;
  type?: string;
  evidenceType?: string;
  location?: { x: number; y: number; z: number };
  coords?: { x: number; y: number; z: number };
  collected?: boolean;
  collectedBy?: string;
  collectedAt?: string;
}

export interface ForensicsAnalysisStartedData {
  analysis: ForensicAnalysis;
}

export interface ForensicsAnalysisCompletedData {
  analysisId: string;
  caseId?: string;
  evidenceId: string;
  results: Record<string, unknown>;
  completedBy: string;
  completedAt: string;
}

export interface ForensicsEvidenceComparedData {
  evidenceId?: string;
  evidenceA?: string;
  evidenceB?: string;
  comparisonId?: string;
  match?: boolean;
  confidence?: number;
  matchResults?: {
    match: boolean;
    confidence: number;
    details?: Record<string, unknown>;
  };
  comparedAt?: string;
}

export interface ForensicsWorldTraceFoundData {
  trace: ForensicTrace;
}

export interface ForensicsTraceBaggedData {
  traceId: string;
  evidenceId?: string;
  baggedBy: string;
  baggedAt: string;
  staging?: {
    stagingId: string;
    evidenceType: string;
    data: Record<string, unknown>;
    createdAt: string;
  };
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
  fov?: {
    hit: boolean;
    hitCoords?: { x: number; y: number; z: number };
    distance: number;
    entityType?: string;
  };
  isEvidence?: boolean;
  stagingId?: string;
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
  isBail: boolean;
  bailDeadline?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  attachedCaseId?: string;
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
  citizenId: string;
  personName: string;
  caseId?: string;
  jailMonths: number;
  reason: string;
  facility: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  inmateId?: string;
  inmateName?: string;
  fromFacility?: string;
  toFacility?: string;
  transferredBy?: string;
  transferredAt?: string;
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
// Vehicle Tablet
// ============================================================
export interface VehicleContextData {
  isInPoliceVehicle: boolean;
  tabletOpen?: boolean;
  vehicleSpeed?: number;
  plate?: string;
  model?: string;
  role?: 'DRIVER' | 'PASSENGER' | 'OTHER' | 'NONE';
  quickDockEnabled?: boolean;
  quickLock?: {
    plate: string;
    model: string;
    riskLevel: 'NONE' | 'MEDIUM' | 'HIGH';
    riskTags: string[];
    noteHint?: string;
    ownerId?: string;
    ownerName?: string;
    distance?: number;
    scannedAt: number;
    stopId?: string;
  };
}

export interface VehicleCadToggleData {
  timestamp: number;
}

export interface VehiclePrefillSearchData {
  plate?: string;
}

// ============================================================
// Message Map
// ============================================================
export interface NuiMessageMap {
  // CAD
  'cad:opened': CadOpenedData;
  'cad:closed': CadClosedData;
  
  // Dispatch
  'dispatch:publicState': DispatchPublicStateData;

  // Security Cameras
  'camera:created': CameraCreatedData;
  'camera:updated': CameraUpdatedData;
  'camera:removed': CameraRemovedData;
  'camera:viewStarted': CameraViewStartedData;
  'camera:viewStopped': CameraViewStoppedData;
  
  // Cases
  'case:publicState': CasePublicStateData;
  
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

  // Vehicle
  'vehicle:context': VehicleContextData;
  'vehicle:cadOpen': VehicleCadToggleData;
  'vehicle:cadClose': VehicleCadToggleData;
  'vehicle:prefillSearch': VehiclePrefillSearchData;
}

export type NuiAction = keyof NuiMessageMap;
