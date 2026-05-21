import type { ReactElement } from 'react';

import {
  Paper,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Alert,
  Text,
  Anchor,
  Divider
} from '@mantine/core';
import {
  IconInfoCircle,
  IconTestPipe,
  IconExternalLink
} from '@tabler/icons-react';

import { ConnectionStatusBadge } from '@/components/settings/integrations/ConnectionStatusBadge';
import { IntegrationHeader } from '@/components/settings/integrations/IntegrationHeader';

import type { UseFormReturnType } from '@mantine/form';

interface AppriseFormValues {
  enabled: boolean;
  serviceUrl: string;
  servicesText: string;
}

interface AppriseConnectionTabProps {
  form: UseFormReturnType<AppriseFormValues>;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'not-configured';
  currentServices: string[];
  isTesting: boolean;
  isUpdating: boolean;
  onSubmit: (values: AppriseFormValues) => void;
  onTestConnection: () => void;
}

/**
 * Connection settings tab for Apprise integration
 */
export function AppriseConnectionTab({
  form,
  connectionStatus,
  currentServices,
  isTesting,
  isUpdating,
  onSubmit,
  onTestConnection
}: AppriseConnectionTabProps): ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <IntegrationHeader
            title="Connection Settings"
            description="Configure your Apprise server connection"
            enabled={form.values.enabled}
            onEnabledChange={(enabled) => form.setFieldValue('enabled', enabled)}
          />

          <Divider />

          <Alert icon={<IconInfoCircle />} color="cyan" title="Setup Instructions">
            <Stack gap="xs">
              <Text size="sm">
                1. Deploy an Apprise server using Docker or install it locally
              </Text>
              <Text size="sm">
                2. Configure your notification service URLs (see{' '}
                <Anchor
                  href="https://github.com/caronc/apprise/wiki"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apprise documentation <IconExternalLink size={12} />
                </Anchor>
                )
              </Text>
              <Text size="sm">
                3. Enter each service URL on a separate line below
              </Text>
            </Stack>
          </Alert>

          <TextInput
            label="Apprise Server URL"
            placeholder="http://localhost:8000"
            description="The URL of your Apprise API server"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('serviceUrl')}
          />

          <Textarea
            label="Notification Service URLs"
            placeholder={'discord://webhook_id/webhook_token\nslack://TokenA/TokenB/TokenC\nmailto://user:pass@gmail.com'}
            description="Enter one service URL per line. Supports 90+ services."
            required
            disabled={!form.values.enabled}
            minRows={5}
            maxRows={15}
            autosize
            {...form.getInputProps('servicesText')}
          />

          {currentServices.length > 0 && (
            <Alert icon={<IconInfoCircle />} color="gray">
              <Text size="sm" fw={500} mb={4}>
                Configured Services: {currentServices.length}
              </Text>
              <Text size="xs" c="dimmed">
                {currentServices.map((url): string => {
                  const protocol = url.split('://')[0] ?? 'unknown';
                  return protocol;
                }).join(', ')}
              </Text>
            </Alert>
          )}

          <Group justify="space-between" mt="lg">
            <ConnectionStatusBadge status={connectionStatus} />
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconTestPipe />}
                onClick={onTestConnection}
                disabled={!form.values.enabled || !form.values.serviceUrl || currentServices.length === 0}
                loading={isTesting}
              >
                Send Test Notification
              </Button>
              <Button
                type="submit"
                loading={isUpdating}
                disabled={!form.isDirty()}
              >
                Save Settings
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
