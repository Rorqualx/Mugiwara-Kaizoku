/**
 * Kaizoku API SDK
 *
 * TypeScript SDK for interacting with the Kaizoku API
 *
 * This file re-exports from the decomposed modules for backward compatibility.
 * The SDK has been refactored from 1088 lines into focused modules:
 *
 * - kaizoku-api-sdk/types.ts: Type definitions (~230 lines)
 * - kaizoku-api-sdk/utils.ts: Helper functions (~69 lines)
 * - kaizoku-api-sdk/api-error.ts: Custom error class (~22 lines)
 * - kaizoku-api-sdk/client-base.ts: Core HTTP client (~439 lines)
 * - kaizoku-api-sdk/client.ts: Full API client with endpoints (~722 lines)
 * - kaizoku-api-sdk/index.ts: Module aggregator (~66 lines)
 *
 * Benefits:
 * - Reduced complexity (request method: 51 → <15 per function)
 * - Type-safe error handling (no `any` types)
 * - Each module under 500 lines (except client.ts with all endpoints)
 * - Better testability and maintainability
 *
 * Usage remains unchanged:
 * ```typescript
 * import { createKaizokuApiClient, type KaizokuApiConfig } from '@/sdk/kaizoku-api-sdk';
 *
 * const client = createKaizokuApiClient({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-api-key',
 * });
 * ```
 */

// Re-export everything from the decomposed modules
export * from './kaizoku-api-sdk/index';
