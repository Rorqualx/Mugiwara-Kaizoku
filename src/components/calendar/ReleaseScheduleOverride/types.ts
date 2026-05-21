/**
 * Release Schedule Override Types
 *
 * Type definitions for release schedule override components.
 *
 * @module components/calendar/ReleaseScheduleOverride/types
 */

import type { ReleaseSchedule } from '@/types/search.types';

import type { ReleaseType } from '@prisma/client';


/**
 * Props for the ReleaseScheduleOverride component
 */
export interface ReleaseScheduleOverrideProps {
  mangaId: number;
  currentSchedule?: ReleaseSchedule;
  onScheduleUpdate?: (schedule: ReleaseSchedule) => void;
}

/**
 * Form state for editing a release schedule
 */
export interface ScheduleFormState {
  releaseType: ReleaseType;
  dayOfWeek: string;
  dayOfMonth: number;
  weekOfMonth: number;
  timezone: string;
  isOnHiatus: boolean;
  hiatusEndDate: Date | null;
  nextRelease: Date | null;
  notes: string;
}

/**
 * Props for the schedule form component
 */
export interface ReleaseScheduleFormProps {
  mangaId: number;
  currentSchedule: ReleaseSchedule | undefined;
  formState: ScheduleFormState;
  setFormState: React.Dispatch<React.SetStateAction<ScheduleFormState>>;
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
}

/**
 * Props for the schedule display component
 */
export interface ReleaseScheduleDisplayProps {
  currentSchedule: ReleaseSchedule | undefined;
  onEdit: () => void;
  onConfirm: () => void;
  isPending: boolean;
  getScheduleDescription: () => string;
}
