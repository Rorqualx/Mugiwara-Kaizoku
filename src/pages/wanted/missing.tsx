/**
 * Missing Items Page
 *
 * Displays monitored chapters that are missing from the library, paginated
 * server-side. Filtering/sorting still happen client-side over the current
 * page (a future iteration could push them to the router as well).
 */

import React, { useState } from "react";
import type { ReactElement } from 'react';

import { Stack, Loader, Alert, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import WantedLayout from '@/components/layouts/WantedLayout';
import { MissingChaptersTable } from '@/components/wanted/MissingChaptersTable';
import { trpc } from '@/utils/trpc-client/index';

const PAGE_SIZE = 100;

export default function MissingPage(): React.ReactElement {
  const [page, setPage] = useState(1);

  const {
    data: missingData,
    isLoading,
    error,
    refetch
  } = trpc.wanted.getMissing.useQuery(
    { page, pageSize: PAGE_SIZE },
    { placeholderData: (prev) => prev }
  );

  if (isLoading && !missingData) {
    return (
      <WantedLayout title="Missing Chapters">
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading missing chapters...</Text>
        </Stack>
      </WantedLayout>
    );
  }

  if (error) {
    return (
      <WantedLayout title="Missing Chapters">
        <Alert icon={<IconAlertCircle size={16} />} title="Error loading missing chapters" color="red">
          {(error instanceof Error ? error.message : String(error)) || 'An unexpected error occurred'}
        </Alert>
      </WantedLayout>
    );
  }

  const items = missingData?.items ?? [];
  const total = missingData?.total ?? 0;
  const totalMangaAffected = missingData?.totalMangaAffected ?? 0;

  return (
    <WantedLayout title="Missing Chapters">
      <MissingChaptersTable
        items={items}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        totalMangaAffected={totalMangaAffected}
        onPageChange={setPage}
        onRefresh={() => void refetch()}
        isLoading={isLoading}
      />
    </WantedLayout>
  );
}

MissingPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
