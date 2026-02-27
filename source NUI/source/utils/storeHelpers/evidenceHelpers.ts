/**
 * Evidence Management Helpers
 * 
 * Utility functions for evidence-related operations
 */

import type { CustodyEvent } from '~/stores/cadStore';

/**
 * Create a custody event with standardized properties
 * @param params Parameters for the custody event
 * @returns A new CustodyEvent object
 */
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

/**
 * Create a transfer custody event
 * @param evidenceId The ID of the evidence
 * @param fromOfficer The officer transferring the evidence
 * @param toOfficer The officer receiving the evidence
 * @param notes Optional notes about the transfer
 * @returns A new CustodyEvent object for transfer
 */
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

/**
 * Create an analysis request custody event
 * @param evidenceId The ID of the evidence
 * @param requestedBy The officer requesting analysis
 * @param notes Optional notes about the request
 * @returns A new CustodyEvent object for analysis request
 */
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

/**
 * Create an analysis completion custody event
 * @param evidenceId The ID of the evidence
 * @param analystId The ID of the analyst
 * @param location The location where analysis was performed
 * @param notes Optional notes about the analysis
 * @returns A new CustodyEvent object for analysis completion
 */
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