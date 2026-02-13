
export type CommandType = 'string' | 'number' | 'boolean' | 'choice';

export interface CommandArg {
  name: string;
  type: CommandType;
  required?: boolean;
  default?: any;
  choices?: string[];
  description?: string;
}

export interface TerminalCommand {
  name: string;
  description: string;
  category: string;
  permissions?: string[];
  args: CommandArg[];
  interactive?: boolean;
  format: 'table' | 'list' | 'json' | 'card' | 'custom';
  handler: (ctx: CommandContext) => Promise<void>;
}

export interface UserInfo {
  id: string;
  name: string;
  roles: string[];
  hasPermission: (permission: string) => boolean;
}

export interface FiveMBridge {
  fetch: (eventName: string, data?: any) => Promise<any>;
  emit: (eventName: string, data?: any) => void;
  isBrowser: () => boolean;
}

export interface TerminalAPI {
  print(text: string, type?: 'info' | 'success' | 'error' | 'warning' | 'command'): void;
  printTable(data: any[], columns?: string[]): void;
  printList(items: string[]): void;
  printJSON(data: any): void;
  printCard(title: string, fields: Record<string, string>): void;
  clear(): void;
  prompt(question: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
  select(question: string, options: string[]): Promise<string>;
  showLoading(text: string): () => void;
  progress(char: string | string[], durationMs: number): Promise<void>;
  newLine(): void;
  wait(ms: number): Promise<void>;
  clearLine(): void;
  openComponent(componentName: string, props?: Record<string, any>): void;
}

export interface CommandContext {
  args: Record<string, any>;
  flags: Record<string, boolean>;
  terminal: TerminalAPI;
  fivem: FiveMBridge;
  user: UserInfo;
  rawInput: string;
}

export interface ParsedCommand {
  name: string;
  args: Record<string, any>;
  flags: Record<string, boolean>;
}

export interface TerminalHistoryEntry {
  type: 'command' | 'output' | 'error' | 'system' | 'info' | 'success' | 'warning';
  content: string;
  timestamp: number;
}
