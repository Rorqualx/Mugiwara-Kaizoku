/**
 * Download Client Folders Settings Component
 *
 * Simplified orchestrator for path mapping configuration.
 * Uses extracted hooks and components for maintainability.
 *
 * Architecture:
 * - usePathMappings: State and CRUD operations
 * - useBrowseDirectory: Directory browsing functionality
 * - ClientPathInput: Reusable client input (replaces 4 duplicate sections)
 * - BrowseModal: Directory browser modal
 * - HelpAlert: Help and documentation section
 *
 * Refactored from: 721 lines → ~150 lines
 * - Extracted state management to custom hooks
 * - Deduplicated 4 client input sections into reusable component
 * - Separated concerns (UI, state, business logic)
 */

import React, { useState } from 'react';

import { Paper, Stack, Title, Text, Divider, Button, Group, Badge, Alert } from '@mantine/core';
import { IconCheck, IconRefresh, IconActivity, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';

import type { RouterOutputs } from '@/utils/api';
import { trpc } from '@/utils/trpc-client/index';

import { DocumentModal } from '../common/DocumentModal';

import { BrowseModal } from './PathMappingSettings/BrowseModal';
import { ClientPathInput } from './PathMappingSettings/ClientPathInput';
import { HelpAlert } from './PathMappingSettings/HelpAlert';
import { useBrowseDirectory } from './PathMappingSettings/useBrowseDirectory';
import { usePathMappings } from './PathMappingSettings/usePathMappings';

type ClientDiagnostic = RouterOutputs['pathMapping']['diagnoseLive']['clients'][number];
type ProbeBlock = NonNullable<ClientDiagnostic['sessionDir']>;

function ProbeRow({ label, probe }: { label: string; probe: ProbeBlock }): React.ReactElement {
  const ok = probe.accessible;
  return (
    <Text size="sm" c={ok ? 'dimmed' : 'red'}>
      {label}: {probe.remotePath} → {probe.resolvedPath} {ok ? '✓' : `✗ (${probe.error ?? 'not readable'})`}
    </Text>
  );
}

function DiagnosticClientAlert({ c }: { c: ClientDiagnostic }): React.ReactElement {
  const sessionOk = c.sessionDir?.accessible ?? !c.sessionDir;
  const sampleOk = c.sampleTorrentDir?.accessible ?? !c.sampleTorrentDir;
  const allOk = c.reachable && sessionOk && sampleOk;
  const color = allOk ? 'green' : c.enabled ? 'red' : 'gray';
  const titleSuffix = c.enabled ? '' : ' (disabled)';
  return (
    <Alert
      color={color}
      icon={allOk ? <IconCircleCheck size={16} /> : <IconAlertTriangle size={16} />}
      title={`${c.client}${titleSuffix}`}
      variant="light"
    >
      <Stack gap={4}>
        {c.rpcError && <Text size="sm">RPC error: {c.rpcError}</Text>}
        {c.sessionDir && <ProbeRow label="Session dir" probe={c.sessionDir} />}
        {c.sampleTorrentDir && <ProbeRow label="Sample torrent" probe={c.sampleTorrentDir} />}
        {c.suggestion && <Text size="sm" fw={500}>{c.suggestion}</Text>}
      </Stack>
    </Alert>
  );
}

/**
 * Path Mapping Settings Component
 *
 * Main orchestrator component for download client path configuration.
 * Coordinates between hooks and presentational components.
 */
export function PathMappingSettings(): React.ReactElement {
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Deployment-mode chip — fetched once on mount so the user knows whether
  // they're configuring the host or a container.
  const deploymentModeQuery = trpc.pathMapping.getDeploymentMode.useQuery();

  // Live diagnostics — kicked off by the "Run Diagnostics" button. Disabled
  // by default so opening the page doesn't fan out to every download client.
  const diagnoseQuery = trpc.pathMapping.diagnoseLive.useQuery(undefined, { enabled: false });

  // Custom hooks - State management and business logic
  const {
    paths,
    isSaving,
    isTesting,
    handlePathChange,
    handleSave,
    handleTestAll,
  } = usePathMappings();

  const headerWrap = 'nowrap' as const;

  const {
    browseModalOpen,
    currentBrowsePath,
    browseResult,
    isBrowseLoading,
    browseError,
    handleOpenBrowse,
    handleCloseBrowse,
    handleNavigateToPath,
    handleSelectPath,
  } = useBrowseDirectory();

  return (
    <Paper p="md" withBorder mb="xl">
      <Stack gap="md">
        {/* Header */}
        <div>
          <Group justify="space-between" align="flex-start" wrap={headerWrap}>
            <Title order={3} mb="xs">
              Download Client Folders
            </Title>
            {deploymentModeQuery.data && (
              <Badge
                color={deploymentModeQuery.data.deploymentMode === 'docker' ? 'blue' : 'gray'}
                variant="light"
                title="Detected deployment mode (Docker auto-detected via /.dockerenv; override with MUGIWARA_DEPLOYMENT_MODE)"
              >
                {deploymentModeQuery.data.deploymentMode === 'docker' ? 'Running in Docker' : 'Running on host'}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            Tell the app where each download client saves completed downloads.
            Only configure the clients you&apos;re actually using.
          </Text>
        </div>

        <Divider />

        {/* Help Section */}
        <HelpAlert onOpenDocumentation={() => setDocModalOpen(true)} />

        <Divider />

        {/* Transmission Client */}
        <ClientPathInput
          clientKey="transmission"
          clientName="Transmission"
          badgeColor="cyan"
          badgeLabel="Torrent"
          placeholder="/mnt/public/data/completed/transmission"
          value={paths.transmission.downloadPath}
          onChange={(value) => handlePathChange('transmission', value)}
          onBrowse={() => handleOpenBrowse('transmission', paths.transmission.downloadPath)}
        />

        <Divider />

        {/* Deluge Client */}
        <ClientPathInput
          clientKey="deluge"
          clientName="Deluge"
          badgeColor="cyan"
          badgeLabel="Torrent"
          placeholder="/mnt/public/data/completed/deluge"
          value={paths.deluge.downloadPath}
          onChange={(value) => handlePathChange('deluge', value)}
          onBrowse={() => handleOpenBrowse('deluge', paths.deluge.downloadPath)}
        />

        <Divider />

        {/* SABnzbd Client */}
        <ClientPathInput
          clientKey="sabnzbd"
          clientName="SABnzbd"
          badgeColor="indigo"
          badgeLabel="Usenet"
          placeholder="/mnt/public/data/completed/sabnzbd"
          value={paths.sabnzbd.downloadPath}
          onChange={(value) => handlePathChange('sabnzbd', value)}
          onBrowse={() => handleOpenBrowse('sabnzbd', paths.sabnzbd.downloadPath)}
        />

        <Divider />

        {/* NZBGet Client */}
        <ClientPathInput
          clientKey="nzbget"
          clientName="NZBGet"
          badgeColor="indigo"
          badgeLabel="Usenet"
          placeholder="/mnt/public/data/completed/nzbget"
          value={paths.nzbget.downloadPath}
          onChange={(value) => handlePathChange('nzbget', value)}
          onBrowse={() => handleOpenBrowse('nzbget', paths.nzbget.downloadPath)}
        />

        <Divider />

        {/* Action Buttons */}
        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={() => { void diagnoseQuery.refetch(); }}
            loading={diagnoseQuery.isFetching}
            leftSection={<IconActivity size={16} />}
          >
            Run Diagnostics
          </Button>
          <Button
            variant="light"
            onClick={() => { void handleTestAll(); }}
            loading={isTesting}
            leftSection={<IconRefresh size={16} />}
          >
            Test All Paths
          </Button>
          <Button
            onClick={() => { void handleSave(); }}
            loading={isSaving}
            leftSection={<IconCheck size={16} />}
          >
            Save Mappings
          </Button>
        </Group>

        {/* Diagnostics results — one Alert per probed client */}
        {diagnoseQuery.data && (
          <Stack gap="xs">
            {diagnoseQuery.data.clients.map((c) => (
              <DiagnosticClientAlert key={c.client} c={c} />
            ))}
          </Stack>
        )}

        {/* Documentation Modal */}
        <DocumentModal
          opened={docModalOpen}
          onClose={() => setDocModalOpen(false)}
          documentPath="NETWORK_STORAGE_SETUP.md"
          title="Network Storage Setup Guide"
        />

        {/* Browse Modal */}
        <BrowseModal
          opened={browseModalOpen}
          onClose={handleCloseBrowse}
          currentBrowsePath={currentBrowsePath}
          browseResult={browseResult}
          isBrowseLoading={isBrowseLoading}
          browseError={browseError}
          onNavigate={handleNavigateToPath}
          onSelect={() => handleSelectPath(handlePathChange)}
        />
      </Stack>
    </Paper>
  );
}
