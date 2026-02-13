
import { createSignal } from 'solid-js';

export type PromptType = 'text' | 'confirm' | 'select';

export interface PromptState {
  isActive: boolean;
  type: PromptType | null;
  question: string;
  options?: string[];
  resolve: ((value: any) => void) | null;
}

export const [isActive, setIsActive] = createSignal(false);
export const [promptType, setPromptType] = createSignal<PromptType | null>(null);
export const [question, setQuestion] = createSignal('');
export const [options, setOptions] = createSignal<string[] | undefined>(undefined);
let currentResolve: ((value: any) => void) | null = null;

export const promptState: PromptState = {
  get isActive() { return isActive(); },
  get type() { return promptType(); },
  get question() { return question(); },
  get options() { return options(); },
  get resolve() { return currentResolve; },
};

const resetState = () => {
  setIsActive(false);
  setPromptType(null);
  setQuestion('');
  setOptions(undefined);
  currentResolve = null;
};

export const promptActions = {
  prompt: (q: string): Promise<string> => {
    return new Promise((resolve) => {
      if (currentResolve) {
        currentResolve('');
      }
      
      currentResolve = (value: string) => {
        resetState();
        resolve(value);
      };
      
      setQuestion(q);
      setPromptType('text');
      setOptions(undefined);
      setIsActive(true);
    });
  },

  confirm: (q: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (currentResolve) {
        currentResolve(false);
      }
      
      currentResolve = (value: boolean) => {
        resetState();
        resolve(value);
      };
      
      setQuestion(q);
      setPromptType('confirm');
      setOptions(undefined);
      setIsActive(true);
    });
  },

  select: (q: string, opts: string[]): Promise<string> => {
    return new Promise((resolve) => {
      if (currentResolve) {
        currentResolve('');
      }
      
      currentResolve = (value: string) => {
        resetState();
        resolve(value);
      };
      
      setQuestion(q);
      setPromptType('select');
      setOptions(opts);
      setIsActive(true);
    });
  },

  submit: (value: any) => {
    if (!isActive()) {
      return;
    }
    
    if (currentResolve) {
      const resolve = currentResolve;
      currentResolve = null;
      resolve(value);
    } else {
      resetState();
    }
  },

  cancel: () => {
    if (!isActive()) {
      return;
    }
    
    if (currentResolve) {
      const type = promptType();
      if (type === 'text') currentResolve('');
      else if (type === 'confirm') currentResolve(false);
      else if (type === 'select') currentResolve('');
      currentResolve = null;
    }
    resetState();
  },
};
