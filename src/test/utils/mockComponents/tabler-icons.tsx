/**
 * Mock Tabler Icon Components
 *
 * Mock implementations of @tabler/icons-react components for testing.
 * Each icon renders as a span with an emoji and data attributes for props.
 *
 * @example
 * jest.mock('@tabler/icons-react', () => mockTablerIcons);
 *
 * Extracted from: mockComponents.tsx (lines 651-801)
 */

import type { MockIconProps } from './types';

// ============================================================================
// Icon Components
// ============================================================================

export const IconRefresh = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-refresh"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    🔄
  </span>
);

export const IconPlus = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-plus"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ➕
  </span>
);

export const IconMinus = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-minus"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ➖
  </span>
);

export const IconCheck = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-check"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ✓
  </span>
);

export const IconX = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-x"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ✕
  </span>
);

export const IconSearch = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-search"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    🔍
  </span>
);

export const IconDownload = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-download"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ⬇️
  </span>
);

export const IconUpload = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-upload"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ⬆️
  </span>
);

export const IconTrash = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-trash"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    🗑️
  </span>
);

export const IconEdit = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-edit"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ✏️
  </span>
);

export const IconSettings = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-settings"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ⚙️
  </span>
);

export const IconUser = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-user"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    👤
  </span>
);

export const IconAlertCircle = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-alert-circle"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ⚠️
  </span>
);

export const IconInfoCircle = ({ size, color, stroke }: MockIconProps): JSX.Element => (
  <span
    data-testid="icon-info-circle"
    data-size={size ?? ''}
    data-color={color ?? ''}
    data-stroke={stroke ?? ''}>
    ℹ️
  </span>
);

// ============================================================================
// Aggregated Export
// ============================================================================

/**
 * Mock Tabler icons object for jest.mock()
 *
 * @example
 * jest.mock('@tabler/icons-react', () => mockTablerIcons);
 */
export const mockTablerIcons = {
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
};
