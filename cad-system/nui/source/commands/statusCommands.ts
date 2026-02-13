import { registry } from './registry';
import { terminalActions } from '~/stores/terminalStore';
import { fetchNui } from '~/utils/fetchNui';
import { codeCatalogActions, codeCatalogState } from '~/stores/codeCatalogStore';

let didRegister = false;

function getStatusCodes() {
  return codeCatalogState.statusCodes;
}

function getTenCodes() {
  return codeCatalogState.tenCodes;
}

function listStatusHints() {
  const entries = Object.entries(getStatusCodes());
  if (entries.length === 0) {
    terminalActions.addLine('No status codes available', 'system');
    return;
  }

  terminalActions.addLine('To change status, use:', 'output');
  entries.slice(0, 6).forEach(([code, info]) => {
    terminalActions.addLine(`  ${code} - ${info.label}`, 'output');
  });
}

function listStatusCodes() {
  const entries = Object.entries(getStatusCodes());
  if (entries.length === 0) {
    terminalActions.addLine('No status codes configured', 'system');
    return;
  }

  terminalActions.addLine('STATUS CODES:', 'system');
  entries.forEach(([code, info]) => {
    terminalActions.addLine(`  ${code} - ${info.label}`, 'output');
  });
}

function filterTenCodes(category: string): Array<[string, string]> {
  const codes = Object.entries(getTenCodes());
  switch (category) {
    case 'status':
      return codes.filter(([code]) => ['10-7', '10-8', '10-6', '10-42', '10-41'].includes(code));
    case 'emergency':
      return codes.filter(([code, desc]) => {
        const text = desc.toLowerCase();
        return text.includes('emergency') || text.includes('help') || code === '10-33' || code === '10-99';
      });
    case 'traffic':
      return codes.filter(([code, desc]) => {
        const text = desc.toLowerCase();
        return text.includes('traffic') || text.includes('vehicle') || text.includes('accident') || code.startsWith('10-5');
      });
    default:
      return codes;
  }
}

function registerSingleStatusCodeCommand(code: string, label: string, color: string) {
  registry.register({
    name: code,
    description: `Set status: ${label}`,
    usage: code,
    handler: async () => {
      try {
        await fetchNui('cad:setOfficerStatus', {
          statusCode: code,
          statusLabel: label,
        });

        terminalActions.addLine(`Status updated: [${code}] ${label}`, 'output');
        terminalActions.addLine(`Color: ${color}`, 'output');
      } catch (error) {
        terminalActions.addLine(`Failed to update status: ${error}`, 'error');
      }
    },
  });
}

export function registerStatusCommands() {
  if (didRegister) {
    return;
  }

  const statusCodes = getStatusCodes();
  Object.entries(statusCodes).forEach(([code, info]) => {
    registerSingleStatusCodeCommand(code, info.label, info.color);
  });

  registry.register({
    name: 'status',
    aliases: ['st', 'code'],
    description: 'View or change officer status using 10-codes',
    usage: 'status [10-code] | status list',
    handler: async (ctx) => {
      const subcommand = ctx.args[0]?.toLowerCase();

      if (!subcommand) {
        terminalActions.addLine('=== CURRENT STATUS ===', 'system');
        listStatusHints();
        return;
      }

      if (subcommand === 'list' || subcommand === 'all') {
        terminalActions.addLine('=== AVAILABLE 10-CODES ===', 'system');
        terminalActions.addLine('', 'output');
        listStatusCodes();
        terminalActions.addLine('', 'output');
        terminalActions.addLine('Type any code directly (e.g., "10-8") to set status', 'system');
        return;
      }

      const code = subcommand.toUpperCase();
      const statusInfo = codeCatalogActions.getStatusInfo(code);
      if (!statusInfo) {
        terminalActions.addLine(`Unknown status code: ${code}`, 'error');
        terminalActions.addLine('Use "status list" to see available codes', 'system');
        return;
      }

      try {
        await fetchNui('cad:setOfficerStatus', {
          statusCode: code,
          statusLabel: statusInfo.label,
        });

        terminalActions.addLine(`Status updated: [${code}] ${statusInfo.label}`, 'output');
      } catch (error) {
        terminalActions.addLine(`Failed to update status: ${error}`, 'error');
      }
    },
  });

  registry.register({
    name: '10-codes',
    aliases: ['codes', 'radio'],
    description: 'Show 10-codes reference',
    usage: '10-codes [category]',
    handler: (ctx) => {
      const category = ctx.args[0]?.toLowerCase();

      if (!category) {
        terminalActions.addLine('=== 10-CODES REFERENCE ===', 'system');
        terminalActions.addLine('', 'output');
        terminalActions.addLine('Categories:', 'system');
        terminalActions.addLine('  10-codes status    - Status codes (10-7, 10-8, etc)', 'output');
        terminalActions.addLine('  10-codes emergency - Emergency codes', 'output');
        terminalActions.addLine('  10-codes traffic   - Traffic codes', 'output');
        terminalActions.addLine('  10-codes general   - General codes', 'output');
        return;
      }

      const filteredCodes = filterTenCodes(category);
      if (category === 'status') {
        terminalActions.addLine('=== STATUS CODES ===', 'system');
      } else if (category === 'emergency') {
        terminalActions.addLine('=== EMERGENCY CODES ===', 'system');
      } else if (category === 'traffic') {
        terminalActions.addLine('=== TRAFFIC CODES ===', 'system');
      } else {
        terminalActions.addLine('=== ALL 10-CODES ===', 'system');
      }

      filteredCodes.forEach(([code, description]) => {
        terminalActions.addLine(`  ${code} - ${description}`, 'output');
      });
    },
  });

  didRegister = true;
}
