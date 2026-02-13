import { Show, createMemo } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';

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

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  return (
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content notepad-viewer" onClick={(event) => event.stopPropagation()}>
        <div class="modal-header">
          <h2>=== EVIDENCE DOCUMENT ===</h2>
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

          <div class="notepad-sheet">
            {documentText()}
          </div>

          <Show when={externalUrl()}>
            <div class="notepad-meta" style={{ 'margin-top': '12px' }}>
              <div>External URL:</div>
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
          <button class="btn" onClick={closeModal}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
