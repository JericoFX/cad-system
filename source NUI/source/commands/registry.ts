import { terminalActions } from '~/stores/terminalStore';
import { suggestionsActions } from '~/stores/suggestionsStore';
import { auditActions } from '~/stores/auditStore';

export interface CommandContext {
  args: string[];
  flags: Record<string, string | boolean>;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void> | void;

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  handler: CommandHandler;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();

  register(command: Command): void {
    this.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  get(name: string): Command | undefined {
    const commandName = this.aliases.get(name) || name;
    return this.commands.get(commandName);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  async execute(input: string): Promise<void> {
    const parts = input.trim().split(/\s+/);
    const name = parts[0].toLowerCase();
    const args: string[] = [];
    const flags: Record<string, string | boolean> = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('--')) {
        const flag = part.slice(2);
        const eqIndex = flag.indexOf('=');
        if (eqIndex > 0) {
          flags[flag.slice(0, eqIndex)] = flag.slice(eqIndex + 1);
        } else {
          flags[flag] = true;
        }
      } else if (part.startsWith('-')) {
        flags[part.slice(1)] = true;
      } else {
        args.push(part);
      }
    }

    const command = this.get(name);
    if (!command) {
      terminalActions.addLine(`Unknown command: ${name}`, 'error');
      terminalActions.addLine('Type "help" for available commands', 'system');

      suggestionsActions.showErrorSuggestions(name);
      return;
    }

    terminalActions.setProcessing(true);
    try {
      await command.handler({ args, flags });

      auditActions.logSuccess(name, args);

      const fullCommand = args.length > 0 ? `${name} ${args[0]}` : name;
      suggestionsActions.showSuggestions(fullCommand, 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      terminalActions.addLine(`Error: ${errorMessage}`, 'error');

      auditActions.logError(name, args, errorMessage);
    } finally {
      terminalActions.setProcessing(false);
    }
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }
}

export const registry = new CommandRegistry();
