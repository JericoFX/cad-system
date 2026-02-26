
import { createSignal, createMemo, For, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { propertyState, propertyActions, type PropertyType } from '~/stores/propertyStore';
import { Button, Modal, Tabs } from '~/components/ui';

export function PropertyManager() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchType, setSearchType] = createSignal<'address' | 'owner' | 'nearby'>('address');
  const [selectedProperty, setSelectedProperty] = createSignal<string | null>(null);
  const [nearbyCoords, setNearbyCoords] = createSignal({ x: 0, y: 0, z: 0 });
  
  const searchResults = createMemo(() => {
    if (searchType() === 'address') {
      return propertyActions.searchByAddress(searchQuery());
    } else if (searchType() === 'owner') {
      return propertyActions.searchByOwner(searchQuery()) || 
             propertyActions.searchByOwnerName(searchQuery());
    }
    return [];
  });
  
  const nearbyResults = createMemo(() => {
    if (searchType() !== 'nearby') return [];
    return propertyActions.findNearby(nearbyCoords().x, nearbyCoords().y, nearbyCoords().z);
  });
  
  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };
  
  const handleSearch = () => {
    propertyActions.search(searchQuery());
  };
  
  const getPropertyIcon = (type: PropertyType) => {
    const icons: Record<PropertyType, string> = {
      HOUSE: '🏠',
      APARTMENT: '🏢',
      BUSINESS: '🏪',
      WAREHOUSE: '🏭',
      GARAGE: '🅿️'
    };
    return icons[type] || '🏠';
  };
  
  const getTypeLabel = (type: PropertyType) => {
    const labels: Record<PropertyType, string> = {
      HOUSE: 'Casa',
      APARTMENT: 'Apartamento',
      BUSINESS: 'Negocio',
      WAREHOUSE: 'Almacén',
      GARAGE: 'Garaje'
    };
    return labels[type] || type;
  };
  
  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content property-manager" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>🏠 REGISTRO DE PROPIEDADES</h2>
          <button class="close-btn" onClick={closeModal}>×</button>
        </div>
        
        <div class="modal-body">
          <div class="property-section">
            <Tabs.Root
              value={searchType()}
              onValueChange={(value) => setSearchType(value as 'address' | 'owner' | 'nearby')}
              bracketed={false}
              uppercase={false}
            >
              <Tabs.List class='search-tabs'>
                <Tabs.Trigger value='address' label='📍 Dirección' />
                <Tabs.Trigger value='owner' label='👤 Dueño' />
                <Tabs.Trigger value='nearby' label='📍 Cercanas' />
              </Tabs.List>
            </Tabs.Root>
            
            <Show when={searchType() !== 'nearby'}>
              <div class="search-box">
                <input
                  type="text"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder={searchType() === 'address' ? 'Buscar por dirección...' : 'Buscar por dueño...'}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button.Root class="btn btn-primary" onClick={handleSearch}>
                  🔍 Buscar
                </Button.Root>
              </div>
            </Show>
            
            <Show when={searchType() === 'nearby'}>
              <div class="coordinates-input">
                <label>X:</label>
                <input 
                  type="number" 
                  value={nearbyCoords().x}
                  onInput={(e) => setNearbyCoords(prev => ({ ...prev, x: Number(e.currentTarget.value) }))}
                />
                <label>Y:</label>
                <input 
                  type="number"
                  value={nearbyCoords().y}
                  onInput={(e) => setNearbyCoords(prev => ({ ...prev, y: Number(e.currentTarget.value) }))}
                />
                <label>Z:</label>
                <input 
                  type="number"
                  value={nearbyCoords().z}
                  onInput={(e) => setNearbyCoords(prev => ({ ...prev, z: Number(e.currentTarget.value) }))}
                />
                <label>Radio: {propertyState.nearbyRadius}m</label>
                <input
                  type="range"
                  class="dos-slider"
                  min="10"
                  max="500"
                  value={propertyState.nearbyRadius}
                  onInput={(e) => propertyActions.setNearbyRadius(Number(e.currentTarget.value))}
                />
                <Button.Root class="btn btn-primary" onClick={handleSearch}>
                  🔍 Buscar
                </Button.Root>
              </div>
            </Show>
          </div>
          
          <Show when={!selectedProperty() && (searchResults().length > 0 || nearbyResults().length > 0)}>
            <div class="property-section">
              <h3>Resultados ({searchType() === 'nearby' ? nearbyResults().length : searchResults().length})</h3>
              <div class="properties-list">
                <For each={searchType() === 'nearby' ? nearbyResults() : searchResults()}>
                  {(property) => (
                    <div 
                      class="property-card"
                      onClick={() => setSelectedProperty(property.propertyId)}
                    >
                      <div class="property-icon">{getPropertyIcon(property.type)}</div>
                      <div class="property-info">
                        <strong>{property.address}</strong>
                        <span>{getTypeLabel(property.type)}</span>
                        <Show when={property.businessName}>
                          <small>🏪 {property.businessName}</small>
                        </Show>
                        <span class="owner">👤 {property.currentOwner.name}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          
          <Show when={selectedProperty()}>
            {(() => {
              const property = propertyState.properties[selectedProperty()!];
              if (!property) return null;
              
              return (
                <div class="property-section property-detail">
                  <Button.Root class="btn btn-small" onClick={() => setSelectedProperty(null)}>
                    ← Volver
                  </Button.Root>
                  
                  <div class="detail-header">
                    <div class="detail-icon">{getPropertyIcon(property.type)}</div>
                    <div class="detail-title">
                      <h3>{property.address}</h3>
                      <span class="type-badge">{getTypeLabel(property.type)}</span>
                    </div>
                  </div>
                  
                  <div class="detail-info">
                    <div class="info-row">
                      <strong>ID:</strong>
                      <span>{property.propertyId}</span>
                    </div>
                    <div class="info-row">
                      <strong>Dueño actual:</strong>
                      <span>{property.currentOwner.name} ({property.currentOwner.citizenId})</span>
                    </div>
                    <Show when={property.businessType}>
                      <div class="info-row">
                        <strong>Tipo de negocio:</strong>
                        <span>{property.businessType}</span>
                      </div>
                    </Show>
                    <Show when={property.businessName}>
                      <div class="info-row">
                        <strong>Nombre del negocio:</strong>
                        <span>{property.businessName}</span>
                      </div>
                    </Show>
                    <div class="info-row">
                      <strong>Coordenadas:</strong>
                      <span>X: {property.coordinates.x}, Y: {property.coordinates.y}, Z: {property.coordinates.z}</span>
                    </div>
                    <div class="info-row">
                      <strong>Registrado:</strong>
                      <span>{new Date(property.registeredAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div class="detail-actions">
                    <Button.Root 
                      class="btn btn-primary"
                      onClick={() => {
                        terminalActions.addLine(`Marcando ${property.address} en mapa...`, 'output');
                      }}
                    >
                      🗺️ Ver en Mapa
                    </Button.Root>
                    <Button.Root 
                      class="btn btn-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(property.address);
                        terminalActions.addLine('✓ Dirección copiada', 'output');
                      }}
                    >
                      📋 Copiar Dirección
                    </Button.Root>
                  </div>
                </div>
              );
            })()}
          </Show>
        </div>
      </div>
    </Modal.Root>
  );
}
