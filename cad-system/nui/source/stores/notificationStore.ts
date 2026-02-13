
import { createStore } from 'solid-js/store';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'call' | 'bolo' | 'evidence';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    command?: string;
    modal?: string;
  };
  priority: 'low' | 'medium' | 'high';
  source?: string;
}

interface NotificationState {
  notifications: Notification[];
  isOpen: boolean;
  unreadCount: number;
  filter: 'all' | 'unread' | 'high';
  maxNotifications: number;
}

const initialState: NotificationState = {
  notifications: [],
  isOpen: false,
  unreadCount: 0,
  filter: 'all',
  maxNotifications: 50,
};

export const [notificationState, setNotificationState] = createStore<NotificationState>(initialState);

const updateUnreadCount = () => {
  const count = notificationState.notifications.filter((n) => !n.read).length;
  setNotificationState('unreadCount', count);
};

export const notificationActions = {
  open: () => {
    setNotificationState('isOpen', true);
  },
  
  close: () => {
    setNotificationState('isOpen', false);
  },
  
  toggle: () => {
    setNotificationState('isOpen', (v) => !v);
  },
  
  add: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      read: false,
    };
    
    setNotificationState('notifications', (prev) => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, notificationState.maxNotifications);
    });
    
    updateUnreadCount();
  },
  
  markAsRead: (id: string) => {
    setNotificationState('notifications', (prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    updateUnreadCount();
  },
  
  markAllAsRead: () => {
    setNotificationState('notifications', (prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
    setNotificationState('unreadCount', 0);
  },
  
  remove: (id: string) => {
    setNotificationState('notifications', (prev) => prev.filter((n) => n.id !== id));
    updateUnreadCount();
  },
  
  clearAll: () => {
    setNotificationState('notifications', []);
    setNotificationState('unreadCount', 0);
  },
  
  setFilter: (filter: NotificationState['filter']) => {
    setNotificationState('filter', filter);
  },
  
  notifyNewCall: (callId: string, title: string) => {
    notificationActions.add({
      type: 'call',
      title: 'New Dispatch Call',
      message: `${callId}: ${title}`,
      priority: 'high',
      source: 'Dispatch',
      action: {
        label: 'View Call',
        modal: 'DISPATCH_PANEL',
      },
    });
  },
  
  notifyBOLO: (boloId: string, priority: string) => {
    notificationActions.add({
      type: 'bolo',
      title: 'New High Priority BOLO',
      message: `BOLO ${boloId} created with ${priority} priority`,
      priority: priority === 'HIGH' ? 'high' : 'medium',
      source: 'BOLO System',
      action: {
        label: 'View BOLO',
        modal: 'BOLO_MANAGER',
      },
    });
  },
  
  notifyEvidence: (evidenceId: string, caseId: string) => {
    notificationActions.add({
      type: 'evidence',
      title: 'Evidence Custody Transfer',
      message: `Evidence ${evidenceId} transferred in case ${caseId}`,
      priority: 'medium',
      source: 'Evidence System',
      action: {
        label: 'View Evidence',
        modal: 'EVIDENCE',
      },
    });
  },
  
  notifyTaskOverdue: (taskId: string, caseId: string) => {
    notificationActions.add({
      type: 'warning',
      title: 'Task Overdue',
      message: `Task ${taskId} in case ${caseId} is overdue`,
      priority: 'medium',
      source: 'Task System',
    });
  },
  
  notifySystem: (title: string, message: string, type: NotificationType = 'info') => {
    notificationActions.add({
      type,
      title,
      message,
      priority: 'low',
      source: 'System',
    });
  },
  
  notifyCriticalPatient: (patientId: string, patientName: string, condition: string) => {
    notificationActions.add({
      type: 'warning',
      title: 'Critical Patient Admitted',
      message: `${patientName} (${patientId}) - Condition: ${condition}`,
      priority: 'high',
      source: 'EMS System',
      action: {
        label: 'View Patient',
        modal: 'EMS_DASHBOARD',
      },
    });
  },
  
  notifyLowStock: (itemId: string, itemName: string, currentStock: number) => {
    notificationActions.add({
      type: 'warning',
      title: 'Low Stock Alert',
      message: `${itemName} (${itemId}) - Only ${currentStock} remaining`,
      priority: 'medium',
      source: 'EMS Inventory',
      action: {
        label: 'Restock',
        modal: 'EMS_DASHBOARD',
      },
    });
  },
};

export const getFilteredNotifications = (): Notification[] => {
  switch (notificationState.filter) {
    case 'unread':
      return notificationState.notifications.filter((n) => !n.read);
    case 'high':
      return notificationState.notifications.filter((n) => n.priority === 'high');
    default:
      return notificationState.notifications;
  }
};
