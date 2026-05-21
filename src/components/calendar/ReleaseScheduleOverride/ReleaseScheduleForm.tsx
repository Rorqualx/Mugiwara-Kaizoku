/**
 * Release Schedule Form Component
 *
 * Form for editing release schedule settings.
 *
 * @module components/calendar/ReleaseScheduleOverride/ReleaseScheduleForm
 */

import {
  Card,
  Text,
  Group,
  Button,
  Select,
  NumberInput,
  Switch,
  Stack,
  Alert,
  TextInput,
  ActionIcon,
  Divider,
  Box,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { ReleaseType } from '@prisma/client';
import { IconCalendar, IconCheck, IconX, IconInfoCircle, IconClock } from '@tabler/icons-react';


import {
  getScheduleDescription,
  DAY_OPTIONS,
  RELEASE_TYPE_OPTIONS,
  WEEK_OPTIONS,
  TIMEZONE_OPTIONS,
} from './schedule-helpers';

import type { ReleaseScheduleFormProps } from './types';

/**
 * Form component for editing release schedules
 */
export function ReleaseScheduleForm({
  formState,
  setFormState,
  onCancel,
  onSave,
  isPending,
}: ReleaseScheduleFormProps): React.ReactElement {
  const { releaseType, dayOfWeek, dayOfMonth, weekOfMonth, timezone, isOnHiatus, hiatusEndDate, nextRelease, notes } =
    formState;

  const showAdvanced = formState.notes.length > 0 || timezone !== 'UTC';

  const updateField = <K extends keyof typeof formState>(field: K, value: (typeof formState)[K]): void => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <Stack>
        <Group justify="space-between">
          <Text fw={500}>Edit Release Schedule</Text>
          <ActionIcon variant="subtle" onClick={onCancel} color="gray">
            <IconX size={16} />
          </ActionIcon>
        </Group>

        <Select
          label="Release Type"
          value={releaseType}
          onChange={value => updateField('releaseType', (value as ReleaseType | null) ?? 'IRREGULAR')}
          data={[...RELEASE_TYPE_OPTIONS]}
          leftSection={<IconCalendar size={16} />}
        />

        {(releaseType === ReleaseType.WEEKLY || releaseType === ReleaseType.BIWEEKLY) && (
          <Select
            label="Day of Week"
            value={dayOfWeek}
            onChange={value => updateField('dayOfWeek', value ?? '1')}
            data={[...DAY_OPTIONS]}
          />
        )}

        {releaseType === ReleaseType.MONTHLY && (
          <>
            <Select
              label="Schedule Type"
              value={weekOfMonth > 0 ? 'week' : 'day'}
              onChange={value => {
                updateField('weekOfMonth', value === 'week' ? 1 : 0);
              }}
              data={[
                { value: 'day', label: 'Specific day of month' },
                { value: 'week', label: 'Specific week and day' },
              ]}
            />

            {weekOfMonth === 0 ? (
              <NumberInput
                label="Day of Month"
                value={dayOfMonth}
                onChange={value => updateField('dayOfMonth', Number(value) || 1)}
                min={1}
                max={31}
              />
            ) : (
              <Group grow>
                <Select
                  label="Week"
                  value={weekOfMonth.toString()}
                  onChange={value => updateField('weekOfMonth', parseInt(value ?? '1', 10))}
                  data={[...WEEK_OPTIONS]}
                />
                <Select
                  label="Day"
                  value={dayOfWeek}
                  onChange={value => updateField('dayOfWeek', value ?? '1')}
                  data={[...DAY_OPTIONS]}
                />
              </Group>
            )}
          </>
        )}

        <Divider label="Status" labelPosition="center" />

        <Switch
          label="Currently on hiatus"
          checked={isOnHiatus}
          onChange={event => updateField('isOnHiatus', event.currentTarget.checked)}
        />

        {isOnHiatus && (
          <Box>
            <Text size="sm" fw={500} mb={4}>
              Expected return date
            </Text>
            <DatePicker
              value={hiatusEndDate}
              onChange={value => updateField('hiatusEndDate', value as Date | null)}
              minDate={new Date()}
            />
          </Box>
        )}

        <Box>
          <Text size="sm" fw={500} mb={4}>
            Next expected release
          </Text>
          <DatePicker
            value={nextRelease}
            onChange={value => updateField('nextRelease', value as Date | null)}
            minDate={new Date()}
          />
        </Box>

        <Button
          variant="subtle"
          size="compact-sm"
          onClick={() => updateField('notes', showAdvanced ? '' : notes)}
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced options
        </Button>

        {showAdvanced && (
          <>
            <Select
              label="Timezone"
              value={timezone}
              onChange={value => updateField('timezone', value ?? 'UTC')}
              data={[...TIMEZONE_OPTIONS]}
              leftSection={<IconClock size={16} />}
            />

            <TextInput
              label="Notes (optional)"
              placeholder="e.g., Usually releases on Friday in Japan, Monday elsewhere"
              value={notes}
              onChange={event => updateField('notes', event.currentTarget.value)}
            />
          </>
        )}

        <Alert icon={<IconInfoCircle />} color="blue" variant="light">
          <Text size="sm">
            Preview: {getScheduleDescription(releaseType, dayOfWeek, dayOfMonth, weekOfMonth)}
            {isOnHiatus && ' (Currently on hiatus)'}
          </Text>
        </Alert>

        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isPending} leftSection={<IconCheck size={16} />}>
            Save Schedule
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
