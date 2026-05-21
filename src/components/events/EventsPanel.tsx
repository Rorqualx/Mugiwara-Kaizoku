/**
 * Events Panel Component
 *
 * Compact summary of current system activity shown at the bottom of the navbar.
 * Sections:
 *  - Live job counts (active / queued / scheduled / failed / outOfSync) — each
 *    clickable, routes to the filtered jobs page. Counts auto-dismiss 10s
 *    after their last change so the panel stays uncluttered when idle.
 *  - DownloadFeed (existing per-download progress widget).
 *  - Recent API calls (last 10s).
 *  - Tracked-download state transitions (live, last 3, 30s window).
 *
 * Notifications (Metadata Refreshed / Series Download Started / per-chapter
 * rolling rows) live exclusively in the top-right bell dropdown — duplicating
 * them here was just noise.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import {
  IconApi,
  IconAlertTriangle,
  IconClock,
  IconDownload,
  IconInfoCircle,
  IconList,
} from '@tabler/icons-react';
import Link from 'next/link';

import type { ApiCallInfo } from '@/components/apiCallAlert';
import { DownloadFeed } from '@/components/events/DownloadFeed';
import { useEvents } from '@/hooks/useEvents';
import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { isError } from '@/utils/async-result';
import { JobStatus } from '@/utils/job-validation';


// Import the CSS module for styling
import classes from "./EventsPanel.module.css";

interface TrackedDownloadTransition {
  id: string;
  releaseTitle: string;
  previousState: string;
  newState: string;
  at: number;
}

interface TrackedTransitionPayload {
  id?: string;
  previousState?: string;
  newState?: string;
  releaseTitle?: string;
}

function isTrackedTransitionPayload(data: unknown): data is TrackedTransitionPayload {
  return typeof data === 'object' && data !== null;
}

export interface EventsPanelProps {
    /** Additional CSS class to apply to the panel */
    className?: string;
}

export function isValidApiCallStatus(status: unknown): status is 'success' | 'error' | 'pending' {
    return status === 'success' || status === 'error' || status === 'pending';
}

export function getStatusColor(status: string): string {
    if (isValidApiCallStatus(status)) {
        return status === 'success' ? 'green' : status === 'error' ? 'red' : 'blue';
    }
    return 'gray';
}

interface CountRowProps {
    icon: React.ReactNode;
    label: string;
    href: string;
}

function CountRow({ icon, label, href }: CountRowProps): React.ReactElement {
    return (
        <UnstyledButton component={Link} href={href} className={classes.event} style={{ width: '100%' }}>
            <Group gap="xs">
                {icon}
                <Text size="sm">{label}</Text>
            </Group>
        </UnstyledButton>
    );
}

export function EventsPanel({ className = '' }: EventsPanelProps): React.ReactElement {
    const { subscribe } = useRealTime();

    const { countsResult, active, queued, scheduled, failed, outOfSync, apiCalls, isLoading: eventsLoading } = useEvents();

    // Auto-dismiss: track when each activity count last changed
    const DISMISS_MS = 10_000;
    const prevCountsRef = useRef<Record<string, number>>({});
    const countShowTimesRef = useRef<Record<string, number>>({});
    const [_tick, setTick] = useState(0);

    useEffect(() => {
        const current: Record<string, number> = { active, queued, scheduled, failed, outOfSync };
        const prev = prevCountsRef.current;
        const now = Date.now();
        for (const [key, value] of Object.entries(current)) {
            if (value > 0 && value !== (prev[key] ?? 0)) {
                countShowTimesRef.current[key] = now;
            } else if (value === 0) {
                delete countShowTimesRef.current[key];
            }
        }
        prevCountsRef.current = current;
    }, [active, queued, scheduled, failed, outOfSync]);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 2000);
        return (): void => { clearInterval(interval); };
    }, []);

    const isCountVisible = (key: string, value: number): boolean => {
        if (value <= 0) return false;
        const showTime = countShowTimesRef.current[key];
        if (!showTime) return false;
        return Date.now() - showTime < DISMISS_MS;
    };

    const recentApiCalls = apiCalls.filter(
        (call: ApiCallInfo) => Date.now() - call.timestamp.getTime() < DISMISS_MS
    );
    const hasRecentApiCalls = recentApiCalls.length > 0;

    // Tracked-download state transitions — keep latest 3. Pending updates are
    // batched into a 500ms tick to avoid render storms when a multi-chapter
    // pack lands and fires dozens of transitions in a tight window.
    const [trackedTransitions, setTrackedTransitions] = useState<TrackedDownloadTransition[]>([]);
    const pendingTransitionsRef = useRef<TrackedDownloadTransition[]>([]);
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTrackedTransition = useCallback((event: WebSocketEvent) => {
        if (!isTrackedTransitionPayload(event.data)) return;
        const { id, previousState, newState, releaseTitle } = event.data;
        if (!id || !newState) return;
        pendingTransitionsRef.current.push({
            id,
            releaseTitle: releaseTitle ?? id,
            previousState: previousState ?? '',
            newState,
            at: Date.now(),
        });
        flushTimerRef.current ??= setTimeout(() => {
            flushTimerRef.current = null;
            const batch = pendingTransitionsRef.current.splice(0);
            if (batch.length === 0) return;
            setTrackedTransitions((prev) => [...batch.reverse(), ...prev].slice(0, 3));
        }, 500);
    }, []);

    useEffect(() => {
        const unsub = subscribe('tracked-downloads:state', handleTrackedTransition);
        return () => {
            unsub();
            if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
        };
    }, [subscribe, handleTrackedTransition]);

    // Age out tracked transitions after 30s — they're meant as a live feed.
    useEffect(() => {
        if (trackedTransitions.length === 0) return undefined;
        const t = setTimeout(() => {
            setTrackedTransitions((prev) => prev.filter((tr) => Date.now() - tr.at < 30_000));
        }, 5000);
        return () => clearTimeout(t);
    }, [trackedTransitions]);

    if (isError(countsResult)) {
        return (
            <Box className={`${classes.container} ${className}`}>
                <Group gap="xs" className={classes.event}>
                    <IconAlertTriangle size={16} color="var(--mantine-color-red-6)"/>
                    <Text size="sm">Error loading activity: {countsResult.error instanceof Error ? countsResult.error.message : String(countsResult.error)}</Text>
                </Group>
            </Box>
        );
    }

    // active + failed counts live in the top-right bell dropdown now — the
    // sidebar surfaces only in-flight job activity (queued / scheduled /
    // outOfSync) plus API + tracked-download events.
    const hasActivity: boolean = isCountVisible('queued', queued)
        || isCountVisible('scheduled', scheduled)
        || isCountVisible('outOfSync', outOfSync) || hasRecentApiCalls;

    return (
        <Box className={`${classes.container} ${hasActivity ? classes.containerActive : ""} ${className}`}>

            {eventsLoading && (
                <Group gap="xs" className={classes.event}>
                    <IconClock size={16} color="var(--mantine-color-blue-5)"/>
                    <Text size="sm">Loading activity data...</Text>
                </Group>
            )}

            {isCountVisible('queued', queued) && (
                <CountRow
                    icon={<IconList size={16} color="var(--mantine-color-gray-6)"/>}
                    label={`${queued} queued tasks`}
                    href="/jobs/active?status=queued"
                />
            )}

            {isCountVisible('scheduled', scheduled) && (
                <CountRow
                    icon={<IconClock size={16} color="var(--mantine-color-indigo-6)"/>}
                    label={`${scheduled} ${JobStatus.pending} tasks`}
                    href="/jobs/active?status=scheduled"
                />
            )}

            {isCountVisible('outOfSync', outOfSync) && (
                <CountRow
                    icon={<IconInfoCircle size={16} color="var(--mantine-color-yellow-6)"/>}
                    label={`${outOfSync} ${JobStatus.pending} chapters`}
                    href="/jobs/active"
                />
            )}

            <DownloadFeed />

            {recentApiCalls.map((call: ApiCallInfo) => (
                <Group key={call.id} gap="xs" className={classes.event}>
                    <IconApi size={16} color={`var(--mantine-color-${isValidApiCallStatus(call.status) ? getStatusColor(call.status) : 'gray'}-6)`}/>
                    <Text size="sm" style={{ wordBreak: 'break-word' }}>
                        {call.endpoint}: {call.status}
                    </Text>
                </Group>
            ))}

            {trackedTransitions.length > 0 && (
                <>
                    {trackedTransitions.map((tr) => (
                        <Group key={`${tr.id}-${tr.at}`} gap="xs" className={classes.event} wrap="nowrap">
                            <IconDownload size={14} color="var(--mantine-color-cyan-6)" />
                            <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                                {tr.previousState ? `${tr.previousState} → ${tr.newState}` : tr.newState} · {tr.releaseTitle}
                            </Text>
                        </Group>
                    ))}
                </>
            )}

        </Box>
    );
}
