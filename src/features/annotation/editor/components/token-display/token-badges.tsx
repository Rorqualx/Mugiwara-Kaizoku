/**
 * Token Badge Components
 */

import React from 'react';

import { Text, Badge, Tooltip, Stack, Group, ThemeIcon } from '@mantine/core';
import { IconTags, IconLink, IconCode } from '@tabler/icons-react';

import { ENTITY_COLORS, type DisplayToken } from '@/features/annotation/editor/types';
import type { EntityType } from '@/server/ml/features/bio-types';

export function getTokenColor(label: string): string {
  if (label === 'O') return 'gray';
  const entity = label.substring(2) as EntityType;
  return ENTITY_COLORS[entity];
}

export function getTokenPrefix(label: string): string {
  if (label === 'O') return '';
  return label.charAt(0); // B or I
}

export function getEntityType(label: string): string {
  if (label === 'O') return 'Unlabeled';
  return label.substring(2);
}

export function getPrefixDescription(label: string): string {
  if (label === 'O') return '';
  const prefix = label.charAt(0);
  return prefix === 'B' ? 'Begin' : 'Inside';
}

interface TokenTooltipContentProps {
  token: DisplayToken;
}

function TokenTooltipContent({ token }: TokenTooltipContentProps): React.ReactElement {
  const entityType = getEntityType(token.label);
  const prefixDesc = getPrefixDescription(token.label);
  const color = getTokenColor(token.label);
  const isLabeled = token.label !== 'O';

  return (
    <Stack gap={4}>
      {/* Entity type with color indicator */}
      <Group gap="xs">
        <ThemeIcon size="xs" color={color} variant="filled" radius="xl">
          <IconTags size={10} />
        </ThemeIcon>
        <Text size="sm" fw={600} c="white">
          {entityType.replace(/_/g, ' ')}
        </Text>
        {isLabeled && prefixDesc && (
          <Badge size="xs" variant="light" color={color}>
            {prefixDesc}
          </Badge>
        )}
      </Group>

      {/* HTML element info */}
      <Group gap={4}>
        <IconCode size={12} style={{ opacity: 0.7 }} />
        <Text size="xs" c="dimmed">&lt;{token.tagName}&gt;</Text>
        <Text size="xs" c="dimmed">#{token.index}</Text>
      </Group>

      {/* Link info if present */}
      {token.linkHref && (
        <Group gap={4}>
          <IconLink size={12} style={{ opacity: 0.7 }} />
          <Text size="xs" c="dimmed" lineClamp={1} maw={200}>
            {token.linkHref}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

export function TokenBadge({
  token,
  isSelected,
  onClick,
}: {
  token: DisplayToken;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}): React.ReactElement {
  const color = getTokenColor(token.label);
  const prefix = getTokenPrefix(token.label);

  return (
    <Tooltip
      label={<TokenTooltipContent token={token} />}
      position="top"
      withArrow
      multiline
      w={220}
    >
      <Badge
        color={color}
        variant={isSelected ? 'filled' : token.label === 'O' ? 'outline' : 'light'}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          outline: isSelected ? '2px solid var(--mantine-color-blue-5)' : undefined,
        }}
        onClick={onClick}
        leftSection={prefix && <Text size="xs" fw={700}>{prefix}</Text>}
      >
        {token.text.length > 30 ? token.text.substring(0, 30) + '...' : token.text}
      </Badge>
    </Tooltip>
  );
}

export function CompactTokenBadge({
  token,
  isSelected,
  onClick,
}: {
  token: DisplayToken;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}): React.ReactElement {
  const color = getTokenColor(token.label);
  const displayText = token.text.length > 15 ? token.text.substring(0, 15) + '…' : token.text;

  return (
    <Tooltip
      label={<TokenTooltipContent token={token} />}
      position="top"
      withArrow
      multiline
      w={220}
    >
      <Badge
        size="xs"
        color={color}
        variant={isSelected ? 'filled' : token.label === 'O' ? 'outline' : 'light'}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          outline: isSelected ? '2px solid var(--mantine-color-blue-5)' : undefined,
        }}
        onClick={onClick}
      >
        {displayText}
      </Badge>
    </Tooltip>
  );
}
