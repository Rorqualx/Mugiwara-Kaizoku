/**
 * Directory Selector Component
 *
 * Handles directory path input with browse and manual entry options.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 72-112)
 *
 * @module components/library/library-manager/components/DirectorySelector
 */

import { memo } from 'react';

import { Stack, Group, TextInput, Button, Text } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import type { DirectorySelectorProps } from '../types';

/**
 * Directory selector with browse and manual entry
 *
 * Provides a user interface for selecting a directory to scan. Can be used in two modes:
 * 1. Browse mode: User clicks the Browse button to select a directory
 * 2. Manual entry mode: User types the directory path directly
 *
 * @component
 * @example
 * ```tsx
 * <DirectorySelector
 *   manualPath={false}
 *   scanPathInput="/home/user/manga"
 *   onManualPathChange={handleManualPathChange}
 *   onScanPathInputChange={handlePathChange}
 *   onBrowse={handleBrowse}
 * />
 * ```
 */
export const DirectorySelector = memo<DirectorySelectorProps>(({
  manualPath,
  scanPathInput,
  onManualPathChange,
  onScanPathInputChange,
  onBrowse,
}): JSX.Element => {
  return (
    <Stack gap="xs">
      <Group grow preventGrowOverflow={false}>
        <TextInput
          label="Scan Directory"
          description={
            manualPath
              ? 'Enter an absolute path (e.g., /home/user/manga)'
              : 'Select a directory to scan'
          }
          placeholder={
            manualPath
              ? 'Enter a directory path'
              : 'Click Browse to select'
          }
          value={scanPathInput}
          onChange={onScanPathInputChange}
          readOnly={!manualPath}
          withAsterisk
        />

        {!manualPath && (
          <Button
            variant="default"
            onClick={() => {
              logger.info('Browse button clicked directly');
              onBrowse();
            }}
            leftSection={<IconFolder size={16} />}
            style={{
              maxWidth: '120px',
              alignSelf: 'flex-end',
            }}
          >
            Browse
          </Button>
        )}
      </Group>

      <Group>
        <input
          type="checkbox"
          id="manual-path-checkbox"
          checked={manualPath}
          onChange={onManualPathChange}
          style={{ marginRight: '8px' }}
        />
        <label
          htmlFor="manual-path-checkbox"
          style={{
            cursor: 'pointer',
          }}
        >
          <Text size="sm">Enter path manually</Text>
        </label>
      </Group>

      {!manualPath && (
        <Text size="xs" c="dimmed">
          Note: Due to browser security restrictions, the full path may not be
          displayed. The server will use the actual selected directory for
          scanning.
        </Text>
      )}
    </Stack>
  );
});

DirectorySelector.displayName = 'DirectorySelector';
