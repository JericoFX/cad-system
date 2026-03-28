
import { createStore } from 'solid-js/store';

export type SuggestionType = 'success' | 'error' | 'contextual';

export interface Suggestion {
  id: string;
  command: string;
  description: string;
  type: SuggestionType;
  timestamp: number;
}

interface SuggestionsState {
  suggestions: Suggestion[];
  lastCommand: string | null;
  isVisible: boolean;
}

const initialState: SuggestionsState = {
  suggestions: [],
  lastCommand: null,
  isVisible: false,
};

export const [suggestionsState, setSuggestionsState] = createStore<SuggestionsState>(initialState);

export const COMMAND_SUGGESTIONS: Record<string, string[]> = {
  'case': ['addnote', 'addevidence', 'task add', 'notes', 'evidence'],
  'case create': ['addnote', 'addevidence', 'task add', 'dispatch view'],
  'case view': ['addnote', 'addevidence', 'task add', 'notes', 'case close'],
  'addnote': ['addnote', 'addevidence', 'notes', 'case view'],
  'addevidence': ['evidence', 'addnote', 'case view'],
  'search-person': ['arrest', 'bolo add', 'fine issue', 'warrant create'],
  'search-vehicle': ['bolo add', 'impound', 'fine issue'],
  'arrest': ['case create', 'fine issue', 'evidence'],
  'dispatch': ['case create', 'unit assign', 'bolo add'],
  'dispatch view': ['case create', 'bolo add', 'unit assign'],
  'bolo': ['search-person', 'search-vehicle', 'dispatch view'],
  'bolo add': ['dispatch view', 'search-person', 'search-vehicle'],
  'fine': ['fine issue', 'fine list', 'fine lookup'],
  'fine issue': ['fine list', 'case create'],
  'evidence': ['addevidence', 'case view', 'evidence upload'],
  'notes': ['addnote', 'notes file', 'case view'],
  'license': ['license issue', 'license view', 'license list'],
  'property': ['property view', 'property list'],
  'fleet': ['fleet view', 'fleet list'],
  'radio': ['radio panel', 'radio markers'],
  'ems': ['ems dashboard', 'triage', 'treatment'],
  'triage': ['treatment', 'ems dashboard', 'case create'],
  'treatment': ['triage', 'ems dashboard'],
  'police': ['police dashboard', 'dispatch view', 'bolo'],
  'news': ['news create', 'news list'],
  'warrant': ['warrant create', 'warrant list'],
  'impound': ['evidence', 'case create'],
};

export function getErrorSuggestions(attemptedCommand: string): string[] {
  const suggestions: string[] = [];
  
  const commandMap: Record<string, string[]> = {
    'cse': ['case'],
    'cas': ['case'],
    'evidnce': ['evidence'],
    'evidenc': ['evidence'],
    'dispath': ['dispatch'],
    'dispach': ['dispatch'],
    'serch': ['search-person', 'search-vehicle'],
    'seach': ['search-person', 'search-vehicle'],
    'arrests': ['arrest'],
    'bol': ['bolo'],
    'boloo': ['bolo'],
    'fne': ['fine'],
    'helpp': ['help'],
    'not': ['notes'],
    'note': ['notes'],
    'warent': ['warrant'],
    'warrent': ['warrant'],
    'radioo': ['radio'],
    'lisense': ['license'],
    'licence': ['license'],
    'proper': ['property'],
    'propertee': ['property'],
    'flet': ['fleet'],
    'fleat': ['fleet'],
  };
  
  const attempted = attemptedCommand.toLowerCase();
  
  if (commandMap[attempted]) {
    suggestions.push(...commandMap[attempted]);
  }
  
  if (attempted.includes('search')) {
    suggestions.push('search-person', 'search-vehicle');
  }
  if (attempted.includes('case')) {
    suggestions.push('case create', 'case view', 'case select');
  }
  if (attempted.includes('fine')) {
    suggestions.push('fine list', 'fine issue', 'fine lookup');
  }
  if (attempted.includes('note')) {
    suggestions.push('notes', 'addnote', 'notegui');
  }
  
  return [...new Set(suggestions)];
}

export const suggestionsActions = {
  showSuggestions: (command: string, type: SuggestionType = 'success') => {
    const suggestedCommands = COMMAND_SUGGESTIONS[command] || [];
    
    if (suggestedCommands.length === 0) {
      setSuggestionsState('isVisible', false);
      return;
    }
    
    const newSuggestions: Suggestion[] = suggestedCommands.map((cmd) => ({
      id: Math.random().toString(36).substr(2, 9),
      command: cmd,
      description: getCommandDescription(cmd),
      type,
      timestamp: Date.now(),
    }));
    
    setSuggestionsState({
      suggestions: newSuggestions,
      lastCommand: command,
      isVisible: true,
    });
    
    setTimeout(() => {
      suggestionsActions.hide();
    }, 30000);
  },
  
  showErrorSuggestions: (attemptedCommand: string) => {
    const errorSuggestions = getErrorSuggestions(attemptedCommand);
    
    if (errorSuggestions.length === 0) {
      errorSuggestions.push('help', 'search-person', 'dispatch view');
    }
    
    const newSuggestions: Suggestion[] = errorSuggestions.map((cmd) => ({
      id: Math.random().toString(36).substr(2, 9),
      command: cmd,
      description: getCommandDescription(cmd),
      type: 'error',
      timestamp: Date.now(),
    }));
    
    setSuggestionsState({
      suggestions: newSuggestions,
      lastCommand: attemptedCommand,
      isVisible: true,
    });
  },
  
  hide: () => {
    setSuggestionsState('isVisible', false);
  },
  
  clear: () => {
    setSuggestionsState({
      suggestions: [],
      lastCommand: null,
      isVisible: false,
    });
  },
  
  dismissSuggestion: (id: string) => {
    setSuggestionsState('suggestions', (prev) => 
      prev.filter((s) => s.id !== id)
    );
    if (suggestionsState.suggestions.length === 0) {
      setSuggestionsState('isVisible', false);
    }
  },
};

function getCommandDescription(command: string): string {
  const descriptions: Record<string, string> = {
    'addnote': 'Add note to current case',
    'addevidence': 'Add evidence to staging',
    'task add': 'Add task to case',
    'notes': 'Open notes editor',
    'evidence': 'Open evidence manager',
    'case create': 'Create new case',
    'case view': 'View case details',
    'case close': 'Close current case',
    'dispatch view': 'Open dispatch panel',
    'search-person': 'Search person database',
    'search-vehicle': 'Search vehicle database',
    'arrest': 'Process arrest',
    'bolo': 'Manage BOLOs',
    'bolo add': 'Create new BOLO',
    'fine issue': 'Issue fine/ticket',
    'fine list': 'List fines',
    'help': 'Show command guide',
    'license': 'Manage licenses',
    'property': 'Manage properties',
    'fleet': 'Manage fleet',
    'radio': 'Radio controls',
    'ems': 'EMS dashboard',
    'police': 'Police dashboard',
    'warrant': 'Manage warrants',
    'impound': 'Impound vehicle',
    'triage': 'Triage patient',
    'treatment': 'Patient treatment',
  };
  
  return descriptions[command] || 'Run command';
}

export function getContextualSuggestions(): string[] {
  const suggestions: string[] = [];
  
  
  return suggestions;
}
