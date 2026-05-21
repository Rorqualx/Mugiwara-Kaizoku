/**
 * Chapter Preview Modal Component
 *
 * Allows users to preview detected chapters from a volume file before executing the split.
 * Provides detailed information about:
 * - Detected chapter boundaries
 * - Confidence scores for each chapter
 * - Detection method used
 * - Warnings and potential issues
 *
 * @module components/settings/ChapterPreviewModal
 */

import React, { useState } from 'react';

import { Modal, Stack, Button, Group, LoadingOverlay, Alert, Text } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconEye, IconFile } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import { VolumeSplitProgressModal } from './VolumeSplitProgressModal';
import { VolumeSplitResultCard } from './VolumeSplitResultCard';

/**
 * Type guard to check if an unknown value is a valid detected chapter
 */
function isDetectedChapter(value: unknown): value is {
  chapterNumber: number;
  pageCount: number;
  confidence: number;
  matchedMetadata?: unknown;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['chapterNumber'] === 'number' &&
    typeof obj['pageCount'] === 'number' &&
    typeof obj['confidence'] === 'number'
  );
}

/**
 * Props for ChapterPreviewModal component
 */
interface ChapterPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  volumePath: string;
  volumeNumber: number;
  mangaTitle: string;
  mangaId?: number | undefined;
  onExecute?: (result: unknown) => void;
}

/**
 * ChapterPreviewModal Component
 *
 * Modal dialog for previewing volume split results before execution
 */
export function ChapterPreviewModal({
  opened,
  onClose,
  volumePath,
  volumeNumber,
  mangaTitle,
  mangaId,
  onExecute
}: ChapterPreviewModalProps): JSX.Element {
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);

  // Query to preview the split (non-destructive)
  const { data: previewData, isLoading, error } = trpc.volumeSplit.previewSplit.useQuery(
    {
      volumePath,
      volumeNumber,
      mangaTitle,
      mangaId
    },
    {
      enabled: opened, // Only fetch when modal is open
      refetchOnWindowFocus: false,
      refetchOnMount: true
    }
  );

  // Mutation to execute the actual split
  const executeSplit = trpc.volumeSplit.executeSplit.useMutation({
    onSuccess: (result) => {
      // Operation started successfully - show progress modal
      setIsExecuting(false);

      // Close preview modal
      onClose();

      // Open progress modal with operation ID
      setCurrentOperationId(result.operationId);
      setProgressModalOpen(true);
    },
    onError: (err) => {
      showNotification({
        title: 'Split Failed',
        message: err.message || 'Failed to split volume',
        color: 'red'
      });
      setIsExecuting(false);
    }
  });

  /**
   * Handle execute split button click
   */
  const handleExecuteSplit = (): void => {
    setIsExecuting(true);

    // Determine output directory (you may want to make this configurable)
    const outputDir = volumePath.substring(0, volumePath.lastIndexOf('/'));

    executeSplit.mutate({
      volumePath,
      outputDir,
      volumeNumber,
      mangaTitle,
      mangaId
    });
  };

  /**
   * Handle cancel button click
   */
  const handleCancel = (): void => {
    if (!isExecuting) {
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={
        <Group gap="xs">
          <IconEye size={20} />
          <Text fw={600}>Preview Volume Split</Text>
        </Group>
      }
      size="xl"
      closeOnClickOutside={!isExecuting}
      closeOnEscape={!isExecuting}
    >
      <LoadingOverlay visible={isLoading || isExecuting} />

      <Stack gap="md">
        {/* Info Alert */}
        <Alert icon={<IconFile size={16} />} title="Preview Mode" color="blue">
          <Text size="sm">
            This preview analyzes the volume file structure without creating any files.
            Review the detected chapters below and verify the confidence scores before proceeding.
          </Text>
        </Alert>

        {/* Error State */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Preview Error" color="red">
            <Text size="sm">
              {error.message || 'Failed to analyze volume file'}
            </Text>
          </Alert>
        )}

        {/* Preview Data */}
        {previewData && (
          <VolumeSplitResultCard
            volumeName={previewData.volumeName}
            totalImages={previewData.totalImages}
            detectedChapters={previewData.detectedChapters
              .filter(isDetectedChapter)
              .map((ch) => ({
                chapterNumber: ch.chapterNumber,
                pageCount: ch.pageCount,
                confidence: ch.confidence,
                ...(ch.matchedMetadata
                  ? {
                      matchedMetadata: ch.matchedMetadata as {
                        chapterNumber: number;
                        expectedPageCount?: number;
                        title?: string;
                      }
                    }
                  : {})
              }))}
            method={previewData.method}
            averageConfidence={previewData.averageConfidence}
            warnings={previewData.warnings}
            {...(previewData.metadata && { metadata: previewData.metadata })}
          />
        )}

        {/* Low Confidence Warning */}
        {previewData && previewData.averageConfidence < 0.7 && (
          <Alert icon={<IconAlertCircle size={16} />} title="Low Confidence Warning" color="yellow">
            <Text size="sm">
              The detected chapters have a low confidence score ({(previewData.averageConfidence * 100).toFixed(0)}%).
              This split may not be accurate. Consider:
            </Text>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Checking if the volume file is well-organized</li>
              <li>Manually splitting the volume if automatic detection fails</li>
              <li>Keeping backups of the original volume file</li>
            </ul>
          </Alert>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button
            variant="subtle"
            onClick={handleCancel}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecuteSplit}
            disabled={isExecuting || !previewData || !!error}
            loading={isExecuting}
            color={previewData && previewData.averageConfidence >= 0.7 ? 'green' : 'yellow'}
          >
            {isExecuting ? 'Splitting...' : 'Execute Split'}
          </Button>
        </Group>

        {/* Help Text */}
        <Text size="xs" c="dimmed" fs="italic" ta="center">
          Tip: Keep backups of original volume files before splitting.
        </Text>
      </Stack>

      {/* Progress Modal */}
      <VolumeSplitProgressModal
        opened={progressModalOpen}
        onClose={() => {
          setProgressModalOpen(false);
          setCurrentOperationId(null);
        }}
        operationId={currentOperationId}
        {...(previewData?.volumeName ? { volumeName: previewData.volumeName } : {})}
        onComplete={(createdFiles) => {
          showNotification({
            title: 'Volume Split Complete',
            message: `Created ${createdFiles.length} chapter files`,
            color: 'green'
          });
          if (onExecute) {
            onExecute({ result: { chapterCount: createdFiles.length, createdFiles } });
          }
        }}
        onError={(error) => {
          showNotification({
            title: 'Split Failed',
            message: error,
            color: 'red'
          });
        }}
      />
    </Modal>
  );
}
