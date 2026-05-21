/**
 * PagesTable Row Components
 */

import React, { useState } from 'react';

import {
  Text,
  Badge,
  Table,
  ActionIcon,
  Tooltip,
  UnstyledButton,
  Box,
  Anchor,
  Checkbox,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import type { PageGroup, PageListItem } from './types';

// ============================================================================
// Shared styles & helpers
// ============================================================================

/** Flex row that prevents wrapping in narrow table cells */
const COMPACT_ROW: React.CSSProperties = { display: 'flex', gap: 4, flexWrap: 'nowrap' };

function getShortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.length > 50) {
      return `${parsed.hostname}${path.slice(0, 47)}...`;
    }
    return `${parsed.hostname}${path}`;
  } catch {
    return url.length > 60 ? `${url.slice(0, 57)}...` : url;
  }
}

// ============================================================================
// StatusBadge
// ============================================================================

export function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    BOOTSTRAP: 'gray',
    IN_PROGRESS: 'blue',
    REVIEWED: 'yellow',
    GOLD: 'green',
    REJECTED: 'red',
  };

  const shortNames: Record<string, string> = {
    BOOTSTRAP: 'Bootstrap',
    IN_PROGRESS: 'Progress',
    REVIEWED: 'Reviewed',
    GOLD: 'Gold',
    REJECTED: 'Rejected',
  };

  return (
    <Badge color={colors[status] ?? 'gray'} variant="light" size="sm">
      {shortNames[status] ?? status}
    </Badge>
  );
}

// ============================================================================
// Small extracted components to reduce PageRow/GroupRow complexity
// ============================================================================

function ComicVineCell({ comicVineId }: { comicVineId?: string | null | undefined }): React.ReactElement {
  if (!comicVineId) {
    return <Text size="xs" c="dimmed">-</Text>;
  }
  return (
    <Anchor href={`https://comicvine.gamespot.com/volume/${comicVineId}/`} target="_blank" size="xs">
      <Badge size="xs" color="red" variant="light" rightSection={<IconExternalLink size={10} />}>
        {comicVineId}
      </Badge>
    </Anchor>
  );
}

function DiscoveredBadges({ page }: { page: PageListItem }): React.ReactElement {
  const fandomCount = page.fandomDiscoveredUrls?.length ?? 0;
  const wikiCount = page.wikipediaDiscoveredUrls?.length ?? 0;
  const cvCount = page.comicVineDiscoveredUrls?.length ?? 0;

  if (fandomCount === 0 && wikiCount === 0 && cvCount === 0) {
    return <Text size="xs" c="dimmed">-</Text>;
  }

  return (
    <div style={COMPACT_ROW}>
      {fandomCount > 0 && <Badge size="xs" color="orange" variant="light">F:{fandomCount}</Badge>}
      {wikiCount > 0 && <Badge size="xs" color="blue" variant="light">W:{wikiCount}</Badge>}
      {cvCount > 0 && <Badge size="xs" color="red" variant="light">C:{cvCount}</Badge>}
    </div>
  );
}

function GroupDiscoveredBadges({ group }: { group: PageGroup }): React.ReactElement {
  if (group.fandomDiscoveredCount === 0 && group.wikipediaDiscoveredCount === 0 && group.comicVineDiscoveredCount === 0) {
    return <Text size="xs" c="dimmed">-</Text>;
  }

  return (
    <div style={COMPACT_ROW}>
      {group.fandomDiscoveredCount > 0 && <Badge size="xs" color="orange" variant="light">F:{group.fandomDiscoveredCount}</Badge>}
      {group.wikipediaDiscoveredCount > 0 && <Badge size="xs" color="blue" variant="light">W:{group.wikipediaDiscoveredCount}</Badge>}
      {group.comicVineDiscoveredCount > 0 && <Badge size="xs" color="red" variant="light">C:{group.comicVineDiscoveredCount}</Badge>}
    </div>
  );
}

function PageActions({ pageId, isDeleting, onDelete }: { pageId: string; isDeleting: boolean; onDelete: (id: string) => void }): React.ReactElement {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleEdit = async (): Promise<void> => {
    setIsNavigating(true);
    try {
      await router.push(`/annotation/${pageId}`);
    } catch {
      setIsNavigating(false);
    }
  };

  return (
    <div style={COMPACT_ROW}>
      <Tooltip label="Edit">
        <ActionIcon variant="subtle" loading={isNavigating} onClick={() => void handleEdit()}>
          <IconEdit size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Open in new tab">
        <ActionIcon
          variant="subtle"
          component="a"
          href={`/annotation/${pageId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconExternalLink size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Delete">
        <ActionIcon variant="subtle" color="red" loading={isDeleting} onClick={() => onDelete(pageId)}>
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}

// ============================================================================
// PageRow
// ============================================================================

interface PageRowProps {
  page: PageListItem;
  isSubPage?: boolean;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function PageRow({ page, isSubPage, onDelete, isDeleting, isSelected, onToggleSelect }: PageRowProps): React.ReactElement {
  return (
    <Table.Tr style={isSubPage ? { backgroundColor: 'var(--mantine-color-dark-7)' } : undefined}>
      <Table.Td style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isSelected} onChange={onToggleSelect} aria-label={`Select ${page.mangaTitle ?? 'page'}`} />
      </Table.Td>
      <Table.Td style={{ maxWidth: 200 }}>
        <Box {...(isSubPage && { pl: 'xl' })}>
          <Text size="sm" fw={500} truncate="end">{page.mangaTitle ?? 'Untitled'}</Text>
          <Tooltip label={page.url} multiline maw={400}>
            <Text size="xs" c="dimmed" truncate="end">{getShortUrl(page.url)}</Text>
          </Tooltip>
        </Box>
      </Table.Td>
      <Table.Td style={{ width: 90 }}>
        <Badge variant="light" size="sm">{page.sourceType}</Badge>
      </Table.Td>
      <Table.Td style={{ width: 100 }}>
        <StatusBadge status={page.status} />
      </Table.Td>
      <Table.Td style={{ width: 70, textAlign: 'right' }}>
        <Text size="sm">{page.tokenCount.toLocaleString()}</Text>
      </Table.Td>
      <Table.Td style={{ width: 90 }}>
        <Text size="sm">{new Date(page.createdAt).toLocaleDateString()}</Text>
      </Table.Td>
      <Table.Td style={{ width: 90 }}>
        <ComicVineCell comicVineId={page.comicVineId} />
      </Table.Td>
      <Table.Td style={{ width: 120 }}>
        <DiscoveredBadges page={page} />
      </Table.Td>
      <Table.Td style={{ width: 100 }}>
        <PageActions pageId={page.id} isDeleting={isDeleting} onDelete={onDelete} />
      </Table.Td>
    </Table.Tr>
  );
}

// ============================================================================
// GroupRow
// ============================================================================

interface GroupRowProps {
  group: PageGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  selectedIds: Set<string>;
  onToggleGroupSelect: () => void;
  onTogglePageSelect: (id: string) => void;
}

export function GroupRow({ group, isExpanded, onToggle, onDelete, isDeleting, selectedIds, onToggleGroupSelect, onTogglePageSelect }: GroupRowProps): React.ReactElement {
  const hasSubPages = group.pages.length > 1;

  if (!hasSubPages) {
    const page = group.pages[0];
    if (page) {
      return (
        <PageRow
          page={page}
          onDelete={onDelete}
          isDeleting={isDeleting}
          isSelected={selectedIds.has(page.id)}
          onToggleSelect={() => onTogglePageSelect(page.id)}
        />
      );
    }
  }

  const groupPageIds = group.pages.map(p => p.id);
  const allGroupSelected = groupPageIds.every(id => selectedIds.has(id));
  const someGroupSelected = groupPageIds.some(id => selectedIds.has(id));
  const uniqueStatuses = Array.from(new Set(group.pages.map(p => p.status)));

  return (
    <>
      <Table.Tr style={{ backgroundColor: 'var(--mantine-color-dark-6)' }}>
        <Table.Td style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allGroupSelected}
            indeterminate={someGroupSelected && !allGroupSelected}
            onChange={onToggleGroupSelect}
            aria-label={`Select all pages in ${group.displayName}`}
          />
        </Table.Td>
        <Table.Td style={{ maxWidth: 200 }}>
          <UnstyledButton onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <div style={{ overflow: 'hidden' }}>
              <Text size="sm" fw={600} truncate="end">{group.displayName}</Text>
              <Text size="xs" c="dimmed">{group.pages.length} pages</Text>
            </div>
          </UnstyledButton>
        </Table.Td>
        <Table.Td style={{ width: 90 }}>
          <Badge variant="light" size="sm">{group.sourceType}</Badge>
        </Table.Td>
        <Table.Td style={{ width: 100 }}>
          <div style={COMPACT_ROW}>
            {uniqueStatuses.slice(0, 2).map(status => (
              <StatusBadge key={status} status={status} />
            ))}
            {uniqueStatuses.length > 2 && (
              <Text size="xs" c="dimmed">+{uniqueStatuses.length - 2}</Text>
            )}
          </div>
        </Table.Td>
        <Table.Td style={{ width: 70, textAlign: 'right' }}>
          <Text size="sm" fw={500}>{group.totalTokens.toLocaleString()}</Text>
        </Table.Td>
        <Table.Td style={{ width: 90 }}>
          <Text size="sm">{new Date(group.pages[0]?.createdAt ?? 0).toLocaleDateString()}</Text>
        </Table.Td>
        <Table.Td style={{ width: 90 }}>
          <ComicVineCell comicVineId={group.comicVineId} />
        </Table.Td>
        <Table.Td style={{ width: 120 }}>
          <GroupDiscoveredBadges group={group} />
        </Table.Td>
        <Table.Td style={{ width: 70 }} />
      </Table.Tr>
      {isExpanded && group.pages.map(page => (
        <PageRow
          key={page.id}
          page={page}
          isSubPage
          onDelete={onDelete}
          isDeleting={isDeleting}
          isSelected={selectedIds.has(page.id)}
          onToggleSelect={() => onTogglePageSelect(page.id)}
        />
      ))}
    </>
  );
}
