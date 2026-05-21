/**
 * SettingsActionBar component for settings pages
 *
 * A minimal action bar specifically for settings pages that only includes
 * a home button that navigates to the events settings page.
 *
 * @remarks
 * This component provides a streamlined interface with:
 * - Simple navigation to settings home (/settings/events)
 * - Consistent styling with the main ActionBar
 */
import React from "react";

import { Group, ActionIcon, Box, Text, Stack } from "@mantine/core";
import { IconHome } from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';

const settingsButtonStyles = {
  root: {
    color: 'var(--mantine-color-gray-0)',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      transform: 'scale(1.15)',
      color: '#ffffff',
      boxShadow: '0 0 12px rgba(255, 255, 255, 0.7)',
    },
  },
};

function SettingsHomeButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <Stack gap={2} align="center" style={{ width: '60px' }}>
      <ActionIcon
        variant="subtle"
        size="lg"
        title="Go to Settings"
        onClick={onClick}
        styles={settingsButtonStyles}
      >
        <IconHome size={20} />
      </ActionIcon>
      <Text size="xs" c="dimmed" ta="center">Settings</Text>
    </Stack>
  );
}

export function SettingsActionBar(): React.JSX.Element {
  const { navigateTo } = useNavigation();

  return (
    <Box style={{
      height: "56px",
      backgroundColor: "#333333",
      borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
      boxShadow: "var(--mantine-shadow-md)",
      zIndex: 200,
      position: "fixed",
      top: "56px",
      left: "210px",
      right: "0",
    }}>
      <Group justify="space-between" pl="16px" pr="16px" h="100%" w="100%">
        <Group>
          <SettingsHomeButton onClick={() => { void navigateTo('/settings/events'); }} />
        </Group>
      </Group>
    </Box>
  );
}
