/**
 * Mock Tabler Icons
 *
 * Mock implementations of Tabler icons for testing.
 *
 * @example
 * jest.mock('@tabler/icons-react', () => mockTablerIcons);
 *
 * Extracted from: mockComponents.tsx (lines 651-801)
 */

import React from 'react';

import type { MockIconProps } from './types';

export const mockTablerIcons = {
  IconRefresh: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-refresh"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      refresh
    </span>
  ),

  IconPlus: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-plus"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      plus
    </span>
  ),

  IconMinus: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-minus"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      minus
    </span>
  ),

  IconCheck: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-check"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      check
    </span>
  ),

  IconX: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-x"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      x
    </span>
  ),

  IconSearch: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-search"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      search
    </span>
  ),

  IconDownload: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-download"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      download
    </span>
  ),

  IconUpload: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-upload"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      upload
    </span>
  ),

  IconTrash: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-trash"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      trash
    </span>
  ),

  IconEdit: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-edit"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      edit
    </span>
  ),

  IconSettings: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-settings"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      settings
    </span>
  ),

  IconUser: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-user"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      user
    </span>
  ),

  IconAlertCircle: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-alert-circle"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      alert-circle
    </span>
  ),

  IconInfoCircle: ({ size, color, stroke }: MockIconProps): JSX.Element => (
    <span
      data-testid="icon-info-circle"
      data-size={size ?? ''}
      data-color={color ?? ''}
      data-stroke={stroke ?? ''}
    >
      info-circle
    </span>
  ),

  // Add more Tabler icons as needed
};
