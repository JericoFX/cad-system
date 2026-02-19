import { createSignal, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadActions } from '~/stores/cadStore';
import { Button, Input, Modal } from '~/components/ui';

export function ArrestForm() {
  const [citizenId, setCitizenId] = createSignal('');
  const [personName, setPersonName] = createSignal('');
  const [charges, setCharges] = createSignal('');
  const [sentence, setSentence] = createSignal('');
  const [fineAmount, setFineAmount] = createSignal('');
  const [jailTime, setJailTime] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [showConfirm, setShowConfirm] = createSignal(false);

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const handlePreview = (e: Event) => {
    e.preventDefault();
    
    if (!citizenId().trim() || !personName().trim() || !charges().trim()) {
      terminalActions.addLine('Error: Citizen ID, Name, and Charges are required', 'error');
      return;
    }
    
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const arrestData = {
        recordId: `ARR_${Date.now()}`,
        citizenid: citizenId(),
        personName: personName(),
        charges: charges().split(',').map(c => c.trim()),
        description: charges(),
        sentence: sentence() || 'N/A',
        fine: parseFloat(fineAmount()) || 0,
        jailTime: parseInt(jailTime()) || 0,
        convicted: false,
        arrestingOfficer: 'OFFICER_001',
        arrestingOfficerName: 'Officer',
        arrestedAt: new Date().toISOString(),
        notes: '',
        cleared: false
      };

      cadActions.addCriminalRecord(arrestData);

      terminalActions.addLine(`Arrest registered: ${arrestData.recordId}`, 'output');
      terminalActions.addLine(`Person: ${personName()} has been arrested`, 'output');
      
      closeModal();
    } catch (error) {
      terminalActions.addLine(`Failed to register arrest: ${error}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setShowConfirm(false);
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content case-creator" onClick={(e) => e.stopPropagation()}>
        <Show 
          when={!showConfirm()} 
          fallback={
            <div class="success-state">
              <div class="modal-header">
                <h2>=== CONFIRM ARREST ===</h2>
                <button class="modal-close" onClick={closeModal}>[X]</button>
              </div>
              
              <div style={{ padding: '20px' }}>
                <div style={{ 'margin-bottom': '10px' }}>
                  <strong>Person:</strong> {personName()} ({citizenId()})
                </div>
                <div style={{ 'margin-bottom': '10px' }}>
                  <strong>Charges:</strong> {charges()}
                </div>
                <div style={{ 'margin-bottom': '10px' }}>
                  <strong>Sentence:</strong> {sentence() || 'N/A'}
                </div>
                <div style={{ 'margin-bottom': '10px' }}>
                  <strong>Fine:</strong> ${fineAmount() || '0'}
                </div>
                <div style={{ 'margin-bottom': '20px' }}>
                  <strong>Jail Time:</strong> {jailTime() || '0'} months
                </div>
                
                <div class="modal-footer" style={{ 'flex-direction': 'column', gap: '10px' }}>
                  <Button.Root class="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting()}>
                    {isSubmitting() ? '[REGISTERING...]' : '[CONFIRM ARREST]'}
                  </Button.Root>
                  <Button.Root class="btn" onClick={handleBack}>
                    [BACK]
                  </Button.Root>
                </div>
              </div>
            </div>
          }
        >
          <div class="modal-header">
            <h2>=== REGISTER ARREST ===</h2>
            <button class="modal-close" onClick={closeModal}>[X]</button>
          </div>

          <form onSubmit={handlePreview} class="dos-form">
            <div class="form-section">
              <label class="form-label">[CITIZEN ID]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={citizenId()}
                onInput={(e) => setCitizenId(e.currentTarget.value)}
                placeholder="Enter citizen ID..."
              />
            </div>

            <div class="form-section">
              <label class="form-label">[PERSON NAME]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={personName()}
                onInput={(e) => setPersonName(e.currentTarget.value)}
                placeholder="Enter person name..."
              />
            </div>

            <div class="form-section">
              <label class="form-label">[CHARGES]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={charges()}
                onInput={(e) => setCharges(e.currentTarget.value)}
                placeholder="Enter charges (comma-separated)..."
              />
            </div>

            <div class="form-section">
              <label class="form-label">[SENTENCE]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={sentence()}
                onInput={(e) => setSentence(e.currentTarget.value)}
                placeholder="e.g., 5 years..."
              />
            </div>

            <div class="form-section">
              <label class="form-label">[FINE AMOUNT]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={fineAmount()}
                onInput={(e) => setFineAmount(e.currentTarget.value)}
                placeholder="0 for none..."
              />
            </div>

            <div class="form-section">
              <label class="form-label">[JAIL TIME (MONTHS)]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={jailTime()}
                onInput={(e) => setJailTime(e.currentTarget.value)}
                placeholder="0 for none..."
              />
            </div>

            <div class="modal-footer">
              <Button.Root 
                type="submit" 
                class="btn btn-primary"
                disabled={!citizenId().trim() || !personName().trim() || !charges().trim()}
              >
                [PREVIEW]
              </Button.Root>
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
