/* global CustomEvent */
/**
 * Enhanced Mantine Modals Mock for Testing
 *
 * Provides comprehensive mocking for @mantine/modals package with proper
 * modal rendering and state management for tests.
 */

const React = require('react');

// State to track open modals
const openModals = new Map();

// Enhanced modals functionality
const modals = {
  open: ({ modalId, title, children, onClose, ...props }) => {
    const id = modalId || `modal-${Date.now()}`;
    openModals.set(id, {
      title,
      children,
      onClose,
      ...props
    });
    
    // Trigger a re-render by dispatching a custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('modal-opened', { detail: { id } }));
    }
    
    return id;
  },
  
  close: (modalId) => {
    if (modalId) {
      const modal = openModals.get(modalId);
      if (modal && modal.onClose) {
        modal.onClose();
      }
      openModals.delete(modalId);
    } else {
      // Close all modals
      openModals.clear();
    }
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('modal-closed', { detail: { id: modalId } }));
    }
  },
  
  closeAll: () => {
    openModals.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('modals-closed-all'));
    }
  },
  
  openConfirmModal: ({ title, children, onConfirm, onCancel, labels, ...props }) => {
    const id = `confirm-modal-${Date.now()}`;
    
    const confirmModal = React.createElement('div', {
      'data-testid': 'confirm-modal-content'
    }, [
      React.createElement('p', { key: 'content' }, children),
      React.createElement('div', { 
        key: 'buttons',
        'data-testid': 'confirm-modal-buttons',
        style: { display: 'flex', gap: '8px', marginTop: '16px' }
      }, [
        React.createElement('button', {
          key: 'cancel',
          'data-testid': 'confirm-modal-cancel',
          onClick: () => {
            onCancel && onCancel();
            modals.close(id);
          }
        }, labels?.cancel || 'Cancel'),
        React.createElement('button', {
          key: 'confirm', 
          'data-testid': 'confirm-modal-confirm',
          onClick: () => {
            onConfirm && onConfirm();
            modals.close(id);
          }
        }, labels?.confirm || 'Confirm')
      ])
    ]);
    
    openModals.set(id, {
      title,
      children: confirmModal,
      ...props
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('modal-opened', { detail: { id } }));
    }
    
    return id;
  }
};

// Enhanced ModalsProvider that renders open modals
const ModalsProvider = ({ children, ...props }) => {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    const handleModalEvents = () => forceUpdate();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('modal-opened', handleModalEvents);
      window.addEventListener('modal-closed', handleModalEvents);
      window.addEventListener('modals-closed-all', handleModalEvents);
      
      return () => {
        window.removeEventListener('modal-opened', handleModalEvents);
        window.removeEventListener('modal-closed', handleModalEvents);
        window.removeEventListener('modals-closed-all', handleModalEvents);
      };
    }
  }, []);
  
  const modalElements = Array.from(openModals.entries()).map(([id, modal]) => {
    return React.createElement('div', {
      key: id,
      'data-testid': 'mantine-modal',
      'data-modal-id': id,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': modal.title ? `modal-title-${id}` : undefined,
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000
      }
    }, [
      modal.title && React.createElement('h2', {
        key: 'title',
        id: `modal-title-${id}`,
        'data-testid': 'modal-title'
      }, modal.title),
      React.createElement('div', {
        key: 'content',
        'data-testid': 'modal-content'
      }, modal.children),
      React.createElement('button', {
        key: 'close',
        'data-testid': 'modal-close',
        onClick: () => modals.close(id),
        style: {
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer'
        }
      }, '×')
    ]);
  });
  
  return React.createElement('div', {
    className: 'mantine-modals-provider',
    'data-testid': 'mantine-modals-provider',
    ...props
  }, [
    React.createElement('div', { key: 'children' }, children),
    ...modalElements
  ]);
};

// Hook to access modals
const useModals = () => modals;

module.exports = {
  ModalsProvider,
  modals,
  useModals
};