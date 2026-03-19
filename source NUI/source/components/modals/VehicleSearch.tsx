import { createSignal, createMemo, createSelector, For, Show, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type Vehicle } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Input, Modal, Tabs, Textarea } from '~/components/ui';
import { PhotoGallery } from '~/components/ui/PhotoGallery';
import { useEntityNotes } from '~/hooks/useEntityNotes';
import { formatDate as formatDateUtil } from '~/utils/storeHelpers/dateHelpers';

interface LookupVehiclesResponse {
  ok?: boolean;
  vehicles?: Vehicle[];
  error?: string;
}

export function VehicleSearch() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = createSignal<Vehicle | null>(null);
  const [activeTab, setActiveTab] = createSignal<'info' | 'owner' | 'notes'>('info');
  const [newVehicleNote, setNewVehicleNote] = createSignal('');
  const [searchLoading, setSearchLoading] = createSignal(false);
  const isSelectedVehicle = createSelector(() => selectedVehicle()?.plate || null);

  const ownerRecord = createMemo(() => {
    const ownerId = selectedVehicle()?.ownerId;
    if (!ownerId) return null;
    return cadState.persons[ownerId] || null;
  });

  const vehicleStatusBadges = createMemo(() => {
    const vehicle = selectedVehicle();
    if (!vehicle) return [] as Array<{ label: string; tone: string }>;

    const badges: Array<{ label: string; tone: string }> = [];
    if (vehicle.stolen) badges.push({ label: 'STOLEN', tone: '#ff5555' });
    if (vehicle.registrationStatus !== 'VALID') badges.push({ label: `REG ${vehicle.registrationStatus}`, tone: '#ffb86c' });
    if (vehicle.insuranceStatus !== 'VALID') badges.push({ label: `INS ${vehicle.insuranceStatus}`, tone: '#ffd166' });

    return badges;
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
    cadActions.clearSearchResults();
  };

  const formatDate = (dateStr: string) => formatDateUtil(dateStr);

  const vehicleNotes = createMemo(() => {
    const vehicle = selectedVehicle();
    if (!vehicle) return [];
    return (vehicle.notes || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  const loadVehicleNotes = async (plate: string) => {
    const cleanPlate = plate.trim();
    if (!cleanPlate) return;

    try {
      const response = await fetchNui<EntityNoteResponse>('cad:entityNotes:list', {
        entityType: 'VEHICLE',
        entityId: cleanPlate,
        limit: 25,
      });

      const notes = Array.isArray(response.notes)
        ? response.notes.map((note) => ({
            id: note.id,
            content: note.content,
            author: note.authorName || note.author,
            timestamp: note.timestamp,
          }))
        : [];

      cadActions.updateVehicle(cleanPlate, { notes });
      const knownVehicle = cadState.vehicles[cleanPlate];
      if (knownVehicle) {
        setSelectedVehicle({ ...knownVehicle, notes });
      }
    } catch (error) {
      terminalActions.addLine(`Vehicle notes failed: ${String(error)}`, 'error');
    }
  };

  const selectVehicleRecord = async (vehicle: Vehicle, tab: 'info' | 'owner' | 'notes' = 'info') => {
    setSelectedVehicle(vehicle);
    setActiveTab(tab);
    await loadVehicleNotes(vehicle.plate);
  };

  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetchNui<LookupVehiclesResponse>('cad:lookup:searchVehicles', {
        query,
        limit: 15,
      });

      const results = Array.isArray(response.vehicles) ? response.vehicles : [];
      results.forEach((vehicle) => cadActions.addVehicle(vehicle));
      setSearchResults(results);

      const modalData = (terminalState.modalData as { plate?: string; ownerId?: string; query?: string } | null) || null;
      const preferredPlate = modalData?.plate?.trim().toLowerCase() || '';
      const preferredOwnerId = modalData?.ownerId?.trim().toLowerCase() || '';
      const normalizedQuery = query.toLowerCase();
      const nextSelected =
        results.find((vehicle) => vehicle.plate.toLowerCase() === preferredPlate) ||
        results.find((vehicle) => vehicle.ownerId.toLowerCase() === preferredOwnerId) ||
        results.find((vehicle) => vehicle.plate.toLowerCase() === normalizedQuery) ||
        results[0] ||
        null;

      if (nextSelected) {
        await selectVehicleRecord(nextSelected, preferredOwnerId !== '' ? 'owner' : 'info');
      } else {
        setSelectedVehicle(null);
      }
    } catch (error) {
      terminalActions.addLine(`Vehicle search failed: ${String(error)}`, 'error');
      setSearchResults([]);
      setSelectedVehicle(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const addVehicleNote = async () => {
    const vehicle = selectedVehicle();
    const content = newVehicleNote().trim();
    if (!vehicle || !content) {
      terminalActions.addLine('Write a note first', 'error');
      return;
    }

    try {
      const response = await fetchNui<EntityNoteResponse>('cad:entityNotes:add', {
        entityType: 'VEHICLE',
        entityId: vehicle.plate,
        content,
        important: false,
      });

      const note = response.note;
      if (!note) {
        terminalActions.addLine('Failed to save note', 'error');
        return;
      }

      const normalizedNote = {
        id: note.id,
        content: note.content,
        author: note.authorName || note.author,
        timestamp: note.timestamp,
      };

      cadActions.addVehicleNote(vehicle.plate, normalizedNote);
      setSelectedVehicle({ ...vehicle, notes: [...(vehicle.notes || []), normalizedNote] });
      setNewVehicleNote('');
      setActiveTab('notes');
      terminalActions.addLine(`✓ Note added to vehicle ${vehicle.plate}`, 'output');
    } catch (error) {
      terminalActions.addLine(`Failed to save note: ${String(error)}`, 'error');
    }
  };

  onMount(() => {
    void (async () => {
      const modalData = (terminalState.modalData as { plate?: string; ownerId?: string; query?: string } | null) || null;
      if (!modalData) {
        return;
      }

      const rawQuery = modalData.plate || modalData.ownerId || modalData.query;
      if (!rawQuery || rawQuery.trim() === '') {
        return;
      }

      setSearchQuery(rawQuery.trim());
      await handleSearch();
    })();
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
              onKeyPress={(e) => e.key === 'Enter' && void handleSearch()}
              placeholder="Enter plate, model, or owner name..."
            />
            <Button.Root class="btn btn-primary" onClick={() => void handleSearch()} disabled={searchLoading()}>
              [SEARCH]
            </Button.Root>
          </div>
          <Show when={searchResults().length > 0}>
            <div class="search-stats">
              {searchResults().length} result(s) found
            </div>
          </Show>
          <Show when={searchResults().length === 0 && !searchQuery()}>
            <div class="search-stats">Enter a plate, VIN, model, or owner reference to query the DMV.</div>
          </Show>
        </div>

        <div class="search-content">
          <div class="search-results-panel">
            <Show when={searchResults().length === 0 && searchQuery()}>
              <div class="empty-state">No DMV vehicle match for that query</div>
            </Show>
            
            <For each={searchResults()}>
              {(vehicle) => (
                <div 
                  class={`result-item ${isSelectedVehicle(vehicle.plate) ? 'selected' : ''}`}
                  onClick={() => { void selectVehicleRecord(vehicle, 'info'); }}
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
                <h3>{selectedVehicle()!.plate}</h3>
                <div class="vehicle-model">
                  {selectedVehicle()!.year} {selectedVehicle()!.make} {selectedVehicle()!.model}
                </div>
                <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-top': '8px' }}>
                  <For each={vehicleStatusBadges()}>
                    {(badge) => (
                      <span
                        style={{
                          padding: '2px 8px',
                          border: `1px solid ${badge.tone}`,
                          color: badge.tone,
                          'font-size': '11px',
                          'letter-spacing': '0.06em',
                        }}
                      >
                        {badge.label}
                      </span>
                    )}
                  </For>
                </div>
                <div class="info-grid" style={{ 'margin-top': '12px' }}>
                  <div class="info-item">
                    <label>Flags:</label>
                    <span class="value">{selectedVehicle()!.flags.length}</span>
                  </div>
                  <div class="info-item">
                    <label>Notes:</label>
                    <span class="value">{vehicleNotes().length}</span>
                  </div>
                  <div class="info-item">
                    <label>Owner:</label>
                    <span class="value">{selectedVehicle()!.ownerName || 'UNKNOWN'}</span>
                  </div>
                  <div class="info-item">
                    <label>Status:</label>
                    <span class="value">{selectedVehicle()!.stolen ? 'HIGH RISK' : 'CLEAR'}</span>
                  </div>
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
                    <div style={{ display: 'flex', gap: '12px', 'align-items': 'flex-start', 'margin-bottom': '12px' }}>
                      <div
                        style={{
                          width: '72px',
                          height: '72px',
                          border: '1px solid var(--terminal-border)',
                          display: 'flex',
                          'align-items': 'center',
                          'justify-content': 'center',
                          'background-color': 'rgba(255,255,255,0.03)',
                          overflow: 'hidden',
                          'flex-shrink': 0,
                        }}
                      >
                        <Show when={ownerRecord()?.photo} fallback={<span style={{ color: 'var(--terminal-text-dim)' }}>NO IMG</span>}>
                          <img
                            src={ownerRecord()!.photo}
                            alt="Owner mugshot"
                            style={{ width: '100%', height: '100%', 'object-fit': 'cover' }}
                          />
                        </Show>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div class="owner-name">{selectedVehicle()!.ownerName}</div>
                        <div class="owner-id">Citizen ID: {selectedVehicle()!.ownerId}</div>
                    <Show when={ownerRecord()?.phone}>
                      <div class="owner-id">Phone: {ownerRecord()!.phone}</div>
                    </Show>
                    <Show when={ownerRecord()?.address}>
                      <div class="owner-id">Address: {ownerRecord()!.address}</div>
                    </Show>
                    <Show when={!ownerRecord()}>
                      <div class="owner-id">Live owner profile not cached yet - open owner record to hydrate details.</div>
                    </Show>
                  </div>
                </div>
                    <div class="owner-actions">
                      <Button.Root 
                        class="btn btn-primary"
                        onClick={() => {
                          terminalActions.setActiveModal('PERSON_SEARCH', {
                            citizenId: selectedVehicle()!.ownerId,
                            query: selectedVehicle()!.ownerId,
                          });
                        }}
                      >
                        [VIEW OWNER RECORD]
                      </Button.Root>
                      <Button.Root
                        class="btn"
                        onClick={() => {
                          terminalActions.setActiveModal('PERSON_SEARCH', {
                            citizenId: selectedVehicle()!.ownerId,
                            tab: 'phone',
                          });
                        }}
                      >
                        [PHONE INTEL]
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
                      <Button.Root class="btn btn-primary" onClick={() => void addVehicleNote()}>[SAVE NOTE]</Button.Root>
                    </div>

                    <Show when={vehicleNotes().length === 0}>
                      <div class="empty-state">No investigator notes saved for this vehicle</div>
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
