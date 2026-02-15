
import type { FiveMBridge } from '~/utils/terminal/types';

export type ArgType = 'string' | 'number' | 'boolean' | 'array';

export interface ArgConfig {
  name: string;
  type: ArgType;
  required?: boolean;
  default?: any;
  description?: string;
  validate?: (value: any) => boolean | string;
}

export interface FlagConfig {
  name: string;
  alias?: string;
  type?: 'string' | 'number' | 'boolean';
  default?: any;
  description?: string;
}

export interface TerminalAPI {
  print(text: string, type?: 'info' | 'success' | 'error' | 'warning' | 'command' | 'system'): void;
  
  printTable(headers: string[], rows: string[][]): void;
  
  printList(items: string[], bullet?: string): void;
  
  printJSON(data: any): void;
  
  printCard(title: string, fields: Record<string, string>): void;
  
  clear(): void;
  
  progress(char: string | string[], durationMs: number): Promise<void>;
  
  showLoading(text: string): () => void;
  
  prompt(question: string): Promise<string>;
  
  confirm(question: string): Promise<boolean>;
  
  select(question: string, options: string[]): Promise<string>;
  
  openModal(modalName: string, data?: any): void;
  
  closeModal(): void;
  
  wait(ms: number): Promise<void>;
  
  newLine(): void;
  
  clearLine(): void;
}

export interface UserContext {
  id: string;
  name: string;
  badge: string;
  roles: string[];
  hasPermission(permission: string): boolean;
}

export interface ValidatedArgs {
  [key: string]: any;
}

export interface CommandHandlerContext {
  args: ValidatedArgs;
  
  rawArgs: string[];
  
  flags: Record<string, string | boolean>;
  
  terminal: TerminalAPI;
  
  fivem: FiveMBridge;
  
  user: UserContext;
  
  rawInput: string;
}

export interface CommandConfig {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category?: string;
  permissions?: string[];
  args?: ArgConfig[];
  flags?: FlagConfig[];
  handler: (ctx: CommandHandlerContext) => Promise<void> | void;
}

export interface SubcommandConfig {
  description: string;
  handler: (ctx: CommandHandlerContext) => Promise<void> | void;
}

export interface RegisteredCommand extends CommandConfig {
  subcommands?: Map<string, SubcommandConfig>;
}
