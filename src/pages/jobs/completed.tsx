/**
 * Completed Jobs Page — Redirect
 *
 * Redirects to the unified Jobs page with the Completed tab selected.
 * The completed jobs view is now part of /jobs/active.
 */
import React, { useEffect } from 'react';
import type { ReactElement } from 'react';

import { Center, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/router';

import { MainLayout } from '@/components/layouts/MainLayout';

function RedirectToJobs(): React.ReactElement {
  const router = useRouter();
  useEffect(() => { void router.replace('/jobs/active?tab=completed'); }, [router]);

  return (
    <Center h="calc(100vh - 200px)" style={{ backgroundColor: '#333333' }}>
      <Stack align="center">
        <Loader size="xl" color="blue" />
        <Text c="dimmed">Redirecting to Jobs...</Text>
      </Stack>
    </Center>
  );
}

export default function CompletedJobsPage(): React.ReactElement {
  return <RedirectToJobs />;
}

CompletedJobsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <MainLayout>{page}</MainLayout>;
};
