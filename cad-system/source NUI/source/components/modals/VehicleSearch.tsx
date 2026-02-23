import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadActions, type Vehicle } from '~/stores/cadStore';
import { $vehiclesArray } from '~/stores/storeSelectors';
import { Button, Input, Modal, Tabs, Textarea } from '~/components/ui';
import { PhotoGallery } from '~/components/ui/PhotoGallery';

export function VehicleSearch() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = createSignal<Vehicle | null>(null);
  const [activeTab, setActiveTab] = createSignal<'info' | 'owner' | 'notes'>('info');
  const [newVehicleNote, setNewVehicleNote] = createSignal('');

  const closeModal = () => {
    terminalActions.setActiveModal(null);
    cadActions.clearSearchResults();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const vehicleNotes = createMemo(() => {
    const vehicle = selectedVehicle();
    if (!vehicle) return [];
    return (vehicle.notes || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  const handleSearch = () => {
    const query = searchQuery().trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }
    
    const results = $vehiclesArray().filter(v => 
      v.plate.toLowerCase().includes(query) ||
      v.model.toLowerCase().includes(query) ||
      v.make.toLowerCase().includes(query) ||
      v.vin.toLowerCase().includes(query) ||
      v.ownerName.toLowerCase().includes(query)
    );
    
    setSearchResults(results);
  };

  const addVehicleNote = () => {
    const vehicle = selectedVehicle();
    const content = newVehicleNote().trim();
    if (!vehicle || !content) {
      terminalActions.addLine('Write a note first', 'error');
      return;
    }

    const note = {
      id: `VNOTE_${Date.now()}`,
      content,
      author: 'OFFICER_001',
      timestamp: new Date().toISOString(),
    };

    cadActions.addVehicleNote(vehicle.plate, note);
    setSelectedVehicle({ ...vehicle, notes: [...(vehicle.notes || []), note] });
    setNewVehicleNote('');
    setActiveTab('notes');
    terminalActions.addLine(`✓ Note added to vehicle ${vehicle.plate}`, 'output');
  };

  onMount(() => {
    const modalData = (terminalState.modalData as { plate?: string; ownerId?: string; query?: string } | null) || null;
    if (!modalData) {
      return;
    }

    const vehicles = $vehiclesArray();

    if (modalData.plate && modalData.plate.trim() !== '') {
      const plateQuery = modalData.plate.trim();
      const lowerPlate = plateQuery.toLowerCase();
      setSearchQuery(plateQuery);

      const exact = vehicles.find((v) => v.plate.toLowerCase() === lowerPlate);
      if (exact) {
        setSelectedVehicle(exact);
        setActiveTab('info');
        return;
      }
    }

    if (modalData.ownerId && modalData.ownerId.trim() !== '') {
      const ownerQuery = modalData.ownerId.trim();
      const lowerOwner = ownerQuery.toLowerCase();
      setSearchQuery(ownerQuery);

      const ownerVehicle = vehicles.find((v) => v.ownerId.toLowerCase() === lowerOwner);
      if (ownerVehicle) {
        setSelectedVehicle(ownerVehicle);
        setActiveTab('owner');
        return;
      }
    }

    if (modalData.query && modalData.query.trim() !== '') {
      setSearchQuery(modalData.query.trim());
    }
  });

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content vehicle-search" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== VEHICLE SEARCH (DMV) ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="search-toolbar">
          <div class="search-input-group">
            <Input.Root
              type="text"
              class="dos-input search-input"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter plate, model, or owner name..."
            />
            <Button.Root class="btn btn-primary" onClick={handleSearch}>
              [SEARCH]
            </Button.Root>
          </div>
          <Show when={searchResults().length > 0}>
            <div class="search-stats">
              {searchResults().length} result(s) found
            </div>
          </Show>
        </div>

        <div class="search-content">
          <div class="search-results-panel">
            <Show when={searchResults().length === 0 && searchQuery()}>
              <div class="empty-state">No vehicles found</div>
            </Show>
            
            <For each={searchResults()}>
              {(vehicle) => (
                <div 
                  class={`result-item ${selectedVehicle()?.plate === vehicle.plate ? 'selected' : ''}`}
                  onClick={() => { setSelectedVehicle(vehicle); setActiveTab('info'); }}
                >
                  <div class="result-plate">
                    {vehicle.plate}
                    <Show when={vehicle.stolen}>
                      <span class="stolen-badge">[STOLEN]</span>
                    </Show>
                  </div>
                  <div class="result-vehicle">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </div>
                  <div class="result-color">Color: {vehicle.color}</div>
                </div>
              )}
            </For>
          </div>

          <Show when={selectedVehicle()}>
            <div class="vehicle-details-panel">
              <div class="vehicle-header">
                <h3>
                  {selectedVehicle()!.plate}
                  <Show when={selectedVehicle()!.stolen}>
                    <span class="stolen-badge-large">STOLEN VEHICLE</span>
                  </Show>
                </h3>
                <div class="vehicle-model">
                  {selectedVehicle()!.year} {selectedVehicle()!.make} {selectedVehicle()!.model}
                </div>
              </div>

              <Tabs.Root
                value={activeTab()}
                onValueChange={(value) => setActiveTab(value as 'info' | 'owner' | 'notes')}
              >
                <Tabs.List>
                  <Tabs.Trigger value='info' label='VEHICLE INFO' />
                  <Tabs.Trigger value='owner' label='OWNER INFO' />
                  <Tabs.Trigger value='notes' label='NOTES' badge={vehicleNotes().length} />
                </Tabs.List>
              </Tabs.Root>

              <div class="tab-content">
                <Show when={activeTab() === 'info'}>
                  <div class="info-grid">
                    <div class="info-item">
                      <label>License Plate:</label>
                      <span class="value plate-value">{selectedVehicle()!.plate}</span>
                    </div>
                    <div class="info-item">
                      <label>VIN:</label>
                      <span class="value">{selectedVehicle()!.vin}</span>
                    </div>
                    <div class="info-item">
                      <label>Make:</label>
                      <span class="value">{selectedVehicle()!.make}</span>
                    </div>
                    <div class="info-item">
                      <label>Model:</label>
                      <span class="value">{selectedVehicle()!.model}</span>
                    </div>
                    <div class="info-item">
                      <label>Year:</label>
                      <span class="value">{selectedVehicle()!.year}</span>
                    </div>
                    <div class="info-item">
                      <label>Color:</label>
                      <span class="value">{selectedVehicle()!.color}</span>
                    </div>
                    <div class="info-item">
                      <label>Registration:</label>
                      <span class={`value status-${selectedVehicle()!.registrationStatus.toLowerCase()}`}>
                        {selectedVehicle()!.registrationStatus}
                      </span>
                    </div>
                    <div class="info-item">
                      <label>Insurance:</label>
                      <span class={`value status-${selectedVehicle()!.insuranceStatus.toLowerCase()}`}>
                        {selectedVehicle()!.insuranceStatus}
                      </span>
                    </div>
                    <Show when={selectedVehicle()!.stolen}>
                      <div class="info-item full-width stolen-info">
                        <label>Stolen Reported:</label>
                        <span class="value">
                          {selectedVehicle()!.stolenReportedAt ? formatDate(selectedVehicle()!.stolenReportedAt!) : 'Unknown'}
                        </span>
                      </div>
                    </Show>
                    <Show when={selectedVehicle()!.flags.length > 0}>
                      <div class="info-item full-width">
                        <label>Flags:</label>
                        <span class="value flags">
                          {selectedVehicle()!.flags.join(', ')}
                        </span>
                      </div>
                    </Show>
                  </div>
                  
                  <Show when={selectedVehicle()!.photos && selectedVehicle()!.photos!.length > 0}>
                    <div class="photo-section" style={{ 'margin-top': '20px', padding: '10px 0', 'border-top': '1px solid var(--terminal-border)' }}>
                      <h4 style={{ color: 'var(--terminal-system-bright)', 'margin-bottom': '10px' }}>Photos</h4>
                      <PhotoGallery photos={selectedVehicle()!.photos!} />
                    </div>
                  </Show>
                  
                  <div class="vehicle-actions" style={{ 'margin-top': '15px' }}>
                    <Button.Root 
                      class="btn"
                      onClick={() => {
                        terminalActions.setActiveModal('UPLOAD', { 
                          vehiclePlate: selectedVehicle()!.plate,
                          vehicleInfo: `${selectedVehicle()!.year} ${selectedVehicle()!.make} ${selectedVehicle()!.model}`,
                          type: 'photo'
                        });
                      }}
                    >
                      [UPLOAD PHOTO]
                    </Button.Root>
                  </div>
                </Show>

                <Show when={activeTab() === 'owner'}>
                  <div class="owner-info">
                    <div class="owner-name">{selectedVehicle()!.ownerName}</div>
                    <div class="owner-id">Citizen ID: {selectedVehicle()!.ownerId}</div>
                    <div class="owner-actions">
                      <Button.Root 
                        class="btn btn-primary"
                        onClick={() => {
                          terminalActions.setActiveModal('PERSON_SNAPSHOT', {
                            citizenId: selectedVehicle()!.ownerId,
                          });
                        }}
                      >
                        [VIEW OWNER RECORD]
                      </Button.Root>
                      <Button.Root
                        class="btn"
                        onClick={() => {
                          terminalActions.setActiveModal('BOLO_MANAGER', {
                            type: 'PERSON',
                            identifier: selectedVehicle()!.ownerId,
                            reason: `Associated to vehicle ${selectedVehicle()!.plate}`,
                          });
                        }}
                      >
                        [CREATE OWNER BOLO]
                      </Button.Root>
                      <Button.Root
                        class="btn"
                        onClick={() => {
                          terminalActions.setActiveModal('POLICE_DASHBOARD', {
                            create: 'warrant',
                            citizenId: selectedVehicle()!.ownerId,
                            personName: selectedVehicle()!.ownerName,
                            reason: `Warrant requested from vehicle stop ${selectedVehicle()!.plate}`,
                          });
                        }}
                      >
                        [ISSUE WARRANT]
                      </Button.Root>
                    </div>
                  </div>
                </Show>

                <Show when={activeTab() === 'notes'}>
                  <div class="records-list">
                    <div class="add-note-form">
                      <Textarea.Root
                        class="dos-textarea"
                        rows={3}
                        value={newVehicleNote()}
                        onInput={(e) => setNewVehicleNote(e.currentTarget.value)}
                        placeholder="Write a quick note for this vehicle..."
                      />
                      <Button.Root class="btn btn-primary" onClick={addVehicleNote}>[SAVE NOTE]</Button.Root>
                    </div>

                    <Show when={vehicleNotes().length === 0}>
                      <div class="empty-state">No vehicle notes yet</div>
                    </Show>

                    <For each={vehicleNotes()}>
                      {(note) => (
                        <div class="record-item">
                          <div class="record-date">{formatDate(note.timestamp)}</div>
                          <div class="record-sentence">{note.content}</div>
                          <div class="record-officer">By: {note.author}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            DMV System v1.0
          </span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
