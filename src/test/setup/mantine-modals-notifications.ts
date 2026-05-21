/**
 * Test Setup - Mantine Modals & Notifications Mocks
 *
 * Mock implementations of Mantine modals and notifications with state management.
 * Extracted from: src/test/setup.ts (lines 1840-2090)
 */

import { jest } from '@jest/globals';
import * as React from 'react';

// Mock Mantine modals and notifications with enhanced functionality
jest.mock('@mantine/modals', () => {
  // State to track open modals
  const openModals = new Map();
  let modalIdCounter = 0;

  const mockModals = {
    openModal: jest.fn(({ modalId, title, children, onClose, ...props }) => {
      const id = modalId || `modal-${++modalIdCounter}`;
      openModals.set(id, {
        title,
        children,
        onClose,
        opened: true,
        ...props
      });

      // Trigger a re-render by dispatching a custom event

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('modal-opened', { detail: { id } }));
        }, 0);
      }

      return id;
    }),

    closeModal: jest.fn((modalId) => {
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
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('modal-closed', { detail: { id: modalId } }));
        }, 0);
      }
    }),

    closeAllModals: jest.fn(() => {
      openModals.clear();

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('modals-closed-all'));
        }, 0);
      }
    }),

    openConfirmModal: jest.fn(({ title, children, onConfirm, onCancel, labels, ...props }) => {
      const id = `confirm-modal-${++modalIdCounter}`;

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
          mockModals.closeModal(id);
        }
      }, labels?.cancel || 'Cancel'),
      React.createElement('button', {
        key: 'confirm',
        'data-testid': 'confirm-modal-confirm',
        onClick: () => {
          onConfirm && onConfirm();
          mockModals.closeModal(id);
        }
      }, labels?.confirm || 'Confirm')]
      )]
      );

      openModals.set(id, {
        title,
        children: confirmModal,
        opened: true,
        ...props
      });


      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('modal-opened', { detail: { id } }));
        }, 0);
      }

      return id;
    })
  };

  // Enhanced ModalsProvider that renders open modals
  const ModalsProvider = ({ children, modalProps, ...props }: {
    children?: React.ReactNode;
    modalProps?: unknown;
    [key: string]: unknown;
  }) => {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    React.useEffect(() => {
      // Create modal portal container
      let modalContainer = document.querySelector('[data-portal="true"]');
      if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.setAttribute('data-portal', 'true');
        modalContainer.setAttribute('data-testid', 'mantine-modal-portal');
        document.body.appendChild(modalContainer);
      }

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
        'aria-labelledby': modal["title"] ? `modal-title-${id}` : undefined,
        style: {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }
      }, [
      modal["title"] && React.createElement('h2', {
        key: 'title',
        id: `modal-title-${id}`,
        'data-testid': 'modal-title'
      }, modal["title"]),
      React.createElement('div', {
        key: 'content',
        'data-testid': 'modal-content'
      }, modal.children),
      React.createElement('button', {
        key: 'close',
        'data-testid': 'modal-close',
        onClick: () => mockModals.closeModal(id),
        style: {
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer'
        }
      }, '×')]
      );
    });

    return React.createElement('div', {
      'data-testid': 'mantine-modals-provider',
      className: 'mantine-modals-provider',
      ...props
    }, [
    React.createElement('div', { key: 'children' }, children),
    ...modalElements]
    );
  };

  return {
    ModalsProvider,
    useModals: () => mockModals,
    openModal: mockModals.openModal,
    closeModal: mockModals.closeModal,
    openConfirmModal: mockModals.openConfirmModal,
    openContextModal: mockModals.openModal,
    closeAllModals: mockModals.closeAllModals,
    modals: mockModals
  };
});

jest.mock('@mantine/notifications', () => ({
  Notifications: ({ position, limit, containerWidth, autoClose, styles }: {
    position?: string;
    limit?: number;
    containerWidth?: number;
    autoClose?: number;
    styles?: unknown;
  }) => {
    React.useEffect(() => {
      // Create notification containers
      let notificationContainer = document.querySelector(`[data-position="${position || 'top-center'}"]`);
      if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.setAttribute('data-position', position || 'top-center');
        notificationContainer.setAttribute('data-testid', 'mantine-notifications-container');
        notificationContainer.setAttribute('data-limit', String(limit || 5));
        notificationContainer.setAttribute('data-width', String(containerWidth || 400));
        notificationContainer.className = 'mantine-notifications-container';
        document.body.appendChild(notificationContainer);
      }
    }, [position, limit, containerWidth]);

    return React.createElement('div', {
      'data-testid': 'mantine-notifications',
      className: 'mantine-notifications',
      'data-position': position || 'top-center'
    });
  },
  showNotification: jest.fn(),
  hideNotification: jest.fn(),
  cleanNotifications: jest.fn(),
  updateNotification: jest.fn(),
  notifications: {
    show: jest.fn(),
    hide: jest.fn(),
    update: jest.fn(),
    clean: jest.fn()
  }
}));
