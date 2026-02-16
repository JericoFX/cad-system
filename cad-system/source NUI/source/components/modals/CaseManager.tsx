
import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions, type Case, type Note, type Evidence } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { viewerActions } from '~/stores/viewerStore';
import { fetchNui } from '~/utils/fetchNui';

export function CaseManager() {
  const [activeTab, setActiveTab] = createSignal<'list' | 'detail' | 'notes' | 'evidence' | 'tasks'>('list');
  const [selectedCase, setSelectedCase] = createSignal<Case | null>(null);
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
      selectCase(found);
    }
  };

  createEffect(() => {
    if (!selectedCase() && modalData()?.caseId) {
      openCaseFromModalData();
    }
  });

  const selectCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    cadActions.setCurrentCase(caseItem);
    setActiveTab('detail');
  };

  const closeCase = async () => {
    const caseItem = selectedCase();
    if (!caseItem) return;
    
    try {
      
      cadActions.updateCase(caseItem.caseId, { 
        status: 'CLOSED'
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
        // For other types, try to detect by URL extension
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return '#ff0000';
      case 2: return '#ff8800';
      case 3: return '#ffff00';
      case 4: return '#00ff00';
      default: return '#808080';
    }
  };

  return (
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content case-manager" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== CASE MANAGER ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="detail-tabs">
          <button 
            class={`tab ${activeTab() === 'list' ? 'active' : ''}`}
            onClick={() => { setActiveTab('list'); setSelectedCase(null); }}
          >
            [LIST ({filteredCases().length})]
          </button>
          <Show when={selectedCase()}>
            <button 
              class={`tab ${activeTab() === 'detail' ? 'active' : ''}`}
              onClick={() => setActiveTab('detail')}
            >
              [DETAIL]
            </button>
            <button 
              class={`tab ${activeTab() === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              [NOTES ({selectedCase()?.notes?.length || 0})]
            </button>
            <button 
              class={`tab ${activeTab() === 'evidence' ? 'active' : ''}`}
              onClick={() => setActiveTab('evidence')}
            >
              [EVIDENCE ({selectedCase()?.evidence?.length || 0})]
            </button>
            <button 
              class={`tab ${activeTab() === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              [TASKS ({selectedCase()?.tasks?.length || 0})]
            </button>
          </Show>
        </div>

        <Show when={activeTab() === 'list'}>
          <div class="case-list-container">
            <Show when={modalData()?.caseId}>
              <div class="case-modal-hint">
                Opened from case reference: {modalData()?.caseId}
                <button class="btn-small" onClick={openCaseFromModalData}>
                  [OPEN]
                </button>
              </div>
            </Show>

            <div class="case-filters">
              <input
                type="text"
                class="dos-input"
                placeholder="Search cases..."
                value={searchQuery()}
                onInput={e => setSearchQuery(e.currentTarget.value)}
              />
              <select 
                class="dos-select"
                value={statusFilter()}
                onChange={e => setStatusFilter(e.currentTarget.value)}
              >
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select 
                class="dos-select"
                value={typeFilter()}
                onChange={e => setTypeFilter(e.currentTarget.value)}
              >
                <option value="all">All Types</option>
                <For each={caseTypes()}>
                  {type => <option value={type}>{type}</option>}
                </For>
              </select>
              <select 
                class="dos-select"
                value={priorityFilter()}
                onChange={e => setPriorityFilter(e.currentTarget.value)}
              >
                <option value="all">All Priorities</option>
                <option value="1">Critical</option>
                <option value="2">High</option>
                <option value="3">Normal</option>
                <option value="4">Low</option>
              </select>
            </div>

            <div class="cases-list">
              <Show when={filteredCases().length === 0}>
                <div class="empty-state">No cases found</div>
              </Show>
              
              <For each={filteredCases()}>
                {caseItem => (
                  <div 
                    class={`case-card ${caseItem.status === 'CLOSED' ? 'closed' : ''}`}
                    onClick={() => selectCase(caseItem)}
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
              <h3>{selectedCase()!.caseId}</h3>
              <div class="detail-actions">
                <button 
                  class="btn btn-primary"
                  onClick={() => void printCaseReport()}
                  title="Print case report"
                >
                  [PRINT REPORT]
                </button>
                <Show when={selectedCase()!.status === 'OPEN'}>
                  <button 
                    class="btn btn-danger"
                    onClick={() => setShowCloseConfirm(true)}
                  >
                    [CLOSE CASE]
                  </button>
                </Show>
              </div>
            </div>
            
            <div class="detail-info">
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
                <textarea
                  class="dos-textarea"
                  placeholder="Enter resolution notes..."
                  value={closeResolution()}
                  onInput={e => setCloseResolution(e.currentTarget.value)}
                  rows={3}
                />
                <div class="confirm-actions">
                  <button class="btn btn-primary" onClick={closeCase}>
                    [CONFIRM CLOSE]
                  </button>
                  <button class="btn" onClick={() => setShowCloseConfirm(false)}>
                    [CANCEL]
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'notes' && selectedCase()}>
          <div class="case-notes">
            <div class="add-note-form">
              <h4>Add Note</h4>
              <select 
                class="dos-select"
                value={newNoteType()}
                onChange={e => setNewNoteType(e.currentTarget.value as Note['type'])}
              >
                <option value="general">General</option>
                <option value="observation">Observation</option>
                <option value="interview">Interview</option>
                <option value="evidence">Evidence</option>
              </select>
              <textarea
                class="dos-textarea"
                placeholder="Enter note content..."
                value={newNoteContent()}
                onInput={e => setNewNoteContent(e.currentTarget.value)}
                rows={3}
              />
              <button class="btn btn-primary" onClick={addNote}>
                [ADD NOTE]
              </button>
            </div>

            <div class="notes-list">
              <h4>Case Notes ({selectedCase()!.notes?.length || 0})</h4>
              <Show when={!selectedCase()!.notes?.length}>
                <div class="empty-state">No notes yet</div>
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
                    <button 
                      class="btn-small btn-danger"
                      onClick={() => deleteNote(note.id)}
                    >
                      [DELETE]
                    </button>
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
              <select 
                class="dos-select"
                value={newEvidenceType()}
                onChange={e => setNewEvidenceType(e.currentTarget.value)}
              >
                <option value="PHOTO_URL">Photo URL</option>
                <option value="VIDEO_URL">Video URL</option>
                <option value="AUDIO_URL">Audio URL</option>
                <option value="DOCUMENT">Document</option>
                <option value="PHYSICAL">Physical Item</option>
              </select>
              <input
                type="text"
                class="dos-input"
                placeholder="Evidence URL or identifier..."
                value={newEvidenceUrl()}
                onInput={e => setNewEvidenceUrl(e.currentTarget.value)}
              />
              <input
                type="text"
                class="dos-input"
                placeholder="Description..."
                value={newEvidenceDesc()}
                onInput={e => setNewEvidenceDesc(e.currentTarget.value)}
              />
              <button class="btn btn-primary" onClick={addEvidence}>
                [ADD EVIDENCE]
              </button>
            </div>

            <div class="evidence-list">
              <h4>Case Evidence ({selectedCase()!.evidence?.length || 0})</h4>
              <Show when={!selectedCase()!.evidence?.length}>
                <div class="empty-state">No evidence yet</div>
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
                    <div class="evidence-desc">{evidenceData.description || 'No description'}</div>
                    <Show when={evidenceData.url && isViewable}>
                      <button 
                        class="btn-small"
                        onClick={() => viewEvidence(ev)}
                      >
                        {[VIEW {ev.evidenceType.includes('VIDEO') ? 'VIDEO' : ev.evidenceType.includes('AUDIO') ? 'AUDIO' : 'IMAGE'}]}
                      </button>
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
              <input
                type="text"
                class="dos-input"
                placeholder="Task title..."
                value={newTaskTitle()}
                onInput={e => setNewTaskTitle(e.currentTarget.value)}
              />
              <input
                type="text"
                class="dos-input"
                placeholder="Description..."
                value={newTaskDesc()}
                onInput={e => setNewTaskDesc(e.currentTarget.value)}
              />
              <input
                type="text"
                class="dos-input"
                placeholder="Assigned to (ID)..."
                value={newTaskAssignedTo()}
                onInput={e => setNewTaskAssignedTo(e.currentTarget.value)}
              />
              <button class="btn btn-primary" onClick={addTask}>
                [ADD TASK]
              </button>
            </div>

            <div class="tasks-list">
              <h4>Case Tasks</h4>
              <Show when={!selectedCase()!.tasks?.length}>
                <div class="empty-state">No tasks yet</div>
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
                      <button 
                        class="btn-small btn-success"
                        onClick={() => completeTask(task.taskId)}
                      >
                        [COMPLETE]
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            Total Cases: {allCases().length} | Current: {cadState.currentCase?.caseId || 'None'}
          </span>
          <button class="btn" onClick={closeModal}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
