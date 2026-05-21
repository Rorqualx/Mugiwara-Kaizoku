/**
 * Job Info Modal — opens when clicking the File Name cell on the /jobs page.
 * Shows the original-source link plus all available torrent/download metadata
 * (magnet URI, .torrent URL, info-hash, indexer, save path, raw payload) for
 * the current job. No tRPC calls — everything is read from the row data that
 * useJobsPage already loaded.
 */
import React from 'react';

import {
  Modal, Stack, Group, Text, Badge, Code, Anchor, CopyButton, Button,
  Accordion, SimpleGrid, ActionIcon, Tooltip, Divider, ScrollArea, Card,
} from '@mantine/core';
import { IconCheck, IconCopy, IconExternalLink } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import { SourceBadge, ProtocolBadge } from './source-badge';
import { muted } from './theme-text-styles';
import { buildOriginalSourceUrl, extractInfoHashFromMagnet, formatBytes } from './utils';

import type { JobRowData } from './active-job-helpers';

interface JobInfoModalProps {
  opened: boolean;
  onClose: () => void;
  data: JobRowData | null;
}

const COPY_ROW_STYLE: React.CSSProperties = { flexWrap: 'nowrap' };
const COPY_VALUE_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const RAW_CODE_STYLE: React.CSSProperties = { fontSize: 11, whiteSpace: 'pre' };
const LABEL_STYLE = muted({ minWidth: 130 });
const SECTION_TITLE_STYLE: React.CSSProperties = { color: 'var(--theme-text, #ffffff)' };
const TORRENT_CARD_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(56, 189, 248, 0.06)',
  border: '1px solid rgba(56, 189, 248, 0.25)',
};
const TORRENT_CODE_STYLE: React.CSSProperties = {
  fontSize: 12,
  wordBreak: 'break-all',
  whiteSpace: 'normal',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const v = record[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const v = record[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function readStringArray(record: Record<string, unknown> | null, key: string): string[] | null {
  if (!record) return null;
  const v = record[key];
  if (!Array.isArray(v)) return null;
  const items = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return items.length > 0 ? items : null;
}

interface CopyRowProps {
  label: string;
  value: string;
  href?: string;
  truncate?: boolean;
}

function CopyRow({ label, value, href, truncate = false }: CopyRowProps): React.ReactElement {
  const display = truncate && value.length > 64 ? `${value.slice(0, 64)}…` : value;
  return (
    <Group gap="xs" align="center" style={COPY_ROW_STYLE}>
      <Text size="xs" fw={600} style={LABEL_STYLE}>{label}</Text>
      <Code style={COPY_VALUE_STYLE} title={value}>
        {href ? (
          <Anchor href={href} target="_blank" rel="noopener noreferrer" size="xs">
            {display}
          </Anchor>
        ) : display}
      </Code>
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Copied' : 'Copy'}>
            <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} size="sm" onClick={copy}>
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

interface InfoFieldProps {
  label: string;
  value: React.ReactNode;
}

function InfoField({ label, value }: InfoFieldProps): React.ReactElement {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600} style={muted()}>{label}</Text>
      <Text size="sm" style={{ color: 'var(--theme-text, #e0e0e0)' }}>{value}</Text>
    </Stack>
  );
}

// ============================================================================
// Sections
// ============================================================================

function HeaderStrip({ data }: { data: JobRowData }): React.ReactElement {
  const status = typeof data.taskStatus === 'string' ? data.taskStatus : 'unknown';
  const showError = status.toLowerCase() === 'failed' && data.errorMessage;
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <Text size="lg" fw={700} style={SECTION_TITLE_STYLE}>Job #{String(data.taskId)}</Text>
          <SourceBadge taskType={data.taskType} />
          <Badge size="sm" variant="light" color="gray">{status}</Badge>
        </Group>
        {data.mangaId !== undefined && data.mangaId > 0 && (
          <Anchor component={Link} href={`/manga/${data.mangaId}`} size="sm" c="blue.4">
            {data.taskName}
          </Anchor>
        )}
      </Group>
      <Group gap="lg">
        {data.createdAt && (
          <Text size="xs" style={muted()}>
            Created {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
          </Text>
        )}
        {data.completedAt && (
          <Text size="xs" style={muted()}>
            Completed {formatDistanceToNow(new Date(data.completedAt), { addSuffix: true })}
          </Text>
        )}
        {data.protocol !== '-' && <ProtocolBadge protocol={data.protocol} />}
        {data.client !== '-' && (
          <Text size="xs" style={muted()}>Client: <Code>{data.client}</Code></Text>
        )}
      </Group>
      {showError && (
        <Code block style={{ color: '#f87171' }}>{data.errorMessage}</Code>
      )}
    </Stack>
  );
}

function formatPublishDate(raw: string): string {
  try { return new Date(raw).toLocaleString(); } catch { return raw; }
}

function fieldFromString(record: Record<string, unknown> | null, key: string, label: string): InfoFieldProps | null {
  const v = readString(record, key);
  return v ? { label, value: v } : null;
}

function buildProwlarrFields(prowlarrResult: Record<string, unknown> | null): InfoFieldProps[] {
  const fields: (InfoFieldProps | null)[] = [
    fieldFromString(prowlarrResult, 'indexerName', 'Indexer'),
    fieldFromString(prowlarrResult, 'quality', 'Quality'),
    fieldFromString(prowlarrResult, 'format', 'Format'),
    fieldFromString(prowlarrResult, 'publisher', 'Publisher'),
  ];

  const size = readNumber(prowlarrResult, 'size');
  if (size !== null && size > 0) fields.push({ label: 'Size', value: formatBytes(size) });

  const seeders = readNumber(prowlarrResult, 'seeders');
  const leechers = readNumber(prowlarrResult, 'leechers');
  if (seeders !== null || leechers !== null) {
    fields.push({ label: 'Seeders / Leechers', value: `${seeders ?? '—'} / ${leechers ?? '—'}` });
  }

  const score = readNumber(prowlarrResult, 'score');
  if (score !== null) fields.push({ label: 'Score', value: score.toFixed(0) });

  const publishDate = readString(prowlarrResult, 'publishDate');
  if (publishDate) fields.push({ label: 'Publish date', value: formatPublishDate(publishDate) });

  const languages = readStringArray(prowlarrResult, 'languages');
  if (languages) fields.push({ label: 'Languages', value: languages.join(', ') });

  const tags = readStringArray(prowlarrResult, 'tags');
  if (tags) fields.push({ label: 'Tags', value: tags.join(', ') });

  return fields.filter((f): f is InfoFieldProps => f !== null);
}

function buildNativeFields(
  payload: Record<string, unknown> | null,
  chapter: Record<string, unknown> | null,
): InfoFieldProps[] {
  const fields: InfoFieldProps[] = [];
  const chapterNumber = readNumber(chapter, 'chapterNumber') ?? readNumber(payload, 'chapterNumber');
  if (chapterNumber !== null) fields.push({ label: 'Chapter', value: String(chapterNumber) });

  const chapterTitle = readString(chapter, 'title') ?? readString(payload, 'title');
  if (chapterTitle) fields.push({ label: 'Chapter title', value: chapterTitle });

  const language = fieldFromString(payload, 'language', 'Language');
  if (language) fields.push(language);
  const groupName = fieldFromString(payload, 'groupName', 'Group');
  if (groupName) fields.push(groupName);
  return fields;
}

function buildReleaseFields(
  prowlarrResult: Record<string, unknown> | null,
  payload: Record<string, unknown> | null,
  chapter: Record<string, unknown> | null,
): InfoFieldProps[] {
  return [...buildProwlarrFields(prowlarrResult), ...buildNativeFields(payload, chapter)];
}

function ReleaseInfoSection({
  prowlarrResult, payload, chapter,
}: {
  prowlarrResult: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  chapter: Record<string, unknown> | null;
}): React.ReactElement | null {
  const fields = buildReleaseFields(prowlarrResult, payload, chapter);
  if (fields.length === 0) return null;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} style={SECTION_TITLE_STYLE}>Release info</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} verticalSpacing="sm">
        {fields.map(f => <InfoField key={f.label} label={f.label} value={f.value} />)}
      </SimpleGrid>
    </Stack>
  );
}

interface TorrentUrlCardProps {
  downloadUrl: string;
}

function TorrentUrlCard({ downloadUrl }: TorrentUrlCardProps): React.ReactElement {
  return (
    <Card padding="sm" radius="md" withBorder style={TORRENT_CARD_STYLE}>
      <Stack gap={6}>
        <Group justify="space-between" gap="xs">
          <Text size="sm" fw={700} style={SECTION_TITLE_STYLE}>Torrent URL</Text>
          <Group gap={4}>
            <CopyButton value={downloadUrl} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy URL'}>
                  <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} size="sm" onClick={copy}>
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
            <Tooltip label="Open in new tab">
              <ActionIcon component="a" href={downloadUrl} target="_blank" rel="noopener noreferrer"
                variant="subtle" color="gray" size="sm">
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Code style={TORRENT_CODE_STYLE}>{downloadUrl}</Code>
        <Text size="xs" style={muted()}>
          Paste into Transmission via File → Open URL. Contains your Prowlarr apikey — keep private.
        </Text>
      </Stack>
    </Card>
  );
}

interface MagnetNoticeProps {
  protocol: string;
  hasDownloadUrl: boolean;
}

function MagnetNotice({ protocol, hasDownloadUrl }: MagnetNoticeProps): React.ReactElement | null {
  if (protocol.toLowerCase() !== 'torrent' || !hasDownloadUrl) return null;
  return (
    <Group gap="xs" align="center" style={COPY_ROW_STYLE}>
      <Text size="xs" fw={600} style={LABEL_STYLE}>Magnet</Text>
      <Text size="xs" style={muted({ flex: 1 })}>
        Not in payload — indexer only exposed the .torrent URL. The torrent client
        derives the magnet/hash after fetching the file.
      </Text>
    </Group>
  );
}

interface BuildLinkRowsArgs {
  data: JobRowData;
  payload: Record<string, unknown> | null;
  prowlarrResult: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  magnetUrl: string | null;
  hasTorrentUrl: boolean;
}

function buildLinkRows(args: BuildLinkRowsArgs): React.ReactNode[] {
  const { data, payload, prowlarrResult, result, magnetUrl, hasTorrentUrl } = args;
  const originalSource = buildOriginalSourceUrl(data.taskType, payload);
  const magnetInfoHash = extractInfoHashFromMagnet(magnetUrl);
  const downloadId = readString(result, 'downloadId');
  const clientType = readString(result, 'clientType');
  const savePath = readString(result, 'savePath');
  const guid = readString(prowlarrResult, 'guid');
  const releaseTitle = readString(result, 'releaseTitle') ?? readString(prowlarrResult, 'title');

  const rows: React.ReactNode[] = [];
  if (releaseTitle) rows.push(<CopyRow key="title" label="Release title" value={releaseTitle} />);
  if (originalSource) {
    rows.push(<CopyRow key="src" label="Original source" value={originalSource} href={originalSource} truncate />);
  }
  if (magnetUrl) {
    rows.push(<CopyRow key="magnet" label="Magnet" value={magnetUrl} href={magnetUrl} truncate />);
  } else {
    rows.push(<MagnetNotice key="magnet-na" protocol={data.protocol} hasDownloadUrl={hasTorrentUrl} />);
  }
  if (magnetInfoHash) rows.push(<CopyRow key="hash" label="Info hash" value={magnetInfoHash} />);
  if (downloadId) rows.push(<CopyRow key="dlid" label="Client download id" value={downloadId} />);
  if (clientType) rows.push(<CopyRow key="client" label="Client" value={clientType} />);
  if (savePath) rows.push(<CopyRow key="save" label="Save path" value={savePath} truncate />);
  if (guid) rows.push(<CopyRow key="guid" label="GUID" value={guid} truncate />);
  return rows;
}

function LinksSection(args: BuildLinkRowsArgs): React.ReactElement | null {
  const rows = buildLinkRows(args);
  if (rows.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} style={SECTION_TITLE_STYLE}>Links & identifiers</Text>
      <Stack gap={6}>{rows}</Stack>
    </Stack>
  );
}

function RawPayloadSection({
  payload, result,
}: {
  payload: unknown;
  result: unknown;
}): React.ReactElement {
  const raw = JSON.stringify({ payload, result }, null, 2);
  return (
    <Accordion variant="contained">
      <Accordion.Item value="raw">
        <Accordion.Control>
          <Text size="sm" fw={600}>Raw payload</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Group justify="flex-end" mb="xs">
            <CopyButton value={raw} timeout={1500}>
              {({ copied, copy }) => (
                <Button size="xs" variant="subtle" onClick={copy}
                  leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}>
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <ScrollArea h={300}>
            <Code block style={RAW_CODE_STYLE}>{raw}</Code>
          </ScrollArea>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

// ============================================================================
// Main
// ============================================================================

function ModalTitle({ data, originalSource }: {
  data: JobRowData | null;
  originalSource: string | null;
}): React.ReactElement {
  return (
    <Group gap="xs">
      <Text fw={700}>Job details</Text>
      {data && originalSource && (
        <Anchor href={originalSource} target="_blank" rel="noopener noreferrer" size="sm" c="blue.4">
          <Group gap={4}>
            <IconExternalLink size={14} /> Open source
          </Group>
        </Anchor>
      )}
    </Group>
  );
}

export function JobInfoModal({ opened, onClose, data }: JobInfoModalProps): React.ReactElement {
  const raw = data?.__raw ?? null;
  const payload = raw && isRecord(raw['payload']) ? raw['payload'] : null;
  const result = raw && isRecord(raw['result']) ? raw['result'] : null;
  const prowlarrResult = payload && isRecord(payload['prowlarrResult']) ? payload['prowlarrResult'] : null;
  const chapter = raw && isRecord(raw['chapter']) ? raw['chapter'] : null;
  const originalSource = data ? buildOriginalSourceUrl(data.taskType, payload) : null;
  const rawMagnet = readString(prowlarrResult, 'magnetUrl');
  const rawDownloadUrl = readString(prowlarrResult, 'downloadUrl');
  const magnetIsReal = rawMagnet?.toLowerCase().startsWith('magnet:') ?? false;
  // Some Prowlarr indexers stuff the .torrent URL into magnetUrl. If it's
  // not a real `magnet:?xt=...` URI, route it to the Torrent URL card.
  const torrentUrl = rawDownloadUrl ?? (rawMagnet && !magnetIsReal ? rawMagnet : null);
  const magnetUrlForRow = magnetIsReal ? rawMagnet : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={<ModalTitle data={data} originalSource={originalSource} />}
      styles={{ title: { fontWeight: 700 } }}
    >
      {!data ? (
        <Text size="sm" style={muted()}>No job selected.</Text>
      ) : (
        <Stack gap="md">
          <HeaderStrip data={data} />
          <Divider />
          <Text size="sm" style={{ color: 'var(--theme-text, #e0e0e0)' }} title={data.fileName}>
            <Text component="span" fw={600} mr="xs" style={muted()}>File name:</Text>
            {data.fileName}
          </Text>
          {torrentUrl && <TorrentUrlCard downloadUrl={torrentUrl} />}
          <ReleaseInfoSection
            prowlarrResult={prowlarrResult}
            payload={payload}
            chapter={chapter}
          />
          <LinksSection
            data={data}
            payload={payload}
            prowlarrResult={prowlarrResult}
            result={result}
            magnetUrl={magnetUrlForRow}
            hasTorrentUrl={Boolean(torrentUrl)}
          />
          <RawPayloadSection payload={payload} result={result} />
        </Stack>
      )}
    </Modal>
  );
}
