/**
 * Mock Mantine Overlay & Feedback Components
 *
 * Mock implementations of Mantine overlay, tabs, and feedback components.
 * Includes Modal, Tabs system, Progress, and MantineProvider.
 *
 * Extracted from: mockComponents.tsx (lines 499-649)
 */

import React from 'react';

import type {
  MockModalProps,
  MockTabsProps,
  MockTabsListProps,
  MockTabsPanelProps,
  MockTabsTabProps,
  MockProgressProps,
  MockProviderProps,
} from './types';

// ============================================================================
// Overlay Components
// ============================================================================

export const Modal = ({
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
      {...props}>

      <div className="mantine-Modal-overlay" onClick={onClose} data-testid="modal-overlay" />
      <div className="mantine-Modal-content">
        <div className="mantine-Modal-header">
          {title && <div className="mantine-Modal-title">{title}</div>}
          <button
            className="mantine-Modal-close"
            onClick={onClose}
            aria-label="Close modal"
            data-testid="modal-close">

            ×
          </button>
        </div>
        <div className="mantine-Modal-body">
          {children}
        </div>
      </div>
    </div>);
};

// ============================================================================
// Tabs Components
// ============================================================================

export const Tabs = ({
  value,
  onChange,
  children,
  ...props
}: MockTabsProps): JSX.Element =>
<div
  data-testid="mantine-tabs"
  className="mantine-Tabs-root"
  data-active-tab={value}
  role="tablist"
  {...props}>

    {React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return null;
    // Create a safe props object with TypeScript compatibility
    const childProps = {
      // Ensure we're passing value and onChange safely
      ...(typeof value !== 'undefined' ? { value } : {}),
      ...(typeof onChange === 'function' ? { onChange } : {})
    };
    return React.cloneElement(child, childProps);
  })}
  </div>;

export const TabsList = ({
  children,
  ...props
}: MockTabsListProps): JSX.Element =>
<div
  data-testid="mantine-tabs-list"
  className="mantine-Tabs-list"
  {...props}>

    {children}
  </div>;

export const TabsPanel = ({
  value,
  children,
  panel,
  ...props
}: MockTabsPanelProps): JSX.Element =>
<div
  data-testid="mantine-tabs-panel"
  className="mantine-Tabs-panel"
  role="tabpanel"
  hidden={value !== panel}
  {...props}>

    {children}
  </div>;

export const TabsTab = ({
  value,
  onChange,
  children,
  panel,
  ...props
}: MockTabsTabProps): JSX.Element =>
<button
  data-testid="mantine-tabs-tab"
  className="mantine-Tabs-tab"
  role="tab"
  aria-selected={value === panel}
  onClick={() => onChange && panel && onChange(panel)}
  {...props}>

    {children}
  </button>;

// ============================================================================
// Feedback Components
// ============================================================================

export const Progress = ({
  value,
  animated,
  size,
  striped,
  'aria-label': ariaLabel,
  color,
  ...props
}: MockProgressProps): JSX.Element =>
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
  {...props}>

    <div
    className="mantine-Progress-bar"
    style={{ width: `${value ?? 0}%` }} />

  </div>;

// ============================================================================
// Provider Components
// ============================================================================

export const MantineProvider = ({ children }: MockProviderProps): JSX.Element => <>{children}</>;
