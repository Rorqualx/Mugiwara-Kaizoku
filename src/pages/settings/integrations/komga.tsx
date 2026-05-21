import type { ReactElement } from 'react';
import React, { useState } from 'react';

import { Text, Stack, Alert, Tabs, Center, Loader } from '@mantine/core';
import { IconInfoCircle, IconServer, IconSettings, IconChartBar } from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { ConnectionTab, SyncTab, LibrariesTab, StatusTab } from '@/components/settings/integrations/komga/components';
import { handleSubmit, handleTestConnection, handleSyncAllLibraries } from '@/components/settings/integrations/komga/handlers';
import { useKomgaForm, useKomgaMutations } from '@/components/settings/integrations/komga/hooks';
import type { KomgaFormValues } from '@/components/settings/integrations/komga/hooks';
import { trpc } from '@/utils/trpc-client/index';
export default function KomgaIntegrationSettings(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('connection');

  // Get current Komga configuration using real tRPC endpoint
  const {
    data: settingsData,
    refetch: refetchSettings
  } = trpc.settings.getIntegration.useQuery({
    type: 'komga'
  });

  // Get Komga status
  const {
    data: statusData,
    refetch: refetchStatus
  } = trpc.integrations.komga.getStatus.useQuery(undefined, {
    refetchInterval: 30_000
  });

  // Get libraries
  const {
    data: librariesData,
    refetch: refetchLibraries
  } = trpc.integrations.komga.getLibraries.useQuery(undefined, statusData?.configured && statusData?.enabled ? {
    enabled: statusData.configured && statusData.enabled
  } : undefined);

  // Use custom hooks
  const form = useKomgaForm(settingsData);
  const {
    isTesting,
    setIsTesting,
    updateConfigMutation,
    testConnectionMutation,
    syncLibraryMutation
  } = useKomgaMutations({
    refetchSettings: () => void refetchSettings(),
    refetchStatus: () => void refetchStatus()
  });

  const isLoading = !settingsData && !statusData;
  const connectionStatus = statusData?.connectionStatus ?? 'not_configured';
  if (isLoading) {
    return (
      <SettingsLayout title="Komga Integration">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Komga Integration">
      <Stack gap="lg">
        <Text c="dimmed" mb="md">
          Connect to your Komga server to sync your manga library
        </Text>

        <Alert icon={<IconInfoCircle />} color="blue">
          Komga is a media server for your comics, mangas, BDs and magazines. Configure the connection
          to sync your library between Mugiwara Kaizoku and Komga.
        </Alert>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="connection" leftSection={<IconServer size={14} />}>
              Connection
            </Tabs.Tab>
            <Tabs.Tab value="sync" leftSection={<IconSettings size={14} />}>
              Sync Settings
            </Tabs.Tab>
            <Tabs.Tab value="libraries" leftSection={<IconChartBar size={14} />}>
              Libraries
            </Tabs.Tab>
            <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>
              Status
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="connection" pt="xl">
            <ConnectionTab
              form={form}
              connectionStatus={connectionStatus}
              isTesting={isTesting}
              isTestingConnection={testConnectionMutation.isPending}
              isUpdating={updateConfigMutation.isPending}
              onTestConnection={() => {
                void handleTestConnection({
                  values: form.values,
                  setIsTesting,
                  mutateAsync: testConnectionMutation.mutateAsync
                });
              }}
              onSubmit={(values: KomgaFormValues) => {
                void handleSubmit({
                  values,
                  mutateAsync: updateConfigMutation.mutateAsync
                });
              }}
            />
          </Tabs.Panel>

          <Tabs.Panel value="sync" pt="xl">
            <SyncTab
              form={form}
              connectionStatus={connectionStatus}
              isSyncing={syncLibraryMutation.isPending}
              isUpdating={updateConfigMutation.isPending}
              onSyncAll={() => {
                if (librariesData?.libraries) {
                  void handleSyncAllLibraries({
                    libraries: librariesData.libraries,
                    mutateAsync: syncLibraryMutation.mutateAsync
                  });
                }
              }}
              onSubmit={(values: KomgaFormValues) => {
                void handleSubmit({
                  values,
                  mutateAsync: updateConfigMutation.mutateAsync
                });
              }}
            />
          </Tabs.Panel>

          <Tabs.Panel value="libraries" pt="xl">
            <LibrariesTab
              libraries={librariesData?.libraries}
              connectionStatus={connectionStatus}
              isSyncing={syncLibraryMutation.isPending}
              onRefresh={() => void refetchLibraries()}
              onSyncLibrary={(libraryId: string, deep: boolean) => {
                void syncLibraryMutation.mutateAsync({ libraryId, deep });
              }}
            />
          </Tabs.Panel>

          <Tabs.Panel value="status" pt="xl">
            <StatusTab status={statusData} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </SettingsLayout>
  );
}

// Use MainLayout for this page to get the full navigation
KomgaIntegrationSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};