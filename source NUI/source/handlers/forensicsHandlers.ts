import { onNuiMessage } from '~/utils/nuiRouter';
import type {
  ForensicsAnalysisStartedData,
  ForensicsAnalysisCompletedData,
  ForensicsEvidenceComparedData,
  ForensicsWorldTraceFoundData,
  ForensicsTraceBaggedData
} from '~/types/nuiMessages';

function resolveCaseIdByEvidence(
  evidenceId: string,
  cases: Record<string, { evidence?: Array<{ evidenceId: string }> }>
): string | null {
  const entries = Object.entries(cases || {});
  for (let i = 0; i < entries.length; i += 1) {
    const [caseId, caseRecord] = entries[i];
    const found = (caseRecord.evidence || []).some((item) => item.evidenceId === evidenceId);
    if (found) {
      return caseId;
    }
  }
  return null;
}

export function initForensicsHandlers(): void {
  onNuiMessage<ForensicsAnalysisStartedData>('forensics:analysisStarted', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions, cadState } = await import('~/stores/cadStore');
    const analysis = data.analysis || {};
    const evidenceId = `${analysis.evidenceId || ''}`;
    const caseId =
      (typeof analysis.caseId === 'string' && analysis.caseId) ||
      resolveCaseIdByEvidence(evidenceId, cadState.cases);

    if (caseId && evidenceId) {
      cadActions.addCustodyEvent(
        caseId,
        evidenceId,
        {
          eventId: `ANALYSIS_${analysis.analysisId || Date.now()}`,
          evidenceId,
          eventType: 'ANALYZED',
          toOfficer: analysis.analystId || analysis.startedBy,
          location: 'Forensic Lab',
          notes: 'Analysis started',
          timestamp: analysis.startedAt || new Date().toISOString(),
          recordedBy: analysis.analystId || analysis.startedBy || 'SYSTEM',
        }
      );
    }

    notificationActions.notifySystem(
      'Analysis Started',
      `Analysis ${analysis.analysisId || 'N/A'} has begun`,
      'info'
    );
  });

  onNuiMessage<ForensicsAnalysisCompletedData>('forensics:analysisCompleted', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions, cadState } = await import('~/stores/cadStore');
    const caseId =
      (typeof data.caseId === 'string' && data.caseId) ||
      resolveCaseIdByEvidence(data.evidenceId, cadState.cases);

    if (caseId) {
      cadActions.addCustodyEvent(
        caseId,
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
    }

    notificationActions.notifySystem(
      'Analysis Complete',
      `Evidence ${data.evidenceId} analysis completed`,
      'success'
    );
  });

  onNuiMessage<ForensicsEvidenceComparedData>('forensics:evidenceCompared', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    const confidenceRaw = data.matchResults?.confidence ?? data.confidence ?? 0;
    const confidenceNormalized = confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw;
    const confidence = Math.round(confidenceNormalized * 100);
    const matchStatus = (data.matchResults?.match ?? data.match ?? false) ? 'MATCH' : 'NO MATCH';

    notificationActions.notifySystem(
      'Evidence Comparison',
      `${matchStatus} (${confidence}% confidence)`,
      (data.matchResults?.match ?? data.match ?? false) ? 'success' : 'info'
    );
  });

  onNuiMessage<ForensicsWorldTraceFoundData>('forensics:worldTraceFound', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');
    const traceType = data.trace.type || data.trace.evidenceType || 'Unknown';

    notificationActions.notifySystem(
      'Trace Found',
      `${traceType} trace detected at scene`,
      'info'
    );
  });

  onNuiMessage<ForensicsTraceBaggedData>('forensics:traceBagged', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    if (data.staging && data.staging.stagingId) {
      cadActions.addStagingEvidence(data.staging);
    } else {
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
    }

    notificationActions.notifySystem(
      'Trace Collected',
      `Trace ${data.traceId} has been bagged as evidence`,
      'success'
    );
  });
}
