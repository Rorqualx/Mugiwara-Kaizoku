/**
 * ML Models Status Component
 *
 * Displays status cards for available ML models showing version,
 * backend, and availability information.
 */

import React from 'react';

import { Grid, Card, Group, Text, Badge, Stack } from '@mantine/core';

import type { MLModelsResponse } from '@/types/ml/ml-api-types';

interface MLModelsStatusProps {
  modelStatus: MLModelsResponse;
}

/**
 * Type guard for checking if a value is a valid record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Renders model status cards showing availability and configuration
 */
export const MLModelsStatus = ({ modelStatus }: MLModelsStatusProps): React.ReactElement => {
  return (
    <Grid>
      {Object.entries(modelStatus).map(([type, status]) => (
        <Grid.Col span={6} key={type}>
          <Card shadow="sm" p="lg">
            <Group justify="space-between" mb="xs">
              <Text fw={500}>{type.replace(/_/g, ' ').toUpperCase()}</Text>
              <Badge color={status.available ? 'green' : 'red'}>
                {status.available ? 'Available' : 'Not Available'}
              </Badge>
            </Group>

            {isRecord(status.config) && (
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    Version: {String(status.config['version'] ?? 'Unknown')}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Backend: {String(status.config['backend'] ?? 'Unknown')}
                  </Text>
                  {status.path && (
                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                      Path: {status.path}
                    </Text>
                  )}
                </Stack>
              )}
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
};
