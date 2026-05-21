/**
 * Provider Binding Modal Component
 *
 * Generic modal for binding manga to different provider entries
 *
 * @module components/manga/ProviderBindModal
 */

import React, { useState, useEffect } from 'react';

import {
  Modal,
  TextInput,
  Button,
  Stack,
  Text,
  Group,
  Loader,
  Badge,
  Checkbox,
  Paper
} from '@mantine/core';
import { IconSearch, IconLink, IconDatabase, IconCheck, IconTrash, IconExternalLink } from '@tabler/icons-react';

import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import {
  getProviderExternalUrl,
  providerConfig,
  extractProviderIdFromUrl,
  extractIdFromSearchResult
} from './provider-bind-config';

import type { BindableProvider } from './provider-bind-config';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Renders search result items
 */
function SearchResultList({
  results,
  onSelect
}: {
  results: unknown[];
  onSelect: (result: Record<string, unknown>) => void;
}): React.ReactElement {
  return (
    <Stack gap="xs" style={{ maxHeight: 300, overflowY: 'auto' }}>
      {results.filter(isRecord).map((result: Record<string, unknown>, index) => (
        <Button
          key={index}
          variant="light"
          onClick={() => { void onSelect(result); }}
          fullWidth
          style={{ textAlign: 'left', height: 'auto', padding: '8px' }}
        >
          <Stack gap={4}>
            <Text size="sm" fw={500}>{String(result["title"] || 'Unknown')}</Text>
            {result['year'] !== null && (
              <Text size="xs" c="dimmed">Year: {String(result['year'] ?? '')}</Text>
            )}
            {result['publisher'] !== null && (
              <Text size="xs" c="dimmed">Publisher: {String(result['publisher'] ?? '')}</Text>
            )}
          </Stack>
        </Button>
      ))}
    </Stack>
  );
}

/**
 * Renders the bound indicator with external link and unbind button
 */
function BoundIndicator({
  config,
  provider,
  existingProviderId,
  onUnbind,
  isUnbinding
}: {
  config: { name: string; color: string };
  provider: string;
  existingProviderId: string;
  onUnbind: () => void;
  isUnbinding: boolean;
}): React.ReactElement {
  const externalUrl = getProviderExternalUrl(provider, existingProviderId);

  return (
    <Paper
      p="lg"
      withBorder
      style={{
        borderColor: `var(--mantine-color-${config.color}-6)`,
        backgroundColor: `var(--mantine-color-${config.color}-light)`
      }}
    >
      <Stack gap="sm" align="center">
        <Group gap="sm">
          <IconCheck size={24} color={`var(--mantine-color-${config.color}-6)`} />
          <Text size="lg" fw={700} c={`${config.color}.4`}>
            Bound to {config["name"]}
          </Text>
        </Group>
        <Badge color={config.color} size="lg" variant="filled">
          ID: {existingProviderId}
        </Badge>
        {externalUrl && (
          <Button
            component="a"
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="light"
            color={config.color}
            size="sm"
            leftSection={<IconExternalLink size={16} />}
          >
            View on {config["name"]}
          </Button>
        )}
        <Button
          variant="light"
          color="red"
          size="sm"
          leftSection={<IconTrash size={16} />}
          onClick={onUnbind}
          loading={isUnbinding}
          mt="xs"
        >
          Remove Binding
        </Button>
      </Stack>
    </Paper>
  );
}

interface ProviderBindModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  mangaTitle: string;
  provider: BindableProvider;
  existingProviderId?: string | null;
  onSuccess?: () => void;
}

export function ProviderBindModal({
  opened,
  onClose,
  mangaId,
  mangaTitle,
  provider,
  existingProviderId,
  onSuccess
}: ProviderBindModalProps): React.ReactElement {
  const config = providerConfig[provider];
  const [providerId, setProviderId] = useState<string>(existingProviderId ?? '');
  const [searchQuery, setSearchQuery] = useState<string>(mangaTitle);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [fetchMetadata, setFetchMetadata] = useState(true);
  const [isBound, setIsBound] = useState(Boolean(existingProviderId));
  const tRPCUtils = trpc.useUtils();

  // Update provider ID and bound state when the prop changes (when modal opens)
  useEffect(() => {
    if (opened) {
      const hasBind = Boolean(existingProviderId);
      setIsBound(hasBind);
      if (existingProviderId) {
        setProviderId(existingProviderId);
      }
    }
  }, [opened, existingProviderId]);

  // Mutation for binding to provider
  const bindMutation = trpc.manga.bindProvider.useMutation({
    onSuccess: (result) => {
      notify({ severity: 'SUCCESS', title: 'Success', message: result.message });
      setIsBound(true);
      // Invalidate client-side tRPC cache so page refetches fresh data
      void tRPCUtils.manga.get.invalidate({ id: mangaId });
      void tRPCUtils.manga.detail.invalidate({ id: mangaId });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Binding Failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Mutation for unbinding from provider
  const unbindMutation = trpc.manga.unbindProvider.useMutation({
    onSuccess: (result) => {
      notify({ severity: 'INFO', title: 'Unbound', message: result.message });
      setIsBound(false);
      setProviderId('');
      // Invalidate client-side tRPC cache so page refetches fresh data
      void tRPCUtils.manga.get.invalidate({ id: mangaId });
      void tRPCUtils.manga.detail.invalidate({ id: mangaId });
      onSuccess?.();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Unbind Failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  const handleUnbind = async (): Promise<void> => {
    await unbindMutation.mutateAsync({
      mangaId,
      provider
    });
  };

  // tRPCUtils is declared at component top level for cache invalidation and imperative calls

  // Search for manga on the provider
  const handleSearch = async (): Promise<void> => {
    if (!searchQuery.trim()) {
      notify({ severity: 'ERROR', title: 'Error', message: 'Please enter a search query' });
      return;
    }

    setIsSearching(true);
    try {
      const result = await tRPCUtils.client.search.withProvider.query({
        provider: provider,
        query: searchQuery,
        limit: 10
      });

      if (Array.isArray(result)) {
        setSearchResults(result);
        if (result.length === 0) {
          notify({ severity: 'WARNING', title: 'No Results', message: `No manga found on ${config["name"]} for "${searchQuery}"` });
        }
      }
    } catch (error: unknown) {
      logger.error(`Search failed for ${provider}:`, error);
      notify({ severity: 'ERROR', title: 'Search Failed', message: `Failed to search ${config["name"]}: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBind = async (): Promise<void> => {
    let resolvedId = providerId.trim();

    if (!resolvedId) {
      notify({ severity: 'ERROR', title: 'Error', message: `Please enter a ${config["name"]} ID` });
      return;
    }

    // Extract ID from full provider URL if pasted
    const extracted = extractProviderIdFromUrl(provider, resolvedId);
    if (extracted !== resolvedId) {
      resolvedId = extracted;
      setProviderId(resolvedId);
    }

    // Validate ID format
    if (!config.idPattern.test(resolvedId)) {
      notify({ severity: 'ERROR', title: 'Error', message: `Invalid ${config["name"]} ID format` });
      return;
    }

    // Call the new bindProvider mutation
    // The backend will handle metadata fetching if requested
    await bindMutation.mutateAsync({
      mangaId,
      provider,
      providerId: resolvedId,
      fetchMetadata
    });
  };

  const handleSelectResult = (result: Record<string, unknown>): void => {
    setProviderId(extractIdFromSearchResult(provider, result));
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { void onClose(); }}
      title={
        <Group>
          <IconLink size={20} />
          <Text fw={600}>Bind to {config["name"]}</Text>
          <Badge color={config.color} variant="filled" size="sm">
            {provider}
          </Badge>
        </Group>
      }
      size="lg"
    >
      <Stack>
        {/* Search Section */}
        <Stack gap="xs" style={{ opacity: isBound ? 0.4 : 1, pointerEvents: isBound ? 'none' : 'auto' }}>
          <Text size="sm" fw={500}>Search {config["name"]}</Text>
          <Group>
            <TextInput
              flex={1}
              placeholder={`Search for "${mangaTitle}" on ${config["name"]}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') { void handleSearch(); } }}
              disabled={isBound}
            />
            <Button
              leftSection={isSearching ? <Loader size="xs" /> : <IconSearch size={16} />}
              onClick={() => { void handleSearch(); }}
              disabled={isSearching || isBound}
            >
              Search
            </Button>
          </Group>
        </Stack>

        {/* Search Results */}
        {searchResults.length > 0 && !isBound && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Search Results</Text>
            <SearchResultList results={searchResults} onSelect={handleSelectResult} />
          </Stack>
        )}

        {/* Manual ID Entry */}
        <Stack gap="xs" style={{ opacity: isBound ? 0.4 : 1, pointerEvents: isBound ? 'none' : 'auto' }}>
          <Text size="sm" fw={500}>Or Enter ID Manually</Text>
          <TextInput
            label={config.idLabel}
            placeholder={config.idPlaceholder}
            value={providerId}
            onChange={(e) => setProviderId(e.currentTarget.value)}
            description={config.idHelp}
            disabled={isBound}
          />
        </Stack>

        {/* Options */}
        {!isBound && (
          <Paper p="sm" withBorder>
            <Checkbox
              label="Fetch and update metadata from provider"
              checked={fetchMetadata}
              onChange={(e) => setFetchMetadata(e.currentTarget.checked)}
              description="Pull latest metadata when binding to update manga information"
            />
          </Paper>
        )}

        {/* Currently Bound Indicator */}
        {isBound && existingProviderId && (
          <BoundIndicator
            config={config}
            provider={provider}
            existingProviderId={existingProviderId}
            onUnbind={() => { void handleUnbind(); }}
            isUnbinding={unbindMutation.isPending}
          />
        )}

        {/* Action Buttons */}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => { void onClose(); }}>
            {isBound ? 'Close' : 'Cancel'}
          </Button>
          {!isBound && (
            <Button
              color={config.color}
              onClick={() => { void handleBind(); }}
              loading={bindMutation.isPending}
              leftSection={fetchMetadata ? <IconDatabase size={16} /> : <IconLink size={16} />}
            >
              {fetchMetadata ? `Bind & Fetch from ${config["name"]}` : `Bind to ${config["name"]}`}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}