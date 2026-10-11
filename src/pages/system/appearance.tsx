/**
 * Appearance Settings Page
 *
 * Provides theme and visual customization options for the application.
 * Includes theme selection, color customization, and UI preferences.
 *
 * @module pages/system/appearance
 */

import React, { Suspense, useState, useEffect } from 'react';
import type { ReactElement } from 'react';

import { Title, Stack, Paper, Text, Loader, Center } from '@mantine/core';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import { useIsAdmin } from '@/hooks/useIsAdmin';

// Lazy load the components to prevent blocking
const ThemeEditor = React.lazy(() =>
  import('../../components/settings/ThemeEditor').then(module => ({
    default: module.ThemeEditor
  }))
);

const SwitchTheme = React.lazy(() =>
  import('../../components/settings/switchTheme').then(module => ({
    default: module.SwitchTheme
  }))
);

// Loading component
function LoadingFallback(): React.ReactElement {
  return (
    <Center h={100}>
      <Loader size="sm" />
    </Center>
  );
}

// Client-only wrapper to prevent SSR hydration issues
function ClientOnly({ children }: { children: React.ReactNode }): React.ReactElement {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <LoadingFallback />;
  }

  return <>{children}</>;
}

/**
 * Appearance Settings Page Component
 * 
 * Manages visual customization options including:
 * - Theme selection (light/dark mode)
 * - Color scheme customization
 * - UI preferences
 */
export default function AppearancePage(): React.ReactElement {
  // Light/dark mode is a per-browser preference and open to everyone. The
  // colour palette is one app-wide setting saved through an admin-only
  // procedure (config.set), so the editor is offered to administrators only —
  // for anyone else its Save button could only fail.
  const isAdmin = useIsAdmin();
  return (
    <SystemLayout title="Appearance Settings">
      <Stack gap="lg">
        <Paper shadow="xs" p="md" radius="md" withBorder>
          <Title order={3} mb="md">Theme Settings</Title>
          <Text c="dimmed" mb="lg">
            Customize the look and feel of your application
          </Text>
          <ClientOnly>
            <Suspense fallback={<LoadingFallback />}>
              <SwitchTheme />
            </Suspense>
          </ClientOnly>
        </Paper>

        {isAdmin && (
          <Paper shadow="xs" p="md" radius="md" withBorder>
            <Title order={3} mb="md">Advanced Theme Editor</Title>
            <Text c="dimmed" mb="lg">
              Fine-tune colors and styling options. The palette applies to every user.
            </Text>
            <ClientOnly>
              <Suspense fallback={<LoadingFallback />}>
                <ThemeEditor />
              </Suspense>
            </ClientOnly>
          </Paper>
        )}
      </Stack>
    </SystemLayout>
  );
}

// Use MainLayout for this page to get the full navigation
AppearancePage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};