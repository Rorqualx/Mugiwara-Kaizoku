/**
 * Mock Components - Main Entry Point
 *
 * Aggregates all mock component modules for testing.
 * Use these mocks in jest.mock() calls.
 *
 * @example
 * // Mock Mantine components
 * jest.mock('@mantine/core', () => mockMantineComponents);
 *
 * // Mock Tabler icons
 * jest.mock('@tabler/icons-react', () => mockTablerIcons);
 *
 * // Mock DataTable
 * jest.mock('mantine-datatable', () => ({ DataTable: mockDataTable }));
 *
 * Architecture:
 * - types.ts - Type definitions (20 interfaces)
 * - mantine-components.tsx - Mantine UI mocks (17 components)
 * - tabler-icons.tsx - Tabler icon mocks (14 icons)
 * - datatable.tsx - DataTable mock (1 component)
 *
 * Original: mockComponents.tsx (877 lines)
 * Refactored: 4 modules + index (~1200 lines total)
 */

// Re-export types
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

// Re-export mock components
export { mockMantineComponents } from './mantine-components';
export { mockTablerIcons } from './tabler-icons';
export { mockDataTable } from './datatable';
