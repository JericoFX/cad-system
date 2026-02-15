/**
 * Evidence Handlers
 * Handles evidence events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  EvidenceStagedData,
  EvidenceAnalyzedData,
  EvidenceCollectedData,
  EvidenceTransferredData
} from '~/types/nuiMessages';

export function initEvidenceHandlers(): void {
  // Evidence staged
  onNuiMessage<EvidenceStagedData>('evidence:staged', async (data) => {
    console.log('[NUI] Evidence staged:', data.stagingId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add to staging
    cadActions.addStagingEvidence({
      stagingId: data.stagingId,
      evidenceType: data.evidenceType,
      data: data.data,
      createdAt: data.createdAt,
    });
    
    // Notification
    notificationActions.notifySystem(
      'Evidence Staged',
      `New ${data.evidenceType} evidence staged`,
      'info'
    );
  });
  
  // Evidence analyzed
  onNuiMessage<EvidenceAnalyzedData>('evidence:analyzed', async (data) => {
    console.log('[NUI] Evidence analyzed:', data.evidenceId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add custody event for analysis
    cadActions.addCustodyEvent(data.caseId, data.evidenceId, {
      eventId: `ANALYSIS_${Date.now()}`,
      evidenceId: data.evidenceId,
      eventType: 'ANALYZED',
      toOfficer: data.analyst,
      location: 'Forensic Lab',
      notes: 'Analysis completed',
      timestamp: data.analyzedAt,
      recordedBy: data.analyst,
    });
    
    notificationActions.notifySystem(
      'Analysis Complete',
      `Evidence ${data.evidenceId} analysis completed`,
      'success'
    );
  });
  
  // Evidence collected
  onNuiMessage<EvidenceCollectedData>('evidence:collected', async (data) => {
    console.log('[NUI] Evidence collected:', data.evidenceId);
    
    const { cadActions } = await import('~/stores/cadStore');
    
    // Add evidence with custody chain
    const evidenceWithCustody = {
      ...data,
      custodyChain: [{
        eventId: `CUSTODY_${Date.now()}`,
        evidenceId: data.evidenceId,
        eventType: 'COLLECTED' as const,
        location: 'Field/Scene',
        notes: 'Evidence collected and logged',
        timestamp: data.collectedAt,
        recordedBy: data.collectedBy,
      }],
      currentLocation: 'Evidence Storage',
      currentCustodian: data.collectedBy,
    };
    
    cadActions.addCaseEvidence(data.caseId, evidenceWithCustody);
  });
  
  // Evidence transferred
  onNuiMessage<EvidenceTransferredData>('evidence:transferred', async (data) => {
    console.log('[NUI] Evidence transferred:', data.evidenceId);
    
    const { cadActions } = await import('~/stores/cadStore');
    
    // Add custody transfer event
    cadActions.transferEvidence(
      data.caseId,
      data.evidenceId,
      data.fromOfficer,
      data.toOfficer,
      `Transferred to ${data.location}`
    );
  });
  
  console.log('[NUI Handlers] Evidence handlers registered');
}
