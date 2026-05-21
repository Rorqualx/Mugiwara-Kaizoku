/**
 * PathMappingSettings Type Definitions
 *
 * Shared types for path mapping configuration UI.
 *
 * Extracted from: PathMappingSettings.tsx (lines 51-128)
 */

export interface ClientPathConfig {
  downloadPath: string;
}

export interface PathMappings {
  transmission: ClientPathConfig;
  deluge: ClientPathConfig;
  sabnzbd: ClientPathConfig;
  nzbget: ClientPathConfig;
}

export interface PathMapping {
  source: string;
  description?: string | null;
  localPath: string;
  remotePath?: string;
}

export interface BrowseResult {
  parent?: string;
  entries?: Array<{
    path: string;
    name: string;
    isDirectory: boolean;
    isAccessible: boolean;
  }>;
}

// Note: TRPCClient type was removed - use trpc.pathMapping directly for type safety
// Types are automatically inferred from AppRouter defined in src/server/trpc/root.ts
