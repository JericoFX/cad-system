import { Show, createMemo } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { t } from '~/utils/i18n';
import { Button, Modal } from '~/components/ui';

type DocumentModalData = {
  title?: string;
  evidenceType?: string;
  evidenceId?: string;
  payload?: Record<string, unknown>;
};

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

export function EvidenceDocumentViewer() {
  const modalData = createMemo(() => {
    return ((terminalState.modalData as DocumentModalData | null) || null);
  });

  const payload = createMemo(() => modalData()?.payload || {});

  const documentText = createMemo(() => {
    const data = payload();
    const preferredKeys = ['content', 'text', 'document', 'description', 'notes'] as const;

    for (let i = 0; i < preferredKeys.length; i++) {
      const key = preferredKeys[i];
      const value = data[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }

    return toPrettyJson(data);
  });

  const externalUrl = createMemo(() => {
    const value = payload().url;
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    const lower = value.toLowerCase();
    if (lower.startsWith('data:')) {
      return null;
    }

    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      return value;
    }

    return null;
  });

  const forensicRows = createMemo(() => {
    const data = payload();
    const type = String(modalData()?.evidenceType || '').toUpperCase();
    const rows: Array<{ label: string; value: string }> = [];

    const pushRow = (label: string, value: unknown) => {
      if (value === undefined || value === null) return;
      const text = String(value).trim();
      if (!text) return;
      rows.push({ label, value: text });
    };

    const shouldShow =
      type === 'BIOLOGICAL' ||
      type === 'DNA' ||
      type === 'BLOOD' ||
      type === 'FINGERPRINT' ||
      type === 'CASING' ||
      type === 'BULLET' ||
      type === 'FIBERS';

    if (!shouldShow) {
      return rows;
    }

    pushRow(t('evidence.forensic.description'), data.description);
    pushRow(t('evidence.forensic.labStatus'), data.labStatus);
    pushRow(t('evidence.forensic.dnaHash'), data.dnaHash);
    pushRow(t('evidence.forensic.profile'), data.profile);
    pushRow(t('evidence.forensic.sampleType'), data.sampleType);
    pushRow(t('evidence.forensic.sampleSource'), data.sampleSource);
    pushRow(t('evidence.forensic.collectedAt'), data.collectedAt);
    pushRow(t('evidence.forensic.collectedBy'), data.collectedBy);
    pushRow(t('evidence.forensic.bloodType'), data.bloodType);
    pushRow(t('evidence.forensic.quality'), data.quality);
    pushRow(t('evidence.forensic.caliber'), data.caliber);
    pushRow(t('evidence.forensic.markings'), data.markings);
    pushRow(t('evidence.forensic.fiberColor'), data.color || data.fiberColor);
    pushRow(t('evidence.forensic.material'), data.material);

    return rows;
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content notepad-viewer" onClick={(event) => event.stopPropagation()}>
        <div class="modal-header">
          <h2>{t('evidence.documentTitle')}</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div style={{ padding: '20px' }}>
          <div class="notepad-header">
            <span class="notepad-type" style={{ color: '#00ff00', 'font-weight': 'bold' }}>
              [{modalData()?.evidenceType || 'DOCUMENT'}]
            </span>
            <span class="notepad-timestamp">
              {modalData()?.evidenceId || 'N/A'}
            </span>
          </div>

          <Show when={modalData()?.title}>
            <div style={{ color: '#ffff00', 'margin-bottom': '12px', 'font-weight': 'bold' }}>
              {modalData()?.title}
            </div>
          </Show>

          <Show when={forensicRows().length > 0}>
            <div class="notepad-sheet" style={{ 'margin-bottom': '12px' }}>
              <div style={{ color: '#ffff00', 'font-weight': 'bold', 'margin-bottom': '8px' }}>
                {t('evidence.forensic.title')}
              </div>
              <Show when={forensicRows().length > 0}>
                <div style={{ display: 'grid', gap: '4px' }}>
                  {forensicRows().map((row) => (
                    <div>
                      <strong>{row.label}:</strong> {row.value}
                    </div>
                  ))}
                </div>
              </Show>
            </div>
          </Show>

          <div class="notepad-sheet">
            {documentText()}
          </div>

          <Show when={externalUrl()}>
            <div class="notepad-meta" style={{ 'margin-top': '12px' }}>
              <div>{t('evidence.externalUrl')}</div>
              <a
                href={externalUrl() || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00ffff', 'word-break': 'break-all' }}
              >
                {externalUrl()}
              </a>
            </div>
          </Show>
        </div>

        <div class="modal-footer">
          <Button.Root class="btn" onClick={closeModal}>{t('evidence.close')}</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
