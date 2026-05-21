/**
 * SetupNavigation component for setup process navigation
 * 
 * This component provides a tabbed navigation interface for the setup wizard,
 * displaying the current step and overall progress in the setup process.
 * Features include:
 * - Step-based navigation
 * - Visual progress indicators
 * - Icon-based step identification
 * - Active state tracking
 * 
 * @remarks
 * Setup Steps:
 * - Create Admin: Initial admin account creation
 * - Complete: Setup completion confirmation
 * 
 * Navigation States:
 * - Active step highlighting
 * - Step completion tracking
 * - Visual step progression
 * 
 * @example
 * Basic usage in setup wizard:
 * ```jsx
 * <SetupNavigation active={0} />
 * ```
 */

import React from "react";

import { Tabs } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconUserPlus } from '@tabler/icons-react';
import { IconCheck } from '@tabler/icons-react';

/**
 * Props for the SetupNavigation component
 */
interface SetupNavigationProps {
  /** Current active step number (0: Create Admin, 1: Complete) */
  active: number;
}

export function SetupNavigation({ active }: SetupNavigationProps): React.ReactElement {
  // Convert the active step number to the corresponding tab value
  const getActiveTab = (): string => {
    return active === 0 ? 'create-admin' : 'complete';
  };

  return (
    <Tabs value={getActiveTab()} mb="xl">
      <Tabs.List>
        <Tabs.Tab 
          value="create-admin" 
          leftSection={<IconUserPlus size={16} />}
        >
          Create Admin
        </Tabs.Tab>
        <Tabs.Tab 
          value="complete" 
          leftSection={<IconCheck size={16} />}
        >
          Complete
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
