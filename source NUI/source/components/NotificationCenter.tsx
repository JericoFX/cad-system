
import { For, Show, createMemo } from 'solid-js';
import { notificationState, notificationActions, type Notification, type NotificationType } from '~/stores/notificationStore';
import { terminalActions } from '~/stores/terminalStore';
import { registry } from '~/commands/registry';

interface NotificationCenterProps {
  mode?: 'floating' | 'dock';
}

export function NotificationCenter(props: NotificationCenterProps = {}) {
  const mode = () => props.mode || 'floating';

  const filteredNotifications = createMemo(() => {
    switch (notificationState.filter) {
      case 'unread':
        return notificationState.notifications.filter((n) => !n.read);
      case 'high':
        return notificationState.notifications.filter((n) => n.priority === 'high');
      default:
        return notificationState.notifications;
    }
  });

  const getTypeIcon = (type: NotificationType): string => {
    const icons: Record<NotificationType, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      call: '📞',
      bolo: '🚨',
      evidence: '📎',
    };
    return icons[type] || '•';
  };

  const getPriorityColor = (priority: Notification['priority']): string => {
    const colors = {
      high: '#ff0000',
      medium: '#ffff00',
      low: '#808080',
    };
    return colors[priority];
  };

  const handleAction = (notification: Notification) => {
    notificationActions.markAsRead(notification.id);
    
    if (notification.action?.modal) {
      terminalActions.setActiveModal(notification.action.modal);
    } else if (notification.action?.command) {
      registry.execute(notification.action.command);
    }
    
    notificationActions.close();
  };

  const toggle = () => {
    const opening = !notificationState.isOpen;
    notificationActions.toggle();
    if (opening) {
      notificationActions.markAllAsRead();
    }
  };

  return (
    <div class={`notification-center ${mode() === 'dock' ? 'dock-notification-center' : ''}`}>
      <button 
        class={`notification-bell ${mode() === 'dock' ? 'dock-notification-bell dock-item' : ''} ${notificationState.unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={toggle}
        title="Notifications"
      >
        <span class="bell-icon">🔔</span>
        <Show when={notificationState.unreadCount > 0}>
          <span class="notification-badge">
            {notificationState.unreadCount > 99 ? '99+' : notificationState.unreadCount}
          </span>
        </Show>
      </button>

      <Show when={notificationState.isOpen}>
        <div class="notification-panel">
          <div class="notification-header">
            <h3>Notifications</h3>
            <div class="notification-filters">
              <button 
                class={notificationState.filter === 'all' ? 'active' : ''}
                onClick={() => notificationActions.setFilter('all')}
              >
                All
              </button>
              <button 
                class={notificationState.filter === 'unread' ? 'active' : ''}
                onClick={() => notificationActions.setFilter('unread')}
              >
                Unread
              </button>
              <button 
                class={notificationState.filter === 'high' ? 'active' : ''}
                onClick={() => notificationActions.setFilter('high')}
              >
                High Priority
              </button>
            </div>
            <button class="notification-close" onClick={() => notificationActions.close()}>
              ×
            </button>
          </div>

          <div class="notification-list">
            <Show
              when={filteredNotifications().length > 0}
              fallback={<div class="notification-empty">No notifications</div>}
            >
              <For each={filteredNotifications()}>
                {(notification) => (
                  <div 
                    class={`notification-item ${notification.read ? 'read' : 'unread'} priority-${notification.priority}`}
                    onClick={() => handleAction(notification)}
                  >
                    <div class="notification-icon">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div class="notification-content">
                      <div class="notification-title">
                        {notification.title}
                        <span 
                          class="notification-priority"
                          style={{ color: getPriorityColor(notification.priority) }}
                        >
                          {notification.priority}
                        </span>
                      </div>
                      <div class="notification-message">{notification.message}</div>
                      <div class="notification-meta">
                        <span class="notification-source">{notification.source}</span>
                        <span class="notification-time">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <Show when={notification.action}>
                      <button class="notification-action-btn">
                        {notification.action?.label}
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <div class="notification-footer">
            <button onClick={() => notificationActions.markAllAsRead()}>
              Mark All Read
            </button>
            <button onClick={() => notificationActions.clearAll()}>
              Clear All
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
