/**
 * DirectoryScanSection Component
 *
 * Directory path input and scan controls for the manual import modal.
 *
 * @module components/manga/manual-import/components/DirectoryScanSection
 */

import React from 'react';

import {
  Card,
  Stack,
  Group,
  TextInput,
  Button,
  Alert,
  Text,
  Loader
} from '@mantine/core';
import { IconFolder, IconRefresh, IconSearch } from '@tabler/icons-react';

interface DirectoryScanSectionProps {
  scanPath: string;
  onScanPathChange: (path: string) => void;
  onBrowse: () => void;
  onScan: () => void;
  scanning: boolean;
  filesFound: number;
}

export function DirectoryScanSection({
  scanPath,
  onScanPathChange,
  onBrowse,
  onScan,
  scanning,
  filesFound
}: DirectoryScanSectionProps): React.ReactElement {
  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <TextInput
            label="Directory Path"
            placeholder="/path/to/manga/downloads"
            value={scanPath}
            onChange={(e) => onScanPathChange(e.currentTarget.value)}
            leftSection={<IconFolder size={16} />}
            style={{ flex: 1 }}
            size="sm"
          />
          <Button
            variant="default"
            leftSection={<IconFolder size={16} />}
            onClick={onBrowse}
          >
            Browse
          </Button>
          <Button
            leftSection={scanning ? <Loader size={16} /> : <IconRefresh size={16} />}
            onClick={onScan}
            loading={scanning}
            disabled={!scanPath.trim() || scanning}
          >
            Scan
          </Button>
        </Group>

        {filesFound > 0 && (
          <Alert icon={<IconSearch size={16} />} color="blue" p="xs">
            <Text size="sm">Found {filesFound} file(s)</Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
