/** Color-coded Source pill rendered in every Jobs table row's Source column. */
import React from 'react';

import { Badge } from '@mantine/core';

import { JobType } from '@/utils/job-validation';

import { getTaskTypeLabel } from './active-job-helpers';

interface SourceStyle { bg: string; text: string }

const FALLBACK_STYLE: SourceStyle = { bg: 'rgba(134, 142, 150, 0.14)', text: '#cbd2d9' };

const TASK_TYPE_STYLES: Partial<Record<JobType, SourceStyle>> = {
  [JobType.chapter_download]:   { bg: 'rgba(167, 139, 250, 0.16)', text: '#c4b5fd' },
  [JobType.mangadex_download]:  { bg: 'rgba(251, 146, 60, 0.16)',  text: '#fdba74' },
  [JobType.suwayomi_download]:  { bg: 'rgba(34, 211, 238, 0.16)',  text: '#67e8f9' },
  [JobType.getcomics_download]: { bg: 'rgba(96, 165, 250, 0.16)',  text: '#93c5fd' },
  [JobType.chapter_check]:      { bg: 'rgba(45, 212, 191, 0.16)',  text: '#5eead4' },
  [JobType.metadata_refresh]:   { bg: 'rgba(244, 114, 182, 0.16)', text: '#f9a8d4' },
  [JobType.library_scan]:       { bg: 'rgba(156, 163, 175, 0.16)', text: '#d1d5db' },
  [JobType.backup_create]:      { bg: 'rgba(163, 230, 53, 0.16)',  text: '#bef264' },
  [JobType.chapter_sync]:       { bg: 'rgba(129, 140, 248, 0.16)', text: '#a5b4fc' },
};

function styleFor(taskType: unknown): SourceStyle {
  if (typeof taskType !== 'string') return FALLBACK_STYLE;
  return TASK_TYPE_STYLES[taskType as JobType] ?? FALLBACK_STYLE;
}

interface SourceBadgeProps {
  taskType: unknown;
  size?: 'xs' | 'sm';
}

export function SourceBadge({ taskType, size = 'sm' }: SourceBadgeProps): React.ReactElement {
  const label = typeof taskType === 'string' ? getTaskTypeLabel(taskType as JobType) : 'Unknown';
  const { bg, text } = styleFor(taskType);
  return (
    <Badge
      size={size}
      variant="light"
      radius="sm"
      styles={{
        root: { backgroundColor: bg, color: text, fontWeight: 600, letterSpacing: 0.4 },
        label: { overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' },
      }}
    >
      {label}
    </Badge>
  );
}

const PROTOCOL_STYLES: Record<string, SourceStyle> = {
  torrent: { bg: 'rgba(56, 189, 248, 0.16)', text: '#7dd3fc' },
  usenet:  { bg: 'rgba(168, 85, 247, 0.16)', text: '#d8b4fe' },
  http:    { bg: 'rgba(250, 204, 21, 0.16)', text: '#fde047' },
  graphql: { bg: 'rgba(236, 72, 153, 0.16)', text: '#f0abfc' },
  api:     { bg: 'rgba(74, 222, 128, 0.16)', text: '#86efac' },
};

interface ProtocolBadgeProps {
  protocol: string;
  size?: 'xs' | 'sm';
}

export function ProtocolBadge({ protocol, size = 'sm' }: ProtocolBadgeProps): React.ReactElement {
  const key = protocol.toLowerCase();
  const { bg, text } = PROTOCOL_STYLES[key] ?? FALLBACK_STYLE;
  return (
    <Badge
      size={size}
      variant="light"
      radius="sm"
      styles={{
        root: { backgroundColor: bg, color: text, fontWeight: 600, letterSpacing: 0.4 },
        label: { overflow: 'visible', textOverflow: 'unset', maxWidth: 'none' },
      }}
    >
      {protocol}
    </Badge>
  );
}
