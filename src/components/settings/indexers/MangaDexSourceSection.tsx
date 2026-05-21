/**
 * MangaDex Download Source Section
 *
 * Displays MangaDex as a direct download source in the indexers settings page.
 * MangaDex provides free manga downloads without requiring external indexers.
 *
 * @module components/settings/indexers/MangaDexSourceSection
 */

import React, { useCallback, useState } from 'react';

import {
  Paper,
  Title,
  Text,
  Group,
  Divider,
  Stack,
  Badge,
  Alert,
  Anchor,
  Button
} from '@mantine/core';
import { IconBook, IconInfoCircle, IconCheck, IconAlertCircle, IconPlugConnected } from '@tabler/icons-react';

import { MangaDexDownloadSettings } from '@/components/settings/MangaDexDownloadSettings';
import { trpc } from '@/utils/trpc-client';

interface TestStatus {
  success: boolean | null;
  message: string;
}

const INITIAL_TEST_STATUS: TestStatus = { success: null, message: '' };

function buildSuccessStatus(reachable: boolean): TestStatus {
  return reachable
    ? { success: true, message: 'MangaDex API is reachable.' }
    : { success: false, message: 'MangaDex API responded but reported an unhealthy state.' };
}

function buildErrorStatus(err: unknown): TestStatus {
  return {
    success: false,
    message: err instanceof Error ? err.message : 'Connection failed',
  };
}

export function MangaDexSourceSection(): React.ReactElement {
  const [testStatus, setTestStatus] = useState<TestStatus>(INITIAL_TEST_STATUS);
  const [testing, setTesting] = useState(false);
  const utils = trpc.useUtils();

  const handleTest = useCallback(async (): Promise<void> => {
    setTesting(true);
    setTestStatus(INITIAL_TEST_STATUS);
    try {
      const result = await utils.nativeDownload.healthCheck.fetch();
      setTestStatus(buildSuccessStatus(result.status === 'ok'));
    } catch (err: unknown) {
      setTestStatus(buildErrorStatus(err));
    } finally {
      setTesting(false);
    }
  }, [utils]);

  return (
    <Paper p="md" withBorder mt="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" mb={4}>
              <IconBook size={20} />
              <Title order={4}>MangaDex</Title>
              <Badge color="green" variant="light" size="sm">
                No API Key Required
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              MangaDex is a free, community-driven manga reader that provides direct chapter
              downloads. Chapters are downloaded as images and bundled into CBZ files.
            </Text>
          </div>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlugConnected size={14} />}
            onClick={() => { void handleTest(); }}
            loading={testing}
          >
            Test Connection
          </Button>
        </Group>

        {testStatus.success === true && (
          <Alert
            icon={<IconCheck size="1rem" />}
            color="green"
            variant="light"
            title="Connection Successful"
          >
            {testStatus.message}
          </Alert>
        )}

        {testStatus.success === false && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            color="red"
            variant="light"
            title="Connection Failed"
          >
            {testStatus.message}
          </Alert>
        )}

        <Divider />

        <Alert icon={<IconInfoCircle size="1rem" />} color="blue" variant="light">
          <Text size="sm">
            MangaDex downloads chapters directly without requiring a torrent client or Usenet setup.
            Downloads are automatic when you have manga from MangaDex in your library.
          </Text>
          <Anchor href="https://mangadex.org" target="_blank" rel="noopener noreferrer" size="sm" mt="xs">
            Visit MangaDex
          </Anchor>
        </Alert>

        <MangaDexDownloadSettings />

        <Group gap="xs" mt="md">
          <Text size="sm" fw={500}>Capabilities:</Text>
          <Badge variant="light" color="cyan">Direct Downloads</Badge>
          <Badge variant="light" color="grape">CBZ Bundling</Badge>
          <Badge variant="light" color="orange">Multi-Language</Badge>
          <Badge variant="light" color="pink">Scanlation Groups</Badge>
        </Group>
      </Stack>
    </Paper>
  );
}
