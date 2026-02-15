
import { Show, onMount } from 'solid-js';
import { sessionState, sessionActions } from '~/stores/sessionStore';
import { terminalActions } from '~/stores/terminalStore';
import { registry } from '~/commands/registry';
import { notificationActions } from '~/stores/notificationStore';
import { uiPrefsState, uiPrefsActions } from '~/stores/uiPreferencesStore';
import { featureState } from '~/stores/featureStore';
import { CONFIG } from '~/config';

export function SessionContextBar() {
  onMount(() => {
    sessionActions.initialize();
  });

  const switchCase = () => {
    terminalActions.setActiveModal('CASE_MANAGER');
  };

  const clearActiveCase = () => {
    registry.execute('case close');
    sessionActions.clearActiveCase();
  };

  const openLinkedCall = () => {
    if (featureState.dispatch.visible && sessionState.activeCallId) {
      terminalActions.setActiveModal('DISPATCH_PANEL');
      terminalActions.addLine(`Opening dispatch panel for call ${sessionState.activeCallId}...`, 'system');
    }
  };

  const viewCase = () => {
    if (sessionState.activeCaseId) {
      registry.execute(`case view ${sessionState.activeCaseId}`);
    }
  };

  const openRadio = () => {
    terminalActions.setActiveModal('RADIO_PANEL');
  };

  const toggleExpand = () => {
    sessionActions.toggleExpanded();
  };

  return (
    <Show when={sessionState.isVisible}>
      <div 
        class={`session-context-bar ${sessionState.isExpanded ? 'expanded' : ''} ${!sessionActions.hasActiveContext() ? 'empty' : ''}`}
      >
        <div class="session-bar-main" onClick={toggleExpand}>
          <div class="session-bar-status">
            <Show when={sessionState.activeCaseId}>
              <span class="status-indicator case-active" title="Active Case">
                📁
              </span>
            </Show>
            <Show when={featureState.dispatch.visible && sessionState.activeCallId}>
              <span class="status-indicator call-active" title="Active Call">
                📡
              </span>
            </Show>
            <Show when={sessionState.radioChannel}>
              <span class={`status-indicator radio-${sessionState.radioStatus}`} title="Radio">
                📻
              </span>
            </Show>
          </div>
          
          <div class="session-bar-summary">
            <Show when={sessionState.activeCaseId} fallback={<span class="no-context">No active case</span>}>
              <span class="case-id">{sessionState.activeCaseId}</span>
              <Show when={sessionState.activeCaseTitle}>
                <span class="case-title">- {sessionState.activeCaseTitle}</span>
              </Show>
            </Show>
          </div>
          
          <div class="session-bar-officer">
            <Show when={sessionState.officerBadge}>
              <span class="officer-badge">[{sessionState.officerBadge}]</span>
            </Show>
            <Show when={sessionState.officerName}>
              <span class="officer-name">{sessionState.officerName}</span>
            </Show>
          </div>
          
          <button class="session-bar-toggle">
            {sessionState.isExpanded ? '▲' : '▼'}
          </button>
        </div>

        <Show when={sessionState.isExpanded}>
          <div class="session-bar-details">
            <div class="session-section">
              <div class="session-section-header">
                <span class="section-icon">📁</span>
                <span class="section-title">Active Case</span>
              </div>
              <Show 
                when={sessionState.activeCaseId}
                fallback={<div class="section-empty">No case selected</div>}
              >
                <div class="section-content">
                  <div class="info-row">
                    <span class="info-label">Case ID:</span>
                    <span class="info-value case-id-link" onClick={viewCase}>
                      {sessionState.activeCaseId}
                    </span>
                  </div>
                  <Show when={sessionState.activeCaseTitle}>
                    <div class="info-row">
                      <span class="info-label">Title:</span>
                      <span class="info-value">{sessionState.activeCaseTitle}</span>
                    </div>
                  </Show>
                  <div class="section-actions">
                    <button class="section-btn" onClick={viewCase}>
                      View Case
                    </button>
                    <button class="section-btn secondary" onClick={switchCase}>
                      Switch Case
                    </button>
                    <button class="section-btn danger" onClick={clearActiveCase}>
                      Clear
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            <Show when={featureState.dispatch.visible}>
              <div class="session-section">
                <div class="session-section-header">
                  <span class="section-icon">📡</span>
                  <span class="section-title">Active Call</span>
                </div>
                <Show 
                  when={sessionState.activeCallId}
                  fallback={<div class="section-empty">No active call</div>}
                >
                  <div class="section-content">
                    <div class="info-row">
                      <span class="info-label">Call ID:</span>
                      <span class="info-value">{sessionState.activeCallId}</span>
                    </div>
                    <Show when={sessionState.activeCallTitle}>
                      <div class="info-row">
                        <span class="info-label">Title:</span>
                        <span class="info-value">{sessionState.activeCallTitle}</span>
                      </div>
                    </Show>
                    <div class="section-actions">
                      <button class="section-btn" onClick={openLinkedCall}>
                        Open Dispatch
                      </button>
                      <button class="section-btn secondary" onClick={() => sessionActions.clearActiveCall()}>
                        Clear
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            <div class="session-section">
              <div class="session-section-header">
                <span class="section-icon">👮</span>
                <span class="section-title">Officer</span>
              </div>
              <Show 
                when={sessionState.officerBadge}
                fallback={<div class="section-empty">Not logged in</div>}
              >
                <div class="section-content">
                  <div class="info-row">
                    <span class="info-label">Badge:</span>
                    <span class="info-value">{sessionState.officerBadge}</span>
                  </div>
                  <Show when={sessionState.officerName}>
                    <div class="info-row">
                      <span class="info-label">Name:</span>
                      <span class="info-value">{sessionState.officerName}</span>
                    </div>
                  </Show>
                  <Show when={sessionState.officerRole}>
                    <div class="info-row">
                      <span class="info-label">Role:</span>
                      <span class="info-value">{sessionState.officerRole}</span>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>

            <div class="session-section">
              <div class="session-section-header">
                <span class="section-icon">📻</span>
                <span class="section-title">Radio</span>
              </div>
              <Show 
                when={sessionState.radioChannel}
                fallback={<div class="section-empty">Not connected</div>}
              >
                <div class="section-content">
                  <div class="info-row">
                    <span class="info-label">Channel:</span>
                    <span class="info-value">{sessionState.radioChannel}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class={`info-value status-${sessionState.radioStatus}`}>
                      {sessionState.radioStatus.toUpperCase()}
                    </span>
                  </div>
                  <div class="section-actions">
                    <button class="section-btn" onClick={openRadio}>
                      Open Radio
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            <Show when={!CONFIG.DOCK_ONLY}>
              <div class="session-section">
                <div class="session-section-header">
                  <span class="section-icon">🖥️</span>
                  <span class="section-title">Navigation Mode</span>
                </div>
                <div class="section-content">
                  <div class="nav-mode-selector">
                    <button 
                      class={`nav-mode-btn ${uiPrefsState.navigationMode === 'dock' ? 'active' : ''}`}
                      onClick={() => uiPrefsActions.setNavigationMode('dock')}
                      title="Dock only - Icons for quick access"
                    >
                      📱 Dock
                    </button>
                    <button 
                      class={`nav-mode-btn ${uiPrefsState.navigationMode === 'terminal' ? 'active' : ''}`}
                      onClick={() => uiPrefsActions.setNavigationMode('terminal')}
                      title="Terminal only - Command line power"
                    >
                      ⌨️ Terminal
                    </button>
                    <button 
                      class={`nav-mode-btn ${uiPrefsState.navigationMode === 'hybrid' ? 'active' : ''}`}
                      onClick={() => uiPrefsActions.setNavigationMode('hybrid')}
                      title="Hybrid - Best of both worlds"
                    >
                      ⚡ Hybrid
                    </button>
                  </div>
                  <Show when={uiPrefsState.navigationMode === 'hybrid'}>
                    <div class="nav-mode-options">
                      <label class="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={uiPrefsState.autoHideDockOnTyping}
                          onChange={(e) => uiPrefsActions.setAutoHideDockOnTyping(e.currentTarget.checked)}
                        />
                        <span>Auto-hide dock when typing</span>
                      </label>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            <div class="session-section quick-actions">
              <div class="section-actions full-width">
                <button class="section-btn" onClick={() => notificationActions.toggle()}>
                  🔔 Notifications
                </button>
                <Show when={featureState.dispatch.visible}>
                  <button class="section-btn secondary" onClick={() => terminalActions.setActiveModal('DISPATCH_PANEL')}>
                    📡 Dispatch
                  </button>
                </Show>
                <button class="section-btn secondary" onClick={() => terminalActions.setActiveModal('CASE_CREATOR')}>
                  📁 New Case
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
