/**
 * Case Handlers
 * Handles case events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  CaseCreatedData,
  CaseUpdatedData,
  CaseClosedData,
  CaseNoteAddedData,
  CaseEvidenceAttachedData
} from '~/types/nuiMessages';

export function initCaseHandlers(): void {
  // Case created
  onNuiMessage<CaseCreatedData>('case:created', async (data) => {
    console.log('[NUI] Case created:', data.case.caseId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Normalize and add case
    const normalizedCase = {
      ...data.case,
      notes: data.case.notes || [],
      evidence: data.case.evidence || [],
      tasks: data.case.tasks || [],
    };
    
    cadActions.addCase(normalizedCase);
    
    // Notification
    notificationActions.notifySystem(
      'New Case',
      `Case ${data.case.caseId}: ${data.case.title}`,
      'info'
    );
  });
  
  // Case updated
  onNuiMessage<CaseUpdatedData>('case:updated', async (data) => {
    console.log('[NUI] Case updated:', data.caseId);
    
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.updateCase(data.caseId, data.changes);
  });
  
  // Case closed
  onNuiMessage<CaseClosedData>('case:closed', async (data) => {
    console.log('[NUI] Case closed:', data.caseId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    cadActions.updateCase(data.caseId, { 
      status: 'CLOSED',
      updatedAt: data.closedAt
    });
    
    notificationActions.notifySystem(
      'Case Closed',
      `Case ${data.caseId} has been closed`,
      'success'
    );
  });
  
  // Case note added
  onNuiMessage<CaseNoteAddedData>('case:noteAdded', async (data) => {
    console.log('[NUI] Case note added:', data.caseId);
    
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.addCaseNote(data.caseId, data.note);
  });
  
  // Case evidence attached
  onNuiMessage<CaseEvidenceAttachedData>('case:evidenceAttached', async (data) => {
    console.log('[NUI] Evidence attached to case:', data.caseId, data.evidenceId);
    
    const { cadActions } = await import('~/stores/cadStore');
    
    // Add evidence to case
    const newEvidence = {
      evidenceId: data.evidenceId,
      caseId: data.caseId,
      attachedBy: data.attachedBy,
      attachedAt: data.attachedAt,
      evidenceType: 'unknown',
      data: {},
      custodyChain: [{
        eventId: `CUSTODY_${Date.now()}`,
        evidenceId: data.evidenceId,
        eventType: 'ATTACHED' as const,
        recordedBy: data.attachedBy,
        timestamp: data.attachedAt,
        notes: 'Evidence attached to case',
      }],
      currentLocation: 'Case File',
      currentCustodian: data.attachedBy,
    };
    
    cadActions.addCaseEvidence(data.caseId, newEvidence);
  });
  
  console.log('[NUI Handlers] Case handlers registered');
}
