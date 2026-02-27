import './commands/clear';
import './commands/help';
import './commands/view-vehicles';
import './commands/view-reports';
import './commands/view-citizen-reports';
import './commands/add-report';
import './commands/debug/demo-choice';
import './commands/debug/boot-system';
import './commands/debug/scandisk';

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
