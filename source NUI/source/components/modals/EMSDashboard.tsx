import { createSignal, createMemo, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState } from '~/stores/cadStore';
import { emsState, emsActions, Patient, PatientCondition } from '~/stores/emsStore';
import { notificationActions } from '~/stores/notificationStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Input, Modal, Tabs, Textarea } from '~/components/ui';
import { EmsPatientCard } from './EmsPatientCard';
import { EmsTreatmentCard } from './EmsTreatmentCard';

type BloodSampleStatus = 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';

type BloodSampleRequest = {
  requestId: string;
  caseId?: string;
  citizenId?: string;
  personName: string;
  reason: string;
  location?: string;
  status: BloodSampleStatus;
  requestedBy?: string;
  requestedByName?: string;
  requestedByJob?: string;
  requestedAt: string;
  handledBy?: string;
  handledByName?: string;
  handledAt?: string;
  notes?: string;
  analysisStartedAt?: string;
  analysisStartedAtMs?: number;
  analysisDurationMs?: number;
  analysisEndsAt?: string;
  analysisEndsAtMs?: number;
  analysisCompletedAt?: string;
  analysisCompletedAtMs?: number;
  analysisRemainingMs?: number;
  analysisReady?: boolean;
  evidenceId?: string;
};

export function EMSDashboard() {
  const [activeTab, setActiveTab] = createSignal<'patients' | 'treatment' | 'admit' | 'inventory' | 'blood'>('patients');
  const [selectedPatient, setSelectedPatient] = createSignal<Patient | null>(null);
  const [bloodRequests, setBloodRequests] = createSignal<BloodSampleRequest[]>([]);
  const [bloodLoading, setBloodLoading] = createSignal(false);
  const [bloodUpdateModalOpen, setBloodUpdateModalOpen] = createSignal(false);
  const [pendingBloodUpdate, setPendingBloodUpdate] = createSignal<{
    request: BloodSampleRequest;
    status: BloodSampleStatus;
  } | null>(null);
  const [bloodUpdateNotes, setBloodUpdateNotes] = createSignal('');
  const [nowMs, setNowMs] = createSignal(Date.now());
  const hasActiveBloodAnalysis = createMemo(() =>
    bloodRequests().some((request) => request.status === 'IN_PROGRESS')
  );
  
  const [patientForm, setPatientForm] = createSignal({
    name: '',
    condition: 'STABLE' as PatientCondition,
    chiefComplaint: '',
    symptoms: '',
    bp: '',
    hr: '',
    temp: '',
    o2: '',
    allergies: '',
    medications: ''
  });

  const [patientSearchQuery, setPatientSearchQuery] = createSignal('');
  const [showPoliceCallModal, setShowPoliceCallModal] = createSignal(false);
  const [policeCallReason, setPoliceCallReason] = createSignal('');
  const [policeCallPriority, setPoliceCallPriority] = createSignal<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) {
      return 'N/A';
    }
    return new Date(dateStr).toLocaleString();
  };

  const formatDurationClock = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const readPatientIdFromReader = async () => {
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
        person?: {
          citizenid: string;
          firstName: string;
          lastName: string;
          dateOfBirth: string;
          bloodType?: string;
          allergies?: string;
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

      if (response.documentType === 'VEHICLE') {
        terminalActions.addLine('Reader returned vehicle document. Insert person ID card for EMS intake.', 'error');
        return;
      }

      if (!response.person) {
        terminalActions.addLine('Reader document has no person data', 'error');
        return;
      }

      setPatientForm({
        ...patientForm(),
        name: `${response.person.firstName} ${response.person.lastName}`,
        allergies: response.person.allergies || '',
      });

      terminalActions.addLine(
        `✓ ID read for patient: ${response.person.firstName} ${response.person.lastName} (${response.person.citizenid})`,
        'output'
      );
    } catch (error) {
      terminalActions.addLine(`Failed to read ID: ${error}`, 'error');
    }
  };

  const submitPoliceCall = async () => {
    const reason = policeCallReason().trim();
    if (!reason) {
      terminalActions.addLine('Please provide a reason for the police call', 'error');
      return;
    }

    try {
      const response = await fetchNui<{
        ok: boolean;
        callId?: string;
        error?: string;
      }>('cad:dispatch:createCall', {
        type: 'POLICE_ASSISTANCE',
        priority: policeCallPriority(),
        title: `EMS Request - ${reason.substring(0, 50)}`,
        description: reason,
        location: 'Hospital / EMS Facility',
        requestingUnit: 'EMS',
      });

      if (!response?.ok) {
        terminalActions.addLine(`Failed to call police: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      terminalActions.addLine(
        `✓ Police assistance requested (${response.callId || 'CALL'}) - Priority: ${policeCallPriority()}`,
        'output'
      );
      setShowPoliceCallModal(false);
      setPoliceCallReason('');
      setPoliceCallPriority('MEDIUM');
    } catch (error) {
      terminalActions.addLine(`Failed to call police: ${error}`, 'error');
    }
  };

  const getBloodStatusColor = (status: BloodSampleStatus) => {
    switch (status) {
      case 'PENDING':
        return '#ffaa00';
      case 'ACKNOWLEDGED':
        return '#00ffff';
      case 'IN_PROGRESS':
        return '#00aaff';
      case 'COMPLETED':
        return '#00ff00';
      case 'DECLINED':
      case 'CANCELLED':
        return '#ff5555';
      default:
        return '#c0c0c0';
    }
  };

  const getBloodAnalysisProgress = (request: BloodSampleRequest) => {
    const durationMs = Number(request.analysisDurationMs || 0);
    if (durationMs <= 0) {
      return 0;
    }

    const startedAt = request.analysisStartedAt
      ? new Date(request.analysisStartedAt).getTime()
      : Number(request.analysisStartedAtMs || 0);

    if (!startedAt || Number.isNaN(startedAt)) {
      return 0;
    }

    const elapsed = nowMs() - startedAt;
    const progress = (elapsed / durationMs) * 100;
    return Math.max(0, Math.min(100, Math.floor(progress)));
  };

  const getBloodAnalysisRemainingLabel = (request: BloodSampleRequest) => {
    const explicitRemaining = Number(request.analysisRemainingMs || 0);
    if (explicitRemaining > 0) {
      return formatDurationClock(explicitRemaining);
    }

    const endsAt = request.analysisEndsAt
      ? new Date(request.analysisEndsAt).getTime()
      : Number(request.analysisEndsAtMs || 0);

    if (!endsAt || Number.isNaN(endsAt)) {
      return 'calculating...';
    }

    const remaining = Math.max(0, endsAt - nowMs());
    return formatDurationClock(remaining);
  };

  const loadBloodRequests = async () => {
    // Trae la cola desde backend y la manda a la pantalla.
    setBloodLoading(true);

    try {
      const response = await fetchNui<{ ok: boolean; requests?: BloodSampleRequest[] }>('cad:ems:getBloodRequests', {});
      setBloodRequests(response?.ok && Array.isArray(response.requests) ? response.requests : []);
    } catch (error) {
      terminalActions.addLine(`Failed to load blood requests: ${error}`, 'error');
    } finally {
      setBloodLoading(false);
    }
  };

  const updateBloodRequestStatus = async (
    request: BloodSampleRequest,
    status: BloodSampleStatus,
    notes: string
  ): Promise<boolean> => {
    try {
      const response = await fetchNui<{
        ok: boolean;
        request?: BloodSampleRequest;
        error?: string;
        remainingMs?: number;
      }>('cad:ems:updateBloodRequest', {
        requestId: request.requestId,
        status,
        notes,
      });

      if (!response?.ok || !response.request) {
        if (response?.error === 'analysis_pending' && typeof response.remainingMs === 'number') {
          terminalActions.addLine(
            `Analysis still running (${formatDurationClock(response.remainingMs)} left)`,
            'error'
          );
        } else {
          terminalActions.addLine(`Failed to update request: ${response?.error || 'unknown_error'}`, 'error');
        }
        return false;
      }

      setBloodRequests((prev) => prev.map((item) => (item.requestId === request.requestId ? response.request! : item)));
      terminalActions.addLine(`✓ Blood request ${request.requestId} => ${status}`, 'output');
      return true;
    } catch (error) {
      terminalActions.addLine(`Failed to update request: ${error}`, 'error');
      return false;
    }
  };

  const openBloodUpdateModal = (request: BloodSampleRequest, status: BloodSampleStatus) => {
    setPendingBloodUpdate({ request, status });
    setBloodUpdateNotes(request.notes || '');
    setBloodUpdateModalOpen(true);
  };

  const cancelBloodUpdateModal = () => {
    setBloodUpdateModalOpen(false);
    setPendingBloodUpdate(null);
    setBloodUpdateNotes('');
  };

  const submitBloodUpdateModal = async () => {
    const pending = pendingBloodUpdate();
    if (!pending) {
      return;
    }

    const ok = await updateBloodRequestStatus(
      pending.request,
      pending.status,
      bloodUpdateNotes().trim()
    );
    if (!ok) {
      return;
    }

    cancelBloodUpdateModal();
  };

  onMount(() => {
    void loadBloodRequests();
    const progressTimer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    onCleanup(() => {
      window.clearInterval(progressTimer);
    });
  });

  createEffect(() => {
    const refreshMs = hasActiveBloodAnalysis() ? 3000 : 12000;
    const refreshTimer = window.setInterval(() => {
      void loadBloodRequests();
    }, refreshMs);

    onCleanup(() => {
      window.clearInterval(refreshTimer);
    });
  });

  const getConditionColor = (condition: PatientCondition) => {
    switch (condition) {
      case 'CRITICAL': return '#ff0000';
      case 'SERIOUS': return '#ffaa00';
      case 'STABLE': return '#00ff00';
      case 'DECEASED': return '#808080';
      default: return '#ffffff';
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return '#ff0000'; // critical
      case 2: return '#ffaa00'; // serious
      case 3: return '#00ff00'; // stable
      default: return '#808080';
    }
  };

  const handleAdmitPatient = () => {
    const form = patientForm();
    if (!form.name) {
      terminalActions.addLine('Error: Patient name is required', 'error');
      return;
    }

    const vitals = {
      bp: form.bp || 'N/A',
      hr: form.hr ? parseInt(form.hr) : 75,
      temp: form.temp ? parseFloat(form.temp) : 98.6,
      o2: form.o2 ? parseInt(form.o2) : 98,
    };

    const patient = emsActions.triagePatient({
      name: form.name,
      condition: form.condition,
      chiefComplaint: form.chiefComplaint || 'Unknown',
      symptoms: form.symptoms ? form.symptoms.split(',').map((s: string) => s.trim()) : [],
      vitals,
      allergies: form.allergies ? form.allergies.split(',').map((a: string) => a.trim()) : [],
      currentMedications: form.medications ? form.medications.split(',').map((m: string) => m.trim()) : [],
    });

    if (patient.triagePriority <= 2) {
      notificationActions.notifyCriticalPatient(patient.patientId, patient.name, patient.condition);
    }

    terminalActions.addLine(`✓ Patient admitted: ${patient.patientId} (Priority ${patient.triagePriority})`, 'output');
    
    setPatientForm({
      name: '',
      condition: 'STABLE',
      chiefComplaint: '',
      symptoms: '',
      bp: '',
      hr: '',
      temp: '',
      o2: '',
      allergies: '',
      medications: ''
    });
    setActiveTab('patients');
  };

  const startTreatment = (patient: Patient) => {
    emsActions.startTreatment(patient.patientId);
    setSelectedPatient(null);
    terminalActions.addLine(`✓ Treatment started for: ${patient.name}`, 'output');
  };

  const dischargePatient = (patient: Patient) => {
    emsActions.dischargePatient(patient.patientId, 'HOME', 'Patient discharged in stable condition');
    setSelectedPatient(null);
    terminalActions.addLine(`✓ Patient discharged: ${patient.name}`, 'output');
  };

  const useInventoryItem = (itemId: string) => {
    const result = emsActions.useInventory(itemId, 1, selectedPatient()?.patientId, 'Used in treatment');
    if (!result.success) {
      terminalActions.addLine(`Error: ${result.error}`, 'error');
      return;
    }
    
    const item = emsState.inventory[itemId];
    terminalActions.addLine(`✓ Used 1 ${item.unit} of ${item.name}`, 'output');
    
    if (item.quantity <= item.minStock) {
      notificationActions.notifyLowStock(itemId, item.name, item.quantity);
    }
  };

  const handleHandoff = (patient: Patient) => {
    if (!cadState.currentCase) {
      terminalActions.addLine('No active case. Create or select a case first.', 'error');
      terminalActions.addLine('Use: case create <type> <title>', 'output');
      return;
    }

    emsActions.handoffToCase(patient.patientId, cadState.currentCase.caseId);
    
    terminalActions.addLine(`✓ Medical handoff added to case ${cadState.currentCase.caseId}`, 'output');
    terminalActions.addLine(`  Patient: ${patient.name}`, 'output');
    
    terminalActions.setActiveModal(null);
  };

  const restockItem = (itemId: string) => {
    const amount = prompt(`Enter quantity to add to ${emsState.inventory[itemId]?.name}:`);
    const qty = parseInt(amount || '0');
    if (qty <= 0) return;
    
    emsActions.restockInventory(itemId, qty);
    terminalActions.addLine(`✓ Restocked ${qty} ${emsState.inventory[itemId]?.unit}`, 'output');
  };

  const activePatients = createMemo(() => 
    Object.values(emsState.patients)
      .filter(p => p.status !== 'DISCHARGED' && p.status !== 'TRANSFERRED')
      .sort((a, b) => {
        if (a.triagePriority !== b.triagePriority) {
          return a.triagePriority - b.triagePriority;
        }
        return new Date(a.triagedAt).getTime() - new Date(b.triagedAt).getTime();
      })
  );

  const filteredPatients = createMemo(() => {
    const query = patientSearchQuery().toLowerCase().trim();
    if (!query) return activePatients();
    
    return activePatients().filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.patientId.toLowerCase().includes(query) ||
      p.chiefComplaint.toLowerCase().includes(query)
    );
  });

  const inTreatmentPatients = createMemo(() =>
    Object.values(emsState.patients)
      .filter(p => p.status === 'IN_TREATMENT')
      .sort((a, b) => a.triagePriority - b.triagePriority)
  );

  const inventoryList = createMemo(() => Object.values(emsState.inventory));

  const criticalCount = createMemo(() => 
    Object.values(emsState.patients).filter(p => p.condition === 'CRITICAL' && p.status !== 'DISCHARGED' && p.status !== 'TRANSFERRED').length
  );

  const seriousCount = createMemo(() => 
    Object.values(emsState.patients).filter(p => p.condition === 'SERIOUS' && p.status !== 'DISCHARGED' && p.status !== 'TRANSFERRED').length
  );

  const stableCount = createMemo(() => 
    Object.values(emsState.patients).filter(p => p.condition === 'STABLE' && p.status !== 'DISCHARGED' && p.status !== 'TRANSFERRED').length
  );

  return (
    <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content ems-dashboard" onClick={(e: any) => e.stopPropagation()}>
        <Modal.Header>
          <Modal.Title>=== EMS DASHBOARD ===</Modal.Title>
          <Modal.Close />
        </Modal.Header>

        <div class="triage-stats">
          <div class="stat-item critical">
            <span class="stat-number">{criticalCount()}</span>
            <span class="stat-label">CRITICAL</span>
          </div>
          <div class="stat-item serious">
            <span class="stat-number">{seriousCount()}</span>
            <span class="stat-label">SERIOUS</span>
          </div>
          <div class="stat-item stable">
            <span class="stat-number">{stableCount()}</span>
            <span class="stat-label">STABLE</span>
          </div>
          <div class="stat-item total">
            <span class="stat-number">{activePatients().length}</span>
            <span class="stat-label">TOTAL</span>
          </div>
        </div>

        <Tabs.Root
          value={activeTab()}
          onValueChange={(value) => setActiveTab(value as 'patients' | 'treatment' | 'admit' | 'inventory' | 'blood')}
        >
          <Tabs.List>
            <Tabs.Trigger value='patients' label='PATIENTS' badge={activePatients().length} />
            <Tabs.Trigger value='treatment' label='IN TREATMENT' badge={inTreatmentPatients().length} />
            <Tabs.Trigger value='admit' label='+ ADMIT' />
            <Tabs.Trigger value='inventory' label='INVENTORY' />
            <Tabs.Trigger
              value='blood'
              label='BLOOD REQUESTS'
              badge={bloodRequests().filter(r => r.status !== 'COMPLETED' && r.status !== 'DECLINED' && r.status !== 'CANCELLED').length}
            />
          </Tabs.List>
        </Tabs.Root>

        <Show when={activeTab() === 'patients'}>
          <div class="search-toolbar" style={{ 'margin-bottom': '10px', 'padding': '0 10px' }}>
            <div class="search-input-group">
              <Input.Root
                type="text"
                class="dos-input search-input"
                value={patientSearchQuery()}
                onInput={(e: any) => setPatientSearchQuery(e.currentTarget.value)}
                placeholder="Search patients by name, ID, or complaint..."
              />
              <Button.Root 
                class="btn"
                onClick={() => setShowPoliceCallModal(true)}
                style={{ 'margin-left': 'auto' }}
              >
                [CALL POLICE]
              </Button.Root>
            </div>
            <Show when={patientSearchQuery()}>
              <div class="search-stats">
                {filteredPatients().length} result(s) found
              </div>
            </Show>
          </div>
        </Show>

        <div class="tab-content">
          <Show when={activeTab() === 'patients'}>
            <div class="section-header">
              [ALL ACTIVE PATIENTS - SORTED BY PRIORITY]
            </div>
            <Show when={filteredPatients().length === 0}>
              <div class="empty-state">
                {patientSearchQuery() ? 'No patients match your search' : 'No active patients'}
              </div>
            </Show>
            
            <div class="patients-list">
              <For each={filteredPatients()}>
                {(patient) => (
                  <EmsPatientCard
                    patient={patient}
                    selected={selectedPatient()?.patientId === patient.patientId}
                    getPriorityColor={getPriorityColor}
                    getConditionColor={getConditionColor}
                    formatDate={formatDate}
                    onSelect={setSelectedPatient}
                  />
                )}
              </For>
            </div>
          </Show>

          <Show when={activeTab() === 'treatment'}>
            <div class="section-header">
              [PATIENTS CURRENTLY IN TREATMENT]
            </div>
            <Show when={inTreatmentPatients().length === 0}>
              <div class="empty-state">No patients in treatment</div>
            </Show>
            
            <For each={inTreatmentPatients()}>
              {(patient) => (
                <EmsTreatmentCard
                  patient={patient}
                  getConditionColor={getConditionColor}
                  formatDate={formatDate}
                  onDischarge={dischargePatient}
                />
              )}
            </For>
          </Show>

          <Show when={activeTab() === 'admit'}>
            <div class="admit-form">
              <h3>[PATIENT ADMISSION FORM]</h3>
              
              <div class="form-section">
                <label>Patient Name *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input.Root
                    type="text"
                    class="dos-input"
                    style={{ flex: 1 }}
                    placeholder="Enter full name..."
                    value={patientForm().name}
                    onInput={(e: any) => setPatientForm({ ...patientForm(), name: e.currentTarget.value })}
                  />
                  <Button.Root 
                    class="btn"
                    onClick={() => void readPatientIdFromReader()}
                    title="Read ID from card reader"
                  >
                    [READ ID]
                  </Button.Root>
                </div>
              </div>

              <div class="form-section">
                <label>Condition Level *</label>
                <div class="condition-selector">
                  <button
                    class={`condition-btn critical ${patientForm().condition === 'CRITICAL' ? 'selected' : ''}`}
                    onClick={() => setPatientForm({ ...patientForm(), condition: 'CRITICAL' })}
                  >
                    CRITICAL
                  </button>
                  <button
                    class={`condition-btn serious ${patientForm().condition === 'SERIOUS' ? 'selected' : ''}`}
                    onClick={() => setPatientForm({ ...patientForm(), condition: 'SERIOUS' })}
                  >
                    SERIOUS
                  </button>
                  <button
                    class={`condition-btn stable ${patientForm().condition === 'STABLE' ? 'selected' : ''}`}
                    onClick={() => setPatientForm({ ...patientForm(), condition: 'STABLE' })}
                  >
                    STABLE
                  </button>
                </div>
              </div>

              <div class="form-section">
                <label>Chief Complaint *</label>
                <Input.Root
                  type="text"
                  class="dos-input"
                  placeholder="Main reason for visit (e.g., chest pain, trauma)..."
                  value={patientForm().chiefComplaint}
                  onInput={(e: any) => setPatientForm({ ...patientForm(), chiefComplaint: e.currentTarget.value })}
                />
              </div>

              <div class="form-section">
                <label>Symptoms (comma-separated)</label>
                <Input.Root
                  type="text"
                  class="dos-input"
                  placeholder="e.g., chest pain, dizziness, nausea"
                  value={patientForm().symptoms}
                  onInput={(e: any) => setPatientForm({ ...patientForm(), symptoms: e.currentTarget.value })}
                />
              </div>

              <div class="form-section">
                <label>Vital Signs</label>
                <div class="vitals-inputs">
                  <Input.Root
                    type="text"
                    class="dos-input"
                    placeholder="BP (e.g., 120/80)"
                    value={patientForm().bp}
                    onInput={(e: any) => setPatientForm({ ...patientForm(), bp: e.currentTarget.value })}
                  />
                  <Input.Root
                    type="text"
                    class="dos-input"
                    placeholder="HR (e.g., 75)"
                    value={patientForm().hr}
                    onInput={(e: any) => setPatientForm({ ...patientForm(), hr: e.currentTarget.value })}
                  />
                  <Input.Root
                    type="text"
                    class="dos-input"
                    placeholder="Temp (e.g., 98.6)"
                    value={patientForm().temp}
                    onInput={(e: any) => setPatientForm({ ...patientForm(), temp: e.currentTarget.value })}
                  />
                  <Input.Root
                    type="text"
                    class="dos-input"
                    placeholder="O2% (e.g., 98)"
                    value={patientForm().o2}
                    onInput={(e: any) => setPatientForm({ ...patientForm(), o2: e.currentTarget.value })}
                  />
                </div>
              </div>

              <div class="form-section">
                <label>Allergies (comma-separated)</label>
                <Input.Root
                  type="text"
                  class="dos-input"
                  placeholder="e.g., penicillin, latex"
                  value={patientForm().allergies}
                  onInput={(e: any) => setPatientForm({ ...patientForm(), allergies: e.currentTarget.value })}
                />
              </div>

              <div class="form-section">
                <label>Current Medications</label>
                <Input.Root
                  type="text"
                  class="dos-input"
                  placeholder="List current medications..."
                  value={patientForm().medications}
                  onInput={(e: any) => setPatientForm({ ...patientForm(), medications: e.currentTarget.value })}
                />
              </div>

              <div class="form-actions">
                <Button.Root class="btn btn-primary" onClick={handleAdmitPatient}>
                  [ADMIT PATIENT]
                </Button.Root>
                <Button.Root 
                  class="btn"
                  onClick={() => setActiveTab('patients')}
                >
                  [CANCEL]
                </Button.Root>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'inventory'}>
            <div class="section-header">
              [MEDICAL SUPPLIES INVENTORY]
            </div>
            
            <div class="inventory-list">
              <For each={inventoryList()}>
                {(item) => (
                  <div class={`inventory-item ${item.quantity <= item.minStock ? 'low-stock' : ''}`}>
                    <div class="inventory-header">
                      <span class="item-name">{item.name}</span>
                      <span class={`item-stock ${item.quantity <= item.minStock ? 'low' : ''}`}>
                        {item.quantity} {item.unit} {item.quantity <= item.minStock ? '⚠️ LOW' : ''}
                      </span>
                    </div>
                    <div class="inventory-category">{item.category} • Used today: {item.usedToday}</div>
                    <div class="inventory-actions">
                      <Button.Root 
                        class="btn-small"
                        onClick={() => useInventoryItem(item.itemId)}
                        disabled={item.quantity <= 0}
                      >
                        [USE]
                      </Button.Root>
                      <Button.Root 
                        class="btn-small btn-primary"
                        onClick={() => restockItem(item.itemId)}
                      >
                        [RESTOCK]
                      </Button.Root>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={activeTab() === 'blood'}>
            <div class="section-header">[POLICE BLOOD SAMPLE REQUESTS]</div>

            <Show when={bloodLoading()}>
              <div class="empty-state">Loading blood requests...</div>
            </Show>

            <Show when={!bloodLoading() && bloodRequests().length === 0}>
              <div class="empty-state">No blood sample requests pending</div>
            </Show>

            <div class="inventory-list">
              <For each={bloodRequests()}>
                {(request) => (
                  <div class="inventory-item">
                    <div class="inventory-header">
                      <span class="item-name">{request.personName} ({request.citizenId || 'UNKNOWN'})</span>
                      <span class="item-stock" style={{ color: getBloodStatusColor(request.status) }}>
                        {request.status}
                      </span>
                    </div>
                    <div class="inventory-category">
                      Request: {request.requestId} {request.caseId ? `| Case: ${request.caseId}` : '| Case: AUTO/UNKNOWN'}
                    </div>
                    <div class="inventory-category">
                      By: {request.requestedByName || request.requestedBy || 'Unknown'} | {formatDateTime(request.requestedAt)}
                    </div>
                    <Show when={request.reason}>
                      <div class="inventory-category">Reason: {request.reason}</div>
                    </Show>
                    <Show when={request.notes}>
                      <div class="inventory-category">Notes: {request.notes}</div>
                    </Show>
                    <Show when={request.status === 'IN_PROGRESS'}>
                      <div class="inventory-category" style={{ 'margin-top': '6px' }}>
                        Analysis progress: {getBloodAnalysisProgress(request)}%
                        <Show when={!request.analysisReady}>
                          {' '}
                          | ETA: {getBloodAnalysisRemainingLabel(request)}
                        </Show>
                        <Show when={request.analysisReady}>
                          {' '}
                          | READY TO SEND
                        </Show>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '8px',
                          background: '#1a1a1a',
                          border: '1px solid #3a3a3a',
                          'margin-top': '4px',
                          'border-radius': '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${getBloodAnalysisProgress(request)}%`,
                            height: '100%',
                            background: request.analysisReady ? '#00ff00' : '#00aaff',
                            transition: 'width 300ms linear',
                          }}
                        />
                      </div>
                    </Show>
                    <div class="inventory-actions">
                      <Show when={request.status === 'PENDING'}>
                        <Button.Root class="btn-small" onClick={() => openBloodUpdateModal(request, 'ACKNOWLEDGED')}>
                          [ACK]
                        </Button.Root>
                      </Show>
                      <Show when={request.status === 'PENDING' || request.status === 'ACKNOWLEDGED'}>
                        <Button.Root class="btn-small" onClick={() => openBloodUpdateModal(request, 'IN_PROGRESS')}>
                          [START ANALYSIS]
                        </Button.Root>
                      </Show>
                      <Show when={request.status === 'IN_PROGRESS' && request.analysisReady}>
                        <Button.Root class="btn-small btn-primary" onClick={() => openBloodUpdateModal(request, 'COMPLETED')}>
                          [SEND TO POLICE]
                        </Button.Root>
                      </Show>
                      <Show when={request.status === 'PENDING' || request.status === 'ACKNOWLEDGED' || request.status === 'IN_PROGRESS'}>
                        <Button.Root class="btn-small" onClick={() => openBloodUpdateModal(request, 'DECLINED')}>
                          [DECLINE]
                        </Button.Root>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={bloodUpdateModalOpen() && pendingBloodUpdate()}>
                    <Modal.Root onClose={cancelBloodUpdateModal} useContentWrapper={false}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <h3>=== BLOOD REQUEST UPDATE ===</h3>
                <button class="modal-close" onClick={cancelBloodUpdateModal}>[X]</button>
              </div>
              <div class="modal-body">
                <p>
                  Request: <strong>{pendingBloodUpdate()!.request.requestId}</strong>
                </p>
                <p>
                  New status: <strong>{pendingBloodUpdate()!.status}</strong>
                </p>
                <div class="form-group">
                  <label>Update notes (optional):</label>
                  <Textarea.Root
                    class="dos-textarea"
                    rows={3}
                    value={bloodUpdateNotes()}
                    onInput={(e) => setBloodUpdateNotes(e.currentTarget.value)}
                    placeholder="Add handling notes..."
                  />
                </div>
              </div>
              <div class="modal-footer">
                <Button.Root class="btn" onClick={cancelBloodUpdateModal}>[CANCEL]</Button.Root>
                <Button.Root class="btn btn-primary" onClick={() => void submitBloodUpdateModal()}>
                  [APPLY UPDATE]
                </Button.Root>
              </div>
            </div>
          </Modal.Root>
        </Show>

        <Show when={showPoliceCallModal()}>
                    <Modal.Root onClose={() => setShowPoliceCallModal(false)} useContentWrapper={false}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <h3>=== REQUEST POLICE ASSISTANCE ===</h3>
                <button class="modal-close" onClick={() => setShowPoliceCallModal(false)}>[X]</button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label>Priority:</label>
                  <div class="condition-selector">
                    <button
                      class={`condition-btn ${policeCallPriority() === 'LOW' ? 'selected' : ''}`}
                      onClick={() => setPoliceCallPriority('LOW')}
                      style={{ color: policeCallPriority() === 'LOW' ? '#00ff00' : undefined }}
                    >
                      LOW
                    </button>
                    <button
                      class={`condition-btn ${policeCallPriority() === 'MEDIUM' ? 'selected' : ''}`}
                      onClick={() => setPoliceCallPriority('MEDIUM')}
                      style={{ color: policeCallPriority() === 'MEDIUM' ? '#ffaa00' : undefined }}
                    >
                      MEDIUM
                    </button>
                    <button
                      class={`condition-btn ${policeCallPriority() === 'HIGH' ? 'selected' : ''}`}
                      onClick={() => setPoliceCallPriority('HIGH')}
                      style={{ color: policeCallPriority() === 'HIGH' ? '#ff0000' : undefined }}
                    >
                      HIGH
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Reason for assistance:</label>
                  <Textarea.Root
                    class="dos-textarea"
                    rows={4}
                    value={policeCallReason()}
                    onInput={(e) => setPoliceCallReason(e.currentTarget.value)}
                    placeholder="Describe the situation requiring police assistance..."
                  />
                </div>
              </div>
              <div class="modal-footer">
                <Button.Root class="btn" onClick={() => setShowPoliceCallModal(false)}>[CANCEL]</Button.Root>
                <Button.Root class="btn btn-primary" onClick={() => void submitPoliceCall()}>
                  [CALL POLICE]
                </Button.Root>
              </div>
            </div>
          </Modal.Root>
        </Show>

        <Show when={selectedPatient() && activeTab() !== 'admit'}>
          <div class="patient-detail-overlay" onClick={() => setSelectedPatient(null)}>
            <div class="patient-detail-panel" onClick={(e: any) => e.stopPropagation()}>
              <div class="patient-detail-header">
                <h3>{selectedPatient()!.name}</h3>
                <span 
                  class="condition-badge"
                  style={{ color: getConditionColor(selectedPatient()!.condition) }}
                >
                  P{selectedPatient()!.triagePriority} - {selectedPatient()!.condition}
                </span>
              </div>
              
              <div class="patient-detail-content">
                <div class="detail-section">
                  <h4>[VITALS]</h4>
                  <div class="vitals-grid">
                    <div class="vital-item">
                      <label>BP:</label>
                      <span>{selectedPatient()!.vitals.bp}</span>
                    </div>
                    <div class="vital-item">
                      <label>HR:</label>
                      <span>{selectedPatient()!.vitals.hr} bpm</span>
                    </div>
                    <div class="vital-item">
                      <label>Temp:</label>
                      <span>{selectedPatient()!.vitals.temp}°F</span>
                    </div>
                    <div class="vital-item">
                      <label>O2:</label>
                      <span>{selectedPatient()!.vitals.o2}%</span>
                    </div>
                  </div>
                </div>

                <div class="detail-section">
                  <h4>[CHIEF COMPLAINT]</h4>
                  <p>{selectedPatient()!.chiefComplaint}</p>
                </div>

                <div class="detail-section">
                  <h4>[SYMPTOMS]</h4>
                  <Show when={selectedPatient()!.symptoms.length > 0}>
                    <div class="symptoms-list">
                      <For each={selectedPatient()!.symptoms}>
                        {(symptom) => (
                          <span class="symptom-tag">{symptom}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                <div class="detail-section">
                  <h4>[MEDICAL HISTORY]</h4>
                  <div class="medical-info">
                    <p><strong>Allergies:</strong> {selectedPatient()!.allergies.join(', ') || 'None'}</p>
                    <p><strong>Medications:</strong> {selectedPatient()!.currentMedications.join(', ') || 'None'}</p>
                  </div>
                </div>

                <div class="detail-section">
                  <h4>[TREATMENT LOG]</h4>
                  <Show when={selectedPatient()!.treatments.length === 0}>
                    <p class="text-muted">No treatments recorded</p>
                  </Show>
                  <For each={selectedPatient()!.treatments}>
                    {(treatment) => (
                      <div class="treatment-log-item">
                        <div class="treatment-time">{formatDate(treatment.timestamp)}</div>
                        <div class="treatment-action">{treatment.action}</div>
                        <div class="treatment-meds">{treatment.medications.join(', ')}</div>
                        <div class="treatment-notes">{treatment.notes}</div>
                      </div>
                    )}
                  </For>
                </div>

                <div class="detail-section">
                  <h4>[ADMISSION INFO]</h4>
                  <p>ID: {selectedPatient()!.patientId}</p>
                  <p>Triaged: {formatDate(selectedPatient()!.triagedAt)}</p>
                  <p>By: {selectedPatient()!.triagedBy}</p>
                  <p>Status: {selectedPatient()!.status}</p>
                  <Show when={selectedPatient()!.caseId}>
                    <p>Linked Case: {selectedPatient()!.caseId}</p>
                  </Show>
                </div>
              </div>

              <div class="patient-detail-actions">
                <Button.Root 
                  class="btn btn-primary"
                  onClick={() => handleHandoff(selectedPatient()!)}
                  title="Send medical report to active case"
                >
                  [HANDOFF TO CASE]
                </Button.Root>
                
                <Show when={selectedPatient()!.status === 'TRIAGE' || selectedPatient()!.status === 'ADMITTED'}>
                  <Button.Root 
                    class="btn"
                    onClick={() => startTreatment(selectedPatient()!)}
                  >
                    [START TREATMENT]
                  </Button.Root>
                </Show>
                <Show when={selectedPatient()!.status === 'IN_TREATMENT'}>
                  <Button.Root 
                    class="btn btn-success"
                    onClick={() => dischargePatient(selectedPatient()!)}
                  >
                    [DISCHARGE PATIENT]
                  </Button.Root>
                </Show>
                <Button.Root 
                  class="btn"
                  onClick={() => setSelectedPatient(null)}
                >
                  [CLOSE]
                </Button.Root>
              </div>
            </div>
          </div>
        </Show>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            EMS Dashboard v2.0 | {Object.keys(emsState.units).length} Units Available
          </span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
