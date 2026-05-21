/**
 * Calendar View Selector Component
 *
 * SegmentedControl for switching between calendar views.
 * Extracted from calendar.tsx to reduce complexity.
 *
 * Supports:
 * - Month, Week, Agenda, List views
 * - Tooltips for each view
 * - Responsive sizing
 * - Mobile view restrictions (month/week disabled on mobile)
 */

import React, { type ReactNode } from 'react';

import { SegmentedControl } from '@mantine/core';

import { getViewControlData, type ViewControlDataItem } from '@/utils/calendar-helpers';

/**
 * Calendar view type
 */
export type CalendarView = 'month' | 'week' | 'agenda' | 'list';

/**
 * Props for CalendarViewSelector component
 */
export interface CalendarViewSelectorProps {
  /** Current view */
  view: CalendarView;
  /** Callback when view changes */
  onViewChange: (view: CalendarView) => void;
  /** Whether device is mobile */
  isMobile: boolean;
  /** Icon mapping for each view type */
  viewIcons: Record<string, ReactNode>;
}

/**
 * Calendar View Selector
 *
 * Provides a segmented control for switching between different calendar views.
 * Automatically handles mobile restrictions and tooltips.
 *
 * @param props - Component props
 * @returns SegmentedControl for view selection
 */
export function CalendarViewSelector({
  view,
  onViewChange,
  isMobile,
  viewIcons,
}: CalendarViewSelectorProps): React.JSX.Element {
  // Get view control data from helper
  const viewData: ViewControlDataItem[] = getViewControlData(isMobile, viewIcons);

  return (
    <SegmentedControl
      value={view}
      onChange={(value) => onViewChange(value as CalendarView)}
      size={isMobile ? 'xs' : 'sm'}
      data={viewData}
    />
  );
}
