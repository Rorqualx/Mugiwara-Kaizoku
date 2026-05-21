/**
 * Metadata Type Definitions
 *
 * Type definitions for metadata-related entities that don't exist in Prisma schema
 * but are used throughout the application.
 */

/**
 * MetadataConflict model interface
 *
 * This interface represents metadata conflicts that arise when different providers
 * return conflicting values for the same field. This model may not exist in all
 * schema versions.
 */
export interface MetadataConflict {
  id: number;
  mangaId: number;
  fieldName: string;
  values: Record<string, unknown>;
  resolved: boolean;
  resolution?: string;
  resolutionProvider?: string;
  createdAt: Date;
  updatedAt: Date;
  manga?: {
    id: number;
    metadataId?: number | null;
  };
}

/**
 * MetadataFieldPreference model interface
 *
 * This interface represents user preferences for specific metadata fields,
 * allowing users to prioritize certain providers for specific fields.
 */
export interface MetadataFieldPreference {
  id: number;
  fieldName: string;
  providerId: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}
