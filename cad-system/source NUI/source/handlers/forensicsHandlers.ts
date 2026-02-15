/**
 * Forensics Handlers
 * Handles forensics events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  ForensicsAnalysisStartedData,
  ForensicsAnalysisCompletedData,
  ForensicsEvidenceComparedData,
  ForensicsWorldTraceFoundData,
  ForensicsTraceBaggedData
} from '~/types/nuiMessages';

export function initForensicsHandlers(): void {
  // Analysis started
  onNuiMessage<ForensicsAnalysisStartedData>('forensics:analysisStarted', async (data) => {
    console.log('[NUI] Forensics analysis started:', data.analysis.analysisId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions } = await import('~/stores/cadStore');
    
    // Add custody event
    cadActions.addCustodyEvent(
      data.analysis.evidenceId,
      data.analysis.evidenceId,
      {
        eventId: `ANALYSIS_${data.analysis.analysisId}`,
        evidenceId: data.analysis.evidenceId,
        eventType: 'ANALYZED',
        toOfficer: data.analysis.analystId,
        location: 'Forensic Lab',
        notes: 'Analysis started',
        timestamp: data.analysis.startedAt,
        recordedBy: data.analysis.analystId,
      }
    );
    
    notificationActions.notifySystem(
      'Analysis Started',
      `Analysis ${data.analysis.analysisId} has begun`,
      'info'
    );
  });
  
  // Analysis completed
  onNuiMessage<ForensicsAnalysisCompletedData>('forensics:analysisCompleted', async (data) => {
    console.log('[NUI] Forensics analysis completed:', data.analysisId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions } = await import('~/stores/cadStore');
    
    // Add custody completion event
    cadActions.addCustodyEvent(
      data.evidenceId,
      data.evidenceId,
      {
        eventId: `COMPLETE_${Date.now()}`,
        evidenceId: data.evidenceId,
        eventType: 'ANALYZED',
        toOfficer: data.completedBy,
        location: 'Forensic Lab',
        notes: `Analysis completed. Results: ${JSON.stringify(data.results)}`,
        timestamp: data.completedAt,
        recordedBy: data.completedBy,
      }
    );
    
    notificationActions.notifySystem(
      'Analysis Complete',
      `Evidence ${data.evidenceId} analysis completed`,
      'success'
    );
  });
  
  // Evidence compared
  onNuiMessage<ForensicsEvidenceComparedData>('forensics:evidenceCompared', async (data) => {
    console.log('[NUI] Evidence compared:', data.evidenceId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    
    const matchStatus = data.matchResults.match ? 'MATCH' : 'NO MATCH';
    const confidence = Math.round(data.matchResults.confidence * 100);
    
    notificationActions.notifySystem(
      'Evidence Comparison',
      `${matchStatus} (${confidence}% confidence)`,
      data.matchResults.match ? 'success' : 'info'
    );
  });
  
  // World trace found
  onNuiMessage<ForensicsWorldTraceFoundData>('forensics:worldTraceFound', async (data) => {
    console.log('[NUI] World trace found:', data.trace.traceId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    
    notificationActions.notifySystem(
      'Trace Found',
      `${data.trace.type} trace detected at scene`,
      'info'
    );
  });
  
  // Trace bagged
  onNuiMessage<ForensicsTraceBaggedData>('forensics:traceBagged', async (data) => {
    console.log('[NUI] Trace bagged:', data.traceId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add to staging as evidence
    cadActions.addStagingEvidence({
      stagingId: `FORENSIC_${data.traceId}`,
      evidenceType: 'forensic_trace',
      data: {
        traceId: data.traceId,
        evidenceId: data.evidenceId,
        baggedBy: data.baggedBy,
        baggedAt: data.baggedAt,
      },
      createdAt: data.baggedAt,
    });
    
    notificationActions.notifySystem(
      'Trace Collected',
      `Trace ${data.traceId} has been bagged as evidence`,
      'success'
    );
  });
  
  console.log('[NUI Handlers] Forensics handlers registered');
}
