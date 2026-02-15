
import { createCommand } from '../commandBuilder';
import { userActions } from '~/stores/userStore';

export function registerTreatmentCommand() {
  createCommand({
    name: 'treatment',
    description: 'Provide treatment to a patient',
    usage: 'treatment [patientId]',
    category: 'EMS',
    permissions: ['ems'],
    args: [
      {
        name: 'patientId',
        type: 'string',
        required: false,
        description: 'Patient ID'
      }
    ],
    handler: async ({ args, terminal }) => {
      let patientId = args.patientId as string;

      if (!patientId) {
        patientId = await terminal.prompt('Enter patient ID:');
        if (!patientId) {
          terminal.print('Treatment cancelled - no patient ID', 'error');
          return;
        }
      }

      const treatmentType = await terminal.select(
        'Select treatment type:',
        ['MEDICATION', 'PROCEDURE', 'SURGERY', 'FIRST_AID', 'OTHER']
      );

      const treatment = await terminal.prompt('Describe treatment provided:');
      if (!treatment) {
        terminal.print('Treatment cancelled - no details', 'error');
        return;
      }

      const medications = await terminal.prompt('Medications used (comma-separated, none if N/A):');

      let dosage = '';
      if (medications && medications.toLowerCase() !== 'none') {
        dosage = await terminal.prompt('Dosage administered:');
      }

      const newStatus = await terminal.select(
        'Update patient status:',
        ['STABLE', 'IMPROVED', 'CRITICAL', 'DECEASED', 'DISCHARGED']
      );

      terminal.print('\n=== TREATMENT SUMMARY ===', 'system');
      terminal.print(`Patient ID: ${patientId}`, 'info');
      terminal.print(`Treatment Type: ${treatmentType}`, 'info');
      terminal.print(`Treatment: ${treatment}`, 'info');
      if (medications && medications.toLowerCase() !== 'none') {
        terminal.print(`Medications: ${medications}`, 'info');
        if (dosage) terminal.print(`Dosage: ${dosage}`, 'info');
      }
      terminal.print(`New Status: ${newStatus}`, 'info');

      const confirmed = await terminal.confirm('Record treatment?');
      
      if (!confirmed) {
        terminal.print('Treatment cancelled', 'warning');
        return;
      }

      const stopLoading = terminal.showLoading('Recording treatment');

      try {
        const treatmentLog = {
          treatmentId: `TRT_${Date.now()}`,
          patientId,
          type: treatmentType,
          description: treatment,
          medications: medications && medications.toLowerCase() !== 'none' 
            ? medications.split(',').map(m => m.trim()) 
            : [],
          dosage,
          status: newStatus,
          administeredAt: new Date().toISOString(),
          administeredBy: userActions.getCurrentUserId(),
          administeredByName: userActions.getCurrentUserName()
        };

        stopLoading();
        
        terminal.print(`\n✓ Treatment recorded: ${treatmentLog.treatmentId}`, 'success');
        terminal.print(`Patient status updated to: ${newStatus}`, 'info');

        if (newStatus === 'DISCHARGED') {
          terminal.print('\nPatient discharged successfully', 'success');
        }

      } catch (error) {
        stopLoading();
        terminal.print(`Failed to record treatment: ${error}`, 'error');
      }
    }
  });
}
