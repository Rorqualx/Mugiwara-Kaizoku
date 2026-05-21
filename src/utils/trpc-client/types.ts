/**
 * Type Definitions for tRPC Client
 * 
 * This module provides TypeScript type definitions for tRPC router inputs and outputs.
 * These types are inferred from the AppRouter type and provide type safety for all
 * API calls made through the tRPC client.
 * 
 * @module trpc-client/types
 */
import type { AppRouter } from '@/server/trpc/root';

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

/**
 * Type definition for all tRPC router input parameters
 * 
 * Inferred from the AppRouter type, this provides type safety for all
 * parameters passed to tRPC procedures.
 * 
 * @example
 * // Type-safe input for a procedure
 * type CreateUserInput = RouterInputs['USER']['create'];
 * const input: CreateUserInput = { name: 'John', email: 'john@example.com' };
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Type definition for all tRPC router output values
 * 
 * Inferred from the AppRouter type, this provides type safety for all
 * values returned from tRPC procedures.
 * 
 * @example
 * // Type-safe output from a procedure
 * type UserData = RouterOutputs['USER']['get'];
 * const user: UserData = await trpc.user?.get.query(userId);
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
