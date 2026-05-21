/**
 * Library listing page
 *
 * Shows all configured libraries as a grid of cards
 */

import React, { useCallback } from "react";
import type { ReactElement } from "react";

import { Box, Container, Title, Group, Badge } from "@mantine/core";

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { LibraryList } from '@/components/library/LibraryList';
import type { LibraryWithRelations } from '@/types/search.types';
import { trpc } from '@/utils/trpc-client';


function LibraryPage(): React.ReactElement {
  // Fetch libraries from database
  const { data: libraries, refetch } = trpc.library.query.useQuery();

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const libraryCount = (libraries as LibraryWithRelations[] | undefined)?.length ?? 0;

  return (
    <Box>
      {/* Header Bar */}
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
        <Container size="xl">
          <Group justify="space-between">
            <Group>
              <Title order={2}>Libraries</Title>
              <Badge size="lg" variant="light">
                {libraryCount} {libraryCount === 1 ? 'library' : 'libraries'}
              </Badge>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Library Grid */}
      <Container size="xl" p="md">
        <LibraryList
          libraries={(libraries as LibraryWithRelations[] | undefined) ?? []}
          onRefresh={handleRefresh}
        />
      </Container>
    </Box>
  );
}

LibraryPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

export default LibraryPage;
