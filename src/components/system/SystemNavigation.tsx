/**
 * SystemNavigation component for system management navigation
 *
 * This component provides a tabbed navigation interface for the system management
 * section of the application. It supports both interactive and disabled states,
 * making it suitable for both normal operation and setup/maintenance modes.
 *
 * Features:
 * - Tabbed navigation with icons
 * - Active tab highlighting
 * - Optional link disabling
 * - Path-based tab activation
 *
 * @remarks
 * Navigation Sections:
 * - Status: System status overview
 * - Backup: Backup management
 * - Updates: System updates
 * - Plugins: Plugin management
 * - Appearance: UI customization
 * - Events: System event logs
 * - Log Files: System logs
 * - Users: User management
 *
 * Path Handling:
 * - Automatically detects current path
 * - Supports multiple user page paths
 * - Falls back to status tab if path unknown
 *
 * @example
 * Basic usage with active links:
 * ```jsx
 * <SystemNavigation />
 * ```
 *
 * Usage in setup mode with disabled links:
 * ```jsx
 * <SystemNavigation disableLinks={true} />
 * ```
 */
import React, { useMemo } from "react";

import { Tabs } from "@mantine/core";
import { IconRefresh, IconFile, IconUsers, IconDownload, IconSettings, IconClock, IconDatabase } from '@tabler/icons-react';
import { useRouter } from "next/router";

import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';

// Import all required icons from @tabler/icons-react

/**
 * Available system navigation tab values
 */
export type SystemTabValue = "status" | "backup" | "updates" | "appearance" | "events" | "logs" | "annotation" | "users";
/**
 * System path to tab value mapping
 */
export interface SystemPathMap {
    /** Map of path segments to tab values */
    [key: string]: SystemTabValue;
}
/**
 * Specific tab configuration for system navigation
 */
export interface SystemTab {
    /** The value identifier for the tab */
    value: SystemTabValue;
    /** Display label for the tab */
    label: string;
    /** Path to navigate to when the tab is clicked */
    path: string;
    /** Icon component to render with the tab */
    icon: React.ReactElement;
    /** Admin-only tab — hidden from non-admins (route is also middleware-gated). */
    adminOnly?: boolean;
}
/**
 * Props for the SystemNavigation component
 */
export interface SystemNavigationProps {
    /** Whether to disable navigation links (useful for setup/maintenance modes) */
    disableLinks?: boolean;
    /** Optional active tab override (defaults to router-based detection) */
    activeTab?: SystemTabValue;
    /** Optional callback for tab change events */
    onTabChange?: (value: SystemTabValue) => void;
}
/**
 * Map of system tabs with their configuration
 */
const SYSTEM_TABS: SystemTab[] = [
    { value: 'status', label: 'Status', path: '/system/status', icon: <IconRefresh size={16}/>, adminOnly: true },
    { value: 'backup', label: 'Backup', path: '/system/backup', icon: <IconDownload size={16}/>, adminOnly: true },
    { value: 'updates', label: 'Updates', path: '/system/updates', icon: <IconRefresh size={16}/>, adminOnly: true },
    // Appearance is the caller's own theme preference — available to every user.
    { value: 'appearance', label: 'Appearance', path: '/system/appearance', icon: <IconSettings size={16}/>, adminOnly: false },
    { value: 'events', label: 'Events', path: '/system/events', icon: <IconClock size={16}/>, adminOnly: true },
    { value: 'logs', label: 'Log Files', path: '/system/logs', icon: <IconFile size={16}/>, adminOnly: true },
    { value: 'annotation', label: 'Annotation', path: '/annotation', icon: <IconDatabase size={16}/>, adminOnly: true },
    { value: 'users', label: 'Users', path: '/system/users', icon: <IconUsers size={16}/>, adminOnly: true }
];
/**
 * Map of path patterns to tab values
 */
const PATH_MAP: SystemPathMap = {
    '/system/status': 'status',
    '/system/backup': 'backup',
    '/system/updates': 'updates',
    '/system/appearance': 'appearance',
    '/system/events': 'events',
    '/system/logs': 'logs',
    '/annotation': 'annotation',
    '/system/users': 'users',
    '/systems/users': 'users' // Handle the legacy path
};
/**
 * System navigation component with tabbed interface
 *
 * @param props - Component props
 * @returns Tabbed navigation for system management pages
 */
export function SystemNavigation({ disableLinks = false, activeTab, onTabChange }: SystemNavigationProps): React.ReactElement {
    const router = useRouter();
    const { isAdmin } = useAuth();
    const currentPath = router.pathname;
    const visibleTabs = useMemo(() => SYSTEM_TABS.filter((tab) => isAdmin || !tab.adminOnly), [isAdmin]);

    /**
     * Memoized active tab value to prevent unnecessary recalculations
     */
    const currentTab = useMemo<SystemTabValue>(() => {
        // If an override is provided via props, use that
        if (activeTab) {
            return activeTab;
        }
        // Extract the last part of the path for more accurate matching
        const pathSegments = currentPath.split('/').filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
        // Check direct path matches from the map
        for (const [path, value] of Object.entries(PATH_MAP)) {
            if (currentPath.includes(path)) {
                return value;
            }
        }
        // Special case for users page - handle when only the last segment is 'users'
        if (lastSegment === 'users') {
            return 'users';
        }
        return 'status'; // Default to status
    }, [currentPath, activeTab]);
    /**
     * Handle tab change events
     *
     * @param value - The selected tab value
     */
    const handleTabChange = (value: string | null): void => {
        // Only call the callback if the value is a valid SystemTabValue
        if (value && isSystemTabValue(value) && onTabChange) {
            onTabChange(value);
        }
    };
    /**
     * Type guard to verify if a string is a valid SystemTabValue
     *
     * @param value - The value to check
     * @returns Whether the value is a valid SystemTabValue
     */
    function isSystemTabValue(value: string): value is SystemTabValue {
        return SYSTEM_TABS.some(tab => tab.value === value);
    }
    // Create the tab elements with proper children to avoid TypeScript errors
    const tabElements = visibleTabs.map(tab => (disableLinks ? (
    // Disabled tabs (no links) for setup page
    <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
        {tab.label}
      </Tabs.Tab>) : (
    // Active tabs with direct navigation for normal system pages
    <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon} onClick={() => {
            logger.info('System tab clicked, navigating to:', tab.path);
            // Use window.location directly for reliable navigation
            // This is necessary due to SSR being disabled with dynamic imports
            window.location.href = tab.path;
        }}>
        {tab.label}
      </Tabs.Tab>)));
    return (<Tabs value={currentTab} mb="xl" onChange={handleTabChange}>
      <Tabs.List grow children={tabElements}/>
    </Tabs>);
}
