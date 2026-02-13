import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

defineCommand({
  name: 'boot-system',
  description: 'Simula el inicio del sistema operativo (boot sequence)',
  category: 'demo',
  args: [],
  format: 'custom',
  handler: async ({ terminal }) => {
    terminal.print('═══════════════════════════════════════════', 'info');
    terminal.print('           BIOS DATE 01/31/26 14:35:22      ', 'info');
    terminal.print('                VER 1.0.1                   ', 'info');
    terminal.print('═══════════════════════════════════════════', 'info');
    terminal.newLine();
    
    await terminal.wait(500);
    terminal.print('CPU: Intel(R) Core(TM) i7-9700K @ 3.60GHz');
    await terminal.wait(300);
    
    terminal.print('Memory Test: 16384K RAM');
    await terminal.progress('#', 800);
    terminal.print('Memory Test: 16384K OK', 'success');
    terminal.newLine();
    
    await terminal.wait(400);
    terminal.print('Detecting primary master ... ST1000DM010-1EP102');
    await terminal.wait(300);
    terminal.print('Detecting primary slave  ... DVD-ROM Drive');
    terminal.newLine();
    
    await terminal.wait(500);
    terminal.print('Loading operating system...');
    await terminal.progress(['#', '=', '-'], 2000);
    terminal.newLine();
    
    await terminal.wait(300);
    terminal.print('Initializing kernel modules...');
    await terminal.progress('#', 1500);
    terminal.newLine();
    
    await terminal.wait(400);
    terminal.print('Mounting file systems...');
    await terminal.progress(['/', '-', '\\', '|'], 1200);
    terminal.newLine();
    
    await terminal.wait(300);
    terminal.print('Starting system services...');
    await terminal.progress('=', 1000);
    terminal.newLine();
    
    await terminal.wait(200);
    terminal.print('═══════════════════════════════════════════', 'success');
    terminal.print('     SYSTEM READY - PRESS ENTER TO START   ', 'success');
    terminal.print('═══════════════════════════════════════════', 'success');
    terminal.newLine();
    
    terminal.openComponent('Window', { 
      title: 'System Ready',
      children: 'Welcome to Police OS v1.0'
    });
  }
} as TerminalCommand);
