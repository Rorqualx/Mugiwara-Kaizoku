/**
 * Session Management card — active session list + clear/restart controls.
 *
 * @module components/flaresolverr/settings/SessionManagementCard
 */

import React from 'react';

import {
  Card,
  Title,
  Group,
  Stack,
  Badge,
  Text,
  Button,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconTrash, IconRefresh } from '@tabler/icons-react';

interface SessionData {
  count: number;
  sessions: string[];
}

interface SessionManagementCardProps {
  sessionData: SessionData | undefined;
  canRestart: boolean;
  clearPending: boolean;
  restartPending: boolean;
  onClear: () => void;
  onRestart: () => void;
}

export function SessionManagementCard({
  sessionData,
  canRestart,
  clearPending,
  restartPending,
  onClear,
  onRestart,
}: SessionManagementCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Session Management</Title>
        <Badge size="lg" variant="light">
          {sessionData?.count ?? 0} active sessions
        </Badge>
      </Group>

      <Stack gap="md">
        <Alert icon={<IconAlertCircle />} color="gray" variant="light">
          <Text size="sm">
            <strong>What are sessions?</strong> FlareSolverr uses browser sessions to
            maintain state when bypassing Cloudflare challenges. Each session represents
            a headless Chrome instance that has already solved a challenge, allowing
            faster subsequent requests. Sessions consume memory and are automatically
            cleaned up after the TTL expires.
          </Text>
        </Alert>

        {sessionData && sessionData.sessions.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">Active Sessions:</Text>
            <Group gap="xs">
              {sessionData.sessions.map((session) => (
                <Badge key={session} variant="outline">{session}</Badge>
              ))}
            </Group>
          </div>
        )}

        <Group gap="md">
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={onClear}
            loading={clearPending}
            disabled={!sessionData || sessionData.count === 0}
          >
            Clear All Sessions
          </Button>
          <Button
            variant="light"
            color="orange"
            leftSection={<IconRefresh size={16} />}
            onClick={onRestart}
            loading={restartPending}
            disabled={!canRestart}
          >
            Restart FlareSolverr
          </Button>
        </Group>

        <Text size="xs" c="dimmed">
          <strong>Clearing sessions</strong> will terminate all browser instances - use
          this if you experience memory issues or stale sessions. <strong>Restart
          FlareSolverr</strong> fully restarts the service, useful for troubleshooting
          or after configuration changes.
        </Text>
      </Stack>
    </Card>
  );
}
