/**
 * Calendar Export Modal Component
 *
 * Modal dialog for exporting calendar events in various formats.
 * Provides options for format selection, date range, and filtering.
 *
 * @module components/calendar/CalendarExportModal
 */
import React, { useState } from 'react';

import { Modal, Stack, Radio, Group, Text, Button, Select, Alert, Paper, Divider } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { IconDownload, IconCalendar, IconFile, IconInfoCircle } from '@tabler/icons-react';

import { useCalendarStore } from '@/store/calendarSlice';
import { exportCalendarEvents } from '@/utils/calendar-export';
import type { ExportOptions } from '@/utils/calendar-export';
import { trpc } from '@/utils/trpc-client/index';
/**
 * Calendar Export Modal Props
 */
interface CalendarExportModalProps {
    opened: boolean;
    onClose: () => void;
}
/**
 * Format option interface
 */
interface FormatOption {
    value: ExportOptions['format'];
    label: string;
    icon: React.ReactNode;
    description: string;
}
/**
 * Calendar Export Modal Component
 */
export function CalendarExportModal({ opened, onClose }: CalendarExportModalProps): React.ReactElement {
    const { exportPrefs, setExportFormat, setExportDateRange } = useCalendarStore();
    const [dateRange, setDateRange] = useState<[
        Date | null,
        Date | null
    ]>([
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ]);
    const [isExporting, setIsExporting] = useState(false);
    // Fetch events for export
    const now = new Date();
    const startDate = exportPrefs.dateRange === 'all' ?
        new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) :
        now;
    const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const { data: events } = trpc.calendar.getEvents.useQuery({
        start: startDate,
        end: endDate,
        filters: {}
    });
    // Format options
    const formatOptions: FormatOption[] = [
        {
            value: 'ical',
            label: 'iCal (.ics)',
            icon: <IconCalendar size={20}/>,
            description: 'Compatible with Apple Calendar, Outlook, and other calendar apps'
        },
        {
            value: 'google',
            label: 'Google Calendar',
            icon: <IconCalendar size={20} style={{ color: '#4285F4' }}/>,
            description: 'Add directly to Google Calendar (single event) or import multiple'
        },
        {
            value: 'csv',
            label: 'CSV (.csv)',
            icon: <IconFile size={20}/>,
            description: 'Spreadsheet format for Excel, Google Sheets'
        },
        {
            value: 'json',
            label: 'JSON (.json)',
            icon: <IconFile size={20}/>,
            description: 'Raw data format for developers and integrations'
        }
    ];
    // Date range options
    const dateRangeOptions = [
        { value: 'all', label: 'All Events' },
        { value: 'upcoming', label: 'Next 30 Days' },
        { value: 'custom', label: 'Custom Range' }
    ];
    // Handle export
    const handleExport = async (): Promise<void> => {
        if (!events || events.length === 0) {
            showNotification({
                title: 'No Events',
                message: 'No calendar events to export',
                color: 'yellow'
            });
            return;
        }
        setIsExporting(true);
        try {
            const options: ExportOptions = {
                format: exportPrefs.format,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            // Add date range if custom
            if (exportPrefs.dateRange === 'custom' && dateRange[0] && dateRange[1]) {
                options.dateRange = {
                    start: dateRange[0],
                    end: dateRange[1]
                };
            }
            else if (exportPrefs.dateRange === 'upcoming') {
                options.dateRange = {
                    start: new Date(),
                    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                };
            }
            await exportCalendarEvents(events, options);
            showNotification({
                title: 'Export Successful',
                message: `Calendar exported as ${exportPrefs.format.toUpperCase()}`,
                color: 'green'
            });
            onClose();
        }
        catch (error: unknown) {
            showNotification({
                title: 'Export Failed',
                message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to export calendar',
                color: 'red'
            });
        }
        finally {
            setIsExporting(false);
        }
    };
    const selectedFormat = formatOptions.find((f) => f.value === exportPrefs.format);
    return (<Modal opened={opened} onClose={() => { void onClose(); }} title="Export Calendar" size="md">

      <Stack gap="md">
        {/* Format Selection */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Export Format
          </Text>
          <Radio.Group value={exportPrefs.format} onChange={(value) => setExportFormat(value as 'ical' | 'csv' | 'json' | 'google')}>

            <Stack gap="xs">
              {formatOptions.map((option) => <Paper key={option.value} p="sm" withBorder>
                  <Radio value={option.value} label={<Group gap="xs">
                        {option.icon}
                        <div>
                          <Text size="sm" fw={500}>{option.label}</Text>
                          <Text size="xs" c="dimmed">{option["description"]}</Text>
                        </div>
                      </Group>}/>

                </Paper>)}
            </Stack>
          </Radio.Group>
        </div>
        
        <Divider />
        
        {/* Date Range */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Date Range
          </Text>
          <Select value={exportPrefs.dateRange} onChange={(value) => setExportDateRange(value as 'all' | 'upcoming' | 'custom')} data={dateRangeOptions} mb="sm"/>

          
          {exportPrefs.dateRange === 'custom' &&
            <DatePickerInput type="range" label="Select date range" placeholder="Pick dates range" value={dateRange} onChange={(value) => {
                    if (value[0] && value[1]) {
                        setDateRange([new Date(value[0]), new Date(value[1])]);
                    }
                }} clearable={false}/>}
        </div>
        
        {/* Format-specific info */}
        {selectedFormat?.value === 'ical' &&
            <Alert icon={<IconInfoCircle size={16}/>} color="blue">
            <Text size="sm">
              The iCal file can be imported into most calendar applications.
            </Text>
          </Alert>}
        
        {selectedFormat?.value === 'google' &&
            <Alert icon={<IconInfoCircle size={16}/>} color="blue">
            <Text size="sm">
              {events?.length === 1 ?
                    'This will open Google Calendar to add the event directly.' :
                    'Multiple events will be exported as an iCal file for import to Google Calendar.'}
            </Text>
          </Alert>}
        
        {/* Event count */}
        {events &&
            <Text size="sm" c="dimmed">
            {events.length} events will be exported
          </Text>}
        
        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { void onClose(); }}>
            Cancel
          </Button>
          <Button leftSection={<IconDownload size={16}/>} onClick={() => { void handleExport(); }} loading={isExporting}>

            Export
          </Button>
        </Group>
      </Stack>
    </Modal>);
}
CalendarExportModal.displayName = 'CalendarExportModal';
