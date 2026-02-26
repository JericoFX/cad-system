
import { createCommandWithSubcommands, requireCaseLoaded } from '../commandBuilder';
import { cadActions, cadState, type Case } from '~/stores/cadStore';
import { hackerActions } from '~/stores/hackerStore';

export function registerCaseCommands() {
  createCommandWithSubcommands({
    name: 'case',
    aliases: ['c'],
    description: 'Case management with GUI and CLI modes',
    usage: 'case <gui|create|view|select|search|notes|evidence|close> [args...]',
    category: 'cases',
    subcommands: {
      gui: {
        description: 'Open case creator GUI',
        handler: async ({ terminal }) => {
          terminal.openModal('CASE_CREATOR');
          terminal.print('Opening case creator GUI...', 'system');
        }
      },
      create: {
        description: 'Create a new case (interactive CLI)',
        handler: async ({ args, terminal, fivem }) => {
          const caseType = args.type?.toUpperCase() || await terminal.select(
            'Select case type:',
            ['CRIMINAL', 'CIVIL', 'TRAFFIC', 'GENERAL', 'NARCOTICS', 'HOMICIDE']
          );

          const title = args.title || await terminal.prompt('Enter case title:');
          if (!title) {
            terminal.print('Case creation cancelled - no title provided', 'error');
            return;
          }

          const description = await terminal.prompt('Enter case description (optional):');

          const priorityInput = args.priority || await terminal.select(
            'Select priority:',
            ['1 - Critical', '2 - High', '3 - Normal', '4 - Low']
          );
          const priority = parseInt(priorityInput.toString().charAt(0)) || 2;

          terminal.print('\n=== CASE SUMMARY ===', 'system');
          terminal.print(`Type: ${caseType}`, 'info');
          terminal.print(`Title: ${title}`, 'info');
          terminal.print(`Description: ${description || 'N/A'}`, 'info');
          terminal.print(`Priority: ${priority}`, 'info');

          const confirmed = await terminal.confirm('Create this case?');
          
          if (!confirmed) {
            terminal.print('Case creation cancelled', 'warning');
            return;
          }

          const stopLoading = terminal.showLoading('Creating case');
          
          try {
            const result = await fivem.fetch('cad:createCase', {
              caseType,
              title,
              description: description || '',
              priority,
            });
            stopLoading();

            if (result && typeof result === 'object' && 'caseId' in result) {
              const caseData = result as Case;
              cadActions.addCase(caseData);
              cadActions.setCurrentCase(caseData);
              
              // Emit hacker command for case creation
              hackerActions.onCaseCreate(
                caseData.caseId,
                caseData.title,
                caseData.caseType,
                caseData.priority
              );
              
              terminal.print(`\n✓ Case created and selected: ${caseData.caseId}`, 'success');
              terminal.printCard(caseData.caseId, {
                Title: caseData.title,
                Type: caseData.caseType,
                Priority: caseData.priority.toString(),
              });
              
              terminal.newLine();
              terminal.print('Case is now ACTIVE - you can:', 'system');
              terminal.print('  addnote <type> <content> - Add a note', 'info');
              terminal.print('  addevidence <url> - Add evidence URL', 'info');
              terminal.print('  addevidence - Open evidence uploader', 'info');
              terminal.print('  notes - Open notes editor for this case', 'info');
              terminal.print('  evidence - View/manage evidence', 'info');
            } else {
              terminal.print(`\n✗ Failed to create case: Invalid response from server`, 'error');
            }
          } catch (error) {
            stopLoading();
            terminal.print(`\n✗ Failed to create case: ${error}`, 'error');
          }
        }
      },

      view: {
        description: 'View case details',
        handler: async ({ rawArgs, terminal }) => {
          const caseId = rawArgs[1] || requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
          
          if (!caseId) return;

          const targetCase = cadState.cases[caseId];
          if (!targetCase) {
            terminal.print(`Case not found: ${caseId}`, 'error');
            return;
          }

          cadActions.setCurrentCase(targetCase);

          const notesCount = targetCase.notes?.length || 0;
          const evidenceCount = targetCase.evidence?.length || 0;

          terminal.print(`=== CASE ${targetCase.caseId} ===`, 'system');
          terminal.printCard('Details', {
            Title: targetCase.title,
            Type: `${targetCase.caseType} | Priority: ${targetCase.priority} | Status: ${targetCase.status}`,
            'Notes/Evidence': `${notesCount} notes | ${evidenceCount} evidence items`,
            Created: new Date(targetCase.createdAt).toLocaleString(),
          });

          if (targetCase.description) {
            terminal.newLine();
            terminal.print('Description:', 'system');
            terminal.print(targetCase.description, 'info');
          }
        }
      },

      select: {
        description: 'List and select a case',
        handler: async ({ terminal }) => {
          const cases = Object.values(cadState.cases);
          
          if (cases.length === 0) {
            terminal.print('No cases available', 'error');
            terminal.print('Create one: case create <type> <title>', 'system');
            return;
          }

          const openCases = cases.filter(c => c.status === 'OPEN');
          const displayCases = openCases.length > 0 ? openCases : cases;

          terminal.print('=== SELECT A CASE ===', 'system');
          terminal.printTable(
            ['#', 'ID', 'Title', 'Type', 'Notes', 'Evidence'],
            displayCases.slice(0, 10).map((c, i) => [
              (i + 1).toString(),
              c.caseId.substring(0, 10),
              c.title.substring(0, 20),
              c.caseType,
              (c.notes?.length || 0).toString(),
              (c.evidence?.length || 0).toString(),
            ])
          );

          terminal.print(`Showing ${displayCases.length} case(s)`, 'system');
          terminal.print('Use: case view <case_id>', 'info');
        }
      },

      search: {
        description: 'Search cases by ID, title, or person',
        handler: async ({ args, terminal }) => {
          const query = args.query;
          
          if (!query) {
            terminal.print('Usage: case search <query>', 'error');
            return;
          }

          const stopLoading = terminal.showLoading('Searching');
          const results = cadActions.searchCases(query);
          stopLoading();

          if (results.length === 0) {
            terminal.print(`No cases found for: "${query}"`, 'error');
            return;
          }

          terminal.print(`=== SEARCH RESULTS: "${query}" ===`, 'system');
          terminal.printTable(
            ['ID', 'Title', 'Type', 'Status', 'Notes', 'Evidence'],
            results.map(c => [
              c.caseId.substring(0, 12),
              c.title.substring(0, 18),
              c.caseType,
              c.status,
              (c.notes?.length || 0).toString(),
              (c.evidence?.length || 0).toString(),
            ])
          );
        }
      },

      notes: {
        description: 'View case notes',
        handler: async ({ rawArgs, terminal }) => {
          const caseId = rawArgs[1] || requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
          if (!caseId) return;

          const targetCase = cadState.cases[caseId];
          if (!targetCase) {
            terminal.print(`Case not found: ${caseId}`, 'error');
            return;
          }

          const notes = targetCase.notes || [];
          
          if (notes.length === 0) {
            terminal.print(`No notes for case ${caseId}`, 'system');
            terminal.print('Add one: addnote <type> <content>', 'info');
            return;
          }

          terminal.print(`=== NOTES FOR CASE ${caseId} ===`, 'system');
          terminal.print(`Case: ${targetCase.title}`, 'info');
          terminal.print(`Total: ${notes.length} note(s)`, 'system');
          terminal.newLine();

          notes.forEach((note, i) => {
            const date = new Date(note.timestamp).toLocaleDateString();
            terminal.print(`[${i + 1}] ${note.type.toUpperCase()} - ${date}`, 'system');
            terminal.print(`    ${note.content.substring(0, 60)}${note.content.length > 60 ? '...' : ''}`, 'info');
            terminal.newLine();
          });
        }
      },

      evidence: {
        description: 'View case evidence',
        handler: async ({ rawArgs, terminal }) => {
          const caseId = rawArgs[1] || requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
          if (!caseId) return;

          const targetCase = cadState.cases[caseId];
          if (!targetCase) {
            terminal.print(`Case not found: ${caseId}`, 'error');
            return;
          }

          const evidence = targetCase.evidence || [];
          
          if (evidence.length === 0) {
            terminal.print(`No evidence for case ${caseId}`, 'system');
            terminal.print('Add one: addevidence [url]', 'info');
            return;
          }

          terminal.print(`=== EVIDENCE FOR CASE ${caseId} ===`, 'system');
          terminal.printTable(
            ['ID', 'Type', 'Attached By', 'Date'],
            evidence.map(item => [
              item.evidenceId.substring(0, 12),
              item.evidenceType.substring(0, 12),
              item.attachedBy.substring(0, 12),
              new Date(item.attachedAt).toLocaleDateString(),
            ])
          );
        }
      },

      close: {
        description: 'Close a case',
        handler: async ({ rawArgs, terminal, fivem }) => {
          const caseId = rawArgs[1];
          
          if (!caseId) {
            terminal.print('Usage: case close <case_id>', 'error');
            return;
          }

          const stopLoading = terminal.showLoading('Closing case');
          
          try {
            const result = await fivem.fetch('cad:closeCase', caseId);
            stopLoading();
            
            if (result) {
              cadActions.updateCase(caseId, { status: 'CLOSED' });
              terminal.print(`✓ Case ${caseId} closed`, 'success');
              
              if (cadState.currentCase?.caseId === caseId) {
                cadActions.setCurrentCase(null);
                terminal.print('Current case cleared', 'system');
              }
            }
          } catch (error) {
            stopLoading();
            terminal.print(`Failed to close case: ${error}`, 'error');
          }
        }
      }
    },
    defaultSubcommand: 'gui'
  });
}
