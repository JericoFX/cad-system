import { createSignal, createEffect, onCleanup } from 'solid-js';
import { terminalState, terminalActions } from '~/stores/terminalStore';
import { cadState } from '~/stores/cadStore';

export function VehicleCAD() {
  const [radarActive, setRadarActive] = createSignal(true);
  const [licenseScanActive, setLicenseScanActive] = createSignal(false);
  const [scanProgress, setScanProgress] = createSignal(0);
  const [attachedVehicle, setAttachedVehicle] = createSignal<{
    plate: string;
    model: string;
    color: string;
    owner: string;
    status: string;
    warrants: string[];
  } | null>(null);
  const [radarData, setRadarData] = createSignal<{
    id: number;
    coords: { x: number; y: number; z: number };
    distance: number;
    isWanted: boolean;
  }[]>([]);

  // Radar canvas setup
  let radarCanvas: HTMLCanvasElement | undefined;

  const drawRadar = () => {

  // Attach to vehicle
  const attachToVehicle = () => {
    // Find nearest vehicle
    const nearest = radarData().sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) return;

    // Mock vehicle data
    const vehicle = {
      plate: `MOCK-${Math.floor(Math.random() * 900) + 100}`,
      model: 'police',
      color: 'Black and White',
      owner: 'CIT-123456',
      status: nearest.isWanted ? 'WANTED' : 'NORMAL',
      warrants: nearest.isWanted ? ['Speeding', 'Theft'] : []
    };

    setAttachedVehicle(vehicle);
    terminalActions.addLine(`✓ Attached to vehicle: ${vehicle.plate}`, 'output');
  };

    if (!radarCanvas || !radarActive()) return;

    const ctx = radarCanvas.getContext('2d');
    if (!ctx) return;

    const size = Math.min(radarCanvas.width, radarCanvas.height);
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRange = 100; // meters

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw radar background
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();

    // Draw range circles
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (size / 2) * (i / 3), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.stroke();
    }

    // Draw vehicles
    radarData().forEach(vehicle => {
      const angle = Math.atan2(
        vehicle.coords.y - cadState.playerCoords.y,
        vehicle.coords.x - cadState.playerCoords.x
      );
      const distanceRatio = Math.min(vehicle.distance / maxRange, 1);
      const x = centerX + Math.cos(angle) * (size / 2) * distanceRatio;
      const y = centerY + Math.sin(angle) * (size / 2) * distanceRatio;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = vehicle.isWanted ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
      ctx.fill();
    });
  };

  // Start radar updates
  createEffect(() => {
    if (!radarActive()) return;

    const interval = setInterval(() => {
      // Simulate radar data (would come from vehicle_cad.lua in real implementation)
      setRadarData([
        {
          id: 1,
          coords: { x: cadState.playerCoords.x + 15, y: cadState.playerCoords.y + 5, z: 0 },
          distance: 15.7,
          isWanted: false
        },
        {
          id: 2,
          coords: { x: cadState.playerCoords.x - 25, y: cadState.playerCoords.y + 30, z: 0 },
          distance: 39.1,
          isWanted: true
        }
      ]);
      drawRadar();
    }, 1000);

    onCleanup(() => clearInterval(interval));
  });

  // License scan simulation
  const startLicenseScan = () => {
    setLicenseScanActive(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setLicenseScanActive(false);
          terminalActions.addLine('License scan complete: ABC123', 'output');
          return 100;
        }
        return p + 10;
      });
    }, 200);
  };

  return (
    <div class="modal-overlay" onClick={() => terminalActions.setActiveModal(null)}>
      <div class="modal-content vehicle-cad" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== VEHICLE CAD ===</h2>
          <div class="vehicle-status">
            <span class={`status-indicator ${terminalState.uiMode === 'compact' ? 'compact' : ''}`}></span>
            {terminalState.uiMode === 'compact' ? 'COMPACT MODE' : 'NORMAL MODE'}
          </div>
          <button class="modal-close" onClick={() => terminalActions.setActiveModal(null)}>[X]</button>
        </div>

        <div class="vehicle-cad-content">
          {/* Radar Display */}
          <div class="radar-section">
            <div class="radar-header">
              <h3>RADAR</h3>
              <button 
                class={`btn ${radarActive() ? 'btn-primary' : ''}`} 
                onClick={() => setRadarActive(!radarActive())}
              >
                [{radarActive() ? 'ON' : 'OFF'}]
              </button>
            </div>
            <div class="radar-container">
              <canvas
                ref={radarCanvas}
                width="300"
                height="300"
                class="radar-canvas"
              ></canvas>
              <div class="radar-legend">
                <div class="legend-item">
                  <span class="legend-color" style={{ background: 'rgba(0, 255, 0, 0.8)' }}></span>
                  Normal Vehicle
                </div>
                <div class="legend-item">
                  <span class="legend-color" style={{ background: 'rgba(255, 0, 0, 0.8)' }}></span>
                  Wanted Vehicle
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div class="quick-actions">
            <div class="action-group">
              <h3>QUICK ACTIONS</h3>
              <div class="action-buttons">
                <button 
                  class="btn"
                  disabled={licenseScanActive()}
                  onClick={startLicenseScan}
                >
                  [SCAN LICENSE]
                </button>
                
                <button 
                  class="btn"
                  onClick={attachToVehicle}
                >
                  [VEHICLE INFO]
                </button>
                
                {licenseScanActive() && (
                  <div class="scan-progress">
                    Scanning...
                    <div class="progress-bar">
                      <div 
                        class="progress-fill" 
                        style={{ width: `${scanProgress()}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <button class="btn" onClick={() => terminalActions.setActiveModal('RADIO_PANEL')}>
                  [RADIO]
                </button>
                
                <select class="dos-select" onChange={e => terminalActions.addLine(`Dispatch: ${e.currentTarget.value}`, 'output')}>
                  <option value="">QUICK DISPATCH</option>
                  <option value="10-31">10-31 (Pursuit)</option>
                  <option value="10-50">10-50 (Accident)</option>
                  <option value="10-71">10-71 (Shots Fired)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div class="recent-alerts">
            <h3>RECENT ALERTS</h3>
            <div class="alerts-list">
              <div class="alert-item wanted">
                <span class="alert-type">[WANTED]</span>
                Vehicle: XYZ789 | Location: Vinewood Blvd
              </div>
              <div class="alert-item priority">
                <span class="alert-type">[PRIORITY]</span>
                10-31 in progress | Units: 3
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <span>Speed: {cadState.vehicleSpeed.toFixed(1)} MPH | Radar Range: 100m</span>
          <button class="btn" onClick={() => terminalActions.setActiveModal(null)}>[CLOSE]</button>
        </div>

        {/* Attached Vehicle Info */}
        <Show when={attachedVehicle()}>
          <div class="attached-vehicle">
            <h3>ATTACHED VEHICLE: {attachedVehicle()!.plate}</h3>
            <div class="vehicle-details">
              <div>Model: {attachedVehicle()!.model}</div>
              <div>Color: {attachedVehicle()!.color}</div>
              <div>Owner: {attachedVehicle()!.owner}</div>
              <div>Status: <span class={attachedVehicle()!.status === 'WANTED' ? 'status-wanted' : ''}>{attachedVehicle()!.status}</span></div>
              <Show when={attachedVehicle()!.warrants.length > 0}>
                <div>Warrants:
                  <ul>
                    <For each={attachedVehicle()!.warrants}>
                      {warrant => <li>- {warrant}</li>}
                    </For>
                  </ul>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}