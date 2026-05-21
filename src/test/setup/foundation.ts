/**
 * Test Setup - Foundation Types & Utilities
 *
 * Core type definitions and helper functions used across all test mocks.
 * This is the foundation module - all other mocks depend on these exports.
 *
 * Extracted from: src/test/setup.ts (lines 12, 63-89)
 *
 * @module test/setup/foundation
 */

import * as React from 'react';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

/**
 * Re-export getUnknownProperty for convenience across all mock modules.
 * This utility provides safe property access on unknown types.
 */
export { getUnknownProperty };

/**
 * Type guard to check if a value is a record object (object with string keys).
 * Used to safely determine if a value can be treated as a dictionary.
 *
 * @param value - The value to check
 * @returns True if value is a non-null object (record), false otherwise
 *
 * @example
 * ```typescript
 * const data: unknown = { name: 'test' };
 * if (isRecord(data)) {
 *   // data.name is now type-safe
 * }
 * ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Base props for React components in tests.
 * Provides common properties that most React elements accept.
 */
export type CommonProps = {
  /** Child elements or content */
  children?: React.ReactNode;
  /** CSS class name(s) */
  className?: string;
  /** Inline CSS styles */
  style?: React.CSSProperties;
  /** Allow any additional properties for flexibility */
  [key: string]: unknown;
};

/**
 * Mantine-specific component props.
 * Extends CommonProps with Mantine UI framework-specific properties.
 */
export type MantineComponentProps = CommonProps & {
  /** Make element grow to fill available space */
  grow?: boolean;
  /** Text color (Mantine color name or hex) */
  c?: string;
  /** Font weight */
  fw?: string | number;
  /** Size property (Mantine size, e.g., 'sm', 'md', 'lg') */
  size?: string | number;
};

/**
 * Form component props with labels and descriptions.
 * Extends MantineComponentProps with form-specific properties.
 * Used by input components like TextInput, Select, NumberInput, etc.
 */
export type FormComponentProps = MantineComponentProps & {
  /** Label text or element displayed above the input */
  label?: React.ReactNode;
  /** Description text displayed below the input */
  description?: React.ReactNode;
  /** Error message displayed below the input */
  error?: React.ReactNode;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Content displayed on the left side of the input */
  leftSection?: React.ReactNode;
  /** Content displayed on the right side of the input */
  rightSection?: React.ReactNode;
};
