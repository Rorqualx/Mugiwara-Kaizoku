/**
 * Test Setup - Mantine Display Component Mocks
 *
 * Mock implementations of Mantine display and utility components.
 * Extracted from: src/test/setup.ts (display components from lines 764-1655)
 *
 * This is a PARTIAL mock - it spreads requireActual first to preserve
 * any components not explicitly mocked here.
 *
 * @module test/setup/mantine-display-mocks
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { CommonProps, MantineComponentProps, isRecord, getUnknownProperty } from './foundation';

jest.mock('@mantine/core', () => ({
  ...(jest.requireActual('@mantine/core') as Record<string, unknown>),

  // Basic Display Components
  Text: ({ children, fw, c, size, component, style, ...props }: MantineComponentProps & {
    component?: string;
  }) =>
    React.createElement(component || 'span', {
      ...props,
      'data-testid': 'mantine-text',
      className: `mantine-Text-root ${props.className ?? ''}`,
      'data-font-weight': fw,
      'data-color': c,
      'data-size': size,
      style: {
        fontWeight: fw,
        color: c === 'dimmed' ? '#868e96' : c,
        fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.125rem' : '1rem',
        ...style
      }
    }, children),

  Badge: ({ children, color, variant, size, ...props }: CommonProps & {
    color?: string;
    variant?: string;
    size?: string;
  }) =>
    React.createElement('span', {
      ...props,
      'data-testid': 'mantine-badge',
      className: `mantine-Badge-root mantine-badge ${props.className ?? ''}`,
      'data-color': color,
      'data-variant': variant,
      'data-size': size
    }, children),

  Code: ({ children, style, block, ...props }: CommonProps & {
    block?: boolean;
  }) =>
    React.createElement('code', {
      ...props,
      'data-testid': 'mantine-code',
      'data-block': block ? 'true' : undefined,
      style: {
        backgroundColor: '#f8f9fa',
        padding: '2px 6px',
        borderRadius: '3px',
        fontFamily: 'monospace',
        display: block ? 'block' : 'inline',
        whiteSpace: block ? 'pre' : 'normal',
        ...style
      }
    }, children),

  Title: ({ children, order, ...props }: CommonProps & { order?: number }) =>
    React.createElement(`h${order || 1}`, {
      ...props,
      'data-testid': 'mantine-title',
      className: `mantine-Title-root ${props.className ?? ''}`,
      'data-order': order ? String(order) : undefined
    }, children),

  // Alert Component
  Alert: ({ children, title, withCloseButton, onClose, icon, role = 'alert', ...props }: CommonProps & {
    title?: React.ReactNode;
    withCloseButton?: boolean;
    onClose?: () => void;
    icon?: React.ReactNode;
    role?: string;
  }) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-alert',
      className: `mantine-Alert-root mantine-alert ${props.className ?? ''}`,
      role: role,
      'data-mantine-alert': true
    },
      icon && React.createElement('div', {
        'data-testid': 'alert-icon',
        className: 'mantine-Alert-icon'
      }, icon),
      title && React.createElement('div', {
        'data-testid': 'alert-title',
        className: 'mantine-Alert-title'
      }, title),
      children,
      withCloseButton && React.createElement('button', {
        'data-testid': 'alert-close',
        className: 'mantine-Alert-closeButton',
        onClick: onClose
      }, '×')
    ),

  // Skeleton Component
  Skeleton: ({ height, width, radius, ...props }: CommonProps & {
    height?: string | number;
    width?: string | number;
    radius?: string | number;
  }) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-skeleton',
      className: `mantine-Skeleton-root ${props.className ?? ''}`,
      style: {
        height: height || '1rem',
        width: width || '100%',
        backgroundColor: '#f1f3f4',
        borderRadius: radius || '4px',
        ...props.style
      }
    }),

  // Notification Component
  Notification: ({ title, message, onClose, icon, color, ...props }: CommonProps & {
    title?: React.ReactNode;
    message?: React.ReactNode;
    onClose?: () => void;
    icon?: React.ReactNode;
    color?: string;
  }) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-notification',
      role: 'alert'
    },
      icon && React.createElement('div', { 'data-testid': 'notification-icon' }, icon),
      title && React.createElement('div', { 'data-testid': 'notification-title' }, title),
      React.createElement('div', { 'data-testid': 'notification-message' }, message),
      onClose && React.createElement('button', {
        'data-testid': 'notification-close',
        onClick: onClose
      }, '×')
    ),

  // Modal Component
  Modal: ({ opened, onClose, title, children, ...props }: CommonProps & {
    opened?: boolean;
    onClose?: () => void;
    title?: React.ReactNode;
  }) =>
    opened ? React.createElement('div', {
      ...props,
      'data-testid': 'mantine-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title'
    },
      React.createElement('div', { id: 'modal-title' }, title),
      React.createElement('button', { 'aria-label': 'Close', onClick: onClose }, '×'),
      children
    ) : null,

  // Loader Component
  Loader: ({ size, ...props }: MantineComponentProps) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-loader',
      className: 'mantine-Loader-root',
      'aria-label': 'Loading',
      'data-size': size || 'md'
    }),

  // Anchor Component
  Anchor: ({ children, href, ...props }: CommonProps & { href?: string }) =>
    React.createElement('a', {
      ...props,
      'data-testid': 'mantine-anchor',
      href: href || '#'
    }, children),

  // ActionIcon Component
  ActionIcon: ({ children, onClick, title, variant, size, ...props }: MantineComponentProps & {
    onClick?: () => void;
    title?: string;
    variant?: string;
  }) => {
    const { variant: _variant, size: _size, ...cleanProps } = props;
    return React.createElement('button', {
      ...cleanProps,
      'data-testid': 'mantine-action-icon',
      className: 'mantine-ActionIcon-root',
      onClick: onClick,
      title: title,
      type: 'button'
    }, children);
  },

  // Popover Component (with Target/Dropdown subcomponents)
  Popover: (() => {
    const MockPopoverTarget = ({ children, ...props }: CommonProps) =>
      React.createElement('div', { 'data-testid': 'mantine-popover-target', ...props }, children);

    const MockPopoverDropdown = ({ children, opened, ...props }: CommonProps & { opened?: boolean }) =>
      React.createElement('div', {
        'data-testid': 'mantine-popover-dropdown',
        className: 'mantine-Popover-dropdown',
        style: { display: opened === false ? 'none' : 'block' },
        ...props
      }, children);

    return Object.assign(
      ({ children, opened, width, position, shadow, onChange, ...props }: CommonProps & {
        opened?: boolean;
        width?: string | number;
        position?: string;
        shadow?: string;
        onChange?: (opened: boolean) => void;
      }) => {
        const [isOpened, setIsOpened] = React.useState(opened);

        React.useEffect(() => {
          setIsOpened(opened);
        }, [opened]);

        const targetElement = React.Children.toArray(children).find((child: unknown) =>
          // @ts-expect-error - checking React component type
          child?.type === MockPopoverTarget
        );

        const dropdownElement = React.Children.toArray(children).find((child: unknown) =>
          // @ts-expect-error - checking React component type
          child?.type === MockPopoverDropdown
        );

        return React.createElement('div', {
          'data-testid': 'mantine-popover',
          'data-opened': isOpened
        }, [
          targetElement,
          dropdownElement && isOpened && React.isValidElement(dropdownElement) && React.cloneElement(dropdownElement, {
            // @ts-ignore - Ensuring props exists before spreading
            ...dropdownElement.props,
            opened: isOpened
          })
        ].filter(Boolean));
      },
      {
        Target: MockPopoverTarget,
        Dropdown: MockPopoverDropdown
      }
    );
  })(),

  // Tooltip Component
  Tooltip: ({ label, children, withArrow, arrowSize, multiline, ...props }: CommonProps & {
    label?: React.ReactNode;
    withArrow?: boolean;
    arrowSize?: number;
    multiline?: boolean;
  }) => {
    const { withArrow: _withArrow, arrowSize: _arrowSize, multiline: _multiline, ...cleanProps } = props;
    return React.createElement('div', {
      ...cleanProps,
      'data-testid': 'mantine-tooltip',
      title: typeof label === 'string' ? label : undefined
    }, children);
  },

  // Tabs Component (with List/Tab/Panel subcomponents)
  Tabs: Object.assign(
    ({ value, onChange, children, ...props }: { value?: string; onChange?: (value: string) => void; children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('div', {
        ...props,
        'data-testid': 'mantine-tabs',
        role: 'tablist'
      }, children),
    {
      List: ({ children, ...props }: CommonProps) =>
        React.createElement('div', {
          ...props,
          'data-testid': 'mantine-tabs-list',
          role: 'tablist'
        }, children),
      Tab: ({ value, children, leftSection, rightSection, ...props }: CommonProps & {
        value?: string;
        leftSection?: React.ReactNode;
        rightSection?: React.ReactNode;
      }) =>
        React.createElement('button', {
          ...props,
          'data-testid': `mantine-tab-${value}`,
          role: 'tab',
          className: `mantine-Tabs-tab ${props.className ?? ''}`,
          'aria-label': typeof children === 'string' ? children : value
        },
          leftSection && React.createElement('span', { className: 'mantine-Tabs-tabSection' }, leftSection),
          children,
          rightSection && React.createElement('span', { className: 'mantine-Tabs-tabSection' }, rightSection)
        ),
      Panel: ({ value, children, ...props }: CommonProps & { value?: string }) =>
        React.createElement('div', {
          ...props,
          'data-testid': `mantine-tabpanel-${value}`,
          role: 'tabpanel'
        }, children)
    }
  ),

  // Menu Component (with Target/Dropdown/Item/Divider subcomponents)
  Menu: (() => {
    const MockMenuTarget = ({ children, ...props }: CommonProps) =>
      React.createElement('div', { 'data-testid': 'mantine-menu-target', ...props }, children);

    const MockMenuDropdown = ({ children, opened, ...props }: CommonProps & { opened?: boolean }) =>
      React.createElement('div', {
        'data-testid': 'mantine-menu-dropdown',
        className: 'mantine-Menu-dropdown',
        role: 'menu',
        style: { display: opened === false ? 'none' : 'block' },
        ...props
      }, children);

    const MockMenuItem = ({ children, onClick, disabled, color, leftSection, rightSection, style, ...props }: CommonProps & {
      onClick?: () => void;
      disabled?: boolean;
      color?: string;
      leftSection?: React.ReactNode;
      rightSection?: React.ReactNode;
    }) =>
      React.createElement('button', {
        ...props,
        'data-testid': 'mantine-menu-item',
        className: 'mantine-Menu-item',
        role: 'menuitem',
        onClick: disabled ? undefined : onClick,
        disabled,
        type: 'button',
        style: { color: color === 'red' ? '#fa5252' : undefined, ...style }
      },
        leftSection && React.createElement('span', { className: 'menu-item-section' }, leftSection),
        children,
        rightSection && React.createElement('span', { className: 'menu-item-section' }, rightSection)
      );

    const MockMenuDivider = (props: CommonProps) =>
      React.createElement('hr', {
        ...props,
        'data-testid': 'mantine-menu-divider',
        className: 'mantine-Menu-divider',
        role: 'separator'
      });

    return Object.assign(
      ({ children, opened, width, shadow, position, trigger, ...props }: CommonProps & {
        opened?: boolean;
        width?: string | number;
        shadow?: string;
        position?: string;
        trigger?: string;
      }) => {
        const [isOpened, setIsOpened] = React.useState(opened);

        React.useEffect(() => {
          setIsOpened(opened);
        }, [opened]);

        const targetElement = React.Children.toArray(children).find((child: unknown) =>
          // @ts-expect-error - checking React component type
          child?.type === MockMenuTarget
        );

        const dropdownElement = React.Children.toArray(children).find((child: unknown) =>
          // @ts-expect-error - checking React component type
          child?.type === MockMenuDropdown
        );

        const handleTargetClick = () => {
          if (trigger === 'click' || trigger === 'click-hover' || !trigger) {
            setIsOpened(!isOpened);
          }
        };

        return React.createElement('div', {
          ...props,
          'data-testid': 'mantine-menu',
          'data-opened': isOpened
        }, [
          targetElement && React.isValidElement(targetElement) && React.cloneElement(targetElement, {
            // @ts-ignore - Ensuring props exists before spreading
            ...targetElement.props,
            onClick: handleTargetClick
          }),
          dropdownElement && isOpened && React.isValidElement(dropdownElement) && React.cloneElement(dropdownElement, {
            // @ts-ignore - Ensuring props exists before spreading
            ...dropdownElement.props,
            opened: isOpened
          })
        ]);
      },
      {
        Target: MockMenuTarget,
        Dropdown: MockMenuDropdown,
        Item: MockMenuItem,
        Divider: MockMenuDivider
      }
    );
  })(),

  // Combobox Component
  Combobox: ({ value, data, label, description, onChange, grow, ...props }: MantineComponentProps & {
    value?: string;
    data?: unknown[];
    label?: React.ReactNode;
    description?: React.ReactNode;
    onChange?: (value: string) => void;
  }) => {
    const selectedOption = Array.isArray(data) ? data.find((item: unknown) => {
      if (!isRecord(item)) return false;
      return getUnknownProperty(item, 'value') === value;
    }) : null;
    const cleanProps = isRecord(props) ? props : {};

    return React.createElement('div', { className: 'mantine-combobox-wrapper' },
      label && React.createElement('label', {}, label),
      React.createElement('select', {
        ...cleanProps,
        'data-testid': 'mantine-combobox',
        role: 'combobox',
        value: value ?? '',
        onChange: (e: unknown) => {
          if (typeof onChange === 'function' && isRecord(e) && 'target' in e) {
            const target = getUnknownProperty(e, 'target');
            if (isRecord(target)) {
              onChange(getUnknownProperty(target, 'value') as string);
            }
          }
        }
      },
        Array.isArray(data) && data.map((option: unknown) => {
          if (!isRecord(option)) return null;
          const value = String(getUnknownProperty(option, 'value') ?? '');
          return React.createElement('option', {
            key: value,
            value: value
          }, String(getUnknownProperty(option, 'label') ?? ''));
        })
      ),
      description && React.createElement('div', { className: 'mantine-input-description' }, description)
    );
  },

  // LoadingOverlay Component
  LoadingOverlay: ({ visible, style, ...props }: CommonProps & {
    visible?: boolean;
  }) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-_loading-overlay',
      className: `mantine-LoadingOverlay-root ${props.className ?? ''}`,
      'aria-label': 'Loading',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        ...style
      }
    }, React.createElement('div', { 'data-testid': 'mantine-loader' }, 'Loading...')),

  // Utility Hook - useMantineTheme
  useMantineTheme: jest.fn(() => ({
    colors: {
      blue: ['#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab', '#0b5394'],
      red: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'],
      gray: ['#f8f9fa', '#f1f3f4', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#6c757d', '#495057', '#343a40', '#212529'],
      dark: ['#C1C2C5', '#A6A7AB', '#909296', '#5c5f66', '#373A40', '#2C2E33', '#25262b', '#1A1B23', '#141518', '#101113']
    },
    primaryColor: 'blue',
    colorScheme: 'light',
    fontFamily: 'system-ui'
  })),

  // Utility Function - rem
  rem: jest.fn((value: number) => `${value}rem`),

  /**
   * Portal - Renders children into a DOM node outside the parent component hierarchy
   * In tests, we render into a container div with a test-id for queryability
   *
   * NOTE: This mock is duplicated from mantine-layout-mocks.ts because jest.mock() calls
   * don't stack - the last mock of @mantine/core wins. We need to include the Portal mock
   * in each file that mocks @mantine/core to ensure it's always available.
   */
  Portal: ({ children }: { children?: React.ReactNode }) => {
    // In tests, render children in a container div with test-id for queryability
    if (!children) {
      return null;
    }
    // Wrap in a div with test-id so Portal content is queryable in tests
    return React.createElement('div', {
      'data-testid': 'mantine-portal',
      'data-portal': 'true'
    }, children);
  }
}));
