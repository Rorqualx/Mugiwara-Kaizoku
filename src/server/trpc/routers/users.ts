/**
 * Users Router - Main Aggregator
 *
 * This router aggregates all user-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - users/utils.ts - Shared utilities, schemas, helpers (0 procedures)
 * - users/admin.ts - Admin user management (5 procedures)
 * - users/profile.ts - User self-service operations (2 procedures)
 * - users/setup.ts - First-time setup (1 procedure)
 *
 * Total: 8 procedures across 3 routers
 *
 * Original file: 724 lines → Refactored: 1,039 lines across 5 files
 * Deduplication: Eliminated ~89 lines of duplicate code
 * Largest module: 373 lines (admin.ts, under 500 line limit)
 *
 * Procedures by Category:
 *
 * Admin Operations (5 procedures):
 * - getAll: Get paginated users with filtering
 *   - Supports search (username/email), role filter, pagination
 *   - Returns: { users, total, pages }
 *
 * - getById: Get single user by ID
 *   - Input: { id: string }
 *   - Returns: User object
 *
 * - create: Create new user with password validation
 *   - Input: { username, email, password, role?, isActive?, preferences? }
 *   - Validates: password strength (OWASP A07:2021)
 *   - Checks: username/email uniqueness
 *   - Emits: user:action event
 *
 * - update: Update user with conflict checking
 *   - Input: { id, username?, email?, password?, role?, isActive?, preferences? }
 *   - Validates: password strength if changing password
 *   - Checks: username/email conflicts, self-role-removal prevention
 *   - Emits: user:action event, role change event if applicable
 *
 * - delete: Delete user with safeguards
 *   - Input: { id: string }
 *   - Prevents: self-deletion, last admin deletion
 *   - Emits: user:action event
 *
 * User Self-Service (2 procedures):
 * - getProfile: Get current user's profile
 *   - No input (uses session context)
 *   - Returns: Current user object
 *
 * - updateProfile: Update current user's profile (with password change)
 *   - Input: { username?, email?, password?, currentPassword?, avatarUrl?, preferences? }
 *   - Validates: current password required for password change
 *   - Validates: new password strength (OWASP A07:2021)
 *   - Security: Invalidates all sessions on password change
 *   - Checks: username/email conflicts
 *   - Emits: USER_PASSWORD_CHANGED event if password changed
 *
 * Setup (1 procedure):
 * - firstTimeSetup: Create first admin user (zero-user initialization)
 *   - Input: { userName, email, password }
 *   - Only works when no users exist
 *   - Validates: password strength (OWASP A07:2021)
 *   - Returns: { success: true, user: User }
 *
 * Backward Compatibility:
 * All procedures are exposed at the top level (e.g., users.getAll, users.create)
 * to maintain compatibility with existing API consumers.
 *
 * @module server/trpc/routers/users
 */

import { router } from '../trpc';

// Import all sub-routers
import { usersActivityRouter } from './users/activity';
import { usersAdminRouter } from './users/admin';
import { usersProfileRouter } from './users/profile';
import { usersSetupRouter } from './users/setup';

/**
 * Main users router
 *
 * Merges all sub-routers to expose all 8 procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 */
export const usersRouter = router({
  // Merge flat sub-routers using tRPC's procedure spreading
  ...usersAdminRouter._def.procedures,
  ...usersProfileRouter._def.procedures,
  ...usersSetupRouter._def.procedures,
  // Nested namespace: admin per-user activity (users.activity.*)
  activity: usersActivityRouter,
});
