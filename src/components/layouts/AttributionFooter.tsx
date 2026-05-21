"use client";

import React from 'react';

import { Anchor, Box, Group, Text } from '@mantine/core';

const sources: ReadonlyArray<{ name: string; href: string }> = [
  { name: 'AniList', href: 'https://anilist.co' },
  { name: 'MangaDex', href: 'https://mangadex.org' },
  { name: 'ComicVine', href: 'https://comicvine.gamespot.com' },
  { name: 'Wikipedia', href: 'https://www.wikipedia.org' },
  { name: 'Fandom', href: 'https://www.fandom.com' }
];

export function AttributionFooter(): React.ReactElement {
  return (
    <Box
      component="footer"
      style={{
        width: '100%',
        padding: '12px 16px 16px',
        marginTop: 24,
        opacity: 0.55
      }}
    >
      <Group gap={4} justify="center" wrap="wrap">
        <Text size="xs" c="dimmed">Metadata provided by</Text>
        {sources.map((source, i) => (
          <React.Fragment key={source.name}>
            <Anchor
              href={source.href}
              target="_blank"
              rel="noreferrer noopener"
              size="xs"
              c="dimmed"
              underline="hover"
            >
              {source.name}
            </Anchor>
            {i < sources.length - 1 && <Text size="xs" c="dimmed">·</Text>}
          </React.Fragment>
        ))}
      </Group>
    </Box>
  );
}
