import React from 'react';

import {
  Modal,
  Stack,
  Group,
  Text,
  LoadingOverlay,
  Alert,
  Tabs
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

import { DetailsTab } from './DetailsTab';
import { ModalActions } from './ModalActions';
import { ModalHeader } from './ModalHeader';
import { OverviewTab } from './OverviewTab';
import { TagsTab } from './TagsTab';
import { useProviderMetadata } from './useProviderMetadata';

interface ProviderMetadataModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  provider: string;
  currentTitle?: string;
}

export function ProviderMetadataModal({
  opened,
  onClose,
  mangaId,
  provider,
  currentTitle
}: ProviderMetadataModalProps): React.ReactElement {
  const { metadata, isLoading, error, refetch } = useProviderMetadata({
    opened,
    mangaId,
    provider
  });

  // Use bindProvider mutation to update the manga
  const bindProviderMutation = trpc.manga.bindProvider.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Metadata Applied',
        message: `Successfully applied metadata from ${provider}`,
        color: 'green'
      });
      onClose();
    },
    onError: (err) => {
      showNotification({
        title: 'Failed to Apply Metadata',
        message: err.message || 'Could not apply provider metadata',
        color: 'red'
      });
    }
  });

  const handleUseMetadata = (): void => {
    if (metadata?.providerId) {
      bindProviderMutation.mutate({
        mangaId,
        provider: provider as 'comicvine' | 'fandom' | 'wikipedia' | 'anilist',
        providerId: String(metadata.providerId),
        fetchMetadata: true
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { void onClose(); }}
      title={
        <Group gap="xs">
          <IconInfoCircle size={20} />
          <Text fw={500}>Provider Metadata - {provider}</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <LoadingOverlay visible={isLoading} />

      {error && (
        <Alert color="red" mb="md">
          Failed to load metadata
        </Alert>
      )}

      {metadata && (
        <Stack gap="md">
          <ModalHeader
            {...(metadata.title !== undefined && { title: metadata.title })}
            {...(currentTitle !== undefined && { currentTitle })}
            onRefetch={refetch}
          />

          <Tabs defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="tags">Tags & Genres</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <OverviewTab metadata={metadata} provider={provider} />
            </Tabs.Panel>

            <Tabs.Panel value="details" pt="md">
              <DetailsTab metadata={metadata} />
            </Tabs.Panel>

            <Tabs.Panel value="tags" pt="md">
              <TagsTab metadata={metadata} />
            </Tabs.Panel>
          </Tabs>

          <ModalActions
            onClose={onClose}
            onUseMetadata={handleUseMetadata}
            isApplying={bindProviderMutation.isPending}
            isDisabled={!metadata.providerId}
          />
        </Stack>
      )}
    </Modal>
  );
}
