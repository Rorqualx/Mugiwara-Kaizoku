/**
 * Native Download Sources — Download Clients page panel.
 *
 * Surfaces the three "in-process" download paths (MangaDex direct, Suwayomi
 * bridge, GetComics DDL) so users can see at a glance which native sources
 * the dispatcher (`releaseDispatcher/dispatch.ts`) can use today.
 *
 * The Suwayomi row carries a dispatch-enable Switch — distinct from the
 * JVM lifecycle controls below. Suwayomi has two independent on/off
 * states: the server process can be running while the dispatcher is
 * told to ignore it (and vice versa). The toggle here is the dispatcher
 * one — it persists `suwayomi.enabled` in the Config table, which
 * `phaseIndexerSearch.loadEnabledSources` reads.
 */
import React from 'react';

import { Anchor, Badge, Group, Loader, Paper, Stack, Switch, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBook, IconExternalLink, IconPlugConnected, IconWorldWww } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

interface SourceRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: { label: string; color: string };
  trailing?: React.ReactNode;
}

function SourceRow({ icon, title, description, status, trailing }: SourceRowProps): React.ReactElement {
  return (
    <Group justify="space-between" align="flex-start">
      <Group gap="sm" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
        {icon}
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={500}>{title}</Text>
            <Badge color={status.color} variant="light" size="sm">
              {status.label}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">{description}</Text>
        </Stack>
      </Group>
      <Group gap="md">
        {trailing}
        <Anchor href="/settings/indexers" size="sm">
          <Group gap={4}>
            <Text size="sm">Configure</Text>
            <IconExternalLink size={14} />
          </Group>
        </Anchor>
      </Group>
    </Group>
  );
}

function useMangaDexStatus(): { label: string; color: string } {
  const { data, isLoading, error } = trpc.nativeDownload.healthCheck.useQuery(undefined, {
    staleTime: 60_000,
    retry: 0,
  });
  if (isLoading) return { label: 'Checking…', color: 'gray' };
  if (error) return { label: 'Unreachable', color: 'red' };
  return data?.status === 'ok'
    ? { label: 'Reachable', color: 'teal' }
    : { label: 'Unhealthy', color: 'orange' };
}

function useSuwayomiStatus(): { label: string; color: string } {
  const { data, isLoading } = trpc.suwayomiV2.getServerStatus.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  if (isLoading) return { label: 'Checking…', color: 'gray' };
  return data?.isRunning === true
    ? { label: `Server up on :${data.port}`, color: 'teal' }
    : { label: 'Server stopped', color: 'gray' };
}

function useGetComicsStatus(): { label: string; color: string } {
  const { data, isLoading } = trpc.getcomics.getSettings.useQuery(undefined, {
    staleTime: 60_000,
  });
  if (isLoading) return { label: 'Checking…', color: 'gray' };
  return data?.enabled === true
    ? { label: 'Enabled', color: 'teal' }
    : { label: 'Disabled', color: 'gray' };
}

/**
 * MangaDex dispatcher-enable toggle. Targets the *download* role only
 * (`mangadex.download.enabled`) — independent of the metadata-provider
 * toggle that lives on the Metadata settings page (`mangadex.enabled`).
 * Flipping this off stops the download pipeline from asking MangaDex
 * for chapters but leaves enrichment-time metadata fetches alone.
 */
function MangaDexDispatchToggle(): React.ReactElement {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.nativeDownload.getDownloadConfig.useQuery(undefined, {
    staleTime: 30_000,
  });
  const mutation = trpc.nativeDownload.updateDownloadConfig.useMutation({
    onSuccess: (_result, variables) => {
      const { enabled } = variables;
      void utils.nativeDownload.getDownloadConfig.invalidate();
      notifications.show({
        title: 'MangaDex dispatch updated',
        message: enabled
          ? 'The download pipeline will ask MangaDex for chapter candidates.'
          : 'The download pipeline will skip MangaDex (metadata fetching is unaffected).',
        color: enabled ? 'teal' : 'gray',
      });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to update MangaDex dispatch', message: error.message });
    },
  });

  if (isLoading) return <Loader size="xs" />;

  return (
    <Switch
      size="md"
      checked={data?.enabled ?? false}
      onChange={(event) => mutation.mutate({ enabled: event.currentTarget.checked })}
      disabled={mutation.isPending}
      aria-label="Use MangaDex in download pipeline"
      label="In pipeline"
      labelPosition="left"
    />
  );
}

/**
 * GetComics dispatcher-enable toggle. Writes `GetComicsSettings.enabled`
 * — the same Prisma row the existing /settings/indexers GetComics
 * section drives, and (after the dispatcher fix) the same flag
 * phaseIndexerSearch reads.
 */
function GetComicsDispatchToggle(): React.ReactElement {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.getcomics.getSettings.useQuery(undefined, {
    staleTime: 30_000,
  });
  const mutation = trpc.getcomics.updateSettings.useMutation({
    onSuccess: (result) => {
      utils.getcomics.getSettings.setData(undefined, result);
      void utils.getcomics.getSettings.invalidate();
      notifications.show({
        title: 'GetComics dispatch updated',
        message: result.enabled
          ? 'The download pipeline will ask GetComics for direct-download links.'
          : 'The download pipeline will skip GetComics.',
        color: result.enabled ? 'teal' : 'gray',
      });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to update GetComics dispatch', message: error.message });
    },
  });

  if (isLoading) return <Loader size="xs" />;

  return (
    <Switch
      size="md"
      checked={data?.enabled ?? false}
      onChange={(event) => mutation.mutate({ enabled: event.currentTarget.checked })}
      disabled={mutation.isPending}
      aria-label="Use GetComics in download pipeline"
      label="In pipeline"
      labelPosition="left"
    />
  );
}

/**
 * Suwayomi dispatcher-enable toggle. Distinct from the server-running
 * status — flipping this off keeps the JVM alive but tells the unified
 * release-search pipeline to skip the Suwayomi adapter.
 */
function SuwayomiDispatchToggle(): React.ReactElement {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.suwayomiV2.getIndexerEnabled.useQuery(undefined, {
    staleTime: 30_000,
  });
  const mutation = trpc.suwayomiV2.setIndexerEnabled.useMutation({
    onSuccess: (result) => {
      // Update React Query cache directly so the Switch reflects the new
      // value without waiting for a refetch (the server-side cache is
      // invalidated in the mutation handler too — this is just for UI
      // snappiness).
      utils.suwayomiV2.getIndexerEnabled.setData(undefined, { enabled: result.enabled });
      void utils.suwayomiV2.getIndexerEnabled.invalidate();
      notifications.show({
        title: 'Suwayomi dispatch updated',
        message: result.enabled
          ? 'The download pipeline will now ask Suwayomi for chapter candidates.'
          : 'The download pipeline will skip Suwayomi.',
        color: result.enabled ? 'teal' : 'gray',
      });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to update Suwayomi dispatch', message: error.message });
    },
  });

  if (isLoading) {
    return <Loader size="xs" />;
  }

  return (
    <Switch
      size="md"
      checked={data?.enabled ?? false}
      onChange={(event) => mutation.mutate({ enabled: event.currentTarget.checked })}
      disabled={mutation.isPending}
      aria-label="Use Suwayomi in download pipeline"
      label="In pipeline"
      labelPosition="left"
    />
  );
}

export function NativeSourcesSection(): React.ReactElement {
  const mangadex = useMangaDexStatus();
  const suwayomi = useSuwayomiStatus();
  const getcomics = useGetComicsStatus();

  return (
    <Paper shadow="xs" p="xl" withBorder mb="xl">
      <Stack gap="xs" mb="lg">
        <Title order={3}>Native Download Sources</Title>
        <Text size="sm" c="dimmed">
          These run in-process and produce CBZ files directly — no external
          torrent or Usenet client required. The dispatcher uses them as
          fallbacks when Prowlarr packs don&apos;t cover every missing chapter.
          Configure each one on the{' '}
          <Anchor href="/settings/indexers" size="sm">Indexers page</Anchor>.
        </Text>
      </Stack>
      <Stack gap="lg">
        <SourceRow
          icon={<IconBook size={22} />}
          title="MangaDex Direct"
          description="Per-chapter CBZ via MangaDex API. No API key required. Independent of MangaDex's metadata-provider role."
          status={mangadex}
          trailing={<MangaDexDispatchToggle />}
        />
        <SourceRow
          icon={<IconPlugConnected size={22} />}
          title="Suwayomi Bridge"
          description="Mihon source extensions (WeebCentral, MangaFire, etc.) proxied through a local JVM."
          status={suwayomi}
          trailing={<SuwayomiDispatchToggle />}
        />
        <SourceRow
          icon={<IconWorldWww size={22} />}
          title="GetComics DDL"
          description="Direct-download links from getcomics.org (manual completion required)."
          status={getcomics}
          trailing={<GetComicsDispatchToggle />}
        />
      </Stack>
    </Paper>
  );
}
