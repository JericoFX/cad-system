
import { registry } from './registry';
import { terminalAPI } from './terminalApi';
import { cadState } from '~/stores/cadStore';
import { userState } from '~/stores/userStore';
import { createFiveMBridge } from '~/utils/terminal/fivem-bridge';
import { CONFIG } from '~/config';

import type {
  CommandConfig,
  CommandHandlerContext,
  ValidatedArgs,
  ArgConfig,
  FlagConfig,
  SubcommandConfig,
  UserContext
} from './types';

const fivem = createFiveMBridge();

const getRuntimeRoles = (): string[] => {
  if (CONFIG.USE_MOCK_DATA && CONFIG.MOCK_BYPASS_ROLE_GUARDS) {
    return ['admin', 'police', 'ems', 'dispatch', 'news', 'civilian'];
  }

  const role = userState.currentUser?.role;
  if (!role) {
    return [];
  }

  return role === 'admin' ? ['admin', role] : [role];
};

const user: UserContext = {
  get id() {
    return userState.currentUser?.id || CONFIG.MOCK_USER.id || 'OFFICER_001';
  },
  get name() {
    return userState.currentUser?.name || CONFIG.MOCK_USER.name || 'Officer';
  },
  get badge() {
    return userState.currentUser?.badge || CONFIG.MOCK_USER.badge || 'B-001';
  },
  get roles() {
    return getRuntimeRoles();
  },
  hasPermission(permission: string): boolean {
    if (CONFIG.USE_MOCK_DATA && CONFIG.MOCK_BYPASS_ROLE_GUARDS) {
      return true;
    }

    const roles = getRuntimeRoles();
    return roles.includes(permission) || roles.includes('admin');
  },
};

function validateArgs(
  rawArgs: string[],
  rawFlags: Record<string, string | boolean>,
  argsConfig: ArgConfig[] = [],
  flagsConfig: FlagConfig[] = []
): { valid: boolean; args: ValidatedArgs; errors: string[] } {
  const result: ValidatedArgs = {};
  const errors: string[] = [];

  argsConfig.forEach((config, index) => {
    const value = rawArgs[index];

    if (config.required && (value === undefined || value === '')) {
      errors.push(`Missing required argument: ${config.name}`);
      return;
    }

    let parsedValue: any = value;

    if (value !== undefined) {
      switch (config.type) {
        case 'number':
          parsedValue = parseFloat(value);
          if (isNaN(parsedValue)) {
            errors.push(`Argument ${config.name} must be a number`);
            return;
          }
          break;
        case 'boolean':
          parsedValue = value.toLowerCase() === 'true' || value === '1';
          break;
        case 'array':
          parsedValue = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
      }
    } else if (config.default !== undefined) {
      parsedValue = config.default;
    }

    if (config.validate && value !== undefined) {
      const validation = config.validate(parsedValue);
      if (validation !== true) {
        errors.push(typeof validation === 'string' ? validation : `Invalid value for ${config.name}`);
        return;
      }
    }

    result[config.name] = parsedValue;
  });

  flagsConfig.forEach((config) => {
    let value: string | boolean | undefined = rawFlags[config.name];

    if (value === undefined && config.alias) {
      value = rawFlags[config.alias];
    }

    let processedValue: any = value;

    if (value !== undefined) {
      switch (config.type) {
        case 'number':
          processedValue = parseFloat(value as string);
          break;
        case 'boolean':
          processedValue = value === 'true' || value === '1' || value === true;
          break;
        default:
          processedValue = value;
      }
    } else if (config.default !== undefined) {
      processedValue = config.default;
    }

    result[config.name] = processedValue;
  });

  return {
    valid: errors.length === 0,
    args: result,
    errors
  };
}

export function createCommand(config: CommandConfig): void {
  const mainHandler = async (rawInput: string, rawArgs: string[], rawFlags: Record<string, string | boolean>) => {
    if (config.args || config.flags) {
      const validation = validateArgs(rawArgs, rawFlags, config.args, config.flags);

      if (!validation.valid) {
        validation.errors.forEach(error => {
          terminalAPI.print(`[ERROR] ${error}`, 'error');
        });
        if (config.usage) {
          terminalAPI.print(`Usage: ${config.usage}`, 'system');
        }
        return;
      }

      if (config.permissions && config.permissions.length > 0) {
        const hasPermission = config.permissions.every(p => user.hasPermission(p));
        if (!hasPermission) {
          terminalAPI.print('[ERROR] You do not have permission to use this command', 'error');
          return;
        }
      }

      const ctx: CommandHandlerContext = {
        args: validation.args,
        rawArgs,
        flags: rawFlags,
        terminal: terminalAPI,
        fivem,
        user,
        rawInput
      };

      await config.handler(ctx);
    } else {
      const ctx: CommandHandlerContext = {
        args: {},
        rawArgs,
        flags: rawFlags,
        terminal: terminalAPI,
        fivem,
        user,
        rawInput
      };

      await config.handler(ctx);
    }
  };

  registry.register({
    name: config.name,
    aliases: config.aliases,
    description: config.description,
    usage: config.usage || `${config.name} [...args]`,
    handler: async (ctx) => {
      await mainHandler('', ctx.args, ctx.flags);
    }
  });
}

export function createCommandWithSubcommands(
  config: Omit<CommandConfig, 'handler'> & {
    subcommands: Record<string, SubcommandConfig>;
    defaultSubcommand?: string;
  }
): void {
  const subcommandMap = new Map(Object.entries(config.subcommands));

  createCommand({
    ...config,
    handler: async (ctx) => {
      const subcommandName = ctx.rawArgs[0]?.toLowerCase();

      if (!subcommandName) {
        if (config.defaultSubcommand && subcommandMap.has(config.defaultSubcommand)) {
          const handler = subcommandMap.get(config.defaultSubcommand)!.handler;
          await handler(ctx);
        } else {
          terminalAPI.print(`=== ${config.name.toUpperCase()} COMMANDS ===`, 'system');
          terminalAPI.newLine();
          subcommandMap.forEach((sub, name) => {
            terminalAPI.print(`  ${name.padEnd(12)} - ${sub.description}`, 'info');
          });
        }
        return;
      }

      const subcommand = subcommandMap.get(subcommandName);

      if (!subcommand) {
        const matches = Array.from(subcommandMap.keys()).filter(name =>
          name.startsWith(subcommandName) || name.includes(subcommandName)
        );

        if (matches.length === 1) {
          await subcommandMap.get(matches[0])!.handler(ctx);
        } else if (matches.length > 1) {
          terminalAPI.print(`[ERROR] Ambiguous subcommand "${subcommandName}"`, 'error');
          terminalAPI.print(`Did you mean: ${matches.join(', ')}?`, 'system');
        } else {
          terminalAPI.print(`[ERROR] Unknown subcommand: ${subcommandName}`, 'error');
          terminalAPI.print(`Type '${config.name}' to see available commands`, 'system');
        }
        return;
      }

      await subcommand.handler(ctx);
    }
  });
}

export function requireCaseLoaded(ctx: CommandHandlerContext): string | null {
  const currentCase = cadState.currentCase;
  if (!currentCase) {
    ctx.terminal.print('[ERROR] No case loaded.', 'error');
    ctx.terminal.print('Create a case: case create <type> <title>', 'system');
    ctx.terminal.print('Or select one: case select', 'system');
    return null;
  }
  return currentCase.caseId;
}

export function requirePermission(ctx: CommandHandlerContext, permission: string): boolean {
  if (!ctx.user.hasPermission(permission)) {
    ctx.terminal.print(`[ERROR] Permission denied: ${permission}`, 'error');
    return false;
  }
  return true;
}

export function getCaseId(ctx: CommandHandlerContext, argIndex: number = 0): string | null {
  const explicitId = ctx.rawArgs[argIndex];
  if (explicitId) {
    return explicitId;
  }
  return requireCaseLoaded(ctx);
}

export type { CommandConfig, CommandHandlerContext } from './types';
