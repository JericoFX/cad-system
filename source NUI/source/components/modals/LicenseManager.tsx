
import { createSignal, createMemo, For, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { licenseActions, LICENSE_TYPES, type LicenseType } from '~/stores/licenseStore';
import { Button, Modal } from '~/components/ui';

export function LicenseManager() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedHolder, setSelectedHolder] = createSignal<string | null>(null);
  const [issueForm, setIssueForm] = createSignal({
    licenseId: '',
    holderId: '',
    holderName: ''
  });
  const [showIssueForm, setShowIssueForm] = createSignal(false);
  
  const searchResults = createMemo(() => {
    if (!searchQuery()) return [];
    return licenseActions.searchByHolder(searchQuery()) || 
           licenseActions.searchByName(searchQuery());
  });
  
  const holderSummary = createMemo(() => {
    if (!selectedHolder()) return null;
    return licenseActions.getHolderSummary(selectedHolder()!);
  });
  
  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };
  
  const handleSearch = () => {
    licenseActions.search(searchQuery());
  };
  
  const selectHolder = (holderId: string) => {
    setSelectedHolder(holderId);
    licenseActions.selectLicense(null);
  };
  
  const issueLicense = () => {
    const { licenseId, holderId, holderName } = issueForm();
    if (!licenseId || !holderId || !holderName) return;
    
    const license = licenseActions.issue(licenseId, holderId, holderName, 'OFFICER_001');
    if (license) {
      setIssueForm({ licenseId: '', holderId: '', holderName: '' });
      setShowIssueForm(false);
      terminalActions.addLine(`✓ Licencia ${licenseId} emitida`, 'output');
    }
  };
  
  const getLicenseTypeLabel = (licenseId: string) => {
    return LICENSE_TYPES[licenseId]?.category || licenseId;
  };
  
  const getTypeIcon = (type: LicenseType) => {
    const icons: Record<LicenseType, string> = {
      WEAPON: '🔫',
      DRIVING: '🚗',
      BUSINESS: '🏢',
      SPECIAL: '⭐'
    };
    return icons[type] || '📄';
  };
  
  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content license-manager" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>🎫 VERIFICACIÓN DE LICENCIAS</h2>
          <button class="close-btn" onClick={closeModal}>×</button>
        </div>
        
        <div class="modal-body">
          <div class="license-section">
            <div class="search-box">
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Buscar por ID o nombre de ciudadano..."
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button.Root class="btn btn-primary" onClick={handleSearch}>
                🔍 Buscar
              </Button.Root>
              <Button.Root 
                class="btn btn-secondary"
                onClick={() => setShowIssueForm(!showIssueForm())}
              >
                ➕ Emitir Licencia
              </Button.Root>
            </div>
          </div>
          
          <Show when={showIssueForm()}>
            <div class="license-section issue-form">
              <h3>Emitir Nueva Licencia</h3>
              <div class="form-row">
                <select
                  value={issueForm().licenseId}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, licenseId: e.currentTarget.value }))}
                >
                  <option value="">Seleccionar tipo...</option>
                  <optgroup label="Armas">
                    <option value="W-1">W-1 - Armas pequeñas</option>
                    <option value="W-2">W-2 - Escopetas</option>
                    <option value="W-3">W-3 - Rifles</option>
                    <option value="W-4">W-4 - Automáticas</option>
                  </optgroup>
                  <optgroup label="Conducir">
                    <option value="D-A">D-A - Automóviles</option>
                    <option value="D-B">D-B - Vehículos pesados</option>
                    <option value="D-C">D-C - Motos</option>
                    <option value="D-D">D-D - Transporte público</option>
                    <option value="D-E">D-E - Aéreos</option>
                  </optgroup>
                  <optgroup label="Negocios">
                    <option value="B-A">B-A - Funcionamiento</option>
                    <option value="B-B">B-B - Alcohol</option>
                    <option value="B-C">B-C - Armas</option>
                    <option value="B-D">B-D - Seguridad privada</option>
                  </optgroup>
                  <optgroup label="Especiales">
                    <option value="S-1">S-1 - Pesca</option>
                    <option value="S-2">S-2 - Caza</option>
                    <option value="S-3">S-3 - Explosivos</option>
                  </optgroup>
                </select>
                <input
                  type="text"
                  value={issueForm().holderId}
                  onInput={(e) => setIssueForm(prev => ({ ...prev, holderId: e.currentTarget.value }))}
                  placeholder="ID de ciudadano"
                />
                <input
                  type="text"
                  value={issueForm().holderName}
                  onInput={(e) => setIssueForm(prev => ({ ...prev, holderName: e.currentTarget.value }))}
                  placeholder="Nombre completo"
                />
                <Button.Root class="btn btn-success" onClick={issueLicense}>
                  ✓ Emitir
                </Button.Root>
              </div>
            </div>
          </Show>
          
          <Show when={searchResults().length > 0 && !selectedHolder()}>
            <div class="license-section">
              <h3>Resultados de Búsqueda</h3>
              <div class="search-results">
                <For each={searchResults()}>
                  {(license) => (
                    <div 
                      class={`license-card ${license.status.toLowerCase()}`}
                      onClick={() => selectHolder(license.holderId)}
                    >
                      <div class="license-icon">{getTypeIcon(license.type)}</div>
                      <div class="license-info">
                        <strong>{license.holderName}</strong>
                        <span>ID: {license.holderId}</span>
                        <span>{license.licenseId} - {getLicenseTypeLabel(license.licenseId)}</span>
                      </div>
                      <div class={`status-badge ${license.status.toLowerCase()}`}>
                        {license.status === 'ACTIVE' ? '✓ ACTIVA' : license.status === 'REVOKED' ? '✗ REVOCADA' : '⏳ PENDIENTE'}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          
          <Show when={selectedHolder() && holderSummary()}>
            <div class="license-section">
              <Button.Root class="btn btn-small" onClick={() => setSelectedHolder(null)}>
                ← Volver
              </Button.Root>
              
              <h3>Licencias del Ciudadano</h3>
              
              <div class="summary-stats">
                <div class="stat-box">
                  <span class="stat-number">{holderSummary()?.total}</span>
                  <span class="stat-label">Total</span>
                </div>
                <div class="stat-box active">
                  <span class="stat-number">{holderSummary()?.active}</span>
                  <span class="stat-label">Activas</span>
                </div>
                <div class="stat-box revoked">
                  <span class="stat-number">{holderSummary()?.revoked}</span>
                  <span class="stat-label">Revocadas</span>
                </div>
              </div>
              
              <div class="license-categories">
                <Show when={holderSummary()!.weapons.length > 0}>
                  <div class="category-section">
                    <h4>🔫 Armas</h4>
                    <For each={holderSummary()!.weapons}>
                      {(license) => (
                        <div class={`license-item ${license.status.toLowerCase()}`}>
                          <span>{license.licenseId} - {getLicenseTypeLabel(license.licenseId)}</span>
                          <span class={`status ${license.status.toLowerCase()}`}>
                            {license.status === 'ACTIVE' ? '✓' : '✗'}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                
                <Show when={holderSummary()!.driving.length > 0}>
                  <div class="category-section">
                    <h4>🚗 Vehículos</h4>
                    <For each={holderSummary()!.driving}>
                      {(license) => (
                        <div class={`license-item ${license.status.toLowerCase()}`}>
                          <span>{license.licenseId} - {getLicenseTypeLabel(license.licenseId)}</span>
                          <span class={`status ${license.status.toLowerCase()}`}>
                            {license.status === 'ACTIVE' ? '✓' : '✗'}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                
                <Show when={holderSummary()!.business.length > 0}>
                  <div class="category-section">
                    <h4>🏢 Negocios</h4>
                    <For each={holderSummary()!.business}>
                      {(license) => (
                        <div class={`license-item ${license.status.toLowerCase()}`}>
                          <span>{license.licenseId} - {getLicenseTypeLabel(license.licenseId)}</span>
                          <span class={`status ${license.status.toLowerCase()}`}>
                            {license.status === 'ACTIVE' ? '✓' : '✗'}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                
                <Show when={holderSummary()!.special.length > 0}>
                  <div class="category-section">
                    <h4>⭐ Especiales</h4>
                    <For each={holderSummary()!.special}>
                      {(license) => (
                        <div class={`license-item ${license.status.toLowerCase()}`}>
                          <span>{license.licenseId} - {getLicenseTypeLabel(license.licenseId)}</span>
                          <span class={`status ${license.status.toLowerCase()}`}>
                            {license.status === 'ACTIVE' ? '✓' : '✗'}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Modal.Root>
  );
}
