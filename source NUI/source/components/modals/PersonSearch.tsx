import { createSignal, createMemo, createSelector, For, Show, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type Person } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Input, Modal, Tabs, Textarea } from '~/components/ui';
import { PhotoGallery } from '~/components/ui/PhotoGallery';

interface LookupPersonsResponse {
  ok?: boolean;
  persons?: Person[];
  error?: string;
}

interface EntityNoteResponse {
  ok?: boolean;
  notes?: Array<{
    id: string;
    content: string;
    author: string;
    authorName?: string;
    timestamp: string;
    important?: boolean;
  }>;
  note?: {
    id: string;
    content: string;
    author: string;
    authorName?: string;
    timestamp: string;
    important?: boolean;
  };
  error?: string;
}

interface PhoneLookupResult {
  identifier: string;
  phoneNumber?: string;
  imei?: string;
  isStolen: boolean;
  stolenAt?: string;
  stolenReason?: string;
  stolenReporter?: string;
  ownerCitizenId?: string;
  ownerName?: string;
  placeholderActions?: boolean;
  person?: Person;
}

interface PersonSearchModalData {
  citizenId?: string;
  query?: string;
  tab?: 'info' | 'vehicles' | 'records' | 'warrants' | 'notes' | 'phone';
  phoneNumber?: string;
  imei?: string;
}

interface PhoneLookupResponse {
  ok?: boolean;
  result?: PhoneLookupResult;
  error?: string;
}

export function PersonSearch() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = createSignal<Person | null>(null);
  const [activeTab, setActiveTab] = createSignal<'info' | 'vehicles' | 'records' | 'warrants' | 'notes' | 'phone'>('info');
  const [newPersonNote, setNewPersonNote] = createSignal('');
  const [showBloodRequestModal, setShowBloodRequestModal] = createSignal(false);
  const [bloodRequestReason, setBloodRequestReason] = createSignal('Forensic blood sample request');
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [phoneNumberQuery, setPhoneNumberQuery] = createSignal('');
  const [imeiQuery, setImeiQuery] = createSignal('');
  const [phoneLookupResult, setPhoneLookupResult] = createSignal<PhoneLookupResult | null>(null);
  const [phoneLookupLoading, setPhoneLookupLoading] = createSignal(false);
  const isSelectedPerson = createSelector(() => selectedPerson()?.citizenid || null);

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

  const personStatusBadges = createMemo(() => {
    const person = selectedPerson();
    if (!person) return [] as Array<{ label: string; tone: string }>;

    const badges: Array<{ label: string; tone: string }> = [];
    if (person.isDead) badges.push({ label: 'DECEASED', tone: '#ff7b72' });
    if (hasWarrants()) badges.push({ label: 'ACTIVE WARRANT', tone: '#ffb86c' });
    if (personBOLO()) badges.push({ label: 'BOLO', tone: '#ff5555' });
    if (personVehicles().some((vehicle) => vehicle.stolen)) badges.push({ label: 'STOLEN VEHICLE LINK', tone: '#ffd166' });

    return badges;
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
    cadActions.clearSearchResults();
  };

  const phoneIntelPhoto = createMemo(() => {
    const result = phoneLookupResult();
    if (!result) return null;
    return result.person?.photo || selectedPerson()?.photo || null;
  });

  const applyPhoneLookupResult = async (result: PhoneLookupResult | null, preferPhoneTab = true) => {
    setPhoneLookupResult(result);

    if (!result) {
      return;
    }

    if (result.person) {
      cadActions.addPerson(result.person);
      setSelectedPerson(result.person);
    }

    if (result.ownerCitizenId) {
      const knownPerson = cadState.persons[result.ownerCitizenId];
      if (knownPerson) {
        setSelectedPerson(knownPerson);
      }
    }

    if (preferPhoneTab) {
      setActiveTab('phone');
    }

    const ownerId = result.ownerCitizenId || result.person?.citizenid;
    if (ownerId) {
      await loadPersonNotes(ownerId);
    }
  };

  const selectPersonRecord = async (person: Person, tab?: 'info' | 'vehicles' | 'records' | 'warrants' | 'notes' | 'phone') => {
    setSelectedPerson(person);
    if (tab) {
      setActiveTab(tab);
    }

    setPhoneLookupResult(null);
    setPhoneNumberQuery(person.phone || '');
    await loadPersonNotes(person.citizenid);
  };

  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetchNui<LookupPersonsResponse>('cad:lookup:searchPersons', {
        query,
        limit: 15,
      });

      const results = Array.isArray(response.persons) ? response.persons : [];
      results.forEach((person) => cadActions.addPerson(person));
      setSearchResults(results);

      const modalData = (terminalState.modalData as PersonSearchModalData | null) || null;
      const preferredCitizenId = modalData?.citizenId?.trim().toLowerCase() || '';
      const normalizedQuery = query.toLowerCase();
      const nextSelected =
        results.find((person) => person.citizenid.toLowerCase() === preferredCitizenId) ||
        results.find((person) => person.citizenid.toLowerCase() === normalizedQuery) ||
        results[0] ||
        null;

      if (nextSelected) {
        await selectPersonRecord(nextSelected, modalData?.tab === 'phone' ? 'phone' : 'info');
      } else {
        setSelectedPerson(null);
      }
    } catch (error) {
      terminalActions.addLine(`Person search failed: ${String(error)}`, 'error');
      setSearchResults([]);
      setSelectedPerson(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadPersonNotes = async (citizenId: string) => {
    const cleanId = citizenId.trim();
    if (!cleanId) {
      return;
    }

    try {
      const response = await fetchNui<EntityNoteResponse>('cad:entityNotes:list', {
        entityType: 'PERSON',
        entityId: cleanId,
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

      cadActions.updatePerson(cleanId, { notes });
      const knownPerson = cadState.persons[cleanId];
      if (knownPerson) {
        setSelectedPerson({ ...knownPerson, notes });
      }
    } catch (error) {
      terminalActions.addLine(`Person notes failed: ${String(error)}`, 'error');
    }
  };

  const lookupPhoneByNumber = async () => {
    const phoneNumber = phoneNumberQuery().trim();
    if (!phoneNumber) {
      terminalActions.addLine('Enter a phone number first', 'error');
      return;
    }

    setPhoneLookupLoading(true);
    try {
      const response = await fetchNui<PhoneLookupResponse>('cad:phone:lookupByNumber', {
        phoneNumber,
      });

      await applyPhoneLookupResult(response.result || null);
      terminalActions.addLine(`Phone lookup loaded owner for ${phoneNumber}`, 'output');
    } catch (error) {
      setPhoneLookupResult(null);
      terminalActions.addLine(`Phone lookup failed: ${String(error)}`, 'error');
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  const lookupPhoneByImei = async () => {
    const imei = imeiQuery().trim();
    if (!imei) {
      terminalActions.addLine('Enter an IMEI first', 'error');
      return;
    }

    setPhoneLookupLoading(true);
    try {
      const response = await fetchNui<PhoneLookupResponse>('cad:phone:lookupByImei', {
        imei,
      });

      await applyPhoneLookupResult(response.result || null);
      terminalActions.addLine(`IMEI lookup loaded owner for ${imei}`, 'output');
    } catch (error) {
      setPhoneLookupResult(null);
      terminalActions.addLine(`IMEI lookup failed: ${String(error)}`, 'error');
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  const triggerPhonePlaceholder = async (action: 'MARK' | 'CLEAR') => {
    const current = phoneLookupResult();
    if (!current) {
      terminalActions.addLine('Run a phone lookup first', 'error');
      return;
    }

    try {
      const response = await fetchNui<{ ok?: boolean; placeholder?: boolean; message?: string; result?: PhoneLookupResult }>('cad:phone:setStolenPlaceholder', {
        action,
        phoneNumber: current.phoneNumber,
        imei: current.imei,
      });

      if (response.result) {
        await applyPhoneLookupResult(response.result, true);
      }

      if (response.placeholder) {
        terminalActions.addLine(
          action === 'MARK'
            ? 'Placeholder only: mark stolen is ready for wiring'
            : 'Placeholder only: clear stolen is ready for wiring',
          'system'
        );
      } else {
        terminalActions.addLine(
          action === 'MARK'
            ? 'Phone marked as stolen'
            : 'Phone stolen flag cleared',
          'output'
        );
      }
    } catch (error) {
      terminalActions.addLine(`Phone action failed: ${String(error)}`, 'error');
    }
  };

  onMount(() => {
    void (async () => {
      const modalData = (terminalState.modalData as PersonSearchModalData | null) || null;
      if (!modalData) {
        return;
      }

      if (modalData.tab) {
        setActiveTab(modalData.tab);
      }

      if (modalData.phoneNumber && modalData.phoneNumber.trim() !== '') {
        setPhoneNumberQuery(modalData.phoneNumber.trim());
      }

      if (modalData.imei && modalData.imei.trim() !== '') {
        setImeiQuery(modalData.imei.trim());
      }

      const rawQuery = modalData.citizenId || modalData.query;
      if (rawQuery && rawQuery.trim() !== '') {
        const query = rawQuery.trim();
        setSearchQuery(query);
        await handleSearch();
      }

      if (modalData.tab === 'phone') {
        if (modalData.phoneNumber && modalData.phoneNumber.trim() !== '') {
          await lookupPhoneByNumber();
          return;
        }

        if (modalData.imei && modalData.imei.trim() !== '') {
          await lookupPhoneByImei();
        }
      }
    })();
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const addPersonNote = async () => {
    const person = selectedPerson();
    const content = newPersonNote().trim();
    if (!person || !content) {
      terminalActions.addLine('Write a note first', 'error');
      return;
    }

    try {
      const response = await fetchNui<EntityNoteResponse>('cad:entityNotes:add', {
        entityType: 'PERSON',
        entityId: person.citizenid,
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

      cadActions.addPersonNote(person.citizenid, normalizedNote);
      setSelectedPerson({ ...person, notes: [...(person.notes || []), normalizedNote] });
      setNewPersonNote('');
      setActiveTab('notes');
      terminalActions.addLine(`✓ Note added to person ${person.citizenid}`, 'output');
    } catch (error) {
      terminalActions.addLine(`Failed to save note: ${String(error)}`, 'error');
    }
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
      setSearchResults([response.person]);
      await selectPersonRecord(response.person, 'info');

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
              onKeyPress={(e) => e.key === 'Enter' && void handleSearch()}
            />
            <Button.Root class="btn btn-primary" onClick={() => void handleSearch()} disabled={searchLoading()}>
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
          <Show when={searchResults().length === 0 && !searchQuery()}>
            <div class="search-stats">Enter a citizen ID, name, or SSN to open a live record.</div>
          </Show>
        </div>

        <div class="search-content">
          <div class="search-results-panel">
            <Show when={searchResults().length === 0 && searchQuery()}>
              <div class="empty-state">No MDT person match for that query</div>
            </Show>
            
            <For each={searchResults()}>
              {(person) => (
                <div 
                  class={`result-item ${isSelectedPerson(person.citizenid) ? 'selected' : ''}`}
                   onClick={() => void selectPersonRecord(person)}
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
                <div style={{ display: 'flex', gap: '12px', 'align-items': 'flex-start' }}>
                  <div
                    style={{
                      width: '84px',
                      height: '84px',
                      border: '1px solid var(--terminal-border)',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      'background-color': 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      'flex-shrink': 0,
                    }}
                  >
                    <Show when={selectedPerson()!.photo} fallback={<span style={{ color: 'var(--terminal-text-dim)' }}>NO IMG</span>}>
                      <img
                        src={selectedPerson()!.photo!}
                        alt="Person mugshot"
                        style={{ width: '100%', height: '100%', 'object-fit': 'cover' }}
                      />
                    </Show>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0 }}>
                      {selectedPerson()!.firstName} {selectedPerson()!.lastName}
                    </h3>
                    <div class="person-id">{selectedPerson()!.citizenid}</div>
                    <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-top': '8px' }}>
                      <For each={personStatusBadges()}>
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
                    <Show when={personBOLO()}>
                      <div style={{ 'margin-top': '8px', color: '#ff8b8b' }}>
                        BOLO: {personBOLO()!.reason}
                      </div>
                    </Show>
                  </div>
                </div>
                <div class="info-grid" style={{ 'margin-top': '12px' }}>
                  <div class="info-item">
                    <label>Open Warrants:</label>
                    <span class="value">{personWarrants().length}</span>
                  </div>
                  <div class="info-item">
                    <label>Vehicles:</label>
                    <span class="value">{personVehicles().length}</span>
                  </div>
                  <div class="info-item">
                    <label>Records:</label>
                    <span class="value">{personRecords().length}</span>
                  </div>
                  <div class="info-item">
                    <label>Notes:</label>
                    <span class="value">{personNotes().length}</span>
                  </div>
                </div>
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
                onValueChange={(value) => setActiveTab(value as 'info' | 'vehicles' | 'records' | 'warrants' | 'notes' | 'phone')}
              >
                <Tabs.List>
                  <Tabs.Trigger value='info' label='INFO' />
                  <Tabs.Trigger value='vehicles' label='VEHICLES' badge={personVehicles().length} />
                  <Tabs.Trigger value='records' label='RECORDS' badge={personRecords().length} />
                  <Tabs.Trigger value='warrants' label='WARRANTS' badge={personWarrants().length} />
                  <Tabs.Trigger value='notes' label='NOTES' badge={personNotes().length} />
                  <Tabs.Trigger value='phone' label='PHONE INTEL' />
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
                      <span class="value">{selectedPerson()!.bloodType || 'Not recorded'}</span>
                    </div>
                    <div class="info-item">
                      <label>Height:</label>
                      <span class="value">{selectedPerson()!.height || 'Not recorded'}</span>
                    </div>
                    <div class="info-item">
                      <label>Weight:</label>
                      <span class="value">{selectedPerson()!.weight || 'Not recorded'}</span>
                    </div>
                    <div class="info-item">
                      <label>Eye Color:</label>
                      <span class="value">{selectedPerson()!.eyeColor || 'Not recorded'}</span>
                    </div>
                    <div class="info-item">
                      <label>Hair Color:</label>
                      <span class="value">{selectedPerson()!.hairColor || 'Not recorded'}</span>
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
                      <div class="empty-state">No registered vehicles linked to this citizen</div>
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
                      <div class="empty-state">No criminal record entries on file</div>
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
                      <div class="empty-state">No active warrants on file</div>
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
                      <div class="empty-state">No investigator notes saved for this person</div>
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

                <Show when={activeTab() === 'phone'}>
                  <div class="records-list">
                    <div class="add-note-form">
                      <div class="search-input-group">
                        <Input.Root
                          type="text"
                          class="dos-input"
                          value={phoneNumberQuery()}
                          onInput={(e) => setPhoneNumberQuery(e.currentTarget.value)}
                          placeholder="Phone number"
                        />
                        <Button.Root class="btn btn-primary" onClick={() => void lookupPhoneByNumber()} disabled={phoneLookupLoading()}>
                          [LOOKUP NUMBER]
                        </Button.Root>
                      </div>
                      <div class="search-input-group" style={{ 'margin-top': '8px' }}>
                        <Input.Root
                          type="text"
                          class="dos-input"
                          value={imeiQuery()}
                          onInput={(e) => setImeiQuery(e.currentTarget.value)}
                          placeholder="IMEI"
                        />
                        <Button.Root class="btn btn-primary" onClick={() => void lookupPhoneByImei()} disabled={phoneLookupLoading()}>
                          [LOOKUP IMEI]
                        </Button.Root>
                      </div>
                    </div>

                    <Show when={!phoneLookupResult()}>
                      <div class="empty-state">Run a number or IMEI lookup to load phone intelligence</div>
                    </Show>

                    <Show when={phoneLookupResult()}>
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
                          <Show
                            when={phoneIntelPhoto()}
                            fallback={<span style={{ color: 'var(--terminal-text-dim)' }}>NO IMG</span>}
                          >
                            <img
                              src={phoneIntelPhoto()!}
                              alt="Owner mugshot"
                              style={{ width: '100%', height: '100%', 'object-fit': 'cover' }}
                            />
                          </Show>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div class="record-item">
                            <div class="record-sentence">Phone intelligence match loaded</div>
                            <div class="record-officer">Owner record cross-linked to MDT</div>
                          </div>
                        </div>
                      </div>

                      <div class="info-grid">
                        <div class="info-item">
                          <label>Owner:</label>
                          <span class="value">{phoneLookupResult()!.ownerName || 'UNKNOWN'}</span>
                        </div>
                        <div class="info-item">
                          <label>Citizen ID:</label>
                          <span class="value">{phoneLookupResult()!.ownerCitizenId || phoneLookupResult()!.identifier || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                          <label>Phone:</label>
                          <span class="value">{phoneLookupResult()!.phoneNumber || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                          <label>IMEI:</label>
                          <span class="value">{phoneLookupResult()!.imei || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                          <label>Stolen:</label>
                          <span class="value">{phoneLookupResult()!.isStolen ? 'YES' : 'NO'}</span>
                        </div>
                        <div class="info-item">
                          <label>Reported At:</label>
                          <span class="value">{phoneLookupResult()!.stolenAt ? formatDate(phoneLookupResult()!.stolenAt!) : 'N/A'}</span>
                        </div>
                        <Show when={phoneLookupResult()!.stolenReason}>
                          <div class="info-item full-width">
                            <label>Stolen Reason:</label>
                            <span class="value">{phoneLookupResult()!.stolenReason}</span>
                          </div>
                        </Show>
                        <Show when={phoneLookupResult()!.stolenReporter}>
                          <div class="info-item full-width">
                            <label>Reporter:</label>
                            <span class="value">{phoneLookupResult()!.stolenReporter}</span>
                          </div>
                        </Show>
                      </div>

                      <div class="person-actions" style={{ 'margin-top': '12px' }}>
                        <Button.Root class="btn" onClick={() => void triggerPhonePlaceholder('MARK')}>
                          [MARK STOLEN]
                        </Button.Root>
                        <Button.Root class="btn" onClick={() => void triggerPhonePlaceholder('CLEAR')}>
                          [CLEAR STOLEN]
                        </Button.Root>
                        <Show when={phoneLookupResult()!.ownerCitizenId}>
                          <Button.Root
                            class="btn btn-primary"
                            onClick={() => {
                              const ownerId = phoneLookupResult()!.ownerCitizenId;
                              if (ownerId) {
                                const knownPerson = cadState.persons[ownerId];
                                if (knownPerson) {
                                  void selectPersonRecord(knownPerson, 'info');
                                }
                              }
                            }}
                          >
                            [OPEN OWNER]
                          </Button.Root>
                        </Show>
                      </div>
                    </Show>
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
