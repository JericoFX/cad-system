
import { createStore } from 'solid-js/store';
import { cadState } from './cadStore';

export type AuditResult = 'success' | 'error' | 'warning' | 'cancelled';

export interface AuditEntry {
  id: string;
  timestamp: number;
  command: string;
  args: string[];
  result: AuditResult;
  resultMessage?: string;
  officerId: string;
  officerName: string;
  officerBadge: string;
  linkedCaseId?: string;
  linkedCallId?: string;
  location?: { x: number; y: number; z: number };
  metadata?: Record<string, unknown>;
}

interface AuditState {
  entries: AuditEntry[];
  maxEntries: number;
  isViewerOpen: boolean;
  filter: 'all' | 'success' | 'error' | 'case' | 'call';
  searchQuery: string;
  selectedEntry: AuditEntry | null;
}

const MAX_ENTRIES = 100;

const initialState: AuditState = {
  entries: [],
  maxEntries: MAX_ENTRIES,
  isViewerOpen: false,
  filter: 'all',
  searchQuery: '',
  selectedEntry: null,
};

export const [auditState, setAuditState] = createStore<AuditState>(initialState);

export const auditActions = {
  logCommand: (
    command: string,
    args: string[],
    result: AuditResult,
    resultMessage?: string,
    metadata?: Record<string, unknown>
  ) => {
    const entry: AuditEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      command,
      args,
      result,
      resultMessage,
      officerId: 'OFF_001', // TODO: Get from userStore
      officerName: 'Demo Officer',
      officerBadge: 'B-001',
      linkedCaseId: cadState.currentCase?.caseId,
      linkedCallId: cadState.currentCall?.callId,
      metadata,
    };

    setAuditState('entries', (prev) => {
      const updated = [entry, ...prev];
      return updated.slice(0, auditState.maxEntries);
    });
  },

  openViewer: () => {
    setAuditState('isViewerOpen', true);
  },

  closeViewer: () => {
    setAuditState('isViewerOpen', false);
    setAuditState('selectedEntry', null);
  },

  toggleViewer: () => {
    setAuditState('isViewerOpen', (v) => !v);
  },

  setFilter: (filter: AuditState['filter']) => {
    setAuditState('filter', filter);
  },

  setSearchQuery: (query: string) => {
    setAuditState('searchQuery', query);
  },

  selectEntry: (entry: AuditEntry | null) => {
    setAuditState('selectedEntry', entry);
  },

  clearEntries: () => {
    setAuditState('entries', []);
  },

  exportToNote: () => {
    const entries = auditState.entries;
    if (entries.length === 0) return;

    const lines = [
      '=== COMMAND AUDIT LOG ===',
      `Generated: ${new Date().toLocaleString()}`,
      `Total Entries: ${entries.length}`,
      '',
      ...entries.map((e) => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        const caseInfo = e.linkedCaseId ? `[Case: ${e.linkedCaseId}]` : '';
        const callInfo = e.linkedCallId ? `[Call: ${e.linkedCallId}]` : '';
        return `[${time}] ${e.officerBadge}: ${e.command} ${e.args.join(' ')} ${caseInfo} ${callInfo} -> ${e.result}`;
      }),
    ];

    const noteContent = lines.join('\n');

    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(noteContent);
    }

    return noteContent;
  },

  getFilteredEntries: (): AuditEntry[] => {
    let entries = auditState.entries;

    switch (auditState.filter) {
      case 'success':
        entries = entries.filter((e) => e.result === 'success');
        break;
      case 'error':
        entries = entries.filter((e) => e.result === 'error');
        break;
      case 'case':
        entries = entries.filter((e) => e.linkedCaseId);
        break;
      case 'call':
        entries = entries.filter((e) => e.linkedCallId);
        break;
    }

    if (auditState.searchQuery) {
      const query = auditState.searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.command.toLowerCase().includes(query) ||
          e.officerName.toLowerCase().includes(query) ||
          e.linkedCaseId?.toLowerCase().includes(query) ||
          e.linkedCallId?.toLowerCase().includes(query)
      );
    }

    return entries;
  },

  getStats: () => {
    const entries = auditState.entries;
    return {
      total: entries.length,
      success: entries.filter((e) => e.result === 'success').length,
      error: entries.filter((e) => e.result === 'error').length,
      warning: entries.filter((e) => e.result === 'warning').length,
      withCase: entries.filter((e) => e.linkedCaseId).length,
      withCall: entries.filter((e) => e.linkedCallId).length,
    };
  },

  logSuccess: (command: string, args: string[], message?: string) => {
    auditActions.logCommand(command, args, 'success', message);
  },

  logError: (command: string, args: string[], errorMessage: string) => {
    auditActions.logCommand(command, args, 'error', errorMessage);
  },

  logWarning: (command: string, args: string[], warningMessage: string) => {
    auditActions.logCommand(command, args, 'warning', warningMessage);
  },
};
