
import { createStore } from 'solid-js/store';
import { createEffect } from 'solid-js';
import { cadState } from './cadStore';
import { userState } from './userStore';

interface SessionState {
  activeCaseId: string | null;
  activeCallId: string | null;
  activeCaseTitle: string | null;
  activeCallTitle: string | null;
  
  officerBadge: string | null;
  officerName: string | null;
  officerRole: string | null;
  
  radioChannel: string | null;
  radioStatus: 'connected' | 'disconnected' | 'muted';
  
  isVisible: boolean;
  isExpanded: boolean;
}

const initialState: SessionState = {
  activeCaseId: null,
  activeCallId: null,
  activeCaseTitle: null,
  activeCallTitle: null,
  officerBadge: null,
  officerName: null,
  officerRole: null,
  radioChannel: null,
  radioStatus: 'disconnected',
  isVisible: true,
  isExpanded: false,
};

export const [sessionState, setSessionState] = createStore(initialState);

export function syncSessionWithCAD() {
  createEffect(() => {
    const currentCase = cadState.currentCase;
    if (currentCase) {
      setSessionState({
        activeCaseId: currentCase.caseId,
        activeCaseTitle: currentCase.title,
      });
    } else {
      setSessionState({
        activeCaseId: null,
        activeCaseTitle: null,
      });
    }
  });
  
  createEffect(() => {
    const currentCall = cadState.currentCall;
    if (currentCall) {
      setSessionState({
        activeCallId: currentCall.callId,
        activeCallTitle: currentCall.title || currentCall.description?.substring(0, 30),
      });
    } else {
      setSessionState({
        activeCallId: null,
        activeCallTitle: null,
      });
    }
  });
}

export function syncSessionWithUser() {
  createEffect(() => {
    const user = userState.currentUser;
    if (user) {
      setSessionState({
        officerBadge: user.badge || user.id?.substring(0, 6),
        officerName: user.name,
        officerRole: user.role || 'Officer',
      });
    } else {
      setSessionState({
        officerBadge: null,
        officerName: null,
        officerRole: null,
      });
    }
  });
}

export const sessionActions = {
  setActiveCase: (caseId: string | null, title?: string) => {
    setSessionState({
      activeCaseId: caseId,
      activeCaseTitle: title || null,
    });
  },
  
  setActiveCall: (callId: string | null, title?: string) => {
    setSessionState({
      activeCallId: callId,
      activeCallTitle: title || null,
    });
  },
  
  clearActiveCase: () => {
    setSessionState({
      activeCaseId: null,
      activeCaseTitle: null,
    });
  },
  
  clearActiveCall: () => {
    setSessionState({
      activeCallId: null,
      activeCallTitle: null,
    });
  },
  
  setRadioChannel: (channel: string | null) => {
    setSessionState('radioChannel', channel);
    if (channel) {
      setSessionState('radioStatus', 'connected');
    } else {
      setSessionState('radioStatus', 'disconnected');
    }
  },
  
  setRadioStatus: (status: SessionState['radioStatus']) => {
    setSessionState('radioStatus', status);
  },
  
  toggleVisibility: () => {
    setSessionState('isVisible', (prev) => !prev);
  },
  
  toggleExpanded: () => {
    setSessionState('isExpanded', (prev) => !prev);
  },
  
  show: () => {
    setSessionState('isVisible', true);
  },
  
  hide: () => {
    setSessionState('isVisible', false);
  },
  
  initialize: () => {
    syncSessionWithCAD();
    syncSessionWithUser();
  },
  
  hasActiveContext: (): boolean => {
    return !!(
      sessionState.activeCaseId ||
      sessionState.activeCallId ||
      sessionState.radioChannel
    );
  },
  
  getContextSummary: (): string => {
    const parts: string[] = [];
    if (sessionState.activeCaseId) {
      parts.push(`Case: ${sessionState.activeCaseId}`);
    }
    if (sessionState.activeCallId) {
      parts.push(`Call: ${sessionState.activeCallId}`);
    }
    if (sessionState.radioChannel) {
      parts.push(`Ch: ${sessionState.radioChannel}`);
    }
    return parts.join(' | ') || 'No active context';
  },
};
