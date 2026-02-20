import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { t } from '~/utils/i18n';
import type { Evidence, Person } from '~/stores/cadStore';
import { Button, Input, Modal } from '~/components/ui';

export function ForensicCollection() {
  const [activePanel, setActivePanel] = createSignal<'collect' | 'blood'>('collect');
  const [evidenceType, setEvidenceType] = createSignal('FINGERPRINT');
  const [description, setDescription] = createSignal('');
  const [isCollecting, setIsCollecting] = createSignal(false);
  const [collectedEvidence, setCollectedEvidence] = createSignal<Evidence | null>(null);
  const [caseId, setCaseId] = createSignal('');

  const [requestCitizenId, setRequestCitizenId] = createSignal('');
  const [requestPersonName, setRequestPersonName] = createSignal('');
  const [requestReason, setRequestReason] = createSignal('');
  const [requestLocation, setRequestLocation] = createSignal('');
  const [isRequestingBlood, setIsRequestingBlood] = createSignal(false);
  const [personSearchQuery, setPersonSearchQuery] = createSignal('');
  const [personSearchLoading, setPersonSearchLoading] = createSignal(false);
  const [personSearchResults, setPersonSearchResults] = createSignal<Person[]>([]);
  const [selectedBloodPerson, setSelectedBloodPerson] = createSignal<Person | null>(null);
  const [bloodRequests, setBloodRequests] = createSignal<
    Array<{
      requestId: string;
      caseId?: string;
      citizenId?: string;
      personName: string;
      reason: string;
      location?: string;
      status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
      requestedAt: string;
      requestedByName?: string;
      notes?: string;
    }>
  >([]);
  
  const [bloodType, setBloodType] = createSignal('O+');
  const [caliber, setCaliber] = createSignal('9mm');
  const [fiberColor, setFiberColor] = createSignal('white');
  const [quality, setQuality] = createSignal(75);

  const evidenceTypes = [
    { value: 'FINGERPRINT', label: 'FINGERPRINT', icon: '🔍' },
    { value: 'BLOOD', label: 'BLOOD', icon: '🩸' },
    { value: 'DNA', label: 'DNA', icon: '🧬' },
    { value: 'CASING', label: 'CASING', icon: '🔫' },
    { value: 'BULLET', label: 'BULLET', icon: '💥' },
    { value: 'FIBERS', label: 'FIBERS', icon: '🧵' },
    { value: 'TOOL_MARKS', label: 'TOOL MARKS', icon: '🔧' },
    { value: 'PHOTO', label: 'PHOTO', icon: '📷' },
    { value: 'PHYSICAL', label: 'PHYSICAL', icon: '📦' },
  ];

  const openCases = createMemo(() => 
    Object.values(cadState.cases).filter(c => c.status === 'OPEN')
  );

  const activeBloodRequests = createMemo(() =>
    bloodRequests().filter((request) =>
      request.status !== 'COMPLETED' && request.status !== 'DECLINED' && request.status !== 'CANCELLED'
    )
  );

  const bloodStatusColor = (status: string) => {
    if (status === 'PENDING') return '#ffaa00';
    if (status === 'ACKNOWLEDGED') return '#00ffff';
    if (status === 'IN_PROGRESS') return '#00aaff';
    if (status === 'COMPLETED') return '#00ff00';
    return '#ff5555';
  };

  const loadBloodRequests = async () => {
    try {
      const response = await fetchNui<{ ok: boolean; requests?: unknown[]; error?: string }>('cad:ems:getBloodRequests', {});
      if (!response?.ok) {
        terminalActions.addLine(`Failed to load blood requests: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      const rows = Array.isArray(response.requests) ? response.requests : [];
      setBloodRequests(rows as Array<{
        requestId: string;
        caseId?: string;
        citizenId?: string;
        personName: string;
        reason: string;
        location?: string;
        status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
        requestedAt: string;
        requestedByName?: string;
        notes?: string;
      }>);
    } catch (error) {
      terminalActions.addLine(`Failed to load blood requests: ${error}`, 'error');
    }
  };

  const createBloodRequest = async () => {
    const selectedPerson = selectedBloodPerson();
    const selectedPersonName = selectedPerson
      ? `${selectedPerson.firstName} ${selectedPerson.lastName}`.trim()
      : '';
    const resolvedCitizenId = (selectedPerson?.citizenid || requestCitizenId()).trim();
    const resolvedPersonName = (selectedPersonName || requestPersonName()).trim();
    const resolvedLocation = (requestLocation().trim() || selectedPerson?.address || '').trim();

    if (!caseId()) {
      terminalActions.addLine('Select an open case before requesting blood sample', 'error');
      return;
    }

    if (!requestReason().trim()) {
      terminalActions.addLine('Blood request reason is required', 'error');
      return;
    }

    if (!resolvedCitizenId && !resolvedPersonName) {
      terminalActions.addLine('Provide citizen ID or person name', 'error');
      return;
    }

    setIsRequestingBlood(true);
    try {
      const result = await fetchNui<{ ok: boolean; request?: { requestId?: string }; error?: string }>('cad:ems:createBloodRequest', {
        caseId: caseId(),
        citizenId: resolvedCitizenId || undefined,
        personName: resolvedPersonName || undefined,
        reason: requestReason().trim(),
        location: resolvedLocation || undefined,
      });

      if (!result?.ok) {
        terminalActions.addLine(`Failed to create blood request: ${result?.error || 'unknown_error'}`, 'error');
        return;
      }

      terminalActions.addLine(`✓ Blood sample request sent (${result.request?.requestId || 'BLOODREQ'})`, 'output');
      setRequestReason('');
      setPersonSearchQuery('');
      setPersonSearchResults([]);
      void loadBloodRequests();
    } catch (error) {
      terminalActions.addLine(`Failed to create blood request: ${error}`, 'error');
    } finally {
      setIsRequestingBlood(false);
    }
  };

  const searchPersonsForBlood = async () => {
    const query = personSearchQuery().trim();
    if (!query) {
      setPersonSearchResults([]);
      return;
    }

    setPersonSearchLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; persons?: Person[]; error?: string }>('cad:lookup:searchPersons', {
        query,
        limit: 10,
      });

      if (!response?.ok) {
        terminalActions.addLine(`Failed to search persons: ${response?.error || 'unknown_error'}`, 'error');
        setPersonSearchResults([]);
        return;
      }

      setPersonSearchResults(Array.isArray(response.persons) ? response.persons : []);
    } catch (error) {
      terminalActions.addLine(`Failed to search persons: ${error}`, 'error');
      setPersonSearchResults([]);
    } finally {
      setPersonSearchLoading(false);
    }
  };

  const selectPersonForBlood = (person: Person) => {
    setSelectedBloodPerson(person);
    setRequestCitizenId(person.citizenid || '');
    setRequestPersonName(`${person.firstName} ${person.lastName}`.trim());
    if (!requestLocation().trim() && person.address) {
      setRequestLocation(person.address);
    }
  };

  onMount(() => {
    void loadBloodRequests();
  });

  const handleCollect = async () => {
    if (!caseId()) {
      terminalActions.addLine(t('forensics.errorSelectCase'), 'error');
      return;
    }
    
    setIsCollecting(true);
    
    try {
      const result = await fetchNui<{ ok: boolean; evidence?: Evidence; error?: string }>('cad:forensic:collectEvidence', {
        caseId: caseId(),
        evidenceType: evidenceType(),
        description: description(),
        bloodType: evidenceType() === 'BLOOD' ? bloodType() : undefined,
        caliber: (evidenceType() === 'CASING' || evidenceType() === 'BULLET') ? caliber() : undefined,
        fiberColor: evidenceType() === 'FIBERS' ? fiberColor() : undefined,
        quality: quality(),
      });
      
      if (result?.ok && result.evidence) {
        setCollectedEvidence(result.evidence);
        cadActions.addCaseEvidence(caseId(), result.evidence);
        terminalActions.addLine(t('forensics.collectedLine', undefined, { id: result.evidence.evidenceId }), 'output');
      } else {
        terminalActions.addLine(
          t('forensics.failedLine', undefined, { error: result?.error || t('common.unknown') }),
          'error'
        );
      }
    } catch (error) {
      terminalActions.addLine(`Error: ${error}`, 'error');
    } finally {
      setIsCollecting(false);
    }
  };

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const getEvidenceTimeLabel = (evidence: Evidence) => {
    const dataCollectedAt =
      typeof evidence.data?.collectedAt === 'string' ? evidence.data.collectedAt : null;
    const timestamp = evidence.attachedAt || dataCollectedAt;
    if (!timestamp) {
      return '--:--';
    }
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content forensic-collection" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{t('forensics.title')}</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>
        
        <div class="collection-form">
          <div class="form-actions" style={{ 'justify-content': 'flex-start', gap: '8px' }}>
            <Button.Root class={activePanel() === 'collect' ? 'btn btn-primary' : 'btn'} onClick={() => setActivePanel('collect')}>
              [COLLECT EVIDENCE]
            </Button.Root>
            <Button.Root class={activePanel() === 'blood' ? 'btn btn-primary' : 'btn'} onClick={() => setActivePanel('blood')}>
              [BLOOD REQUESTS]
            </Button.Root>
            <Button.Root class="btn" onClick={() => void loadBloodRequests()}>
              [REFRESH REQUESTS]
            </Button.Root>
            <span class="inventory-category" style={{ 'align-self': 'center' }}>
              Active requests: {activeBloodRequests().length}
            </span>
          </div>

          <Show when={activePanel() === 'collect'}>
            <div class="form-section">
              <label class="form-label">{t('forensics.selectCase')}</label>
              <select
                class="dos-input"
                value={caseId()}
                onChange={(e) => setCaseId(e.currentTarget.value)}
              >
                <option value="">{t('forensics.selectOpenCase')}</option>
                <For each={openCases()}>
                  {(c) => (
                    <option value={c.caseId}>
                      {c.caseId} - {c.title}
                    </option>
                  )}
                </For>
              </select>
            </div>

            <div class="form-section">
              <label class="form-label">{t('forensics.evidenceType')}</label>
              <div class="evidence-type-grid">
                <For each={evidenceTypes}>
                  {(type) => (
                    <button
                      class={`type-btn ${evidenceType() === type.value ? 'selected' : ''}`}
                      onClick={() => setEvidenceType(type.value)}
                    >
                      <span class="icon">{type.icon}</span>
                      <span class="label">{type.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={evidenceType() === 'BLOOD'}>
              <div class="form-section">
                <label class="form-label">{t('forensics.bloodType')}</label>
                <select class="dos-input" value={bloodType()} onChange={(e) => setBloodType(e.currentTarget.value)}>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </Show>

            <Show when={evidenceType() === 'CASING' || evidenceType() === 'BULLET'}>
              <div class="form-section">
                <label class="form-label">{t('forensics.caliber')}</label>
                <select class="dos-input" value={caliber()} onChange={(e) => setCaliber(e.currentTarget.value)}>
                  <option value="9mm">9mm</option>
                  <option value=".45">.45 ACP</option>
                  <option value=".44">.44 Magnum</option>
                  <option value=".357">.357 Magnum</option>
                  <option value="12gauge">12 Gauge</option>
                  <option value="5.56">5.56 NATO</option>
                  <option value="7.62">7.62 NATO</option>
                </select>
              </div>
            </Show>

            <Show when={evidenceType() === 'FIBERS'}>
              <div class="form-section">
                <label class="form-label">{t('forensics.fiberColor')}</label>
                <Input.Root type="text" class="dos-input" value={fiberColor()} onInput={(e) => setFiberColor(e.currentTarget.value)} />
              </div>
            </Show>

            <Show when={evidenceType() === 'FINGERPRINT'}>
              <div class="form-section">
                <label class="form-label">{t('forensics.quality', undefined, { value: quality() })}</label>
                <Input.Root type="range" class="dos-input dos-slider" min="0" max="100" value={quality()} onInput={(e) => setQuality(parseInt(e.currentTarget.value))} />
              </div>
            </Show>

            <div class="form-section">
              <label class="form-label">{t('forensics.description')}</label>
              <textarea
                class="dos-input"
                rows={3}
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder={t('forensics.descriptionPlaceholder')}
              />
            </div>

            <div class="form-actions">
              <Button.Root class="btn btn-primary" onClick={handleCollect} disabled={isCollecting() || !caseId()}>
                {isCollecting() ? t('forensics.collecting') : t('forensics.collect')}
              </Button.Root>
              <Button.Root class="btn" onClick={closeModal}>{t('forensics.cancel')}</Button.Root>
            </div>

            <Show when={collectedEvidence()}>
              {(evidence) => (
                <div class="collection-success">
                  <h3>{t('forensics.collected')}</h3>
                  <div class="evidence-id">{evidence().evidenceId}</div>
                  <div class="evidence-details">
                    <div>Type: {evidence().evidenceType}</div>
                    <div>Case: {evidence().caseId}</div>
                    <div>{t('forensics.timeLabel')}: {getEvidenceTimeLabel(evidence())}</div>
                  </div>
                </div>
              )}
            </Show>
          </Show>

          <Show when={activePanel() === 'blood'}>
            <div class="form-section">
              <label class="form-label">Link to Case</label>
              <select class="dos-input" value={caseId()} onChange={(e) => setCaseId(e.currentTarget.value)}>
                <option value="">Select open case</option>
                <For each={openCases()}>
                  {(c) => (
                    <option value={c.caseId}>
                      {c.caseId} - {c.title}
                    </option>
                  )}
                </For>
              </select>
            </div>

            <div class="form-section">
              <label class="form-label">Search Person</label>
              <div class="forensic-person-search-row">
                <Input.Root
                  type="text"
                  class="dos-input"
                  value={personSearchQuery()}
                  onInput={(e) => setPersonSearchQuery(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void searchPersonsForBlood();
                    }
                  }}
                  placeholder="Citizen ID / name / SSN"
                />
                <Button.Root class="btn" onClick={() => void searchPersonsForBlood()} disabled={personSearchLoading()}>
                  [{personSearchLoading() ? 'SEARCHING...' : 'SEARCH PERSON'}]
                </Button.Root>
              </div>

              <Show when={selectedBloodPerson()}>
                {(person) => (
                  <div class="inventory-category" style={{ 'margin-top': '8px' }}>
                    <strong>Selected:</strong> {person().firstName} {person().lastName} ({person().citizenid})
                    <Show when={person().address}>
                      <div>Address: {person().address}</div>
                    </Show>
                    <div style={{ 'margin-top': '6px' }}>
                      <Button.Root class="btn" onClick={() => setSelectedBloodPerson(null)}>
                        [CLEAR SELECTED]
                      </Button.Root>
                    </div>
                  </div>
                )}
              </Show>

              <Show when={personSearchResults().length > 0}>
                <div class="forensic-person-results">
                  <For each={personSearchResults()}>
                    {(person) => (
                      <button
                        class={`forensic-person-result ${selectedBloodPerson()?.citizenid === person.citizenid ? 'selected' : ''}`}
                        onClick={() => selectPersonForBlood(person)}
                      >
                        <span class="name">{person.firstName} {person.lastName}</span>
                        <span class="meta">{person.citizenid}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <div class="form-section">
              <label class="form-label">Citizen ID</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={requestCitizenId()}
                onInput={(e) => {
                  setRequestCitizenId(e.currentTarget.value);
                  setSelectedBloodPerson(null);
                }}
                placeholder="CID00001"
              />
            </div>

            <div class="form-section">
              <label class="form-label">Person Name</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={requestPersonName()}
                onInput={(e) => {
                  setRequestPersonName(e.currentTarget.value);
                  setSelectedBloodPerson(null);
                }}
                placeholder="Full name"
              />
            </div>

            <div class="form-section">
              <label class="form-label">Pickup Location</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={requestLocation()}
                onInput={(e) => setRequestLocation(e.currentTarget.value)}
                placeholder="Hospital / station / scene"
              />
            </div>

            <div class="form-section">
              <label class="form-label">Request Reason</label>
              <textarea
                class="dos-input"
                rows={3}
                value={requestReason()}
                onInput={(e) => setRequestReason(e.currentTarget.value)}
                placeholder="Why is the blood sample required?"
              />
            </div>

            <div class="form-actions">
              <Button.Root class="btn btn-primary" onClick={() => void createBloodRequest()} disabled={isRequestingBlood() || !caseId()}>
                [{isRequestingBlood() ? 'REQUESTING...' : 'REQUEST BLOOD SAMPLE'}]
              </Button.Root>
              <Button.Root class="btn" onClick={() => void loadBloodRequests()}>
                [REFRESH]
              </Button.Root>
            </div>

            <div class="form-section">
              <label class="form-label">Recent Requests</label>
              <For each={bloodRequests()}>
                {(request) => (
                  <div class="inventory-category" style={{ 'margin-bottom': '8px' }}>
                    <div>
                      <strong>{request.requestId}</strong> - {request.personName || 'UNKNOWN'}
                    </div>
                    <div>
                      <span style={{ color: bloodStatusColor(request.status) }}>{request.status}</span>
                      {' '}| Case: {request.caseId || 'UNLINKED'} | {new Date(request.requestedAt).toLocaleString()}
                    </div>
                    <Show when={request.reason}>
                      <div>Reason: {request.reason}</div>
                    </Show>
                    <Show when={request.notes}>
                      <div>Notes: {request.notes}</div>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={bloodRequests().length === 0}>
                <div class="inventory-category">No blood requests yet.</div>
              </Show>
            </div>
          </Show>

          <div class="form-section">
            <label class="form-label">{t('forensics.workflowTitle')}</label>
            <div class="inventory-category">{t('forensics.workflow1')}</div>
            <div class="inventory-category">{t('forensics.workflow2')}</div>
            <div class="inventory-category">{t('forensics.workflow3')}</div>
            <div class="inventory-category">{t('forensics.workflow4')}</div>
          </div>
        </div>
      </div>
    </Modal.Root>
  );
}
