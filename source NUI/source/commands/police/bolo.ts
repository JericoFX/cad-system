
import { createCommand } from '../commandBuilder';
import { cadActions, cadState, type BOLO } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';

export function registerBOLOCommands() {
  createCommand({
    name: 'bolo-gui',
    aliases: ['bolos'],
    description: 'Open BOLO Manager GUI',
    usage: 'bolo-gui',
    category: 'POLICE',
    permissions: ['police'],
    handler: async ({ terminal }) => {
      terminal.openModal('BOLO_MANAGER');
      terminal.print('Opening BOLO Manager...', 'system');
    }
  });

  createCommand({
    name: 'bolo',
    description: 'Manage BOLOs (Be On The Look Out)',
    usage: 'bolo add <person|vehicle> <identifier> <reason> | bolo list | bolo remove <id> | bolo gui',
    category: 'POLICE',
    permissions: ['police'],
    handler: async ({ rawArgs, terminal }) => {
      const subcommand = rawArgs[0];

      switch (subcommand) {
        case 'add':
          await handleAddBOLO(rawArgs.slice(1), terminal);
          break;
        case 'list':
          handleListBOLOs(terminal);
          break;
        case 'remove':
          await handleRemoveBOLO(rawArgs[1], terminal);
          break;
        case 'check':
          await handleCheckBOLO(rawArgs.slice(1), terminal);
          break;
        default:
          terminal.print('Usage:', 'system');
          terminal.print('  bolo add person <citizenid> <reason> --priority=high', 'info');
          terminal.print('  bolo add vehicle <plate> <reason>', 'info');
          terminal.print('  bolo list - Show active BOLOs', 'info');
          terminal.print('  bolo remove <boloId> - Remove BOLO', 'info');
          terminal.print('  bolo check person <citizenid> - Check specific identifier', 'info');
      }
    }
  });
}

async function handleAddBOLO(args: string[], terminal: any) {
  const type = args[0] as 'person' | 'vehicle';
  
  if (!type || (type !== 'person' && type !== 'vehicle')) {
    terminal.print('Error: Type must be "person" or "vehicle"', 'error');
    return;
  }

  const identifier = args[1];
  if (!identifier) {
    terminal.print(`Error: ${type === 'person' ? 'Citizen ID' : 'Plate'} required`, 'error');
    return;
  }

  const reason = args.slice(2).join(' ');
  if (!reason) {
    terminal.print('Error: Reason required', 'error');
    return;
  }

  const existing = cadActions.checkBOLO(
    type.toUpperCase() as 'PERSON' | 'VEHICLE', 
    identifier
  );
  
  if (existing) {
    terminal.print(`⚠️ Active BOLO already exists for ${identifier}`, 'warning');
    terminal.print(`  Reason: ${existing.reason}`, 'info');
    terminal.print(`  Issued by: ${existing.issuedByName}`, 'info');
    const replace = await terminal.confirm('Replace existing BOLO?');
    if (!replace) {
      terminal.print('BOLO creation cancelled', 'warning');
      return;
    }
    cadActions.removeBOLO(existing.boloId);
  }

  const priority = await terminal.select(
    'Select priority:',
    ['LOW', 'MEDIUM', 'HIGH']
  ) as 'LOW' | 'MEDIUM' | 'HIGH';

  const bolo: BOLO = {
    boloId: `BOLO_${Date.now()}`,
    type: type.toUpperCase() as 'PERSON' | 'VEHICLE',
    identifier: identifier.toUpperCase(),
    reason,
    issuedBy: userActions.getCurrentUserId(),
    issuedByName: userActions.getCurrentUserName(),
    issuedAt: new Date().toISOString(),
    priority,
    active: true,
  };

  cadActions.addBOLO(bolo);

  const priorityEmoji = { LOW: '🔵', MEDIUM: '🟡', HIGH: '🔴' };
  terminal.print(`\n✓ BOLO issued: ${bolo.boloId}`, 'success');
  terminal.print(`  ${priorityEmoji[priority]} ${type.toUpperCase()}: ${identifier}`, 'info');
  terminal.print(`  Reason: ${reason}`, 'info');
  terminal.print(`  Priority: ${priority}`, 'info');
  terminal.print(`  Issued by: ${bolo.issuedByName}`, 'info');
}

function handleListBOLOs(terminal: any) {
  const bolos = cadActions.getActiveBOLOs();
  
  if (bolos.length === 0) {
    terminal.print('No active BOLOs', 'system');
    return;
  }

  terminal.print(`\n=== ACTIVE BOLOs (${bolos.length}) ===`, 'system');
  
  const sorted = bolos.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  terminal.printTable(
    ['ID', 'Type', 'Identifier', 'Reason', 'Priority', 'Issued'],
    sorted.map(b => {
      const priorityEmoji = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🔵' };
      return [
        b.boloId.substring(0, 8),
        b.type,
        b.identifier,
        b.reason.substring(0, 20) + (b.reason.length > 20 ? '...' : ''),
        `${priorityEmoji[b.priority]} ${b.priority}`,
        new Date(b.issuedAt).toLocaleDateString(),
      ];
    })
  );
}

async function handleRemoveBOLO(boloId: string, terminal: any) {
  if (!boloId) {
    const bolos = cadActions.getActiveBOLOs();
    if (bolos.length === 0) {
      terminal.print('No active BOLOs to remove', 'system');
      return;
    }

    terminal.print('Active BOLOs:', 'system');
    bolos.forEach((b, i) => {
      terminal.print(`  [${i + 1}] ${b.identifier} - ${b.reason.substring(0, 30)}`, 'info');
    });

    const selection = await terminal.prompt('Enter number to remove:');
    const index = parseInt(selection) - 1;
    
    if (isNaN(index) || index < 0 || index >= bolos.length) {
      terminal.print('Invalid selection', 'error');
      return;
    }

    boloId = bolos[index].boloId;
  }

  const bolo = cadState.bolos[boloId];
  if (!bolo) {
    terminal.print(`BOLO not found: ${boloId}`, 'error');
    return;
  }

  const confirmed = await terminal.confirm(`Remove BOLO for ${bolo.identifier}?`);
  if (!confirmed) {
    terminal.print('Cancelled', 'warning');
    return;
  }

  cadActions.removeBOLO(boloId);
  terminal.print(`✓ BOLO removed: ${bolo.identifier}`, 'success');
}

async function handleCheckBOLO(args: string[], terminal: any) {
  const type = args[0] as 'person' | 'vehicle';
  const identifier = args[1];

  if (!type || !identifier) {
    terminal.print('Usage: bolo check person <citizenid>', 'error');
    terminal.print('       bolo check vehicle <plate>', 'error');
    return;
  }

  const bolo = cadActions.checkBOLO(
    type.toUpperCase() as 'PERSON' | 'VEHICLE',
    identifier.toUpperCase()
  );

  if (bolo) {
    const priorityEmoji = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🔵' };
    terminal.print(`\n${priorityEmoji[bolo.priority]} ACTIVE BOLO FOUND`, 'error');
    terminal.print(`  Type: ${bolo.type}`, 'info');
    terminal.print(`  Identifier: ${bolo.identifier}`, 'info');
    terminal.print(`  Reason: ${bolo.reason}`, 'info');
    terminal.print(`  Priority: ${bolo.priority}`, 'info');
    terminal.print(`  Issued by: ${bolo.issuedByName}`, 'info');
    terminal.print(`  Issued at: ${new Date(bolo.issuedAt).toLocaleString()}`, 'info');
  } else {
    terminal.print(`✓ No active BOLO for ${identifier}`, 'success');
  }
}
