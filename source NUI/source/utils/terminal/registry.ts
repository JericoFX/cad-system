import type { TerminalCommand, ParsedCommand } from './types';

class CommandRegistry {
  private commands = new Map<string, TerminalCommand>();
  
  register(command: TerminalCommand): void {
    this.commands.set(command.name.toLowerCase(), command);
  }
  
  registerMultiple(commands: TerminalCommand[]): void {
    commands.forEach(cmd => this.register(cmd));
  }
  
  get(name: string): TerminalCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }
  
  getAll(): TerminalCommand[] {
    return Array.from(this.commands.values());
  }
  
  getByCategory(category: string): TerminalCommand[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }
  
  search(query: string): TerminalCommand[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(cmd => 
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }
  
  getCategories(): string[] {
    return [...new Set(this.getAll().map(cmd => cmd.category))];
  }
}

export const commandRegistry = new CommandRegistry();

export function defineCommand(command: TerminalCommand): TerminalCommand {
  commandRegistry.register(command);
  return command;
}

export function parseCommand(input: string): ParsedCommand {
  const parts = input.trim().split(/\s+/);
  const name = parts[0].toLowerCase();
  const args: Record<string, any> = {};
  const flags: Record<string, boolean> = {};
  
  const flagRegex = /^--(\w+)|^-([a-zA-Z])$/;
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const match = part.match(flagRegex);
    
    if (match) {
      const flagName = match[1] || match[2];
      flags[flagName] = true;
    } else if (part.includes('=')) {
      const [key, ...valueParts] = part.split('=');
      args[key] = valueParts.join('=');
    } else if (!isNaN(Number(part)) && !args.id) {
      args.id = Number(part);
    } else if (!args.query) {
      args.query = part;
    }
  }
  
  return { name, args, flags };
}
