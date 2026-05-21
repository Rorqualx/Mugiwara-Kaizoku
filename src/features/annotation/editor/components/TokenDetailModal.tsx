/**
 * Token Detail Modal - Shows all associated data with a token
 */

import React from 'react';

import {
  Modal,
  Stack,
  Text,
  Badge,
  Group,
  Table,
  Code,
  Image,
  Paper,
  Accordion,
  ScrollArea,
  Tooltip,
  CopyButton,
  ActionIcon,
} from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

import type { EntityType } from '@/server/ml/features/bio-types';

import { ENTITY_COLORS } from '../types';

import type { DisplayToken } from '../types';

interface TokenDetailModalProps {
  opened: boolean;
  onClose: () => void;
  token: DisplayToken | null;
  allTokens: DisplayToken[];
}

// eslint-disable-next-line complexity -- Modal displays 10+ accordion sections with conditional rendering
export function TokenDetailModal({
  opened,
  onClose,
  token,
  allTokens,
}: TokenDetailModalProps): React.ReactElement | null {
  if (!token) return null;

  // Parse label to get entity type and BIO prefix
  const bioPrefix = token.label.startsWith('B-')
    ? 'B'
    : token.label.startsWith('I-')
      ? 'I'
      : null;
  const entityType = token.label.replace(/^[BI]-/, '') as EntityType;

  // Get adjacent tokens for context
  const prevToken = allTokens.find((t) => t.index === token.index - 1);
  const nextToken = allTokens.find((t) => t.index === token.index + 1);

  // Get entity color - handle 'O' label case (not a valid EntityType)
  const color = bioPrefix ? ENTITY_COLORS[entityType] : 'gray';

  return (
    <Modal opened={opened} onClose={onClose} title="Token Details" size="lg">
      <ScrollArea h="70vh" offsetScrollbars>
        <Stack gap="md">
          {/* Token Text Header */}
          <Paper p="md" withBorder bg="gray.0">
            {token.isImage ? (
              <Stack gap="xs" align="center">
                <Image
                  src={token.imageSrc ?? undefined}
                  alt={token.imageAlt ?? 'Image token'}
                  maw={200}
                  radius="sm"
                />
                {token.imageAlt && (
                  <Text size="xs" c="dimmed" fs="italic">
                    {token.imageAlt}
                  </Text>
                )}
              </Stack>
            ) : (
              <Text size="lg" fw={600}>
                {token.text}
              </Text>
            )}
          </Paper>

          {/* Label Badge */}
          <Group>
            <Text size="sm" c="dimmed">Label:</Text>
            <Group gap={4}>
              {bioPrefix && (
                <Badge size="sm" color={bioPrefix === 'B' ? 'blue' : 'cyan'} variant="light">
                  {bioPrefix}
                </Badge>
              )}
              <Badge color={color} size="lg">
                {entityType.replace(/_/g, ' ')}
              </Badge>
            </Group>
          </Group>

          {/* Accordion Sections */}
          <Accordion multiple defaultValue={['basic', 'context']}>
            {/* Basic Info */}
            <Accordion.Item value="basic">
              <Accordion.Control>
                <Text size="sm" fw={500}>Basic Info</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <DataTable rows={[
                  { label: 'Token ID', value: token.id },
                  { label: 'Index', value: `#${token.index}` },
                  { label: 'Element', value: <Code>{`<${token.tagName}>`}</Code> },
                  { label: 'XPath', value: token.xpath, copyable: true, monospace: true },
                  ...(token.cssPath ? [{ label: 'CSS Path', value: token.cssPath, copyable: true, monospace: true }] : []),
                  ...(token.elementId ? [{ label: 'Element ID', value: token.elementId }] : []),
                  ...(token.classes && token.classes.length > 0 ? [{ label: 'Classes', value: token.classes.join(', '), monospace: true }] : []),
                ]} />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Text Features */}
            <Accordion.Item value="text">
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={500}>Text Features</Text>
                  {token.tokenType && <Badge size="xs" variant="light">{token.tokenType}</Badge>}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <DataTable rows={[
                  ...(token.normalizedText ? [{ label: 'Normalized', value: token.normalizedText }] : []),
                  ...(token.textLength !== undefined ? [{ label: 'Text Length', value: token.textLength }] : []),
                  ...(token.wordCount !== undefined ? [{ label: 'Word Count', value: token.wordCount }] : []),
                  ...(token.charOffset !== undefined ? [{ label: 'Char Offset', value: token.charOffset }] : []),
                  ...(token.documentPosition !== undefined ? [{ label: 'Doc Position', value: token.documentPosition }] : []),
                  ...(token.tokenType ? [{ label: 'Token Type', value: <Badge size="sm" variant="light">{token.tokenType}</Badge> }] : []),
                ]} />
                <FlagGroup flags={[
                  { label: 'Numeric', value: token.isNumeric },
                  { label: 'Date', value: token.isDate },
                  { label: 'Punctuation', value: token.isPunctuation },
                  { label: 'CJK', value: token.isCJK },
                  { label: 'All Caps', value: token.isAllCaps },
                ]} />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Semantic Patterns */}
            <Accordion.Item value="patterns">
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={500}>Semantic Patterns</Text>
                  <PatternCount token={token} />
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <FlagGroup flags={[
                  { label: 'Date Pattern', value: token.matchesDatePattern },
                  { label: 'Volume Pattern', value: token.matchesVolumePattern },
                  { label: 'Chapter Pattern', value: token.matchesChapterPattern },
                  { label: 'Name Pattern', value: token.matchesNamePattern },
                ]} />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Styling */}
            <Accordion.Item value="styling">
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={500}>Styling</Text>
                  <StyleBadges token={token} />
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <FlagGroup flags={[
                  { label: 'Bold', value: token.isBold },
                  { label: 'Italic', value: token.isItalic },
                  { label: 'Header', value: token.isHeader },
                ]} />
                <DataTable rows={[
                  ...(token.headerLevel ? [{ label: 'Header Level', value: `H${token.headerLevel}` }] : []),
                  ...(token.fontSize ? [{ label: 'Font Size', value: token.fontSize }] : []),
                  ...(token.fontWeight ? [{ label: 'Font Weight', value: token.fontWeight }] : []),
                  ...(token.color ? [{ label: 'Color', value: token.color, monospace: true }] : []),
                  ...(token.backgroundColor ? [{ label: 'Background', value: token.backgroundColor, monospace: true }] : []),
                ]} />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Structure */}
            <Accordion.Item value="structure">
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={500}>DOM Structure</Text>
                  {token.domDepth !== undefined && <Badge size="xs" variant="light">Depth: {token.domDepth}</Badge>}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <DataTable rows={[
                  ...(token.domDepth !== undefined ? [{ label: 'DOM Depth', value: token.domDepth }] : []),
                  ...(token.siblingIndex !== undefined ? [{ label: 'Sibling Index', value: token.siblingIndex }] : []),
                  ...(token.parentId ? [{ label: 'Parent ID', value: token.parentId, monospace: true }] : []),
                  ...(token.childIds && token.childIds.length > 0 ? [{ label: 'Child IDs', value: token.childIds.join(', '), monospace: true }] : []),
                ]} />
                <FlagGroup flags={[
                  { label: 'First in Element', value: token.isFirstInElement },
                  { label: 'Last in Element', value: token.isLastInElement },
                ]} />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Location Context */}
            <Accordion.Item value="location">
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={500}>Location Context</Text>
                  {token.sectionType && token.sectionType !== 'unknown' && (
                    <Badge size="xs" variant="light" color="violet">{token.sectionType}</Badge>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <DataTable rows={[
                  ...(token.sectionType ? [{ label: 'Section Type', value: <Badge size="sm" variant="light" color="violet">{token.sectionType}</Badge> }] : []),
                  ...(token.tableRow !== undefined && token.tableRow !== null ? [{ label: 'Table Row', value: token.tableRow }] : []),
                  ...(token.tableCol !== undefined && token.tableCol !== null ? [{ label: 'Table Column', value: token.tableCol }] : []),
                ]} />
                <FlagGroup flags={[
                  { label: 'In Table', value: token.isInTable },
                  { label: 'In List', value: token.isInList },
                  { label: 'In Infobox', value: token.isInInfobox },
                  { label: 'Table Header', value: token.isTableHeader },
                ]} />
              </Accordion.Panel>
            </Accordion.Item>

            {/* Link Info */}
            {token.isLink && (
              <Accordion.Item value="link">
                <Accordion.Control>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>Link Info</Text>
                    <Badge size="xs" color="blue">Link</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <DataTable rows={[
                    { label: 'Is Link', value: <Badge size="sm" color="blue">Yes</Badge> },
                    ...(token.linkHref ? [{ label: 'Href', value: token.linkHref, copyable: true, monospace: true }] : []),
                  ]} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {/* Context Signals */}
            <Accordion.Item value="context">
              <Accordion.Control>
                <Text size="sm" fw={500}>Context Signals</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {/* Adjacent Tokens */}
                  {prevToken && <ContextToken label="Previous Token" token={prevToken} />}
                  {nextToken && <ContextToken label="Next Token" token={nextToken} />}

                  {/* ML Context */}
                  <DataTable rows={[
                    ...(token.precedingText ? [{ label: 'Preceding Text', value: `"${token.precedingText}"` }] : []),
                    ...(token.followingText ? [{ label: 'Following Text', value: `"${token.followingText}"` }] : []),
                    ...(token.nearestLabelText ? [{ label: 'Nearest Label', value: token.nearestLabelText }] : []),
                    ...(token.distanceFromLabel !== undefined ? [{ label: 'Distance from Label', value: `${token.distanceFromLabel} tokens` }] : []),
                  ]} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* Image Details */}
            {token.isImage && (
              <Accordion.Item value="image">
                <Accordion.Control>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>Image Details</Text>
                    <Badge size="xs" color="red">Image</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <DataTable rows={[
                    ...(token.imageSrc ? [{ label: 'Source URL', value: token.imageSrc, copyable: true, monospace: true }] : []),
                    ...(token.imageAlt ? [{ label: 'Alt Text', value: token.imageAlt }] : []),
                    ...(token.imageWidth ? [{ label: 'Width', value: `${token.imageWidth}px` }] : []),
                    ...(token.imageHeight ? [{ label: 'Height', value: `${token.imageHeight}px` }] : []),
                  ]} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {/* Source HTML */}
            {(token.sourceHtml ?? token.htmlContext) && (
              <Accordion.Item value="html">
                <Accordion.Control>
                  <Text size="sm" fw={500}>Source HTML</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {token.sourceHtml && (
                      <>
                        <Text size="xs" fw={500}>Element HTML:</Text>
                        <Code block style={{ fontSize: 11, maxHeight: 100, overflow: 'auto' }}>
                          {token.sourceHtml}
                        </Code>
                      </>
                    )}
                    {token.htmlContext && (
                      <>
                        <Text size="xs" fw={500}>Context HTML:</Text>
                        <Code block style={{ fontSize: 11, maxHeight: 150, overflow: 'auto' }}>
                          {token.htmlContext}
                        </Code>
                      </>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>
        </Stack>
      </ScrollArea>
    </Modal>
  );
}

// Helper Components

interface DataRow {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  monospace?: boolean;
}

function DataTable({ rows }: { rows: DataRow[] }): React.ReactElement | null {
  const filteredRows = rows.filter((r) => r.value !== null && r.value !== undefined);
  if (filteredRows.length === 0) return null;

  return (
    <Table mb="xs" fz="xs">
      <Table.Tbody>
        {filteredRows.map((row) => (
          <Table.Tr key={row.label}>
            <Table.Td fw={500} w={120} style={{ verticalAlign: 'top' }}>
              {row.label}
            </Table.Td>
            <Table.Td>
              {row.copyable && typeof row.value === 'string' ? (
                <Group gap={4} wrap="nowrap">
                  {row.monospace ? (
                    <Code style={{ wordBreak: 'break-all', fontSize: 11 }}>{row.value}</Code>
                  ) : (
                    <Text size="sm">{row.value}</Text>
                  )}
                  <CopyButton value={row.value}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                        <ActionIcon size="xs" variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
                          {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              ) : row.monospace && typeof row.value === 'string' ? (
                <Code style={{ wordBreak: 'break-all', fontSize: 11 }}>{row.value}</Code>
              ) : (
                <Text size="sm" component="span">{row.value}</Text>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

interface FlagItem {
  label: string;
  value: boolean | undefined;
}

function FlagGroup({ flags }: { flags: FlagItem[] }): React.ReactElement | null {
  const activeFlags = flags.filter((f) => f.value === true);
  if (activeFlags.length === 0) return null;

  return (
    <Group gap={4} mb="xs">
      {activeFlags.map((flag) => (
        <Badge key={flag.label} size="xs" color="green" variant="light">
          {flag.label}
        </Badge>
      ))}
    </Group>
  );
}

function ContextToken({ label, token }: { label: string; token: DisplayToken }): React.ReactElement {
  const hasLabel = token.label !== 'O';
  const entityType = hasLabel ? (token.label.replace(/^[BI]-/, '') as EntityType) : null;
  const color = entityType ? ENTITY_COLORS[entityType] : 'gray';

  return (
    <Paper p="xs" withBorder bg="gray.0">
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" w={80}>
          {label}:
        </Text>
        {hasLabel && entityType && (
          <Badge size="xs" color={color} variant="light">
            {entityType.replace(/_/g, ' ')}
          </Badge>
        )}
        <Text size="sm" truncate style={{ flex: 1 }}>
          {token.isImage ? '[Image]' : `"${token.text}"`}
        </Text>
        <Text size="xs" c="dimmed">
          #{token.index}
        </Text>
      </Group>
    </Paper>
  );
}

function PatternCount({ token }: { token: DisplayToken }): React.ReactElement | null {
  const count = [
    token.matchesDatePattern,
    token.matchesVolumePattern,
    token.matchesChapterPattern,
    token.matchesNamePattern,
  ].filter(Boolean).length;

  if (count === 0) return null;
  return <Badge size="xs" color="orange" variant="light">{count} matched</Badge>;
}

function StyleBadges({ token }: { token: DisplayToken }): React.ReactElement | null {
  const badges: React.ReactNode[] = [];
  if (token.isBold) badges.push(<Badge key="bold" size="xs" variant="light">B</Badge>);
  if (token.isItalic) badges.push(<Badge key="italic" size="xs" variant="light" fs="italic">I</Badge>);
  if (token.isHeader) badges.push(<Badge key="header" size="xs" variant="light" color="blue">H{token.headerLevel ?? ''}</Badge>);
  if (badges.length === 0) return null;
  return <Group gap={2}>{badges}</Group>;
}
