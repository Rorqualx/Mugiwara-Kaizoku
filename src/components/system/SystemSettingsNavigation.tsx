/**
 * SystemSettingsNavigation component for system settings page navigation
 *
 * This component provides a tabbed navigation interface for the system settings
 * section, with both client-side routing and programmatic navigation support.
 * Features include:
 * - Path-based active tab detection
 * - Icon-based tab labels
 * - Dual navigation handling (Link + programmatic)
 * - Fallback to default tab
 *
 * @remarks
 * Navigation Sections:
 * - Status: System status overview
 * - Backup: System backup management
 * - Updates: System updates
 * - Plugins: Plugin management
 * - Appearance: UI customization
 * - Events: System event logs
 * - Log Files: System logs
 * - Users: User management
 *
 * Path Handling:
 * - Uses Next.js router for path detection
 * - Supports both Link component and programmatic navigation
 * - Falls back to status tab if path is unknown
 *
 * @example
 * Basic usage in system settings layout:
 * ```jsx
 * <SystemSettingsNavigation />
 * ```
 */
import React from "react";

import { Tabs } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconRefresh } from '@tabler/icons-react';
import { IconFile } from '@tabler/icons-react';
import { IconUsers } from '@tabler/icons-react';
import { IconDownload } from '@tabler/icons-react';
import { IconDatabase } from '@tabler/icons-react';
import { IconSettings } from '@tabler/icons-react';
import { IconClock } from '@tabler/icons-react';
import { useRouter } from "next/router";

import { logger } from '@/utils/logger';
export function SystemSettingsNavigation(): React.ReactElement {
    const router = useRouter();
    const currentPath = router.pathname;
    // Determine the active tab based on the current path
    const getActiveTab = (): string => {
        // Handle empty or null path
        if (!currentPath)
            return 'status';
        // Normalize path: lowercase and remove trailing slashes
        const normalizedPath = currentPath.toLowerCase().replace(/\/+$/, '');
        // Check if we're in the system section
        if (!normalizedPath.includes('/system'))
            return 'status';
        // Check specific system paths
        if (normalizedPath.includes('/system/status'))
            return 'status';
        if (normalizedPath.includes('/system/backup'))
            return 'backup';
        if (normalizedPath.includes('/system/updates'))
            return 'updates';
        if (normalizedPath.includes('/system/plugins'))
            return 'plugins';
        if (normalizedPath.includes('/system/appearance'))
            return 'appearance';
        if (normalizedPath.includes('/system/events'))
            return 'events';
        if (normalizedPath.includes('/system/logs'))
            return 'logs';
        if (normalizedPath.includes('/system/users'))
            return 'users';
        // Default to status for /system path or unknown system subpaths
        return 'status';
    };
    // Handle tab click with direct window navigation
    const handleTabClick = (path: string) => (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        logger.info('System settings tab clicked, navigating to:', path);
        // Use window.location directly for reliable navigation
        // This is necessary due to SSR being disabled with dynamic imports
        window.location.href = path;
    };
    return (<Tabs value={getActiveTab()} mb="xl">
      <Tabs.List>
        <Tabs.Tab value="status" leftSection={<IconRefresh size={16}/>} onClick={handleTabClick('/system/status')}>
          Status
        </Tabs.Tab>
        <Tabs.Tab value="backup" leftSection={<IconDownload size={16}/>} onClick={handleTabClick('/system/backup')}>
          Backup
        </Tabs.Tab>
        <Tabs.Tab value="updates" leftSection={<IconRefresh size={16}/>} onClick={handleTabClick('/system/updates')}>
          Updates
        </Tabs.Tab>
        <Tabs.Tab value="plugins" leftSection={<IconDatabase size={16}/>} onClick={handleTabClick('/system/plugins')}>
          Plugins
        </Tabs.Tab>
        <Tabs.Tab value="appearance" leftSection={<IconSettings size={16}/>} onClick={handleTabClick('/system/appearance')}>
          Appearance
        </Tabs.Tab>
        <Tabs.Tab value="events" leftSection={<IconClock size={16}/>} onClick={handleTabClick('/system/events')}>
          Events
        </Tabs.Tab>
        <Tabs.Tab value="logs" leftSection={<IconFile size={16}/>} onClick={handleTabClick('/system/logs')}>
          Log Files
        </Tabs.Tab>
        <Tabs.Tab value="users" leftSection={<IconUsers size={16}/>} onClick={handleTabClick('/system/users')}>
          Users
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>);
}
