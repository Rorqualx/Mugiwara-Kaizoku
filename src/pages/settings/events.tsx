/**
 * Events Settings Page
 * 
 * This page provides an interface for configuring system event behavior,
 * including retention policies, notification preferences, and log levels.
 * 
 * @module pages/settings/events
 */

import React from "react";
import type { ReactElement } from 'react';

import { Title } from '@mantine/core';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
// Import actual component for full functionality
import { EventSettings } from '@/components/settings/EventSettings';

/**
 * Events Settings Page Component
 * 
 * Renders the event settings configuration interface within the settings layout.
 * 
 * @returns {JSX.Element} The events settings page
 */
export default function EventsSettingsPage(): React.ReactElement {
  return (
    <SettingsLayout>
      <Title order={2} mb="xl">Event Settings</Title>
      
      <EventSettings />
    </SettingsLayout>
  );
}

// Use MainLayout for this page to get the full navigation
EventsSettingsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};