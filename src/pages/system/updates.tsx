import React from 'react';
import type { ReactElement } from 'react';

import {
  Alert,
  Badge,
  Box,
  Card,
  Code,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import {
  IconBrandDocker,
  IconBug,
  IconCalendar,
  IconCode,
  IconHammer,
  IconInfoCircle,
  IconRocket,
  IconShield,
  IconStar,
  IconTerminal2,
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import type { ChangelogSection, VersionEntry } from '@/server/trpc/routers/system/utils';
import { trpc } from '@/utils/trpc-client';

interface SectionStyle {
  color: string;
  Icon: typeof IconHammer;
}

function styleForSection(heading: string): SectionStyle {
  const h = heading.toLowerCase();
  if (h.startsWith('security')) return { color: 'blue', Icon: IconShield };
  if (h.includes('bug') || h.startsWith('fixed')) return { color: 'red', Icon: IconBug };
  if (h.includes('known') || h.startsWith('deprecated')) return { color: 'yellow', Icon: IconInfoCircle };
  if (h.includes('refactor') || h.includes('technical debt') || h.startsWith('documentation') || h.startsWith('docs')) {
    return { color: 'grape', Icon: IconCode };
  }
  if (h.includes('improvement') || h.startsWith('changed') || h.includes('quality')) {
    return { color: 'teal', Icon: IconStar };
  }
  return { color: 'orange', Icon: IconHammer };
}

function SectionBlock({ section }: { section: ChangelogSection }): React.ReactElement {
  const { color, Icon } = styleForSection(section.heading);
  return (
    <Box>
      <Group mb="xs">
        <ThemeIcon size="sm" color={color} variant="light">
          <Icon size={16} />
        </ThemeIcon>
        <Text fw={500}>{section.heading}</Text>
      </Group>
      <List size="sm">
        {section.items.map((item, idx) => (
          <List.Item key={`${section.heading}-${idx}`}>{item}</List.Item>
        ))}
      </List>
    </Box>
  );
}

function HistorySectionBlock({ section }: { section: ChangelogSection }): React.ReactElement {
  return (
    <Box>
      <Text size="sm" fw={500} c="dimmed">{section.heading}</Text>
      <List size="sm">
        {section.items.map((item, idx) => (
          <List.Item key={`${section.heading}-${idx}`}>{item}</List.Item>
        ))}
      </List>
    </Box>
  );
}

function VersionInfoCard({
  version,
  nodeVersion,
  startTime,
}: {
  version: string;
  nodeVersion: string;
  startTime: string;
}): React.ReactElement {
  return (
    <Paper withBorder p="md" mb="xl">
      <Group justify="space-between" mb="md">
        <Box>
          <Text fw={500} size="lg">Mugiwara-Kaizoku</Text>
          <Text size="sm" c="dimmed">Current version and update instructions</Text>
        </Box>
        <Badge color="blue" variant="filled" size="lg">v{version}</Badge>
      </Group>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={500}>Application Version</Text>
          <Text size="sm">{version}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" fw={500}>Node.js Runtime</Text>
          <Text size="sm">{nodeVersion}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" fw={500}>Server Started</Text>
          <Text size="sm">{startTime}</Text>
        </Group>
      </Stack>
    </Paper>
  );
}

function LatestUpdatePanel({
  installed,
  isLoading,
}: {
  installed: VersionEntry | undefined;
  isLoading: boolean;
}): React.ReactElement {
  if (isLoading) return <Loader size="sm" mt="md" />;
  if (!installed) {
    return (
      <Alert color="yellow" icon={<IconInfoCircle size={16} />} mt="md">
        No changelog entries found. Check that CHANGELOG.md exists in the project root.
      </Alert>
    );
  }
  return (
    <Paper withBorder p="lg" mt="md">
      <Group justify="space-between" mb="md">
        <Group>
          <ThemeIcon size="xl" radius="md" color="orange">
            <IconRocket size={24} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="lg">v{installed.version}</Text>
            {installed.date && <Text size="sm" c="dimmed">{installed.date}</Text>}
          </Box>
        </Group>
        <Badge color="orange" variant="light">Current</Badge>
      </Group>
      <Stack gap="md">
        {installed.sections.map((section) => (
          <SectionBlock key={section.heading} section={section} />
        ))}
      </Stack>
    </Paper>
  );
}

function HistoryTimelineItem({ entry }: { entry: VersionEntry }): React.ReactElement {
  return (
    <Timeline.Item
      bullet={<IconCode size={20} />}
      title={`v${entry.version}${entry.date ? ` - ${entry.date}` : ''}`}
    >
      <Paper withBorder p="md" mt="xs">
        <Stack gap="sm">
          {entry.sections.map((section) => (
            <HistorySectionBlock key={section.heading} section={section} />
          ))}
        </Stack>
      </Paper>
    </Timeline.Item>
  );
}

function HistoryPanel({
  history,
  isLoading,
}: {
  history: VersionEntry[];
  isLoading: boolean;
}): React.ReactElement {
  if (isLoading) return <Loader size="sm" mt="md" />;
  if (history.length === 0) {
    return (
      <Alert color="gray" icon={<IconInfoCircle size={16} />} mt="md">
        No prior versions to show.
      </Alert>
    );
  }
  return (
    <Timeline active={-1} mt="md">
      {history.map((entry) => (
        <HistoryTimelineItem key={entry.version} entry={entry} />
      ))}
    </Timeline>
  );
}

function UpdateInstructionsCard(): React.ReactElement {
  return (
    <Card withBorder p="md" mt="xl">
      <Title order={4} mb="md">Update Instructions</Title>
      <Stack gap="md">
        <Box>
          <Group mb="xs">
            <IconBrandDocker size={20} />
            <Text fw={500}>For Docker Users</Text>
          </Group>
          <Code block>docker-compose pull &amp;&amp; docker-compose up -d</Code>
          <Text size="xs" c="dimmed" mt="xs">
            Note: It&apos;s recommended to create a backup before updating.
          </Text>
        </Box>
        <Box>
          <Group mb="xs">
            <IconTerminal2 size={20} />
            <Text fw={500}>For Local Installation</Text>
          </Group>
          <Code block>{`git pull\nbun install\nbun run build:clean\nbun run start`}</Code>
          <Text size="xs" c="dimmed" mt="xs">
            Note: Using Bun provides 15x faster package installation.
          </Text>
        </Box>
      </Stack>
    </Card>
  );
}

function FooterAlert(): React.ReactElement {
  return (
    <Alert icon={<IconInfoCircle size={16} />} mt="xl">
      <Stack gap="xs">
        <Text size="sm">
          <strong>Roadmap to 1.0.0:</strong> Release criteria are tracked in CHANGELOG.md (see &ldquo;Criteria for 1.0.0 Release&rdquo;)
        </Text>
        <Text size="sm">
          <strong>Changelog:</strong> Full version history available in CHANGELOG.md
        </Text>
        <Text size="sm">
          <strong>Open Source:</strong> Contribute on{' '}
          <Text component="a" href="https://github.com/Rorqualx/Mugiwara-Kaizoku" target="_blank" c="blue" inherit>
            GitHub
          </Text>
        </Text>
      </Stack>
    </Alert>
  );
}

export default function SystemUpdates(): React.ReactElement {
  const { data: status } = trpc.system.getStatus.useQuery();
  const { data: updates, isLoading } = trpc.system.getUpdateInfo.useQuery();

  const version = status?.application.version ?? updates?.currentVersion ?? 'Unknown';
  const nodeVersion = status?.application.nodeVersion ?? 'Unknown';
  const startTime = status?.application.startTime
    ? new Date(status.application.startTime).toLocaleString()
    : 'Unknown';

  const changelog = updates?.changelog ?? [];
  const installed = changelog.find((v) => v.status === 'installed') ?? changelog[0];
  const history = changelog.filter((v) => v !== installed);

  return (
    <SystemLayout title="Updates">
      <VersionInfoCard version={version} nodeVersion={nodeVersion} startTime={startTime} />

      <Tabs defaultValue="latest" mb="xl">
        <Tabs.List>
          <Tabs.Tab value="latest" leftSection={<IconStar size={16} />}>
            Latest Updates
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconCalendar size={16} />}>
            Version History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="latest" pt="xs">
          <LatestUpdatePanel installed={installed} isLoading={isLoading} />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="xs">
          <HistoryPanel history={history} isLoading={isLoading} />
        </Tabs.Panel>
      </Tabs>

      <UpdateInstructionsCard />
      <FooterAlert />
    </SystemLayout>
  );
}

SystemUpdates.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
