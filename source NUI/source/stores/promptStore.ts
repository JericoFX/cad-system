
import { createSignal } from 'solid-js';

export type PromptType = 'text' | 'confirm' | 'select';

export interface PromptState {
  isActive: boolean;
  type: PromptType | null;
  question: string;
  options?: string[];
  resolve: ((value: string | boolean) => void) | null;
}

export const [isActive, setIsActive] = createSignal(false);
export const [promptType, setPromptType] = createSignal<PromptType | null>(null);
export const [question, setQuestion] = createSignal('');
export const [options, setOptions] = createSignal<string[] | undefined>(undefined);
let currentResolve: ((value: string | boolean) => void) | null = null;

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
      
      currentResolve = (value: string | boolean) => {
        resetState();
        resolve(value as string);
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
      
      currentResolve = (value: string | boolean) => {
        resetState();
        resolve(value as boolean);
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
      
      currentResolve = (value: string | boolean) => {
        resetState();
        resolve(value as string);
      };

      setQuestion(q);
      setPromptType('select');
      setOptions(opts);
      setIsActive(true);
    });
  },

  submit: (value: string | boolean) => {
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
