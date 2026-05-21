/**
 * Calendar Components Index
 * 
 * Central export point for all calendar-related components.
 * 
 * @module components/calendar
 */

export { CalendarFilterPanel } from './CalendarFilterPanel';
export { CalendarExportModal } from './CalendarExportModal';
export { CalendarEventModal } from './CalendarEventModal';
export { CalendarListView } from './CalendarListView';
export { ReleaseScheduleOverride } from './ReleaseScheduleOverride';
export { ManualScheduleOverrideForm } from './ManualScheduleOverrideForm';

// Extracted components for complexity reduction
export { CalendarStatisticsBar } from './CalendarStatisticsBar';
export { CalendarViewSelector } from './CalendarViewSelector';
export { CalendarViewOptionsMenu } from './CalendarViewOptionsMenu';
export { UpcomingReleasesSidebar } from './UpcomingReleasesSidebar';

// Error handling components
export {
  CalendarErrorFallback,
  CalendarListErrorFallback,
  CalendarSidebarErrorFallback,
  CalendarInlineError,
} from './CalendarErrorFallback';

// Re-export types
export type { CalendarStats } from './CalendarStatisticsBar';
export type { CalendarView } from './CalendarViewSelector';
export type { ColorScheme } from './CalendarViewOptionsMenu';
