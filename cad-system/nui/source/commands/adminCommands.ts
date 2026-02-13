import { registry } from './registry';
import { terminalActions } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CAD_ASCII = `
╔═══════════════════════════════════════╗
║     ██████  █████  ██████             ║
║    ██      ██   ██ ██   ██            ║
║    ██      ███████ ██   ██            ║
║    ██      ██   ██ ██   ██            ║
║     ██████ ██   ██ ██████             ║
║                                       ║
║   COMPUTER AIDED DISPATCH SYSTEM      ║
║            VERSION 1.0                ║
║            JERICOFX                   ║
╚═══════════════════════════════════════╝
`;

const animateProgress = async (label: string, duration: number = 2000) => {
  const steps = 20;
  const stepDuration = duration / steps;
  const progressId = `progress-${label}-${Date.now()}`;

  for (let i = 0; i <= steps; i++) {
    const percent = Math.round((i / steps) * 100);
    const bar = '█'.repeat(i) + '░'.repeat(steps - i);
    terminalActions.addOrUpdateLine(
      progressId,
      `[${label}] ${bar} ${percent}%`,
      'system',
    );
    await sleep(stepDuration);
  }
};

registry.register({
  name: 'admin',
  aliases: ['adm', 'sudo'],
  description: 'Administrative commands',
  usage: 'admin <status|clear|reset|export|import|backup|system>',
  handler: async (ctx) => {
    const subcommand = ctx.args[0]?.toLowerCase();

    switch (subcommand) {
      case 'status':
      case 'sysinfo': {
        terminalActions.addLine('=== SYSTEM STATUS ===', 'system');
        terminalActions.addLine('', 'output');
        terminalActions.addLine('Memory Usage:', 'output');
        terminalActions.addLine(
          `  Cases: ${Object.keys(cadState.cases).length}`,
          'output',
        );
        terminalActions.addLine(
          `  Units: ${Object.keys(cadState.dispatchUnits).length}`,
          'output',
        );
        terminalActions.addLine(
          `  Calls: ${Object.keys(cadState.dispatchCalls).length}`,
          'output',
        );
        terminalActions.addLine(
          `  Staging: ${cadState.stagingEvidence.length}`,
          'output',
        );
        terminalActions.addLine('', 'output');
        terminalActions.addLine('System Status: ONLINE', 'output');
        terminalActions.addLine('Database: CONNECTED', 'output');
        terminalActions.addLine('Dispatch: ACTIVE', 'output');
        break;
      }

      case 'clear':
      case 'cleanup': {
        terminalActions.addLine('Initializing system cleanup...', 'system');
        await animateProgress('CLEANUP', 1500);
        terminalActions.addLine('✓ Cleanup completed', 'output');
        break;
      }

      case 'reset':
      case 'reboot': {
        terminalActions.addLine(
          'WARNING: This will reset all session data!',
          'error',
        );
        terminalActions.addLine(
          'Type "admin confirm-reset" to proceed',
          'system',
        );
        break;
      }

      case 'confirm-reset': {
        terminalActions.addLine('Resetting system...', 'system');
        await animateProgress('RESET', 2000);
        cadActions.clearAll();
        terminalActions.addLine('✓ System reset completed', 'output');
        terminalActions.addLine('All session data cleared', 'system');
        break;
      }

      case 'export': {
        terminalActions.addLine('Exporting system data...', 'system');
        await animateProgress('EXPORT', 1000);
        const data = {
          timestamp: new Date().toISOString(),
          cases: cadState.cases,
          units: cadState.dispatchUnits,
          calls: cadState.dispatchCalls,
        };
        terminalActions.addLine('✓ Export completed', 'output');
        terminalActions.addLine(
          `Data size: ${JSON.stringify(data).length} bytes`,
          'output',
        );
        break;
      }

      case 'backup': {
        terminalActions.addLine('Creating system backup...', 'system');
        await animateProgress('BACKUP', 1500);
        terminalActions.addLine(
          '✓ Backup created: backup_' + Date.now() + '.cad',
          'output',
        );
        break;
      }

      case 'system':
      case 'boot': {
        terminalActions.clear();
        await sleep(500);

        const bootLines = [
          'BIOS DATE 01/15/25 14:22:51 VER 1.0.4',
          'CPU: INTEL(R) CORE(TM) i7-9700K @ 3.60GHz',
          'SPEED: 3600 MHz',
          'INITIALIZING USB CONTROLLERS...',
          'LOADING KERNEL...',
          'MOUNTING FILESYSTEMS...',
          'STARTING CAD SERVICES...',
          'CONNECTING TO DATABASE...',
          'LOADING MODULES...',
          '',
        ];

        for (const line of bootLines) {
          terminalActions.addLine(line, 'system');
          await sleep(200);
        }

        terminalActions.addLine(CAD_ASCII, 'system');
        terminalActions.addLine('', 'output');
        terminalActions.addLine('C.A.D. SYSTEM READY BY JERICOFX', 'system');
        terminalActions.addLine('Type "help" for available commands', 'system');
        break;
      }

      case 'ascii':
      case 'banner': {
        terminalActions.addLine(CAD_ASCII, 'system');
        break;
      }

      default:
        terminalActions.addLine('Available admin commands:', 'system');
        terminalActions.addLine(
          '  admin status      - Show system status',
          'output',
        );
        terminalActions.addLine(
          '  admin clear       - Run system cleanup',
          'output',
        );
        terminalActions.addLine(
          '  admin reset       - Reset session data',
          'output',
        );
        terminalActions.addLine(
          '  admin export      - Export system data',
          'output',
        );
        terminalActions.addLine(
          '  admin backup      - Create backup',
          'output',
        );
        terminalActions.addLine(
          '  admin system      - Boot sequence',
          'output',
        );
        terminalActions.addLine(
          '  admin ascii       - Show ASCII banner',
          'output',
        );
    }
  },
});

registry.register({
  name: 'progress',
  aliases: ['bar', 'loading'],
  description: 'Show progress bar animation',
  usage: 'progress [label] [duration]',
  handler: async (ctx) => {
    const label = ctx.args[0] || 'LOADING';
    const duration = parseInt(ctx.args[1]) || 2000;
    await animateProgress(label.toUpperCase(), duration);
    terminalActions.addLine('✓ Complete', 'output');
  },
});

registry.register({
  name: 'ascii',
  aliases: ['art'],
  description: 'Show ASCII art',
  usage: 'ascii <police|dispatch|alert|computer>',
  handler: (ctx) => {
    const art = ctx.args[0]?.toLowerCase();

    const arts: Record<string, string> = {
      police: `
    🚔 POLICE 🚔
    ████████████
    ██        ██
    ██  👮   ██
    ██        ██
    ████████████
    ▀▀▀▀▀▀▀▀▀▀▀▀
      `,
      dispatch: `
    📡 DISPATCH 📡
    ╔════════════╗
    ║  ▓▓▓▓▓▓▓▓  ║
    ║  ▓ RADIO ▓  ║
    ║  ▓▓▓▓▓▓▓▓  ║
    ╚════════════╝
      `,
      alert: `
    ⚠️  ALERT  ⚠️
    ▄▄▄▄▄▄▄▄▄▄▄▄
    █ ▄▄▄▄▄▄▄ █
    █ █ ! ! █ █
    █ █ ! ! █ █
    █ ▀▀▀▀▀▀▀ █
    ▀▀▀▀▀▀▀▀▀▀▀▀
      `,
      computer: `
    💻 COMPUTER 💻
    ┌──────────┐
    │ ░░░░░░░░ │
    │ ░░CAD░░░ │
    │ ░░░░░░░░ │
    └──────────┘
       [____]
      `,
    };

    if (art && arts[art]) {
      terminalActions.addLine(arts[art], 'system');
    } else {
      terminalActions.addLine('Available ASCII art:', 'system');
      Object.keys(arts).forEach((a) => {
        terminalActions.addLine(`  ascii ${a}`, 'output');
      });
    }
  },
});
