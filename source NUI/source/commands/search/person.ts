
import { createCommandWithSubcommands } from '../commandBuilder';
import { cadState, cadActions, type Person, type CriminalRecord, type Warrant, type Fine } from '~/stores/cadStore';
import { hackerActions } from '~/stores/hackerStore';
import { fetchNui } from '~/utils/fetchNui';

interface LookupPersonsResponse {
  ok?: boolean;
  persons?: Person[];
  error?: string;
}

export function registerPersonSearchCommand() {
  createCommandWithSubcommands({
    name: 'search-person',
    aliases: ['person', 'find-person'],
    description: 'Search for persons by name or Citizen ID - GUI and CLI modes',
    usage: 'search-person <gui|search> [query]',
    category: 'SEARCH',
    permissions: ['police', 'ems'],
    subcommands: {
      gui: {
        description: 'Open person search GUI (MDT)',
        handler: async ({ terminal }: { terminal: any }) => {
          terminal.openModal('PERSON_SEARCH');
          terminal.print('Opening person search database...', 'system');
        }
      },
      search: {
        description: 'Search persons (CLI mode)',
        handler: async ({ rawArgs, terminal }: { rawArgs: string[]; terminal: any }) => {
          let query = rawArgs[1] as string | undefined;

          if (!query) {
            query = await terminal.prompt('Enter name or Citizen ID:');
            if (!query) {
              terminal.print('Search cancelled', 'warning');
              return;
            }
          }

          // Emit hacker command for search
          hackerActions.onSearch(query, 'person');

          const stopLoading = terminal.showLoading('Searching database');

          let uniqueResults: Person[] = [];

          try {
            const response = await fetchNui<LookupPersonsResponse>('cad:lookup:searchPersons', {
              query,
              limit: 15,
            });

            uniqueResults = Array.isArray(response.persons) ? response.persons : [];
            uniqueResults.forEach((person) => cadActions.addPerson(person));
          } catch (error) {
            stopLoading();
            terminal.print(`Person search failed: ${String(error)}`, 'error');
            return;
          }

          stopLoading();

          if (uniqueResults.length === 0) {
            terminal.print(`No persons found for: "${query}"`, 'error');
            terminal.print('Try searching by Citizen ID or full name', 'info');
            return;
          }

          if (uniqueResults.length === 1) {
            await showPersonDetails(terminal, uniqueResults[0]);
          } else {
            terminal.print(`\n=== SEARCH RESULTS (${uniqueResults.length}) ===`, 'system');
            
            const headers = ['CITIZEN ID', 'NAME', 'DOB', 'GENDER', 'STATUS'];
            const rows = uniqueResults.map(p => [
              p.citizenid,
              `${p.firstName} ${p.lastName}`.substring(0, 20),
              new Date(p.dateOfBirth).toLocaleDateString(),
              p.gender,
              p.isDead ? 'DECEASED' : 'ALIVE'
            ]);

            terminal.printTable(headers, rows);
            
            terminal.print('\nUse "search-person search <CitizenID>" for full details', 'info');
          }
        }
      }
    },
    defaultSubcommand: 'gui'
  });
}

async function showPersonDetails(terminal: any, person: Person) {
  terminal.print(`\n=== PERSON RECORD ===`, 'system');
  terminal.print(`Citizen ID: ${person.citizenid}`, 'info');
  terminal.print(`Name: ${person.firstName} ${person.lastName}`, 'info');
  terminal.print(`Date of Birth: ${new Date(person.dateOfBirth).toLocaleDateString()}`, 'info');
  terminal.print(`SSN: ${person.ssn}`, 'info');
  terminal.print(`Gender: ${person.gender}`, 'info');
  terminal.print(`Phone: ${person.phone || 'N/A'}`, 'info');
  terminal.print(`Address: ${person.address || 'N/A'}`, 'info');
  
  terminal.print('\n--- PHYSICAL DESCRIPTION ---', 'system');
  terminal.print(`Height: ${person.height || 'N/A'}`, 'info');
  terminal.print(`Weight: ${person.weight || 'N/A'}`, 'info');
  terminal.print(`Eye Color: ${person.eyeColor || 'N/A'}`, 'info');
  terminal.print(`Hair Color: ${person.hairColor || 'N/A'}`, 'info');
  
  terminal.print('\n--- MEDICAL INFO ---', 'system');
  terminal.print(`Blood Type: ${person.bloodType || 'N/A'}`, 'info');
  terminal.print(`Allergies: ${person.allergies || 'None'}`, 'info');
  
  if (person.isDead) {
    terminal.print(`\n⚠ DECEASED - ${person.ckDate ? new Date(person.ckDate).toLocaleDateString() : 'Date unknown'}`, 'error');
  }

  const records = (Object.values(cadState.criminalRecords) as CriminalRecord[]).filter(
    r => r.citizenid === person.citizenid && !r.cleared
  );
  
  if (records.length > 0) {
    terminal.print(`\n--- CRIMINAL RECORD (${records.length}) ---`, 'system');
    records.forEach(record => {
      terminal.print(`[${record.arrestedAt.substring(0, 10)}] ${record.charges.join(', ')}`, 'warning');
    });
  }

  const warrants = (Object.values(cadState.warrants) as Warrant[]).filter(
    w => w.citizenid === person.citizenid && w.active && !w.executed
  );
  
  if (warrants.length > 0) {
    terminal.print(`\n--- ACTIVE WARRANTS (${warrants.length}) ⚠ ---`, 'error');
    warrants.forEach(warrant => {
      terminal.print(`${warrant.type}: ${warrant.reason}`, 'error');
      terminal.print(`  Issued: ${new Date(warrant.issuedAt).toLocaleDateString()}`, 'error');
    });
  }

  const fines = (Object.values(cadState.fines) as Fine[]).filter(
    f => f.targetId === person.citizenid && !f.paid
  );
  
  if (fines.length > 0) {
    const totalFines = fines.reduce((sum, f) => sum + f.amount, 0);
    terminal.print(`\n--- OUTSTANDING FINES (${fines.length}) ---`, 'warning');
    terminal.print(`Total owed: $${totalFines}`, 'warning');
  }

  terminal.print('\n--- RECORD INFO ---', 'system');
  terminal.print(`Created: ${new Date(person.createdAt).toLocaleDateString()}`, 'info');
  terminal.print(`Last Updated: ${new Date(person.lastUpdated).toLocaleDateString()}`, 'info');
}
