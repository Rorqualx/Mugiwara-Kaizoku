/**
 * Server-lifecycle controls for the Suwayomi JVM. Used by the Download
 * Clients page (Suwayomi is the chapter-page download backend). Status
 * badges, Java detection, Start/Stop buttons, and error banners.
 *
 * The start mutation blocks until {@link waitForServerReady} polls the
 * health endpoint (up to 30 retries × 1s). To make that wait visible we
 * track elapsed seconds in local state and surface a "Starting…" inline
 * status with progress text — bare LoadingOverlay used to leave the user
 * staring at a spinner with no signal that anything was happening.
 *
 * Realtime feedback: the SuwayomiService + supervisor emit `system:events`
 * channel messages for every state transition (server:started, stopped,
 * start:failed, supervisor:restart-scheduled, restart-attempted,
 * crash-looping). We subscribe so the badge flips the moment the state
 * changes instead of waiting up to 5s for the next getServerStatus poll,
 * and surface supervisor banners + toasts so the user sees what the
 * managed lifecycle is doing.
 *
 * Per-manga enable lives on each manga's detail page. The full extension
 * catalog UX lives on the Indexers page.
 */
import React, { useCallback, useEffect, useState } from 'react';

import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

/** Health-check polling worst case (HEALTH_CHECK_CONFIG.maxRetries × retryDelay). */
const COLD_START_BUDGET_SECONDS = 30;

/** Track how long a pending mutation has been running, in whole seconds. */
function useElapsedSeconds(isPending: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isPending) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
    return (): void => { clearInterval(interval); };
  }, [isPending]);
  return elapsed;
}

interface InflightStatusProps {
  action: 'starting' | 'stopping';
  elapsed: number;
}

function InflightStatus({ action, elapsed }: InflightStatusProps): React.ReactElement {
  const verb = action === 'starting' ? 'Starting Suwayomi server' : 'Stopping Suwayomi server';
  const hint = action === 'starting'
    ? `JVM cold start typically takes 5–${COLD_START_BUDGET_SECONDS}s. Hold tight.`
    : 'Closing the JVM and releasing the port.';
  return (
    <Alert color="blue" icon={<Loader size="xs" />}>
      <Group gap="sm">
        <Text size="sm" fw={500}>{verb}…</Text>
        <Badge color="blue" variant="light" size="sm">{elapsed}s elapsed</Badge>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>{hint}</Text>
    </Alert>
  );
}

interface StatusBadgesProps {
  isRunning: boolean;
  port: number | undefined;
  javaAvailable: boolean | undefined;
  javaVersion: string | null | undefined;
}

function StatusBadges({ isRunning, port, javaAvailable, javaVersion }: StatusBadgesProps): React.ReactElement {
  const serverLabel = isRunning ? `Server up on :${port ?? 4567}` : 'Server stopped';
  const javaLabel = javaAvailable ? `Java ${javaVersion ?? ''}` : 'Java not detected';
  return (
    <Group gap="xs">
      <Badge color={isRunning ? 'teal' : 'gray'} variant="dot" size="lg">{serverLabel}</Badge>
      <Badge color={javaAvailable ? 'teal' : 'red'} variant="dot" size="lg">{javaLabel}</Badge>
    </Group>
  );
}

interface JavaAlertProps {
  available: boolean | undefined;
}

function JavaUnavailableAlert({ available }: JavaAlertProps): React.ReactElement | null {
  if (available !== false) return null;
  return (
    <Alert color="red" icon={<IconInfoCircle size="1rem" />} title="Java 21 required">
      Suwayomi-Server is a JVM application. Install OpenJDK 21 (e.g. <code>brew install openjdk@21</code>) and reload.
    </Alert>
  );
}

interface MutationErrorAlertProps {
  message: string | undefined;
}

function MutationErrorAlert({ message }: MutationErrorAlertProps): React.ReactElement | null {
  if (message === undefined) return null;
  return (
    <Alert color="red" icon={<IconInfoCircle size="1rem" />}>
      {message}
    </Alert>
  );
}

interface SupervisorBannerProps {
  banner: { color: 'blue' | 'orange' | 'red'; title: string; message: string } | null;
  onDismiss: () => void;
}

function SupervisorBanner({ banner, onDismiss }: SupervisorBannerProps): React.ReactElement | null {
  if (banner === null) return null;
  return (
    <Alert
      color={banner.color}
      icon={<IconInfoCircle size="1rem" />}
      title={banner.title}
      withCloseButton
      onClose={onDismiss}
    >
      {banner.message}
    </Alert>
  );
}

/**
 * Subscribe to `system:events` and project Suwayomi-relevant messages
 * into:
 *  - immediate `getServerStatus` invalidation (badge + button state
 *    flip without waiting for the 5s poll)
 *  - top-of-panel supervisor banner (restart-scheduled / restart-attempted
 *    / crash-looping — the supervisor narrates what it's doing)
 *  - severity-mapped toast for every transition (so the user sees what
 *    happened even when they're on another page)
 */
function useSuwayomiRealtimeFeedback(
  invalidateStatus: () => void,
): {
  banner: { color: 'blue' | 'orange' | 'red'; title: string; message: string } | null;
  dismissBanner: () => void;
} {
  const { isConnected, subscribe } = useRealTime();
  const [banner, setBanner] = useState<{ color: 'blue' | 'orange' | 'red'; title: string; message: string } | null>(null);

  const dismissBanner = useCallback((): void => setBanner(null), []);

  useEffect(() => {
    if (!isConnected) return;
    const handler = (event: WebSocketEvent): void => {
      const type = event.type;
      if (typeof type !== 'string' || !type.startsWith('system:suwayomi:')) return;
      const message = typeof event.data === 'object' && event.data !== null && 'message' in event.data
        ? String((event.data as { message?: unknown }).message ?? '')
        : '';
      switch (type) {
        case 'system:suwayomi:server:started':
          invalidateStatus();
          setBanner(null);
          notify({ severity: 'SUCCESS', title: 'Suwayomi server started', message: 'JVM is up and answering on its GraphQL endpoint.', persist: false });
          break;
        case 'system:suwayomi:server:stopped':
          invalidateStatus();
          setBanner(null);
          notify({ severity: 'INFO', title: 'Suwayomi server stopped', message: 'JVM has shut down cleanly.', persist: false });
          break;
        case 'system:suwayomi:server:start:failed':
          invalidateStatus();
          notify({ severity: 'ERROR', title: 'Suwayomi failed to start', message: message || 'The JVM could not be started.', persist: false });
          break;
        case 'system:suwayomi:supervisor:restart-scheduled':
          setBanner({ color: 'orange', title: 'Suwayomi restart scheduled', message: message || 'The supervisor will retry shortly.' });
          break;
        case 'system:suwayomi:supervisor:restart-attempted':
          setBanner({ color: 'blue', title: 'Restarting Suwayomi…', message: message || 'Supervisor is bringing the JVM back up.' });
          break;
        case 'system:suwayomi:supervisor:crash-looping':
          setBanner({ color: 'red', title: 'Suwayomi crash-looping', message: message || 'Auto-restart disabled — use the Start button to retry.' });
          notify({ severity: 'ERROR', title: 'Suwayomi crash-looping', message: message || 'Auto-restart disabled.', persist: false });
          break;
        case 'system:suwayomi:supervisor:failure-counter-reset':
          setBanner(null);
          break;
        default:
          break;
      }
    };
    return subscribe('system:events', handler);
  }, [isConnected, subscribe, invalidateStatus]);

  return { banner, dismissBanner };
}

export function SuwayomiServerControls(): React.ReactElement {
  const utils = trpc.useUtils();
  const javaQuery = trpc.suwayomiV2.checkJava.useQuery(undefined, { staleTime: 30_000 });
  const statusQuery = trpc.suwayomiV2.getServerStatus.useQuery(undefined, {
    refetchInterval: 5_000,
  });
  const startMutation = trpc.suwayomiV2.startServer.useMutation({
    onSuccess: () => { void utils.suwayomiV2.getServerStatus.invalidate(); },
  });
  const stopMutation = trpc.suwayomiV2.stopServer.useMutation({
    onSuccess: () => { void utils.suwayomiV2.getServerStatus.invalidate(); },
  });

  const invalidateStatus = useCallback((): void => {
    void utils.suwayomiV2.getServerStatus.invalidate();
  }, [utils]);
  const { banner, dismissBanner } = useSuwayomiRealtimeFeedback(invalidateStatus);

  const javaStatus = javaQuery.data as { available?: boolean; version?: string | null } | undefined;
  const status = statusQuery.data as { isRunning?: boolean; port?: number } | undefined;
  const isRunning = status?.isRunning === true;
  const startElapsed = useElapsedSeconds(startMutation.isPending);
  const stopElapsed = useElapsedSeconds(stopMutation.isPending);
  const busy = startMutation.isPending || stopMutation.isPending;

  return (
    <Box>
      <Stack gap="md">
        <StatusBadges
          isRunning={isRunning}
          port={status?.port}
          javaAvailable={javaStatus?.available}
          javaVersion={javaStatus?.version}
        />

        <Text size="sm" c="dimmed">
          Suwayomi runs as a background JVM and provides chapter-page downloads
          from Mihon source extensions when MangaDex misses a chapter. When
          enabled, it&apos;s started on app boot and supervised — if the JVM
          crashes, it&apos;s restarted automatically (5-attempt backoff, capped
          at 5min). Per-manga enable lives on each manga&apos;s detail page;
          install / browse source extensions in{' '}
          <Anchor href="/settings/indexers" size="sm">Settings → Indexers</Anchor>.
        </Text>

        <JavaUnavailableAlert available={javaStatus?.available} />

        <SupervisorBanner banner={banner} onDismiss={dismissBanner} />

        {startMutation.isPending && <InflightStatus action="starting" elapsed={startElapsed} />}
        {stopMutation.isPending && <InflightStatus action="stopping" elapsed={stopElapsed} />}

        <Group>
          <Button
            disabled={busy || isRunning || javaStatus?.available !== true}
            onClick={(): void => { startMutation.mutate(); }}
            loading={startMutation.isPending}
          >
            Start server
          </Button>
          <Button
            disabled={busy || !isRunning}
            color="red"
            variant="light"
            onClick={(): void => { stopMutation.mutate(); }}
            loading={stopMutation.isPending}
          >
            Stop server
          </Button>
        </Group>

        <MutationErrorAlert message={startMutation.error?.message ?? stopMutation.error?.message} />
      </Stack>
    </Box>
  );
}
