/**
 * Settings Navigation Component
 *
 * This component provides a tabbed navigation interface for the application's
 * settings pages. It includes tabs for general settings, media management,
 * indexers, download clients, and metadata configuration.
 *
 * Features:
 * - Responsive tab navigation
 * - Icon-based visual indicators
 * - Automatic active tab detection
 * - Client-side routing integration
 *
 * @module components/settings/SettingsNavigation
 */
import React from "react";

import { Tabs } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconFolderPlus } from '@tabler/icons-react';
import { IconSearch } from '@tabler/icons-react';
import { IconDownload } from '@tabler/icons-react';
import { IconDatabase } from '@tabler/icons-react';
import { IconClock } from '@tabler/icons-react';
import { IconPlugConnected } from '@tabler/icons-react';
import { IconArrowsExchange } from '@tabler/icons-react';
import { IconShieldCheck } from '@tabler/icons-react';
import { IconBooks } from '@tabler/icons-react';
import { useRouter } from "next/router";

import { logger } from '@/utils/logger';
/**
 * Settings navigation component with tabbed interface
 *
 * Renders a navigation bar with tabs for different settings sections.
 * Automatically highlights the active tab based on the current route
 * and handles navigation between settings pages.
 *
 * @returns {JSX.Element} The rendered settings navigation
 *
 * @example
 * ```tsx
 * <SettingsNavigation />
 * ```
 */
export function SettingsNavigation(): React.ReactElement {
    const router = useRouter();
    // Determine active tab from current path
    const getActiveTab = (): string => {
        const currentPath = router.pathname;
        if (!currentPath)
            return 'events';
        const normalizedPath = currentPath.toLowerCase().replace(/\/+$/, '');
        if (normalizedPath.includes('/settings/events'))
            return 'events';
        if (normalizedPath.includes('/settings/integrations'))
            return 'integrations';
        if (normalizedPath.includes('/settings/media-management'))
            return 'media-management';
        if (normalizedPath.includes('/settings/indexers'))
            return 'indexers';
        if (normalizedPath.includes('/settings/download-clients'))
            return 'download-clients';
        if (normalizedPath.includes('/settings/metadata'))
            return 'metadata';
        if (normalizedPath.includes('/settings/file-conversion'))
            return 'file-conversion';
        if (normalizedPath.includes('/settings/flaresolverr'))
            return 'flaresolverr';
        if (normalizedPath.includes('/settings/library'))
            return 'library';
        return 'events';
    };
    const activeTab = getActiveTab();
    /**
     * Handles navigation with fallback strategy
     *
     * @param {string} path - The target path
     */
    const navigateToPath = async (path: string): Promise<void> => {
        // Only navigate if we're not already on the target path
        if (router.pathname === path)
            return;
        try {
            // First attempt: standard client-side navigation
            await router.push(path);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[SettingsNavigation] Client navigation failed:', errorMessage);
            try {
                // Second attempt: replace instead of push
                await router.replace(path);
            }
            catch (replaceError: unknown) {
                logger.error('[SettingsNavigation] Replace navigation failed:', replaceError);
                // Final fallback: hard navigation (guaranteed to work)
                window.location.href = path;
            }
        }
    };
    const tabs = [
        { value: 'events', label: 'Events', icon: IconClock, path: '/settings/events' },
        { value: 'integrations', label: 'Integrations', icon: IconPlugConnected, path: '/settings/integrations' },
        { value: 'media-management', label: 'Media Management', icon: IconFolderPlus, path: '/settings/media-management' },
        { value: 'indexers', label: 'Indexers', icon: IconSearch, path: '/settings/indexers' },
        { value: 'download-clients', label: 'Download Clients', icon: IconDownload, path: '/settings/download-clients' },
        { value: 'metadata', label: 'Metadata', icon: IconDatabase, path: '/settings/metadata' },
        { value: 'file-conversion', label: 'File Conversion', icon: IconArrowsExchange, path: '/settings/file-conversion' },
        { value: 'flaresolverr', label: 'FlareSolverr', icon: IconShieldCheck, path: '/settings/flaresolverr' },
        { value: 'library', label: 'Import Manga', icon: IconBooks, path: '/settings/library' },
    ];
    return (<Tabs value={activeTab} mb="xl">
      <Tabs.List>
        {tabs.map((tab) => {
            const Icon = tab.icon;
            return (<Tabs.Tab key={tab.value} value={tab.value} leftSection={<Icon size={16}/>} onClick={(e) => {
                    e.preventDefault();
                    void navigateToPath(tab.path);
                }} style={{ cursor: 'pointer' }}>
              {tab.label}
            </Tabs.Tab>);
        })}
      </Tabs.List>
    </Tabs>);
}
