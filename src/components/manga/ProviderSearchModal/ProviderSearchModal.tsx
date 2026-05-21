/**
 * Provider Search Modal with Field Selection
 *
 * Allows searching across providers and selecting individual fields from different sources
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  LoadingOverlay,
  Tabs,
  Paper,
  Divider,
  Checkbox,
  Alert
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconSearch,
  IconCheck,
  IconRefresh,
  IconDatabase,
  IconEye,
  IconAlertCircle,
  IconBook
} from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

import { FieldSelectionTab } from './FieldSelectionTab';
import { PreviewTab } from './PreviewTab';
import { useProviderSearch, createFieldSelectionHandler } from './useProviderSearch';
import { getProviderColor, formatProviderLabel } from './utils';
import { VolumeChapterPreviewTab } from './VolumeChapterPreviewTab';

import type { ProviderSearchModalProps } from './types';

export function ProviderSearchModal({
  opened,
  onClose,
  mangaId,
  mangaTitle,
  currentMetadata,
  providerBindings
}: ProviderSearchModalProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('fields');
  const [autoSelectBest, setAutoSelectBest] = useState(true);
  const utils = trpc.useUtils();

  const {
    providerData,
    fieldSelections,
    isSearching,
    searchError,
    searchAllProviders,
    setFieldSelections,
    resetState
  } = useProviderSearch({
    mangaTitle,
    currentMetadata,
    autoSelectBest,
    providerBindings
  });

  // Search only when modal transitions from closed → open.
  // Using a ref prevents re-triggering when searchAllProviders changes identity
  // (e.g. after a parent refetch updates providerBindings/currentMetadata).
  const prevOpenedRef = useRef(false);
  useEffect(() => {
    if (opened && !prevOpenedRef.current) {
      resetState();
      void searchAllProviders();
    }
    prevOpenedRef.current = opened;
  }, [opened, resetState, searchAllProviders]);

  // Create field selection handler
  const handleFieldSelection = useCallback(
    (field: string, provider: string): void => {
      const handler = createFieldSelectionHandler(providerData, setFieldSelections);
      handler(field, provider);
    },
    [providerData, setFieldSelections]
  );

  // Update metadata mutation
  const mergeMetadataMutation = trpc.manga.mergeMetadataFromProviders.useMutation({
    onSuccess: async () => {
      // Invalidate client-side TanStack Query cache so the manga detail page refetches
      await utils.manga.get.invalidate({ id: mangaId });
      showNotification({
        title: 'Metadata Updated',
        message: 'Manga metadata has been updated with selected fields',
        color: 'green'
      });
      onClose(true);
    },
    onError: (error) => {
      showNotification({
        title: 'Update Failed',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to update metadata',
        color: 'red'
      });
    }
  });

  const handleApplyChanges = useCallback((): void => {
    const fieldSelectionsArray = Object.values(fieldSelections);
    void mergeMetadataMutation.mutateAsync({
      mangaId,
      fieldSelections: fieldSelectionsArray
    });
  }, [fieldSelections, mangaId, mergeMetadataMutation]);

  const handleRefresh = useCallback((): void => {
    void searchAllProviders();
  }, [searchAllProviders]);

  const handleClose = useCallback((): void => {
    void onClose();
  }, [onClose]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group>
          <IconSearch size={20} />
          <Text fw={600}>Find & Select Metadata from All Providers</Text>
        </Group>
      }
      size="xl"
      closeOnClickOutside={false}
      styles={{
        body: { minHeight: 500 }
      }}
    >
      <Stack>
        <LoadingOverlay visible={isSearching} />

        {/* Auto-select option */}
        <Paper p="sm" withBorder>
          <Group justify="space-between">
            <Checkbox
              label="Auto-select best values"
              checked={autoSelectBest}
              onChange={(e) => setAutoSelectBest(e.currentTarget.checked)}
              description="Automatically pick the best value from each provider"
            />
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={handleRefresh}
              disabled={isSearching}
            >
              Refresh Data
            </Button>
          </Group>
        </Paper>

        {/* Search error feedback */}
        {searchError && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
            {searchError}
          </Alert>
        )}

        {/* Available Providers */}
        <ProviderBadges providerData={providerData} />

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="fields" leftSection={<IconDatabase size={16} />}>
              Field Selection
            </Tabs.Tab>
            <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
              Preview
            </Tabs.Tab>
            <Tabs.Tab value="volumes" leftSection={<IconBook size={16} />}>
              Volumes & Chapters
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="fields" pt="xs">
            <FieldSelectionTab
              providerData={providerData}
              fieldSelections={fieldSelections}
              onFieldSelection={handleFieldSelection}
            />
          </Tabs.Panel>

          <Tabs.Panel value="preview" pt="xs">
            <PreviewTab fieldSelections={fieldSelections} />
          </Tabs.Panel>

          <Tabs.Panel value="volumes" pt="xs">
            <VolumeChapterPreviewTab
              providerData={providerData}
              providerBindings={providerBindings}
            />
          </Tabs.Panel>
        </Tabs>

        <Divider />

        {/* Action Buttons */}
        <ModalActions
          selectedCount={Object.keys(fieldSelections).length}
          onCancel={handleClose}
          onApply={handleApplyChanges}
          isApplying={mergeMetadataMutation.isPending}
        />
      </Stack>
    </Modal>
  );
}

/**
 * Provider badges display component
 */
function ProviderBadges({
  providerData
}: {
  providerData: Record<string, unknown>;
}): React.ReactElement {
  return (
    <Group gap="xs">
      <Text size="sm" fw={500}>Available Data From:</Text>
      {Object.keys(providerData).map(provider => (
        <Badge
          key={provider}
          color={getProviderColor(provider)}
          variant="filled"
          size="sm"
        >
          {formatProviderLabel(provider)}
        </Badge>
      ))}
    </Group>
  );
}

/**
 * Modal action buttons component
 */
function ModalActions({
  selectedCount,
  onCancel,
  onApply,
  isApplying
}: {
  selectedCount: number;
  onCancel: () => void;
  onApply: () => void;
  isApplying: boolean;
}): React.ReactElement {
  const handleApply = useCallback((): void => {
    onApply();
  }, [onApply]);

  return (
    <Group justify="space-between">
      <Text size="xs" c="dimmed">
        {selectedCount} fields selected
      </Text>
      <Group>
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          loading={isApplying}
          disabled={selectedCount === 0}
          leftSection={<IconCheck size={16} />}
        >
          Apply Selected Metadata
        </Button>
      </Group>
    </Group>
  );
}
