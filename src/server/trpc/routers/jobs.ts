/**
 * Jobs Router — aggregates jobs sub-routers and exposes every procedure
 * at the top level for backward compatibility.
 */

import { router } from '../trpc';

import { jobsAdminRouter } from './jobs/admin';
import { jobsMutationsRouter } from './jobs/mutations';
import { jobsQueriesRouter } from './jobs/queries';

export const jobsRouter = router({
  ...jobsQueriesRouter._def.procedures,
  ...jobsMutationsRouter._def.procedures,
  ...jobsAdminRouter._def.procedures,
});
