import { useState, useCallback, useMemo, useEffect } from 'react';
import React from 'react';

import { startOfMonth, endOfMonth} from 'date-fns';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { CalendarFilters } from '@/store/calendarSlice';
import { toNumberId } from "@/utils/id-converters";
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import type { CalendarEvent, ReleaseSchedule } from '@prisma/client';

/**
 * Calendar Hook
 *
 * Custom React hook for managing calendar state and operations.
 * Provides a unified interface for calendar events and schedules.
 *
 * @module hooks/useCalendar
 */

export interface UseCalendarOptions {
  initialDate?: Date;
  defaultFilters?: Partial<CalendarFilters>;
  autoSync?: boolean;
}
export interface UseCalendarReturn {
  // Data
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
  stats: {
    upcomingCount: number;
    delayedCount: number;
    nextRelease: CalendarEvent | null;
  } | undefined;

  // Loading states
  isLoading: boolean;

  // Current state
  currentDate: Date;
  filters: CalendarFilters;

  // Actions
  navigate: (date: Date) => void;
  updateFilters: (filters: Partial<CalendarFilters>) => void;
  refresh: () => void;

  // Schedule management
  getSchedule: (mangaId: number) => ReleaseSchedule | null;
  updateSchedule: (mangaId: number, schedule: unknown) => Promise<void>;
}

/**
 * Hook for managing calendar functionality
 */
export function useCalendar(options: UseCalendarOptions = {}): UseCalendarReturn {
  const {
    initialDate = new Date(),
    defaultFilters = {},
    autoSync = false
  } = options;

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  const now = new Date();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [filters, setFilters] = useState<CalendarFilters>(() => ({
    selectedManga: [],
    statusFilter: [],
    dateRange: {
      start: startOfMonth(now),
      end: endOfMonth(now)
    },
    showConfirmed: true,
    showDelayed: true,
    ...defaultFilters
  }));

  // Calculate date range for current view
  const dateRange = useMemo(() => ({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  }), [currentDate]);

  // Prepare query filters
  const queryFilters = useMemo(() => {
    const result: {
      mangaIds?: number[];
      status?: ('SCHEDULED' | 'RELEASED' | 'DELAYED' | 'CANCELLED' | 'CONFIRMED')[];
    } = {};

    if (filters.selectedManga.length > 0) {
      result.mangaIds = filters.selectedManga;
    }

    if (filters.statusFilter.length > 0) {
      result.status = filters.statusFilter as ('SCHEDULED' | 'RELEASED' | 'DELAYED' | 'CANCELLED' | 'CONFIRMED')[];
    }

    return result;
  }, [filters.selectedManga, filters.statusFilter]);

  // Fetch calendar events with WebSocket + polling fallback
  const eventsQuery = trpc.calendar.getEvents.useQuery({
    start: dateRange.start,
    end: dateRange.end,
    filters: queryFilters
  }, {
    enabled: true,
    // Only poll when autoSync enabled AND WebSocket disconnected
    refetchInterval: autoSync && !isConnected ? 60000 : false
  });

  // Subscribe to WebSocket calendar events for real-time updates (when autoSync enabled)
  useEffect(() => {
    if (!isConnected || !autoSync) return;

    const unsubscribe = subscribe('calendar:updated', () => {
      void eventsQuery.refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, autoSync, eventsQuery]);

  // Fetch upcoming releases
  const upcomingQuery = trpc.calendar.getUpcomingReleases.useQuery({
    days: 7
  });

  // Fetch calendar statistics
  const statsQuery = trpc.calendar.getStatistics.useQuery({});

  const updateScheduleMutation = trpc.calendar.updateSchedule.useMutation();
  React.useEffect(() => {
    if (updateScheduleMutation.isSuccess) {
      notify({ severity: 'SUCCESS', title: 'Schedule Updated', message: 'Release schedule has been saved' });
      void eventsQuery.refetch();
    }
  }, [updateScheduleMutation.isSuccess, eventsQuery]);
  React.useEffect(() => {
    if (updateScheduleMutation.isError) {
      notify({ severity: 'ERROR', title: 'Update Failed', message: updateScheduleMutation.error instanceof Error ? updateScheduleMutation.error.message : 'Update failed' });
    }
  }, [updateScheduleMutation.isError, updateScheduleMutation.error]);

  // Navigation
  const navigate = useCallback((date: Date): void => {
    setCurrentDate(date);
  }, []);

  // Filter updates
  const updateFilters = useCallback((newFilters: Partial<CalendarFilters>): void => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Refresh data
  const refresh = useCallback((): void => {
    void eventsQuery.refetch();
    void upcomingQuery.refetch();
    void statsQuery.refetch();
  }, [eventsQuery, upcomingQuery, statsQuery]);

  // Get schedule for a specific manga
  const getSchedule = useCallback((_mangaId: number): ReleaseSchedule | null => {
    // TODO: Implement schedule lookup from cache or query
    return null;
  }, []);

  // Update schedule for a specific manga
  const updateSchedule = useCallback(async (mangaId: number, schedule: unknown): Promise<void> => {
    await updateScheduleMutation.mutateAsync({
      mangaId,
      schedule: schedule as Parameters<typeof updateScheduleMutation.mutateAsync>[0]['schedule']
    });
  }, [updateScheduleMutation]);

  return {
    // Data
    events: eventsQuery.data ?? [],
    upcoming: upcomingQuery.data ?? [],
    stats: statsQuery.data ? {
      upcomingCount: statsQuery.data.totalEvents,
      delayedCount: statsQuery.data.delayedEvents,
      nextRelease: null // TODO: Extract from upcoming events
    } : undefined,
    // Loading states
    isLoading: eventsQuery.isLoading || upcomingQuery.isLoading,
    // Current state
    currentDate,
    filters,
    // Actions
    navigate,
    updateFilters,
    refresh,
    getSchedule,
    updateSchedule
  };
}

/**
 * Hook for managing manga-specific calendar data
 */
export function useMangaCalendar(mangaId: number | string): {
  schedule: ReleaseSchedule | undefined;
  events: CalendarEvent[];
  isLoading: boolean;
  refetch: () => void;
} {
  const numericId = toNumberId(mangaId);
  const scheduleQuery = trpc.calendar.getSchedule.useQuery({
    mangaId: numericId
  });
  const now = new Date();
  const eventsQuery = trpc.calendar.getEvents.useQuery({
    start: now,
    end: new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()),
    filters: {
      mangaIds: [numericId]
    }
  });

  return {
    schedule: scheduleQuery.data ?? undefined,
    events: eventsQuery.data ?? [],
    isLoading: scheduleQuery.isLoading || eventsQuery.isLoading,
    refetch: () => {
      void scheduleQuery.refetch();
      void eventsQuery.refetch();
    }
  };
}
