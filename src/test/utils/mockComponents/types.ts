/**
 * Mock Component Type Definitions
 *
 * Shared type definitions for mock Mantine, Tabler icons, and DataTable components
 * used in tests. All mock components import their prop types from this module.
 *
 * Extracted from: mockComponents.tsx (lines 10-176)
 */

import React, { ReactNode } from 'react';

// ============================================================================
// Mantine Component Props
// ============================================================================

export interface MockButtonProps extends Record<string, unknown> {
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

export interface MockTextProps extends Record<string, unknown> {
  children?: ReactNode;
  size?: string;
  fw?: string | number;
  c?: string;
  color?: string;
  italic?: boolean;
  underline?: boolean;
}

export interface MockStackProps extends Record<string, unknown> {
  children?: ReactNode;
  gap?: string | number;
  role?: string;
  align?: string;
  justify?: string;
}

export interface MockGroupProps extends Record<string, unknown> {
  children?: ReactNode;
  position?: string;
  justify?: string;
  align?: string;
  gap?: string | number;
  grow?: boolean;
  wrap?: boolean | string;
}

export interface MockTitleProps extends Record<string, unknown> {
  children?: ReactNode;
  order?: number;
  align?: string;
  color?: string;
}

export interface MockBoxProps extends Record<string, unknown> {
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

export interface MockCardProps extends Record<string, unknown> {
  children?: ReactNode;
  shadow?: string;
  withBorder?: boolean;
  p?: string | number;
  padding?: string | number;
  radius?: string | number;
}

export interface MockTextInputProps extends Record<string, unknown> {
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

export interface MockCheckboxProps extends Record<string, unknown> {
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
}

export interface MockSelectProps extends Record<string, unknown> {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  data?: Array<string | { value: string; label: string }>;
  label?: ReactNode;
  placeholder?: string;
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
}

export interface MockModalProps extends Record<string, unknown> {
  opened?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  centered?: boolean;
  size?: string;
}

export interface MockTabsProps extends Record<string, unknown> {
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
}

export interface MockTabsListProps extends Record<string, unknown> {
  children?: ReactNode;
}

export interface MockTabsPanelProps extends Record<string, unknown> {
  value?: string;
  children?: ReactNode;
  panel?: string;
}

export interface MockTabsTabProps extends Record<string, unknown> {
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
  panel?: string;
}

export interface MockProgressProps extends Record<string, unknown> {
  value?: number;
  animated?: boolean;
  size?: string;
  striped?: boolean;
  'aria-label'?: string;
  color?: string;
}

export interface MockProviderProps extends Record<string, unknown> {
  children?: ReactNode;
}

// ============================================================================
// Icon Props
// ============================================================================

export interface MockIconProps extends Record<string, unknown> {
  size?: number | string;
  color?: string;
  stroke?: number | string;
}

// ============================================================================
// DataTable Props
// ============================================================================

export interface MockDataTableColumn {
  title?: string;
  accessor?: string;
  render?: (record: Record<string, unknown>) => ReactNode;
}

export interface MockDataTableProps extends Record<string, unknown> {
  records?: Array<Record<string, unknown>>;
  columns?: MockDataTableColumn[];
  page?: number;
  onPageChange?: (page: number) => void;
  totalRecords?: number;
  recordsPerPage?: number;
}
