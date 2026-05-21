/**
 * Enhanced Mantine Notifications Mock for Testing
 * 
 * Provides comprehensive mocking for @mantine/notifications package.
 */

import * as React from 'react';
import type { ReactNode } from 'react';
// Define notification interface
interface NotificationProps {
  id?: string;
  title?: string;
  message?: string | React.ReactNode;
  color?: string;
  autoClose?: boolean | number;
  [key: string]: unknown;
}

interface Notification extends NotificationProps {
  id: string;
}

// State to track notifications
let notifications: Notification[] = [];
const notificationsApi = {
  show: ({ id, title, message, color, autoClose = true, ...props }: NotificationProps): string => {
    const notificationId = id || `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id: notificationId,
      message,
      autoClose,
      ...props
    };
    // Only add optional properties if they're defined
    if (title !== undefined) {
      notification.title = title;
    }
    if (color !== undefined) {
      notification.color = color;
    }
    notifications.push(notification);
    // Auto close if specified
    if (autoClose && typeof autoClose === 'number') {
      setTimeout(() => {
        notificationsApi.hide(notificationId);
      }, autoClose);
    } else if (autoClose === true) {
      setTimeout(() => {
        notificationsApi.hide(notificationId);
      }, 4000); // Default 4 seconds
    }

    // Trigger custom event for testing
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification-shown', {
        detail: notification
      }));
    }

    return notificationId;
  },

  hide: (id: string): void => {
    const index = notifications.findIndex((n) => n["id"] === id);
    if (index > -1) {
      const notification = notifications[index];
      notifications.splice(index, 1);
      if (typeof window !== 'undefined') {
        const event = new CustomEvent<Notification>('notification-hidden');
        Object.defineProperty(event, 'detail', {
          value: notification,
          writable: false
        });
        window.dispatchEvent(event);
      }
    }
  },

  update: ({ id, ...updates }: {id: string;[key: string]: unknown;}): void => {
    const notification = notifications.find((n) => n["id"] === id);
    if (notification) {
      Object.assign(notification, updates);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-updated', {
          detail: notification
        }));
      }
    }
  },

  clean: (): void => {
    notifications = [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-cleaned'));
    }
  },

  // For testing purposes
  getNotifications: (): Notification[] => [...notifications]
};
// Define position type
type NotificationPosition =
'top-left' | 'top-right' | 'top-center' |
'bottom-left' | 'bottom-right' | 'bottom-center';
interface NotificationsProps {
  children?: ReactNode;
  position?: NotificationPosition;
  limit?: number;
  autoClose?: boolean | number;
  containerWidth?: number | string;
  notificationMaxHeight?: number | string;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

// Enhanced Notifications component (previously NotificationsProvider)
const Notifications: React.FC<NotificationsProps> = ({
  children, position = 'top-right',
  limit, autoClose,
  containerWidth, notificationMaxHeight,
  zIndex = 9999,
  ...props
}) => {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const handleNotificationEvents = () => forceUpdate();
    if (typeof window !== 'undefined') {
      window.addEventListener('notification-shown', handleNotificationEvents);
      window.addEventListener('notification-hidden', handleNotificationEvents);
      window.addEventListener('notification-updated', handleNotificationEvents);
      window.addEventListener('notifications-cleaned', handleNotificationEvents);
      return () => {
        window.removeEventListener('notification-shown', handleNotificationEvents);
        window.removeEventListener('notification-hidden', handleNotificationEvents);
        window.removeEventListener('notification-updated', handleNotificationEvents);
        window.removeEventListener('notifications-cleaned', handleNotificationEvents);
      };
    }

    return undefined;
  }, []);
  // Apply limit if specified
  const visibleNotifications = limit ? notifications.slice(0, limit) : notifications;
  const notificationElements = visibleNotifications.map((notification) => {
    return React.createElement('div', {
      key: notification["id"],
      'data-testid': 'mantine-notification',
      'data-notification-id': notification["id"],
      'data-color': notification.color, style: {
        position: 'fixed',
        top: position.includes('top') ? '20px' : undefined, bottom: position.includes('bottom') ? '20px' : undefined, right: position.includes('right') ? '20px' : undefined, left: position.includes('left') ? '20px' : undefined, backgroundColor: notification.color === 'red' ? '#fee' : '#efe',
        border: `1px solid ${notification.color === 'red' ? '#fcc' : '#cfc'}`,
        borderRadius: '4px',
        padding: '12px',
        margin: '4px 0',
        zIndex: zIndex, maxHeight: notificationMaxHeight, width: containerWidth, boxSizing: 'border-box',
        overflow: 'hidden'
      }
    }, [
    notification["title"] && React.createElement('div', {
      key: 'title',
      'data-testid': 'notification-title',
      style: { fontWeight: 'bold', marginBottom: '4px' }
    }, notification["title"]),
    notification.message && React.createElement('div', {
      key: 'message',
      'data-testid': 'notification-message'
    }, notification.message),
    React.createElement('button', {
      key: 'close',
      'data-testid': 'notification-close',
      onClick: () => notificationsApi.hide(notification["id"]),
      style: {
        position: 'absolute',
        top: '4px',
        right: '4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer'
      }
    }, '×')]
    );
  });
  return React.createElement('div', {
    className: 'mantine-notifications-provider',
    'data-testid': 'mantine-notifications-provider',
    ...props
  }, [
  children && React.createElement('div', { key: 'children' }, children),
  React.createElement('div', {
    key: 'notifications',
    'data-testid': 'notifications-container',
    className: `notifications-${position}`
  }, notificationElements)]
  );
};
// For backwards compatibility
const NotificationsProvider = Notifications;
export { Notifications, NotificationsProvider, // For backwards compatibility };
notificationsApi as notifications };