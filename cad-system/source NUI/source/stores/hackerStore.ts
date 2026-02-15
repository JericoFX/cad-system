import { createStore } from 'solid-js/store';

export interface HackerLine {
  id: string;
  content: string;
  type: 'command' | 'output' | 'system' | 'error';
  timestamp: number;
  isTyping?: boolean;
}

interface HackerState {
  lines: HackerLine[];
  isTyping: boolean;
  maxLines: number;
}

const initialState: HackerState = {
  lines: [],
  isTyping: false,
  maxLines: 50,
};

export const [hackerState, setHackerState] = createStore(initialState);

// Command templates for different actions
const commandTemplates: Record<string, string[]> = {
  modal: [
    'access {modal} --force',
    'open_module {modal} --priority=high',
    'load_interface {modal} --verbose',
    'exec gui.launch --target={modal}',
    'mount /system/{modal}',
  ],
  case: [
    'init_case --id={id} --type={type}',
    'case.create --title="{title}" --priority={priority}',
    'INSERT INTO cases VALUES ("{id}", "{type}", {priority})',
    'log_case --action=CREATE --case_id={id}',
    'dispatch_case --case={id} --status=ACTIVE',
  ],
  search: [
    'query --db=citizens --pattern="{query}"',
    'SELECT * FROM persons WHERE name LIKE "%{query}%"',
    'search --target={type} --param="{query}" --limit=50',
    'grep -r "{query}" /data/records/',
    'db.query({table: "{type}", filter: "{query}"})',
  ],
  evidence: [
    'upload --type={type} --case={caseId} --secure',
    'evidence.add --case={caseId} --hash={hash}',
    'file.transfer --src=/temp --dst=/evidence/{caseId}',
    'encrypt --input={filename} --output={filename}.enc',
  ],
  dispatch: [
    'unit.status --id={unitId} --state={status}',
    'dispatch.assign --call={callId} --unit={unitId}',
    'gps.track --unit={unitId} --refresh=5s',
    'radio.broadcast --channel={channel} --msg="{message}"',
  ],
  system: [
    'ping -c 3 {host}',
    'netstat -an | grep ESTABLISHED',
    'ps aux | grep cad_daemon',
    'tail -f /var/log/cad/system.log',
    'sync && echo "CACHE_FLUSHED"',
    'df -h /data',
    'uptime',
    'whoami',
    'cat /proc/meminfo | grep MemFree',
  ],
  auth: [
    'auth.login --user={badge} --secure',
    'session.init --token={token} --ttl=3600',
    'verify_permissions --role={role} --resource={resource}',
    'audit.log --action={action} --user={badge}',
  ],
};

const systemOutputs: Record<string, string[]> = {
  success: [
    'OK',
    'DONE',
    'COMPLETE',
    '[SUCCESS]',
    '...done',
    '└─ Status: 200 OK',
    '└─ Execution time: 45ms',
  ],
  info: [
    'Loading...',
    'Processing...',
    'Connecting...',
    'Syncing data...',
    'Encrypting...',
    'Verifying...',
    'Scanning...',
  ],
  data: [
    '└─ Records found: {count}',
    '└─ File size: {size}',
    '└─ Hash: {hash}',
    '└─ Latency: {latency}ms',
  ],
};

// Random system noise commands
const noiseCommands = [
  'ping -c 1 dispatch.local',
  'netstat -tuln',
  'df -h',
  'uptime',
  'whoami',
  'date +%s',
  'cat /proc/loadavg',
  'free -m',
  'ls -la /var/cad/',
  'ps aux | grep cad',
  'tail -n 5 /var/log/cad/access.log',
  'echo $PATH',
  'id',
  'hostname',
  'uname -a',
  'last | head -5',
];

function generateId(): string {
  return `hack_${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

export const hackerActions = {
  addLine: (content: string, type: HackerLine['type'] = 'output') => {
    const line: HackerLine = {
      id: generateId(),
      content,
      type,
      timestamp: Date.now(),
    };
    setHackerState('lines', (prev) => {
      const newLines = [...prev, line];
      if (newLines.length > hackerState.maxLines) {
        return newLines.slice(newLines.length - hackerState.maxLines);
      }
      return newLines;
    });
    return line.id;
  },

  addCommand: (category: keyof typeof commandTemplates, vars: Record<string, string> = {}) => {
    const templates = commandTemplates[category];
    if (!templates) return;
    
    const template = getRandomItem(templates);
    const command = interpolate(template, vars);
    
    hackerActions.addLine(`$ ${command}`, 'command');
    
    // Simulate output after a short delay
    setTimeout(() => {
      const outputType = getRandomItem(['success', 'success', 'info']);
      const outputs = systemOutputs[outputType];
      const output = getRandomItem(outputs);
      
      // Add some data interpolation for outputs
      const dataVars: Record<string, string> = {
        count: Math.floor(Math.random() * 100).toString(),
        size: `${Math.floor(Math.random() * 50 + 1)}MB`,
        hash: Math.random().toString(36).substring(2, 10),
        latency: Math.floor(Math.random() * 200).toString(),
        ...vars,
      };
      
      hackerActions.addLine(interpolate(output, dataVars), 'output');
    }, Math.random() * 300 + 100);
  },

  addNoise: () => {
    const command = getRandomItem(noiseCommands);
    hackerActions.addLine(`$ ${command}`, 'command');
    
    setTimeout(() => {
      const responses = [
        '64 bytes from dispatch.local: icmp_seq=1 ttl=64 time=0.042ms',
        'tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN',
        'Filesystem      Size  Used Avail Use% Mounted on',
        '/dev/sda1        50G   12G   36G  26% /',
        'load average: 0.45, 0.38, 0.42',
        'cad_user   1337  0.1  2.3 123456 7890 ?        Ss   10:30   0:05 cad_daemon',
        'uid=1000(cad_user) gid=1000(cad_group) groups=1000(cad_group)',
      ];
      hackerActions.addLine(getRandomItem(responses), 'output');
    }, Math.random() * 200 + 50);
  },

  // Specific action methods
  onModalOpen: (modalName: string) => {
    hackerActions.addCommand('modal', { modal: modalName.toLowerCase().replace('_', '-') });
  },

  onCaseCreate: (caseId: string, title: string, type: string, priority: number) => {
    hackerActions.addCommand('case', {
      id: caseId,
      title: title.substring(0, 20),
      type: type.toLowerCase(),
      priority: priority.toString(),
    });
  },

  onSearch: (query: string, type: 'person' | 'vehicle' | 'case') => {
    hackerActions.addCommand('search', {
      query: query.substring(0, 30),
      type: `${type}s`,
    });
  },

  onEvidenceUpload: (caseId: string, evidenceType: string) => {
    hackerActions.addCommand('evidence', {
      caseId,
      type: evidenceType.toLowerCase().replace(' ', '_'),
      hash: Math.random().toString(36).substring(2, 18),
      filename: `evidence_${Date.now()}.dat`,
    });
  },

  onDispatchAction: (action: string, unitId?: string, callId?: string) => {
    const vars: Record<string, string> = { action };
    if (unitId) vars.unitId = unitId;
    if (callId) vars.callId = callId;
    vars.channel = `ch_${Math.floor(Math.random() * 16) + 1}`;
    vars.message = action;
    vars.status = ['AVAILABLE', 'BUSY', 'EN_ROUTE'][Math.floor(Math.random() * 3)];
    hackerActions.addCommand('dispatch', vars);
  },

  onAuth: (badge: string, role: string) => {
    hackerActions.addCommand('auth', {
      badge,
      role: role.toLowerCase().replace(' ', '_'),
      token: Math.random().toString(36).substring(2, 34),
      action: 'LOGIN',
    });
  },

  addSystemNoise: (count: number = 1) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        hackerActions.addNoise();
      }, i * 150);
    }
  },

  clear: () => {
    setHackerState('lines', []);
  },
};

// Auto-generate background noise
let noiseInterval: number | null = null;

export const hackerEffects = {
  startNoise: (intervalMs: number = 3000) => {
    if (noiseInterval) return;
    noiseInterval = window.setInterval(() => {
      if (Math.random() > 0.3) {
        hackerActions.addNoise();
      }
    }, intervalMs);
  },

  stopNoise: () => {
    if (noiseInterval) {
      clearInterval(noiseInterval);
      noiseInterval = null;
    }
  },

  burst: (count: number = 5) => {
    hackerActions.addSystemNoise(count);
  },
};
