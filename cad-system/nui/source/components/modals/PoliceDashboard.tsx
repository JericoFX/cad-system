import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type CriminalRecord, type Warrant, type Vehicle, type Evidence } from '~/stores/cadStore';

export function PoliceDashboard() {
  const [activeTab, setActiveTab] = createSignal<'arrests' | 'warrants' | 'impounds' | 'evidence' | 'create'>('arrests');
   
  const [arrestForm, setArrestForm] = createSignal({
    citizenId: '',
    personName: '',
    charges: '',
    sentence: '',
    fine: '',
    jailTime: ''
  });
   
  const [warrantForm, setWarrantForm] = createSignal({
    citizenId: '',
    personName: '',
    type: 'ARREST' as 'ARREST' | 'SEARCH',
    reason: '',
    expiresDays: '30'
  });
   
  const [impoundForm, setImpoundForm] = createSignal({
    plate: '',
    reason: '',
    duration: '0'
  });

  const [evidenceForm, setEvidenceForm] = createSignal({
    caseId: '',
    evidenceType: 'PHOTO_URL' as Evidence['evidenceType'],
    url: '',
    description: ''
  });

  onMount(() => {
    const modalData = (terminalState.modalData as {
      create?: string;
      citizenId?: string;
      personName?: string;
      reason?: string;
    } | null) || null;

    if (!modalData || modalData.create !== 'warrant') {
      return;
    }

    setActiveTab('create');
    setWarrantForm({
      ...warrantForm(),
      citizenId: modalData.citizenId || warrantForm().citizenId,
      personName: modalData.personName || warrantForm().personName,
      reason: modalData.reason || warrantForm().reason,
    });
  });

  const recentArrests = createMemo(() => 
    (Object.values(cadState.criminalRecords) as CriminalRecord[])
      .filter(r => !r.cleared)
      .sort((a, b) => new Date(b.arrestedAt).getTime() - new Date(a.arrestedAt).getTime())
      .slice(0, 10)
  );

  const availableCases = createMemo(() => 
    Object.values(cadState.cases)
      .filter(c => c.status === 'OPEN')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  
  const activeWarrants = createMemo(() => 
    (Object.values(cadState.warrants) as Warrant[])
      .filter(w => w.active && !w.executed)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
  );
  
  const impoundedVehicles = createMemo(() => 
    (Object.values(cadState.vehicles) as Vehicle[])
      .filter(v => v.flags?.some(f => f === 'IMPOUNDED'))
  );

  const caseEvidence = createMemo(() => {
    const caseId = evidenceForm().caseId;
    if (!caseId || !cadState.cases[caseId]) return [];
    return (cadState.cases[caseId].evidence || []) as Evidence[];
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getEvidenceUrl = (evidence: Evidence): string | undefined => {
    const maybeUrl = evidence.data?.url;
    return typeof maybeUrl === 'string' ? maybeUrl : undefined;
  };

  const getEvidenceDescription = (evidence: Evidence): string => {
    const maybeDescription = evidence.data?.description;
    return typeof maybeDescription === 'string' ? maybeDescription : '';
  };

  const handleCreateArrest = () => {
    const form = arrestForm();
    if (!form.citizenId || !form.personName || !form.charges) {
      terminalActions.addLine('Error: Please fill all required fields', 'error');
      return;
    }

    const arrestData = {
      recordId: `ARR_${Date.now()}`,
      citizenid: form.citizenId,
      personName: form.personName,
      charges: form.charges.split(',').map((c: string) => c.trim()),
      description: form.charges,
      sentence: form.sentence || 'N/A',
      fine: parseFloat(form.fine) || 0,
      jailTime: parseInt(form.jailTime) || 0,
      convicted: false,
      arrestingOfficer: 'OFFICER_001',
      arrestingOfficerName: 'Officer',
      arrestedAt: new Date().toISOString(),
      notes: '',
      cleared: false
    };

    cadActions.addCriminalRecord(arrestData);
    terminalActions.addLine(`✓ Arrest registered: ${arrestData.recordId}`, 'output');
    setArrestForm({ citizenId: '', personName: '', charges: '', sentence: '', fine: '', jailTime: '' });
    setActiveTab('arrests');
  };

  const handleCreateWarrant = () => {
    const form = warrantForm();
    if (!form.citizenId || !form.personName || !form.reason) {
      terminalActions.addLine('Error: Please fill all required fields', 'error');
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parseInt(form.expiresDays) || 30));

    const warrantData = {
      warrantId: `WAR_${Date.now()}`,
      citizenid: form.citizenId,
      personName: form.personName,
      type: form.type,
      reason: form.reason,
      issuedBy: 'OFFICER_001',
      issuedByName: 'Officer',
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      active: true,
      executed: false
    };

    cadActions.addWarrant(warrantData);
    terminalActions.addLine(`✓ Warrant issued: ${warrantData.warrantId}`, 'output');
    setWarrantForm({ citizenId: '', personName: '', type: 'ARREST', reason: '', expiresDays: '30' });
    setActiveTab('warrants');
  };

  const handleImpoundVehicle = () => {
    const form = impoundForm();
    if (!form.plate || !form.reason) {
      terminalActions.addLine('Error: Please fill all required fields', 'error');
      return;
    }

    const vehicle = cadState.vehicles[form.plate.toUpperCase()];
    if (!vehicle) {
      terminalActions.addLine(`Error: Vehicle ${form.plate} not found`, 'error');
      return;
    }

    cadActions.updateVehicle(vehicle.plate, {
      registrationStatus: 'SUSPENDED',
      flags: [...(vehicle.flags || []), 'IMPOUNDED', `IMPOUND_REASON:${form.reason}`]
    });

    terminalActions.addLine(`✓ Vehicle impounded: ${vehicle.plate}`, 'output');
    setImpoundForm({ plate: '', reason: '', duration: '0' });
    setActiveTab('impounds');
  };

  const cancelWarrant = (warrantId: string) => {
    cadActions.updateWarrant(warrantId, {
      active: false,
      clearedBy: 'OFFICER_001',
      clearedAt: new Date().toISOString()
    });
    terminalActions.addLine(`✓ Warrant cancelled: ${warrantId}`, 'output');
  };

  const releaseVehicle = (plate: string) => {
    const vehicle = cadState.vehicles[plate];
    if (!vehicle) return;

    const newFlags = (vehicle.flags || []).filter((f: string) => 
      !f.startsWith('IMPOUNDED') && !f.startsWith('IMPOUND_REASON')
    );

    cadActions.updateVehicle(plate, {
      registrationStatus: 'VALID',
      flags: newFlags
    });
    terminalActions.addLine(`✓ Vehicle released: ${plate}`, 'output');
  };

  const handleAddEvidence = () => {
    const form = evidenceForm();
    if (!form.caseId || !form.url) {
      terminalActions.addLine('Error: Case ID and URL are required', 'error');
      return;
    }

    if (!form.url.startsWith('http://') && !form.url.startsWith('https://')) {
      terminalActions.addLine('Error: URL must start with http:// or https://', 'error');
      return;
    }

    const evidenceData: Evidence = {
      evidenceId: `EVI_${Date.now()}`,
      caseId: form.caseId,
      evidenceType: form.evidenceType,
      data: {
        url: form.url,
        description: form.description || 'Added via Police Dashboard',
        source: 'dashboard'
      },
      attachedBy: 'OFFICER_001',
      attachedAt: new Date().toISOString(),
      custodyChain: []
    };

    cadActions.addCaseEvidence(form.caseId, evidenceData);
    terminalActions.addLine(`✓ Evidence added: ${evidenceData.evidenceId}`, 'output');
    setEvidenceForm({ caseId: form.caseId, evidenceType: 'PHOTO_URL', url: '', description: '' });
  };

  return (
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content police-dashboard" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== POLICE DASHBOARD ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="detail-tabs">
          <button 
            class={`tab ${activeTab() === 'arrests' ? 'active' : ''}`}
            onClick={() => setActiveTab('arrests')}
          >
            [ARRESTS ({recentArrests().length})]
          </button>
          <button 
            class={`tab ${activeTab() === 'warrants' ? 'active' : ''}`}
            onClick={() => setActiveTab('warrants')}
          >
            [WARRANTS ({activeWarrants().length})]
          </button>
          <button 
            class={`tab ${activeTab() === 'impounds' ? 'active' : ''}`}
            onClick={() => setActiveTab('impounds')}
          >
            [IMPOUNDS ({impoundedVehicles().length})]
          </button>
          <button 
            class={`tab ${activeTab() === 'evidence' ? 'active' : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            [EVIDENCE]
          </button>
          <button 
            class={`tab ${activeTab() === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            [+ NEW]
          </button>
        </div>

        <div class="tab-content">
          <Show when={activeTab() === 'arrests'}>
            <div class="section-header">
              [RECENT ARRESTS]
            </div>
            <Show when={recentArrests().length === 0}>
              <div class="empty-state">No recent arrests</div>
            </Show>
            <For each={recentArrests()}>
              {(record) => (
                <div class="record-item">
                  <div class="record-header">
                    <span class="record-id">{record.recordId}</span>
                    <span class="record-date">{formatDate(record.arrestedAt)}</span>
                  </div>
                  <div class="record-person">{record.personName} ({record.citizenid})</div>
                  <div class="record-charges">{record.charges.join(', ')}</div>
                  <Show when={record.jailTime > 0}>
                    <div class="record-sentence">
                      Sentence: {record.sentence} | Jail: {record.jailTime}min | Fine: ${record.fine}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'warrants'}>
            <div class="section-header">
              [ACTIVE WARRANTS]
            </div>
            <Show when={activeWarrants().length === 0}>
              <div class="empty-state">No active warrants</div>
            </Show>
            <For each={activeWarrants()}>
              {(warrant) => (
                <div class="warrant-item active">
                  <div class="warrant-header">
                    <span class={`warrant-type ${warrant.type.toLowerCase()}`}>{warrant.type}</span>
                    <span class="warrant-id">{warrant.warrantId}</span>
                  </div>
                  <div class="warrant-person">{warrant.personName} ({warrant.citizenid})</div>
                  <div class="warrant-reason">{warrant.reason}</div>
                  <div class="warrant-meta">
                    <span>Expires: {formatDate(warrant.expiresAt || '')}</span>
                    <button 
                      class="btn-small btn-danger"
                      onClick={() => cancelWarrant(warrant.warrantId)}
                    >
                      [CANCEL]
                    </button>
                  </div>
                </div>
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'impounds'}>
            <div class="section-header">
              [IMPOUNDED VEHICLES]
            </div>
            <Show when={impoundedVehicles().length === 0}>
              <div class="empty-state">No impounded vehicles</div>
            </Show>
            <For each={impoundedVehicles()}>
              {(vehicle) => (
                <div class="vehicle-item">
                  <div class="vehicle-header">
                    <span class="vehicle-plate">{vehicle.plate}</span>
                    <span class="vehicle-status impounded">[IMPOUNDED]</span>
                  </div>
                  <div class="vehicle-info">
                    {vehicle.year} {vehicle.make} {vehicle.model} - {vehicle.color}
                  </div>
                  <div class="vehicle-owner">Owner: {vehicle.ownerName}</div>
                  <button 
                    class="btn-small btn-primary"
                    onClick={() => releaseVehicle(vehicle.plate)}
                  >
                    [RELEASE]
                  </button>
                </div>
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'evidence'}>
            <div class="section-header">
              [CASE EVIDENCE MANAGEMENT]
            </div>
            
            <div class="evidence-form-section">
              <h4>[ADD EVIDENCE TO CASE]</h4>
              <select
                class="dos-input"
                value={evidenceForm().caseId}
                onChange={(e: any) => setEvidenceForm({ ...evidenceForm(), caseId: e.currentTarget.value })}
              >
                <option value="">Select a case...</option>
                <For each={availableCases()}>
                  {(caseItem) => (
                    <option value={caseItem.caseId}>
                      {caseItem.caseId} - {caseItem.title} [{caseItem.status}]
                    </option>
                  )}
                </For>
              </select>
              <select
                class="dos-input"
                value={evidenceForm().evidenceType}
                onChange={(e: any) => setEvidenceForm({ ...evidenceForm(), evidenceType: e.currentTarget.value })}
              >
                <option value="PHOTO_URL">PHOTO</option>
                <option value="VIDEO_URL">VIDEO</option>
                <option value="DOCUMENT">DOCUMENT</option>
                <option value="PHYSICAL">PHYSICAL ITEM</option>
                <option value="DIGITAL">DIGITAL FILE</option>
              </select>
              <input
                type="text"
                class="dos-input"
                placeholder="Evidence URL (http://...)"
                value={evidenceForm().url}
                onInput={(e: any) => setEvidenceForm({ ...evidenceForm(), url: e.currentTarget.value })}
              />
              <input
                type="text"
                class="dos-input"
                placeholder="Description"
                value={evidenceForm().description}
                onInput={(e: any) => setEvidenceForm({ ...evidenceForm(), description: e.currentTarget.value })}
              />
              <button class="btn btn-primary" onClick={handleAddEvidence}>
                [ADD EVIDENCE]
              </button>
            </div>

            <Show when={evidenceForm().caseId && caseEvidence().length > 0}>
              <div class="section-header">
                [EVIDENCE FOR CASE: {evidenceForm().caseId}]
              </div>
              <For each={caseEvidence()}>
                {(evidence) => (
                  <div class="evidence-item">
                    <div class="evidence-header">
                      <span class="evidence-type">[{evidence.evidenceType}]</span>
                      <span class="evidence-id">{evidence.evidenceId}</span>
                    </div>
                    <div class="evidence-url">
                      <Show
                        when={getEvidenceUrl(evidence)}
                        fallback={<span>N/A</span>}
                      >
                        {(url) => (
                          <a href={url()} target="_blank" rel="noopener noreferrer">
                            {url().substring(0, 50)}...
                          </a>
                        )}
                      </Show>
                    </div>
                    <div class="evidence-desc">{getEvidenceDescription(evidence)}</div>
                    <div class="evidence-meta">
                      Added: {formatDate(evidence.attachedAt)} by {evidence.attachedBy}
                    </div>
                  </div>
                )}
              </For>
            </Show>

            <Show when={evidenceForm().caseId && caseEvidence().length === 0}>
              <div class="empty-state">No evidence found for this case</div>
            </Show>
          </Show>

          <Show when={activeTab() === 'create'}>
            <div class="create-sections">
              <div class="create-form">
                <h3>[REGISTER ARREST]</h3>
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Citizen ID"
                  value={arrestForm().citizenId}
                  onInput={(e) => setArrestForm({ ...arrestForm(), citizenId: e.currentTarget.value })}
                />
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Person Name"
                  value={arrestForm().personName}
                  onInput={(e) => setArrestForm({ ...arrestForm(), personName: e.currentTarget.value })}
                />
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Charges (comma-separated)"
                  value={arrestForm().charges}
                  onInput={(e) => setArrestForm({ ...arrestForm(), charges: e.currentTarget.value })}
                />
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Sentence (e.g., 5 years)"
                  value={arrestForm().sentence}
                  onInput={(e) => setArrestForm({ ...arrestForm(), sentence: e.currentTarget.value })}
                />
                <div class="form-row">
                  <input
                    type="number"
                    class="dos-input"
                    placeholder="Fine $"
                    value={arrestForm().fine}
                    onInput={(e) => setArrestForm({ ...arrestForm(), fine: e.currentTarget.value })}
                  />
                  <input
                    type="number"
                    class="dos-input"
                    placeholder="Jail (months)"
                    value={arrestForm().jailTime}
                    onInput={(e) => setArrestForm({ ...arrestForm(), jailTime: e.currentTarget.value })}
                  />
                </div>
                <button class="btn btn-primary" onClick={handleCreateArrest}>
                  [REGISTER ARREST]
                </button>
              </div>

              <div class="create-form">
                <h3>[ISSUE WARRANT]</h3>
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Citizen ID"
                  value={warrantForm().citizenId}
                  onInput={(e) => setWarrantForm({ ...warrantForm(), citizenId: e.currentTarget.value })}
                />
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Person Name"
                  value={warrantForm().personName}
                  onInput={(e) => setWarrantForm({ ...warrantForm(), personName: e.currentTarget.value })}
                />
                <select
                  class="dos-input"
                  value={warrantForm().type}
                  onChange={(e) => setWarrantForm({ ...warrantForm(), type: e.currentTarget.value as 'ARREST' | 'SEARCH' })}
                >
                  <option value="ARREST">ARREST WARRANT</option>
                  <option value="SEARCH">SEARCH WARRANT</option>
                </select>
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Reason"
                  value={warrantForm().reason}
                  onInput={(e) => setWarrantForm({ ...warrantForm(), reason: e.currentTarget.value })}
                />
                <input
                  type="number"
                  class="dos-input"
                  placeholder="Expires (days)"
                  value={warrantForm().expiresDays}
                  onInput={(e) => setWarrantForm({ ...warrantForm(), expiresDays: e.currentTarget.value })}
                />
                <button class="btn btn-primary" onClick={handleCreateWarrant}>
                  [ISSUE WARRANT]
                </button>
              </div>

              <div class="create-form">
                <h3>[IMPOUND VEHICLE]</h3>
                <input
                  type="text"
                  class="dos-input"
                  placeholder="License Plate"
                  value={impoundForm().plate}
                  onInput={(e) => setImpoundForm({ ...impoundForm(), plate: e.currentTarget.value })}
                />
                <input
                  type="text"
                  class="dos-input"
                  placeholder="Impound Reason"
                  value={impoundForm().reason}
                  onInput={(e) => setImpoundForm({ ...impoundForm(), reason: e.currentTarget.value })}
                />
                <input
                  type="number"
                  class="dos-input"
                  placeholder="Duration (days, 0 = indefinite)"
                  value={impoundForm().duration}
                  onInput={(e) => setImpoundForm({ ...impoundForm(), duration: e.currentTarget.value })}
                />
                <button class="btn btn-primary" onClick={handleImpoundVehicle}>
                  [IMPOUND VEHICLE]
                </button>
              </div>
            </div>
          </Show>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            Police Dashboard v1.0
          </span>
          <button class="btn" onClick={closeModal}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
