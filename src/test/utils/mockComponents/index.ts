/**
 * Mock Components - Main Aggregator
 *
 * This module aggregates all mock component implementations for testing.
 * Re-exports all types, Mantine components, Tabler icons, and DataTable mock.
 *
 * Architecture:
 * - types.ts - All prop interfaces (20 types)
 * - mantine-core.tsx - Button, Text, Stack, Group, Title, Box, Card (7 components)
 * - mantine-inputs.tsx - TextInput, Checkbox, Select (3 components)
 * - mantine-overlay.tsx - Modal, Tabs*, Progress, MantineProvider (7 components)
 * - tabler-icons.tsx - 14 icon mocks + aggregated object
 * - datatable.tsx - DataTable mock (1 component)
 *
 * Original: mockComponents.tsx (873 lines)
 * Refactored: 6 modules (max 222 lines each)
 *
 * @example
 * // Mock Mantine core in tests
 * jest.mock('@mantine/core', () => mockMantineComponents);
 *
 * // Mock Tabler icons in tests
 * jest.mock('@tabler/icons-react', () => mockTablerIcons);
 *
 * // Mock DataTable in tests
 * jest.mock('mantine-datatable', () => ({ DataTable: mockDataTable }));
 */

// ============================================================================
// Type Exports
// ============================================================================

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
  MockIconProps,
  MockDataTableColumn,
  MockDataTableProps,
} from './types';

// ============================================================================
// Mantine Core Component Exports
// ============================================================================

import {
  Button,
  Text,
  Stack,
  Group,
  Title,
  Box,
  Card,
} from './mantine-core';

// ============================================================================
// Mantine Input Component Exports
// ============================================================================

import {
  TextInput,
  Checkbox,
  Select,
} from './mantine-inputs';

// ============================================================================
// Mantine Overlay & Feedback Component Exports
// ============================================================================

import {
  Modal,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Progress,
  MantineProvider,
} from './mantine-overlay';

// ============================================================================
// Tabler Icon Exports
// ============================================================================

export {
  IconRefresh,
  IconPlus,
  IconMinus,
  IconCheck,
  IconX,
  IconSearch,
  IconDownload,
  IconUpload,
  IconTrash,
  IconEdit,
  IconSettings,
  IconUser,
  IconAlertCircle,
  IconInfoCircle,
  mockTablerIcons,
} from './tabler-icons';

// ============================================================================
// DataTable Export
// ============================================================================

export { mockDataTable } from './datatable';

// ============================================================================
// Aggregated Mantine Components Export
// ============================================================================

/**
 * Mock Mantine components object
 *
 * Use this in jest.mock() calls:
 * @example
 * jest.mock('@mantine/core', () => mockMantineComponents);
 */
export const mockMantineComponents = {
  // Core components
  Button,
  Text,
  Stack,
  Group,
  Title,
  Box,
  Card,

  // Input components
  TextInput,
  Checkbox,
  Select,

  // Overlay & feedback components
  Modal,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Progress,
  MantineProvider,
};
