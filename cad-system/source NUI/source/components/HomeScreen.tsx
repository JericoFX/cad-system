
import { For, Show, createMemo } from 'solid-js';
import { homeState } from '~/stores/homeStore';
import { appActions } from '~/stores/appStore';
import { terminalActions } from '~/stores/terminalStore';
import { registry } from '~/commands/registry';
import { notificationActions } from '~/stores/notificationStore';
import { featureState, featureActions } from '~/stores/featureStore';

export function HomeScreen() {
  const handleAction = (action: { command?: string; modal?: string }) => {
    appActions.hide();
    
    if (action.modal) {
      terminalActions.setActiveModal(action.modal);
    } else if (action.command) {
      registry.execute(action.command);
    }
  };

  const visibleActions = createMemo(() => {
    return homeState.actions.filter((action) => {
      if (!action.modal) {
        return true;
      }

      return featureActions.isModalEnabled(action.modal);
    });
  });

  const roleTitle = () => {
    switch (homeState.activeRole) {
      case 'police': return 'POLICE DASHBOARD';
      case 'ems': return 'EMS DASHBOARD';
      case 'dispatch': return 'DISPATCH CENTER';
      case 'admin': return 'ADMIN CONSOLE';
      default: return 'C.A.D. SYSTEM';
    }
  };

  const roleIcon = () => {
    switch (homeState.activeRole) {
      case 'police': return '👮';
      case 'ems': return '🚑';
      case 'dispatch': return '📡';
      case 'admin': return '⚙️';
      default: return '🖥️';
    }
  };

  return (
    <div class="home-screen-overlay" onClick={() => appActions.hide()}>
      <div class="home-screen" onClick={(e) => e.stopPropagation()}>
        <div class="home-header">
          <div class="home-title">
            <span class="home-icon">{roleIcon()}</span>
            <h1>{roleTitle()}</h1>
          </div>
          <button class="home-close" onClick={() => appActions.hide()}>
            ×
          </button>
        </div>

          <div class="home-content">
            <div class="home-section">
              <h2>Quick Actions</h2>
              <div class="home-actions-grid">
                <For each={visibleActions()}>
                  {(action) => (
                    <button
                      class="home-action-card"
                      style={{ 'border-color': action.color }}
                      onClick={() => handleAction(action)}
                    >
                      <span class="action-icon">{action.icon}</span>
                      <span class="action-label">{action.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={homeState.recentActivity.length > 0}>
              <div class="home-section">
                <h2>Recent Activity</h2>
                <div class="home-activity-list">
                  <For each={homeState.recentActivity}>
                    {(activity) => (
                      <div class="activity-item">
                        <span class="activity-type">{activity.type}</span>
                        <span class="activity-desc">{activity.description}</span>
                        <span class="activity-time">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <div class="home-section shortcuts-section">
              <h2>Keyboard Shortcuts</h2>
              <div class="shortcuts-grid">
                <div class="shortcut-item">
                  <kbd>F1</kbd>
                  <span>Help</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Dock</kbd>
                  <span>Notifications</span>
                </div>
                <div class="shortcut-item">
                  <kbd>F2</kbd>
                  <span>New Case</span>
                </div>
                <Show when={featureState.dispatch.visible}>
                  <div class="shortcut-item">
                    <kbd>F3</kbd>
                    <span>Dispatch</span>
                  </div>
                </Show>
                <div class="shortcut-item">
                  <kbd>Esc</kbd>
                  <span>Close/Cancel</span>
                </div>
              </div>
            </div>
          </div>

          <div class="home-footer">
            <span>C.A.D. System v1.0 By JericoFX</span>
            <button onClick={() => notificationActions.toggle()}>
              Open Notifications 🔔
            </button>
          </div>
        </div>
      </div>
  );
}
