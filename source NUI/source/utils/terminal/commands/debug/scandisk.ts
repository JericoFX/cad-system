import { defineCommand } from '../../registry';
import type { TerminalCommand } from '../../types';

defineCommand({
  name: 'scandisk',
  description: 'Simula la verificación de disco (tipo Windows 98 scandisk)',
  category: 'demo',
  args: [],
  format: 'custom',
  handler: async ({ terminal }) => {
    terminal.print('╔═══════════════════════════════════════════╗', 'warning');
    terminal.print('║        Microsoft ScanDisk v4.10            ║', 'warning');
    terminal.print('║        Copyright (C) 1981-1998             ║', 'warning');
    terminal.print('╚═══════════════════════════════════════════╝', 'warning');
    terminal.newLine();
    
    terminal.print('Drive C: - ST1000DM010-1EP102');
    terminal.print('File system: NTFS');
    terminal.newLine();
    
    await terminal.wait(500);
    terminal.print('Phase 1: Verifying files and folders...');
    await terminal.progress(['#', '=', '-'], 2500);
    terminal.print('Phase 1 complete. 3,247 files checked.', 'success');
    terminal.newLine();
    
    await terminal.wait(300);
    terminal.print('Phase 2: Checking free space...');
    await terminal.progress('=', 1500);
    terminal.print('Phase 2 complete. 450GB free space.', 'success');
    terminal.newLine();
    
    await terminal.wait(400);
    terminal.print('Phase 3: Checking file allocation tables...');
    await terminal.progress(['#', 'O', 'o'], 2000);
    terminal.print('Phase 3 complete.', 'success');
    terminal.newLine();
    
    await terminal.wait(300);
    terminal.print('Scanning for bad sectors...');
    for (let i = 0; i < 5; i++) {
      terminal.print(`Cylinder ${i * 1000} - ${(i + 1) * 1000} ... OK`);
      await terminal.wait(400);
    }
    terminal.newLine();
    
    await terminal.wait(500);
    terminal.print('╔═══════════════════════════════════════════╗', 'error');
    terminal.print('║           ERRORS FOUND AND FIXED          ║', 'error');
    terminal.print('╠═══════════════════════════════════════════╣', 'warning');
    terminal.print('║ Cross-linked files:         2 (fixed)     ║', 'info');
    terminal.print('║ Lost clusters:              12 (fixed)    ║', 'info');
    terminal.print('║ Invalid filenames:          0             ║', 'info');
    terminal.print('╚═══════════════════════════════════════════╝', 'warning');
    terminal.newLine();
    
    await terminal.wait(400);
    terminal.print('ScanDisk has completed successfully!', 'success');
    terminal.print('All specified drives have been checked.', 'info');
    terminal.newLine();
    
    terminal.openComponent('Table', {
      striped: 'yellow-168',
      data: [
        { error: 'Cross-linked files', count: 2, status: 'Fixed' },
        { error: 'Lost clusters', count: 12, status: 'Fixed' },
        { error: 'Invalid filenames', count: 0, status: 'OK' },
        { error: 'Bad sectors', count: 0, status: 'OK' }
      ]
    });
  }
} as TerminalCommand);
