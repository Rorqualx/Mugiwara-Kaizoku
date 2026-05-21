/**
 * Responsive Form Field Types
 */

import type React from 'react';

import type { Text } from '@mantine/core';

export interface ResponsiveFormFieldProps {
  /** Field label */
  label?: React.ReactNode;
  /** Field description */
  description?: React.ReactNode;
  /** Whether field is required */
  required?: boolean;
  /** Error message */
  error?: React.ReactNode;
  /** Tooltip text */
  tooltip?: string;
  /** Field content (input component) */
  children: React.ReactNode;
  /** Label position on desktop */
  labelPosition?: 'top' | 'left';
  /** Label width (for left position) */
  labelWidth?: number | string;
  /** Whether to show required indicator */
  showRequiredIndicator?: boolean;
  /** Custom required text */
  requiredText?: string;
  /** Mobile-specific layout */
  mobileLayout?: 'vertical' | 'horizontal';
  /** Additional label props */
  labelProps?: React.ComponentProps<typeof Text>;
}

export interface ResponsiveFormSectionProps {
  /** Section title */
  title?: React.ReactNode;
  /** Section description */
  description?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Whether section is collapsible on mobile */
  collapsibleOnMobile?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Section spacing */
  spacing?: string | number;
}
