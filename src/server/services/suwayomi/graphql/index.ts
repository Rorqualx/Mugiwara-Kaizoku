/**
 * Suwayomi GraphQL Module
 *
 * Exports the GraphQL client, operations, and types for interacting
 * with the Suwayomi server's GraphQL API.
 *
 * @module suwayomi/graphql
 */

// Client exports
export {
  SuwayomiGraphQLClient,
  getSuwayomiGraphQLClient,
  createSuwayomiGraphQLClient,
} from './client';

// Type exports
export type {
  SuwayomiGraphQLConfig,
  SubscriptionOptions,
} from './client';

export * from './types';

// Operation exports
export * from './operations';
