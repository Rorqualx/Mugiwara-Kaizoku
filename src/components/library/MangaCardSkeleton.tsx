/**
 * Skeleton placeholder for manga cards shown while pagination fetches the next
 * batch. Dimensions mirror the real `ResponsiveMangaCard` via a 2:3 aspect ratio
 * so the infinite-scroll grid avoids layout shift when cards swap in.
 */
import React from 'react';

import { Box, Grid, Skeleton, Text } from '@mantine/core';

export function getGridSpanForCoverSize(
  size: string
): { base: number; sm: number; md: number; lg: number } {
  switch (size) {
    case 'small':
      return { base: 6, sm: 4, md: 3, lg: 2 };
    case 'large':
      return { base: 12, sm: 12, md: 6, lg: 4 };
    default:
      return { base: 12, sm: 6, md: 4, lg: 3 };
  }
}

interface MangaCardSkeletonProps {
  title?: string | undefined;
}

export function MangaCardSkeleton({ title }: MangaCardSkeletonProps): React.ReactElement {
  return (
    <Box>
      <Skeleton radius="md" style={{ aspectRatio: '2 / 3', width: '100%' }} />
      {title ? (
        <Text size="sm" ta="center" mt={8} lineClamp={2}>{title}</Text>
      ) : (
        <Skeleton height={14} mt={8} width="70%" mx="auto" />
      )}
    </Box>
  );
}

interface MangaCardSkeletonGridProps {
  count: number;
  coverSize: string;
  titles?: readonly string[];
}

export function MangaCardSkeletonGrid({
  count,
  coverSize,
  titles,
}: MangaCardSkeletonGridProps): React.ReactElement {
  const span = getGridSpanForCoverSize(coverSize);
  return (
    <Grid gutter="xl" mt="xl">
      {Array.from({ length: count }).map((_, i) => (
        <Grid.Col key={`manga-skeleton-${i}`} span={span}>
          <MangaCardSkeleton title={titles?.[i]} />
        </Grid.Col>
      ))}
    </Grid>
  );
}
