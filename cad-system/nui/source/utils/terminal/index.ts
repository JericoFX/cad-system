import './commands/clear';
import './commands/help';
import './commands/view-vehicles';
import './commands/view-reports';
import './commands/view-citizen-reports';
import './commands/add-report';
import './commands/demo-choice';
import './commands/boot-system';
import './commands/scandisk';
import './commands/load-database';

export { commandRegistry, defineCommand, parseCommand } from './registry';
export { createFiveMBridge, createMockUser } from './fivem-bridge';
export type {
  CommandType,
  CommandArg,
  TerminalCommand,
  UserInfo,
  FiveMBridge,
  TerminalAPI,
  CommandContext,
  ParsedCommand,
  TerminalHistoryEntry
} from './types';
