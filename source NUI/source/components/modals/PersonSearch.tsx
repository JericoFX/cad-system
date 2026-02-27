import { createSignal, createMemo, createSelector, For, Show, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type Person } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Input, Modal, Tabs, Textarea } from '~/components/ui';
import { PhotoGallery } from '~/components/ui/PhotoGallery';

export function PersonSearch() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = createSignal<Person | null>(null);
  const [activeTab, setActiveTab] = createSignal<'info' | 'vehicles' | 'records' | 'warrants' | 'notes'>('info');
  const [newPersonNote, setNewPersonNote] = createSignal('');
  const [showBloodRequestModal, setShowBloodRequestModal] = createSignal(false);
  const [bloodRequestReason, setBloodRequestReason] = createSignal('Forensic blood sample request');
  const isSelectedPerson = createSelector(() => selectedPerson()?.citizenid || null);

  const personsArray = createMemo(() => Object.values(cadState.persons));
  const vehiclesArray = createMemo(() => Object.values(cadState.vehicles));
  const criminalRecordsArray = createMemo(() => Object.values(cadState.criminalRecords));
  const warrantsArray = createMemo(() => Object.values(cadState.warrants));

  const personVehicles = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return vehiclesArray().filter(v => v.ownerId === person.citizenid);
  });

  const personRecords = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return criminalRecordsArray().filter(r => r.citizenid === person.citizenid);
  });

  const personWarrants = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return warrantsArray().filter(w => w.citizenid === person.citizenid && w.active);
  });

  const personNotes = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return (person.notes || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  const hasWarrants = createMemo(() => personWarrants().length > 0);

  const personBOLO = createMemo(() => {
    const person = selectedPerson();
    if (!person) return null;
    return cadActions.checkBOLO('PERSON', person.citizenid);
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
    cadActions.clearSearchResults();
  };

  const handleSearch = () => {
    const query = searchQuery().trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }
    
    const results = personsArray().filter(p =>
      p.firstName.toLowerCase().includes(query) ||
      p.lastName.toLowerCase().includes(query) ||
      p.citizenid.toLowerCase().includes(query) ||
      p.ssn.includes(query)
    );
    
    setSearchResults(results);
  };

  onMount(() => {
    const modalData = (terminalState.modalData as { citizenId?: string; query?: string } | null) || null;
    if (!modalData) {
      return;
    }

    const rawQuery = modalData.citizenId || modalData.query;
    if (!rawQuery || rawQuery.trim() === '') {
      return;
    }

    const query = rawQuery.trim();
    const lowerQuery = query.toLowerCase();
    setSearchQuery(query);

    const person = personsArray().find((p) => {
      return (
        p.citizenid.toLowerCase() === lowerQuery ||
        p.firstName.toLowerCase().includes(lowerQuery) ||
        p.lastName.toLowerCase().includes(lowerQuery)
      );
    });

    if (person) {
      setSelectedPerson(person);
    }
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const addPersonNote = () => {
    const person = selectedPerson();
    const content = newPersonNote().trim();
    if (!person || !content) {
      terminalActions.addLine('Write a note first', 'error');
      return;
    }

    const note = {
      id: `PNOTE_${Date.now()}`,
      content,
      author: 'OFFICER_001',
      timestamp: new Date().toISOString(),
    };

    cadActions.addPersonNote(person.citizenid, note);
    setSelectedPerson({ ...person, notes: [...(person.notes || []), note] });
    setNewPersonNote('');
    setActiveTab('notes');
    terminalActions.addLine(`✓ Note added to person ${person.citizenid}`, 'output');
  };

  const openBloodRequestModal = () => {
    setBloodRequestReason('Forensic blood sample request');
    setShowBloodRequestModal(true);
  };

  const submitBloodRequest = async () => {
    const person = selectedPerson();
    if (!person) {
      return;
    }

    const reason = bloodRequestReason().trim();
    if (!reason) {
      terminalActions.addLine('Please provide a reason for the blood sample request', 'error');
      return;
    }

    try {
      const result = await fetchNui<{ ok: boolean; request?: { requestId?: string }; error?: string }>('cad:ems:createBloodRequest', {
        caseId: cadState.currentCase?.caseId || null,
        citizenId: person.citizenid,
        personName: `${person.firstName} ${person.lastName}`,
        reason,
        location: person.address || undefined,
      });

      if (!result?.ok) {
        terminalActions.addLine(`Failed to create blood request: ${result?.error || 'unknown_error'}`, 'error');
        return;
      }

      terminalActions.addLine(
        `✓ Blood sample request sent to EMS (${result.request?.requestId || 'BLOODREQ'})`,
        'output'
      );
      setShowBloodRequestModal(false);
    } catch (error) {
      terminalActions.addLine(`Failed to create blood request: ${error}`, 'error');
    }
  };

  const cancelBloodRequest = () => {
    setShowBloodRequestModal(false);
    setBloodRequestReason('Forensic blood sample request');
  };

  const readFromIdReader = async () => {
    try {
      const context = await fetchNui<{
        ok: boolean;
        terminalId?: string;
        error?: string;
      }>('cad:getComputerContext');

      if (!context?.ok || !context.terminalId) {
        terminalActions.addLine(`ID reader unavailable: ${context?.error || 'no_terminal_context'}`, 'error');
        return;
      }

      const response = await fetchNui<{
        ok: boolean;
        documentType?: 'PERSON' | 'VEHICLE';
        person?: Person;
        vehicle?: {
          plate: string;
          model: string;
          make: string;
          year: number;
          color: string;
          ownerId: string;
          ownerName: string;
          vin: string;
          registrationStatus: 'VALID' | 'EXPIRED' | 'SUSPENDED';
          insuranceStatus: 'VALID' | 'EXPIRED' | 'NONE';
          stolen: boolean;
          flags: string[];
          createdAt: string;
        };
        source?: string;
        item?: { name?: string; slot?: number };
        error?: string;
      }>('cad:idreader:read', {
        terminalId: context.terminalId,
      });

      if (!response?.ok) {
        terminalActions.addLine(`Failed to read ID: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      if (response.documentType === 'VEHICLE' && response.vehicle) {
        cadActions.addVehicle(response.vehicle);
        terminalActions.setActiveModal('VEHICLE_SEARCH', { plate: response.vehicle.plate });
        terminalActions.addLine(
          `✓ Vehicle document read: ${response.vehicle.plate} (${response.vehicle.model})`,
          'output'
        );
        return;
      }

      if (!response.person) {
        terminalActions.addLine('Reader document has no person data', 'error');
        return;
      }

      cadActions.addPerson(response.person);
      setSearchQuery(response.person.citizenid);
      setSelectedPerson(response.person);
      setActiveTab('info');

      terminalActions.addLine(
        `✓ ID read from slot ${response.item?.slot || '?'} (${response.item?.name || 'document'}) [${response.source || 'generic'}]`,
        'output'
      );
    } catch (error) {
      terminalActions.addLine(`Failed to read ID: ${error}`, 'error');
    }
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content person-search" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== PERSON SEARCH (MDT) ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="search-toolbar">
          <div class="search-input-group">
            <Input.Root
              type="text"
              class="dos-input search-input"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Enter name, citizen ID, or SSN..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button.Root class="btn btn-primary" onClick={handleSearch}>
              [SEARCH]
            </Button.Root>
            <Button.Root class="btn" onClick={() => void readFromIdReader()}>
              [READ FROM ID]
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
              <div class="empty-state">No persons found</div>
            </Show>
            
            <For each={searchResults()}>
              {(person) => (
                <div 
                  class={`result-item ${isSelectedPerson(person.citizenid) ? 'selected' : ''}`}
                  onClick={() => setSelectedPerson(person)}
                >
                  <div class="result-name">
                    {person.firstName} {person.lastName}
                    <Show when={person.isDead}>
                      <span class="deceased-tag">[DECEASED]</span>
                    </Show>
                  </div>
                  <div class="result-id">ID: {person.citizenid}</div>
                  <div class="result-meta">
                    DOB: {formatDate(person.dateOfBirth)} | SSN: {person.ssn}
                  </div>
                </div>
              )}
            </For>
          </div>

          <Show when={selectedPerson()}>
            <div class="person-details-panel">
              <div class="person-header">
                <h3>
                  {selectedPerson()!.firstName} {selectedPerson()!.lastName}
                  <Show when={hasWarrants()}>
                    <span class="warrant-badge">ACTIVE WARRANT</span>
                  </Show>
                  <Show when={personBOLO()}>
                    <span class="bolo-badge">🔴 BOLO: {personBOLO()!.reason.substring(0, 30)}</span>
                  </Show>
                </h3>
                <div class="person-id">{selectedPerson()!.citizenid}</div>
              </div>

              <div class="person-actions">
                <Button.Root 
                  class="btn btn-primary"
                  onClick={() => {
                    terminalActions.setActiveModal('CASE_CREATOR', { 
                      personId: selectedPerson()!.citizenid,
                      personName: `${selectedPerson()!.firstName} ${selectedPerson()!.lastName}`
                    });
                  }}
                >
                  [CREATE CASE]
                </Button.Root>
                <Button.Root 
                  class="btn"
                  onClick={() => {
                    setActiveTab('notes');
                  }}
                >
                  [ADD NOTE]
                </Button.Root>
                <Button.Root 
                  class="btn"
                  onClick={() => {
                    if (cadState.currentCase) {
                      terminalActions.setActiveModal('UPLOAD', { 
                        caseId: cadState.currentCase.caseId,
                        personId: selectedPerson()!.citizenid
                      });
                    } else {
                      terminalActions.addLine('No active case. Create or select a case first.', 'error');
                    }
                  }}
                >
                  [ADD EVIDENCE]
                </Button.Root>
                <Button.Root 
                  class="btn"
                  onClick={() => {
                    terminalActions.setActiveModal(null);
                    terminalActions.addLine(`Selected person: ${selectedPerson()!.firstName} ${selectedPerson()!.lastName} (${selectedPerson()!.citizenid})`, 'system');
                  }}
                >
                  [SELECT PERSON]
                </Button.Root>
                <Button.Root class="btn" onClick={openBloodRequestModal}>
                  [REQUEST BLOOD SAMPLE]
                </Button.Root>
                <Button.Root 
                  class="btn"
                  onClick={() => {
                    terminalActions.setActiveModal('UPLOAD', { 
                      personId: selectedPerson()!.citizenid,
                      personName: `${selectedPerson()!.firstName} ${selectedPerson()!.lastName}`,
                      type: 'photo'
                    });
                  }}
                >
                  [UPLOAD PHOTO]
                </Button.Root>
              </div>

              <Tabs.Root
                value={activeTab()}
                onValueChange={(value) => setActiveTab(value as 'info' | 'vehicles' | 'records' | 'warrants' | 'notes')}
              >
                <Tabs.List>
                  <Tabs.Trigger value='info' label='INFO' />
                  <Tabs.Trigger value='vehicles' label='VEHICLES' badge={personVehicles().length} />
                  <Tabs.Trigger value='records' label='RECORDS' badge={personRecords().length} />
                  <Tabs.Trigger value='warrants' label='WARRANTS' badge={personWarrants().length} />
                  <Tabs.Trigger value='notes' label='NOTES' badge={personNotes().length} />
                </Tabs.List>
              </Tabs.Root>

              <div class="tab-content">
                <Show when={activeTab() === 'info'}>
                  <div class="info-grid">
                    <div class="info-item">
                      <label>Date of Birth:</label>
                      <span class="value">{formatDate(selectedPerson()!.dateOfBirth)}</span>
                    </div>
                    <div class="info-item">
                      <label>SSN:</label>
                      <span class="value">{selectedPerson()!.ssn}</span>
                    </div>
                    <div class="info-item">
                      <label>Gender:</label>
                      <span class="value">{selectedPerson()!.gender}</span>
                    </div>
                    <div class="info-item">
                      <label>Phone:</label>
                      <span class="value">{selectedPerson()!.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <label>Address:</label>
                      <span class="value">{selectedPerson()!.address || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <label>Blood Type:</label>
                      <span class="value">{selectedPerson()!.bloodType || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                      <label>Height:</label>
                      <span class="value">{selectedPerson()!.height || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                      <label>Weight:</label>
                      <span class="value">{selectedPerson()!.weight || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                      <label>Eye Color:</label>
                      <span class="value">{selectedPerson()!.eyeColor || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                      <label>Hair Color:</label>
                      <span class="value">{selectedPerson()!.hairColor || 'Unknown'}</span>
                    </div>
                    <Show when={selectedPerson()!.allergies}>
                      <div class="info-item full-width">
                        <label>Allergies:</label>
                        <span class="value">{selectedPerson()!.allergies}</span>
                      </div>
                    </Show>
                  </div>
                  
                  <Show when={selectedPerson()!.photos && selectedPerson()!.photos!.length > 0}>
                    <div class="photo-section" style={{ 'margin-top': '20px', padding: '10px 0', 'border-top': '1px solid var(--terminal-border)' }}>
                      <h4 style={{ color: 'var(--terminal-system-bright)', 'margin-bottom': '10px' }}>Photos</h4>
                      <PhotoGallery photos={selectedPerson()!.photos!} />
                    </div>
                  </Show>
                </Show>

                <Show when={activeTab() === 'vehicles'}>
                  <div class="vehicles-list">
                    <Show when={personVehicles().length === 0}>
                      <div class="empty-state">No registered vehicles</div>
                    </Show>
                    <For each={personVehicles()}>
                      {(vehicle) => (
                        <div class="vehicle-item">
                          <div class="vehicle-plate">{vehicle.plate}</div>
                          <div class="vehicle-info">
                            {vehicle.year} {vehicle.make} {vehicle.model} - {vehicle.color}
                          </div>
                        <div class="vehicle-status">
                          Reg: {vehicle.registrationStatus} | Ins: {vehicle.insuranceStatus}
                          <Show when={vehicle.stolen}>
                            <span class="stolen-tag">[STOLEN]</span>
                          </Show>
                        </div>
                        <div class="vehicle-actions">
                          <Button.Root
                            class="btn-small"
                            onClick={() => {
                              terminalActions.setActiveModal('VEHICLE_SEARCH', { plate: vehicle.plate });
                            }}
                          >
                            [OPEN VEHICLE RECORD]
                          </Button.Root>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

                <Show when={activeTab() === 'records'}>
                  <div class="records-list">
                    <Show when={personRecords().length === 0}>
                      <div class="empty-state">No criminal record</div>
                    </Show>
                    <For each={personRecords()}>
                      {(record) => (
                        <div class={`record-item ${record.cleared ? 'cleared' : ''}`}>
                          <div class="record-date">{formatDate(record.arrestedAt)}</div>
                          <div class="record-charges">{record.charges.join(', ')}</div>
                          <div class="record-sentence">{record.sentence}</div>
                          <div class="record-officer">By: {record.arrestingOfficerName}</div>
                          <Show when={record.cleared}>
                            <div class="cleared-badge">[CLEARED]</div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={activeTab() === 'warrants'}>
                  <div class="warrants-list">
                    <Show when={personWarrants().length === 0}>
                      <div class="empty-state">No active warrants</div>
                    </Show>
                    <For each={personWarrants()}>
                      {(warrant) => (
                        <div class="warrant-item active">
                          <div class="warrant-type">{warrant.type} WARRANT</div>
                          <div class="warrant-reason">{warrant.reason}</div>
                          <div class="warrant-issued">
                            Issued: {formatDate(warrant.issuedAt)} by {warrant.issuedByName}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={activeTab() === 'notes'}>
                  <div class="records-list">
                    <div class="add-note-form">
                      <Textarea.Root
                        class="dos-textarea"
                        rows={3}
                        value={newPersonNote()}
                        onInput={(e) => setNewPersonNote(e.currentTarget.value)}
                        placeholder="Write a quick note for this person..."
                      />
                      <Button.Root class="btn btn-primary" onClick={addPersonNote}>[SAVE NOTE]</Button.Root>
                    </div>

                    <Show when={personNotes().length === 0}>
                      <div class="empty-state">No person notes yet</div>
                    </Show>

                    <For each={personNotes()}>
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
            MDT System v1.0
          </span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>

      <Show when={showBloodRequestModal()}>
                <Modal.Root onClose={cancelBloodRequest} useContentWrapper={false} overlayClass='blood-request-modal'>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>=== REQUEST BLOOD SAMPLE ===</h3>
              <button class="modal-close" onClick={cancelBloodRequest}>[X]</button>
            </div>
            <div class="modal-body">
              <p>Requesting blood sample from: <strong>{selectedPerson()?.firstName} {selectedPerson()?.lastName}</strong></p>
              <div class="form-group">
                <label>Reason for request:</label>
                <Textarea.Root
                  class="dos-textarea"
                  rows={3}
                  value={bloodRequestReason()}
                  onInput={(e) => setBloodRequestReason(e.currentTarget.value)}
                  placeholder="Enter reason for blood sample request..."
                />
              </div>
            </div>
            <div class="modal-footer">
              <Button.Root class="btn" onClick={cancelBloodRequest}>[CANCEL]</Button.Root>
              <Button.Root class="btn btn-primary" onClick={submitBloodRequest}>[SUBMIT REQUEST]</Button.Root>
            </div>
          </div>
        </Modal.Root>
      </Show>
    </Modal.Root>
  );
}
