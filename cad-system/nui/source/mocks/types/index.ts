// Extended types for mock system
// These extend or complement the types in ~/stores/cadStore

import type { DispatchUnit } from '~/stores/cadStore';

// EMS Types
export interface EMSUnit extends DispatchUnit {
  unitType: 'AMBULANCE' | 'EMS';
  crew?: string[];
}

export interface EMSAlert {
  alertId: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'ACTIVE' | 'RESOLVED';
  createdBy: string;
  createdAt: string;
}

export interface BloodSampleRequest {
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
  analysisStartedAt?: string;
  analysisStartedAtMs?: number;
  analysisDurationMs?: number;
  analysisEndsAt?: string;
  analysisEndsAtMs?: number;
  analysisCompletedAt?: string;
  analysisCompletedAtMs?: number;
  lastReminderAt?: string;
  lastReminderAtMs?: number;
  sampleStashId?: string;
  sampleSlot?: number;
  sampleItemName?: string;
  sampleMetadata?: Record<string, unknown>;
  evidenceId?: string;
}

// Forensic Types
export interface ForensicTrace {
  traceId: string;
  evidenceType: string;
  description: string;
  coords: { x: number; y: number; z: number };
  metadata: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  sourceResource: string;
}

export interface AnalysisResult {
  analysisId: string;
  caseId: string;
  evidenceId: string;
  startedBy: string;
  startedAt: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  result?: Record<string, unknown>;
  completedAt?: string;
  completedBy?: string;
}

// Scenario Types
export interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  data: {
    cases: Record<string, any>;
    calls: Record<string, any>;
    units: Record<string, any>;
    persons: Record<string, any>;
    vehicles: Record<string, any>;
    evidence: any[];
    traces: Record<string, ForensicTrace>;
    alerts: EMSAlert[];
    bloodRequests: Record<string, BloodSampleRequest>;
    fines: Record<string, any>;
    warrants: Record<string, any>;
    criminalRecords?: Record<string, any[]>;
    stagingEvidence?: any[];
  };
}

export interface MockState {
  enabled: boolean;
  currentScenario: string | null;
  isLoading: boolean;
}

export interface MockEvent {
  action: string;
  data: unknown;
}
