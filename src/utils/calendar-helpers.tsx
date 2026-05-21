/**
 * Calendar Helper Functions
 *
 * Utility functions to reduce complexity in calendar.tsx by extracting:
 * - View control data preparation
 * - Grid layout calculations
 * - Filter preparation logic
 * - Event filtering logic
 */

import React from 'react';
import type { ReactNode } from 'react';

import { Tooltip } from '@mantine/core';

import type { CalendarEvent } from '@prisma/client';

/**
 * Filter state interface matching calendar store
 */
export interface CalendarFilters {
  selectedManga: number[];
  statusFilter: string[];
  showConfirmed: boolean;
  showDelayed: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
}

/**
 * View control data item for SegmentedControl
 */
export interface ViewControlDataItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * Generate view control data for SegmentedControl
 * Extracts complex nested object structure with conditional spreads
 *
 * @param isMobile - Whether the device is mobile
 * @param viewIcons - Icon mapping for each view
 * @returns Array of view control data items
 */
export function getViewControlData(
  isMobile: boolean,
  viewIcons: Record<string, ReactNode>
): ViewControlDataItem[] {
  return [
    {
      value: 'month',
      label: (
        <Tooltip label="Month View" disabled={isMobile}>
          {viewIcons['month']}
        </Tooltip>
      ),
      ...(isMobile && { disabled: true }),
    },
    {
      value: 'week',
      label: (
        <Tooltip label="Week View" disabled={isMobile}>
          {viewIcons['week']}
        </Tooltip>
      ),
      ...(isMobile && { disabled: true }),
    },
    {
      value: 'agenda',
      label: (
        <Tooltip label="Agenda View" disabled={isMobile}>
          {viewIcons['agenda']}
        </Tooltip>
      ),
    },
    {
      value: 'list',
      label: (
        <Tooltip label="List View">{viewIcons['list']}</Tooltip>
      ),
    },
  ];
}

/**
 * Calculate grid column span based on panel states
 * Simplifies nested ternary: isFilterPanelOpen ? 8 : isTablet ? 12 : 9
 *
 * @param isFilterPanelOpen - Whether filter panel is open
 * @param isTablet - Whether device is tablet size
 * @returns Column span number
 */
export function getGridColumnSpan(
  isFilterPanelOpen: boolean,
  isTablet: boolean
): number {
  if (isFilterPanelOpen) return 8;
  if (isTablet) return 12;
  return 9;
}

/**
 * Prepare query filters for tRPC calendar.getEvents query
 * Extracts conditional filter assignment logic
 *
 * @param filters - Calendar filter state
 * @returns Prepared filter object for query
 */
export function prepareQueryFilters(filters: CalendarFilters): {
  mangaIds?: number[];
  status?: ('SCHEDULED' | 'RELEASED' | 'DELAYED' | 'CANCELLED' | 'CONFIRMED')[];
} {
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
}

/**
 * Filter events based on calendar filter settings
 * Extracts useMemo filter logic from main component
 *
 * @param events - Raw calendar events
 * @param filters - Calendar filter state
 * @returns Filtered calendar events
 */
export function filterCalendarEvents(
  events: CalendarEvent[] | undefined,
  filters: CalendarFilters
): CalendarEvent[] {
  if (!events) return [];

  return events.filter((event) => {
    // Filter confirmed events
    if (!filters.showConfirmed && event['status'] === 'CONFIRMED') {
      return false;
    }

    // Filter delayed events
    if (!filters.showDelayed && event['status'] === 'DELAYED') {
      return false;
    }

    return true;
  });
}

/**
 * Get responsive size values
 * Consolidates multiple inline ternaries for sizes
 *
 * @param isMobile - Whether device is mobile
 * @returns Object with responsive size values
 */
export function getResponsiveSizes(isMobile: boolean): {
  size: 'xs' | 'sm';
  padding: 'xs' | 'md';
  iconSize: 24 | 28;
  titleOrder: 2 | 3;
} {
  return {
    size: isMobile ? 'xs' : 'sm',
    padding: isMobile ? 'xs' : 'md',
    iconSize: isMobile ? 24 : 28,
    titleOrder: isMobile ? 3 : 2,
  };
}
