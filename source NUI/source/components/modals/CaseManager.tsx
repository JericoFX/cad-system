import { createSignal, createMemo, createEffect, createSelector, For, Show } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type Case, type Note, type Evidence } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { viewerActions } from '~/stores/viewerStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Input, Modal, Select, Tabs, Text, Textarea, getPriorityColor } from '~/components/ui';
import { formatDate as formatDateUtil } from '~/utils/storeHelpers/dateHelpers';

type CaseApiError = {
  ok: false;
  error: string;
};

const isCaseApiError = (value: unknown): value is CaseApiError => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return row.ok === false && typeof row.error === 'string';
};

export function CaseManager() {
  const [activeTab, setActiveTab] = createSignal<'list' | 'detail' | 'notes' | 'evidence' | 'tasks'>('list');
  const [selectedCase, setSelectedCase] = createSignal<Case | null>(null);
  const [selectedCaseId, setSelectedCaseId] = createSignal<string | null>(null);
  const isCaseSelected = createSelector(selectedCaseId);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<string>('all');
  const [typeFilter, setTypeFilter] = createSignal<string>('all');
  const [priorityFilter, setPriorityFilter] = createSignal<string>('all');
  const [showCloseConfirm, setShowCloseConfirm] = createSignal(false);
  const [closeResolution, setCloseResolution] = createSignal('');
  
  const [newNoteContent, setNewNoteContent] = createSignal('');
  const [newNoteType, setNewNoteType] = createSignal<Note['type']>('general');
  const [newEvidenceUrl, setNewEvidenceUrl] = createSignal('');
  const [newEvidenceType, setNewEvidenceType] = createSignal('PHOTO_URL');
  const [newEvidenceDesc, setNewEvidenceDesc] = createSignal('');
  
  const [newTaskTitle, setNewTaskTitle] = createSignal('');
  const [newTaskDesc, setNewTaskDesc] = createSignal('');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = createSignal('');

  const allCases = createMemo(() => Object.values(cadState.cases));

  const modalData = createMemo(() =>
    (terminalState.modalData as { caseId?: string } | null) || null
  );
  
  const filteredCases = createMemo(() => {
    let cases = allCases();
    
    const query = searchQuery().toLowerCase();
    if (query) {
      cases = cases.filter(c => 
        c.caseId.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.personName?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter() !== 'all') {
      cases = cases.filter(c => c.status === statusFilter());
    }
    
    if (typeFilter() !== 'all') {
      cases = cases.filter(c => c.caseType === typeFilter());
    }
    
    if (priorityFilter() !== 'all') {
      cases = cases.filter(c => c.priority === parseInt(priorityFilter()));
    }
    
    return cases.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  const caseTypes = createMemo(() => {
    const types = new Set(allCases().map(c => c.caseType));
    return Array.from(types);
  });

  const caseSummary = createMemo(() => ({
    open: allCases().filter((item) => item.status === 'OPEN').length,
    closed: allCases().filter((item) => item.status === 'CLOSED').length,
    critical: allCases().filter((item) => item.priority === 1).length,
  }));

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const openCaseFromModalData = () => {
    const caseId = modalData()?.caseId;
    if (!caseId) {
      return;
    }

    const found = cadState.cases[caseId];
    if (found) {
      void selectCase(found);
    }
  };

  createEffect(() => {
    if (!selectedCase() && modalData()?.caseId) {
      openCaseFromModalData();
    }
  });

  const selectCase = async (caseItem: Case) => {
    setSelectedCase(caseItem);
    setSelectedCaseId(caseItem.caseId);
    cadActions.setCurrentCase(caseItem);
    setActiveTab('detail');

    try {
      const result = await fetchNui<Case | CaseApiError>('cad:getCase', {
        caseId: caseItem.caseId,
      });

      if (isCaseApiError(result)) {
        terminalActions.addLine(`Failed loading case details: ${result.error}`, 'error');
        return;
      }

      if (!result || typeof result !== 'object' || !('caseId' in result)) {
        return;
      }

      const detailedCase = result as Case;
      cadActions.addCase(detailedCase);
      cadActions.setCurrentCase(detailedCase);
      setSelectedCase(detailedCase);
    } catch (error) {
      terminalActions.addLine(`Failed loading case details: ${String(error)}`, 'error');
    }
  };

  const closeCase = async () => {
    const caseItem = selectedCase();
    if (!caseItem) return;
    
    try {
      const result = await fetchNui<{ ok?: boolean; success?: boolean; error?: string }>('cad:closeCase', {
        caseId: caseItem.caseId,
        resolution: closeResolution().trim(),
      });

      if (result?.ok === false) {
        terminalActions.addLine(`Failed to close case: ${result.error || 'unknown_error'}`, 'error');
        return;
      }

      cadActions.updateCase(caseItem.caseId, { 
        status: 'CLOSED',
        updatedAt: new Date().toISOString(),
      });
      
      terminalActions.addLine(`✓ Case ${caseItem.caseId} closed`, 'output');
      setShowCloseConfirm(false);
      setCloseResolution('');
      setActiveTab('list');
      setSelectedCase(null);
    } catch (error) {
      terminalActions.addLine(`Failed to close case: ${error}`, 'error');
    }
  };

  const printCaseReport = async () => {
    const caseItem = selectedCase();
    if (!caseItem) return;

    try {
      const response = await fetchNui<{
        ok: boolean;
        itemId?: string;
        error?: string;
      }>('cad:case:printReport', {
        caseId: caseItem.caseId,
        caseType: caseItem.caseType,
        title: caseItem.title,
        priority: caseItem.priority,
        status: caseItem.status,
        createdAt: caseItem.createdAt,
        description: caseItem.description,
        notesCount: caseItem.notes?.length || 0,
        evidenceCount: caseItem.evidence?.length || 0,
      });

      if (!response?.ok) {
        terminalActions.addLine(`Failed to print report: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      terminalActions.addLine(
        `✓ Case report printed: ${caseItem.caseId} (Item: ${response.itemId || 'PAPER'})`,
        'output'
      );
    } catch (error) {
      terminalActions.addLine(`Failed to print case report: ${error}`, 'error');
    }
  };

  const addNote = () => {
    const caseItem = selectedCase();
    if (!caseItem || !newNoteContent().trim()) return;
    
    const note: Note = {
      id: `NOTE_${Date.now()}`,
      caseId: caseItem.caseId,
      author: userActions.getCurrentUserId(),
      content: newNoteContent(),
      timestamp: new Date().toISOString(),
      type: newNoteType()
    };
    
    cadActions.addCaseNote(caseItem.caseId, note);
    setNewNoteContent('');
    setNewNoteType('general');
    
    setSelectedCase(cadState.cases[caseItem.caseId]);
    terminalActions.addLine('Note added', 'output');
  };

  const deleteNote = (noteId: string) => {
    const caseItem = selectedCase();
    if (!caseItem) return;
    
    cadActions.removeCaseNote(caseItem.caseId, noteId);
    setSelectedCase(cadState.cases[caseItem.caseId]);
    terminalActions.addLine('Note deleted', 'system');
  };

  const addEvidence = () => {
    const caseItem = selectedCase();
    if (!caseItem || !newEvidenceUrl().trim()) return;
    
    const evidence: Evidence = {
      evidenceId: `EVI_${Date.now()}`,
      caseId: caseItem.caseId,
      evidenceType: newEvidenceType() as Evidence['evidenceType'],
      data: {
        url: newEvidenceUrl(),
        description: newEvidenceDesc()
      },
      attachedBy: userActions.getCurrentUserId(),
      attachedAt: new Date().toISOString(),
      custodyChain: []
    };
    
    cadActions.addCaseEvidence(caseItem.caseId, evidence);
    setNewEvidenceUrl('');
    setNewEvidenceDesc('');
    
    setSelectedCase(cadState.cases[caseItem.caseId]);
    terminalActions.addLine('Evidence added', 'output');
  };

  const viewEvidence = (ev: Evidence) => {
    const evidenceData = ev.data as { url?: string; description?: string };
    const url = evidenceData.url || '';
    const title = evidenceData.description || `Evidence - ${ev.evidenceId}`;
    
    switch (ev.evidenceType) {
      case 'PHOTO_URL':
      case 'PHOTO':
        viewerActions.openImage(url, title);
        break;
      case 'VIDEO_URL':
      case 'VIDEO':
        viewerActions.openVideo(url, title);
        break;
      case 'AUDIO_URL':
      case 'AUDIO':
        viewerActions.openAudio(url, title);
        break;
      default:
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.match(/\.(mp4|webm|ogg|mov)$/)) {
          viewerActions.openVideo(url, title);
        } else if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/)) {
          viewerActions.openAudio(url, title);
        } else if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          viewerActions.openImage(url, title);
        }
        break;
    }
  };

  const addTask = () => {
    const caseItem = selectedCase();
    if (!caseItem || !newTaskTitle().trim()) return;
    
    const task = {
      taskId: `TASK_${Date.now()}`,
      caseId: caseItem.caseId,
      title: newTaskTitle(),
      description: newTaskDesc(),
      assignedTo: newTaskAssignedTo() || userActions.getCurrentUserId(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'PENDING' as const,
      createdBy: userActions.getCurrentUserId(),
      createdAt: new Date().toISOString()
    };
    
    cadActions.addCaseTask(caseItem.caseId, task);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskAssignedTo('');
    
    setSelectedCase(cadState.cases[caseItem.caseId]);
    terminalActions.addLine('Task added', 'output');
  };

  const completeTask = (taskId: string) => {
    const caseItem = selectedCase();
    if (!caseItem) return;
    
    cadActions.completeCaseTask(caseItem.caseId, taskId);
    setSelectedCase(cadState.cases[caseItem.caseId]);
    terminalActions.addLine('Task completed', 'output');
  };

  const formatDate = (dateStr: string) => formatDateUtil(dateStr);

  const createNewCase = () => {
    terminalActions.setActiveModal('CASE_CREATOR');
  };

  const requestHelp = () => {
    const caseItem = selectedCase();
    if (!caseItem) {
      terminalActions.addLine('No case selected to request help', 'error');
      return;
    }

    void createDispatchCall(caseItem, true);
    
    terminalActions.addLine(`✓ Help requested for case ${caseItem.caseId}`, 'output');
  };

  const createDispatchCall = async (caseItem: Case, isEmergency = false) => {
    try {
      const callPriority = isEmergency ? 1 : Math.max(1, Math.min(3, caseItem.priority || 2));
      const callResult = await fetchNui<{ callId?: string; ok?: boolean; error?: string }>('cad:createDispatchCall', {
        type: caseItem.caseType,
        priority: callPriority,
        title: `CASE ${caseItem.caseId}`,
        location: caseItem.personName || caseItem.linkedCallId || 'Case escalation',
        description: `Escalation from case ${caseItem.caseId}`,
      });

      if (callResult?.ok === false) {
        terminalActions.addLine(`Dispatch call failed: ${callResult.error || 'unknown_error'}`, 'error');
        return;
      }

      if (callResult?.callId) {
        cadActions.updateCase(caseItem.caseId, { linkedCallId: callResult.callId });

        void fetchNui('cad:updateCase', {
          caseId: caseItem.caseId,
          linkedCallId: callResult.callId,
        });

        terminalActions.addLine(`Dispatch call created: ${callResult.callId}`, 'output');
      }
    } catch (error) {
      terminalActions.addLine(`Dispatch call failed: ${String(error)}`, 'error');
    }
  };

  return (
    <Modal.Root onClose={closeModal} contentClass='case-manager'>
      <Modal.Header>
        <Modal.Title>=== CASE MANAGER ===</Modal.Title>
        <Modal.Close />
      </Modal.Header>

      <Tabs.Root
        value={activeTab()}
        onValueChange={(value) => {
          const nextTab = value as 'list' | 'detail' | 'notes' | 'evidence' | 'tasks';
          setActiveTab(nextTab);
          if (nextTab === 'list') {
            setSelectedCase(null);
          }
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value='list' label='LIST' badge={filteredCases().length} />
          <Show when={selectedCase()}>
            <Tabs.Trigger value='detail' label='DETAIL' />
            <Tabs.Trigger value='notes' label='NOTES' badge={selectedCase()?.notes?.length || 0} />
            <Tabs.Trigger
              value='evidence'
              label='EVIDENCE'
              badge={selectedCase()?.evidence?.length || 0}
            />
            <Tabs.Trigger value='tasks' label='TASKS' badge={selectedCase()?.tasks?.length || 0} />
          </Show>
        </Tabs.List>
      </Tabs.Root>

        <Show when={activeTab() === 'list'}>
          <div class="case-list-container">
            <Show when={modalData()?.caseId}>
              <div class="case-modal-hint">
                Opened from case reference: {modalData()?.caseId}
                <Button.Root class="btn-small" onClick={openCaseFromModalData}>
                  [OPEN]
                </Button.Root>
              </div>
            </Show>

            <div class="summary-stats" style={{ 'margin-bottom': '12px' }}>
              <div class="stat-box case">
                <div class="stat-number">{caseSummary().open}</div>
                <div class="stat-label">Open Cases</div>
              </div>
              <div class="stat-box warrant">
                <div class="stat-number">{caseSummary().critical}</div>
                <div class="stat-label">Critical</div>
              </div>
              <div class="stat-box record">
                <div class="stat-number">{caseSummary().closed}</div>
                <div class="stat-label">Closed</div>
              </div>
              <div class="stat-box vehicle">
                <div class="stat-number">{filteredCases().length}</div>
                <div class="stat-label">Visible</div>
              </div>
            </div>

         <div class="case-filters">
           <Input.Root
             type="text"
             class="dos-input"
             placeholder="Search cases..."
             value={searchQuery()}
             onInput={e => setSearchQuery(e.currentTarget.value)}
           />
           
           <div class="case-actions">
             <Button.Root class="btn btn-primary" onClick={createNewCase}>
               [+ NEW CASE]
             </Button.Root>
              <Button.Root class="btn" onClick={requestHelp} disabled={!selectedCase()}>
                [REQUEST HELP]
              </Button.Root>
            </div>
           
           <Select.Root 
             class="dos-select"
             value={statusFilter()}
             onChange={e => setStatusFilter(e.currentTarget.value)}
           >
             <option value="all">All Status</option>
             <option value="OPEN">Open</option>
             <option value="CLOSED">Closed</option>
           </Select.Root>
           <Select.Root 
             class="dos-select"
             value={typeFilter()}
             onChange={e => setTypeFilter(e.currentTarget.value)}
           >
             <option value="all">All Types</option>
             <For each={caseTypes()}>
               {type => <option value={type}>{type}</option>}
             </For>
           </Select.Root>
           <Select.Root 
             class="dos-select"
             value={priorityFilter()}
             onChange={e => setPriorityFilter(e.currentTarget.value)}
           >
             <option value="all">All Priorities</option>
             <option value="1">Critical</option>
             <option value="2">High</option>
             <option value="3">Normal</option>
             <option value="4">Low</option>
           </Select.Root>
         </div>

            <div class="cases-list">
              <Show when={!searchQuery() && filteredCases().length > 0}>
                <div class="case-modal-hint">Select a case to inspect notes, evidence, and tasks.</div>
              </Show>
              <Show when={filteredCases().length === 0}>
                <div class="empty-state">No case records match the current filters</div>
              </Show>
              
              <For each={filteredCases()}>
                {caseItem => (
                   <div 
                     class={`case-card ${caseItem.status === 'CLOSED' ? 'closed' : ''} ${isCaseSelected(caseItem.caseId) ? 'selected' : ''}`}
                     onClick={() => void selectCase(caseItem)}
                     onDblClick={() => { void selectCase(caseItem); setActiveTab('evidence'); }}
                   >
                    <div class="case-header">
                      <span class="case-id">{caseItem.caseId}</span>
                      <span 
                        class="priority-badge"
                        style={{ color: getPriorityColor(caseItem.priority) }}
                      >
                        P{caseItem.priority}
                      </span>
                      <span class={`status-badge ${caseItem.status.toLowerCase()}`}>
                        {caseItem.status}
                      </span>
                    </div>
                    <div class="case-title">{caseItem.title}</div>
                    <div class="case-meta">
                      <span>{caseItem.caseType}</span>
                      <span>Created: {formatDate(caseItem.createdAt)}</span>
                      <span>Notes: {caseItem.notes?.length || 0}</span>
                      <span>Evidence: {caseItem.evidence?.length || 0}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'detail' && selectedCase()}>
          <div class="case-detail">
            <div class="detail-header">
              <div>
                <h3 style={{ margin: 0 }}>{selectedCase()!.caseId}</h3>
                <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-top': '8px' }}>
                  <span class={`status-badge ${selectedCase()!.status.toLowerCase()}`}>{selectedCase()!.status}</span>
                  <span class="priority-badge" style={{ color: getPriorityColor(selectedCase()!.priority) }}>
                    PRIORITY {selectedCase()!.priority}
                  </span>
                  <Show when={selectedCase()!.linkedCallId}>
                    <span class="status-badge open">DISPATCH LINKED</span>
                  </Show>
                </div>
              </div>
              <div class="detail-actions">
                <Button.Root 
                  class="btn btn-primary"
                  onClick={() => void printCaseReport()}
                  title="Print case report"
                >
                  [PRINT REPORT]
                </Button.Root>
                <Show when={selectedCase()!.status === 'OPEN'}>
                  <Button.Root 
                    class="btn btn-danger"
                    onClick={() => setShowCloseConfirm(true)}
                  >
                    [CLOSE CASE]
                  </Button.Root>
                </Show>
              </div>
            </div>
            
            <div class="detail-info">
              <div class="info-row">
                <strong>Summary:</strong> {(selectedCase()!.notes?.length || 0)} notes | {(selectedCase()!.evidence?.length || 0)} evidence | {(selectedCase()!.tasks?.length || 0)} tasks
              </div>
              <div class="info-row">
                <strong>Title:</strong> {selectedCase()!.title}
              </div>
              <div class="info-row">
                <strong>Type:</strong> {selectedCase()!.caseType}
              </div>
              <div class="info-row">
                <strong>Priority:</strong> 
                <span style={{ color: getPriorityColor(selectedCase()!.priority) }}>
                  P{selectedCase()!.priority}
                </span>
              </div>
              <div class="info-row">
                <strong>Status:</strong> {selectedCase()!.status}
              </div>
              <div class="info-row">
                <strong>Created:</strong> {formatDate(selectedCase()!.createdAt)}
              </div>
              <Show when={selectedCase()!.description}>
                <div class="info-row description">
                  <strong>Description:</strong>
                  <p>{selectedCase()!.description}</p>
                </div>
              </Show>
            </div>

            <Show when={showCloseConfirm()}>
              <div class="close-confirm">
                <h4>Close Case - Resolution Required</h4>
                <Textarea.Root
                  class="dos-textarea"
                  placeholder="Enter resolution notes..."
                  value={closeResolution()}
                  onInput={e => setCloseResolution(e.currentTarget.value)}
                  rows={3}
                />
                <div class="confirm-actions">
                  <Button.Root class="btn btn-primary" onClick={() => void closeCase()}>
                    [CONFIRM CLOSE]
                  </Button.Root>
                  <Button.Root class="btn" onClick={() => setShowCloseConfirm(false)}>
                    [CANCEL]
                  </Button.Root>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'notes' && selectedCase()}>
          <div class="case-notes">
            <div class="add-note-form">
              <h4>Add Note</h4>
              <Select.Root 
                class="dos-select"
                value={newNoteType()}
                onChange={e => setNewNoteType(e.currentTarget.value as Note['type'])}
              >
                <option value="general">General</option>
                <option value="observation">Observation</option>
                <option value="interview">Interview</option>
                <option value="evidence">Evidence</option>
              </Select.Root>
              <Textarea.Root
                class="dos-textarea"
                placeholder="Enter note content..."
                value={newNoteContent()}
                onInput={e => setNewNoteContent(e.currentTarget.value)}
                rows={3}
              />
              <Button.Root class="btn btn-primary" onClick={addNote}>
                [ADD NOTE]
              </Button.Root>
            </div>

            <div class="notes-list">
              <h4>Case Notes ({selectedCase()!.notes?.length || 0})</h4>
              <Show when={!selectedCase()!.notes?.length}>
                <div class="empty-state">No investigator notes saved for this case</div>
              </Show>
              <For each={selectedCase()!.notes || []}>
                {note => (
                  <div class="note-item">
                    <div class="note-header">
                      <span class={`note-type ${note.type}`}>[{note.type.toUpperCase()}]</span>
                      <span class="note-date">{formatDate(note.timestamp)}</span>
                      <span class="note-author">by {note.author}</span>
                    </div>
                    <div class="note-content">{note.content}</div>
                    <Button.Root 
                      class="btn-small btn-danger"
                      onClick={() => deleteNote(note.id)}
                    >
                      [DELETE]
                    </Button.Root>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'evidence' && selectedCase()}>
          <div class="case-evidence">
            <div class="add-evidence-form">
              <h4>Add Evidence</h4>
              <Select.Root 
                class="dos-select"
                value={newEvidenceType()}
                onChange={e => setNewEvidenceType(e.currentTarget.value)}
              >
                <option value="PHOTO_URL">Photo URL</option>
                <option value="VIDEO_URL">Video URL</option>
                <option value="AUDIO_URL">Audio URL</option>
                <option value="DOCUMENT">Document</option>
                <option value="PHYSICAL">Physical Item</option>
              </Select.Root>
              <Input.Root
                type="text"
                class="dos-input"
                placeholder="Evidence URL or identifier..."
                value={newEvidenceUrl()}
                onInput={e => setNewEvidenceUrl(e.currentTarget.value)}
              />
              <Input.Root
                type="text"
                class="dos-input"
                placeholder="Description..."
                value={newEvidenceDesc()}
                onInput={e => setNewEvidenceDesc(e.currentTarget.value)}
              />
              <Button.Root class="btn btn-primary" onClick={addEvidence}>
                [ADD EVIDENCE]
              </Button.Root>
            </div>

            <div class="evidence-list">
              <h4>Case Evidence ({selectedCase()!.evidence?.length || 0})</h4>
              <Show when={!selectedCase()!.evidence?.length}>
                <div class="empty-state">No evidence attached to this case yet</div>
              </Show>
              <For each={selectedCase()!.evidence || []}>
                {ev => (
                  (() => {
                    const evidenceData = ev.data as { url?: string; description?: string };
                    const isViewable = ev.evidenceType === 'PHOTO_URL' || 
                                       ev.evidenceType === 'PHOTO' ||
                                       ev.evidenceType === 'VIDEO_URL' ||
                                       ev.evidenceType === 'VIDEO' ||
                                       ev.evidenceType === 'AUDIO_URL' ||
                                       ev.evidenceType === 'AUDIO' ||
                                       evidenceData.url?.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|wav|ogg|m4a)$/i);
                    return (
                  <div class="evidence-item">
                    <div class="evidence-header">
                      <span class="evidence-type">[{ev.evidenceType}]</span>
                      <span class="evidence-id">{ev.evidenceId}</span>
                    </div>
                    <div class="evidence-desc">{evidenceData.description || 'No description provided'}</div>
                    <Show when={evidenceData.url && isViewable}>
                      <Button.Root 
                        class="btn-small"
                        onClick={() => viewEvidence(ev)}
                      >
                        [VIEW {ev.evidenceType.includes('VIDEO') ? 'VIDEO' : ev.evidenceType.includes('AUDIO') ? 'AUDIO' : 'IMAGE'}]
                      </Button.Root>
                    </Show>
                  </div>
                    );
                  })()
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'tasks' && selectedCase()}>
          <div class="case-tasks">
            <div class="add-task-form">
              <h4>Add Task</h4>
              <Input.Root
                type="text"
                class="dos-input"
                placeholder="Task title..."
                value={newTaskTitle()}
                onInput={e => setNewTaskTitle(e.currentTarget.value)}
              />
              <Input.Root
                type="text"
                class="dos-input"
                placeholder="Description..."
                value={newTaskDesc()}
                onInput={e => setNewTaskDesc(e.currentTarget.value)}
              />
              <Input.Root
                type="text"
                class="dos-input"
                placeholder="Assigned to (ID)..."
                value={newTaskAssignedTo()}
                onInput={e => setNewTaskAssignedTo(e.currentTarget.value)}
              />
              <Button.Root class="btn btn-primary" onClick={addTask}>
                [ADD TASK]
              </Button.Root>
            </div>

            <div class="tasks-list">
              <h4>Case Tasks</h4>
              <Show when={!selectedCase()!.tasks?.length}>
                <div class="empty-state">No case tasks assigned yet</div>
              </Show>
              <For each={selectedCase()!.tasks || []}>
                {task => (
                  <div class={`task-item ${task.status.toLowerCase()}`}>
                    <div class="task-header">
                      <span class={`task-status ${task.status.toLowerCase()}`}>
                        [{task.status}]
                      </span>
                      <span class="task-title">{task.title}</span>
                    </div>
                    <div class="task-desc">{task.description}</div>
                    <div class="task-meta">
                      <span>Assigned: {task.assignedTo}</span>
                      <span>Due: {formatDate(task.dueDate)}</span>
                    </div>
                    <Show when={task.status === 'PENDING'}>
                      <Button.Root 
                        class="btn-small btn-success"
                        onClick={() => completeTask(task.taskId)}
                      >
                        [COMPLETE]
                      </Button.Root>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

      <Modal.Footer>
        <Text.Root as='span' tone='dim'>
          Total Cases: {allCases().length} | Current: {cadState.currentCase?.caseId || 'None'}
        </Text.Root>
        <Button.Root label='CLOSE' onClick={closeModal} />
      </Modal.Footer>
    </Modal.Root>
  );
}
