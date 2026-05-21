/**
 * System Backup Page
 *
 * Renders the backup & restore functionality within the system layout.
 * Uses the shared BackupRestoreSettings component wrapped with proper layout.
 *
 * @module pages/system/backup
 */

import React from 'react';
import type { ReactElement } from 'react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import BackupRestoreSettings from '@/pages/settings/backup';

/**
 * System Backup Page Component
 *
 * Wraps the BackupRestoreSettings component with SystemLayout
 * to provide consistent navigation and styling.
 */
export default function SystemBackup(): React.ReactElement {
  return (
    <SystemLayout title="Backup & Restore">
      <BackupRestoreSettings />
    </SystemLayout>
  );
}

// Use ResponsiveMainLayout for this page to get the full navigation
SystemBackup.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
