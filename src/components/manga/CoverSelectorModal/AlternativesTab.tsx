/**
 * Phase 4 v2-E — Alternatives tab for cover/banner picker.
 *
 * Surfaces `Metadata.fieldAlternatives.cover` / `.bannerImage` — the
 * dissenting candidates the cross-source consensus selector recorded
 * at write time. Selecting one calls `manga.pinFieldOverride` which
 * writes the value plus a `manual: true` flag into provenance so the
 * next re-enrichment doesn't clobber it.
 *
 * Empty state offers a one-click "Refresh alternatives" that triggers
 * `manga.refreshMetaData` — the backfill path for manga whose
 * fieldAlternatives is null (most of the library, pre-cutover).
 */

import React, { useCallback, useState } from 'react';

import {
  Alert, Badge, Box, Button, Group, Image, SimpleGrid, Stack, Text,
} from '@mantine/core';
import { IconCheck, IconInfoCircle, IconLock, IconRefresh } from '@tabler/icons-react';

import {
  parseFieldAlternatives,
  type FieldAlternative,
} from '@/types/domain/field-alternatives-types';
import { proxyImageUrl } from '@/utils/image-proxy';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

type Field = 'cover' | 'bannerImage';

interface AlternativesTabProps {
  mangaId: number;
  fieldAlternatives: unknown;
  currentCover: string;
  currentBanner: string;
  onPinned: () => void;
}

interface AlternativeTileProps {
  alt: FieldAlternative;
  field: Field;
  isCurrent: boolean;
  onPin: (field: Field, value: string) => void;
  pinning: boolean;
}

function AlternativeTile({ alt, field, isCurrent, onPin, pinning }: AlternativeTileProps): React.ReactElement {
  const url = typeof alt.value === 'string' ? alt.value : null;
  if (!url) return <Box />;
  const display = proxyImageUrl(url) ?? url;
  return (
    <Box
      style={{
        border: isCurrent ? '3px solid var(--mantine-color-green-5)' : '1px solid var(--mantine-color-gray-7)',
        borderRadius: 'var(--mantine-radius-md)',
        padding: 8,
        position: 'relative',
      }}
    >
      <Image
        src={display}
        alt={`${alt.provider} ${field}`}
        height={field === 'bannerImage' ? 120 : 200}
        fit="cover"
        radius="sm"
        fallbackSrc="/cover-not-found.jpg"
      />
      <Group justify="space-between" mt="xs" gap={4}>
        <Badge size="xs" variant="dot" color="grape">{alt.provider}</Badge>
        <Badge size="xs" variant="light" color="gray">
          {(alt.confidence * 100).toFixed(0)}%
        </Badge>
      </Group>
      <Button
        size="xs"
        mt="xs"
        fullWidth
        leftSection={isCurrent ? <IconCheck size={12} /> : <IconLock size={12} />}
        color={isCurrent ? 'green' : 'blue'}
        variant={isCurrent ? 'light' : 'filled'}
        disabled={isCurrent || pinning}
        loading={pinning}
        onClick={() => onPin(field, url)}
      >
        {isCurrent ? 'Pinned' : 'Pin'}
      </Button>
    </Box>
  );
}

interface AlternativesSectionProps {
  title: string;
  alts: FieldAlternative[];
  field: Field;
  currentValue: string;
  onPin: (field: Field, value: string) => void;
  pinningField: string | null;
}

function AlternativesSection({
  title, alts, field, currentValue, onPin, pinningField,
}: AlternativesSectionProps): React.ReactElement | null {
  if (alts.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} c="gray.3">{title} ({alts.length})</Text>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
        {alts.map((a, idx) => (
          <AlternativeTile
            key={`${field}-${idx}`}
            alt={a}
            field={field}
            isCurrent={typeof a.value === 'string' && a.value === currentValue}
            onPin={onPin}
            pinning={pinningField === `${field}-${idx}`}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function useAlternativesActions(mangaId: number, onPinned: () => void): {
  pinningField: string | null;
  refreshing: boolean;
  handlePin: (field: Field, value: string, idx: number) => void;
  handleRefresh: () => void;
} {
  const [pinningField, setPinningField] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const pinMutation = trpc.manga.pinFieldOverride.useMutation({
    onSuccess: async () => {
      notify({ severity: 'SUCCESS', title: 'Pinned', message: 'Selection saved and locked from re-enrichment' });
      await utils.manga.get.invalidate({ id: mangaId });
      setPinningField(null);
      onPinned();
    },
    onError: (err) => {
      notify({ severity: 'ERROR', title: 'Failed to pin', message: err.message });
      setPinningField(null);
    },
  });
  const refreshMutation = trpc.manga.refreshMetaData.useMutation({
    onSuccess: async () => {
      notify({ severity: 'SUCCESS', title: 'Refresh started', message: 'Alternatives will populate when enrichment finishes' });
      await utils.manga.get.invalidate({ id: mangaId });
    },
    onError: (err) => {
      notify({ severity: 'ERROR', title: 'Refresh failed', message: err.message });
    },
  });

  const handlePin = useCallback((field: Field, value: string, idx: number): void => {
    setPinningField(`${field}-${idx}`);
    pinMutation.mutate({ mangaId, field, value });
  }, [mangaId, pinMutation]);
  const handleRefresh = useCallback((): void => {
    refreshMutation.mutate({ id: mangaId });
  }, [mangaId, refreshMutation]);

  return { pinningField, refreshing: refreshMutation.isPending, handlePin, handleRefresh };
}

export function AlternativesTab({
  mangaId, fieldAlternatives, currentCover, currentBanner, onPinned,
}: AlternativesTabProps): React.ReactElement {
  const { pinningField, refreshing, handlePin, handleRefresh } = useAlternativesActions(mangaId, onPinned);

  const parsed = parseFieldAlternatives(fieldAlternatives);
  const coverAlts = parsed?.['cover'] ?? [];
  const bannerAlts = parsed?.['bannerImage'] ?? [];
  const hasAny = coverAlts.length > 0 || bannerAlts.length > 0;

  const onPinForCover = (field: Field, value: string): void => {
    const idx = coverAlts.findIndex((a) => a.value === value);
    handlePin(field, value, idx);
  };
  const onPinForBanner = (field: Field, value: string): void => {
    const idx = bannerAlts.findIndex((a) => a.value === value);
    handlePin(field, value, idx);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          Picks here lock the field — re-enrichment won&apos;t overwrite a pinned value.
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconRefresh size={14} />}
          loading={refreshing}
          onClick={handleRefresh}
        >
          Refresh alternatives
        </Button>
      </Group>

      {!hasAny && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            No alternatives recorded for this manga yet. Click <b>Refresh alternatives</b>{' '}
            to run enrichment now — dissenters from the cross-source consensus selector
            will land here when it completes.
          </Text>
        </Alert>
      )}

      <AlternativesSection
        title="Cover Alternatives"
        alts={coverAlts}
        field="cover"
        currentValue={currentCover}
        onPin={onPinForCover}
        pinningField={pinningField}
      />
      <AlternativesSection
        title="Banner Alternatives"
        alts={bannerAlts}
        field="bannerImage"
        currentValue={currentBanner}
        onPin={onPinForBanner}
        pinningField={pinningField}
      />
    </Stack>
  );
}
