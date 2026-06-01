"use client";

import React, { useState, useEffect } from "react";

import { Box, Collapse, Text, Stack } from "@mantine/core";
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconBook,
  IconBooks,
  IconCalendarStats,
  IconClock,
  IconDatabase,
  IconDeviceFloppy,
  IconDownload,
  IconFile,
  IconFolderPlus,
  IconHome,
  IconPalette,
  IconPhoto,
  IconPlugConnected,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconTools,
  IconUsers,
} from '@tabler/icons-react';
import { useRouter } from "next/router";
import { useSession } from 'next-auth/react';

import { logger } from '../utils/logger';
// Use the standard client for this component
import { trpc } from '../utils/trpc-client/index';

import { ActiveNavItem } from "./ActiveNavItem";
import { EventsPanel } from "./events/EventsPanel";

/**
 * Library data interface
 */
interface Library {
    id: number;
    name: string;
}

/**
 * Activity data interface for task monitoring
 */
interface ActivityProps {
    active: number;
    queued: number;
    scheduled: number;
    failed: number;
    completed: number;
    outOfSync: number;
    conversions: number;
}

const EMPTY_ACTIVITY: ActivityProps = {
    active: 0,
    queued: 0,
    scheduled: 0,
    failed: 0,
    completed: 0,
    outOfSync: 0,
    conversions: 0,
};
/**
 * Library section component with dynamic library list
 *
 * Features:
 * - Collapsible library list
 * - Dynamic library loading
 * - Error handling
 * - Hover state management
 */
function LibrarySection(): React.JSX.Element {
    const { data: session, status } = useSession();
    const isAuthenticated = status === 'authenticated' && !!session;
    // Only open on hover - consistent with other menu sections
    const [hovered, setHovered] = useState<boolean>(false);
    // Use tRPC to fetch libraries - only when authenticated
    const libraryQuery = trpc.library.query.useQuery(undefined, {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes — prevent stale library data lingering in cache
        refetchOnWindowFocus: false,
        enabled: isAuthenticated // Only fetch when user is logged in
    });
    const libraries = (libraryQuery.data as Library[] | undefined) ?? [];
    const isLoading = libraryQuery.isLoading && isAuthenticated;
    const error = libraryQuery.error;
    // Handle query error with useEffect - only log if authenticated (expected to fail when not logged in)
    useEffect(() => {
        if (error && isAuthenticated) {
            logger.error('Library query failed:', error);
        }
    }, [error, isAuthenticated]);
    // Remove auto-expand logic - library menu should only open on hover
    // This ensures consistent behavior with other menu sections
    // Navigation is handled by the ActiveNavItem component
    // Always link to the library listing page
    const defaultLibraryHref = '/library';

    return (<Stack gap={0} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      <ActiveNavItem icon={<IconBook size={16}/>} label="Library" href={defaultLibraryHref}/>

      <Collapse in={hovered}>
        <Stack gap={0}>
          {isLoading ?
            <Text c="dimmed" ta="center" py="md">Loading libraries...</Text> :
            error ?
                <Text c="red" ta="center" py="md">Error loading libraries</Text> :
                libraries.length === 0 ?
                    <Text c="dimmed" ta="center" py="md">No libraries found</Text> :
                    // Render libraries using the fetched data
                    // Note: ActiveNavItem already handles navigation via href, no onClick needed
                    libraries.map((library) => <ActiveNavItem key={library.id} icon={<IconBook size={16}/>} label={library.name} href={`/library/${library.id}`} nested/>)}
        </Stack>
      </Collapse>
    </Stack>);
}
/**
 * Activity section component for task monitoring
 *
 * Features:
 * - Task status display
 * - Status badges with counts
 * - Collapsible menu
 * - Hover state management
 *
 * @param data - Activity data with task counts
 */
function ActivitySection({ data }: {
    data: ActivityProps | undefined;
}): React.JSX.Element {
    const router = useRouter();
    const [opened, setOpened] = useState(false);
    const [hovered, setHovered] = useState(false);
    const safeData: ActivityProps = data ?? EMPTY_ACTIVITY;
    // Determine if this section should be expanded based on current route
    useEffect(() => {
        if (router.pathname.startsWith('/jobs/')) {
            setOpened(true);
        }
    }, [router.pathname]);

    // Calculate total jobs count for history
    const totalJobs = safeData.active + safeData.queued + safeData.scheduled +
                      safeData.failed + safeData.completed + safeData.outOfSync;

    // Navigation is handled by the ActiveNavItem component
    return (<Stack gap={0} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      <ActiveNavItem icon={<IconClock size={16}/>} label="Activity" href="/jobs/active"/>

      <Collapse in={opened || hovered}>
        <Stack gap={0}>
          <ActiveNavItem icon={<IconRefresh size={16}/>} label="Jobs" color="teal" count={safeData.active + safeData.queued} href="/jobs/active" nested/>


          <ActiveNavItem icon={<IconClock size={16}/>} label="History" count={totalJobs} href="/jobs/history" nested/>


          <ActiveNavItem icon={<IconArrowRight size={16}/>} label="Conversions" color="teal" count={safeData.conversions} href="/jobs/conversion" nested/>


        </Stack>
      </Collapse>
    </Stack>);
}
/**
 * Main navigation component for Kaizoku application
 *
 * Provides the primary navigation interface with:
 * - Library management
 * - Activity monitoring
 * - System settings
 * - Task tracking
 * - Events panel
 *
 * Features:
 * - Responsive design
 * - Collapsible sections
 * - Real-time activity updates
 * - Error handling
 */
export function KaizokuNavbar(): React.JSX.Element {
    const router = useRouter();
    const { status: authStatus } = useSession();
    const isAuthenticated = authStatus === 'authenticated';
    const [settingsOpened, setSettingsOpened] = useState(false);
    const [wantedOpened, setWantedOpened] = useState(false);
    const [systemOpened, setSystemOpened] = useState(false);
    // Fetch activity data with tRPC - only when authenticated
    const activityQuery = trpc.activity.query.useQuery(undefined, {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes — prevent activity data accumulating in cache
        refetchOnWindowFocus: false,
        enabled: isAuthenticated, // Only fetch when authenticated
    });
    const activityData: ActivityProps = (activityQuery.data as ActivityProps | undefined) ?? EMPTY_ACTIVITY;
    // Handle activity query error with useEffect - only log non-auth errors
    useEffect(() => {
        if (activityQuery.error && isAuthenticated) {
            logger.error('Activity query failed:', activityQuery.error);
        }
    }, [activityQuery.error, isAuthenticated]);
    // Determine if sections should be expanded based on current route
    useEffect(() => {
        if (router.pathname.startsWith('/settings/')) {
            setSettingsOpened(true);
        }
        if (router.pathname.startsWith('/wanted/')) {
            setWantedOpened(true);
        }
        if (router.pathname.startsWith('/system/')) {
            setSystemOpened(true);
        }
    }, [router.pathname]);
    // Styles for the navbar content - AppShell.Navbar wrapper is provided by ResponsiveMainLayout
    const navbarContentStyles = {
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        position: 'relative' as const,
        fontSize: 'var(--mantine-font-size-xs)',
        paddingRight: 'var(--mantine-spacing-xs)'
    };
    // Note: AppShell.Navbar wrapper is provided by ResponsiveMainLayout
    // This component now returns just the content
    return (
      <Box style={navbarContentStyles}>
        <Stack gap={0}>
          <ActiveNavItem icon={<IconHome size={18}/>} label="Home" href="/" exact={true}/>
          <LibrarySection />
          {!isAuthenticated ?
            <ActiveNavItem icon={<IconUsers size={16}/>} label="Login" href="/login" /> :
            activityQuery.isLoading ?
            <Text c="dimmed" ta="center" py="md">Loading activity data...</Text> :
            activityQuery.error ?
                <Text c="red" ta="center" py="md">Error loading activity data</Text> :
                <>
              <ActiveNavItem icon={<IconCalendarStats size={16}/>} label="Calendar" href="/calendar"/>


              <ActivitySection data={activityData}/>
              <Stack gap={0} onMouseEnter={() => setWantedOpened(true)} onMouseLeave={() => setWantedOpened(false)}>

                <ActiveNavItem icon={<IconAlertCircle size={16}/>} label="Wanted" href="/wanted"/>

                <Collapse in={wantedOpened}>
                  <Stack gap={0}>
                    <ActiveNavItem icon={<IconSearch size={16}/>} label="Missing" href="/wanted/missing" nested/>


                    <ActiveNavItem icon={<IconAlertCircle size={16}/>} label="Blocklist" href="/wanted/blocklist" nested/>


                  </Stack>
                </Collapse>
              </Stack>
              
              <Stack gap={0} onMouseEnter={() => setSystemOpened(true)} onMouseLeave={() => setSystemOpened(false)}>

                <ActiveNavItem icon={<IconTools size={16}/>} label="System" href="/system/status"/>

                <Collapse in={systemOpened}>
                  <Stack gap={0}>
                    <ActiveNavItem icon={<IconActivity size={16}/>} label="Status" href="/system/status" nested/>

                    <ActiveNavItem icon={<IconDeviceFloppy size={16}/>} label="Backup & Restore" href="/system/backup" nested/>

                    <ActiveNavItem icon={<IconRefresh size={16}/>} label="Updates" href="/system/updates" nested/>

                    <ActiveNavItem icon={<IconPalette size={16}/>} label="Appearance" href="/system/appearance" nested/>

                    <ActiveNavItem icon={<IconCalendarStats size={16}/>} label="Events" href="/system/events" nested/>

                    <ActiveNavItem icon={<IconFile size={16}/>} label="Log Files" href="/system/logs" nested/>

                    {/* Annotation is an ML training-data editor used only during model
                        development; hidden in production builds. Direct URL access is
                        also gated by the page-level NODE_ENV check. */}
                    {process.env.NODE_ENV !== 'production' && (
                      <ActiveNavItem icon={<IconDatabase size={16}/>} label="Annotation" href="/annotation" nested/>
                    )}

                    <ActiveNavItem icon={<IconUsers size={16}/>} label="Users" href="/system/users" nested/>
                  </Stack>
                </Collapse>
              </Stack>

              <Stack gap={0} onMouseEnter={() => setSettingsOpened(true)} onMouseLeave={() => setSettingsOpened(false)}>

                <ActiveNavItem icon={<IconSettings size={16}/>} label="Settings" href="/settings/events"/>

                <Collapse in={settingsOpened}>
                  <Stack gap={0}>
                    <ActiveNavItem icon={<IconClock size={16}/>} label="Events" href="/settings/events" nested/>


                    <ActiveNavItem icon={<IconFolderPlus size={16}/>} label="Media Management" href="/settings/media-management" nested/>


                    <ActiveNavItem icon={<IconSearch size={16}/>} label="Indexers" href="/settings/indexers" nested/>


                    <ActiveNavItem icon={<IconDownload size={16}/>} label="Download Clients" href="/settings/download-clients" nested/>


                    <ActiveNavItem icon={<IconDatabase size={16}/>} label="Metadata" href="/settings/metadata" nested/>


                    <ActiveNavItem icon={<IconArrowRight size={16}/>} label="File Conversion" href="/settings/file-conversion" nested/>

                    <ActiveNavItem icon={<IconPlugConnected size={16}/>} label="Integrations" href="/settings/integrations" nested/>

                    <ActiveNavItem icon={<IconShieldCheck size={16}/>} label="FlareSolverr" href="/settings/flaresolverr" nested/>

                    <ActiveNavItem icon={<IconBooks size={16}/>} label="Import Manga" href="/settings/library" nested/>

                    <ActiveNavItem icon={<IconPhoto size={16}/>} label="Living Covers" href="/settings/living-covers" nested/>

                  </Stack>
                </Collapse>
              </Stack>
            </>}
        </Stack>
        <EventsPanel />
      </Box>
    );
}
