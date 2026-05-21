/**
 * UpdateForm Types
 *
 * Type definitions for the UpdateForm component and related hooks.
 * Extracted to improve modularity and reduce component complexity.
 *
 * @module components/updateManga/update-form/types
 */

import { z } from "zod";

import type { MangaWithRelations } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import type { ID } from '@/utils/id-converters';
import { isValidId } from '@/utils/id-converters';

/**
 * Props for the UpdateForm component
 */
export interface UpdateFormProps {
  manga: MangaWithRelations;
  onUpdate: () => void;
  onClose?: () => void;
}

/**
 * Form values interface
 */
export interface FormValues {
  id: ID;
  title: string;
  anilistId: string;
}

/**
 * Operation states for async operations
 */
export interface OperationState {
  updateState: AsyncResult<boolean, Error>;
  removeState: AsyncResult<boolean, Error>;
}

/**
 * Metadata with cover field variations
 */
export interface MetadataWithCover {
  cover?: string;
  coverImage?: string;
  coverLarge?: string;
  coverMedium?: string;
  coverSmall?: string;
}

/**
 * Zod schema for form validation
 *
 * Validates:
 * - Required ID field
 * - Required title field
 * - Optional AniList ID
 */
export const updateFormSchema = z.object({
  id: z.union([z.number(), z.string()]).refine(
    id => isValidId(id),
    { message: "Invalid ID" }
  ),
  title: z.string().min(1, { message: "Title is required" }),
  anilistId: z.string().nullish()
});
