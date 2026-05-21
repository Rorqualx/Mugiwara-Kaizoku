/**
 * Settings Menu Module
 * 
 * This module provides the settings menu drawer component that serves as the
 * main interface for accessing and modifying application settings. It handles
 * client-side rendering and drawer state management.
 * 
 * Features:
 * - Client-side only rendering
 * - Responsive drawer interface
 * - Scrollable settings content
 * - Right-side positioning
 * 
 * @module components/settingsMenu
 */

import React from "react";
import { useState } from 'react';

import { Drawer, ScrollArea, Title, ActionIcon } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';

import { useClientModal } from '@/hooks/useClientModal';

import { SettingsMenu } from './SettingsMenu';

/**
 * Settings Menu Button Component
 *
 * Renders a drawer containing the application settings menu. The component
 * is client-side rendered only to prevent hydration mismatches and ensure
 * proper modal functionality.
 *
 * The drawer provides a scrollable area for the settings content and
 * handles its own open/close state management.
 *
 * @returns {JSX.Element | null} The settings menu drawer or null if not mounted
 *
 * @example
 * ```tsx
 * <SettingsMenuButton />
 * ```
 */
export function SettingsMenuButton(): React.ReactElement | null {
  const [opened, setOpened] = useState(false);
  const { mounted } = useClientModal();

  // Only render on client-side to prevent hydration mismatches
  if (!mounted) {
    return null;
  }

  return (
    <>
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title={<Title order={3}>Settings</Title>}
        padding="md"
        size="xl"
       >

        <ScrollArea h="calc(100vh - 100px)">
          <SettingsMenu />
        </ScrollArea>
      </Drawer>

      <ActionIcon
        variant="transparent"
        onClick={() => setOpened(true)}
        size="lg"
        style={{
          backgroundColor: "var(--mantine-color-white)",
          color: "var(--mantine-color-black)"
        }}
      >
        <IconSettings size={18} strokeWidth={2} />
      </ActionIcon>
    </>
  );

}