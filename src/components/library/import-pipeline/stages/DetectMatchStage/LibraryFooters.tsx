/**
 * LibraryFooters — collapsible sections beneath the main match table that
 * surface IN_LIBRARY rows (split by whether they have new chapters to add).
 *
 * Extracted from DetectMatchStage/index.tsx to stay under the 500-line
 * file ceiling.
 *
 * @module components/library/import-pipeline/stages/DetectMatchStage/LibraryFooters
 */
import { useState, type JSX } from 'react';

import { Badge, Checkbox, Collapse, Group, Paper, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

import type { MatchedMangaItem } from '@/components/library/import-pipeline/types';

interface FooterProps {
  libraryWithNewItems: MatchedMangaItem[];
  completeItems: MatchedMangaItem[];
  selectedForImport: Set<string>;
  onToggleSelect: (id: string, selected: boolean) => void;
  /** When true, libraryWithNew rows live here in the footer (default scan view).
   * When false, those rows appear in the main table — only `completeItems`
   * stays in the footer. */
  showLibraryWithNewSection: boolean;
}

function ItemSummary({ item }: { item: MatchedMangaItem }): JSX.Element {
  return (
    <>
      <Text size="sm">
        {item.parsedTitle}
        {item.duplicateOfId ? ` · #${item.duplicateOfId}` : ''}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={1}>{item.path}</Text>
    </>
  );
}

function FilesBadge({ item }: { item: MatchedMangaItem }): JSX.Element {
  const folderSuffix = (item.mergedCount ?? 1) > 1 ? ` · ${item.mergedCount} folders` : '';
  return <Badge size="xs" variant="light" color="blue">{item.fileCount} files{folderSuffix}</Badge>;
}

function LibraryWithNewFooter(props: {
  items: MatchedMangaItem[];
  selectedForImport: Set<string>;
  onToggleSelect: (id: string, selected: boolean) => void;
}): JSX.Element {
  const { items, selectedForImport, onToggleSelect } = props;
  const [open, setOpen] = useState(false);
  return (
    <Paper p="sm" withBorder>
      <UnstyledButton onClick={() => setOpen((s) => !s)} style={{ width: '100%' }}>
        <Group gap="xs">
          {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text size="sm" fw={500}>
            Already in library — top-up available ({items.length})
          </Text>
          <Text size="xs" c="dimmed">
            — auto-selected; expand to inspect or untick
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse in={open}>
        <Table mt="xs">
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td style={{ width: 40 }}>
                  <Checkbox
                    aria-label="Select for import"
                    checked={selectedForImport.has(item.id)}
                    onChange={(e) => onToggleSelect(item.id, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td><ItemSummary item={item} /></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <FilesBadge item={item} />
                    {typeof item.newChapters === 'number' && item.newChapters > 0 && (
                      <Badge size="xs" variant="filled" color="lime">+{item.newChapters} new</Badge>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Collapse>
    </Paper>
  );
}

function CompleteFooter({ items }: { items: MatchedMangaItem[] }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Paper p="sm" withBorder>
      <UnstyledButton onClick={() => setOpen((s) => !s)} style={{ width: '100%' }}>
        <Group gap="xs">
          {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text size="sm" fw={500}>Already complete ({items.length})</Text>
          <Text size="xs" c="dimmed">
            — these manga have no new chapters to import; expand to inspect
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse in={open}>
        <Table mt="xs">
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td><ItemSummary item={item} /></Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color="gray">
                    {item.fileCount} files{(item.mergedCount ?? 1) > 1 ? ` · ${item.mergedCount} folders` : ''}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Collapse>
    </Paper>
  );
}

export function LibraryFooters(props: FooterProps): JSX.Element {
  const { libraryWithNewItems, completeItems, selectedForImport, onToggleSelect, showLibraryWithNewSection } = props;
  return (
    <>
      {showLibraryWithNewSection && libraryWithNewItems.length > 0 && (
        <LibraryWithNewFooter
          items={libraryWithNewItems}
          selectedForImport={selectedForImport}
          onToggleSelect={onToggleSelect}
        />
      )}
      {completeItems.length > 0 && <CompleteFooter items={completeItems} />}
    </>
  );
}
