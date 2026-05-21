import { useState } from 'react';
import type { ReactElement } from 'react';

import { Stack, Tabs, Alert, Center, Loader } from '@mantine/core';
import { IconInfoCircle, IconServer, IconSettings, IconChartBar } from '@tabler/icons-react';

import {
  ConnectionTab as KomgaConnectionTab,
  SyncTab as KomgaSyncTab,
  LibrariesTab as KomgaLibrariesTab,
  StatusTab as KomgaStatusTab
} from '@/components/settings/integrations/komga/components';
import {
  handleSubmit as handleKomgaSubmit,
  handleTestConnection as handleKomgaTestConnection,
  handleSyncAllLibraries
} from '@/components/settings/integrations/komga/handlers';
import { useKomgaForm, useKomgaMutations } from '@/components/settings/integrations/komga/hooks';
import type { KomgaFormValues } from '@/components/settings/integrations/komga/hooks';
import { trpc } from '@/utils/trpc-client/index';

export function KomgaIntegrationContent(): ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('connection');
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.getIntegration.useQuery({ type: 'komga' });
  const { data: statusData, refetch: refetchStatus } = trpc.integrations.komga.getStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const librariesEnabled = Boolean(statusData?.configured && statusData.enabled);
  const { data: librariesData, refetch: refetchLibraries } = trpc.integrations.komga.getLibraries.useQuery(
    undefined,
    librariesEnabled ? { enabled: true } : undefined
  );
  const form = useKomgaForm(settingsData);
  const { isTesting, setIsTesting, updateConfigMutation, testConnectionMutation, syncLibraryMutation } = useKomgaMutations({
    refetchSettings: () => void refetchSettings(),
    refetchStatus: () => void refetchStatus()
  });

  const onTestConnection = (): void => {
    void handleKomgaTestConnection({
      values: form.values,
      setIsTesting,
      mutateAsync: testConnectionMutation.mutateAsync
    });
  };
  const onSubmitConfig = (values: KomgaFormValues): void => {
    void handleKomgaSubmit({ values, mutateAsync: updateConfigMutation.mutateAsync });
  };
  const onSyncAll = (): void => {
    if (!librariesData?.libraries) return;
    void handleSyncAllLibraries({ libraries: librariesData.libraries, mutateAsync: syncLibraryMutation.mutateAsync });
  };
  const onSyncLibrary = (libraryId: string, deep: boolean): void => {
    void syncLibraryMutation.mutateAsync({ libraryId, deep });
  };
  const onRefreshLibraries = (): void => void refetchLibraries();

  if (!settingsData && !statusData) {
    return <Center h={300}><Loader size="lg" /></Center>;
  }

  const connectionStatus = statusData?.connectionStatus ?? 'not_configured';

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle />} color="blue">
        Komga is a media server for your comics, mangas, BDs and magazines. Configure the connection
        to sync your library between Mugiwara Kaizoku and Komga.
      </Alert>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="connection" leftSection={<IconServer size={14} />}>Connection</Tabs.Tab>
          <Tabs.Tab value="sync" leftSection={<IconSettings size={14} />}>Sync Settings</Tabs.Tab>
          <Tabs.Tab value="libraries" leftSection={<IconChartBar size={14} />}>Libraries</Tabs.Tab>
          <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>Status</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="connection" pt="xl">
          <KomgaConnectionTab
            form={form}
            connectionStatus={connectionStatus}
            isTesting={isTesting}
            isTestingConnection={testConnectionMutation.isPending}
            isUpdating={updateConfigMutation.isPending}
            onTestConnection={onTestConnection}
            onSubmit={onSubmitConfig}
          />
        </Tabs.Panel>
        <Tabs.Panel value="sync" pt="xl">
          <KomgaSyncTab
            form={form}
            connectionStatus={connectionStatus}
            isSyncing={syncLibraryMutation.isPending}
            isUpdating={updateConfigMutation.isPending}
            onSyncAll={onSyncAll}
            onSubmit={onSubmitConfig}
          />
        </Tabs.Panel>
        <Tabs.Panel value="libraries" pt="xl">
          <KomgaLibrariesTab
            libraries={librariesData?.libraries}
            connectionStatus={connectionStatus}
            isSyncing={syncLibraryMutation.isPending}
            onRefresh={onRefreshLibraries}
            onSyncLibrary={onSyncLibrary}
          />
        </Tabs.Panel>
        <Tabs.Panel value="status" pt="xl">
          <KomgaStatusTab status={statusData} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
