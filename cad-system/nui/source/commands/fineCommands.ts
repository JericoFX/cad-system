import { createCommand, createCommandWithSubcommands } from './commandBuilder';
import { cadActions, cadState, type Fine } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';

type FineCatalogItem = {
  code: string;
  description: string;
  amount: number;
  jailTime: number;
};

let catalogCache: FineCatalogItem[] = [];

async function ensureCatalog(): Promise<FineCatalogItem[]> {
  if (catalogCache.length > 0) return catalogCache;
  const remote = await fetchNui<FineCatalogItem[]>('cad:getFineCatalog');
  catalogCache = Array.isArray(remote) ? remote : [];
  return catalogCache;
}

async function refreshFinesForTarget(targetId: string) {
  const rows = await fetchNui<Fine[]>('cad:getFines', { targetId });
  const record = Object.fromEntries((rows || []).map((fine) => [fine.fineId, fine]));
  cadActions.setFines(record);
  return rows || [];
}

export function registerFineCommands() {
  createCommandWithSubcommands({
    name: 'fine',
    aliases: ['ticket', 'multa'],
    description: 'Issue a fine/ticket to a person or vehicle',
    usage: 'fine <gui|issue> [target] [code]',
    category: 'Fines',
    permissions: ['police'],
    subcommands: {
      gui: {
        description: 'Open fine manager GUI',
        handler: async ({ terminal }) => {
          terminal.openModal('FINE_MANAGER');
          terminal.print('Opening fine manager GUI...', 'system');
        },
      },
      issue: {
        description: 'Issue a fine via CLI',
        handler: async ({ rawArgs, terminal }) => {
          let targetId = rawArgs[1];
          let fineCode = rawArgs[2];

          if (!targetId) {
            targetId = await terminal.prompt('Enter Citizen ID or license plate:');
            if (!targetId) {
              terminal.print('Fine issuance cancelled', 'warning');
              return;
            }
          }

          const catalog = await ensureCatalog();
          if (!fineCode) {
            const options = catalog.map(
              (f) => `${f.code} - ${f.description} ($${f.amount}${f.jailTime > 0 ? ` + ${f.jailTime}m` : ''})`
            );
            const selected = await terminal.select('Select fine:', options);
            fineCode = selected.split(' - ')[0];
          }

          const selectedFine = catalog.find((f) => f.code.toUpperCase() === fineCode.toUpperCase());
          if (!selectedFine) {
            terminal.print(`Fine code not found: ${fineCode}`, 'error');
            return;
          }

          const isVehicle = !!targetId.match(/^[A-Z0-9]{3,8}$/i);
          const targetType = isVehicle ? 'VEHICLE' : 'PERSON';

          const created = await fetchNui<Fine>('cad:createFine', {
            targetType,
            targetId,
            targetName: targetId,
            fineCode: selectedFine.code,
            description: selectedFine.description,
            amount: selectedFine.amount,
            jailTime: selectedFine.jailTime,
            isBail: false,
          });

          cadActions.addFine(created);
          terminal.print(`✓ Fine issued: ${created.fineId}`, 'success');
          terminal.print(`Ticket created for target: ${created.targetId}`, 'info');
        },
      },
    },
    defaultSubcommand: 'gui',
  });

  createCommandWithSubcommands({
    name: 'fines',
    aliases: ['tickets', 'myfines'],
    description: 'View and manage fines',
    usage: 'fines <list|pay|view> [args...]',
    category: 'Fines',
    permissions: ['police', 'civilian'],
    subcommands: {
      list: {
        description: 'List pending fines for a target',
        handler: async ({ rawArgs, terminal }) => {
          const targetId = rawArgs[1];
          const rows = await fetchNui<Fine[]>('cad:getFines', targetId ? { targetId } : { mine: true });
          const record = Object.fromEntries((rows || []).map((fine) => [fine.fineId, fine]));
          cadActions.setFines(record);

          const pending = (rows || []).filter((f) => !f.paid);
          if (pending.length === 0) {
            terminal.print('No pending fines', 'info');
            return;
          }

          terminal.printTable(
            ['ID', 'CODE', 'TARGET', 'AMOUNT', 'STATUS'],
            pending.map((f) => [
              f.fineId.substring(0, 12),
              f.fineCode,
              f.targetId,
              `$${f.amount}`,
              f.status,
            ])
          );
        },
      },
      pay: {
        description: 'Pay a fine by id',
        handler: async ({ rawArgs, terminal }) => {
          let fineId = rawArgs[1];

          if (!fineId) {
            const pending = Object.values(cadState.fines).filter((f) => !f.paid);
            if (pending.length === 0) {
              terminal.print('No pending fines loaded. Run: fines list', 'warning');
              return;
            }

            const selected = await terminal.select(
              'Select fine to pay:',
              pending.map((f) => `${f.fineId} - ${f.description} ($${f.amount})`)
            );
            fineId = selected.split(' - ')[0];
          }

          const updated = await fetchNui<Fine>('cad:payFine', {
            fineId,
            method: 'BANK',
          });

          cadActions.updateFine(updated.fineId, updated);
          terminal.print(`✓ Fine paid: ${updated.fineId}`, 'success');
          terminal.print(`Amount: $${updated.amount}`, 'info');
        },
      },
      view: {
        description: 'View all fines for target',
        handler: async ({ rawArgs, terminal }) => {
          let targetId = rawArgs[1];
          if (!targetId) {
            targetId = await terminal.prompt('Enter Citizen ID or license plate:');
            if (!targetId) return;
          }

          const rows = await refreshFinesForTarget(targetId);
          if (rows.length === 0) {
            terminal.print(`No fines found for: ${targetId}`, 'info');
            return;
          }

          terminal.printTable(
            ['ID', 'CODE', 'DESCRIPTION', 'AMOUNT', 'STATUS'],
            rows.map((f) => [
              f.fineId.substring(0, 12),
              f.fineCode,
              f.description.substring(0, 28),
              `$${f.amount}`,
              f.paid ? 'PAID' : 'PENDING',
            ])
          );
        },
      },
    },
    defaultSubcommand: 'list',
  });

  createCommand({
    name: 'finecatalog',
    aliases: ['fineslist', 'catalog'],
    description: 'View available fine codes',
    usage: 'finecatalog',
    category: 'Fines',
    permissions: ['police'],
    handler: async ({ terminal }) => {
      const catalog = await ensureCatalog();
      terminal.printTable(
        ['CODE', 'DESCRIPTION', 'AMOUNT', 'JAIL'],
        catalog.map((f) => [f.code, f.description.substring(0, 30), `$${f.amount}`, f.jailTime > 0 ? `${f.jailTime}m` : '-'])
      );
    },
  });
}
