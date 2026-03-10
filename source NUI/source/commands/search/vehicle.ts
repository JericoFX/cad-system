
import { createCommandWithSubcommands } from '../commandBuilder';
import { cadState, cadActions, type Vehicle, type Person } from '~/stores/cadStore';
import { hackerActions } from '~/stores/hackerStore';
import { fetchNui } from '~/utils/fetchNui';

interface LookupVehiclesResponse {
  ok?: boolean;
  vehicles?: Vehicle[];
  error?: string;
}

export function registerVehicleSearchCommand() {
  createCommandWithSubcommands({
    name: 'search-vehicle',
    aliases: ['vehicle', 'plate', 'find-vehicle'],
    description: 'Search for vehicles by plate number - GUI and CLI modes',
    usage: 'search-vehicle <gui|search> [plate]',
    category: 'SEARCH',
    permissions: ['police', 'ems'],
    subcommands: {
      gui: {
        description: 'Open vehicle search GUI (DMV)',
        handler: async ({ terminal }: { terminal: any }) => {
          terminal.openModal('VEHICLE_SEARCH');
          terminal.print('Opening vehicle search database...', 'system');
        }
      },
      search: {
        description: 'Search vehicles (CLI mode)',
        handler: async ({ rawArgs, terminal }: { rawArgs: string[]; terminal: any }) => {
          let plate = rawArgs[1] as string | undefined;

          if (!plate) {
            plate = await terminal.prompt('Enter license plate:');
            if (!plate) {
              terminal.print('Search cancelled', 'warning');
              return;
            }
          }

          // Emit hacker command for search
          hackerActions.onSearch(plate, 'vehicle');

          const stopLoading = terminal.showLoading('Searching vehicle database');

          let uniqueResults: Vehicle[] = [];

          try {
            const response = await fetchNui<LookupVehiclesResponse>('cad:lookup:searchVehicles', {
              query: plate,
              limit: 15,
            });

            uniqueResults = Array.isArray(response.vehicles) ? response.vehicles : [];
            uniqueResults.forEach((vehicle) => cadActions.addVehicle(vehicle));
          } catch (error) {
            stopLoading();
            terminal.print(`Vehicle search failed: ${String(error)}`, 'error');
            return;
          }

          stopLoading();

          if (uniqueResults.length === 0) {
            terminal.print(`No vehicles found for plate: "${plate}"`, 'error');
            terminal.print('Try checking for typos or partial matches', 'info');
            return;
          }

          if (uniqueResults.length === 1) {
            await showVehicleDetails(terminal, uniqueResults[0]);
          } else {
            terminal.print(`\n=== VEHICLE SEARCH RESULTS (${uniqueResults.length}) ===`, 'system');
            
            const headers = ['PLATE', 'VEHICLE', 'YEAR', 'COLOR', 'OWNER', 'STATUS'];
            const rows = uniqueResults.map(v => [
              v.plate,
              `${v.make} ${v.model}`.substring(0, 15),
              v.year.toString(),
              v.color,
              v.ownerName.substring(0, 15),
              getVehicleStatus(v)
            ]);

            terminal.printTable(headers, rows);
            
            terminal.print('\nUse "search-vehicle search <PLATE>" for full details', 'info');
          }
        }
      }
    },
    defaultSubcommand: 'gui'
  });
}

function getVehicleStatus(vehicle: Vehicle): string {
  if (vehicle.stolen) return 'STOLEN ⚠';
  if (vehicle.registrationStatus === 'SUSPENDED') return 'SUSPENDED';
  if (vehicle.insuranceStatus === 'NONE' || vehicle.insuranceStatus === 'EXPIRED') return 'NO INS';
  if (vehicle.flags?.some(f => f.includes('WANTED'))) return 'WANTED ⚠';
  if (vehicle.flags?.some(f => f.includes('IMPOUNDED'))) return 'IMPOUNDED';
  return vehicle.registrationStatus;
}

async function showVehicleDetails(terminal: any, vehicle: Vehicle) {
  terminal.print(`\n=== VEHICLE RECORD ===`, 'system');
  terminal.print(`Plate: ${vehicle.plate}`, 'info');
  terminal.print(`VIN: ${vehicle.vin}`, 'info');
  terminal.print(`Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`, 'info');
  terminal.print(`Color: ${vehicle.color}`, 'info');
  
  terminal.print('\n--- OWNERSHIP ---', 'system');
  terminal.print(`Owner: ${vehicle.ownerName}`, 'info');
  terminal.print(`Owner ID: ${vehicle.ownerId}`, 'info');
  
  terminal.print('\n--- REGISTRATION ---', 'system');
  terminal.print(`Registration: ${vehicle.registrationStatus}`, 
    vehicle.registrationStatus === 'SUSPENDED' ? 'warning' : 'info');
  terminal.print(`Insurance: ${vehicle.insuranceStatus}`, 
    vehicle.insuranceStatus !== 'VALID' ? 'warning' : 'info');
  
  if (vehicle.stolen) {
    terminal.print(`\n⚠ STOLEN VEHICLE ⚠`, 'error');
    terminal.print(`Reported: ${vehicle.stolenReportedAt ? new Date(vehicle.stolenReportedAt).toLocaleDateString() : 'Unknown'}`, 'error');
  }
  
  if (vehicle.flags && vehicle.flags.length > 0) {
    terminal.print(`\n--- FLAGS ---`, 'warning');
    vehicle.flags.forEach(flag => {
      terminal.print(`  ⚠ ${flag}`, 'warning');
    });
  }

  const owner = (Object.values(cadState.persons) as Person[]).find(
    p => p.citizenid === vehicle.ownerId
  );
  
  if (owner) {
    terminal.print('\n--- OWNER DETAILS ---', 'system');
    terminal.print(`Name: ${owner.firstName} ${owner.lastName}`, 'info');
    terminal.print(`Phone: ${owner.phone || 'N/A'}`, 'info');
    terminal.print(`Address: ${owner.address || 'N/A'}`, 'info');
    
    if (owner.isDead) {
      terminal.print(`⚠ OWNER IS DECEASED`, 'error');
    }
  }

  const otherVehicles = (Object.values(cadState.vehicles) as Vehicle[])
    .filter(v => v.ownerId === vehicle.ownerId && v.plate !== vehicle.plate);
  
  if (otherVehicles.length > 0) {
    terminal.print(`\n--- OTHER VEHICLES (${otherVehicles.length}) ---`, 'system');
    otherVehicles.forEach(v => {
      terminal.print(`  ${v.plate} - ${v.year} ${v.make} ${v.model} [${getVehicleStatus(v)}]`, 'info');
    });
  }

  terminal.print('\n--- RECORD INFO ---', 'system');
  terminal.print(`Created: ${new Date(vehicle.createdAt).toLocaleDateString()}`, 'info');
}
