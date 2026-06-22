/**
 * Files section for the Job Info modal. Fetches the per-file list (filenames
 * with extensions + sizes) live from the download client via
 * jobs.getDownloadFiles, since the job payload only carries the release title.
 */
import React from 'react';

import { Stack, Group, Text, Badge, ScrollArea, Loader } from '@mantine/core';

import { trpc } from '@/utils/trpc-client/index';

import { muted } from './theme-text-styles';
import { formatBytes } from './utils';

const SECTION_TITLE_STYLE: React.CSSProperties = { color: 'var(--theme-text, #ffffff)' };
const FILE_ROW_STYLE: React.CSSProperties = { flexWrap: 'nowrap' };
const FILE_NAME_STYLE: React.CSSProperties = {
  color: 'var(--theme-text, #e0e0e0)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

/** Filename within a download, minus any directory prefix the client reports. */
function baseFileName(name: string): string {
  const parts = name.split(/[\\/]/);
  return parts[parts.length - 1] || name;
}

/** Uppercase extension (no dot) for the badge, or null when there's no extension. */
function fileExtension(name: string): string | null {
  const base = baseFileName(name);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toUpperCase();
}

interface DownloadFileRow {
  name: string;
  size: number;
  progress: number;
}

function FileRow({ file }: { file: DownloadFileRow }): React.ReactElement {
  const ext = fileExtension(file.name);
  return (
    <Group gap="xs" justify="space-between" style={FILE_ROW_STYLE}>
      <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
        {ext && <Badge size="xs" variant="outline" color="blue">{ext}</Badge>}
        <Text size="xs" style={FILE_NAME_STYLE} title={file.name}>{baseFileName(file.name)}</Text>
      </Group>
      <Text size="xs" style={muted({ whiteSpace: 'nowrap' })}>{formatBytes(file.size)}</Text>
    </Group>
  );
}

function FilesNotice({ message }: { message: string }): React.ReactElement {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} style={SECTION_TITLE_STYLE}>Files</Text>
      <Text size="xs" style={muted()}>{message}</Text>
    </Stack>
  );
}

interface JobDownloadFilesSectionProps {
  jobId: string;
  /** Modal open state — gates the query so closed modals don't fetch. */
  opened: boolean;
  /** Client download id; absent for native (non-client) jobs. */
  downloadId: string | undefined;
}

export function JobDownloadFilesSection({
  jobId, opened, downloadId,
}: JobDownloadFilesSectionProps): React.ReactElement | null {
  const enabled = opened && Boolean(downloadId);
  const query = trpc.jobs.getDownloadFiles.useQuery(
    { jobId },
    { enabled, staleTime: 15_000, refetchOnWindowFocus: false },
  );

  if (!enabled) return null;

  if (query.isPending) {
    return (
      <Stack gap="xs">
        <Text size="sm" fw={600} style={SECTION_TITLE_STYLE}>Files</Text>
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="xs" style={muted()}>Loading file list from download client…</Text>
        </Group>
      </Stack>
    );
  }

  const data = query.data;
  // Only the torrent/usenet clients expose a per-file list. Native jobs
  // (no client downloadId) return reason 'no_download' — render nothing.
  if (!data || data.reason === 'no_download' || data.reason === 'not_found') return null;

  if (data.reason === 'client_error') {
    return <FilesNotice message="Could not reach the download client to list files." />;
  }

  if (data.files.length === 0) {
    return <FilesNotice message="No files reported yet — the client is still resolving the torrent metadata." />;
  }

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text size="sm" fw={600} style={SECTION_TITLE_STYLE}>Files</Text>
        <Badge size="sm" variant="light" color="gray">{data.files.length}</Badge>
      </Group>
      <ScrollArea.Autosize mah={260}>
        <Stack gap={4}>
          {data.files.map((f, i) => <FileRow key={`${f.name}-${i}`} file={f} />)}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
