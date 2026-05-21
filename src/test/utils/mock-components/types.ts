/**
 * Mock Component Types
 *
 * Shared type definitions for mock components used in testing.
 *
 * Extracted from: mockComponents.tsx (lines 1-177)
 */

import type {
  ChangeEvent,
  CSSProperties,
  MouseEvent,
  ReactNode,
} from "react";

/**
 * Props for MockButton component
 */
export interface MockButtonProps extends Record<string, unknown> {
  children?: ReactNode;
  leftSection?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  variant?: string;
  color?: string;
  size?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Props for MockText component
 */
export interface MockTextProps extends Record<string, unknown> {
  children?: ReactNode;
  size?: string;
  fw?: string | number;
  c?: string;
  color?: string;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Props for MockStack component
 */
export interface MockStackProps extends Record<string, unknown> {
  children?: ReactNode;
  gap?: string | number;
  role?: string;
  align?: string;
  justify?: string;
}

/**
 * Props for MockGroup component
 */
export interface MockGroupProps extends Record<string, unknown> {
  children?: ReactNode;
  position?: string;
  justify?: string;
  align?: string;
  gap?: string | number;
  grow?: boolean;
  wrap?: boolean | string;
}

/**
 * Props for MockTitle component
 */
export interface MockTitleProps extends Record<string, unknown> {
  children?: ReactNode;
  order?: number;
  align?: string;
  color?: string;
}

/**
 * Props for MockBox component
 */
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
  style?: CSSProperties;
}

/**
 * Props for MockCard component
 */
export interface MockCardProps extends Record<string, unknown> {
  children?: ReactNode;
  shadow?: string;
  withBorder?: boolean;
  p?: string | number;
  padding?: string | number;
  radius?: string | number;
}

/**
 * Props for MockTextInput component
 */
export interface MockTextInputProps extends Record<string, unknown> {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  placeholder?: string;
  error?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
}

/**
 * Props for MockCheckbox component
 */
export interface MockCheckboxProps extends Record<string, unknown> {
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
}

/**
 * Props for MockSelect component
 */
export interface MockSelectProps extends Record<string, unknown> {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  data?: Array<string | { value: string; label: string }>;
  label?: ReactNode;
  placeholder?: string;
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Props for MockModal component
 */
export interface MockModalProps extends Record<string, unknown> {
  opened?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  centered?: boolean;
  size?: string;
}

/**
 * Props for MockTabs component
 */
export interface MockTabsProps extends Record<string, unknown> {
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
}

/**
 * Props for MockTabsList component
 */
export interface MockTabsListProps extends Record<string, unknown> {
  children?: ReactNode;
}

/**
 * Props for MockTabsPanel component
 */
export interface MockTabsPanelProps extends Record<string, unknown> {
  value?: string;
  children?: ReactNode;
  panel?: string;
}

/**
 * Props for MockTabsTab component
 */
export interface MockTabsTabProps extends Record<string, unknown> {
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
  panel?: string;
}

/**
 * Props for MockProgress component
 */
export interface MockProgressProps extends Record<string, unknown> {
  value?: number;
  animated?: boolean;
  size?: string;
  striped?: boolean;
  "aria-label"?: string;
  color?: string;
}

/**
 * Props for MockProvider component
 */
export interface MockProviderProps extends Record<string, unknown> {
  children?: ReactNode;
}

/**
 * Props for MockIcon component
 */
export interface MockIconProps extends Record<string, unknown> {
  size?: number | string;
  color?: string;
  stroke?: number | string;
}

/**
 * Column definition for MockDataTable
 */
export interface MockDataTableColumn {
  title?: string;
  accessor?: string;
  render?: (record: Record<string, unknown>) => ReactNode;
}

/**
 * Props for MockDataTable component
 */
export interface MockDataTableProps extends Record<string, unknown> {
  records?: Array<Record<string, unknown>>;
  columns?: MockDataTableColumn[];
  page?: number;
  onPageChange?: (page: number) => void;
  totalRecords?: number;
  recordsPerPage?: number;
}
