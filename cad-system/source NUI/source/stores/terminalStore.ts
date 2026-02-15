import { createStore } from 'solid-js/store';
import { generateMiniBoot } from '~/utils/ascii';
import { featureActions } from './featureStore';
import { hackerActions, hackerEffects } from './hackerStore';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: number;
}

interface TerminalState {
  lines: TerminalLine[];
  history: string[];
  historyIndex: number;
  isProcessing: boolean;
  currentPath: string;
  activeModal: string | null;
  modalData: unknown;
}

const bootLines = generateMiniBoot().map((content, index) => ({
  id: `boot-${index}`,
  type: 'system' as const,
  content,
  timestamp: Date.now() + index,
}));

const initialState: TerminalState = {
  lines: bootLines,
  history: [],
  historyIndex: -1,
  isProcessing: false,
  currentPath: '/',
  activeModal: null,
  modalData: null,
};

export const [terminalState, setTerminalState] = createStore(initialState);

export const terminalActions = {
  addLine: (content: string, type: TerminalLine['type'] = 'output', id?: string) => {
    const line: TerminalLine = {
      id: id || Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: Date.now(),
    };
    setTerminalState('lines', (prev) => [...prev, line]);
    return line.id;
  },
  
  updateLine: (id: string, content: string, type?: TerminalLine['type']) => {
    setTerminalState('lines', (prev) =>
      prev.map((line) =>
        line.id === id
          ? { ...line, content, ...(type && { type }), timestamp: Date.now() }
          : line
      )
    );
  },
  
  addOrUpdateLine: (id: string, content: string, type: TerminalLine['type'] = 'output') => {
    const existingLine = terminalState.lines.find((line) => line.id === id);
    if (existingLine) {
      terminalActions.updateLine(id, content, type);
    } else {
      terminalActions.addLine(content, type, id);
    }
  },
  
  addInput: (command: string) => {
    terminalActions.addLine(`> ${command}`, 'input');
    setTerminalState('history', (prev) => [...prev, command]);
  },
  
  setProcessing: (processing: boolean) => setTerminalState('isProcessing', processing),
  
  getHistoryItem: (direction: 'up' | 'down'): string | null => {
    const { history, historyIndex } = terminalState;
    if (history.length === 0) return null;
    
    let newIndex = historyIndex;
    if (direction === 'up') {
      newIndex = Math.min(newIndex + 1, history.length - 1);
    } else {
      newIndex = Math.max(newIndex - 1, -1);
    }
    
    setTerminalState('historyIndex', newIndex);
    return newIndex >= 0 ? history[history.length - 1 - newIndex] : null;
  },
  
  resetHistoryIndex: () => setTerminalState('historyIndex', -1),
  
  setActiveModal: (modal: string | null, data?: unknown) => {
    if (modal && !featureActions.isModalEnabled(modal)) {
      return;
    }

    setTerminalState('modalData', data ?? null);
    setTerminalState('activeModal', modal);
    
    // Emit hacker command when modal opens
    if (modal) {
      hackerActions.onModalOpen(modal);
      hackerEffects.burst(2);
    }
  },
  
  clear: () => {
    setTerminalState('lines', [
      {
        id: 'cleared',
        type: 'system',
        content: '=== SCREEN CLEARED ===',
        timestamp: Date.now(),
      },
    ]);
  },
  
  clearAll: () => {
    setTerminalState({ ...initialState });
  },
};
