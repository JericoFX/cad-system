import { onNuiMessage } from '~/utils/nuiRouter';
import type {
  EvidenceStagedData,
  EvidenceAnalyzedData,
  EvidenceCollectedData,
  EvidenceTransferredData
} from '~/types/nuiMessages';
import type { CustodyEvent } from '~/stores/cadStore';

export function initEvidenceHandlers(): void {
  const resolveCaseIdByEvidence = (
    evidenceId: string,
    cases: Record<string, { evidence?: Array<{ evidenceId: string }> }>
  ): string | null => {
    const entries = Object.entries(cases || {});
    for (let i = 0; i < entries.length; i += 1) {
      const [caseId, caseRecord] = entries[i];
      const found = (caseRecord.evidence || []).some((item) => item.evidenceId === evidenceId);
      if (found) {
        return caseId;
      }
    }
    return null;
  };

  onNuiMessage<EvidenceStagedData>('evidence:staged', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    cadActions.addStagingEvidence({
      stagingId: data.stagingId,
      evidenceType: data.evidenceType,
      data: data.data,
      createdAt: data.createdAt,
    });

    notificationActions.notifySystem(
      'Evidence Staged',
      `New ${data.evidenceType} evidence staged`,
      'info'
    );
  });

  onNuiMessage<EvidenceAnalyzedData>('evidence:analyzed', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

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

  onNuiMessage<EvidenceCollectedData>('evidence:collected', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    const attachedBy = data.attachedBy || data.collectedBy;
    const attachedAt = data.attachedAt || data.collectedAt;

    const normalizedCustodyChain: CustodyEvent[] = Array.isArray(data.custodyChain)
      ? data.custodyChain
          .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
          .map((entry) => ({
            eventId: String(entry.eventId || `CUSTODY_${Date.now()}`),
            evidenceId: String(entry.evidenceId || data.evidenceId),
            eventType: (entry.eventType as CustodyEvent['eventType']) || 'COLLECTED',
            fromOfficer: typeof entry.fromOfficer === 'string' ? entry.fromOfficer : undefined,
            toOfficer: typeof entry.toOfficer === 'string' ? entry.toOfficer : undefined,
            location: typeof entry.location === 'string' ? entry.location : undefined,
            notes: typeof entry.notes === 'string' ? entry.notes : undefined,
            timestamp: String(entry.timestamp || attachedAt || new Date().toISOString()),
            recordedBy: String(entry.recordedBy || attachedBy || 'SYSTEM'),
          }))
      : [];

    const evidenceWithCustody = {
      evidenceId: data.evidenceId,
      caseId: data.caseId,
      evidenceType: data.evidenceType,
      data: data.data,
      attachedBy,
      attachedAt,
      custodyChain: (normalizedCustodyChain.length > 0 ? normalizedCustodyChain : [{
        eventId: `CUSTODY_${Date.now()}`,
        evidenceId: data.evidenceId,
        eventType: 'COLLECTED' as const,
        location: 'Field/Scene',
        notes: 'Evidence collected and logged',
        timestamp: attachedAt || new Date().toISOString(),
        recordedBy: attachedBy || 'SYSTEM',
      }]),
      currentLocation: 'Evidence Storage',
      currentCustodian: attachedBy || 'SYSTEM',
    };

    cadActions.addCaseEvidence(data.caseId, evidenceWithCustody);
  });

  onNuiMessage<EvidenceTransferredData>('evidence:transferred', async (data) => {
    const { cadActions, cadState } = await import('~/stores/cadStore');
    const caseId =
      (typeof data.caseId === 'string' && data.caseId) ||
      resolveCaseIdByEvidence(data.evidenceId, cadState.cases);
    if (!caseId) {
      return;
    }

    cadActions.transferEvidence(
      caseId,
      data.evidenceId,
      data.fromOfficer,
      data.toOfficer,
      `Transferred to ${data.location}`
    );
  });
}
