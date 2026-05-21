import React from 'react';

/**
 * Mock implementation of JobList component for build compatibility
 * 
 * This is a simplified mock version of the component for use during build
 * to prevent dependency errors.
 */
// Task entity no longer exists - using Job model
interface TaskEntity {
  id: string | number;
  type: string;
  status: string;
  name?: string;
  description?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface JobListProps {
  tasks: Array<TaskEntity & {
    errorMessage?: string | null;
    scheduledAt?: Date | string | null;
    lastChecked?: Date;
  }>;
  status?: string;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDetails?: (id: string) => void;
}

export function JobList(props: JobListProps): React.ReactElement {
  return <div data-testid="task-list">Mock JobList for status: {props["status"]}</div>;
}
