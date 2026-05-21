import { faker } from '@faker-js/faker';
import { JobStatus, JobType } from '@prisma/client';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const createJob = (options: Record<string, unknown> = {}) => ({
  id: options['id'] || faker.number.int({ min: 1, max: 10000 }),
  queue_name: options['queue_name'] || 'default',
  job_type: options['job_type'] || faker.helpers.arrayElement([
    JobType.chapter_check,
    JobType.chapter_download,
    JobType.metadata_refresh,
    JobType.library_scan,
    JobType.backup_create
  ]),
  status: options['status'] || faker.helpers.arrayElement([
    JobStatus.pending,
    JobStatus.active,
    JobStatus.completed,
    JobStatus.failed
  ]),
  priority: options['priority'] || 50,
  payload: options['payload'] ?? {},
  mangaId: options['mangaId'] || faker.number.int({ min: 1, max: 1000 }),
  retryCount: options['retryCount'] ?? 0,
  maxAttempts: options['maxAttempts'] || 3,
  createdAt: faker.date.recent({ days: 7 }),
  updatedAt: faker.date.recent({ days: 1 }),
  scheduledFor: options['scheduledFor'],
  startedAt: options['startedAt'],
  completedAt: options['completedAt'] ?? null
});