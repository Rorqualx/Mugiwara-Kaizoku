/**
 * System Status Page
 * 
 * Provides a comprehensive view of the system's current operational status.
 * Displays real-time information about system health, resource usage,
 * and component states.
 * 
 * Features:
 * - System health indicators
 * - Resource utilization metrics
 * - Service status monitoring
 * - Integration status checks
 * - Real-time updates
 * 
 * @module pages/system/status
 * @requires @/components/layouts/SystemLayout - Page layout wrapper
 * @requires @/components/system/StatusContent - Status display component
 */

import React from "react";
import type { ReactElement } from 'react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import { StatusContent } from '@/components/system/StatusContent';

/**
 * System Status Page Component
 * 
 * Renders the system status interface using the StatusContent component
 * within the system layout. Provides real-time monitoring of system
 * health and performance metrics.
 * 
 * @component
 * @example
 * ```tsx
 * // In router/navigation
 * <Route path="/system/status" component={SystemStatus} />
 * ```
 */
export default function SystemStatus(): React.ReactElement {
  return (
    <SystemLayout title="System Status">
      <StatusContent />
    </SystemLayout>
  );
}

// Use MainLayout for this page to get the full navigation
SystemStatus.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

/**
 * Server-side Props
 * Reserved for future server-side data fetching needs
 * 
 * @returns {Promise<Object>} Empty props object
 */
export const getServerSideProps = (): { props: Record<string, never> } | { redirect: { destination: string; permanent: boolean } } => {
  return {
    props: {},
  };
};