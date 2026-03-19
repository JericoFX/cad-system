import { createSignal, For, Show, createMemo, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import type { BOLO } from '~/stores/cadStore';
import { Button, Input, Modal, Select, Tabs, Textarea, getPriorityColor } from '~/components/ui';
import { formatDateTime } from '~/utils/storeHelpers/dateHelpers';

export function BoloManager() {
  const [activeTab, setActiveTab] = createSignal<'all' | 'person' | 'vehicle'>('all');
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [selectedBolo, setSelectedBolo] = createSignal<BOLO | null>(null);
  
  const [boloType, setBoloType] = createSignal<'PERSON' | 'VEHICLE'>('PERSON');
  const [identifier, setIdentifier] = createSignal('');
  const [reason, setReason] = createSignal('');
  const [priority, setPriority] = createSignal<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  onMount(() => {
    const modalData = (terminalState.modalData as {
      type?: 'PERSON' | 'VEHICLE';
      identifier?: string;
      reason?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    } | null) || null;

    if (!modalData) {
      return;
    }

    if (modalData.type === 'PERSON' || modalData.type === 'VEHICLE') {
      setBoloType(modalData.type);
    }

    if (typeof modalData.identifier === 'string' && modalData.identifier.trim() !== '') {
      setIdentifier(modalData.identifier.trim().toUpperCase());
      setShowCreateForm(true);
    }

    if (typeof modalData.reason === 'string' && modalData.reason.trim() !== '') {
      setReason(modalData.reason.trim());
    }

    if (modalData.priority === 'LOW' || modalData.priority === 'MEDIUM' || modalData.priority === 'HIGH') {
      setPriority(modalData.priority);
    }
  });

  const bolos = createMemo(() => {
    const all = Object.values(cadState.bolos).filter(b => b.active);
    switch (activeTab()) {
      case 'person':
        return all.filter(b => b.type === 'PERSON');
      case 'vehicle':
        return all.filter(b => b.type === 'VEHICLE');
      default:
        return all;
    }
  });

  const boloSummary = createMemo(() => {
    const active = Object.values(cadState.bolos).filter((entry) => entry.active);
    return {
      total: active.length,
      persons: active.filter((entry) => entry.type === 'PERSON').length,
      vehicles: active.filter((entry) => entry.type === 'VEHICLE').length,
      high: active.filter((entry) => entry.priority === 'HIGH').length,
    };
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const createBOLO = () => {
    if (!identifier().trim() || !reason().trim()) {
      terminalActions.addLine('Identifier and reason are required', 'error');
      return;
    }

    const bolo: BOLO = {
      boloId: `BOLO_${Date.now()}`,
      type: boloType(),
      identifier: identifier().toUpperCase(),
      reason: reason(),
      issuedBy: userActions.getCurrentUserId(),
      issuedByName: userActions.getCurrentUserName(),
      issuedAt: new Date().toISOString(),
      priority: priority(),
      active: true,
    };

    cadActions.addBOLO(bolo);
    terminalActions.addLine(`✓ BOLO issued: ${bolo.boloId}`, 'system');
    
    setIdentifier('');
    setReason('');
    setPriority('MEDIUM');
    setShowCreateForm(false);
  };

  const removeBOLO = (boloId: string) => {
    cadActions.removeBOLO(boloId);
    setSelectedBolo(null);
    terminalActions.addLine('BOLO removed', 'system');
  };

  const formatDate = (dateStr: string) => formatDateTime(dateStr);

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content bolo-manager" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== BOLO MANAGER ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="bolo-stats">
          <div class="stat-item">
            <span class="stat-number">{boloSummary().total}</span>
            <span class="stat-label">ACTIVE</span>
          </div>
          <div class="stat-item high">
            <span class="stat-number">{boloSummary().high}</span>
            <span class="stat-label">HIGH PRIORITY</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{boloSummary().persons}</span>
            <span class="stat-label">PERSONS</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{boloSummary().vehicles}</span>
            <span class="stat-label">VEHICLES</span>
          </div>
        </div>

        <Tabs.Root
          value={activeTab()}
          onValueChange={(value) => setActiveTab(value as 'all' | 'person' | 'vehicle')}
        >
          <Tabs.List class='bolo-tabs'>
            <Tabs.Trigger value='all' label='ALL' badge={bolos().length} />
            <Tabs.Trigger value='person' label='PERSONS' badge={bolos().filter(b => b.type === 'PERSON').length} />
            <Tabs.Trigger value='vehicle' label='VEHICLES' badge={bolos().filter(b => b.type === 'VEHICLE').length} />
          </Tabs.List>
        </Tabs.Root>

        <div class="bolo-actions">
          <Button.Root 
            class="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm())}
          >
            {showCreateForm() ? '[CANCEL]' : '[+ CREATE BOLO]'}
          </Button.Root>
        </div>

        <Show when={!showCreateForm() && bolos().length > 0}>
          <div class="case-modal-hint">Select a BOLO to open record actions, arrest flow, or remove the alert.</div>
        </Show>

        <Show when={showCreateForm()}>
          <div class="bolo-create-form">
            <h3>=== CREATE NEW BOLO ===</h3>
            
            <div class="form-section">
              <label class="form-label">[TYPE]</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input 
                    type="radio" 
                    name="boloType" 
                    value="PERSON"
                    checked={boloType() === 'PERSON'}
                    onChange={() => setBoloType('PERSON')}
                  />
                  PERSON
                </label>
                <label class="radio-label">
                  <input 
                    type="radio" 
                    name="boloType" 
                    value="VEHICLE"
                    checked={boloType() === 'VEHICLE'}
                    onChange={() => setBoloType('VEHICLE')}
                  />
                  VEHICLE
                </label>
              </div>
            </div>

            <div class="form-section">
              <label class="form-label">[{boloType() === 'PERSON' ? 'CITIZEN ID' : 'LICENSE PLATE'}]</label>
              <Input.Root
                type="text"
                class="dos-input"
                value={identifier()}
                onInput={(e) => setIdentifier(e.currentTarget.value)}
                placeholder={boloType() === 'PERSON' ? 'Enter citizen ID...' : 'Enter plate number...'}
              />
            </div>

            <div class="form-section">
              <label class="form-label">[REASON]</label>
              <Textarea.Root
                class="dos-textarea"
                value={reason()}
                onInput={(e) => setReason(e.currentTarget.value)}
                placeholder="Describe reason for BOLO..."
                rows={3}
              />
            </div>

            <div class="form-section">
              <label class="form-label">[PRIORITY]</label>
              <Select.Root
                class="dos-select"
                value={priority()}
                onChange={(e) => setPriority(e.currentTarget.value as 'LOW' | 'MEDIUM' | 'HIGH')}
              >
                <option value="LOW">🔵 LOW</option>
                <option value="MEDIUM">🟡 MEDIUM</option>
                <option value="HIGH">🔴 HIGH</option>
              </Select.Root>
            </div>

            <div class="form-actions">
              <Button.Root class="btn btn-primary" onClick={createBOLO}>
                [ISSUE BOLO]
              </Button.Root>
            </div>
          </div>
        </Show>

        <div class="bolos-list">
          <Show when={bolos().length === 0}>
            <div class="empty-state">No active BOLO alerts for this filter</div>
          </Show>

          <For each={bolos()}>
            {(bolo) => (
              <div 
                class={`bolo-card ${selectedBolo()?.boloId === bolo.boloId ? 'selected' : ''}`}
                onClick={() => setSelectedBolo(selectedBolo()?.boloId === bolo.boloId ? null : bolo)}
              >
                <div class="bolo-header">
                  <span class="bolo-type">{bolo.type}</span>
                  <span 
                    class="bolo-priority"
                    style={{ color: getPriorityColor(bolo.priority) }}
                  >
                    {bolo.priority === 'HIGH' ? '🔴' : bolo.priority === 'MEDIUM' ? '🟡' : '🔵'} {bolo.priority}
                  </span>
                  <span class="bolo-id">{bolo.boloId.substring(0, 12)}</span>
                </div>

                <div class="bolo-main">
                  <div class="bolo-identifier">{bolo.identifier}</div>
                  <div class="bolo-reason">{bolo.reason}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-top': '8px' }}>
                  <span class="status-badge open">{bolo.type}</span>
                  <Show when={bolo.priority === 'HIGH'}>
                    <span class="status-badge" style={{ color: '#ff5555', border: '1px solid #ff5555' }}>IMMEDIATE ACTION</span>
                  </Show>
                </div>

                <div class="bolo-meta">
                  <span>Issued: {formatDate(bolo.issuedAt)}</span>
                  <span>By: {bolo.issuedByName}</span>
                </div>

                <Show when={selectedBolo()?.boloId === bolo.boloId}>
                  <div class="bolo-actions-row">
                    <Button.Root class="btn" onClick={() => removeBOLO(bolo.boloId)}>
                      [REMOVE BOLO]
                    </Button.Root>
                    <Button.Root 
                      class="btn btn-primary"
                      onClick={() => {
                        if (bolo.type === 'PERSON') {
                          terminalActions.setActiveModal('PERSON_SEARCH', {
                            citizenId: bolo.identifier,
                            query: bolo.identifier,
                          });
                        } else {
                          terminalActions.setActiveModal('VEHICLE_SEARCH', { plate: bolo.identifier });
                        }
                      }}
                    >
                      [SEARCH {bolo.type}]
                    </Button.Root>
                    <Show when={bolo.type === 'PERSON'}>
                      <Button.Root 
                        class="btn btn-primary"
                        style={{ 'background-color': '#ff0000', 'border-color': '#ff0000' }}
                        onClick={() => {
                          const person = Object.values(cadState.persons).find(p => p.citizenid === bolo.identifier);
                          terminalActions.setActiveModal('ARREST_WIZARD', { 
                            citizenId: bolo.identifier,
                            personName: person ? `${person.firstName} ${person.lastName}` : 'Unidentified subject',
                            boloId: bolo.boloId
                          });
                        }}
                      >
                        [ARREST]
                      </Button.Root>
                    </Show>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            Total Active: {bolos().length} BOLOs
          </span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
