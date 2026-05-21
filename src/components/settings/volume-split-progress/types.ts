/**
 * Type definitions for volume split progress components
 */
import type { SplitStage } from '@/hooks/useVolumeSplitProgress';

export interface VolumeSplitProgressModalProps {
  /** Whether modal is open */
  opened: boolean;

  /** Callback to close modal */
  onClose: () => void;

  /** Operation ID to track */
  operationId: string | null;

  /** Volume file name for display */
  volumeName?: string;

  /** Auto-close modal when complete (default: true) */
  autoCloseOnComplete?: boolean;

  /** Delay before auto-close in ms (default: 3000) */
  autoCloseDelay?: number;

  /** Callback when operation completes */
  onComplete?: (createdFiles: string[]) => void;

  /** Callback when operation fails */
  onError?: (error: string) => void;
}

export interface StageTimelineItemProps {
  stage: SplitStage;
  label: string;
  isActive: boolean;
  isPast: boolean;
  details?: string | undefined;
}

export interface StageConfig {
  key: SplitStage;
  label: string;
}
