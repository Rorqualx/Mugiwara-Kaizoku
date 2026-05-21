/**
 * Helper functions for Job History Page
 */
import type { ReactElement } from 'react';
import { createElement } from 'react';

import { IconClock, IconRefresh, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

import { JobType } from '@/utils/job-validation';

/**
 * Type guard for checking if value is a record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Get human-readable label for job type
 */
export function getTaskTypeLabel(type: JobType): string {
  switch (type) {
    case JobType.chapter_check:
      return 'Check Chapters';
    case JobType.chapter_download:
      return 'Chapter Download';
    case JobType.metadata_refresh:
      return 'Metadata Refresh';
    case JobType.library_scan:
      return 'Library Scan';
    case JobType.backup_create:
      return 'Backup';
    case JobType.chapter_sync:
      return 'Sync Fix';
    default:
      return type.replace(/_/g, ' ');
  }
}

interface StatusBadgeInfo {
  label: string;
  color: string;
  icon: ReactElement;
}

/**
 * Get badge info for job status
 */
export function getStatusBadge(status: string): StatusBadgeInfo {
  switch (status) {
    case 'pending':
      return {
        label: 'Queued',
        color: 'yellow',
        icon: createElement(IconClock, { size: 14 })
      };
    case 'active':
      return {
        label: 'In Progress',
        color: 'blue',
        icon: createElement(IconRefresh, { size: 14, className: 'animate-spin' })
      };
    case 'retrying':
      return {
        label: 'Retrying',
        color: 'orange',
        icon: createElement(IconRefresh, { size: 14 })
      };
    case 'completed':
      return {
        label: 'Completed',
        color: 'green',
        icon: createElement(IconCheck, { size: 14 })
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'red',
        icon: createElement(IconX, { size: 14 })
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: 'gray',
        icon: createElement(IconX, { size: 14 })
      };
    default:
      return {
        label: status,
        color: 'gray',
        icon: createElement(IconAlertCircle, { size: 14 })
      };
  }
}

/**
 * Get badge background color based on status color
 */
export function getStatusBadgeBgColor(color: string): string {
  switch (color) {
    case 'yellow':
      return 'rgba(250, 176, 5, 0.1)';
    case 'blue':
      return 'rgba(34, 139, 230, 0.1)';
    case 'orange':
      return 'rgba(253, 126, 20, 0.1)';
    case 'green':
      return 'rgba(64, 192, 87, 0.1)';
    case 'red':
      return 'rgba(250, 82, 82, 0.1)';
    default:
      return 'rgba(134, 142, 150, 0.1)';
  }
}

/**
 * Get badge text color based on status color
 */
export function getStatusBadgeTextColor(color: string): string {
  switch (color) {
    case 'yellow':
      return '#fab005';
    case 'blue':
      return '#228be6';
    case 'orange':
      return '#fd7e14';
    case 'green':
      return '#40c057';
    case 'red':
      return '#fa5252';
    default:
      return '#868e96';
  }
}
