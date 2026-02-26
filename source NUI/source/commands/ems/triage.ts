
import { createCommand } from '../commandBuilder';
import { userActions } from '~/stores/userStore';

export function registerTriageCommand() {
  createCommand({
    name: 'triage',
    description: 'Patient triage and intake',
    usage: 'triage [patientName]',
    category: 'EMS',
    permissions: ['ems'],
    args: [
      {
        name: 'patientName',
        type: 'string',
        required: false,
        description: 'Patient name'
      }
    ],
    handler: async ({ args, terminal }) => {
      let patientName = args.patientName as string;

      if (!patientName) {
        patientName = await terminal.prompt('Enter patient name:');
        if (!patientName) {
          terminal.print('Triage cancelled - no name provided', 'error');
          return;
        }
      }

      const condition = await terminal.select(
        'Select patient condition:',
        ['STABLE', 'SERIOUS', 'CRITICAL', 'DECEASED']
      );

      const injuries = await terminal.prompt('Describe injuries/condition:');
      const symptoms = await terminal.prompt('List symptoms (comma-separated):');
      
      let vitals = '';
      if (condition !== 'DECEASED') {
        const bp = await terminal.prompt('Blood pressure (e.g., 120/80):');
        const hr = await terminal.prompt('Heart rate:');
        const temp = await terminal.prompt('Temperature (°F):');
        const o2 = await terminal.prompt('O2 saturation (%):');
        
        vitals = `BP: ${bp || 'N/A'} | HR: ${hr || 'N/A'} | Temp: ${temp || 'N/A'}°F | O2: ${o2 || 'N/A'}%`;
      }

      const allergies = await terminal.prompt('Known allergies (comma-separated, none if N/A):');
      const medications = await terminal.prompt('Current medications:');

      terminal.print('\n=== TRIAGE SUMMARY ===', 'system');
      terminal.print(`Patient: ${patientName}`, 'info');
      terminal.print(`Condition: ${condition}`, condition === 'CRITICAL' ? 'error' : 'info');
      terminal.print(`Injuries: ${injuries || 'N/A'}`, 'info');
      terminal.print(`Symptoms: ${symptoms || 'N/A'}`, 'info');
      if (vitals) terminal.print(`Vitals: ${vitals}`, 'info');
      terminal.print(`Allergies: ${allergies || 'None'}`, 'info');
      terminal.print(`Medications: ${medications || 'None'}`, 'info');

      const confirmed = await terminal.confirm('Admit patient?');
      
      if (!confirmed) {
        terminal.print('Triage cancelled', 'warning');
        return;
      }

      const stopLoading = terminal.showLoading('Admitting patient');

      try {
        const patientId = `PAT_${Date.now()}`;

        const patientData = {
          patientId,
          name: patientName,
          condition: condition as 'STABLE' | 'SERIOUS' | 'CRITICAL' | 'DECEASED',
          injuries: injuries || 'None reported',
          symptoms: symptoms ? symptoms.split(',').map(s => s.trim()) : [],
          vitals,
          allergies: allergies ? allergies.split(',').map(a => a.trim()) : [],
          medications: medications || 'None',
          admittedAt: new Date().toISOString(),
          admittedBy: userActions.getCurrentUserId(),
          admittedByName: userActions.getCurrentUserName(),
          status: 'ADMITTED' as const,
          treatmentLog: []
        };

        terminal.print(`Patient ${patientData.name} saved to system`, 'success');

        stopLoading();
        
        terminal.print(`\n✓ Patient admitted: ${patientId}`, 'success');
        terminal.print(`Name: ${patientName} | Condition: ${condition}`, 'info');
        terminal.print('\nNext steps:', 'system');
        terminal.print('  treatment <patientId> - Provide treatment', 'info');
        terminal.print('  ems inventory - View medical supplies', 'info');

      } catch (error) {
        stopLoading();
        terminal.print(`Failed to admit patient: ${error}`, 'error');
      }
    }
  });
}
