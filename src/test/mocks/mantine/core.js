/**
 * Enhanced Mantine Core Mock for Testing
 * 
 * Provides comprehensive mocking for Mantine v7 components, focusing on
 * components that require complex DOM structure and state management.
 */

const React = require('react');

// Enhanced Modal mock that renders children properly
const Modal = ({ opened, onClose: _onClose, title, children, ...props }) => {
  if (!opened) return null;
  
  return React.createElement('div', {
    'data-testid': 'mantine-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title ? 'modal-title' : undefined,
    ...props
  }, [
    title && React.createElement('h2', { 
      key: 'title', 
      id: 'modal-title',
      'data-testid': 'modal-title' 
    }, title),
    React.createElement('div', { 
      key: 'content',
      'data-testid': 'modal-content' 
    }, children)
  ]);
};

// Enhanced Menu mock that renders dropdown content properly
const Menu = ({ children, opened: _opened, ...props }) => {
  return React.createElement('div', {
    'data-testid': 'mantine-menu',
    ...props
  }, children);
};

const MenuTarget = ({ children }) => {
  return React.createElement('div', {
    'data-testid': 'mantine-menu-target'
  }, children);
};

const MenuDropdown = ({ children, ...props }) => {
  return React.createElement('div', {
    'data-testid': 'mantine-menu-dropdown',
    role: 'menu',
    ...props
  }, children);
};

const MenuItem = ({ children, onClick, disabled, ...props }) => {
  return React.createElement('button', {
    'data-testid': 'mantine-menu-item',
    role: 'menuitem',
    onClick: disabled ? undefined : onClick,
    disabled,
    type: 'button',
    ...props
  }, children);
};

const MenuDivider = (props) => {
  return React.createElement('hr', {
    'data-testid': 'mantine-menu-divider',
    role: 'separator',
    ...props
  });
};

// Enhanced Popover mock that renders content properly
const Popover = ({ children, opened: _opened, ...props }) => {
  return React.createElement('div', {
    'data-testid': 'mantine-popover',
    ...props
  }, children);
};

const PopoverTarget = ({ children }) => {
  return React.createElement('div', {
    'data-testid': 'mantine-popover-target'
  }, children);
};

const PopoverDropdown = ({ children, ...props }) => {
  return React.createElement('div', {
    'data-testid': 'mantine-popover-dropdown',
    ...props
  }, children);
};

// Enhanced Collapse mock
const Collapse = ({ in: inProp, children, ...props }) => {
  if (!inProp) return null;
  
  return React.createElement('div', {
    'data-testid': 'mantine-collapse',
    ...props
  }, children);
};

// Enhanced Checkbox mock
const Checkbox = ({ checked, onChange, label, disabled, color, ...props }) => {
  return React.createElement('label', {
    'data-testid': 'mantine-checkbox-label',
    style: { display: 'flex', alignItems: 'center', gap: '8px' }
  }, [
    React.createElement('input', {
      key: 'input',
      type: 'checkbox',
      role: 'checkbox',
      checked: !!checked,
      onChange: disabled ? undefined : onChange,
      disabled,
      'data-testid': 'mantine-checkbox',
      'data-color': color,
      ...props
    }),
    label && React.createElement('span', { key: 'label' }, label)
  ]);
};

// Enhanced Select mock
const Select = ({ value, onChange, data, placeholder, disabled, searchable, ...props }) => {
  return React.createElement('select', {
    'data-testid': 'mantine-select',
    value: value || '',
    onChange: (e) => onChange && onChange(e.target.value),
    disabled,
    'data-searchable': searchable,
    ...props
  }, [
    placeholder && React.createElement('option', { key: 'placeholder', value: '' }, placeholder),
    ...(data || []).map((item, index) => 
      React.createElement('option', { 
        key: index, 
        value: typeof item === 'string' ? item : item.value 
      }, typeof item === 'string' ? item : item.label)
    )
  ]);
};

// Enhanced Code mock
const Code = ({ children, ...props }) => {
  return React.createElement('code', {
    'data-testid': 'mantine-code',
    ...props
  }, children);
};

// Enhanced Text Input mock
const TextInput = ({ value, onChange, placeholder, disabled, leftSection, rightSection, ...props }) => {
  return React.createElement('div', {
    className: 'mantine-textinput-wrapper'
  }, [
    leftSection && React.createElement('div', { key: 'left', className: 'mantine-textinput-left' }, leftSection),
    React.createElement('input', {
      key: 'input',
      'data-testid': 'mantine-textinput',
      type: 'text',
      value: value || '',
      onChange: (e) => onChange && onChange(e),
      placeholder,
      disabled,
      ...props
    }),
    rightSection && React.createElement('div', { key: 'right', className: 'mantine-textinput-right' }, rightSection)
  ]);
};

// Enhanced LoadingOverlay mock
const LoadingOverlay = ({ visible, ...props }) => {
  if (!visible) return null;
  
  return React.createElement('div', {
    'data-testid': 'mantine-loading-overlay',
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    ...props
  }, React.createElement('div', { 'data-testid': 'mantine-loader' }, 'Loading...'));
};

// Re-export existing components that work well
const {
  MantineProvider,
  Box,
  Group,
  Stack,
  Button,
  ActionIcon,
  Text,
  Title,
  Container,
  AppShell,
  UnstyledButton,
  Image,
  Divider,
  Badge,
  Tooltip
} = require('@mantine/core');

// Create compound components with nested accessors
const MenuCompound = Object.assign(Menu, {
  Target: MenuTarget,
  Dropdown: MenuDropdown,
  Item: MenuItem,
  Divider: MenuDivider
});

const PopoverCompound = Object.assign(Popover, {
  Target: PopoverTarget,
  Dropdown: PopoverDropdown
});

module.exports = {
  // Enhanced mocks for complex components
  Modal,
  Menu: MenuCompound,
  'Menu.Target': MenuTarget,
  'Menu.Dropdown': MenuDropdown,
  'Menu.Item': MenuItem,
  'Menu.Divider': MenuDivider,
  Popover: PopoverCompound,
  'Popover.Target': PopoverTarget,
  'Popover.Dropdown': PopoverDropdown,
  Collapse,
  Checkbox,
  Select,
  Code,
  TextInput,
  LoadingOverlay,

  // Re-export working components
  MantineProvider,
  Box,
  Group,
  Stack,
  Button,
  ActionIcon,
  Text,
  Title,
  Container,
  AppShell,
  UnstyledButton,
  Image,
  Divider,
  Badge,
  Tooltip
};