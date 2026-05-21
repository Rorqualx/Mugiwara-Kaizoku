/**
 * Per-manga "Suwayomi Plugin" panel rendered on the manga detail page.
 *
 * Lets the user pick a Mihon source extension, run the matcher, sync chapter
 * ids, and (optionally) override the matched ids by hand. Per-manga enable
 * is implicit: a manga participates in Suwayomi search whenever the global
 * Suwayomi dispatcher toggle is ON (Settings → Download Clients) AND a
 * source is bound here.
 */
import React from 'react';

import {
  Alert,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  LoadingOverlay,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp, IconInfoCircle } from '@tabler/icons-react';

import { useSuwayomiPlugin } from './useSuwayomiPlugin';

interface SuwayomiPluginPanelProps {
  mangaId: number;
}

interface MatchResultShape {
  matched?: boolean;
  confidence?: number;
  reason?: string;
  suwayomiTitle?: string;
}

interface SyncResultShape {
  matched?: number;
  unmatched?: number;
  suwayomiOnly?: number;
  suwayomiTotal?: number;
}

export function SuwayomiPluginPanel({ mangaId }: SuwayomiPluginPanelProps): React.ReactElement {
  const {
    config, sources,
    isLoadingConfig, isLoadingSources, isSaving, isMatching, isSyncing,
    matchResult, syncResult, error,
    updateConfig, runMatch, syncChapters,
  } = useSuwayomiPlugin({ mangaId });

  // The panel defaults to expanded once the manga is bound; collapsed
  // otherwise to keep the detail page tidy.
  const isBound = config?.mangaId !== undefined;
  const [opened, { toggle }] = useDisclosure(isBound);
  const busy = isLoadingConfig || isSaving;

  const sourceOptions = sources.map((s) => ({ value: String(s.id), label: `${s.name} (${s.lang})` }));
  const matchTyped = matchResult as MatchResultShape | undefined;
  const syncTyped = syncResult as SyncResultShape | undefined;

  const { label: statusLabel, color: statusColor } = describeHeaderStatus(config);

  return (
    <Paper p="md" withBorder style={{ position: 'relative' }}>
      <LoadingOverlay visible={busy} />
      <Group justify="space-between" align="center" mb={opened ? 'md' : 0}>
        <Group gap="xs">
          <Title order={4}>Suwayomi Plugin</Title>
          <Badge color={statusColor} variant="light" size="sm">
            {statusLabel}
          </Badge>
        </Group>
        <Button
          variant="subtle" size="xs" onClick={toggle}
          leftSection={opened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          {opened ? 'Collapse' : 'Expand'}
        </Button>
      </Group>

      <Collapse in={opened}>
        <Stack gap="md">
          {error && (
            <Alert icon={<IconInfoCircle size="1rem" />} color="red" title="Suwayomi error">
              {error}
            </Alert>
          )}

          <Text size="sm" c="dimmed">
            Pick a Mihon source extension to bind this title to. The download
            pipeline runs Suwayomi for every bound manga whenever the global
            Suwayomi toggle is on (Settings → Download Clients).
          </Text>

          <Select
            label="Source extension"
            description="Pick from installed Mihon extensions. Install more from Settings → Suwayomi → Extensions."
            placeholder={isLoadingSources ? 'Loading sources…' : 'Select a source'}
            data={sourceOptions}
            value={config?.sourceId ?? null}
            onChange={(value): void => {
              if (value) updateConfig({ sourceId: value });
            }}
            disabled={busy || sourceOptions.length === 0}
          />

          <MatchSection
            config={config}
            matchResult={matchTyped}
            isMatching={isMatching}
            disabled={busy || !config?.sourceId}
            onRunMatch={(): void => runMatch()}
          />

          <SyncSection
            config={config}
            syncResult={syncTyped}
            isSyncing={isSyncing}
            disabled={busy || !config?.mangaId}
            onSync={syncChapters}
          />

          <ManualOverride config={config} disabled={busy} onPatch={updateConfig} />
        </Stack>
      </Collapse>
    </Paper>
  );
}

function describeHeaderStatus(
  config: { sourceId?: string; mangaId?: number } | undefined,
): { label: string; color: string } {
  if (!config?.sourceId) return { label: 'No source', color: 'gray' };
  if (!config.mangaId) return { label: `${config.sourceId} · unmatched`, color: 'orange' };
  return { label: `${config.sourceId} · matched`, color: 'teal' };
}

interface MatchSectionProps {
  config: { mangaId?: number; slug?: string; matchConfidence?: number; lastMatchedAt?: string } | undefined;
  matchResult: MatchResultShape | undefined;
  isMatching: boolean;
  disabled: boolean;
  onRunMatch: () => void;
}

function MatchSection(props: MatchSectionProps): React.ReactElement {
  const { config, matchResult, isMatching, disabled, onRunMatch } = props;
  const confidence = config?.matchConfidence ? config.matchConfidence.toFixed(2) : '—';
  const lastAt = config?.lastMatchedAt ? new Date(config.lastMatchedAt).toLocaleString() : 'never';
  return (
    <Box>
      <Group justify="space-between" align="center" mb="xs">
        <Text fw={500}>Match</Text>
        <Button size="xs" loading={isMatching} disabled={disabled} onClick={onRunMatch}>
          Run match
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Suwayomi mangaId: {config?.mangaId ?? '—'} · Slug: {config?.slug ?? '—'} · Confidence: {confidence} · Last matched: {lastAt}
      </Text>
      {matchResult && (
        <Text size="sm" mt={4} c={matchResult.matched ? 'teal' : 'orange'}>
          {matchResult.matched
            ? `Matched "${matchResult.suwayomiTitle ?? '?'}" (${matchResult.confidence?.toFixed(3) ?? '—'})`
            : `Match failed: ${matchResult.reason ?? 'unknown'}`}
        </Text>
      )}
    </Box>
  );
}

interface SyncSectionProps {
  config: { totalChapters?: number; unmatchedChapters?: number; lastSyncedAt?: string } | undefined;
  syncResult: SyncResultShape | undefined;
  isSyncing: boolean;
  disabled: boolean;
  onSync: () => void;
}

function SyncSection(props: SyncSectionProps): React.ReactElement {
  const { config, syncResult, isSyncing, disabled, onSync } = props;
  const lastAt = config?.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString() : 'never';
  return (
    <Box>
      <Group justify="space-between" align="center" mb="xs">
        <Text fw={500}>Chapters</Text>
        <Button size="xs" loading={isSyncing} disabled={disabled} onClick={onSync}>
          Sync chapters
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Suwayomi total: {config?.totalChapters ?? '—'} · Unmatched locally: {config?.unmatchedChapters ?? '—'} · Last synced: {lastAt}
      </Text>
      {syncResult && (
        <Text size="sm" mt={4} c="teal">
          Sync done — matched {syncResult.matched ?? 0}, unmatched {syncResult.unmatched ?? 0}, Suwayomi-only {syncResult.suwayomiOnly ?? 0}.
        </Text>
      )}
    </Box>
  );
}

interface ManualOverrideProps {
  config: { sourceId?: string; mangaId?: number; slug?: string } | undefined;
  disabled: boolean;
  onPatch: (patch: { sourceId?: string; mangaId?: number; slug?: string }) => void;
}

function ManualOverride(props: ManualOverrideProps): React.ReactElement {
  const { config, disabled, onPatch } = props;
  return (
    <Box>
      <Text fw={500} mb="xs">Manual override</Text>
      <Stack gap="xs">
        <TextInput
          label="sourceId"
          placeholder="en.weebcentral"
          value={config?.sourceId ?? ''}
          onChange={(e): void => onPatch({ sourceId: e.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label="mangaId"
          placeholder="1234"
          type="number"
          value={config?.mangaId ?? ''}
          onChange={(e): void => {
            const n = Number(e.currentTarget.value);
            if (Number.isFinite(n)) onPatch({ mangaId: n });
          }}
          disabled={disabled}
        />
        <TextInput
          label="slug"
          placeholder="vagabond-takehiko-inoue"
          value={config?.slug ?? ''}
          onChange={(e): void => onPatch({ slug: e.currentTarget.value })}
          disabled={disabled}
        />
      </Stack>
    </Box>
  );
}
