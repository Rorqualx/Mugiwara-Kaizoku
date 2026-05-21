/**
 * Schedule Helper Functions
 *
 * Utility functions for release schedule display and formatting.
 *
 * @module components/calendar/ReleaseScheduleOverride/schedule-helpers
 */

import { ReleaseType } from '@prisma/client';

/**
 * Day names array
 */
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/**
 * Get the name of a day from its number
 */
export function getDayName(day: number): string {
  return DAYS_OF_WEEK[day] ?? 'Unknown';
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function getOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const remainder = n % 100;
  const suffix = suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0];
  return `${n}${suffix ?? 'th'}`;
}

/**
 * Get human-readable schedule description
 */
export function getScheduleDescription(
  releaseType: ReleaseType,
  dayOfWeek: string,
  dayOfMonth: number,
  weekOfMonth: number
): string {
  const dayNum = parseInt(dayOfWeek, 10);

  switch (releaseType) {
    case ReleaseType.WEEKLY:
      return `Every ${getDayName(dayNum)}`;
    case ReleaseType.BIWEEKLY:
      return `Every other ${getDayName(dayNum)}`;
    case ReleaseType.MONTHLY:
      if (weekOfMonth > 0) {
        return `${getOrdinal(weekOfMonth)} ${getDayName(dayNum)} of each month`;
      }
      return `${getOrdinal(dayOfMonth)} of each month`;
    case ReleaseType.IRREGULAR:
      return 'No regular schedule';
    default:
      return 'Unknown schedule';
  }
}

/**
 * Day of week options for select inputs
 */
export const DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const;

/**
 * Release type options for select inputs
 */
export const RELEASE_TYPE_OPTIONS = [
  { value: ReleaseType.WEEKLY, label: 'Weekly' },
  { value: ReleaseType.BIWEEKLY, label: 'Bi-weekly' },
  { value: ReleaseType.MONTHLY, label: 'Monthly' },
  { value: ReleaseType.IRREGULAR, label: 'Irregular' },
] as const;

/**
 * Week of month options for select inputs
 */
export const WEEK_OPTIONS = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
  { value: '3', label: 'Third' },
  { value: '4', label: 'Fourth' },
  { value: '-1', label: 'Last' },
] as const;

/**
 * Timezone options for select inputs
 */
export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'America/New_York', label: 'Eastern (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
] as const;
