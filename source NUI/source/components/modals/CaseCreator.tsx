import { createSignal, Show } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadActions, cadState } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { DosSelect } from '../DosSelect';
import type { Case } from '~/stores/cadStore';
import { Button, Input, Modal, Textarea } from '~/components/ui';

export function CaseCreator() {
  const modalData = terminalState.modalData as {
    linkedCallId?: string;
    linkedUnits?: string[];
    initialTitle?: string;
    initialDescription?: string;
    initialPriority?: number;
    personId?: string;
    personName?: string;
  } | null;

  const [caseType, setCaseType] = createSignal('GENERAL');
  const [title, setTitle] = createSignal(modalData?.initialTitle || '');
  const [description, setDescription] = createSignal(modalData?.initialDescription || '');
  const [priority, setPriority] = createSignal(modalData?.initialPriority || 2);
  const [linkedCallId] = createSignal(modalData?.linkedCallId || '');
  const [linkedUnits] = createSignal(modalData?.linkedUnits || []);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [createdCase, setCreatedCase] = createSignal<Case | null>(null);

  const getLinkedCase = () => {
    const callId = linkedCallId();
    if (!callId) return undefined;
    return Object.values(cadState.cases).find((caseItem) => caseItem.linkedCallId === callId);
  };

  const caseTypeOptions = [
    { value: 'THEFT', label: 'THEFT' },
    { value: 'ASSAULT', label: 'ASSAULT' },
    { value: 'HOMICIDE', label: 'HOMICIDE' },
    { value: 'ACCIDENT', label: 'ACCIDENT' },
    { value: 'DRUGS', label: 'DRUGS' },
    { value: 'FRAUD', label: 'FRAUD' },
    { value: 'TRAFFIC', label: 'TRAFFIC' },
    { value: 'DISTURBANCE', label: 'DISTURBANCE' },
    { value: 'SUSPICIOUS', label: 'SUSPICIOUS ACTIVITY' },
    { value: 'GENERAL', label: 'GENERAL' },
  ];

  const priorityOptions = [
    { value: '1', label: 'HIGH', color: 'priority-high' },
    { value: '2', label: 'MEDIUM', color: 'priority-med' },
    { value: '3', label: 'LOW', color: 'priority-low' },
  ];

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const linkedCase = getLinkedCase();
    if (linkedCase) {
      terminalActions.addLine(
        `Case ${linkedCase.caseId} already linked to call ${linkedCallId()}`,
        'system',
      );
      terminalActions.setActiveModal('CASE_MANAGER', { caseId: linkedCase.caseId });
      return;
    }
    
    if (!title().trim()) {
      terminalActions.addLine('Error: Title is required', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const caseData: any = {
        caseType: caseType(),
        title: title(),
        description: description(),
        priority: priority(),
      };

      if (linkedCallId()) {
        caseData.linkedCallId = linkedCallId();
        caseData.linkedUnits = linkedUnits();
      }

      if (modalData?.personId) {
        caseData.personId = modalData.personId;
        caseData.personName = modalData.personName;
      }

      const result = await fetchNui('cad:createCase', caseData);

      if (result) {
        const newCase = result as Case;
        cadActions.addCase(newCase);
        cadActions.setCurrentCase(newCase);
        setCreatedCase(newCase);
        terminalActions.addLine(`Case created: ${newCase.caseId}`, 'output');
        terminalActions.addLine(`Title: ${newCase.title}`, 'output');
        
        if (linkedCallId()) {
          const initialNote = {
            id: `NOTE_${Date.now()}`,
            caseId: newCase.caseId,
            author: 'SYSTEM',
            content: `Case created from Dispatch Call ${linkedCallId()}\nAssigned Units: ${linkedUnits().join(', ') || 'None'}`,
            timestamp: new Date().toISOString(),
            type: 'general' as const,
          };
          cadActions.addCaseNote(newCase.caseId, initialNote);
        }
        
      }
    } catch (error) {
      terminalActions.addLine(`Failed to create case: ${error}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddEvidence = () => {
    const caseId = createdCase()?.caseId;
    if (caseId) {
      (window as any).__evidenceTargetCaseId = caseId;
      terminalActions.setActiveModal('UPLOAD');
    }
  };

  const handleAddNote = () => {
    const caseId = createdCase()?.caseId;
    terminalActions.setActiveModal('NOTES', caseId ? { caseId } : null);
  };

  const handleDone = () => {
    setCreatedCase(null);
    closeModal();
  };

  const openExistingLinkedCase = () => {
    const linkedCase = getLinkedCase();
    if (!linkedCase) return;
    terminalActions.setActiveModal('CASE_MANAGER', { caseId: linkedCase.caseId });
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content case-creator" onClick={(e) => e.stopPropagation()}>
        <Show 
          when={!createdCase()} 
          fallback={
            <div class="success-state">
              <div class="modal-header">
                <h2>=== CASE CREATED ===</h2>
                <button class="modal-close" onClick={handleDone}>[X]</button>
              </div>
              
              <div class="success-content" style={{ padding: '20px' }}>
                <div style={{ color: '#00ff00', 'margin-bottom': '20px' }}>
                  ✓ Case {createdCase()?.caseId} created successfully!
                </div>
                
                <div style={{ 'margin-bottom': '10px' }}>
                  <strong>Title:</strong> {createdCase()?.title}
                </div>
                <div style={{ 'margin-bottom': '10px' }}>
                  <strong>Type:</strong> {createdCase()?.caseType}
                </div>
                <div style={{ 'margin-bottom': '20px' }}>
                  <strong>Priority:</strong> {createdCase()?.priority}
                </div>
                
                <div style={{ 'margin-bottom': '20px', color: '#ffff00' }}>
                  Notes: 0 | Evidence: 0
                </div>
                
                <div style={{ 'margin-bottom': '15px', color: '#888' }}>
                  What would you like to do next?
                </div>
                
                <div class="modal-footer" style={{ 'flex-direction': 'column', gap: '10px' }}>
                  <Button.Root class="btn btn-primary" onClick={handleAddEvidence}>
                    [ADD EVIDENCE]
                  </Button.Root>
                  <Button.Root class="btn" onClick={handleAddNote}>
                    [ADD NOTE]
                  </Button.Root>
                  <Button.Root class="btn" onClick={handleDone}>
                    [DONE - CLOSE]
                  </Button.Root>
                </div>
              </div>
            </div>
          }
        >
          <div class="modal-header">
            <h2>=== CREATE NEW CASE ===</h2>
            <button class="modal-close" onClick={closeModal}>[X]</button>
          </div>

          <form onSubmit={handleSubmit} class="dos-form">
            <Show when={linkedCallId()}>
              <div class="form-section linked-info" style={{ 
                background: 'rgba(255, 255, 0, 0.1)', 
                padding: '12px', 
                border: '1px solid #ffff00',
                'margin-bottom': '16px'
              }}>
                <div style={{ color: '#ffff00', 'font-weight': 'bold', 'margin-bottom': '8px' }}>
                  📞 LINKED DISPATCH CALL
                </div>
                <div>Call ID: {linkedCallId()}</div>
                <Show when={linkedUnits().length > 0}>
                  <div>Units: {linkedUnits().join(', ')}</div>
                </Show>
                <Show when={getLinkedCase()}>
                  <div style={{ color: '#ff8800', 'margin-top': '8px' }}>
                    Existing case linked: {getLinkedCase()?.caseId}
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={modalData?.personId}>
              <div class="form-section linked-info" style={{ 
                background: 'rgba(0, 255, 0, 0.1)', 
                padding: '12px', 
                border: '1px solid #00ff00',
                'margin-bottom': '16px'
              }}>
                <div style={{ color: '#00ff00', 'font-weight': 'bold', 'margin-bottom': '8px' }}>
                  👤 LINKED PERSON
                </div>
                <div>Name: {modalData?.personName}</div>
                <div>ID: {modalData?.personId}</div>
              </div>
            </Show>

            <div class="form-section">
              <DosSelect
                label="[CASE TYPE]"
                options={caseTypeOptions}
                value={caseType()}
                onChange={(value) => setCaseType(value)}
                placeholder="Select case type..."
              />
            </div>

            <div class="form-section">
              <DosSelect
                label="[PRIORITY]"
                options={priorityOptions}
                value={priority().toString()}
                onChange={(value) => setPriority(parseInt(value))}
                placeholder="Select priority..."
              />
            </div>

            <div class="form-section">
              <label class="form-label">[TITLE]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                placeholder="Enter case title..."
                disabled={isSubmitting()}
              />
            </div>

            <div class="form-section">
              <label class="form-label">[DESCRIPTION]</label>
              <Textarea.Root
                class="dos-textarea"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="Enter case description..."
                rows={5}
                disabled={isSubmitting()}
              />
            </div>

            <div class="form-preview">
              <div class="form-label">[PREVIEW]</div>
              <div class="preview-box">
                <div>TYPE: {caseType()}</div>
                <div>PRIORITY: {priorityOptions.find(p => parseInt(p.value) === priority())?.label}</div>
                <div>TITLE: {title() || '[NOT SET]'}</div>
              </div>
            </div>

            <div class="modal-footer">
              <Button.Root 
                type="submit" 
                class="btn btn-primary" 
                disabled={isSubmitting() || !title().trim() || !!getLinkedCase()}
              >
                {isSubmitting() ? '[CREATING...]' : '[CREATE CASE]'}
              </Button.Root>
              <Show when={getLinkedCase()}>
                <Button.Root type="button" class="btn" onClick={openExistingLinkedCase}>
                  [OPEN EXISTING CASE]
                </Button.Root>
              </Show>
              <Button.Root type="button" class="btn" onClick={closeModal}>
                [CANCEL]
              </Button.Root>
            </div>
          </form>
        </Show>
      </div>
    </Modal.Root>
  );
}
