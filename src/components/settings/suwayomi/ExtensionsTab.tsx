/**
 * Extensions tab for the Suwayomi settings panel.
 *
 * Top-down layout:
 *   1. Status row — server / catalog / FlareSolverr chips.
 *   2. Recommended starter pack — five curated cards.
 *   3. Installed extensions list.
 *   4. Searchable, filterable browse catalog (virtualized).
 */
import React, { useMemo, useRef, useState } from 'react';

import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  LoadingOverlay,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

interface ExtensionRow {
  pkgName: string;
  name: string;
  lang: string;
  iconUrl: string;
  isNsfw: boolean;
  isInstalled: boolean;
  versionName?: string;
}

interface RowAction {
  ext: ExtensionRow;
  onAction: () => void;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionColor: string;
}

const RECOMMENDED: Array<{ pkgName: string; tagline: string; sfw: boolean }> = [
  { pkgName: 'eu.kanade.tachiyomi.extension.en.weebcentral', tagline: 'Broad EN catalog', sfw: false },
  { pkgName: 'eu.kanade.tachiyomi.extension.all.mangafire', tagline: 'Multi-language', sfw: false },
  { pkgName: 'eu.kanade.tachiyomi.extension.en.mangapill', tagline: 'Wide EN catalog', sfw: false },
  { pkgName: 'eu.kanade.tachiyomi.extension.en.mangakatana', tagline: 'SFW-marked', sfw: true },
  { pkgName: 'eu.kanade.tachiyomi.extension.en.asurascans', tagline: 'Manhwa', sfw: true },
];

function strip(name: string): string {
  return name.replace(/^Tachiyomi:\s*/i, '');
}

export function ExtensionsTab(): React.ReactElement {
  const statusQuery = trpc.suwayomiV2.getInfrastructureStatus.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const status = statusQuery.data as
    | { isRunning?: boolean; catalogConfigured?: boolean; flareSolverrEnabled?: boolean; extensionCount?: number }
    | undefined;

  return (
    <Stack gap="lg">
      <StatusRow
        isRunning={status?.isRunning === true}
        catalogConfigured={status?.catalogConfigured === true}
        flareSolverrEnabled={status?.flareSolverrEnabled === true}
        extensionCount={status?.extensionCount ?? 0}
      />
      {status?.isRunning === true ? (
        <ExtensionsContent />
      ) : (
        <Alert icon={<IconAlertCircle size="1rem" />} color="yellow">
          Suwayomi server is stopped. Start it from the <strong>Server</strong> tab to install extensions.
        </Alert>
      )}
    </Stack>
  );
}

function StatusRow(props: {
  isRunning: boolean;
  catalogConfigured: boolean;
  flareSolverrEnabled: boolean;
  extensionCount: number;
}): React.ReactElement {
  const { isRunning, catalogConfigured, flareSolverrEnabled, extensionCount } = props;
  return (
    <Group gap="xs">
      <Badge color={isRunning ? 'teal' : 'gray'} variant="dot" size="lg">
        {isRunning ? 'Server up' : 'Server stopped'}
      </Badge>
      <Badge color={catalogConfigured ? 'teal' : 'gray'} variant="dot" size="lg">
        {catalogConfigured ? `Catalog connected (${extensionCount})` : 'No catalog'}
      </Badge>
      <Badge color={flareSolverrEnabled ? 'teal' : 'gray'} variant="dot" size="lg">
        {flareSolverrEnabled ? 'FlareSolverr active' : 'FlareSolverr off'}
      </Badge>
    </Group>
  );
}

function shortName(pkgName: string): string {
  return pkgName.split('.').pop() ?? pkgName;
}

function notifyInstallResult(
  result: { success: boolean; error: string | null },
  pkgName: string,
): void {
  if (result.success) {
    notify({ severity: 'SUCCESS', title: 'Extension installed', message: `${shortName(pkgName)} is ready to use.` });
    return;
  }
  notify({ severity: 'ERROR', title: 'Install failed', message: result.error ?? 'Suwayomi rejected the install request.' });
}

function notifyUninstallResult(
  result: { success: boolean; error: string | null },
  pkgName: string,
): void {
  if (result.success) {
    notify({ severity: 'INFO', title: 'Extension removed', message: `${shortName(pkgName)} uninstalled.` });
    return;
  }
  notify({ severity: 'ERROR', title: 'Uninstall failed', message: result.error ?? 'Suwayomi rejected the uninstall request.' });
}

function notifyMutationError(action: 'Install' | 'Uninstall', pkgName: string, message: string): void {
  notify({ severity: 'ERROR', title: `${action} failed`, message: `${shortName(pkgName)}: ${message}` });
}

function ExtensionsContent(): React.ReactElement {
  const utils = trpc.useUtils();
  const extensionsQuery = trpc.suwayomiV2.getExtensions.useQuery(undefined, { staleTime: 30_000 });
  const invalidate = (): void => {
    void utils.suwayomiV2.getExtensions.invalidate();
    void utils.suwayomiV2.getSources.invalidate();
    void utils.suwayomiV2.getInfrastructureStatus.invalidate();
  };
  const installMutation = trpc.suwayomiV2.installExtension.useMutation({
    onSuccess: (result, vars) => { invalidate(); notifyInstallResult(result, vars.pkgName); },
    onError: (error, vars) => notifyMutationError('Install', vars.pkgName, error.message),
  });
  const uninstallMutation = trpc.suwayomiV2.uninstallExtension.useMutation({
    onSuccess: (result, vars) => { invalidate(); notifyUninstallResult(result, vars.pkgName); },
    onError: (error, vars) => notifyMutationError('Uninstall', vars.pkgName, error.message),
  });

  const payload = extensionsQuery.data as { extensions?: ExtensionRow[] } | undefined;
  const extensions = payload?.extensions ?? [];
  const busy = installMutation.isPending || uninstallMutation.isPending;
  const onInstall = (pkgName: string): void => { installMutation.mutate({ pkgName }); };
  const onUninstall = (pkgName: string): void => { uninstallMutation.mutate({ pkgName }); };

  return (
    <Box style={{ position: 'relative' }}>
      <LoadingOverlay visible={busy} />
      <Stack gap="xl">
        <RecommendedPack extensions={extensions} onInstall={onInstall} />
        <InstalledList extensions={extensions} onUninstall={onUninstall} />
        <BrowseCatalog
          extensions={extensions}
          isLoading={extensionsQuery.isLoading}
          onInstall={onInstall}
          onUninstall={onUninstall}
        />
      </Stack>
    </Box>
  );
}

function RecommendedPack(props: {
  extensions: ExtensionRow[];
  onInstall: (pkgName: string) => void;
}): React.ReactElement {
  const lookup = new Map(props.extensions.map((e) => [e.pkgName, e]));
  const cards = RECOMMENDED.map((r) => ({ ...r, ext: lookup.get(r.pkgName) }));
  const installedCount = cards.filter((c) => c.ext?.isInstalled === true).length;

  if (installedCount === RECOMMENDED.length) {
    return (
      <Alert color="teal" icon={<IconCheck size="1rem" />}>
        Recommended starter pack installed.
      </Alert>
    );
  }

  return (
    <Box>
      <Title order={5} mb="xs">Recommended for English libraries</Title>
      <Text size="xs" c="dimmed" mb="md">
        {installedCount > 0 ? `${installedCount}/${RECOMMENDED.length} installed.` : 'Pick a few to start matching titles in your library.'}
      </Text>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 5 }}>
        {cards.map((c) => (
          <RecommendedCard
            key={c.pkgName}
            pkgName={c.pkgName}
            tagline={c.tagline}
            sfw={c.sfw}
            ext={c.ext}
            onInstall={props.onInstall}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
}

function RecommendedCard(props: {
  pkgName: string;
  tagline: string;
  sfw: boolean;
  ext: ExtensionRow | undefined;
  onInstall: (pkgName: string) => void;
}): React.ReactElement {
  const { pkgName, tagline, sfw, ext, onInstall } = props;
  const installed = ext?.isInstalled === true;
  const displayName = ext ? strip(ext.name) : pkgName.split('.').pop();
  return (
    <Card withBorder padding="sm" radius="md">
      <Stack gap={6} align="center">
        <Avatar name={displayName ?? pkgName} color="initials" size={48} radius="sm" />
        <Text size="sm" fw={500} ta="center" lineClamp={1}>{displayName}</Text>
        <Group gap={4}>
          <Badge size="xs" variant="light">{ext?.lang ?? '—'}</Badge>
          {sfw && <Badge size="xs" color="green" variant="light">SFW</Badge>}
        </Group>
        <Text size="xs" c="dimmed" ta="center" lineClamp={1}>{tagline}</Text>
        {installed ? (
          <Badge color="teal" variant="light" leftSection={<IconCheck size={10} />}>Installed</Badge>
        ) : (
          <Button
            size="xs"
            fullWidth
            leftSection={<IconPlus size={12} />}
            disabled={!ext}
            onClick={(): void => onInstall(pkgName)}
          >
            Install
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function InstalledList(props: {
  extensions: ExtensionRow[];
  onUninstall: (pkgName: string) => void;
}): React.ReactElement | null {
  const installed = props.extensions.filter((e) => e.isInstalled);
  if (installed.length === 0) return null;
  return (
    <Box>
      <Title order={5} mb="xs">Installed ({installed.length})</Title>
      <Stack gap={4}>
        {installed.map((ext) => (
          <ExtensionRowItem
            key={ext.pkgName}
            ext={ext}
            onAction={(): void => props.onUninstall(ext.pkgName)}
            actionLabel="Uninstall"
            actionIcon={<IconTrash size={12} />}
            actionColor="red"
          />
        ))}
      </Stack>
    </Box>
  );
}

interface BrowseCatalogProps {
  extensions: ExtensionRow[];
  isLoading: boolean;
  onInstall: (pkgName: string) => void;
  onUninstall: (pkgName: string) => void;
}

function BrowseCatalog(props: BrowseCatalogProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [showNsfw, setShowNsfw] = useState(false);
  const [installedOnly, setInstalledOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.extensions.filter((ext) => {
      if (!showNsfw && ext.isNsfw) return false;
      if (installedOnly && !ext.isInstalled) return false;
      if (!q) return true;
      return ext.name.toLowerCase().includes(q)
        || ext.pkgName.toLowerCase().includes(q)
        || ext.lang.toLowerCase().includes(q);
    });
  }, [props.extensions, search, showNsfw, installedOnly]);

  return (
    <Box>
      <Title order={5} mb="xs">Browse catalog ({props.extensions.length})</Title>
      <Group mb="sm">
        <TextInput
          placeholder="Search extensions…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e): void => setSearch(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <Switch label="Show NSFW" checked={showNsfw} onChange={(e): void => setShowNsfw(e.currentTarget.checked)} />
        <Switch label="Installed only" checked={installedOnly} onChange={(e): void => setInstalledOnly(e.currentTarget.checked)} />
      </Group>
      <BrowseList filtered={filtered} isLoading={props.isLoading} onInstall={props.onInstall} onUninstall={props.onUninstall} />
    </Box>
  );
}

function BrowseList(props: {
  filtered: ExtensionRow[];
  isLoading: boolean;
  onInstall: (pkgName: string) => void;
  onUninstall: (pkgName: string) => void;
}): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: props.filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  if (props.isLoading) return <Text size="sm" c="dimmed">Loading catalog…</Text>;
  if (props.filtered.length === 0) return <Text size="sm" c="dimmed">No matches.</Text>;

  return (
    <ScrollArea viewportRef={parentRef} h={420} type="auto">
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <BrowseRow
            key={row.key}
            row={row}
            ext={props.filtered[row.index]}
            onInstall={props.onInstall}
            onUninstall={props.onUninstall}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function BrowseRow(props: {
  row: { start: number; index: number };
  ext: ExtensionRow | undefined;
  onInstall: (pkgName: string) => void;
  onUninstall: (pkgName: string) => void;
}): React.ReactElement | null {
  const { row, ext, onInstall, onUninstall } = props;
  if (!ext) return null;
  return (
    <div
      data-index={row.index}
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%',
        transform: `translateY(${row.start}px)`,
      }}
    >
      <ExtensionRowItem
        ext={ext}
        onAction={(): void => {
          if (ext.isInstalled) onUninstall(ext.pkgName);
          else onInstall(ext.pkgName);
        }}
        actionLabel={ext.isInstalled ? 'Uninstall' : 'Install'}
        actionIcon={ext.isInstalled ? <IconTrash size={12} /> : <IconPlus size={12} />}
        actionColor={ext.isInstalled ? 'red' : 'blue'}
      />
    </div>
  );
}

function ExtensionRowItem(props: RowAction): React.ReactElement {
  const { ext } = props;
  const displayName = strip(ext.name);
  return (
    <Group justify="space-between" px="xs" py={6} style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Group gap="sm" style={{ minWidth: 0, flex: 1 }}>
        <Avatar name={displayName} color="initials" size={24} radius="sm" />
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} truncate>{displayName}</Text>
          <Group gap={4}>
            <Badge size="xs" variant="light">{ext.lang}</Badge>
            {ext.isNsfw && <Badge size="xs" color="red" variant="light">NSFW</Badge>}
            {ext.versionName && <Text size="xs" c="dimmed">v{ext.versionName}</Text>}
          </Group>
        </Box>
      </Group>
      <Button
        size="xs"
        variant="light"
        color={props.actionColor}
        leftSection={props.actionIcon}
        onClick={props.onAction}
      >
        {props.actionLabel}
      </Button>
    </Group>
  );
}
