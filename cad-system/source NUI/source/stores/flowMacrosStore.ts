
import { createStore } from 'solid-js/store';
import { terminalActions } from './terminalStore';
import { registry } from '~/commands/registry';
import { featureActions } from './featureStore';

export type FlowStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error';

export interface FlowStep {
  id: string;
  name: string;
  description: string;
  command?: string;
  modal?: string;
  action?: () => void;
  status: FlowStepStatus;
  canSkip: boolean;
}

export interface FlowMacro {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'incident' | 'arrest' | 'evidence' | 'dispatch';
  steps: FlowStep[];
}

interface FlowState {
  isRunning: boolean;
  currentMacro: FlowMacro | null;
  currentStepIndex: number;
  showUI: boolean;
  completedFlows: string[];
}

const FLOW_MACROS: FlowMacro[] = [
  {
    id: 'new-incident',
    name: 'New Incident Pack',
    description: 'Complete workflow: Dispatch → Create Case → Add Note',
    icon: '🚨',
    category: 'incident',
    steps: [
      {
        id: 'open-dispatch',
        name: 'Open Dispatch',
        description: 'View active calls and units',
        modal: 'DISPATCH_PANEL',
        status: 'pending',
        canSkip: true,
      },
      {
        id: 'create-case',
        name: 'Create Case',
        description: 'Create new case from dispatch call',
        modal: 'CASE_CREATOR',
        status: 'pending',
        canSkip: false,
      },
      {
        id: 'add-note',
        name: 'Add First Note',
        description: 'Document initial observations',
        command: 'addnote',
        status: 'pending',
        canSkip: true,
      },
    ],
  },
  {
    id: 'arrest-pack',
    name: 'Arrest Pack',
    description: 'Arrest workflow: Wizard → Case Note → Evidence',
    icon: '⛓️',
    category: 'arrest',
    steps: [
      {
        id: 'arrest-wizard',
        name: 'Arrest Wizard',
        description: 'Process arrest with full details',
        modal: 'ARREST_WIZARD',
        status: 'pending',
        canSkip: false,
      },
      {
        id: 'case-note',
        name: 'Add Case Note',
        description: 'Document arrest in case file',
        command: 'addnote',
        status: 'pending',
        canSkip: true,
      },
      {
        id: 'add-evidence',
        name: 'Upload Evidence',
        description: 'Add photos, fingerprints, etc.',
        command: 'addevidence',
        status: 'pending',
        canSkip: true,
      },
    ],
  },
  {
    id: 'evidence-pack',
    name: 'Evidence Pack',
    description: 'Evidence workflow: Upload → Chain Timeline',
    icon: '📎',
    category: 'evidence',
    steps: [
      {
        id: 'open-evidence',
        name: 'Evidence Manager',
        description: 'View current case evidence',
        modal: 'EVIDENCE',
        status: 'pending',
        canSkip: true,
      },
      {
        id: 'upload-evidence',
        name: 'Upload Evidence',
        description: 'Upload photos, documents, videos',
        modal: 'UPLOAD',
        status: 'pending',
        canSkip: false,
      },
      {
        id: 'view-chain',
        name: 'Chain of Custody',
        description: 'Review evidence timeline',
        command: 'evidence chain',
        status: 'pending',
        canSkip: true,
      },
    ],
  },
  {
    id: 'traffic-stop',
    name: 'Traffic Stop Pack',
    description: 'Quick traffic stop: Search → Fine → BOLO Check',
    icon: '🚔',
    category: 'incident',
    steps: [
      {
        id: 'search-vehicle',
        name: 'Search Vehicle',
        description: 'Check plates and registration',
        modal: 'VEHICLE_SEARCH',
        status: 'pending',
        canSkip: false,
      },
      {
        id: 'search-person',
        name: 'Search Driver',
        description: 'Check driver license and warrants',
        modal: 'PERSON_SEARCH',
        status: 'pending',
        canSkip: true,
      },
      {
        id: 'check-bolo',
        name: 'Check BOLO',
        description: 'Verify against active BOLOs',
        command: 'bolo check',
        status: 'pending',
        canSkip: true,
      },
    ],
  },
];

const initialState: FlowState = {
  isRunning: false,
  currentMacro: null,
  currentStepIndex: 0,
  showUI: false,
  completedFlows: [],
};

export const [flowState, setFlowState] = createStore<FlowState>(initialState);

const isMacroEnabled = (macro: FlowMacro): boolean => {
  for (let i = 0; i < macro.steps.length; i++) {
    const modal = macro.steps[i].modal;
    if (modal && !featureActions.isModalEnabled(modal)) {
      return false;
    }
  }
  return true;
};

export const flowMacrosActions = {
  getAllMacros: (): FlowMacro[] => FLOW_MACROS.filter(isMacroEnabled),
  
  getMacrosByCategory: (category: FlowMacro['category']): FlowMacro[] => {
    return FLOW_MACROS.filter((m) => m.category === category && isMacroEnabled(m));
  },
  
  startFlow: (macroId: string) => {
    const macro = FLOW_MACROS.find((m) => m.id === macroId && isMacroEnabled(m));
    if (!macro) return;
    
    const freshMacro = {
      ...macro,
      steps: macro.steps.map((s) => ({ ...s, status: 'pending' as FlowStepStatus })),
    };
    
    setFlowState({
      isRunning: true,
      currentMacro: freshMacro,
      currentStepIndex: 0,
      showUI: true,
    });
    
    terminalActions.addLine(`Starting flow: ${macro.name}`, 'system');
    flowMacrosActions.executeCurrentStep();
  },
  
  executeCurrentStep: () => {
    const macro = flowState.currentMacro;
    if (!macro) return;
    
    const step = macro.steps[flowState.currentStepIndex];
    if (!step) {
      flowMacrosActions.completeFlow();
      return;
    }
    
    setFlowState('currentMacro', 'steps', flowState.currentStepIndex, 'status', 'running');
    
    if (step.modal) {
      terminalActions.setActiveModal(step.modal);
      terminalActions.addLine(`Step ${flowState.currentStepIndex + 1}: ${step.name}`, 'system');
    } else if (step.command) {
      registry.execute(step.command);
      setFlowState('currentMacro', 'steps', flowState.currentStepIndex, 'status', 'completed');
      flowMacrosActions.nextStep();
    } else if (step.action) {
      step.action();
      setFlowState('currentMacro', 'steps', flowState.currentStepIndex, 'status', 'completed');
      flowMacrosActions.nextStep();
    }
  },
  
  completeCurrentStep: () => {
    if (!flowState.currentMacro) return;
    
    setFlowState('currentMacro', 'steps', flowState.currentStepIndex, 'status', 'completed');
    flowMacrosActions.nextStep();
  },
  
  skipCurrentStep: () => {
    if (!flowState.currentMacro) return;
    
    const step = flowState.currentMacro.steps[flowState.currentStepIndex];
    if (!step.canSkip) {
      terminalActions.addLine(`Cannot skip required step: ${step.name}`, 'error');
      return;
    }
    
    setFlowState('currentMacro', 'steps', flowState.currentStepIndex, 'status', 'skipped');
    terminalActions.addLine(`Skipped: ${step.name}`, 'system');
    flowMacrosActions.nextStep();
  },
  
  nextStep: () => {
    const nextIndex = flowState.currentStepIndex + 1;
    
    if (nextIndex >= (flowState.currentMacro?.steps.length || 0)) {
      flowMacrosActions.completeFlow();
    } else {
      setFlowState('currentStepIndex', nextIndex);
      setTimeout(() => flowMacrosActions.executeCurrentStep(), 500);
    }
  },
  
  completeFlow: () => {
    if (!flowState.currentMacro) return;
    
    const macroName = flowState.currentMacro.name;
    terminalActions.addLine(`✓ Flow completed: ${macroName}`, 'system');
    
    setFlowState((prev) => ({
      ...initialState,
      completedFlows: [...prev.completedFlows, flowState.currentMacro!.id],
    }));
  },
  
  cancelFlow: () => {
    if (!flowState.currentMacro) return;
    
    terminalActions.addLine(`Flow cancelled: ${flowState.currentMacro.name}`, 'error');
    setFlowState(initialState);
  },
  
  hideUI: () => {
    setFlowState('showUI', false);
  },
  
  showUI: () => {
    setFlowState('showUI', true);
  },
  
  toggleUI: () => {
    setFlowState('showUI', (v) => !v);
  },
  
  getCurrentStep: (): FlowStep | null => {
    if (!flowState.currentMacro) return null;
    return flowState.currentMacro.steps[flowState.currentStepIndex] || null;
  },
  
  getProgress: (): number => {
    if (!flowState.currentMacro) return 0;
    const completed = flowState.currentMacro.steps.filter(
      (s) => s.status === 'completed' || s.status === 'skipped'
    ).length;
    return Math.round((completed / flowState.currentMacro.steps.length) * 100);
  },
};
