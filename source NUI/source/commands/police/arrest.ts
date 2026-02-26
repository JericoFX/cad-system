
import { createCommand } from '../commandBuilder';
import { cadActions, cadState } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';

export function registerArrestCommand() {
  createCommand({
    name: 'arrest',
    description: 'Register an arrest with charges and details',
    usage: 'arrest [citizenId]',
    category: 'POLICE',
    permissions: ['police'],
    args: [
      {
        name: 'citizenId',
        type: 'string',
        required: false,
        description: 'Citizen ID of the arrested person'
      }
    ],
    handler: async ({ args, rawArgs, terminal }) => {
      if (rawArgs.length === 0) {
        terminal.print('Opening arrest booking wizard...', 'system');
        terminal.openModal('ARREST_WIZARD');
        return;
      }
      
      let citizenId = args.citizenId as string;
      
      if (!citizenId) {
        citizenId = await terminal.prompt('Enter Citizen ID:');
        if (!citizenId) {
          terminal.print('Arrest cancelled - no Citizen ID provided', 'error');
          return;
        }
      }

      const personName = await terminal.prompt('Enter person name:');
      if (!personName) {
        terminal.print('Arrest cancelled - no name provided', 'error');
        return;
      }

      const charges = await terminal.prompt('Enter charges (comma-separated):');
      if (!charges) {
        terminal.print('Arrest cancelled - no charges provided', 'error');
        return;
      }

      const sentence = await terminal.prompt('Enter sentence (e.g., "5 years"):');
      const fineAmount = await terminal.prompt('Fine amount (0 for none):');
      const jailTime = await terminal.prompt('Jail time in months:');

      terminal.print('\n=== ARREST SUMMARY ===', 'system');
      terminal.print(`Person: ${personName} (${citizenId})`, 'info');
      terminal.print(`Charges: ${charges}`, 'info');
      terminal.print(`Sentence: ${sentence || 'N/A'}`, 'info');
      terminal.print(`Fine: $${fineAmount || '0'}`, 'info');
      terminal.print(`Jail Time: ${jailTime || '0'} months`, 'info');

      const confirmed = await terminal.confirm('Proceed with arrest?');
      
      if (!confirmed) {
        terminal.print('Arrest cancelled', 'warning');
        return;
      }

      const stopLoading = terminal.showLoading('Registering arrest');

      try {
        const arrestData = {
          recordId: `ARR_${Date.now()}`,
          citizenid: citizenId,
          personName,
          charges: charges.split(',').map(c => c.trim()),
          description: charges,
          sentence: sentence || 'N/A',
          fine: parseFloat(fineAmount as string) || 0,
          jailTime: parseInt(jailTime as string) || 0,
          convicted: false,
          arrestingOfficer: userActions.getCurrentUserId(),
          arrestingOfficerName: userActions.getCurrentUserName(),
          arrestedAt: new Date().toISOString(),
          notes: '',
          cleared: false
        };

        cadActions.addCriminalRecord(arrestData);

        if (cadState.currentCase) {
          const attachToCase = await terminal.confirm(`Attach arrest to case ${cadState.currentCase.caseId}?`);
          if (attachToCase) {
            const caseNote = {
              id: `NOTE_${Date.now()}`,
              caseId: cadState.currentCase.caseId,
              author: userActions.getCurrentUserId(),
              content: `ARREST REGISTERED: ${personName} (${citizenId})\nCharges: ${charges}\nRecord: ${arrestData.recordId}`,
              timestamp: new Date().toISOString(),
              type: 'evidence' as const
            };
            cadActions.addCaseNote(cadState.currentCase.caseId, caseNote);
            terminal.print(`Arrest attached to case ${cadState.currentCase.caseId}`, 'success');
          }
        }

        stopLoading();
        terminal.print(`\n✓ Arrest registered: ${arrestData.recordId}`, 'success');
        terminal.print(`Person: ${personName} has been arrested`, 'info');

      } catch (error) {
        stopLoading();
        terminal.print(`Failed to register arrest: ${error}`, 'error');
      }
    }
  });
}
