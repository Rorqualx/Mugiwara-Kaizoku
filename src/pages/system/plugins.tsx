/**
 * System Plugins Page - DEPRECATED
 *
 * This page has been deprecated. Suwayomi and Custom Website Sources settings have been
 * moved to the Download Clients page under Settings.
 * 
 * @deprecated Use /settings/download-clients instead
 * @module pages/system/plugins
 */

import React, { useEffect } from "react";
import type { ReactElement } from 'react';

import { Text, Center, Loader } from '@mantine/core';
import { useRouter } from 'next/router';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';

/**
 * System Plugins Page Component - Redirects to Download Clients
 * 
 * @returns {JSX.Element} Loading indicator while redirecting
 */
export default function SystemPlugins(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the download clients page with the suwayomi tab active
    void router.replace('/settings/download-clients');
  }, [router]);

  return (
    <SystemLayout title="Redirecting...">
      <Center style={{ height: '50vh' }}>
        <div>
          <Loader size="lg" mb="md" />
          <Text>Redirecting to Download Clients...</Text>
        </div>
      </Center>
    </SystemLayout>);

}

// Use MainLayout for this page to get the full navigation
SystemPlugins.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};