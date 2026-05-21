/**
 * Connection Settings card — URL/timeout/sessionTTL/disableMedia/wait
 * inputs plus the Test Connection button and explainer alert.
 *
 * @module components/flaresolverr/settings/ConnectionSettingsCard
 */

import React from 'react';

import {
  Card,
  Title,
  Stack,
  Switch,
  Group,
  Text,
  Button,
  Badge,
  TextInput,
  NumberInput,
  SimpleGrid,
  Alert,
} from '@mantine/core';
import { IconShieldCheck, IconPlugConnected } from '@tabler/icons-react';

import { isLocalUrl } from './helpers';

import type { FlareSolverrSettingsValues } from './helpers';
import type { UseFormReturnType } from '@mantine/form';

interface ConnectionSettingsCardProps {
  form: UseFormReturnType<FlareSolverrSettingsValues>;
  testPending: boolean;
  onTestConnection: () => void;
}

export function ConnectionSettingsCard({
  form,
  testPending,
  onTestConnection,
}: ConnectionSettingsCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Connection Settings</Title>
      <Stack gap="md">
        <Switch
          label="Enable FlareSolverr"
          description="Use FlareSolverr to bypass Cloudflare protection when scraping"
          {...form.getInputProps('enabled', { type: 'checkbox' })}
        />

        <Group gap="sm" align="center">
          <Text size="sm" fw={500}>Quick Preset:</Text>
          <Button
            variant="outline"
            size="xs"
            onClick={() => form.setFieldValue('url', 'http://localhost:8191/v1')}
          >
            Local (localhost:8191)
          </Button>
          {form.values.url && !isLocalUrl(form.values.url) && (
            <Badge color="blue" variant="light" size="sm">Remote Instance</Badge>
          )}
        </Group>

        <TextInput
          label="Instance URL"
          description="The URL of your FlareSolverr instance (e.g., http://localhost:8191/v1)"
          placeholder="http://localhost:8191/v1"
          leftSection={<IconShieldCheck size={16} />}
          {...form.getInputProps('url')}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Request Timeout (ms)"
            description="Maximum time to wait for FlareSolverr responses"
            min={1000}
            max={300000}
            step={1000}
            {...form.getInputProps('timeout')}
          />
          <NumberInput
            label="Session TTL (ms)"
            description="How long to keep browser sessions alive"
            min={60000}
            max={86400000}
            step={60000}
            {...form.getInputProps('sessionTTL')}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Switch
            label="Disable Media Loading"
            description="Block images, CSS, and fonts for faster scraping"
            {...form.getInputProps('disableMedia', { type: 'checkbox' })}
          />
          <NumberInput
            label="Wait After Challenge (seconds)"
            description="Delay for dynamic content to load after bypass"
            min={0}
            max={60}
            step={1}
            {...form.getInputProps('defaultWaitSecs')}
          />
        </SimpleGrid>

        <Group justify="flex-start" gap="sm">
          <Button
            variant="light"
            leftSection={<IconPlugConnected size={16} />}
            onClick={onTestConnection}
            loading={testPending}
            disabled={!form.values.url}
          >
            Test Connection
          </Button>
        </Group>

        <Alert icon={<IconShieldCheck />} color="blue" variant="light">
          <Text size="sm">
            FlareSolverr bypasses Cloudflare protection when scraping websites
            like ComicVine. It runs as a Go binary subprocess managed by the app,
            providing automatic start/stop/restart capability. Disable Media
            and Wait settings help optimize scraping performance.
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}
