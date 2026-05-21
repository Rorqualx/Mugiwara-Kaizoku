/**
 * Volume Split Progress Modal Component
 *
 * Displays real-time progress of volume splitting operations in a modal dialog.
 * Shows stage-by-stage progress with visual indicators and completion status.
 */
import React from 'react';

import { Modal, Stack, Group, Text, Alert } from '@mantine/core';
import { IconFile } from '@tabler/icons-react';

import { useVolumeSplitProgress } from '@/hooks/useVolumeSplitProgress';

import { StatusAlerts, ProgressContent, ActionButtons } from './components';
import { useProgressAutoClose } from './hooks/useProgressAutoClose';

import type { VolumeSplitProgressModalProps } from './types';

/**
 * VolumeSplitProgressModal Component
 *
 * Modal dialog showing real-time progress of volume split operation
 */
export function VolumeSplitProgressModal({
  opened,
  onClose,
  operationId,
  volumeName,
  autoCloseOnComplete = true,
  autoCloseDelay = 3000,
  onComplete,
  onError
}: VolumeSplitProgressModalProps): React.ReactElement {
  // Track progress
  const { progress, isLoading, isComplete, isError, error } = useVolumeSplitProgress({
    operationId,
    enabled: opened && operationId !== null,
    pollingInterval: 500,
    onComplete: (completedProgress) => {
      onComplete?.(completedProgress.createdFiles);
    },
    onError: (errorMessage) => {
      onError?.(errorMessage);
    }
  });

  // Auto-close on completion
  useProgressAutoClose({
    isComplete,
    autoCloseOnComplete,
    autoCloseDelay,
    onClose
  });

  const canClose = isComplete || isError;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFile size={20} />
          <Text fw={600}>Volume Split Progress</Text>
        </Group>
      }
      size="lg"
      closeOnClickOutside={canClose}
      closeOnEscape={canClose}
      withCloseButton={canClose}
    >
      <Stack gap="md">
        {/* Volume Name */}
        {volumeName && (
          <Alert color="blue" variant="light">
            <Text size="sm" fw={500}>
              {volumeName}
            </Text>
          </Alert>
        )}

        {/* Status Alerts */}
        <StatusAlerts
          isLoading={isLoading}
          isError={isError}
          isComplete={isComplete}
          error={error}
          errorMessage={progress?.errorMessage}
          chaptersCreated={progress?.chaptersCreated ?? 0}
          autoCloseOnComplete={autoCloseOnComplete}
          autoCloseDelay={autoCloseDelay}
        />

        {/* Progress Display */}
        {progress && !isError && (
          <ProgressContent progress={progress} isComplete={isComplete} />
        )}

        {/* Action Buttons */}
        {canClose && <ActionButtons isComplete={isComplete} onClose={onClose} />}

        {/* Cancellation Warning */}
        {progress && !canClose && (
          <Text size="xs" c="dimmed" fs="italic" ta="center">
            Please wait while the volume is being split. Do not close this window.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
