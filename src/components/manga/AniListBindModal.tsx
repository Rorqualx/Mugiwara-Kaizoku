/**
 * AniList Binding Modal Component
 *
 * Provides interface for binding manga to AniList entries.
 * Supports pasting full AniList URLs, shows bound indicator,
 * and allows unbinding.
 *
 * @module components/manga/AniListBindModal
 */

import React, { useState } from 'react';

import {
  Modal,
  TextInput,
  Button,
  Stack,
  Text,
  Group,
  Loader,
  Badge,
  Paper
} from '@mantine/core';
import { IconSearch, IconCheck, IconTrash, IconExternalLink } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

interface AniListBindModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  mangaTitle: string;
  existingAnilistId?: string | null;
  onSuccess?: () => void;
}

/**
 * Extracts a numeric AniList ID from a raw input string.
 * Accepts plain numbers or full AniList URLs.
 */
function resolveAnilistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Extract from full URL: https://anilist.co/manga/12345 or https://anilist.co/manga/12345/Title
  if (trimmed.includes('anilist.co')) {
    const urlMatch = trimmed.match(/anilist\.co\/manga\/(\d+)/);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }
    return null;
  }

  // Plain numeric ID
  const numericId = parseInt(trimmed, 10);
  if (!isNaN(numericId) && String(numericId) === trimmed) {
    return trimmed;
  }

  return null;
}

export function AniListBindModal({
  opened,
  onClose,
  mangaId,
  mangaTitle,
  existingAnilistId,
  onSuccess
}: AniListBindModalProps): React.ReactElement {
  const [anilistId, setAnilistId] = useState<string>(existingAnilistId ?? '');
  const [searchQuery, setSearchQuery] = useState<string>(mangaTitle);
  const [isSearching, setIsSearching] = useState(false);
  const [isBound, setIsBound] = useState(Boolean(existingAnilistId));
  const utils = trpc.useUtils();

  // Update state when the modal opens
  React.useEffect(() => {
    if (opened) {
      const hasBind = Boolean(existingAnilistId);
      setIsBound(hasBind);
      if (existingAnilistId) {
        setAnilistId(existingAnilistId);
      }
    }
  }, [opened, existingAnilistId]);

  // Mutation for binding manga to AniList
  const bindMutation = trpc.manga.bind.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Successfully bound manga to AniList' });
      setIsBound(true);
      // Invalidate client-side tRPC cache so page refetches fresh data
      void utils.manga.get.invalidate({ id: mangaId });
      void utils.manga.detail.invalidate({ id: mangaId });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Binding Failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Mutation for unbinding from AniList
  const unbindMutation = trpc.manga.unbindProvider.useMutation({
    onSuccess: (result) => {
      notify({ severity: 'INFO', title: 'Unbound', message: result.message });
      setIsBound(false);
      setAnilistId('');
      // Invalidate client-side tRPC cache so page refetches fresh data
      void utils.manga.get.invalidate({ id: mangaId });
      void utils.manga.detail.invalidate({ id: mangaId });
      onSuccess?.();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Unbind Failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  const handleBind = (): void => {
    const resolvedId = resolveAnilistId(anilistId);

    if (!resolvedId) {
      notify({ severity: 'ERROR', title: 'Error', message: 'Please enter a valid AniList ID or URL (e.g., 12345 or https://anilist.co/manga/12345)' });
      return;
    }

    // Update the input field with the resolved ID
    if (resolvedId !== anilistId.trim()) {
      setAnilistId(resolvedId);
    }

    void bindMutation.mutateAsync({
      mangaId,
      anilistId: resolvedId,
      title: mangaTitle,
      detail: `Bound to AniList ID: ${resolvedId}`
    });
  };

  const handleUnbind = (): void => {
    void unbindMutation.mutateAsync({
      mangaId,
      provider: 'anilist'
    });
  };

  const handleSearch = (): void => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const searchUrl = `https://anilist.co/search/manga?search=${encodeURIComponent(searchQuery)}`;
      window.open(searchUrl, '_blank');

      notify({ severity: 'INFO', title: 'Search Opened', message: 'AniList search has been opened in a new tab. Copy the ID from the URL.' });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Bind to AniList"
      size="md"
    >
      <Stack>
        {/* Search Section */}
        <Stack gap="xs" style={{ opacity: isBound ? 0.4 : 1, pointerEvents: isBound ? 'none' : 'auto' }}>
          <TextInput
            label="Search AniList"
            placeholder="Search for manga on AniList"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            rightSection={isSearching ? <Loader size={16} /> : <IconSearch size={16} />}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleSearch(); } }}
            disabled={isBound}
          />

          <Button
            variant="light"
            onClick={handleSearch}
            loading={isSearching}
            disabled={isBound}
            fullWidth
          >
            Search on AniList
          </Button>
        </Stack>

        {/* ID Entry */}
        <Stack gap="xs" style={{ opacity: isBound ? 0.4 : 1, pointerEvents: isBound ? 'none' : 'auto' }}>
          <TextInput
            label="AniList ID or URL"
            placeholder="e.g., 12345 or https://anilist.co/manga/12345"
            value={anilistId}
            onChange={(e) => setAnilistId(e.currentTarget.value)}
            description="The numeric ID or full URL from AniList"
            disabled={isBound}
            required
          />
        </Stack>

        {/* Currently Bound Indicator */}
        {isBound && existingAnilistId && (
          <Paper
            p="lg"
            withBorder
            style={{
              borderColor: 'var(--mantine-color-pink-6)',
              backgroundColor: 'var(--mantine-color-pink-light)'
            }}
          >
            <Stack gap="sm" align="center">
              <Group gap="sm">
                <IconCheck size={24} color="var(--mantine-color-pink-6)" />
                <Text size="lg" fw={700} c="pink.4">
                  Bound to AniList
                </Text>
              </Group>
              <Badge color="pink" size="lg" variant="filled">
                ID: {existingAnilistId}
              </Badge>
              <Button
                component="a"
                href={`https://anilist.co/manga/${existingAnilistId}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                color="pink"
                size="sm"
                leftSection={<IconExternalLink size={16} />}
              >
                View on AniList
              </Button>
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={handleUnbind}
                loading={unbindMutation.isPending}
                mt="xs"
              >
                Remove Binding
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            {isBound ? 'Close' : 'Cancel'}
          </Button>
          {!isBound && (
            <Button
              color="pink"
              onClick={handleBind}
              loading={bindMutation.isPending}
              disabled={!anilistId.trim()}
            >
              Bind to AniList
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
