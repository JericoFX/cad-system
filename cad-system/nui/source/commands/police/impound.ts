
import { createCommand } from '../commandBuilder';
import { cadActions, cadState, type Vehicle } from '~/stores/cadStore';

export function registerImpoundCommand() {
  createCommand({
    name: 'impound',
    description: 'Impound or release vehicles',
    usage: 'impound <vehicle|release|list>',
    category: 'POLICE',
    permissions: ['police'],
    args: [
      {
        name: 'action',
        type: 'string',
        required: false,
        description: 'Action: vehicle, release, list'
      }
    ],
    handler: async ({ args, terminal }) => {
      const action = (args.action as string)?.toLowerCase() || await terminal.select(
        'Select impound action:',
        ['vehicle', 'release', 'list']
      );

      switch (action) {
        case 'vehicle':
          await handleImpoundVehicle(terminal);
          break;
        case 'release':
          await handleReleaseVehicle(terminal);
          break;
        case 'list':
          await handleListImpounded(terminal);
          break;
        default:
          terminal.print(`Unknown action: ${action}`, 'error');
          terminal.print('Usage: impound <vehicle|release|list>', 'system');
      }
    }
  });
}

async function handleImpoundVehicle(terminal: any) {
  const plate = await terminal.prompt('Enter vehicle plate:');
  
  if (!plate) {
    terminal.print('Impound cancelled - no plate provided', 'error');
    return;
  }

  let vehicle = cadState.vehicles[plate.toUpperCase()];
  
  if (!vehicle) {
    terminal.print('Vehicle not found in database', 'warning');
    const createNew = await terminal.confirm('Create new vehicle record?');
    
    if (!createNew) {
      terminal.print('Impound cancelled', 'warning');
      return;
    }

    const make = await terminal.prompt('Vehicle make:');
    const model = await terminal.prompt('Vehicle model:');
    const color = await terminal.prompt('Vehicle color:');
    const ownerName = await terminal.prompt('Owner name:');
    const ownerId = await terminal.prompt('Owner Citizen ID:');

    vehicle = {
      plate: plate.toUpperCase(),
      make: make || 'Unknown',
      model: model || 'Unknown',
      year: new Date().getFullYear(),
      color: color || 'Unknown',
      ownerId: ownerId || 'UNKNOWN',
      ownerName: ownerName || 'Unknown',
      vin: `VIN${Date.now()}`,
      registrationStatus: 'SUSPENDED',
      insuranceStatus: 'NONE',
      stolen: false,
      flags: ['IMPOUNDED'],
      createdAt: new Date().toISOString()
    };

    cadActions.addVehicle(vehicle);
  }

  const reason = await terminal.prompt('Impound reason:');
  if (!reason) {
    terminal.print('Impound cancelled - no reason provided', 'error');
    return;
  }

  const duration = await terminal.prompt('Impound duration (days, 0 for indefinite):');
  const days = parseInt(duration as string) || 0;

  terminal.print('\n=== IMPOUND VEHICLE ===', 'system');
  terminal.print(`Plate: ${vehicle.plate}`, 'info');
  terminal.print(`Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`, 'info');
  terminal.print(`Color: ${vehicle.color}`, 'info');
  terminal.print(`Owner: ${vehicle.ownerName}`, 'info');
  terminal.print(`Reason: ${reason}`, 'info');
  terminal.print(`Duration: ${days > 0 ? `${days} days` : 'Indefinite'}`, 'info');

  const confirmed = await terminal.confirm('Impound this vehicle?');
  
  if (!confirmed) {
    terminal.print('Impound cancelled', 'warning');
    return;
  }

  const stopLoading = terminal.showLoading('Processing impound');

  try {
    cadActions.updateVehicle(vehicle.plate, {
      registrationStatus: 'SUSPENDED',
      flags: [...(vehicle.flags || []), 'IMPOUNDED', `IMPOUND_REASON:${reason}`]
    });

    stopLoading();
    
    terminal.print(`\n✓ Vehicle impounded: ${vehicle.plate}`, 'success');
    terminal.print(`${vehicle.make} ${vehicle.model} has been seized`, 'info');

    if (cadState.currentCase) {
      const attachToCase = await terminal.confirm('Attach to current case?');
      if (attachToCase) {
        terminal.print(`Attached to case: ${cadState.currentCase.caseId}`, 'success');
      }
    }

  } catch (error) {
    stopLoading();
    terminal.print(`Failed to impound vehicle: ${error}`, 'error');
  }
}

async function handleReleaseVehicle(terminal: any) {
  const plate = await terminal.prompt('Enter vehicle plate to release:');
  
  if (!plate) {
    terminal.print('Release cancelled', 'warning');
    return;
  }

  const vehicle = cadState.vehicles[plate.toUpperCase()];
  
  if (!vehicle) {
    terminal.print(`Vehicle not found: ${plate}`, 'error');
    return;
  }

  const isImpounded = vehicle.flags?.some(f => f === 'IMPOUNDED');
  
  if (!isImpounded) {
    terminal.print('Vehicle is not currently impounded', 'warning');
    return;
  }

  const releaseReason = await terminal.prompt('Release reason:');

  terminal.print('\n=== RELEASE VEHICLE ===', 'system');
  terminal.print(`Plate: ${vehicle.plate}`, 'info');
  terminal.print(`Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`, 'info');
  terminal.print(`Owner: ${vehicle.ownerName}`, 'info');

  const confirmed = await terminal.confirm('Release this vehicle?');
  
  if (!confirmed) {
    terminal.print('Release cancelled', 'warning');
    return;
  }

  const newFlags = (vehicle.flags || []).filter(f => 
    !f.startsWith('IMPOUNDED') && !f.startsWith('IMPOUND_REASON')
  );

  cadActions.updateVehicle(vehicle.plate, {
    registrationStatus: 'VALID',
    flags: newFlags
  });

  terminal.print(`\n✓ Vehicle released: ${vehicle.plate}`, 'success');
  terminal.print(`Release reason: ${releaseReason || 'No reason provided'}`, 'info');
}

async function handleListImpounded(terminal: any) {
  const vehicles = Object.values(cadState.vehicles) as Vehicle[];
  const impoundedVehicles = vehicles.filter(v => 
    v.flags?.some(f => f === 'IMPOUNDED')
  );

  if (impoundedVehicles.length === 0) {
    terminal.print('No impounded vehicles', 'info');
    return;
  }

  terminal.print(`\n=== IMPOUNDED VEHICLES (${impoundedVehicles.length}) ===`, 'system');

  const headers = ['PLATE', 'VEHICLE', 'COLOR', 'OWNER', 'STATUS'];
  const rows = impoundedVehicles.map(v => [
    v.plate,
    `${v.make} ${v.model}`,
    v.color,
    v.ownerName.substring(0, 15),
    v.registrationStatus
  ]);

  terminal.printTable(headers, rows);
}
