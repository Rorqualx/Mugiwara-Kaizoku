/**
 * Bulk Monitor Toggle Modal
 *
 * Allows users to enable or disable monitoring for all chapters in selected manga.
 */
import React, { useState } from 'react';

import { Modal, Stack, Text, Group, Button, Radio, Box } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

interface BulkMonitorModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (monitored: boolean) => Promise<void>;
  selectedCount: number;
}

export function BulkMonitorModal({
  opened,
  onClose,
  onConfirm,
  selectedCount
}: BulkMonitorModalProps): React.ReactElement {
  const [monitored, setMonitored] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    try {
      await onConfirm(monitored);
      onClose();
    } catch {
      // Error is handled by parent
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (): void => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Set Monitoring Status"
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack gap="md">
        <Text size="sm">
          Set monitoring status for all chapters in {selectedCount} selected manga:
        </Text>

        <Radio.Group value={String(monitored)} onChange={(val) => setMonitored(val === 'true')}>
          <Stack gap="md">
            <Radio
              value="true"
              label={
                <Group gap="xs">
                  <IconEye size={16} />
                  <Box>
                    <Text fw={500}>Enable monitoring</Text>
                    <Text size="xs" c="dimmed">
                      Automatically check for new chapters
                    </Text>
                  </Box>
                </Group>
              }
              disabled={loading}
            />
            <Radio
              value="false"
              label={
                <Group gap="xs">
                  <IconEyeOff size={16} />
                  <Box>
                    <Text fw={500}>Disable monitoring</Text>
                    <Text size="xs" c="dimmed">
                      Stop checking for updates
                    </Text>
                  </Box>
                </Group>
              }
              disabled={loading}
            />
          </Stack>
        </Radio.Group>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} loading={loading}>
            Update {selectedCount} Manga
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
