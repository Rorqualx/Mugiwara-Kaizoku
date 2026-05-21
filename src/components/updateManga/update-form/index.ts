/**
 * UpdateForm Module
 *
 * Exports types, utilities, and hooks for the UpdateForm component.
 * This modular structure reduces the main component's complexity.
 *
 * Architecture:
 * - types.ts - Type definitions and Zod schema
 * - utils.ts - Pure utility functions
 * - hooks/ - React hooks for state and mutations
 *
 * @module components/updateManga/update-form
 */

// Types
export type {
  UpdateFormProps,
  FormValues,
  OperationState,
  MetadataWithCover,
} from './types';

export { updateFormSchema } from './types';

// Utilities
export {
  getCoverUrl,
} from './utils';

// Hooks
export { useUpdateFormMutations } from './hooks';
