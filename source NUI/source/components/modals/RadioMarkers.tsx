import { createSignal, For, Show, createMemo } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { Button, Modal } from '~/components/ui';

export function RadioMarkers() {
  const [filter, setFilter] = createSignal<'all' | 'linked' | 'unlinked'>('all');
  const [selectedMarker, setSelectedMarker] = createSignal<string | null>(null);

  const markers = createMemo(() => {
    const all = cadActions.getAllMarkers();
    switch (filter()) {
      case 'linked':
        return all.filter(m => m.linkedCaseId || m.linkedCallId);
      case 'unlinked':
        return all.filter(m => !m.linkedCaseId && !m.linkedCallId);
      default:
        return all;
    }
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const linkToCurrentCase = (markerId: string) => {
    if (!cadState.currentCase) {
      terminalActions.addLine('No active case to link to', 'error');
      return;
    }
    cadActions.linkMarkerToCase(markerId, cadState.currentCase.caseId);
    terminalActions.addLine(`Marker linked to case ${cadState.currentCase.caseId}`, 'system');
  };

  const deleteMarker = (markerId: string) => {
    cadActions.removeRadioMarker(markerId);
    setSelectedMarker(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content radio-markers" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== RADIO TRANSCRIPT MARKERS ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="markers-filters">
          <button 
            class={`btn ${filter() === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('all')}
          >
            [ALL ({markers().length})]
          </button>
          <button 
            class={`btn ${filter() === 'linked' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('linked')}
          >
            [LINKED]
          </button>
          <button 
            class={`btn ${filter() === 'unlinked' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('unlinked')}
          >
            [UNLINKED]
          </button>
        </div>

        <div class="markers-list">
          <Show when={markers().length === 0}>
            <div class="empty-state">No radio markers found</div>
          </Show>

          <For each={markers()}>
            {(marker) => (
              <div 
                class={`marker-card ${selectedMarker() === marker.markerId ? 'selected' : ''}`}
                onClick={() => setSelectedMarker(selectedMarker() === marker.markerId ? null : marker.markerId)}
              >
                <div class="marker-header">
                  <span class="marker-id">{marker.markerId.substring(0, 12)}</span>
                  <span class="marker-time">{formatDate(marker.timestamp)}</span>
                </div>
                
                <div class="marker-content">
                  <div class="marker-meta">
                    <strong>{marker.sender}</strong> via {marker.channel}
                  </div>
                  <div class="marker-message">{marker.message}</div>
                </div>

                <Show when={marker.linkedCaseId || marker.linkedCallId}>
                  <div class="marker-links">
                    <Show when={marker.linkedCaseId}>
                      <span class="link-badge case">📁 Case: {marker.linkedCaseId}</span>
                    </Show>
                    <Show when={marker.linkedCallId}>
                      <span class="link-badge call">📞 Call: {marker.linkedCallId}</span>
                    </Show>
                  </div>
                </Show>

                <Show when={selectedMarker() === marker.markerId}>
                  <div class="marker-actions">
                    <Show when={!marker.linkedCaseId}>
                      <Button.Root 
                        class="btn btn-primary"
                        onClick={() => linkToCurrentCase(marker.markerId)}
                        disabled={!cadState.currentCase}
                      >
                        {cadState.currentCase ? `[LINK TO ${cadState.currentCase.caseId}]` : '[NO ACTIVE CASE]'}
                      </Button.Root>
                    </Show>
                    
                    <Show when={marker.linkedCaseId}>
                      <Button.Root 
                        class="btn"
                        onClick={() => terminalActions.setActiveModal('NOTES', { caseId: marker.linkedCaseId })}
                      >
                        [VIEW CASE]
                      </Button.Root>
                    </Show>
                    
                    <Button.Root 
                      class="btn btn-danger"
                      onClick={() => deleteMarker(marker.markerId)}
                    >
                      [DELETE]
                    </Button.Root>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            Total: {cadActions.getAllMarkers().length} markers
          </span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
