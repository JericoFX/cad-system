import type { CustodyEvent } from '~/stores/cadStore';

export function createCustodyEvent(params: {
  evidenceId: string;
  eventType: 'COLLECTED' | 'TRANSFERRED' | 'STORED' | 'ANALYZED' | 'SUBMITTED' | 'RELEASED';
  fromOfficer?: string;
  toOfficer?: string;
  location?: string;
  notes?: string;
  recordedBy: string;
}): CustodyEvent {
  return {
    eventId: `CUSTODY_${Date.now()}`,
    evidenceId: params.evidenceId,
    eventType: params.eventType,
    fromOfficer: params.fromOfficer,
    toOfficer: params.toOfficer,
    location: params.location,
    notes: params.notes,
    timestamp: new Date().toISOString(),
    recordedBy: params.recordedBy,
  };
}

export function createTransferEvent(
  evidenceId: string,
  fromOfficer: string,
  toOfficer: string,
  notes?: string
): CustodyEvent {
  return createCustodyEvent({
    evidenceId,
    eventType: 'TRANSFERRED',
    fromOfficer,
    toOfficer,
    notes: notes || `Transferred from ${fromOfficer} to ${toOfficer}`,
    recordedBy: fromOfficer,
  });
}

export function createAnalysisRequestEvent(
  evidenceId: string,
  requestedBy: string,
  notes?: string
): CustodyEvent {
  return createCustodyEvent({
    evidenceId,
    eventType: 'SUBMITTED',
    toOfficer: 'FORENSICS_LAB',
    notes: notes || 'Submitted for forensic analysis',
    recordedBy: requestedBy,
  });
}

export function createAnalysisCompletionEvent(
  evidenceId: string,
  analystId: string,
  location: string,
  notes?: string
): CustodyEvent {
  return createCustodyEvent({
    evidenceId,
    eventType: 'ANALYZED',
    toOfficer: analystId,
    location,
    notes: notes || 'Analysis completed',
    recordedBy: analystId,
  });
}
