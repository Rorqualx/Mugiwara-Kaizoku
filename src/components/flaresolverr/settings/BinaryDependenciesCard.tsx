/**
 * Binary & Dependencies card — renders side-by-side panels for the
 * flaresolverr-go binary and Chrome/Chromium dependency.
 *
 * @module components/flaresolverr/settings/BinaryDependenciesCard
 */

import React from 'react';

import {
  Card,
  Title,
  Group,
  Stack,
  SimpleGrid,
  Badge,
  Text,
  Loader,
} from '@mantine/core';
import { IconFile, IconWorldWww } from '@tabler/icons-react';

interface BinaryInfo {
  installed: boolean;
  version?: string | null;
  platform?: string;
  arch?: string;
}

interface ChromeInfo {
  installed: boolean;
  browser?: string | null;
  version?: string | null;
  works?: boolean;
}

interface BinaryDependenciesCardProps {
  binaryInfo: BinaryInfo | undefined;
  binaryLoading: boolean;
  chromeInfo: ChromeInfo | undefined;
  chromeLoading: boolean;
}

function BinaryPanel({
  binaryInfo,
  binaryLoading,
}: Pick<BinaryDependenciesCardProps, 'binaryInfo' | 'binaryLoading'>): React.ReactElement {
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconFile size={16} />
          <Text fw={500} size="sm">FlareSolverr-Go</Text>
        </Group>
        <Badge size="sm" color={binaryInfo?.installed ? 'green' : 'red'}>
          {binaryInfo?.installed ? 'Installed' : 'Not Installed'}
        </Badge>
      </Group>
      {binaryLoading ? (
        <Group justify="center" p="xs"><Loader size="xs" /></Group>
      ) : (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Version:</Text>
            <Text size="xs">{binaryInfo?.version ?? 'N/A'}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Platform:</Text>
            <Text size="xs">{binaryInfo?.platform ?? 'N/A'} / {binaryInfo?.arch ?? 'N/A'}</Text>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>Auto-updates on deployment</Text>
        </Stack>
      )}
    </Card>
  );
}

function ChromePanel({
  chromeInfo,
  chromeLoading,
}: Pick<BinaryDependenciesCardProps, 'chromeInfo' | 'chromeLoading'>): React.ReactElement {
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconWorldWww size={16} />
          <Text fw={500} size="sm">Chrome/Chromium</Text>
        </Group>
        <Badge size="sm" color={chromeInfo?.installed ? 'green' : 'red'}>
          {chromeInfo?.installed ? 'Found' : 'Not Found'}
        </Badge>
      </Group>
      {chromeLoading ? (
        <Group justify="center" p="xs"><Loader size="xs" /></Group>
      ) : (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Browser:</Text>
            <Text size="xs">{chromeInfo?.browser ?? 'N/A'}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Version:</Text>
            <Text size="xs">{chromeInfo?.version ?? 'N/A'}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Works:</Text>
            <Badge color={chromeInfo?.works ? 'green' : 'red'} size="xs">
              {chromeInfo?.works ? 'Yes' : 'No'}
            </Badge>
          </Group>
          {!chromeInfo?.installed && (
            <Text size="xs" c="orange" mt={4}>Chrome required for FlareSolverr</Text>
          )}
        </Stack>
      )}
    </Card>
  );
}

export function BinaryDependenciesCard({
  binaryInfo,
  binaryLoading,
  chromeInfo,
  chromeLoading,
}: BinaryDependenciesCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Binary & Dependencies</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <BinaryPanel binaryInfo={binaryInfo} binaryLoading={binaryLoading} />
        <ChromePanel chromeInfo={chromeInfo} chromeLoading={chromeLoading} />
      </SimpleGrid>
    </Card>
  );
}
