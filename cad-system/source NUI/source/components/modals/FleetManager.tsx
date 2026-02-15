
import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { fleetState, fleetActions, type VehicleType, type VehicleStatus } from '~/stores/fleetStore';

export function FleetManager() {
  const [selectedVehicle, setSelectedVehicle] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<'list' | 'map'>('list');
  
  onMount(() => {
    fleetActions.startTracking();
    const interval = setInterval(() => {
      const updates = Object.values(fleetState.vehicles).map(v => ({
        unitId: v.unitId,
        location: v.location,
        heading: v.location.heading,
        speed: Math.random() * 80,
        timestamp: new Date().toISOString()
      }));
      fleetActions.updateGPS(updates);
    }, 5000);
    
    return () => {
      clearInterval(interval);
      fleetActions.stopTracking();
    };
  });
  
  const filteredVehicles = createMemo(() => fleetActions.getFilteredVehicles());
  const stats = createMemo(() => fleetActions.getStats());
  
  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };
  
  const getVehicleIcon = (type: VehicleType) => {
    const icons: Record<VehicleType, string> = {
      PATROL: '🚓',
      SWAT: '🚔',
      EMS: '🚑',
      DETECTIVE: '🕵️',
      AIR: '🚁',
      MOTOR: '🏍️'
    };
    return icons[type] || '🚗';
  };
  
  const getStatusColor = (status: VehicleStatus) => {
    const colors: Record<VehicleStatus, string> = {
      AVAILABLE: 'green',
      IN_USE: 'blue',
      MAINTENANCE: 'orange',
      RETIRED: 'red'
    };
    return colors[status];
  };
  
  const getStatusLabel = (status: VehicleStatus) => {
    const labels: Record<VehicleStatus, string> = {
      AVAILABLE: 'Disponible',
      IN_USE: 'En uso',
      MAINTENANCE: 'Mantenimiento',
      RETIRED: 'Retirado'
    };
    return labels[status];
  };
  
  return (
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content fleet-manager" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>🚓 PANEL DE FLOTA</h2>
          <button class="close-btn" onClick={closeModal}>×</button>
        </div>
        
        <div class="detail-tabs">
          <button 
            class={`tab ${activeTab() === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📋 Lista
          </button>
          <button 
            class={`tab ${activeTab() === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            🗺️ Mapa
          </button>
        </div>
        
        <div class="fleet-stats">
          <div class="stat-item">
            <span class="stat-value">{stats().total}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-item available">
            <span class="stat-value">{stats().available}</span>
            <span class="stat-label">Disponibles</span>
          </div>
          <div class="stat-item in-use">
            <span class="stat-value">{stats().inUse}</span>
            <span class="stat-label">En uso</span>
          </div>
          <div class="stat-item maintenance">
            <span class="stat-value">{stats().maintenance}</span>
            <span class="stat-label">Taller</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">PD:{stats().police} EMS:{stats().ems}</span>
            <span class="stat-label">Por Dept</span>
          </div>
        </div>
        
        <div class="modal-body">
          <div class="fleet-filters">
            <select
              value={fleetState.filterDepartment}
              onChange={(e) => fleetActions.setFilterDepartment(e.currentTarget.value as any)}
            >
              <option value="ALL">Todos los departamentos</option>
              <option value="POLICE">👮 Policía</option>
              <option value="EMS">🚑 EMS</option>
            </select>
            <select
              value={fleetState.filterStatus}
              onChange={(e) => fleetActions.setFilterStatus(e.currentTarget.value as any)}
            >
              <option value="ALL">Todos los estados</option>
              <option value="AVAILABLE">✓ Disponible</option>
              <option value="IN_USE">→ En uso</option>
              <option value="MAINTENANCE">🔧 Mantenimiento</option>
            </select>
          </div>
          
          <Show when={activeTab() === 'list'}>
            <div class="fleet-list">
              <For each={filteredVehicles()}>
                {(vehicle) => (
                  <div 
                    class={`fleet-item ${getStatusColor(vehicle.status)}`}
                    onClick={() => setSelectedVehicle(vehicle.unitId)}
                  >
                    <div class="vehicle-icon">{getVehicleIcon(vehicle.vehicleType)}</div>
                    <div class="vehicle-info">
                      <strong>{vehicle.unitId}</strong>
                      <span>{vehicle.model}</span>
                      <small>{vehicle.plate} | {vehicle.station}</small>
                    </div>
                    <div class="vehicle-status">
                      <span class={`status-badge ${getStatusColor(vehicle.status)}`}>
                        {getStatusLabel(vehicle.status)}
                      </span>
                      <Show when={vehicle.assignedTo}>
                        <span class="assigned-to">👤 {vehicle.assignedTo!.badge}</span>
                      </Show>
                    </div>
                    <div class="vehicle-metrics">
                      <div class="metric">
                        <span>⛽ {vehicle.fuel}%</span>
                        <div class="progress-bar">
                          <div class="progress" style={{ width: `${vehicle.fuel}%` }}></div>
                        </div>
                      </div>
                      <div class="metric">
                        <span>🔧 {vehicle.damage}%</span>
                        <div class="progress-bar">
                          <div class="progress damage" style={{ width: `${vehicle.damage}%` }}></div>
                        </div>
                      </div>
                    </div>
                    <Show when={fleetState.isTracking}>
                      <div class="gps-info">
                        <span>📍 {vehicle.location.x.toFixed(0)}, {vehicle.location.y.toFixed(0)}</span>
                        <span>🎯 {vehicle.location.heading.toFixed(0)}°</span>
                        <span>🚀 {vehicle.location.speed.toFixed(0)} km/h</span>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
          
          <Show when={activeTab() === 'map'}>
            <div class="fleet-map-visual">
              <div class="fleet-map-grid" />
              
              <div class="fleet-map-status-bar">
                <span>🗺️ TACTICAL MAP - {filteredVehicles().length} UNITS</span>
                <span>LAST UPDATE: {fleetState.lastGPSUpdate ? new Date(fleetState.lastGPSUpdate).toLocaleTimeString() : 'N/A'}</span>
                <span>GPS: {fleetState.isTracking ? '🟢 LIVE' : '🔴 OFFLINE'}</span>
              </div>
              
              <For each={filteredVehicles()}>
                {(vehicle) => {
                  const mapX = ((vehicle.location.x + 4000) / 8000) * 100;
                  const mapY = ((vehicle.location.y + 4000) / 8000) * 100;
                  
                  return (
                    <div 
                      class="fleet-map-vehicle"
                      style={{
                        left: `${Math.max(5, Math.min(95, mapX))}%`,
                        top: `${Math.max(10, Math.min(85, mapY))}%`,
                      }}
                      onClick={() => setSelectedVehicle(vehicle.unitId)}
                      title={`${vehicle.unitId} - ${getStatusLabel(vehicle.status)}`}
                    >
                      <div class={`vehicle-marker vehicle-${getStatusColor(vehicle.status)}`}>
                        {getVehicleIcon(vehicle.vehicleType)}
                      </div>
                      <div class="vehicle-label">
                        {vehicle.unitId}
                        <Show when={vehicle.assignedTo}>
                          <span> 👤{vehicle.assignedTo!.badge}</span>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
              
              <div class="fleet-map-legend">
                <strong>UNITS</strong>
                <For each={filteredVehicles()}>
                  {(vehicle) => (
                    <div class="map-unit" onClick={() => setSelectedVehicle(vehicle.unitId)}>
                      <span class={`vehicle-${getStatusColor(vehicle.status)}`}>
                        {getVehicleIcon(vehicle.vehicleType)} {vehicle.unitId}
                      </span>
                      <span>X:{vehicle.location.x.toFixed(0)} Y:{vehicle.location.y.toFixed(0)}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          
          <Show when={selectedVehicle()}>
            {(() => {
              const vehicle = fleetState.vehicles[selectedVehicle()!];
              if (!vehicle) return null;
              
              return (
                <div class="vehicle-detail-modal">
                  <div class="detail-content">
                    <button class="btn btn-small" onClick={() => setSelectedVehicle(null)}>
                      ✕ Cerrar
                    </button>
                    
                    <div class="detail-header">
                      <div class="detail-icon">{getVehicleIcon(vehicle.vehicleType)}</div>
                      <div class="detail-title">
                        <h3>{vehicle.unitId}</h3>
                        <span class="model">{vehicle.model}</span>
                        <span class="plate">{vehicle.plate}</span>
                      </div>
                    </div>
                    
                    <div class="detail-info">
                      <div class="info-row">
                        <strong>Estado:</strong>
                        <span class={`status ${getStatusColor(vehicle.status)}`}>
                          {getStatusLabel(vehicle.status)}
                        </span>
                      </div>
                      <div class="info-row">
                        <strong>Departamento:</strong>
                        <span>{vehicle.department}</span>
                      </div>
                      <div class="info-row">
                        <strong>Estación:</strong>
                        <span>{vehicle.station}</span>
                      </div>
                      <Show when={vehicle.assignedTo}>
                        <div class="info-row">
                          <strong>Asignado a:</strong>
                          <span>{vehicle.assignedTo!.name} ({vehicle.assignedTo!.badge})</span>
                        </div>
                      </Show>
                      <div class="info-row">
                        <strong>Combustible:</strong>
                        <span>{vehicle.fuel}%</span>
                      </div>
                      <div class="info-row">
                        <strong>Daño:</strong>
                        <span>{vehicle.damage}%</span>
                      </div>
                      <div class="info-row">
                        <strong>Kilometraje:</strong>
                        <span>{vehicle.totalKm.toLocaleString()} km</span>
                      </div>
                      <Show when={fleetState.isTracking}>
                        <div class="info-row">
                          <strong>Ubicación:</strong>
                          <span>X:{vehicle.location.x.toFixed(2)} Y:{vehicle.location.y.toFixed(2)}</span>
                        </div>
                        <div class="info-row">
                          <strong>Velocidad:</strong>
                          <span>{vehicle.location.speed.toFixed(0)} km/h</span>
                        </div>
                      </Show>
                    </div>
                    
                    <div class="detail-actions">
                      <Show when={vehicle.status === 'AVAILABLE'}>
                        <button 
                          class="btn btn-success"
                          onClick={() => {
                            fleetActions.assignVehicle(vehicle.unitId, 'OFF_001', 'Demo Officer', 'B-001');
                            setSelectedVehicle(null);
                          }}
                        >
                          ✓ Asignar
                        </button>
                      </Show>
                      <Show when={vehicle.status === 'IN_USE'}>
                        <button 
                          class="btn btn-warning"
                          onClick={() => {
                            fleetActions.returnVehicle(vehicle.unitId);
                            setSelectedVehicle(null);
                          }}
                        >
                          ↩ Devolver
                        </button>
                      </Show>
                      <Show when={vehicle.damage > 0}>
                        <button 
                          class="btn btn-primary"
                          onClick={() => {
                            fleetActions.completeMaintenance(vehicle.unitId);
                            setSelectedVehicle(null);
                          }}
                        >
                          🔧 Reparar
                        </button>
                      </Show>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Show>
        </div>
      </div>
    </div>
  );
}
