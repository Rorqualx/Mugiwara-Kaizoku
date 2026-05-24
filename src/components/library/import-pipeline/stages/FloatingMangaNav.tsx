/**
 * Floating prev/next manga navigator for ReviewStage.
 *
 * Renders fixed bottom-right arrows that jump between [data-manga-card]
 * elements in the document, accounting for the 120px sticky header so
 * the target card lands just below the action bar.
 */
import { type JSX } from 'react';

import { ActionIcon, Box, Stack, Tooltip } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

const HEADER_OFFSET = 120;
const ADJACENT_THRESHOLD = 8;

function scrollToAdjacent(direction: 'prev' | 'next'): void {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-manga-card]'));
  if (cards.length === 0) return;
  const scrollY = window.scrollY;
  const tops = cards.map((c) => c.getBoundingClientRect().top + scrollY);
  const current = scrollY + HEADER_OFFSET;
  const target = direction === 'next'
    ? tops.find((t) => t > current + ADJACENT_THRESHOLD)
    : [...tops].reverse().find((t) => t < current - ADJACENT_THRESHOLD);
  if (target !== undefined) window.scrollTo({ top: target - HEADER_OFFSET, behavior: 'smooth' });
}

export function FloatingMangaNav(): JSX.Element {
  return (
    <Box style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
      <Stack gap={6}>
        <Tooltip label="Previous manga" position="left">
          <ActionIcon size="lg" radius="xl" variant="filled" color="blue" onClick={() => scrollToAdjacent('prev')}>
            <IconChevronUp size={20} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Next manga" position="left">
          <ActionIcon size="lg" radius="xl" variant="filled" color="blue" onClick={() => scrollToAdjacent('next')}>
            <IconChevronDown size={20} />
          </ActionIcon>
        </Tooltip>
      </Stack>
    </Box>
  );
}
