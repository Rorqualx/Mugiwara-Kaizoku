/**
 * ML Settings Panel Component
 *
 * Displays and manages ML feature flags and configuration settings.
 * Allows toggling feature flags and viewing ML configuration.
 */

import React from 'react';

import { Grid, Paper, Text, Switch, Stack, Group, Badge } from '@mantine/core';

import type { MLFeatureFlags, MLConfig } from '@/types/ml/ml-api-types';
import { isBoolean } from '@/utils/type-guards';

interface MLSettingsPanelProps {
  featureFlags: MLFeatureFlags | null;
  mlConfig: MLConfig | null;
  mlAvailable: boolean;
  onFeatureFlagUpdate: (feature: keyof MLFeatureFlags, enabled: boolean) => void;
}

/**
 * Type guard for checking if a value is a valid record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Renders ML settings panel with feature flags and configuration
 */
export const MLSettingsPanel = ({
  featureFlags,
  mlConfig,
  mlAvailable,
  onFeatureFlagUpdate
}: MLSettingsPanelProps): React.ReactElement => {
  return (
    <Grid>
      <Grid.Col span={12}>
        <Paper shadow="sm" p="lg">
          <Text size="lg" fw={500} mb="md">
            Feature Flags
          </Text>

          <Stack gap="md">
            {featureFlags &&
              Object.entries(featureFlags).map(([key, value]) => {
                const isBooleanValue = isBoolean(value);
                return (
                  <Switch
                    key={key}
                    label={key.replace(/([A-Z])/g, ' $1').trim()}
                    checked={isBooleanValue ? value : false}
                    onChange={(e) => {
                      onFeatureFlagUpdate(key as keyof MLFeatureFlags, e.currentTarget.checked);
                    }}
                  />
                );
              })}
          </Stack>
        </Paper>
      </Grid.Col>

      <Grid.Col span={12}>
        <Paper shadow="sm" p="lg">
          <Text size="lg" fw={500} mb="md">
            ML Configuration
          </Text>

          {mlConfig && isRecord(mlConfig) ? (
            <Stack gap="xs">
              <Group>
                <Text fw={500}>Backend:</Text>
                <Badge>{String(mlConfig['backend'])}</Badge>
              </Group>
              <Group>
                <Text fw={500}>Min Confidence:</Text>
                <Text>{String(mlConfig['minConfidence'])}</Text>
              </Group>
              <Group>
                <Text fw={500}>Max Inference Time:</Text>
                <Text>{String(mlConfig['maxInferenceTime'])}ms</Text>
              </Group>
              <Group>
                <Text fw={500}>ML Available:</Text>
                <Badge color={mlAvailable ? 'green' : 'red'}>
                  {mlAvailable ? 'Yes' : 'No'}
                </Badge>
              </Group>
            </Stack>
          ) : null}
        </Paper>
      </Grid.Col>
    </Grid>
  );
};
