
import { registry } from './registry';
import { terminalActions } from '~/stores/terminalStore';
import { flowMacrosActions } from '~/stores/flowMacrosStore';
import { auditActions } from '~/stores/auditStore';

registry.register({
  name: 'flow',
  aliases: ['macro', 'workflow'],
  description: 'Launch guided workflow macros',
  usage: 'flow [name] | flow list | flow audit',
  handler: (ctx) => {
    const subcommand = ctx.args[0]?.toLowerCase();

    if (!subcommand || subcommand === 'list') {
      terminalActions.addLine('=== AVAILABLE WORKFLOW MACROS ===', 'system');
      terminalActions.addLine('', 'output');
      
      const macros = flowMacrosActions.getAllMacros();
      const categories = new Set(macros.map(m => m.category));
      
      categories.forEach(cat => {
        const catMacros = macros.filter(m => m.category === cat);
        terminalActions.addLine(`${cat.toUpperCase()}:`, 'system');
        catMacros.forEach(macro => {
          terminalActions.addLine(`  ${macro.id.padEnd(15)} - ${macro.name}`, 'output');
          terminalActions.addLine(`    ${macro.description}`, 'output');
        });
        terminalActions.addLine('', 'output');
      });
      
      terminalActions.addLine('Usage: flow <name> to start a workflow', 'system');
      return;
    }

    if (subcommand === 'audit' || subcommand === 'log') {
      auditActions.openViewer();
      terminalActions.addLine('Opening command audit viewer...', 'system');
      return;
    }

    const macros = flowMacrosActions.getAllMacros();
    const macro = macros.find(m => m.id === subcommand || m.name.toLowerCase().replace(/\s+/g, '-') === subcommand);
    
    if (macro) {
      flowMacrosActions.startFlow(macro.id);
      terminalActions.addLine(`Starting workflow: ${macro.name}`, 'system');
    } else {
      terminalActions.addLine(`Unknown workflow: ${subcommand}`, 'error');
      terminalActions.addLine('Type "flow list" to see available workflows', 'system');
    }
  },
});

registry.register({
  name: 'audit',
  aliases: ['log', 'history'],
  description: 'Open command audit viewer',
  usage: 'audit | audit export',
  handler: (ctx) => {
    const subcommand = ctx.args[0]?.toLowerCase();
    
    if (subcommand === 'export') {
      const content = auditActions.exportToNote();
      if (content) {
        terminalActions.addLine('Audit log copied to clipboard', 'system');
        terminalActions.addLine('Paste into notes to save', 'system');
      } else {
        terminalActions.addLine('No audit entries to export', 'error');
      }
      return;
    }
    
    auditActions.openViewer();
    terminalActions.addLine('Opening command audit viewer...', 'system');
  },
});
