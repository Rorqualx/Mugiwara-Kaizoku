/**
 * Calendar Export Handler
 *
 * Extracted from `routers/calendar.ts` to keep the router under the 500-line
 * cap. Owns the format dispatch (json/rss/ics) and the date-range defaults.
 */

import { CalendarEventService } from '@/server/services/calendar/CalendarEventService';
import { isSuccess, isError } from '@/utils/async-result';
import { generateIcsCalendar, filterEventsForExport } from '@/utils/calendar-ics';
import { generateRssFeed } from '@/utils/calendar-rss';
import { ValidationError } from '@/utils/errors';

export interface ExportCalendarInput {
    format: 'ics' | 'json' | 'rss';
    mangaIds?: number[] | undefined;
    dateRange?: { start?: Date | undefined; end?: Date | undefined } | undefined;
}

export type ExportCalendarResult =
    | { format: 'json'; data: unknown }
    | { format: 'rss'; data: string }
    | { format: 'ics'; data: string };

export async function exportCalendarData(input: ExportCalendarInput): Promise<ExportCalendarResult> {
    const service = new CalendarEventService();
    const startDate = input.dateRange?.start ?? new Date();
    const endDate = input.dateRange?.end ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const result = await service.getEventsForDateRange(
        startDate,
        endDate,
        input.mangaIds ? { mangaIds: input.mangaIds } : undefined,
    );
    if (isError(result)) {
        throw result.error;
    }
    if (!isSuccess(result)) {
        throw new ValidationError('Unknown state in exportCalendar');
    }
    const events = result.data;

    switch (input.format) {
        case 'json':
            return { format: 'json', data: events };
        case 'rss':
            return {
                format: 'rss',
                data: generateRssFeed(events, {
                    title: 'Manga Release Calendar',
                    description: 'Upcoming manga chapter and volume releases',
                }),
            };
        case 'ics':
        default: {
            // Past events are kept (download history is useful) but cancelled
            // events are dropped — they'd just clutter the user's calendar app.
            const exportEvents = filterEventsForExport(events, {
                includeCancelled: false,
                includePast: true,
            });
            const icsResult = generateIcsCalendar(exportEvents, {
                calendarName: 'Manga Release Calendar',
                description: 'Upcoming manga chapter and volume releases',
                includeConfidence: true,
                includeDescriptions: true,
            });
            if (!icsResult.success) {
                throw new ValidationError(icsResult.error ?? 'Failed to generate ICS calendar');
            }
            return { format: 'ics', data: icsResult.value ?? '' };
        }
    }
}
