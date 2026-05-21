/**
 * System Router — aggregates all system-related sub-routers, exposing every procedure
 * at the top level for backward compatibility.
 */

import { router } from '../trpc';

import { systemBackupRouter } from './system/backup';
import { systemLifecycleRouter } from './system/lifecycle';
import { systemLogsRouter } from './system/logs';
import { systemProcessRouter } from './system/process';
import { systemSchedulerRouter } from './system/scheduler';
import { systemStatusRouter } from './system/status';
import { systemUpdatesRouter } from './system/updates';

export const systemRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...systemBackupRouter._def.procedures,
  ...systemLogsRouter._def.procedures,
  ...systemUpdatesRouter._def.procedures,
  ...systemStatusRouter._def.procedures,
  ...systemLifecycleRouter._def.procedures,
  ...systemSchedulerRouter._def.procedures,
  ...systemProcessRouter._def.procedures,
});
