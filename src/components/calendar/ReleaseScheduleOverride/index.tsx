/**
 * Release Schedule Override Component
 *
 * Allows users to manually set or correct release schedules for manga.
 * Provides UI for setting release patterns, confirming schedules, and
 * marking hiatuses.
 *
 * @module components/calendar/ReleaseScheduleOverride
 */

import React, { useState, useCallback } from 'react';

import { ReleaseType } from '@prisma/client';
import { } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';


import { ReleaseScheduleDisplay } from './ReleaseScheduleDisplay';
import { ReleaseScheduleForm } from './ReleaseScheduleForm';
import { getScheduleDescription } from './schedule-helpers';

import type { ReleaseScheduleOverrideProps, ScheduleFormState } from './types';

/**
 * Get initial form state from current schedule
 */
function getInitialFormState(currentSchedule?: ReleaseScheduleOverrideProps['currentSchedule']): ScheduleFormState {
  const metadata =
    currentSchedule?.metadata && typeof currentSchedule.metadata === 'object'
      ? (currentSchedule.metadata as Record<string, unknown>)
      : {};

  const nextExpectedRelease = metadata['nextExpectedRelease'];
  const nextRelease =
    typeof nextExpectedRelease === 'string' || typeof nextExpectedRelease === 'number'
      ? new Date(nextExpectedRelease)
      : null;

  return {
    releaseType: currentSchedule?.releaseType ?? 'IRREGULAR',
    dayOfWeek: currentSchedule?.dayOfWeek?.toString() ?? '1',
    dayOfMonth: currentSchedule?.dayOfMonth ?? 1,
    weekOfMonth: 1,
    timezone: currentSchedule?.timezone ?? 'UTC',
    isOnHiatus: false,
    hiatusEndDate: null,
    nextRelease,
    notes: '',
  };
}

/**
 * Main release schedule override component
 */
export function ReleaseScheduleOverride({ mangaId, currentSchedule }: ReleaseScheduleOverrideProps): React.ReactNode {
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<ScheduleFormState>(() => getInitialFormState(currentSchedule));

  // tRPC mutations
  const updateScheduleMutation = trpc.calendar.updateSchedule.useMutation();

  // tRPC queries
  const { refetch: refetchSchedule } = trpc.calendar.getSchedule.useQuery({ mangaId }, { enabled: false });

  // Handle mutation results
  React.useEffect(() => {
    if (updateScheduleMutation.isSuccess) {
      notify({ severity: 'SUCCESS', title: 'Schedule Updated', message: 'Release schedule has been updated successfully' });
      setIsEditing(false);
      void refetchSchedule();
    }
  }, [updateScheduleMutation.isSuccess, refetchSchedule]);

  React.useEffect(() => {
    if (updateScheduleMutation.isError) {
      const error = updateScheduleMutation.error;
      notify({ severity: 'ERROR', title: 'Update Failed', message: error instanceof Error ? error.message : 'Failed to update schedule' });
    }
  }, [updateScheduleMutation.isError, updateScheduleMutation.error]);

  const handleSave = useCallback((): void => {
    const { releaseType, dayOfWeek, dayOfMonth, timezone } = formState;

    // Map HIATUS to IRREGULAR for the mutation
    const scheduleReleaseType = releaseType === 'HIATUS' ? 'IRREGULAR' : releaseType;

    // Build schedule object with exactOptionalPropertyTypes pattern
    const dayOfWeekValue =
      releaseType === ReleaseType.WEEKLY || releaseType === ReleaseType.BIWEEKLY ? parseInt(dayOfWeek, 10) : undefined;
    const dayOfMonthValue = releaseType === ReleaseType.MONTHLY ? dayOfMonth : undefined;

    void updateScheduleMutation.mutateAsync({
      mangaId,
      schedule: {
        releaseType: scheduleReleaseType as 'WEEKLY' | 'MONTHLY' | 'BIWEEKLY' | 'IRREGULAR' | 'REGULAR',
        ...(dayOfWeekValue !== undefined ? { dayOfWeek: dayOfWeekValue } : {}),
        ...(dayOfMonthValue !== undefined ? { dayOfMonth: dayOfMonthValue } : {}),
        timezone,
        source: 'manual',
        confidence: 1.0,
        isConfirmed: true,
      },
    });
  }, [formState, mangaId, updateScheduleMutation]);

  const handleConfirm = useCallback((): void => {
    if (!currentSchedule) return;

    const scheduleReleaseType = currentSchedule.releaseType === 'HIATUS' ? 'IRREGULAR' : currentSchedule.releaseType;
    const dayOfWeekValue = currentSchedule.dayOfWeek ?? undefined;
    const dayOfMonthValue = currentSchedule.dayOfMonth ?? undefined;

    void updateScheduleMutation.mutateAsync({
      mangaId,
      schedule: {
        releaseType: scheduleReleaseType as 'WEEKLY' | 'MONTHLY' | 'BIWEEKLY' | 'IRREGULAR' | 'REGULAR',
        ...(dayOfWeekValue !== undefined ? { dayOfWeek: dayOfWeekValue } : {}),
        ...(dayOfMonthValue !== undefined ? { dayOfMonth: dayOfMonthValue } : {}),
        timezone: currentSchedule.timezone,
        source: currentSchedule.source,
        confidence: currentSchedule.confidence,
        isConfirmed: true,
      },
    });
  }, [currentSchedule, mangaId, updateScheduleMutation]);

  const getDescription = useCallback(
    (): string =>
      getScheduleDescription(formState.releaseType, formState.dayOfWeek, formState.dayOfMonth, formState.weekOfMonth),
    [formState]
  );

  if (isEditing) {
    return (
      <ReleaseScheduleForm
        mangaId={mangaId}
        currentSchedule={currentSchedule}
        formState={formState}
        setFormState={setFormState}
        onCancel={() => setIsEditing(false)}
        onSave={handleSave}
        isPending={updateScheduleMutation.isPending}
      />
    );
  }

  return (
    <ReleaseScheduleDisplay
      currentSchedule={currentSchedule}
      onEdit={() => setIsEditing(true)}
      onConfirm={handleConfirm}
      isPending={updateScheduleMutation.isPending}
      getScheduleDescription={getDescription}
    />
  );
}

// Re-export types for external use
export type { ReleaseScheduleOverrideProps, ScheduleFormState } from './types';
