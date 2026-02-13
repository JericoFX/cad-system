
const PC_NAMES = [
  'DISPATCH-ALPHA',
  'DISPATCH-BETA', 
  'DISPATCH-GAMMA',
  'CAD-STATION-01',
  'CAD-STATION-02',
  'EMERGENCY-NODE-A',
  'EMERGENCY-NODE-B',
  'POLICE-TERMINAL-X',
  'POLICE-TERMINAL-Y',
  'JERICOFX-CAD-01',
  'JERICOFX-CAD-02',
  'CENTRAL-DISPATCH',
  'REGIONAL-CAD-01',
  'FIELD-TERMINAL-03',
  'MOBILE-CAD-UNIT',
  'PATROL-STATION-07',
  'DISPATCH-HUB-12',
  'EMERGENCY-CTRL-05'
];

const ASCII_LOGO = `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     ██╗███████╗██████╗ ██╗ ██████╗  ██████╗ ███████╗██╗  ██╗    ║
║     ██║██╔════╝██╔══██╗██║██╔════╝ ██╔═══██╗██╔════╝╚██╗██╔╝    ║
║     ██║█████╗  ██████╔╝██║██║  ███╗██║   ██║█████╗   ╚███╔╝     ║
║     ██║██╔══╝  ██╔══██╗██║██║   ██║██║   ██║██╔══╝   ██╔██╗     ║
║     ██║██║     ██║  ██║██║╚██████╔╝╚██████╔╝██║     ██╔╝ ██╗    ║
║     ╚═╝╚═╝     ╚═╝  ╚═╝╚═╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝  ╚═╝    ║
║                                                                  ║
║              ██████╗ █████╗ ██████╗     ███████╗██╗   ██╗███████╗║
║             ██╔════╝██╔══██╗██╔══██╗    ██╔════╝██║   ██║██╔════╝║
║             ██║     ███████║██║  ██║    █████╗  ██║   ██║█████╗  ║
║             ██║     ██╔══██║██║  ██║    ██╔══╝  ╚██╗ ██╔╝██╔══╝  ║
║             ╚██████╗██║  ██║██████╔╝    ███████╗ ╚████╔╝ ███████╗║
║              ╚═════╝╚═╝  ╚═╝╚═════╝     ╚══════╝  ╚═══╝  ╚══════╝║
║                                                                  ║
║                   COMPUTER AIDED DISPATCH SYSTEM                 ║
║                           VERSION 1.0.0                          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`;

const JOB_ASCII: Record<string, string> = {
  police: `
╔══════════════════════════════════════════════════╗
║                                                  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║  ▓                                            ▓  ║
║  ▓           🚔  POLICE  DEPARTMENT           ▓  ║
║  ▓                                            ▓  ║
║  ▓          OFFICER  ACCESS  TERMINAL         ▓  ║
║  ▓                                            ▓  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
╚══════════════════════════════════════════════════╝`,

  ems: `
╔══════════════════════════════════════════════════╗
║                                                  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║  ▓                                            ▓  ║
║  ▓         🚑  EMERGENCY  MEDICAL  SVCS       ▓  ║
║  ▓                                            ▓  ║
║  ▓          PARAMEDIC  ACCESS  TERMINAL       ▓  ║
║  ▓                                            ▓  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
╚══════════════════════════════════════════════════╝`,

  dispatch: `
╔══════════════════════════════════════════════════╗
║                                                  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║  ▓                                            ▓  ║
║  ▓         📡  CENTRAL  DISPATCH  CENTER      ▓  ║
║  ▓                                            ▓  ║
║  ▓          OPERATOR  ACCESS  TERMINAL        ▓  ║
║  ▓                                            ▓  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
╚══════════════════════════════════════════════════╝`,

  sheriff: `
╔══════════════════════════════════════════════════╗
║                                                  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║  ⭐                                            ⭐  ║
║  ▓        ⭐  SHERIFF  DEPARTMENT  ⭐          ▓  ║
║  ▓                                            ▓  ║
║  ▓        DEPUTY  ACCESS  TERMINAL            ▓  ║
║  ⭐                                            ⭐  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
╚══════════════════════════════════════════════════╝`,

  default: `
╔══════════════════════════════════════════════════╗
║                                                  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
║  ▓                                            ▓  ║
║  ▓         💻  C.A.D.  TERMINAL               ▓  ║
║  ▓                                            ▓  ║
║  ▓          AUTHORIZED  ACCESS  ONLY          ▓  ║
║  ▓                                            ▓  ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║
╚══════════════════════════════════════════════════╝`
};

export function getRandomPCName(): string {
  return PC_NAMES[Math.floor(Math.random() * PC_NAMES.length)];
}

export function getJobASCII(job: string): string {
  return JOB_ASCII[job] || JOB_ASCII.default;
}

export function generateBootScreen(job: string = 'dispatch', officerName: string = 'Officer'): string[] {
  const pcName = getRandomPCName();
  const lines: string[] = [];
  
  lines.push('');
  lines.push(ASCII_LOGO);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push(`[SYSTEM] Terminal ID: ${pcName}`);
  lines.push(`[SYSTEM] Operator: ${officerName}`);
  lines.push(`[SYSTEM] Role: ${job.toUpperCase()}`);
  lines.push(`[SYSTEM] Security Level: CLASSIFIED`);
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(getJobASCII(job));
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push(`[${new Date().toLocaleString()}] System initialization started...`);
  lines.push('[OK] BIOS Check: PASSED');
  lines.push('[OK] Memory Test: 64MB OK');
  lines.push('[OK] Loading Kernel...');
  lines.push('[OK] Mounting File Systems...');
  lines.push('[OK] Initializing Network...');
  lines.push('[OK] Connecting to Database...');
  lines.push('[OK] Loading C.A.D. Modules...');
  lines.push('[OK] Dispatch Module: ACTIVE');
  lines.push('[OK] Evidence Module: ACTIVE');
  lines.push('[OK] Search Module: ACTIVE');
  lines.push('[OK] Radio Interface: ONLINE');
  lines.push('[OK] GPS System: LOCKED');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('C.A.D. SYSTEM READY');
  lines.push('');
  lines.push('Type "help" for available commands');
  lines.push('');
  
  return lines;
}

export function generateMiniBoot(): string[] {
  const pcName = getRandomPCName();
  
  return [
    '',
    '╔════════════════════════════════════════╗',
    '║     JERICOFX C.A.D. SYSTEM v1.0        ║',
    '╚════════════════════════════════════════╝',
    '',
    `[SYSTEM] Terminal: ${pcName}`,
    `[SYSTEM] Status: ONLINE`,
    `[SYSTEM] Database: CONNECTED`,
    '',
    'Type "help" for available commands',
    ''
  ];
}
