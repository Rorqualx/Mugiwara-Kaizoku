/**
 * Kavita Integration Settings Page
 *
 * Main page component for configuring Kavita server integration.
 * Provides tabbed interface for connection, sync, libraries, and status management.
 *
 * This component has been refactored to fix ESLint violations:
 * - Reduced complexity from 45 to under 30 by extracting tab panels
 * - Fixed no-await-in-loop by using Promise.allSettled in parallel
 * - Decomposed mutation handlers into dedicated hook
 * - Separated concerns into focused modules
 *
 * @module pages/settings/integrations/kavita
 */

import type { ReactElement } from 'react';
import React, { useState } from 'react';

import {
  Text,
  Stack,
  Alert,
  Tabs,
  Center,
  Loader
} from '@mantine/core';
import {
  IconInfoCircle,
  IconServer,
  IconSettings,
  IconAdjustments,
  IconChartBar
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { ConnectionTab, LibrariesTab, StatusTab, SyncTab } from '@/components/settings/integrations/kavita/components';
import { useKavitaForm, useKavitaMutations, useKavitaQueries } from '@/components/settings/integrations/kavita/hooks';
import type { TabValue, ConnectionStatus, KavitaFormValues, StatusData } from '@/components/settings/integrations/kavita/types';

/**
 * Kavita Integration Settings Page Component
 *
 * @returns React element
 */
export default function KavitaIntegrationSettings(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabValue>('connection');

  // Queries
  const queriesData = useKavitaQueries();
  const { settingsData, statusData } = queriesData;

  // Form
  const formInstance = useKavitaForm({ settingsData });

  // Mutations
  const { handlers, isTesting, mutations } = useKavitaMutations({
    refetchSettings: queriesData.refetch.settings,
    refetchStatus: queriesData.refetch.status
  });

  // Derived state
  const isLoading = !settingsData && !statusData;
  const connectionStatus: ConnectionStatus = (statusData && typeof statusData === 'object' && 'connectionStatus' in statusData ? (statusData as { connectionStatus: ConnectionStatus }).connectionStatus : 'not_configured');

  // Loading state
  if (isLoading) {
    return (
      <SettingsLayout title="Kavita Integration">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </SettingsLayout>
    );
  }

  // Tab component props
  const tabProps = {
    form: {
      values: formInstance.values,
      getInputProps: (field: keyof KavitaFormValues, options?: { type?: 'checkbox' }) => {
        return formInstance.getInputProps(field, options);
      },
      setFieldValue: (field: keyof KavitaFormValues, value: unknown) => {
        formInstance.setFieldValue(field, value as string | number | boolean | string[]);
      },
      isDirty: (field?: keyof KavitaFormValues) => {
        return field ? formInstance.isDirty(field) : formInstance.isDirty();
      },
      onSubmit: (handler: (values: KavitaFormValues, event?: React.FormEvent) => void) => {
        return (event?: React.FormEvent) => {
          formInstance.onSubmit(handler)(event as React.FormEvent<HTMLFormElement>);
        };
      }
    } as const,
    connectionStatus,
    queriesData,
    mutationHandlers: handlers,
    isTesting,
    mutations
  };

  return (
    <SettingsLayout title="Kavita Integration">
      <Stack gap="lg">
        <Text c="dimmed" mb="md">
          Connect to your Kavita server to sync your manga library
        </Text>

        <Alert icon={<IconInfoCircle />} color="blue">
          Kavita is a fast, feature-rich, cross-platform reading server. Configure the connection
          to sync your library between Mugiwara Kaizoku and Kavita.
        </Alert>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as TabValue)}>
          <Tabs.List>
            <Tabs.Tab value="connection" leftSection={<IconServer size={14} />}>
              Connection
            </Tabs.Tab>
            <Tabs.Tab value="sync" leftSection={<IconSettings size={14} />}>
              Sync Settings
            </Tabs.Tab>
            <Tabs.Tab value="libraries" leftSection={<IconAdjustments size={14} />}>
              Libraries
            </Tabs.Tab>
            <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>
              Status
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="connection" pt="xl">
            <ConnectionTab {...tabProps} />
          </Tabs.Panel>

          <Tabs.Panel value="sync" pt="xl">
            <SyncTab {...tabProps} />
          </Tabs.Panel>

          <Tabs.Panel value="libraries" pt="xl">
            <LibrariesTab {...tabProps} />
          </Tabs.Panel>

          <Tabs.Panel value="status" pt="xl">
            <StatusTab {...tabProps} statusData={statusData as StatusData | undefined} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </SettingsLayout>
  );
}

/**
 * Layout configuration for Kavita settings page
 *
 * @param page - Page element to wrap
 * @returns Wrapped page with layout
 */
KavitaIntegrationSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
