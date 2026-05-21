/**
 * Indexers Table Component
 *
 * Renders the Prowlarr indexers table with status, protocol, and priority information.
 *
 * @module components/settings/indexers/IndexersTable
 */

import React from 'react';

import { Text, Paper, Button, Group, Alert, Table, Badge, Loader, Box } from '@mantine/core';
import { IconRefresh, IconAlertCircle, IconSettings } from '@tabler/icons-react';

import type { IndexersTableProps, UIIndexer } from '@/components/settings/indexers/types';
import { isIndexerEnabled, getErrorHelpText } from '@/components/settings/indexers/utils/utils';


/**
 * Indexers Table Component
 *
 * @param props - Component props
 * @returns React element
 */
export function IndexersTable(props: IndexersTableProps): React.ReactElement {
  const {
    indexers,
    isLoading,
    error,
    prowlarrSettings,
    onRefresh
  } = props;

  return (
    <Paper shadow="xs" p="xl" withBorder mt="xl">
      <Group justify="space-between" mb="md">
        <Text fw={700} size="xl" c="blue">
          Prowlarr Indexers
        </Text>
        <Button
          onClick={() => {
            void onRefresh();
          }}
          leftSection={<IconRefresh size={16} />}
          size="md"
          disabled={!prowlarrSettings.enabled || !prowlarrSettings.baseURL || !prowlarrSettings.apiKey}
        >
          Refresh
        </Button>
      </Group>

      {/* Show loading state */}
      {isLoading && (
        <Group mb="md">
          <Loader size="sm" />
          <Text>Loading indexers from Prowlarr...</Text>
        </Group>
      )}

      {/* Show status based on configuration state */}
      {!prowlarrSettings.enabled ? (
        <Alert icon={<IconAlertCircle size={16} />} title="Prowlarr Disabled" color="yellow" mb="md">
          Prowlarr integration is currently disabled. Enable it using the toggle above to view and manage your indexers.
        </Alert>
      ) : !prowlarrSettings.baseURL || !prowlarrSettings.apiKey ? (
        <Alert icon={<IconAlertCircle size={16} />} title="Configuration Incomplete" color="orange" mb="md">
          Please configure your Prowlarr URL and API key above, then click "Save Configuration" to view your indexers.
        </Alert>
      ) : (
        <Alert icon={<IconSettings size={16} />} title="Indexer Monitor" color="blue" mb="md">
          Monitor your Prowlarr indexers status. View which indexers are enabled and their current configuration.
        </Alert>
      )}

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Indexer Issue"
          color="red"
          mb="md"
          withCloseButton
          onClose={() => {
            // Clear error - this will be handled by the parent component
          }}
        >
          <Text mb={8}>{error}</Text>
          {getErrorHelpText(error) && (
            <Text size="sm" opacity={0.8}>
              {getErrorHelpText(error)}
              Consider opening Prowlarr directly to configure this indexer in more detail.
            </Text>
          )}
        </Alert>
      )}

      {/* Only show "No Indexers" when fully configured and no indexers found */}
      {!isLoading && !error && indexers.length === 0 && prowlarrSettings.enabled && prowlarrSettings.baseURL && prowlarrSettings.apiKey && (
        <Alert icon={<IconAlertCircle size={16} />} title="No Indexers" color="blue">
          No indexers found in your Prowlarr instance. You can add indexers in Prowlarr's web interface.
        </Alert>
      )}

      {/* Only show indexers table when we have data and Prowlarr is configured */}
      {!isLoading && !error && indexers.length > 0 && prowlarrSettings.enabled && (
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Protocol</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Priority</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {indexers.map((indexer: UIIndexer) => {
                const isEnabled = isIndexerEnabled(indexer);
                return (
                  <Table.Tr key={indexer.id}>
                    <Table.Td>
                      <Text fw={500}>{indexer.name}</Text>
                    </Table.Td>
                    <Table.Td>{indexer.protocol}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={isEnabled ? 'green' : 'gray'}
                        size="lg"
                        variant={isEnabled ? 'filled' : 'light'}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{indexer.priority}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
