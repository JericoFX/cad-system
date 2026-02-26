import { createSignal, Show, For } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadActions, cadState } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { Button, Input, Modal, Select, Textarea } from '~/components/ui';

interface ArrestData {
  citizenId: string;
  personName: string;
  charges: string[];
  seizedItems: string[];
  rightsRead: boolean;
  transportDestination: string;
  escortingOfficer: string;
  notes: string;
}

const PENAL_CODES = [
  { code: 'PC-187', description: 'Homicide' },
  { code: 'PC-207', description: 'Kidnapping' },
  { code: 'PC-211', description: 'Robbery' },
  { code: 'PC-215', description: 'Carjacking' },
  { code: 'PC-220', description: 'Assault with intent' },
  { code: 'PC-245', description: 'Assault with deadly weapon' },
  { code: 'PC-246', description: 'Shooting at inhabited dwelling' },
  { code: 'PC-261', description: 'Rape' },
  { code: 'PC-288', description: 'Lewd acts with minor' },
  { code: 'PC-298', description: 'Arson' },
  { code: 'PC-451', description: 'Burglary' },
  { code: 'PC-459', description: 'Burglary - First Degree' },
  { code: 'PC-487', description: 'Grand Theft' },
  { code: 'PC-488', description: 'Petty Theft' },
  { code: 'PC-496', description: 'Receiving stolen property' },
  { code: 'PC-503', description: 'Embezzlement' },
  { code: 'PC-594', description: 'Vandalism' },
  { code: 'VC-10851', description: 'Vehicle theft' },
  { code: 'VC-20001', description: 'Hit and run' },
  { code: 'HS-11350', description: 'Possession of controlled substance' },
  { code: 'HS-11351', description: 'Possession for sale' },
  { code: 'HS-11352', description: 'Transportation of controlled substance' },
  { code: 'HS-11377', description: 'Possession of methamphetamine' },
  { code: 'HS-11378', description: 'Possession of meth for sale' },
  { code: 'HS-11550', description: 'Under influence of controlled substance' },
];

export function ArrestWizard() {
  const modalData = terminalState.modalData as { 
    citizenId?: string; 
    personName?: string;
    boloId?: string;
  } | null;

  const [currentStep, setCurrentStep] = createSignal(1);
  const [completedSteps, setCompletedSteps] = createSignal<number[]>([]);
  
  const [arrestData, setArrestData] = createSignal<ArrestData>({
    citizenId: modalData?.citizenId || '',
    personName: modalData?.personName || '',
    charges: [],
    seizedItems: [],
    rightsRead: false,
    transportDestination: '',
    escortingOfficer: '',
    notes: modalData?.boloId ? `Arrest from BOLO: ${modalData.boloId}` : '',
  });

  const [selectedCharge, setSelectedCharge] = createSignal('');
  const [customCharge, setCustomCharge] = createSignal('');
  const [newItem, setNewItem] = createSignal('');
  const [errors, setErrors] = createSignal<string[]>([]);

  const totalSteps = 6;

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const validateStep = (step: number): boolean => {
    const errors: string[] = [];
    const data = arrestData();

    switch (step) {
      case 1:
        if (!data.citizenId.trim()) errors.push('Citizen ID is required');
        if (!data.personName.trim()) errors.push('Person name is required');
        break;
      case 2:
        if (data.charges.length === 0) errors.push('At least one charge is required');
        break;
      case 4:
        if (!data.rightsRead) errors.push('Must confirm Miranda rights were read');
        break;
      case 5:
        if (!data.transportDestination.trim()) errors.push('Transport destination is required');
        if (!data.escortingOfficer.trim()) errors.push('Escorting officer is required');
        break;
    }

    setErrors(errors);
    return errors.length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep())) {
      setCompletedSteps([...completedSteps(), currentStep()]);
      if (currentStep() < totalSteps) {
        setCurrentStep(currentStep() + 1);
        setErrors([]);
      }
    }
  };

  const prevStep = () => {
    if (currentStep() > 1) {
      setCurrentStep(currentStep() - 1);
      setErrors([]);
    }
  };

  const addCharge = () => {
    const charge = selectedCharge() || customCharge();
    if (charge && !arrestData().charges.includes(charge)) {
      setArrestData({ ...arrestData(), charges: [...arrestData().charges, charge] });
      setSelectedCharge('');
      setCustomCharge('');
    }
  };

  const removeCharge = (charge: string) => {
    setArrestData({ 
      ...arrestData(), 
      charges: arrestData().charges.filter(c => c !== charge) 
    });
  };

  const addSeizedItem = () => {
    if (newItem().trim() && !arrestData().seizedItems.includes(newItem().trim())) {
      setArrestData({ 
        ...arrestData(), 
        seizedItems: [...arrestData().seizedItems, newItem().trim()] 
      });
      setNewItem('');
    }
  };

  const removeSeizedItem = (item: string) => {
    setArrestData({ 
      ...arrestData(), 
      seizedItems: arrestData().seizedItems.filter(i => i !== item) 
    });
  };

  const submitArrest = () => {
    if (!validateStep(currentStep())) return;

    const data = arrestData();
    const arrestRecord = {
      recordId: `ARR_${Date.now()}`,
      citizenid: data.citizenId,
      personName: data.personName,
      charges: data.charges,
      description: `Arrested for ${data.charges.join(', ')}`,
      sentence: 'N/A - Pending judicial review',
      fine: 0,
      jailTime: 0,
      convicted: false,
      arrestingOfficer: userActions.getCurrentUserId(),
      arrestingOfficerName: userActions.getCurrentUserName(),
      arrestedAt: new Date().toISOString(),
      notes: data.notes + `\n\nSeized Items: ${data.seizedItems.join(', ') || 'None'}\nTransport: ${data.transportDestination}\nEscort: ${data.escortingOfficer}\nRights Read: Yes`,
      cleared: false,
    };

    cadActions.addCriminalRecord(arrestRecord);

    if (cadState.currentCase) {
      const caseNote = {
        id: `NOTE_${Date.now()}`,
        caseId: cadState.currentCase.caseId,
        author: userActions.getCurrentUserId(),
        content: `ARREST BOOKING COMPLETED\n\nSuspect: ${data.personName} (${data.citizenId})\nCharges: ${data.charges.join(', ')}\nArrest ID: ${arrestRecord.recordId}\n\nAll booking procedures completed including:\n- Miranda rights read and acknowledged\n- Property inventory completed\n- Transport arranged to ${data.transportDestination}`,
        timestamp: new Date().toISOString(),
        type: 'evidence' as const,
      };
      cadActions.addCaseNote(cadState.currentCase.caseId, caseNote);
    }

    terminalActions.addLine(`✓ Arrest booking completed: ${arrestRecord.recordId}`, 'system');
    closeModal();
  };

  const getStepTitle = () => {
    const titles = [
      'Suspect Identification',
      'Charges',
      'Seized Property',
      'Legal Procedures',
      'Transport',
      'Review & Submit',
    ];
    return titles[currentStep() - 1];
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content arrest-wizard" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== ARREST BOOKING WIZARD ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="wizard-progress">
          <For each={Array.from({ length: totalSteps }, (_, i) => i + 1)}>
            {(step) => (
              <div 
                class={`progress-step ${
                  step === currentStep() ? 'active' : 
                  completedSteps().includes(step) ? 'completed' : ''
                }`}
              >
                <div class="step-number">{step}</div>
                <div class="step-label">{getStepTitle().split(' ')[0]}</div>
              </div>
            )}
          </For>
        </div>

        <div class="step-title">
          Step {currentStep()} of {totalSteps}: {getStepTitle()}
        </div>

        <Show when={errors().length > 0}>
          <div class="error-box">
            <For each={errors()}>
              {(error) => <div class="error-item">⚠️ {error}</div>}
            </For>
          </div>
        </Show>

        <div class="wizard-content">
          <Show when={currentStep() === 1}>
            <div class="form-section">
              <label class="form-label">[CITIZEN ID] *</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={arrestData().citizenId}
                onInput={(e) => setArrestData({ ...arrestData(), citizenId: e.currentTarget.value })}
                placeholder="Enter citizen ID..."
              />
            </div>
            <div class="form-section">
              <label class="form-label">[FULL NAME] *</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={arrestData().personName}
                onInput={(e) => setArrestData({ ...arrestData(), personName: e.currentTarget.value })}
                placeholder="Enter full name..."
              />
            </div>
          </Show>

          <Show when={currentStep() === 2}>
            <div class="form-section">
              <label class="form-label">[SELECT CHARGE]</label>
              <Select.Root
                class="dos-select"
                value={selectedCharge()}
                onChange={(e) => setSelectedCharge(e.currentTarget.value)}
              >
                <option value="">-- Select Penal Code --</option>
                <For each={PENAL_CODES}>
                  {(code) => (
                    <option value={`${code.code} - ${code.description}`}>
                      {code.code} - {code.description}
                    </option>
                  )}
                </For>
              </Select.Root>
              <Button.Root class="btn" onClick={addCharge} disabled={!selectedCharge()}>
                [ADD CHARGE]
              </Button.Root>
            </div>
            <div class="form-section">
              <label class="form-label">[CUSTOM CHARGE]</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input.Root
                  type="text"
                  class="dos-input"
                  value={customCharge()}
                  onInput={(e) => setCustomCharge(e.currentTarget.value)}
                  placeholder="Enter custom charge..."
                />
                <Button.Root class="btn" onClick={addCharge} disabled={!customCharge().trim()}>
                  [ADD]
                </Button.Root>
              </div>
            </div>
            <div class="selected-items">
              <label class="form-label">[SELECTED CHARGES] *</label>
              <Show when={arrestData().charges.length === 0}>
                <div class="empty-notice">No charges added yet</div>
              </Show>
              <For each={arrestData().charges}>
                {(charge) => (
                  <div class="item-tag">
                    {charge}
                    <Button.Root class="btn-remove" onClick={() => removeCharge(charge)}>✕</Button.Root>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={currentStep() === 3}>
            <div class="form-section">
              <label class="form-label">[SEIZED ITEMS]</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input.Root
                  type="text"
                  class="dos-input"
                  value={newItem()}
                  onInput={(e) => setNewItem(e.currentTarget.value)}
                  placeholder="Describe item..."
                />
                <Button.Root class="btn" onClick={addSeizedItem} disabled={!newItem().trim()}>
                  [ADD ITEM]
                </Button.Root>
              </div>
            </div>
            <div class="selected-items">
              <Show when={arrestData().seizedItems.length === 0}>
                <div class="empty-notice">No items seized</div>
              </Show>
              <For each={arrestData().seizedItems}>
                {(item) => (
                  <div class="item-tag">
                    {item}
                    <Button.Root class="btn-remove" onClick={() => removeSeizedItem(item)}>✕</Button.Root>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={currentStep() === 4}>
            <div class="form-section legal-section">
              <label class="form-label">[MIRANDA RIGHTS]</label>
              <div class="checkbox-item">
                <input
                  type="checkbox"
                  id="rightsRead"
                  checked={arrestData().rightsRead}
                  onChange={(e) => setArrestData({ ...arrestData(), rightsRead: e.currentTarget.checked })}
                />
                <label for="rightsRead">
                  I confirm that Miranda rights were read to the suspect
                </label>
              </div>
              <div class="miranda-text">
                "You have the right to remain silent. Anything you say can and will be used 
                against you in a court of law. You have the right to an attorney. If you cannot 
                afford an attorney, one will be provided for you."
              </div>
            </div>
            <div class="form-section">
              <label class="form-label">[ADDITIONAL NOTES]</label>
              <Textarea.Root
                class="dos-textarea"
                value={arrestData().notes}
                onInput={(e) => setArrestData({ ...arrestData(), notes: e.currentTarget.value })}
                placeholder="Any additional observations or statements..."
                rows={4}
              />
            </div>
          </Show>

          <Show when={currentStep() === 5}>
            <div class="form-section">
              <label class="form-label">[TRANSPORT DESTINATION] *</label>
              <Select.Root
                class="dos-select"
                value={arrestData().transportDestination}
                onChange={(e) => setArrestData({ ...arrestData(), transportDestination: e.currentTarget.value })}
              >
                <option value="">-- Select Destination --</option>
                <option value="Mission Row PD">Mission Row Police Department</option>
                <option value="Los Santos County Jail">Los Santos County Jail</option>
                <option value="Pillbox Hospital">Pillbox Hospital (Medical Clearance)</option>
                <option value="Juvenile Hall">Juvenile Hall</option>
              </Select.Root>
            </div>
            <div class="form-section">
              <label class="form-label">[ESCORTING OFFICER] *</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={arrestData().escortingOfficer}
                onInput={(e) => setArrestData({ ...arrestData(), escortingOfficer: e.currentTarget.value })}
                placeholder="Enter officer badge/name..."
              />
            </div>
          </Show>

          <Show when={currentStep() === 6}>
            <div class="review-section">
              <h3>=== BOOKING SUMMARY ===</h3>
              
              <div class="review-item">
                <strong>Suspect:</strong> {arrestData().personName} ({arrestData().citizenId})
              </div>
              
              <div class="review-item">
                <strong>Charges:</strong>
                <ul>
                  <For each={arrestData().charges}>
                    {(charge) => <li>{charge}</li>}
                  </For>
                </ul>
              </div>
              
              <Show when={arrestData().seizedItems.length > 0}>
                <div class="review-item">
                  <strong>Seized Items:</strong> {arrestData().seizedItems.join(', ')}
                </div>
              </Show>
              
              <div class="review-item">
                <strong>Rights Read:</strong> {arrestData().rightsRead ? '✓ Yes' : '✗ No'}
              </div>
              
              <div class="review-item">
                <strong>Transport:</strong> {arrestData().transportDestination}
              </div>
              
              <div class="review-item">
                <strong>Escort:</strong> {arrestData().escortingOfficer}
              </div>
              
              <div class="review-item">
                <strong>Booking Officer:</strong> {userActions.getCurrentUserName()}
              </div>

              <div class="review-warning">
                ⚠️ By submitting, you confirm all information is accurate and complete.
                This record cannot be modified after submission.
              </div>
            </div>
          </Show>
        </div>

        <div class="wizard-footer">
          <Show when={currentStep() > 1}>
            <Button.Root class="btn" onClick={prevStep}>
              [← PREVIOUS]
            </Button.Root>
          </Show>
          
          <Show when={currentStep() < totalSteps} fallback={
            <Button.Root class="btn btn-primary" onClick={submitArrest}>
              [SUBMIT BOOKING ✓]
            </Button.Root>
          }>
            <Button.Root class="btn btn-primary" onClick={nextStep}>
              [NEXT →]
            </Button.Root>
          </Show>
          
          <Button.Root class="btn" onClick={closeModal}>
            [CANCEL]
          </Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
