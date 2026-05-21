/**
 * Job Detail Page — `/jobs/<id>`
 *
 * Drill-down view from the jobs table. Shows the job's metadata + the
 * chapters/volumes it was supposed to fulfill (derived from
 * `payload.chapterIds`), with a manual-import affordance per volume so
 * the user can bind a local file when the auto-dispatch fails.
 */
import React, { useState } from 'react';
import type { ReactElement } from 'react';

import {
  Container, Stack, Title, Group, Card, Text, Badge, Code, Loader, Center,
  Alert, Button, Anchor, Divider,
} from '@mantine/core';
import { IconAlertCircle, IconBook, IconChevronLeft, IconClock, IconUpload } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { ImportFromPathModal } from '@/components/jobs/detail/ImportFromPathModal';
import { getStatusBadge, getStatusBadgeBgColor, getStatusBadgeTextColor } from '@/components/jobs/history/helpers';
import { MainLayout } from '@/components/layouts/MainLayout';
import { trpc } from '@/utils/trpc-client';
import type { RouterOutputs } from '@/utils/trpc-client/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractErrorMessage(lastError: unknown): string | null {
  if (typeof lastError === 'string') return lastError;
  if (isRecord(lastError)) {
    const msg = lastError['message'];
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return null;
}

type ImportTarget = { volumeId: number | null; volumeLabel: string };
type JobDetailData = RouterOutputs['jobs']['getJobDetail'];
type AffectedVolume = NonNullable<JobDetailData>['affectedVolumes'][number];

function JobDetailHeader({ detail }: { detail: NonNullable<JobDetailData> }): React.ReactElement {
  const badge = getStatusBadge(detail.status);
  const errorMsg = extractErrorMessage(detail.last_error);
  return (
    <Card padding="lg" radius="md" withBorder style={{ backgroundColor: 'var(--mantine-color-dark-6)' }}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Title order={3} c="white">Job #{detail.id}</Title>
            <Badge color={badge.color} variant="light" styles={{
              root: { backgroundColor: getStatusBadgeBgColor(badge.color), color: getStatusBadgeTextColor(badge.color) },
            }}>
              {badge.icon} {badge.label}
            </Badge>
          </Group>
          {detail.manga && (
            <Anchor component={Link} href={`/manga/${detail.manga.id}`} size="sm" c="blue.4">
              <Group gap={4}><IconBook size={14} /> {detail.manga.title}</Group>
            </Anchor>
          )}
        </Group>

        <Group gap="lg">
          <Text size="sm" c="dimmed">Type <Code>{detail.job_type}</Code></Text>
          {detail.started_at && (
            <Text size="sm" c="dimmed">
              <IconClock size={12} style={{ verticalAlign: 'middle' }} />{' '}
              Started {formatDistanceToNow(new Date(detail.started_at as string | number | Date), { addSuffix: true })}
            </Text>
          )}
          {detail.completed_at && (
            <Text size="sm" c="dimmed">
              Completed {formatDistanceToNow(new Date(detail.completed_at as string | number | Date), { addSuffix: true })}
            </Text>
          )}
        </Group>

        {errorMsg && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            <Text size="sm" fw={500}>Failure reason</Text>
            <Code block>{errorMsg}</Code>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

function VolumeRow({
  volume, onImport,
}: { volume: AffectedVolume; onImport: (t: ImportTarget) => void }): React.ReactElement {
  const label = volume.volumeId === null
    ? 'Unassigned chapters'
    : `Volume ${volume.volumeNumber ?? '?'}${volume.volumeTitle ? ` — ${volume.volumeTitle}` : ''}`;

  const range = volume.chapterStart !== null && volume.chapterEnd !== null
    ? ` (ch ${volume.chapterStart}–${volume.chapterEnd})`
    : '';

  const statusEntries = Object.entries(volume.statusCounts);
  return (
    <Card padding="md" radius="md" withBorder style={{ backgroundColor: 'var(--mantine-color-dark-6)' }}>
      <Group justify="space-between">
        <Stack gap={4}>
          <Text fw={600} c="white">{label}{range}</Text>
          <Group gap="sm">
            <Text size="sm" c="dimmed">{volume.chapterCount} chapter(s)</Text>
            {statusEntries.map(([status, count]) => (
              <Badge key={status} size="sm" color={status === 'COMPLETED' ? 'green' : status === 'ERROR' ? 'red' : 'gray'} variant="light">
                {status.toLowerCase()}: {count}
              </Badge>
            ))}
          </Group>
        </Stack>
        <Button
          size="xs"
          leftSection={<IconUpload size={14} />}
          variant="light"
          color="blue"
          onClick={() => onImport({ volumeId: volume.volumeId, volumeLabel: label })}
        >
          Import from file
        </Button>
      </Group>
    </Card>
  );
}

function JobDetailContent({ detail, refetch }: {
  detail: NonNullable<JobDetailData>;
  refetch: () => Promise<unknown>;
}): React.ReactElement {
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);

  const mangaId = detail.manga?.id ?? null;
  const noChapters = detail.affectedVolumes.length === 0;

  return (
    <Stack gap="lg">
      <JobDetailHeader detail={detail} />

      <Stack gap="sm">
        <Title order={4} c="white">Affected volumes</Title>
        {noChapters && (
          <Alert color="gray" variant="light" icon={<IconAlertCircle size={16} />}>
            This job has no chapter payload to display. Either it ran before
            payload.chapterIds was tracked, or it isn&apos;t a chapter-download job.
          </Alert>
        )}
        {detail.affectedVolumes.map((vol) => (
          <VolumeRow
            key={vol.volumeId ?? `unassigned-${vol.chapterCount}`}
            volume={vol}
            onImport={setImportTarget}
          />
        ))}
      </Stack>

      {importTarget !== null && mangaId !== null && (
        <ImportFromPathModal
          opened
          onClose={() => setImportTarget(null)}
          mangaId={mangaId}
          jobId={detail.id}
          volumeId={importTarget.volumeId}
          volumeLabel={importTarget.volumeLabel}
          onImported={() => { void refetch(); }}
        />
      )}
    </Stack>
  );
}

function JobDetailPageInner(): React.ReactElement {
  const router = useRouter();
  const rawId = router.query['id'];
  const jobId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;

  const { data, isPending, error, refetch } = trpc.jobs.getJobDetail.useQuery(
    { jobId: jobId ?? '' },
    { enabled: typeof jobId === 'string' && jobId.length > 0, refetchOnWindowFocus: false },
  );

  if (typeof jobId !== 'string' || jobId.length === 0) {
    return <Alert color="orange">Missing job id in URL.</Alert>;
  }

  if (isPending) {
    return (
      <Center h="calc(100vh - 200px)">
        <Stack align="center"><Loader size="lg" /><Text c="dimmed">Loading job…</Text></Stack>
      </Center>
    );
  }

  if (error) {
    return <Alert color="red" icon={<IconAlertCircle />}>{error.message}</Alert>;
  }

  if (!data) {
    return <Alert color="orange" icon={<IconAlertCircle />}>Job #{jobId} not found.</Alert>;
  }

  return <JobDetailContent detail={data} refetch={refetch} />;
}

export default function JobDetailPage(): ReactElement {
  return (
    <MainLayout>
      <Container size="xl" style={{ paddingTop: 80, paddingBottom: 20 }}>
        <Stack gap="md">
          <Anchor component={Link} href="/jobs/history" size="sm" c="blue.4">
            <Group gap={4}><IconChevronLeft size={14} /> Back to jobs</Group>
          </Anchor>
          <Divider />
          <JobDetailPageInner />
        </Stack>
      </Container>
    </MainLayout>
  );
}
