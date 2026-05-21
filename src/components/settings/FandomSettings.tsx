/**
 * Fandom Settings Component
 *
 * Information display for the Fandom wiki scraping provider.
 * Fandom doesn't require API keys - this page shows provider capabilities.
 */

import React, { useState } from 'react';

import { Box, Stack, Text, Alert, Button, Badge, Group } from '@mantine/core';
import { IconInfoCircle, IconWorld, } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
const FANDOM_PROBE_URL =
  'https://onepiece.fandom.com/api.php?action=query&meta=siteinfo&format=json&origin=*';
const FANDOM_PROBE_TIMEOUT_MS = 8000;

type ProbeResult =
  | { kind: 'ok' }
  | { kind: 'http'; status: number }
  | { kind: 'shape' }
  | { kind: 'error'; message: string };

async function probeFandom(): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FANDOM_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(FANDOM_PROBE_URL, { signal: controller.signal });
    if (!response.ok) return { kind: 'http', status: response.status };
    const data: unknown = await response.json();
    if (!isQueryShape(data)) return { kind: 'shape' };
    return { kind: 'ok' };
  } catch (err: unknown) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    const message = aborted
      ? `Probe timed out after ${FANDOM_PROBE_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    return { kind: 'error', message };
  } finally {
    clearTimeout(timer);
  }
}

function isQueryShape(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'query' in data &&
    typeof (data as { query: unknown }).query === 'object'
  );
}

function notifyProbeResult(result: ProbeResult): void {
  if (result.kind === 'ok') {
    notify({ severity: 'SUCCESS', title: 'Fandom reachable', message: 'Successfully queried the Fandom MediaWiki API.' });
    return;
  }
  if (result.kind === 'http') {
    notify({ severity: 'ERROR', title: 'Fandom unreachable', message: `Probe returned HTTP ${result.status}. Fandom may be temporarily unavailable.` });
    return;
  }
  if (result.kind === 'shape') {
    notify({ severity: 'WARNING', title: 'Unexpected response', message: 'Fandom MediaWiki API responded but the payload was not recognized.' });
    return;
  }
  notify({ severity: 'ERROR', title: 'Fandom unreachable', message: result.message });
}

export const FandomSettings: React.FC = () => {
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    try {
      notifyProbeResult(await probeFandom());
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box>
      <Box fz="lg" fw={500} mb="md">Fandom</Box>
      <Stack gap="md">
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="About Fandom Integration"
          color="blue"
        >
          <Text size="sm">
            Fandom is a wiki hosting service with extensive manga and anime information.
            This provider uses a hybrid approach combining the MediaWiki API for structured data
            and web scraping for additional content. No API key is required as Fandom's
            MediaWiki API is publicly accessible.
          </Text>
        </Alert>

        <Alert icon={<IconInfoCircle size={16} />} color="yellow">
          <Text size="sm">
            <strong>Note:</strong> Fandom uses both MediaWiki API calls and web scraping.
            API calls retrieve structured data efficiently, while scraping fills in gaps
            for content not available through the API. Results depend on the quality
            and completeness of the wiki content.
          </Text>
        </Alert>

        <Stack gap="xs">
          <Text size="sm" fw={500}>Features</Text>
          <Group gap="xs">
            <Badge variant="light" color="green">No API Key Required</Badge>
            <Badge variant="light" color="blue">MediaWiki API</Badge>
            <Badge variant="light" color="orange">Web Scraping</Badge>
            <Badge variant="light" color="cyan">Hybrid Approach</Badge>
            <Badge variant="light" color="grape">Community Maintained</Badge>
          </Group>
        </Stack>

        <Button
          variant="outline"
          onClick={() => { void handleTestConnection(); }}
          leftSection={<IconWorld size={16} />}
          loading={testing}
          disabled={testing}
          mt="md"
        >
          Test Connection
        </Button>
      </Stack>
    </Box>
  );
};

export default FandomSettings;