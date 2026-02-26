import { onNuiMessage } from '~/utils/nuiRouter';
import type { CasePublicStateData } from '~/types/nuiMessages';
import type { Case as CadCase } from '~/stores/cadStore';

const seenCaseIds = new Set<string>();
let casesHydrated = false;

const normalizeCaseRecord = (value: unknown): Record<string, CadCase> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const input = value as Record<string, CadCase>;
  const out: Record<string, CadCase> = {};

  Object.keys(input).forEach((caseId) => {
    const row = input[caseId];
    if (!row || typeof row !== 'object') {
      return;
    }

    out[caseId] = {
      ...row,
      notes: Array.isArray(row.notes) ? row.notes : [],
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      tasks: Array.isArray(row.tasks) ? row.tasks : [],
    };
  });

  return out;
};

export function initCaseHandlers(): void {
  onNuiMessage<CasePublicStateData>('case:publicState', async (data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    const incoming = normalizeCaseRecord(data.cases);
    const nextCaseIds = new Set(Object.keys(incoming));

    const { cadActions, cadState } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    const merged: Record<string, CadCase> = {};
    nextCaseIds.forEach((caseId) => {
      const incomingCase = incoming[caseId];
      const existingCase = cadState.cases[caseId];

      merged[caseId] = {
        ...incomingCase,
        notes: existingCase?.notes || incomingCase.notes || [],
        evidence: existingCase?.evidence || incomingCase.evidence || [],
        tasks: existingCase?.tasks || incomingCase.tasks || [],
      };
    });

    if (casesHydrated) {
      nextCaseIds.forEach((caseId) => {
        if (!seenCaseIds.has(caseId)) {
          const row = incoming[caseId];
          notificationActions.notifySystem(
            'New Case',
            `${caseId}: ${row?.title || 'CASE'}`,
            'info'
          );
        }
      });
    }

    seenCaseIds.clear();
    nextCaseIds.forEach((caseId) => seenCaseIds.add(caseId));
    casesHydrated = true;

    cadActions.setCases(merged);
  });
}
