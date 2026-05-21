/**
 * Manual Schedule Override Form
 * 
 * UI component for manually setting release schedules when automatic
 * detection fails or needs correction.
 * 
 * Following project conventions:
 * - Mantine v7 components
 * - Relative imports
 * - Type-safe implementations
 */

import React, { useState } from 'react';

import { Modal, Button, Select, NumberInput, TextInput, Group, Stack, Text, Alert, Radio } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCalendar, IconInfoCircle, IconCalendarOff } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

// Define enum locally as a fallback if import fails
const ReleaseScheduleTypeLocal = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  IRREGULAR: 'IRREGULAR'
} as const;

// Use local ReleaseScheduleType enum
const ReleaseScheduleType = ReleaseScheduleTypeLocal;

interface ManualScheduleOverrideFormProps {
  mangaId: number;
  mangaTitle: string;
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ManualScheduleOverrideForm({
  mangaId,
  mangaTitle,
  opened,
  onClose,
  onSuccess
}: ManualScheduleOverrideFormProps): React.ReactElement {
  const [overrideType, setOverrideType] = useState<'schedule' | 'next_release' | 'hiatus'>('schedule');
  const [releaseType, setReleaseScheduleType] = useState<string>(
    ReleaseScheduleType.WEEKLY
  );
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [nextReleaseDate, setNextReleaseDate] = useState<Date | null>(null);
  const [hiatusStartDate, setHiatusStartDate] = useState<Date | null>(new Date());
  const [hiatusEndDate, setHiatusEndDate] = useState<Date | null>(null);
  const [hiatusReason, setHiatusReason] = useState<string>('');
  const applyOverrideMutation = trpc.calendar.updateSchedule.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Manual schedule override applied successfully' });
      onSuccess?.();
      onClose();
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Error', message: `Failed to apply override: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}` });
    }
  });
  const handleSubmit = (): void => {
    // Convert manual override to updateSchedule mutation format
    const schedule: Record<string, unknown> = {
      releaseType,
      timezone,
      isConfirmed: true,
      confidence: 1,
      source: 'manual'
    };
    if (overrideType === 'schedule') {
      const weekly = ReleaseScheduleType.WEEKLY;
      const biweekly = ReleaseScheduleType.BIWEEKLY;
      const monthly = ReleaseScheduleType.MONTHLY;

      if (releaseType === weekly || releaseType === biweekly) {
        schedule['dayOfWeek'] = dayOfWeek;
      } else if (releaseType === monthly) {
        schedule['dayOfMonth'] = dayOfMonth;
      }
    } else if (overrideType === 'hiatus') {
      schedule['releaseType'] = ReleaseScheduleType.IRREGULAR; // HIATUS is not in the enum, using IRREGULAR
    }
    void applyOverrideMutation.mutateAsync({
      mangaId,
      schedule: schedule as Record<string, unknown>
    });
  };
  const dayOfWeekOptions = [{
    value: '0',
    label: 'Sunday'
  }, {
    value: '1',
    label: 'Monday'
  }, {
    value: '2',
    label: 'Tuesday'
  }, {
    value: '3',
    label: 'Wednesday'
  }, {
    value: '4',
    label: 'Thursday'
  }, {
    value: '5',
    label: 'Friday'
  }, {
    value: '6',
    label: 'Saturday'
  }];
  const releaseTypeOptions = [{
    value: ReleaseScheduleType.WEEKLY,
    label: 'Weekly'
  }, {
    value: ReleaseScheduleType.BIWEEKLY,
    label: 'Bi-weekly'
  }, {
    value: ReleaseScheduleType.MONTHLY,
    label: 'Monthly'
  }, {
    value: ReleaseScheduleType.IRREGULAR,
    label: 'Irregular'
  }];
  const timezoneOptions = [{
    value: 'UTC',
    label: 'UTC'
  }, {
    value: 'America/New_York',
    label: 'Eastern Time'
  }, {
    value: 'America/Chicago',
    label: 'Central Time'
  }, {
    value: 'America/Los_Angeles',
    label: 'Pacific Time'
  }, {
    value: 'Europe/London',
    label: 'London'
  }, {
    value: 'Europe/Paris',
    label: 'Central Europe'
  }, {
    value: 'Asia/Tokyo',
    label: 'Japan Time'
  }, {
    value: 'Asia/Seoul',
    label: 'Korea Time'
  }];
  return <Modal opened={opened} onClose={onClose} title="Manual Schedule Override" size="md">

      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">

          <Text size="sm">
            Set a manual release schedule for "{mangaTitle}" when automatic detection
            doesn't work correctly.
          </Text>
        </Alert>
        
        <Radio.Group value={overrideType} onChange={value => setOverrideType(value as typeof overrideType)} label="Override Type">

          <Stack gap="xs" mt="xs">
            <Radio value="schedule" label="Set Regular Schedule" />
            <Radio value="next_release" label="Set Next Release Date" />
            <Radio value="hiatus" label="Mark as On Hiatus" />
          </Stack>
        </Radio.Group>
        
        {overrideType === 'schedule' && <>
            <Select label="Release Pattern" value={releaseType} onChange={value => setReleaseScheduleType(value ?? '')} data={releaseTypeOptions} required />

            
            {(releaseType === ReleaseScheduleType.WEEKLY || releaseType === ReleaseScheduleType.BIWEEKLY) && <Select label="Day of Week" value={String(dayOfWeek)} onChange={value => setDayOfWeek(Number(value))} data={dayOfWeekOptions} required />}

            {releaseType === ReleaseScheduleType.MONTHLY && <NumberInput label="Day of Month" value={dayOfMonth} onChange={value => setDayOfMonth(Number(value))} min={1} max={31} required />}
            
            <Select label="Timezone" value={timezone} onChange={value => setTimezone(value ?? 'UTC')} data={timezoneOptions} />

          </>}
        
        {overrideType === 'next_release' && <DatePicker value={nextReleaseDate} onChange={value => setNextReleaseDate(value as Date | null)} minDate={new Date()} />}
        
        {overrideType === 'hiatus' && <>
            <DatePicker value={hiatusStartDate} onChange={value => setHiatusStartDate(value as Date | null)} />

            
            <DatePicker value={hiatusEndDate} onChange={value => setHiatusEndDate(value as Date | null)} minDate={hiatusStartDate ?? new Date()} />

            
            <TextInput label="Reason (Optional)" value={hiatusReason} onChange={e => setHiatusReason(e.currentTarget.value)} placeholder="e.g., Author health issues" />

          </>}
        
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<IconCalendar size={16} />} onClick={handleSubmit} loading={applyOverrideMutation.isPending} disabled={overrideType === 'next_release' && !nextReleaseDate || overrideType === 'hiatus' && !hiatusStartDate}>

            Apply Override
          </Button>
        </Group>
      </Stack>
    </Modal>;
}

/**
 * Remove override button component
 */
interface RemoveOverrideButtonProps {
  mangaId: number;
  onSuccess?: () => void;
}
export function RemoveOverrideButton({
  mangaId,
  onSuccess
}: RemoveOverrideButtonProps): React.ReactElement {
  const removeOverrideMutation = trpc.calendar.updateSchedule.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Manual override removed' });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      notify({ severity: 'ERROR', title: 'Error', message: `Failed to remove override: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}` });
    }
  });
  const handleRemove = (): void => {
    if (confirm('Are you sure you want to remove the manual override and revert to automatic detection?')) {
      void removeOverrideMutation.mutateAsync({
        mangaId,
        schedule: {
          isConfirmed: false,
          source: 'automatic'
        }
      });
    }
  };
  return <Button variant="subtle" color="red" size="xs" leftSection={<IconCalendarOff size={14} />} onClick={handleRemove} loading={removeOverrideMutation.isPending}>

      Remove Override
    </Button>;
}
