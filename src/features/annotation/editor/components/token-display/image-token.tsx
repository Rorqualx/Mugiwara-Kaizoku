/**
 * Image Token Component
 */

import React from 'react';

import { Text, Stack, Badge, Tooltip, Image, Box, Group, ThemeIcon } from '@mantine/core';
import { IconPhoto, IconTags, IconCode } from '@tabler/icons-react';

import type { DisplayToken } from '@/features/annotation/editor/types';

import { getTokenColor, getTokenPrefix, getEntityType, getPrefixDescription } from './token-badges';

function getImageProxyUrl(src: string): string {
  if (src.includes('fandom.com') || src.includes('wikia.nocookie.net')) {
    return `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }
  if (src.includes('wikipedia.org') || src.includes('wikimedia.org')) {
    return `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }
  return src;
}

export function ImageToken({
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
  const proxyUrl = token.imageSrc ? getImageProxyUrl(token.imageSrc) : null;

  const entityType = getEntityType(token.label);
  const prefixDesc = getPrefixDescription(token.label);
  const isLabeled = token.label !== 'O';

  return (
    <Tooltip
      label={
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

          {/* Image alt text */}
          {token.imageAlt && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {token.imageAlt}
            </Text>
          )}

          {/* HTML element info */}
          <Group gap={4}>
            <IconCode size={12} style={{ opacity: 0.7 }} />
            <Text size="xs" c="dimmed">&lt;img&gt;</Text>
            <Text size="xs" c="dimmed">#{token.index}</Text>
          </Group>
        </Stack>
      }
      position="top"
      withArrow
      multiline
      w={220}
    >
      <Box
        data-token-index={token.index}
        onClick={onClick}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
          border: isSelected
            ? '3px solid var(--mantine-color-blue-5)'
            : token.label !== 'O'
              ? `2px solid var(--mantine-color-${color}-5)`
              : '1px solid var(--mantine-color-gray-4)',
          borderRadius: 8,
          padding: 4,
          background: token.label !== 'O' ? `var(--mantine-color-${color}-0)` : undefined,
        }}
      >
        {proxyUrl ? (
          <Image
            src={proxyUrl}
            alt={token.imageAlt ?? 'Image'}
            w={80}
            h={80}
            fit="contain"
            fallbackSrc="/placeholder-image.png"
          />
        ) : (
          <Box w={80} h={80} bg="gray.1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconPhoto size={32} color="gray" />
          </Box>
        )}
        {token.label !== 'O' && (
          <Badge
            size="xs"
            color={color}
            style={{ position: 'absolute', top: -8, right: -8 }}
          >
            {prefix}
          </Badge>
        )}
      </Box>
    </Tooltip>
  );
}
