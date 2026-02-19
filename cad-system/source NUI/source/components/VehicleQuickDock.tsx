import { createMemo, Show } from 'solid-js';
import { terminalState } from '~/stores/terminalStore';

const panelStyle: Record<string, string> = {
  position: 'fixed',
  right: '14px',
  bottom: '14px',
  width: 'min(360px, calc(100vw - 24px))',
  'z-index': '7200',
  border: '2px solid var(--terminal-border)',
  background: 'rgba(0, 0, 0, 0.82)',
  padding: '10px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'pointer-events': 'auto',
};

export function VehicleQuickDock() {
  const lock = createMemo(() => terminalState.vehicleQuickLock);

  const riskColor = createMemo(() => {
    if (!lock()) return 'var(--terminal-fg-dim)';
    if (lock()!.riskLevel === 'HIGH') return 'var(--terminal-error-bright)';
    if (lock()!.riskLevel === 'MEDIUM') return 'var(--terminal-system-bright)';
    return 'var(--priority-low)';
  });

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
        <strong>TRAFFIC DOCK</strong>
        <span style={{ color: 'var(--terminal-fg-dim)', 'font-size': '12px' }}>[READY]</span>
      </div>

      <Show when={lock()} fallback={<div style={{ color: 'var(--terminal-fg-dim)' }}>No front lock yet.</div>}>
        <div class="info-grid" style={{ 'grid-template-columns': '1fr 1fr', gap: '6px' }}>
          <div class="info-item">
            <label>Plate</label>
            <span class="value plate-value">{lock()!.plate}</span>
          </div>
          <div class="info-item">
            <label>Risk</label>
            <span class="value" style={{ color: riskColor() }}>
              {lock()!.riskLevel}
            </span>
          </div>
          <div class="info-item full-width">
            <label>Tags</label>
            <span class="value">{lock()!.riskTags.length > 0 ? lock()!.riskTags.join(', ') : 'NONE'}</span>
          </div>
          <Show when={lock()!.noteHint}>
            <div class="info-item full-width">
              <label>Hint</label>
              <span class="value">{lock()!.noteHint}</span>
            </div>
          </Show>
        </div>
      </Show>

      <div style={{ color: 'var(--terminal-fg-dim)', 'font-size': '12px' }}>
        [K] Lock front | [F6] Open tablet | [U] Toggle quick dock
      </div>
    </div>
  );
}
