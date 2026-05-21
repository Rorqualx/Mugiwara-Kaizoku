/* global CustomEvent, setTimeout */
/**
 * Enhanced Mantine Notifications Mock for Testing
 *
 * Provides comprehensive mocking for @mantine/notifications package.
 */

const React = require('react');

// State to track notifications
let notifications = [];

const notificationsApi = {
  show: ({ id, title, message, color, autoClose = true, ...props }) => {
    const notificationId = id || `notification-${Date.now()}-${Math.random()}`;
    const notification = {
      id: notificationId,
      title,
      message,
      color,
      autoClose,
      ...props
    };
    
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
  
  hide: (id) => {
    const index = notifications.findIndex(n => n.id === id);
    if (index > -1) {
      const notification = notifications[index];
      notifications.splice(index, 1);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-hidden', {
          detail: notification
        }));
      }
    }
  },
  
  update: ({ id, ...updates }) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      Object.assign(notification, updates);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-updated', {
          detail: notification
        }));
      }
    }
  },
  
  clean: () => {
    notifications = [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-cleaned'));
    }
  },
  
  // For testing purposes
  getNotifications: () => [...notifications]
};

// Enhanced NotificationsProvider
const NotificationsProvider = ({ children, position = 'top-right', ...props }) => {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
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
  }, []);
  
  const notificationElements = notifications.map((notification) => {
    return React.createElement('div', {
      key: notification.id,
      'data-testid': 'mantine-notification',
      'data-notification-id': notification.id,
      'data-color': notification.color,
      style: {
        position: 'fixed',
        top: position.includes('top') ? '20px' : undefined,
        bottom: position.includes('bottom') ? '20px' : undefined,
        right: position.includes('right') ? '20px' : undefined,
        left: position.includes('left') ? '20px' : undefined,
        backgroundColor: notification.color === 'red' ? '#fee' : '#efe',
        border: `1px solid ${notification.color === 'red' ? '#fcc' : '#cfc'}`,
        borderRadius: '4px',
        padding: '12px',
        margin: '4px 0',
        zIndex: 9999
      }
    }, [
      notification.title && React.createElement('div', {
        key: 'title',
        'data-testid': 'notification-title',
        style: { fontWeight: 'bold', marginBottom: '4px' }
      }, notification.title),
      notification.message && React.createElement('div', {
        key: 'message',
        'data-testid': 'notification-message'
      }, notification.message),
      React.createElement('button', {
        key: 'close',
        'data-testid': 'notification-close',
        onClick: () => notificationsApi.hide(notification.id),
        style: {
          position: 'absolute',
          top: '4px',
          right: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }
      }, '×')
    ]);
  });
  
  return React.createElement('div', {
    className: 'mantine-notifications-provider',
    'data-testid': 'mantine-notifications-provider',
    ...props
  }, [
    React.createElement('div', { key: 'children' }, children),
    React.createElement('div', {
      key: 'notifications',
      'data-testid': 'notifications-container',
      className: `notifications-${position}`
    }, notificationElements)
  ]);
};

module.exports = {
  NotificationsProvider,
  notifications: notificationsApi,
  notificationsApi // Alias for compatibility
};