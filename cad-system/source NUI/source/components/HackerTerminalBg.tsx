import { createEffect, createSignal, onCleanup } from 'solid-js';

type HackerTerminalBgProps = {
  maxLines?: number;
  intervalMs?: number;
  seed?: number;
  paused?: boolean;
  class?: string;
};

// PRNG seedable
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function timestamp(rng: () => number) {
  const h = pad2((rng() * 24) | 0);
  const m = pad2((rng() * 60) | 0);
  const s = pad2((rng() * 60) | 0);
  const ms = ((rng() * 1000) | 0).toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[(rng() * arr.length) | 0];
}

function hex(rng: () => number, n: number) {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[(rng() * 16) | 0];
  return s;
}

function ip(rng: () => number) {
  const o = () => (rng() * 256) | 0;
  return `${o()}.${o()}.${o()}.${o()}`;
}

function port(rng: () => number) {
  return (1024 + ((rng() * (65535 - 1024)) | 0)).toString();
}

function makeLineFactory(seed: number) {
  const rng = mulberry32(seed);

  const verbs = ['INIT', 'SCAN', 'PROBE', 'AUTH', 'BYPASS', 'INJECT', 'DUMP', 'PATCH', 'HOOK', 'TRACE', 'SNIFF', 'CRACK', 'SYNC', 'RESOLVE', 'EXFIL', 'VERIFY'];
  const targets = ['gateway', 'edge-node', 'auth-service', 'db-cluster', 'cdn', 'vault', 'telemetry', 'router', 'proxy', 'kernel', 'hypervisor', 'daemon', 'control-plane'];
  const statuses = ['OK', 'WARN', 'FAIL', 'RETRY', 'TIMEOUT', 'DENIED', 'GRANTED', 'PARTIAL'];
  const hints = ['rotating keys', 'salt=auto', 'ttl=15s', 'backoff=2x', 'cipher=aes-256-gcm', 'sig=ed25519', 'mode=stealth', 'cache=warm', 'delta=+0.42ms', 'pktloss=0.3%'];

  const formats: Array<() => string> = [
    () => `${pick(rng, verbs)} ${pick(rng, targets)} :: ${pick(rng, statuses)} (${pick(rng, hints)})`,
    () => `tcp://${ip(rng)}:${port(rng)} -> ${ip(rng)}:${port(rng)}  SYN ACK  seq=0x${hex(rng, 8)}`,
    () => `sha256:${hex(rng, 64)}  file=blob_${hex(rng, 6)}.bin  size=${((rng() * 9000) | 0) + 512}B`,
    () => `SQL> SELECT * FROM sessions WHERE token='${hex(rng, 24)}' LIMIT 1;`,
    () => `mem[0x${hex(rng, 8)}]=0x${hex(rng, 8)}  op=write  pid=${((rng() * 9000) | 0) + 100}`,
    () => `trace: ${pick(rng, targets)}.${pick(rng, ['start', 'step', 'commit', 'rollback', 'finalize'])}() latency=${((rng() * 120) | 0) + 1}ms`,
    () => `jwt=${hex(rng, 16)}.${hex(rng, 24)}.${hex(rng, 12)}  aud=${pick(rng, ['api', 'panel', 'svc', 'edge'])}`,
    () => `netstat -tuln | grep ESTABLISHED | wc -l = ${((rng() * 50) | 0) + 10}`,
    () => `ps aux | grep cad_daemon | awk '{print $2}' > /var/run/cad.pid`,
    () => `openssl enc -aes-256-cbc -in /dev/urandom -out /tmp/${hex(rng, 8)}.enc -k ${hex(rng, 32)}`,
    () => `curl -X POST https://api.internal/v1/${pick(rng, ['auth', 'sync', 'log', 'config'])}/ --data '${hex(rng, 64)}'`,
    () => `rsync -avz --progress /var/log/cad/ backup@backup.local:/backups/cad/${hex(rng, 8)}/`,
    () => `grep -r "${hex(rng, 8)}" /var/cad/evidence/ | head -n ${((rng() * 10) | 0) + 1}`,
    () => `df -h /var | tail -1 | awk '{print $5}' # disk usage check`,
    () => `tail -f /var/log/cad/system.log | grep ${pick(rng, ['ERROR', 'WARN', 'INFO', 'DEBUG'])}`,
    () => `uptime # load average: ${(rng() * 2).toFixed(2)}, ${(rng() * 2).toFixed(2)}, ${(rng() * 2).toFixed(2)}`,
  ];

  return () => `[${timestamp(rng)}] ${formats[(rng() * formats.length) | 0]()}`;
}

// Ring buffer: O(1) push, no crece infinito, no memory leak
function createRingBuffer(capacity: number) {
  const arr = new Array<string>(capacity);
  let head = 0;
  let size = 0;

  function push(value: string) {
    arr[(head + size) % capacity] = value;
    if (size < capacity) {
      size++;
    } else {
      head = (head + 1) % capacity;
    }
  }

  function toArray() {
    const out = new Array<string>(size);
    for (let i = 0; i < size; i++) out[i] = arr[(head + i) % capacity];
    return out;
  }

  return { push, toArray };
}

export default function HackerTerminalBg(props: HackerTerminalBgProps) {
  const maxLines = () => Math.max(20, props.maxLines ?? 250);
  const intervalMs = () => Math.max(10, props.intervalMs ?? 35);
  const seed = () => props.seed ?? 20260215;

  const [lines, setLines] = createSignal<string[]>([]);
  let containerRef: HTMLDivElement | undefined;

  let timer: number | undefined;
  let ring = createRingBuffer(maxLines());
  let nextLine = makeLineFactory(seed());

  function tick() {
    ring.push(nextLine());
    setLines(ring.toArray());
  }

  function start() {
    stop();
    timer = window.setInterval(tick, intervalMs());
  }

  function stop() {
 if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  // Re-init si cambian props clave
  createEffect(() => {
    const capacity = maxLines();
    const s = seed();
    ring = createRingBuffer(capacity);
    nextLine = makeLineFactory(s);
    setLines([]);
    if (!props.paused) start();
  });

  // Start/stop based on paused prop
  createEffect(() => {
    if (props.paused) stop();
    else start();
  });

  // Auto-scroll sin cálculos pesados
  createEffect(() => {
    lines();
    queueMicrotask(() => {
      const el = containerRef;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  });

  onCleanup(() => stop());

  return (
    <div
      class={props.class}
      style={{
        position: 'absolute',
        inset: '0',
        'pointer-events': 'none',
        opacity: '0.08',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        'font-size': '11px',
        'line-height': '1.4',
        'white-space': 'pre',
        overflow: 'hidden',
        'z-index': '0',
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: '0',
          padding: '20px',
          overflow: 'hidden',
          'overflow-y': 'auto',
        }}
      >
        {lines().join('\n')}
        {'\n'}<span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
      </div>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
