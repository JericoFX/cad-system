import { createSignal, createMemo, For, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { t } from '~/utils/i18n';
import type { Evidence } from '~/stores/cadStore';
import { Button, Input, Modal } from '~/components/ui';

export function ForensicCollection() {
  const [evidenceType, setEvidenceType] = createSignal('FINGERPRINT');
  const [description, setDescription] = createSignal('');
  const [isCollecting, setIsCollecting] = createSignal(false);
  const [collectedEvidence, setCollectedEvidence] = createSignal<Evidence | null>(null);
  const [caseId, setCaseId] = createSignal('');
  
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
              <Input.Root type="range" class="dos-input" min="0" max="100" value={quality()} onInput={(e) => setQuality(parseInt(e.currentTarget.value))} />
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

          <div class="form-section">
            <label class="form-label">{t('forensics.workflowTitle')}</label>
            <div class="inventory-category">{t('forensics.workflow1')}</div>
            <div class="inventory-category">{t('forensics.workflow2')}</div>
            <div class="inventory-category">{t('forensics.workflow3')}</div>
            <div class="inventory-category">{t('forensics.workflow4')}</div>
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
        </div>
      </div>
    </Modal.Root>
  );
}
