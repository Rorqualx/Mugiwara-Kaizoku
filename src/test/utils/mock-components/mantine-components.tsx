/**
 * Mock Mantine Components
 *
 * Mock implementations of Mantine UI components for testing.
 * These mocks follow the established patterns from our test fixtures.
 *
 * @example
 * jest.mock('@mantine/core', () => mockMantineComponents);
 *
 * Extracted from: mockComponents.tsx (lines 178-649)
 */

import React from 'react';
import type { ReactNode } from 'react';

// Type definitions for mock component props
// These will be moved to types.ts when it's created
interface MockButtonProps extends Record<string, unknown> {
  children?: ReactNode;
  leftSection?: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: string;
  color?: string;
  size?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

interface MockTextProps extends Record<string, unknown> {
  children?: ReactNode;
  size?: string;
  fw?: string | number;
  c?: string;
  color?: string;
  italic?: boolean;
  underline?: boolean;
}

interface MockStackProps extends Record<string, unknown> {
  children?: ReactNode;
  gap?: string | number;
  role?: string;
  align?: string;
  justify?: string;
}

interface MockGroupProps extends Record<string, unknown> {
  children?: ReactNode;
  position?: string;
  justify?: string;
  align?: string;
  gap?: string | number;
  grow?: boolean;
  wrap?: boolean | string;
}

interface MockTitleProps extends Record<string, unknown> {
  children?: ReactNode;
  order?: number;
  align?: string;
  color?: string;
}

interface MockBoxProps extends Record<string, unknown> {
  children?: ReactNode;
  mb?: string | number;
  mt?: string | number;
  mx?: string | number;
  my?: string | number;
  px?: string | number;
  py?: string | number;
  p?: string | number;
  m?: string | number;
  pos?: string;
  style?: React.CSSProperties;
}

interface MockCardProps extends Record<string, unknown> {
  children?: ReactNode;
  shadow?: string;
  withBorder?: boolean;
  p?: string | number;
  padding?: string | number;
  radius?: string | number;
}

interface MockTextInputProps extends Record<string, unknown> {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  placeholder?: string;
  error?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
}

interface MockCheckboxProps extends Record<string, unknown> {
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
}

interface MockSelectProps extends Record<string, unknown> {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  data?: Array<string | { value: string; label: string }>;
  label?: ReactNode;
  placeholder?: string;
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
}

interface MockModalProps extends Record<string, unknown> {
  opened?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  centered?: boolean;
  size?: string;
}

interface MockTabsProps extends Record<string, unknown> {
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
}

interface MockTabsListProps extends Record<string, unknown> {
  children?: ReactNode;
}

interface MockTabsPanelProps extends Record<string, unknown> {
  value?: string;
  children?: ReactNode;
  panel?: string;
}

interface MockTabsTabProps extends Record<string, unknown> {
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
  panel?: string;
}

interface MockProgressProps extends Record<string, unknown> {
  value?: number;
  animated?: boolean;
  size?: string;
  striped?: boolean;
  'aria-label'?: string;
  color?: string;
}

interface MockProviderProps extends Record<string, unknown> {
  children?: ReactNode;
}

/**
 * Mock Mantine components
 * Use these in jest.mock() calls
 *
 * @example
 * jest.mock('@mantine/core', () => mockMantineComponents);
 */
export const mockMantineComponents = {
  Button: ({
    children,
    leftSection,
    onClick,
    variant,
    color,
    size,
    fullWidth,
    disabled,
    loading,
    ...props
  }: MockButtonProps): JSX.Element => (
    <button
      onClick={onClick}
      data-variant={variant ?? ''}
      data-color={color ?? ''}
      data-size={size ?? ''}
      data-fullwidth={fullWidth ? 'true' : 'false'}
      disabled={disabled ?? loading}
      className="mantine-Button-root"
      data-testid="mantine-button"
      {...props}
    >
      {leftSection && <span className="button-left-section">{leftSection}</span>}
      {loading && <span data-testid="loading-spinner">Loading...</span>}
      {children}
    </button>
  ),

  Text: ({
    children,
    size,
    fw,
    c,
    color,
    italic,
    underline,
    ...props
  }: MockTextProps): JSX.Element => (
    <div
      className="mantine-Text-root"
      data-testid="mantine-text"
      data-size={size ?? ''}
      data-fw={fw ?? ''}
      data-color={c ?? color ?? ''}
      data-italic={italic ? 'true' : 'false'}
      data-underline={underline ? 'true' : 'false'}
      {...props}
    >
      {children}
    </div>
  ),

  Stack: ({
    children,
    gap,
    role,
    align,
    justify,
    ...props
  }: MockStackProps): JSX.Element => (
    <div
      role={role}
      data-gap={gap ?? ''}
      data-align={align ?? ''}
      data-justify={justify ?? ''}
      className="mantine-Stack-root"
      data-testid="mantine-stack"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align ?? 'stretch',
        justifyContent: justify ?? 'flex-start',
      }}
      {...props}
    >
      {children}
    </div>
  ),

  Group: ({
    children,
    position,
    justify,
    align,
    gap,
    grow,
    wrap,
    ...props
  }: MockGroupProps): JSX.Element => (
    <div
      className="mantine-Group-root"
      data-testid="mantine-group"
      data-position={position ?? ''}
      data-justify={justify ?? position ?? ''}
      data-align={align ?? ''}
      data-gap={gap ?? ''}
      data-grow={grow ? 'true' : 'false'}
      data-wrap={wrap ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: position ?? justify ?? 'flex-start',
        alignItems: align ?? 'center',
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
      {...props}
    >
      {children}
    </div>
  ),

  Title: ({
    children,
    order,
    align,
    color,
    ...props
  }: MockTitleProps): JSX.Element => {
    // Use React.createElement instead of JSX for dynamic element creation
    const tag = `h${order ?? 1}`;
    return React.createElement(
      tag,
      {
        className: 'mantine-Title-root',
        'data-testid': 'mantine-title',
        'data-order': order ?? '',
        'data-align': align ?? '',
        'data-color': color ?? '',
        style: {
          textAlign: align ?? 'left',
          color: color ?? 'inherit',
        },
        ...props,
      },
      children
    );
  },

  Box: ({
    children,
    mb,
    mt,
    mx,
    my,
    px,
    py,
    p,
    m,
    pos,
    style,
    ...props
  }: MockBoxProps): JSX.Element => (
    <div
      data-testid="mantine-box"
      className="mantine-Box-root"
      data-margin-bottom={mb ?? ''}
      data-margin-top={mt ?? ''}
      data-margin-x={mx ?? ''}
      data-margin-y={my ?? ''}
      data-padding-x={px ?? ''}
      data-padding-y={py ?? ''}
      data-padding={p ?? ''}
      data-margin={m ?? ''}
      data-position={pos ?? ''}
      style={{
        ...(style ?? {}),
        position: (pos as React.CSSProperties['position']) ?? 'static',
      }}
      {...props}
    >
      {children}
    </div>
  ),

  Card: ({
    children,
    shadow,
    withBorder,
    p,
    padding,
    radius,
    ...props
  }: MockCardProps): JSX.Element => (
    <div
      data-testid="mantine-card"
      className="mantine-Card-root"
      data-shadow={shadow ?? ''}
      data-with-border={withBorder ? 'true' : 'false'}
      data-padding={p ?? padding ?? ''}
      data-radius={radius ?? ''}
      {...props}
    >
      {children}
    </div>
  ),

  TextInput: ({
    value,
    onChange,
    label,
    placeholder,
    error,
    description,
    disabled,
    required,
    readOnly,
    ...props
  }: MockTextInputProps): JSX.Element => (
    <div
      data-testid="mantine-text-input"
      className="mantine-TextInput-root"
      data-disabled={disabled ? 'true' : 'false'}
      data-required={required ? 'true' : 'false'}
      data-invalid={error ? 'true' : 'false'}
    >
      {label && (
        <label className="mantine-TextInput-label">
          {label}
          {required && <span className="mantine-TextInput-required">*</span>}
        </label>
      )}
      <input
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder ?? ''}
        disabled={disabled}
        aria-required={required}
        aria-invalid={!!error}
        readOnly={readOnly}
        aria-readonly={readOnly}
        {...props}
      />
      {error && (
        <div className="mantine-TextInput-error" data-testid="input-error">
          {error}
        </div>
      )}
      {description && <div className="mantine-TextInput-description">{description}</div>}
    </div>
  ),

  Checkbox: ({
    checked,
    onChange,
    label,
    disabled,
    indeterminate,
    ...props
  }: MockCheckboxProps): JSX.Element => (
    <div
      data-testid="mantine-checkbox"
      className="mantine-Checkbox-root"
      data-disabled={disabled ? 'true' : 'false'}
      data-checked={checked ? 'true' : 'false'}
      data-indeterminate={indeterminate ? 'true' : 'false'}
    >
      <input
        type="checkbox"
        checked={checked ?? false}
        onChange={onChange}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : checked ? 'true' : 'false'}
        {...props}
      />
      {label && <label className="mantine-Checkbox-label">{label}</label>}
    </div>
  ),

  Select: ({
    value,
    onChange,
    data,
    label,
    placeholder,
    error,
    disabled,
    required,
    ...props
  }: MockSelectProps): JSX.Element => (
    <div
      data-testid="mantine-select"
      className="mantine-Select-root"
      data-disabled={disabled ? 'true' : 'false'}
      data-required={required ? 'true' : 'false'}
      data-invalid={error ? 'true' : 'false'}
    >
      {label && (
        <label className="mantine-Select-label">
          {label}
          {required && <span className="mantine-Select-required">*</span>}
        </label>
      )}
      <select
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        aria-required={required}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {(data ?? []).map((item, index: number) => {
          const itemValue = typeof item === 'string' ? item : item.value;
          const itemLabel = typeof item === 'string' ? item : item.label;
          return (
            <option key={index} value={itemValue}>
              {itemLabel}
            </option>
          );
        })}
      </select>
      {error && (
        <div className="mantine-Select-error" data-testid="select-error">
          {error}
        </div>
      )}
    </div>
  ),

  Modal: ({
    opened,
    onClose,
    title,
    children,
    centered,
    size,
    ...props
  }: MockModalProps): JSX.Element | null => {
    if (!opened) return null;
    return (
      <div
        data-testid="mantine-modal"
        className="mantine-Modal-root"
        data-centered={centered ? 'true' : 'false'}
        data-size={size ?? ''}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <div className="mantine-Modal-overlay" onClick={onClose} data-testid="modal-overlay" />
        <div className="mantine-Modal-content">
          <div className="mantine-Modal-header">
            {title && <div className="mantine-Modal-title">{title}</div>}
            <button
              className="mantine-Modal-close"
              onClick={onClose}
              aria-label="Close modal"
              data-testid="modal-close"
            >
              x
            </button>
          </div>
          <div className="mantine-Modal-body">{children}</div>
        </div>
      </div>
    );
  },

  Tabs: ({ value, onChange, children, ...props }: MockTabsProps): JSX.Element => (
    <div
      data-testid="mantine-tabs"
      className="mantine-Tabs-root"
      data-active-tab={value}
      role="tablist"
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        // Create a safe props object with TypeScript compatibility
        const childProps = {
          // Ensure we're passing value and onChange safely
          ...(typeof value !== 'undefined' ? { value } : {}),
          ...(typeof onChange === 'function' ? { onChange } : {}),
        };
        return React.cloneElement(child, childProps);
      })}
    </div>
  ),

  TabsList: ({ children, ...props }: MockTabsListProps): JSX.Element => (
    <div data-testid="mantine-tabs-list" className="mantine-Tabs-list" {...props}>
      {children}
    </div>
  ),

  TabsPanel: ({ value, children, panel, ...props }: MockTabsPanelProps): JSX.Element => (
    <div
      data-testid="mantine-tabs-panel"
      className="mantine-Tabs-panel"
      role="tabpanel"
      hidden={value !== panel}
      {...props}
    >
      {children}
    </div>
  ),

  TabsTab: ({ value, onChange, children, panel, ...props }: MockTabsTabProps): JSX.Element => (
    <button
      data-testid="mantine-tabs-tab"
      className="mantine-Tabs-tab"
      role="tab"
      aria-selected={value === panel}
      onClick={() => onChange && panel && onChange(panel)}
      {...props}
    >
      {children}
    </button>
  ),

  Progress: ({
    value,
    animated,
    size,
    striped,
    'aria-label': ariaLabel,
    color,
    ...props
  }: MockProgressProps): JSX.Element => (
    <div
      data-testid="mantine-progress"
      className="mantine-Progress-root"
      data-value={String(value)}
      data-animated={String(animated ?? false)}
      data-size={String(size ?? '')}
      data-striped={String(striped ?? false)}
      data-color={String(color ?? '')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={ariaLabel}
      {...props}
    >
      <div className="mantine-Progress-bar" style={{ width: `${value ?? 0}%` }} />
    </div>
  ),

  // MantineProvider wrapper
  MantineProvider: ({ children }: MockProviderProps): JSX.Element => <>{children}</>,
};

// Export individual components for convenience
export const {
  Button,
  Text,
  Stack,
  Group,
  Title,
  Box,
  Card,
  TextInput,
  Checkbox,
  Select,
  Modal,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Progress,
  MantineProvider,
} = mockMantineComponents;

// Export types for use in other modules
export type {
  MockButtonProps,
  MockTextProps,
  MockStackProps,
  MockGroupProps,
  MockTitleProps,
  MockBoxProps,
  MockCardProps,
  MockTextInputProps,
  MockCheckboxProps,
  MockSelectProps,
  MockModalProps,
  MockTabsProps,
  MockTabsListProps,
  MockTabsPanelProps,
  MockTabsTabProps,
  MockProgressProps,
  MockProviderProps,
};
