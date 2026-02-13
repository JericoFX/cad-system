import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type Person } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';

export function PersonSearch() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedPerson, setSelectedPerson] = createSignal<Person | null>(null);
  const [activeTab, setActiveTab] = createSignal<'info' | 'vehicles' | 'records' | 'warrants'>('info');

  const searchResults = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return [];
    
    return Object.values(cadState.persons).filter(p => 
      p.firstName.toLowerCase().includes(query) ||
      p.lastName.toLowerCase().includes(query) ||
      p.citizenid.toLowerCase().includes(query) ||
      p.ssn.includes(query)
    );
  });

  const personVehicles = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return Object.values(cadState.vehicles).filter(v => v.ownerId === person.citizenid);
  });

  const personRecords = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return Object.values(cadState.criminalRecords).filter(r => r.citizenid === person.citizenid);
  });

  const personWarrants = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [];
    return Object.values(cadState.warrants).filter(w => w.citizenid === person.citizenid && w.active);
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
    if (!searchQuery().trim()) return;
    // No hace falta nada mas aca, el memo ya filtra solito.
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

    const person = Object.values(cadState.persons).find((p) => {
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

  const requestBloodSample = async () => {
    const person = selectedPerson();
    if (!person) {
      return;
    }

    const reason = window.prompt('Motivo de la solicitud de muestra de sangre:', 'Forensic blood sample request');
    if (reason === null) {
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
        terminalActions.addLine(`No se pudo crear solicitud de sangre: ${result?.error || 'unknown_error'}`, 'error');
        return;
      }

      terminalActions.addLine(
        `✓ Solicitud de muestra enviada a EMS (${result.request?.requestId || 'BLOODREQ'})`,
        'output'
      );
    } catch (error) {
      terminalActions.addLine(`No se pudo crear solicitud de sangre: ${error}`, 'error');
    }
  };

  const readFromIdReader = async () => {
    // Lee el doc desde el lector del terminal y autocompleta la persona.
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
        person?: Person;
        source?: string;
        item?: { name?: string; slot?: number };
        error?: string;
      }>('cad:idreader:read', {
        terminalId: context.terminalId,
      });

      if (!response?.ok || !response.person) {
        terminalActions.addLine(`Failed to read ID: ${response?.error || 'unknown_error'}`, 'error');
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
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content person-search" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== PERSON SEARCH (MDT) ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="search-toolbar">
          <div class="search-input-group">
            <input
              type="text"
              class="dos-input search-input"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Enter name, citizen ID, or SSN..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button class="btn btn-primary" onClick={handleSearch}>
              [SEARCH]
            </button>
            <button class="btn" onClick={() => void readFromIdReader()}>
              [READ FROM ID]
            </button>
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
                  class={`result-item ${selectedPerson()?.citizenid === person.citizenid ? 'selected' : ''}`}
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
                <button 
                  class="btn btn-primary"
                  onClick={() => {
                    terminalActions.setActiveModal('CASE_CREATOR', { 
                      personId: selectedPerson()!.citizenid,
                      personName: `${selectedPerson()!.firstName} ${selectedPerson()!.lastName}`
                    });
                  }}
                >
                  [CREATE CASE]
                </button>
                <button 
                  class="btn"
                  onClick={() => {
                    if (cadState.currentCase) {
                      terminalActions.setActiveModal('NOTES', { 
                        caseId: cadState.currentCase.caseId,
                        personName: `${selectedPerson()!.firstName} ${selectedPerson()!.lastName}`
                      });
                    } else {
                      terminalActions.addLine('No active case. Create or select a case first.', 'error');
                      terminalActions.setActiveModal('CASE_CREATOR', { 
                        personId: selectedPerson()!.citizenid,
                        personName: `${selectedPerson()!.firstName} ${selectedPerson()!.lastName}`
                      });
                    }
                  }}
                >
                  [ADD NOTE]
                </button>
                <button 
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
                </button>
                <button 
                  class="btn"
                  onClick={() => {
                    terminalActions.setActiveModal(null);
                    terminalActions.addLine(`Selected person: ${selectedPerson()!.firstName} ${selectedPerson()!.lastName} (${selectedPerson()!.citizenid})`, 'system');
                  }}
                >
                  [SELECT PERSON]
                </button>
                <button class="btn" onClick={requestBloodSample}>
                  [REQUEST BLOOD SAMPLE]
                </button>
              </div>

              <div class="detail-tabs">
                <button 
                  class={`tab ${activeTab() === 'info' ? 'active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >
                  [INFO]
                </button>
                <button 
                  class={`tab ${activeTab() === 'vehicles' ? 'active' : ''}`}
                  onClick={() => setActiveTab('vehicles')}
                >
                  [VEHICLES ({personVehicles().length})]
                </button>
                <button 
                  class={`tab ${activeTab() === 'records' ? 'active' : ''}`}
                  onClick={() => setActiveTab('records')}
                >
                  [RECORDS ({personRecords().length})]
                </button>
                <button 
                  class={`tab ${activeTab() === 'warrants' ? 'active' : ''}`}
                  onClick={() => setActiveTab('warrants')}
                >
                  [WARRANTS ({personWarrants().length})]
                </button>
              </div>

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
                          <button
                            class="btn-small"
                            onClick={() => {
                              terminalActions.setActiveModal('VEHICLE_SEARCH', { plate: vehicle.plate });
                            }}
                          >
                            [OPEN VEHICLE RECORD]
                          </button>
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
              </div>
            </div>
          </Show>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            MDT System v1.0
          </span>
          <button class="btn" onClick={closeModal}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
