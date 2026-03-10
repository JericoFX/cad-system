import { createSignal, Show, For, createMemo } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { Button, Modal, Tabs } from '~/components/ui';

export function PersonSnapshot() {
  const modalData = terminalState.modalData as { citizenId?: string } | null;
  const [activeTab, setActiveTab] = createSignal<'overview' | 'records' | 'vehicles' | 'cases' | 'medical'>('overview');
  
  const person = createMemo(() => {
    const citizenId = modalData?.citizenId;
    if (!citizenId) return null;
    return cadState.persons[citizenId] || null;
  });

  const warrants = createMemo(() => {
    const p = person();
    if (!p) return [];
    return Object.values(cadState.warrants).filter(w => 
      w.citizenid === p.citizenid && w.active
    );
  });

  const criminalRecords = createMemo(() => {
    const p = person();
    if (!p) return [];
    return Object.values(cadState.criminalRecords).filter(r => 
      r.citizenid === p.citizenid && !r.cleared
    );
  });

  const vehicles = createMemo(() => {
    const p = person();
    if (!p) return [];
    return Object.values(cadState.vehicles).filter(v => v.ownerId === p.citizenid);
  });

  const activeCases = createMemo(() => {
    const p = person();
    if (!p) return [];
    return Object.values(cadState.cases).filter(c => 
      c.personId === p.citizenid && c.status === 'OPEN'
    );
  });

  const bolo = createMemo(() => {
    const p = person();
    if (!p) return null;
    return cadActions.checkBOLO('PERSON', p.citizenid);
  });

  const flags = createMemo(() => person()?.flags || []);

  const statusBadges = createMemo(() => {
    const p = person();
    if (!p) return [] as Array<{ label: string; tone: string }>;

    const badges: Array<{ label: string; tone: string }> = [];
    if (p.isDead) badges.push({ label: 'DECEASED', tone: '#ff7b72' });
    if (warrants().length > 0) badges.push({ label: `${warrants().length} WARRANT${warrants().length > 1 ? 'S' : ''}`, tone: '#ffb86c' });
    if (bolo()) badges.push({ label: 'BOLO', tone: '#ff5555' });
    if (vehicles().some((vehicle) => vehicle.stolen)) badges.push({ label: 'STOLEN VEHICLE LINK', tone: '#ffd166' });
    return badges;
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const createCase = () => {
    const p = person();
    if (!p) return;
    terminalActions.setActiveModal('CASE_CREATOR', {
      personId: p.citizenid,
      personName: `${p.firstName} ${p.lastName}`
    });
  };

  const createArrest = () => {
    const p = person();
    if (!p) return;
    terminalActions.setActiveModal('ARREST_WIZARD', {
      citizenId: p.citizenid,
      personName: `${p.firstName} ${p.lastName}`
    });
  };

  const openPhoneIntel = () => {
    const p = person();
    if (!p) return;

    terminalActions.setActiveModal('PERSON_SEARCH', {
      citizenId: p.citizenid,
      tab: 'phone',
      phoneNumber: p.phone || undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getFlagColor = (flag: string) => {
    const colors: Record<string, string> = {
      'GANG_AFFILIATED': '#ff0000',
      'MENTAL_HEALTH': '#ff8800',
      'SUICIDE_RISK': '#ff0000',
      'VIOLENT': '#ff0000',
      'DRUG_HISTORY': '#ffff00',
      'WEAPON_PERMIT': '#00ff00',
      'CONCEALED_CARRY': '#00ff00',
    };
    return colors[flag] || '#808080';
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content person-snapshot" onClick={(e) => e.stopPropagation()}>
        <Show 
          when={person()} 
          fallback={
            <div class="modal-content">
              <div class="modal-header">
                <h2>=== PERSON NOT FOUND ===</h2>
                <button class="modal-close" onClick={closeModal}>[X]</button>
              </div>
              <div class="empty-state" style={{ padding: '40px', 'text-align': 'center' }}>
                Citizen ID not found in cached MDT records
              </div>
            </div>
          }
        >
          <div class="snapshot-header">
            <div class="header-main">
              <div class="person-photo">
                {person()!.photo ? (
                  <img src={person()!.photo} alt="Mugshot" />
                ) : (
                  <div class="photo-placeholder">👤</div>
                )}
              </div>
              <div class="person-info">
                <h2>{person()!.firstName} {person()!.lastName}</h2>
                <div class="person-meta">
                  <span class="meta-item">ID: {person()!.citizenid}</span>
                  <span class="meta-item">DOB: {formatDate(person()!.dateOfBirth)}</span>
                  <span class="meta-item">Gender: {person()!.gender}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-top': '8px' }}>
                  <For each={statusBadges()}>
                    {(badge) => (
                      <span
                        style={{
                          padding: '2px 8px',
                          border: `1px solid ${badge.tone}`,
                          color: badge.tone,
                          'font-size': '11px',
                          'letter-spacing': '0.06em',
                        }}
                      >
                        {badge.label}
                      </span>
                    )}
                  </For>
                </div>
                
                <Show when={warrants().length > 0 || bolo() || person()!.isDead}>
                  <div class="warning-flags">
                    <Show when={person()!.isDead}>
                      <span class="flag deceased">☠️ DECEASED</span>
                    </Show>
                    <Show when={warrants().length > 0}>
                      <span class="flag warrant">⚠️ {warrants().length} ACTIVE WARRANT{warrants().length > 1 ? 'S' : ''}</span>
                    </Show>
                    <Show when={bolo()}>
                      <span class="flag bolo">🔴 BOLO</span>
                    </Show>
                  </div>
                </Show>

                <Show when={flags().length > 0}>
                  <div class="status-flags">
                    <For each={flags()}>
                      {(flag) => (
                        <span class="status-flag" style={{ color: getFlagColor(flag) }}>
                          {flag}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="summary-stats" style={{ 'margin-top': '12px' }}>
                  <div class="stat-box warrant">
                    <div class="stat-number">{warrants().length}</div>
                    <div class="stat-label">Warrants</div>
                  </div>
                  <div class="stat-box record">
                    <div class="stat-number">{criminalRecords().length}</div>
                    <div class="stat-label">Records</div>
                  </div>
                  <div class="stat-box vehicle">
                    <div class="stat-number">{vehicles().length}</div>
                    <div class="stat-label">Vehicles</div>
                  </div>
                  <div class="stat-box case">
                    <div class="stat-number">{activeCases().length}</div>
                    <div class="stat-label">Open Cases</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="header-actions">
              <Button.Root class="btn btn-primary" onClick={createCase}>
                [CREATE CASE]
              </Button.Root>
              <Button.Root class="btn" onClick={createArrest}>
                [ARREST]
              </Button.Root>
              <Button.Root class="btn" onClick={openPhoneIntel}>
                [PHONE INTEL]
              </Button.Root>
              <Show when={cadState.currentCase}>
                <Button.Root 
                  class="btn"
                  onClick={() => {
                    terminalActions.setActiveModal('NOTES', {
                      caseId: cadState.currentCase!.caseId,
                      personName: `${person()!.firstName} ${person()!.lastName}`
                    });
                  }}
                >
                  [ADD NOTE]
                </Button.Root>
              </Show>
            </div>
          </div>

          <Tabs.Root
            value={activeTab()}
            onValueChange={(value) => setActiveTab(value as 'overview' | 'records' | 'vehicles' | 'cases' | 'medical')}
          >
            <Tabs.List class='snapshot-tabs'>
              <Tabs.Trigger value='overview' label='OVERVIEW' />
              <Tabs.Trigger value='records' label='RECORDS' badge={criminalRecords().length} />
              <Tabs.Trigger value='vehicles' label='VEHICLES' badge={vehicles().length} />
              <Tabs.Trigger value='cases' label='CASES' badge={activeCases().length} />
              <Tabs.Trigger value='medical' label='MEDICAL' />
            </Tabs.List>
          </Tabs.Root>

          <div class="snapshot-content">
            <Show when={activeTab() === 'overview'}>
              <div class="overview-grid">
                <div class="info-section">
                  <h4>Personal Information</h4>
                  <div class="info-row"><strong>SSN:</strong> {person()!.ssn}</div>
                  <div class="info-row"><strong>Phone:</strong> {person()!.phone || 'N/A'}</div>
                  <div class="info-row"><strong>Address:</strong> {person()!.address || 'N/A'}</div>
                  <div class="info-row"><strong>Height:</strong> {person()!.height || 'N/A'}</div>
                  <div class="info-row"><strong>Weight:</strong> {person()!.weight || 'N/A'}</div>
                  <div class="info-row"><strong>Eye Color:</strong> {person()!.eyeColor || 'N/A'}</div>
                  <div class="info-row"><strong>Hair Color:</strong> {person()!.hairColor || 'N/A'}</div>
                  <div class="info-row"><strong>Phone Intel:</strong> Lookup by number/IMEI available</div>
                </div>

                <div class="info-section">
                  <h4>Summary</h4>
                  <div class="info-row"><strong>BOLO:</strong> {bolo() ? bolo()!.reason : 'No active BOLO'}</div>
                  <div class="info-row"><strong>Status:</strong> {person()!.isDead ? 'DECEASED' : 'ACTIVE RECORD'}</div>
                  <div class="info-row"><strong>Last Updated:</strong> {formatDate(person()!.lastUpdated)}</div>
                  <div class="info-row"><strong>Phone Intel:</strong> Open phone tab for number/IMEI cross-check</div>
                </div>

                <div class="info-section">
                  <h4>Medical Info</h4>
                  <div class="info-row"><strong>Blood Type:</strong> {person()!.bloodType || 'Not recorded'}</div>
                  <div class="info-row"><strong>Allergies:</strong> {person()!.allergies || 'None recorded'}</div>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === 'records'}>
              <div class="records-list">
                <h4>Criminal History</h4>
                <Show when={criminalRecords().length === 0}>
                  <div class="empty-state">No active criminal records on file</div>
                </Show>
                <For each={criminalRecords()}>
                  {(record) => (
                    <div class="record-card">
                      <div class="record-header">
                        <span class="record-id">{record.recordId}</span>
                        <span class="record-date">{formatDate(record.arrestedAt)}</span>
                      </div>
                      <div class="record-charges">{record.charges.join(', ')}</div>
                      <div class="record-officer">By: {record.arrestingOfficerName}</div>
                    </div>
                  )}
                </For>

                <h4 style={{ 'margin-top': '24px' }}>Active Warrants</h4>
                <Show when={warrants().length === 0}>
                  <div class="empty-state">No active warrants on file</div>
                </Show>
                <For each={warrants()}>
                  {(warrant) => (
                    <div class="warrant-card">
                      <div class="warrant-type">{warrant.type} WARRANT</div>
                      <div class="warrant-reason">{warrant.reason}</div>
                      <div class="warrant-meta">
                        Issued: {formatDate(warrant.issuedAt)} by {warrant.issuedByName}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={activeTab() === 'vehicles'}>
              <div class="vehicles-list">
                <Show when={vehicles().length === 0}>
                  <div class="empty-state">No registered vehicles linked to this citizen</div>
                </Show>
                <For each={vehicles()}>
                  {(vehicle) => (
                    <div class={`vehicle-card ${vehicle.stolen ? 'stolen' : ''}`}>
                      <div class="vehicle-plate">{vehicle.plate}</div>
                      <div class="vehicle-details">
                        {vehicle.year} {vehicle.make} {vehicle.model} - {vehicle.color}
                      </div>
                      <div class="vehicle-status">
                        <Show when={vehicle.stolen}>
                          <span class="stolen-tag">🔴 STOLEN</span>
                        </Show>
                        <span class={`status-tag ${vehicle.registrationStatus.toLowerCase()}`}>
                          Reg: {vehicle.registrationStatus}
                        </span>
                        <span class={`status-tag ${vehicle.insuranceStatus.toLowerCase()}`}>
                          Ins: {vehicle.insuranceStatus}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={activeTab() === 'cases'}>
              <div class="cases-list">
                <Show when={activeCases().length === 0}>
                  <div class="empty-state">No open cases linked to this person</div>
                </Show>
                <For each={activeCases()}>
                  {(caseItem) => (
                    <div class="case-card">
                      <div class="case-header">
                        <span class="case-id">{caseItem.caseId}</span>
                        <span class={`case-priority priority-${caseItem.priority === 1 ? 'high' : caseItem.priority === 2 ? 'med' : 'low'}`}>
                          {caseItem.priority === 1 ? 'HIGH' : caseItem.priority === 2 ? 'MED' : 'LOW'}
                        </span>
                      </div>
                      <div class="case-title">{caseItem.title}</div>
                      <div class="case-type">{caseItem.caseType}</div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={activeTab() === 'medical'}>
              <div class="medical-info">
                <div class="medical-section">
                  <h4>Emergency Medical Information</h4>
                  <div class="info-row warning">
                    <strong>Blood Type:</strong> {person()!.bloodType || 'Not recorded - check ID card'}
                  </div>
                  <div class="info-row">
                    <strong>Allergies:</strong> {person()!.allergies || 'None recorded'}
                  </div>
                  <Show when={person()!.isDead}>
                    <div class="info-row deceased">
                      <strong>Status:</strong> DECEASED - {person()!.ckDate ? `Date: ${formatDate(person()!.ckDate || '')}` : 'Date unknown'}
                    </div>
                  </Show>
                </div>
                
                <div class="medical-notice">
                  <strong>⚠️ MEDICAL DISCLAIMER:</strong>
                  <p>This information is for emergency response purposes only. 
                  Always verify critical medical information with the individual or medical ID card.</p>
                </div>
              </div>
            </Show>
          </div>

          <div class="modal-footer">
            <span style={{ color: '#808080' }}>
              Last Updated: {formatDate(person()!.lastUpdated)}
            </span>
            <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
          </div>
        </Show>
      </div>
    </Modal.Root>
  );
}
