import React, { useState } from 'react';
import type { ReactElement } from 'react';

import { Stack, Tabs, Alert, Center, Loader } from '@mantine/core';
import { IconInfoCircle, IconServer, IconSettings, IconAdjustments, IconChartBar } from '@tabler/icons-react';

import {
  ConnectionTab as KavitaConnectionTab,
  LibrariesTab as KavitaLibrariesTab,
  StatusTab as KavitaStatusTab,
  SyncTab as KavitaSyncTab
} from '@/components/settings/integrations/kavita/components';
import { useKavitaForm, useKavitaMutations, useKavitaQueries } from '@/components/settings/integrations/kavita/hooks';
import type {
  TabValue,
  ConnectionStatus,
  KavitaFormValues,
  StatusData
} from '@/components/settings/integrations/kavita/types';

export function KavitaIntegrationContent(): ReactElement {
  const [activeTab, setActiveTab] = useState<TabValue>('connection');
  const queriesData = useKavitaQueries();
  const { settingsData, statusData } = queriesData;
  const formInstance = useKavitaForm({ settingsData });
  const { handlers, isTesting, mutations } = useKavitaMutations({
    refetchSettings: queriesData.refetch.settings,
    refetchStatus: queriesData.refetch.status
  });

  const getInputProps = (field: keyof KavitaFormValues, options?: { type?: 'checkbox' }): ReturnType<typeof formInstance.getInputProps> =>
    formInstance.getInputProps(field, options);
  const setFieldValue = (field: keyof KavitaFormValues, value: unknown): void => {
    formInstance.setFieldValue(field, value as string | number | boolean | string[]);
  };
  const isDirty = (field?: keyof KavitaFormValues): boolean =>
    field ? formInstance.isDirty(field) : formInstance.isDirty();
  const onSubmit = (handler: (values: KavitaFormValues, event?: React.FormEvent) => void) =>
    (event?: React.FormEvent): void => {
      formInstance.onSubmit(handler)(event as React.FormEvent<HTMLFormElement>);
    };
  const onChangeTab = (value: string | null): void => setActiveTab(value as TabValue);

  if (!settingsData && !statusData) {
    return <Center h={300}><Loader size="lg" /></Center>;
  }

  const connectionStatus: ConnectionStatus =
    statusData && typeof statusData === 'object' && 'connectionStatus' in statusData
      ? (statusData as { connectionStatus: ConnectionStatus }).connectionStatus
      : 'not_configured';

  const tabProps = {
    form: { values: formInstance.values, getInputProps, setFieldValue, isDirty, onSubmit },
    connectionStatus,
    queriesData,
    mutationHandlers: handlers,
    isTesting,
    mutations
  } as const;

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle />} color="blue">
        Kavita is a fast, feature-rich, cross-platform reading server. Configure the connection
        to sync your library between Mugiwara Kaizoku and Kavita.
      </Alert>
      <Tabs value={activeTab} onChange={onChangeTab}>
        <Tabs.List>
          <Tabs.Tab value="connection" leftSection={<IconServer size={14} />}>Connection</Tabs.Tab>
          <Tabs.Tab value="sync" leftSection={<IconSettings size={14} />}>Sync Settings</Tabs.Tab>
          <Tabs.Tab value="libraries" leftSection={<IconAdjustments size={14} />}>Libraries</Tabs.Tab>
          <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>Status</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="connection" pt="xl"><KavitaConnectionTab {...tabProps} /></Tabs.Panel>
        <Tabs.Panel value="sync" pt="xl"><KavitaSyncTab {...tabProps} /></Tabs.Panel>
        <Tabs.Panel value="libraries" pt="xl"><KavitaLibrariesTab {...tabProps} /></Tabs.Panel>
        <Tabs.Panel value="status" pt="xl">
          <KavitaStatusTab {...tabProps} statusData={statusData as StatusData | undefined} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
