
import { createCommand, requireCaseLoaded } from '../commandBuilder';
import { cadActions, cadState, type Evidence } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { featureState } from '~/stores/featureStore';

const EVIDENCE_TYPES = ['PHOTO_URL', 'VIDEO_URL', 'DOCUMENT', 'PHYSICAL', 'DIGITAL'] as const;
type EvidenceType = typeof EVIDENCE_TYPES[number];

export function registerEvidenceCommands() {
  createCommand({
    name: 'addevidence',
    aliases: ['add-evidence', 'evidence-add'],
    description: 'Add evidence to a case',
    usage: 'addevidence [case_id] [url]',
    handler: async ({ rawArgs, terminal }) => {
      let caseId: string;
      let url: string | undefined;
      let evidenceType: EvidenceType = 'PHOTO_URL';

      if (rawArgs.length === 0) {
        const currentId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
        if (!currentId) return;
        caseId = currentId;
        
        const typeSelection = await terminal.select('Select evidence type:', [...EVIDENCE_TYPES]);
        evidenceType = typeSelection as EvidenceType;
        
        if (evidenceType === 'PHOTO_URL' || evidenceType === 'VIDEO_URL') {
          url = await terminal.prompt('Enter URL:');
          
          if (!url) {
            terminal.print('Evidence creation cancelled - no URL provided', 'error');
            return;
          }
          
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            terminal.print('URL must start with http:// or https://', 'error');
            return;
          }
        } else {
          (window as any).__evidenceTargetCaseId = caseId;
          terminal.openModal('UPLOAD');
          terminal.print(`Opening evidence uploader for case ${caseId}...`, 'system');
          return;
        }
      } else {
        const firstArg = rawArgs[0];
        const looksLikeUrl = firstArg.startsWith('http://') || firstArg.startsWith('https://');

        if (looksLikeUrl && rawArgs.length === 1) {
          const currentId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
          if (!currentId) return;
          caseId = currentId;
          url = firstArg;
        } else {
          caseId = firstArg;
          if (rawArgs.length > 1) {
            url = rawArgs[1];
          } else {
            url = await terminal.prompt('Enter evidence URL:');
            
            if (!url) {
              terminal.print('Evidence creation cancelled - no URL provided', 'error');
              return;
            }
          }
        }
      }

      const targetCase = cadState.cases[caseId];
      if (!targetCase) {
        terminal.print(`Case not found: ${caseId}`, 'error');
        return;
      }

      if (url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          terminal.print('URL must start with http:// or https://', 'error');
          return;
        }

        const evidence: Evidence = {
          evidenceId: `EVI_${Date.now()}`,
          caseId: caseId,
          evidenceType: evidenceType,
          data: {
            url: url,
            description: 'Added via command line',
            source: 'cli',
          },
          attachedBy: userActions.getCurrentUserId(),
          attachedAt: new Date().toISOString(),
          custodyChain: [],
        };

        cadActions.addCaseEvidence(caseId, evidence);

        terminal.print(`✓ Evidence added successfully`, 'success');
        terminal.print(`  ID: ${evidence.evidenceId}`, 'info');
        terminal.print(`  Case: ${caseId}`, 'info');
        terminal.print(`  Type: ${evidenceType}`, 'info');
      } else {
        (window as any).__evidenceTargetCaseId = caseId;
        terminal.openModal('UPLOAD');
        terminal.print(`Opening evidence uploader for case ${caseId}...`, 'system');
      }
    }
  });

  createCommand({
    name: 'evidence',
    aliases: ['ev', 'evidence-manager'],
    description: 'View/manage case evidence (opens GUI if no args)',
    usage: 'evidence [case_id]',
    handler: async ({ rawArgs, terminal }) => {
      if (rawArgs.length === 0) {
        terminal.print('Opening evidence manager...', 'system');
        terminal.openModal('EVIDENCE');
        return;
      }
      
      let caseId: string;
      caseId = rawArgs[0];

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
  });

  createCommand({
    name: 'forensics',
    aliases: ['forensic', 'lab'],
    description: 'Open forensic collection panel',
    usage: 'forensics',
    handler: async ({ terminal }) => {
      if (!featureState.forensics.enabled || !featureState.forensics.visible) {
        terminal.print('Forensics module is disabled', 'error');
        return;
      }

      terminal.print('Opening forensic collection...', 'system');
      terminal.openModal('FORENSIC_COLLECTION');
    },
  });
}
