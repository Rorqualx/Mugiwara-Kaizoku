# Project Guidance for Claude

## CRITICAL BUILD RULE

**THERE IS ONLY ONE BUILD COMMAND**: `bun run build:clean`

- **ALWAYS USE**: `bun run build:clean` for building the application
- **NEVER USE**: Any other build commands or variations
- **NEVER CREATE**: New build commands or scripts
- This is the ONLY authorized build command for this project

---

## Documentation Rules

### CRITICAL: Documentation Organization

**ALL documentation MUST be placed in the `/docs` folder. NEVER create documentation files in the project root.**

### Documentation Structure

The `/docs` folder is organized into the following categories:

```
docs/
├── project-info/          # Core project documentation
├── build-typescript/      # Build system and TypeScript documentation
├── features/              # Feature implementation documentation
│   ├── download-system/   # Download client integration
│   ├── reader/            # Reader features
│   ├── search-filter/     # Search and filter system
│   ├── integration/       # External integrations
│   ├── user-management/   # User system features
│   └── other/             # Other features
├── architecture-migration/ # System architecture and migration
├── project-planning/      # Project planning and sessions
│   ├── phase-completion/  # Phase completion summaries
│   └── session/           # Session planning
└── ui-ux/                 # UI/UX documentation
```

### Documentation Rules

1. **NEVER create documentation in the root directory**:
   - ❌ `/IMPLEMENTATION_SUMMARY.md`
   - ❌ `/SESSION_NOTES.md`
   - ❌ `/FEATURE_COMPLETE.md`
   - ✅ `/docs/project-planning/session/IMPLEMENTATION_SUMMARY.md`
   - ✅ `/docs/features/FEATURE_COMPLETE.md`

2. **Use the appropriate subfolder**:
   - Build fixes → `/docs/build-typescript/`
   - Feature implementations → `/docs/features/[feature-name]/`
   - Session summaries → `/docs/project-planning/session/`
   - Phase completions → `/docs/project-planning/phase-completion/`
   - Architecture changes → `/docs/architecture-migration/`
   - UI/UX updates → `/docs/ui-ux/`

3. **Naming conventions**:
   - Use UPPERCASE for status documents: `PHASE5_COMPLETE.md`
   - Use lowercase-hyphenated for guides: `authentication-guide.md`
   - Use descriptive names that indicate content: `typescript-error-fixes.md`

4. **Documentation standards**:
   - Include a clear title and overview
   - Use proper markdown formatting
   - Add date stamps for time-sensitive information
   - Link to related documentation
   - Follow the style guide in `/docs/documentation-style-guide.md`

5. **When creating new documentation**:
   - Check if a similar document already exists
   - Place it in the correct category folder
   - Update the category's README.md if needed
   - Never duplicate existing documentation

6. **Exceptions to root directory rule**:
   Only these files should exist in the root:
   - `README.md` - Main project README (simplified, links to docs)
   - `LICENSE` - License file
   - Configuration files (`.env.example`, `docker-compose.yml`, etc.)
   - Build/tooling files (`package.json`, `tsconfig.json`, etc.)

### Documentation Maintenance

- Regularly review and update documentation
- Remove outdated information
- Consolidate duplicate documentation
- Keep the `/docs` folder organized and clean
- Follow the maintenance schedule in `/docs/DOCUMENTATION_MAINTENANCE_SCHEDULE.md`

---

## Development Rules & Error Prevention

To prevent common TypeScript and build errors, strict development rules have been established:

- **📋 Full Development Rules**: See `/docs/DEVELOPMENT_RULES.md` for comprehensive guidelines
- **🚀 Quick Reference**: See `/docs/QUICK_REFERENCE.md` for a handy cheat sheet
- **🔧 TypeScript Config**: See `/docs/typescript-configuration-guide.md` for optimal settings
- **🚨 Pre-commit Hook**: Use `/scripts/pre-commit-hook.sh` to catch errors before committing

**Critical Type System Rules (UPDATED January 2025)**:
1. **PRISMA TYPES ARE AUTHORITATIVE** - Use `@prisma/client` types directly
2. **NO CANONICAL TYPES** - Do not use compatibility layers or converters
3. **UPPERCASE ENUMS ONLY** - All enums must match Prisma's UPPERCASE format exactly
4. **NO DUPLICATE TYPE DEFINITIONS** - Import types only from `@prisma/client`
5. **COMPONENTS USE PRISMA SHAPES** - Work directly with Prisma type shapes

**Key Rules Summary**:
1. Always convert IDs with `toNumberId()` when passing to tRPC/Prisma
2. Use Mantine v7 props (`fw` not `weight`, `gap` not `spacing`)
3. Use tRPC v11 syntax (`.methodName.useQuery()` not `.query.useQuery()`)
4. Check `mutation.isPending` not `mutation.isLoading`
5. Use relative imports, not aliases
6. Handle all AsyncResult states with proper type guards
7. **ALWAYS run `bun run type-check` after making any code changes** - Fix all TypeScript errors before proceeding

---

This document provides guidance for Claude when working with the Mugiwara-Kaizoku codebase.

## Recent Updates (January 2025)

### Prisma Schema Updates
- Added missing models for wanted functionality: `WantedItem`, `DownloadHistory`, `Blocklist`
- Added corresponding enums: `WantedStatus`, `WantedPriority`, `DownloadHistoryStatus`, `BlocklistReason`
- All changes made directly to canonical `prisma/schema.prisma` file

### Icon Import Fixes
- Fixed renamed icons in @tabler/icons-react v3.34.0:
  - `IconFolderOpened` → `IconFolderOpen`
- Replaced non-existent icons:
  - `IconBrandAnilist` (commented out as it doesn't exist)
  - `IconSparkles` → `IconStar` (July 2025)
  - `IconBrain` → `IconCpu` (July 2025)

### Build Script Compliance
- Fixed build script to only use canonical `prisma/schema.prisma`
- Removed logic that copied from non-canonical schema files
- **Cleaned up all non-canonical schema files from the project**

### Library Search & Filter Feature (July 2025)
- Added comprehensive search and filter functionality to library views
- Features include:
  - Text search by manga title (including alternative titles)
  - Filter by source/provider (AniList, MangaDex, etc.)
  - Filter by publication status (Ongoing, Completed, etc.)
  - Sort by title, date added, last updated, chapter count, or status
  - Visual feedback with result counts and active filter badges
  - Collapsible filter panel to save screen space
- Component location: `src/components/library/search/LibrarySearchFilter.tsx`
- Documentation: `/docs/library-search-filter-feature.md`
- Demo page: `/demo/library-search`

### Suwayomi Java 21 Requirement (July 2025)
- Updated Java requirement from Java 11 to Java 21
- Fixed Java version detection to handle old format (1.8.0_25)
- Added Homebrew Java 21 path detection for macOS
- Updated startup scripts to automatically set Java 21 in PATH
- Created comprehensive Java 21 setup documentation
- Key files updated:
  - `/src/server/services/suwayomi/utils.ts` - Version check logic
  - `/scripts/start.sh` - Added Java 21 PATH configuration
  - `/scripts/start-production.sh` - Added Java 21 PATH configuration
  - `/scripts/install-java-21.sh` - Automatic installation script
  - `/docs/suwayomi-java-21-setup.md` - Setup guide

### Suwayomi Headless Mode (July 2025)
- Configured Suwayomi to run in headless mode without web UI
- Kaizoku app serves as the frontend for all manga management
- Benefits: Reduced resource usage, improved security, consistent UX
- Implementation:
  - Added JVM flags to disable web UI: `-Dsuwayomi.config.server.webUIEnabled=false`
  - Updated UI to inform users about headless mode
  - Created documentation for headless configuration
- Key files:
  - `/src/server/services/suwayomi/service.ts` - Added headless JVM arguments
  - `/src/components/settings/suwayomi/SuwayomiSettings.tsx` - Added headless mode info
  - `/docs/suwayomi-headless-mode.md` - Comprehensive headless mode guide

## Important: Enum Value Conventions (June 2025 Update)

### Background
The project uses enums for various status values (TaskStatus, ChapterStatus, MangaStatus, etc.). A critical issue was discovered where domain enums were using lowercase string values while the Prisma schema expected uppercase values, causing database query failures.

### Current Standard
**All enum values must use UPPERCASE strings to match the Prisma schema definitions:**

```typescript
// CORRECT - Domain enums matching Prisma schema
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// INCORRECT - Would cause database errors
export enum TaskStatus {
  PENDING = 'pending',  // ❌ Lowercase values don't match schema
}
```

### Key Points
1. **Domain enums** in `src/types/domain/` must use uppercase string values
2. **Prisma enums** are defined in the schema with uppercase values
3. **Never use string casts** when using Prisma enum values: `PrismaTaskStatus.PENDING` not `PrismaTaskStatus.PENDING as string`
4. **Component status comparisons** should use the enum values or uppercase strings
5. The **enum converters** (`task-enum-converters.ts`) now use direct casting since values match

### Common Enums
- `TaskStatus`: PENDING, IN_PROGRESS, RUNNING, COMPLETED, FAILED, CANCELLED, PAUSED, OUT_OF_SYNC, SCHEDULED
- `ChapterStatus`: PENDING, DOWNLOADING, COMPLETED, ERROR, DELETED
- `MangaStatus`: PENDING, ACTIVE, COMPLETED, ERROR, DELETED
- `SyncStatus`: PENDING, IN_PROGRESS, RESOLVED, FAILED
- `BackupStatus`: PENDING, IN_PROGRESS, COMPLETED, FAILED

## Import Path Guidelines

1. **tRPC Imports**:
   - Always use: `import { trpc } from '../utils/trpc-client/index';`
   - Calculate correct relative path from your file location
   - Never use deprecated paths (`trpc-monkey-patch`, `trpcClient`)

2. **General Import Organization**:
   - Group imports by source:
     ```typescript
     // React and third-party libraries first
     import React, { useState, useEffect } from 'react';
     import { Button, TextInput } from '@mantine/core';
     
     // tRPC client (use standardized import)
     import { trpc } from '../utils/trpc-client/index';
     
     // Other project imports, organized by type
     import { MangaEntity } from '../types/manga';
     import { useNotification } from './useNotification';
     
     // Types and interfaces last
     import type { AsyncResult } from '../utils/async-result';
     ```

3. **Import Specificity**:
   - Import only what you need, not entire modules
   - Example: `import { Button, TextInput } from '@mantine/core';` (correct)
   - Instead of: `import * as Mantine from '@mantine/core';` (avoid)

4. **Relative vs Alias Paths**:
   - Prefer relative imports for better maintainability
   - Example: `import { helper } from '../utils/helper';` (preferred)
   - Instead of: `import { helper } from '@/utils/helper';` (avoid)

## Project Structure

The Mugiwara-Kaizoku project is a manga management application with the following key components:

- **API Clients / Adapters**: Handle external service communication
  - **Metadata Adapters**: `src/server/adapters/` - Unified adapter implementations (AdapterFactory, UnifiedBaseAdapter, unified-anilist-adapter, unified-comicvine-adapter)
  - **Download Clients**: `src/server/services/download/clients/` - Clients for download services (transmission/, delugeClient.ts, nzbgetClient.ts, sabnzbdClient.ts)
  - **Provider Services**: `src/server/services/{mangadex,comicvine,fandom,anilist}/` - Per-provider service layers
  - **Base Contract**: `src/utils/integration-adapter.ts` - IntegrationAdapter / BaseIntegrationAdapter
- **React Components**: Located in `src/components/` - UI components
- **React Hooks**: Located in `src/hooks/` - Custom hooks for state management and data fetching
- **Types**: Located in `src/types/` - TypeScript type definitions
  - **Domain Types**: `src/types/domain/` - Core domain entities and types
- **Utils**: Located in `src/utils/` - Utility functions and helpers
  - **Converters**: `src/utils/converters/` - Type conversion utilities
  - **Validation**: `src/utils/validation/` - Type validation utilities

## Architectural Patterns

The project uses several architectural patterns that should be maintained:

1. **Adapter Pattern**: For external integrations to standardize API communications
   - Example: `src/api/metadataProviders/adapters/anilistAdapter.ts`
   - Provides a consistent interface for different external APIs
   - Extends `BaseIntegrationAdapter` and implements `IntegrationAdapter` interface

2. **AsyncResult Pattern**: For handling asynchronous operations with typed results
   - Example: `src/utils/async-result.ts`
   - Use `createSuccessResult(data)` and `createErrorResult(error)` functions
   - Pattern: `{ status: 'success', data: T } | { status: 'error', error: Error }`
   - All async operations should return AsyncResult types
   - Use type guards `isSuccess(result)` and `isError(result)` instead of status checks
   - Check all states: `isSuccess`, `isError`, `isLoading`, and `isIdle`

3. **Container/Presenter Pattern**: For UI component separation of concerns
   - Example: `src/components/addManga/steps/searchStep.standardized.tsx`
   - Separates data fetching logic from presentation
   - Container components handle state and data fetching
   - Presenter components focus on rendering and UI

4. **Factory Pattern**: For creating client instances with proper configuration
   - Example: `src/api/metadataProviders/comicvineClient.ts` (createComicVineClient function)
   - Use factory functions to create properly configured instances
   - Encapsulates creation logic and ensures proper initialization

## Canonical Files

The project has gone through a complete file consolidation effort to rename and standardize multiple versions of the same files. Always use these canonical versions for all future development:

### Provider Services
- `src/server/services/mangadex/` - MangaDex service layer
- `src/server/services/comicvine/` - ComicVine service layer
- `src/server/services/fandom/` - Fandom service layer
- `src/server/services/anilist/` - AniList service layer

### Download Clients
- `src/server/services/download/clients/transmission/` - Transmission client
- `src/server/services/download/clients/nzbgetClient.ts` - NZBGet client
- `src/server/services/download/clients/delugeClient.ts` - Deluge client
- `src/server/services/download/clients/sabnzbdClient.ts` - SABnzbd client
- `src/server/services/download/base.ts` - Base download client
- `src/server/services/download/client-factory.ts` - Client factory

### Metadata Adapters
- `src/server/adapters/unified-anilist-adapter.ts`
- `src/server/adapters/unified-comicvine-adapter.ts`
- `src/server/adapters/UnifiedBaseAdapter.ts`
- `src/server/adapters/AdapterFactory.ts`
- `src/utils/integration-adapter.ts` - IntegrationAdapter base contract

### React Components
- `src/components/updateManga/ProviderSelectionForm/` - Provider selection form
- `src/components/addManga/steps/searchStep.tsx`

### React Hooks
- `src/hooks/useManga.ts`
- `src/hooks/useMetadata.ts`
- `src/hooks/useMetadataProviders.ts`

## Type Safety Guidelines

1. **Domain Types**: 
   - Entity types come from `@prisma/client`; derived/view types from `src/types/manga/`
   - Example: `import { MangaEntity, MangaSearchResult } from '../types/manga';`
   - Never use raw object types for domain entities

2. **AsyncResult Pattern**:
   - Use for all async operations: `Promise<AsyncResult<T, Error>>`
   - Example: `return createSuccessResult(result.data);`
   - Error handling: `return createErrorResult(error instanceof Error ? error : new Error('Error message'));`
   - Use type guards for checking result status: 
     ```typescript
     if (isSuccess(result)) {
       return result.data;
     }
     if (isError(result)) {
       throw result.error;
     }
     // Also check other states
     if (isLoading(result)) {
       // Handle loading state
     }
     if (isIdle(result)) {
       // Handle idle state
     }
     ```

3. **Type Guards and Assertions**:
   - Avoid using `any` types; prefer `unknown` with type guards
   - Create custom type guards for complex objects:
     ```typescript
     function isValidManga(manga: unknown): manga is {
       id: string | number;
       title: string;
       // other properties
     } {
       if (!manga || typeof manga !== 'object') {
         return false;
       }
       
       const obj = manga as Record<string, unknown>;
       
       return (
         (typeof obj.id === 'string' || typeof obj.id === 'number') &&
         typeof obj.title === 'string' &&
         // other checks
       );
     }
     ```
   - Use type guards: `if (error instanceof Error) { ... }`
   - Use safe type assertions: `const value = data as unknown as MyType;`
   - Never use `!` non-null assertion operator; use proper null checks

4. **Error Handling**:
   - Always catch errors in async functions
   - Use instanceof checks: `error instanceof Error ? error.message : 'Unknown error'`
   - Provide descriptive error messages
   - Propagate errors in AsyncResult pattern, don't swallow them
   - Add context to errors: `this.createError(`Failed to search: ${error instanceof Error ? error.message : String(error)}`, error)`

5. **Null Safety**:
   - Use nullish coalescing (`??`) for defaults instead of logical OR (`||`):
     ```typescript
     // Before - Could replace 0 with default value
     const limit = options?.limit || 20
     
     // After - Only replaces undefined/null with default
     const limit = options?.limit ?? 20
     ```
   - Use optional chaining (`?.`) for potentially undefined values
   - Provide explicit defaults for all optional properties

6. **External API Data Handling**:
   - Always treat API responses as `unknown` type initially
   - Apply type guards before accessing properties
   - Handle array data safely:
     ```typescript
     if (!Array.isArray(result.data)) {
       return createSuccessResult([]);
     }
     ```
   - Use explicit type casting after validation

7. **Dynamic Property Access**:
   - Use type-safe dynamic property access with `keyof typeof`:
     ```typescript
     // Unsafe access
     const value = obj[key];

     // Safe access
     if (key in obj) {
       const value = obj[key as keyof typeof obj];
     }
     ```

8. **TypeScript Compliance Principles** (June 2025 Implementation Findings):
   - **Minimal `any` usage**: Only use `any` when parsing unknown JSON from database/external sources, then immediately validate
   - **Comprehensive error handling**: Always use type guards (`instanceof Error`) in catch blocks
   - **Nullish coalescing consistency**: Always use `??` instead of `||` for defaults to preserve falsy values
   - **Type safety throughout**: Every function parameter, return type, and variable should be properly typed
   - **Logger parameter safety**: Handle unknown error types when passing to logger functions
   - **Environment variable validation**: Use schema validation (e.g., Zod) for environment variables

## tRPC Client Integration

The project uses tRPC for type-safe API calls between frontend and backend. Several updates have been made to improve reliability, error handling, and compatibility.

### **tRPC Import Patterns**

#### **Current Standards (June 2025 Update)**

There are now two valid approaches depending on the component's requirements:

**1. Standard Components (Default Approach):**
```typescript
// Use the standard client for most components
import { trpc } from '../utils/trpc-client/index';
```

**2. Components with Potential Missing Endpoints:**
```typescript
// Use the monkey-patched client for components that need graceful degradation
import { trpc } from '../utils/trpc-monkey-patch';
```

#### **When to Use Each Approach**

- **Standard Client** (`trpc-client/index`): Use for most components where endpoints are guaranteed to exist
- **Monkey-Patched Client** (`trpc-monkey-patch`): Use for:
  - Root providers/containers that initialize app data
  - Components that need to handle missing endpoints gracefully
  - Components that should continue functioning with partial data

#### **Client Comparison**

| Client Type | Import Path | Behavior with Missing Endpoints | Use Cases |
|-------------|-------------|--------------------------------|-----------|
| Standard | `trpc-client/index` | Throws errors | Regular components, confirmed endpoints |
| Monkey-Patched | `trpc-monkey-patch` | Returns mocks with error state | Root providers, critical components |

### **Error Handling with useCompatibleQuery**

For components that need more robust error handling, use the `useCompatibleQuery` hook:

```typescript
import { useCompatibleQuery } from '../hooks/fix-use-query';

// Usage with error handling
const dataQuery = useCompatibleQuery(
  trpc.someEndpoint.query, 
  queryParams, 
  queryOptions
);

// Check errors before using
if (dataQuery.isError) {
  // Handle error state
  console.error('Query error:', dataQuery.error);
}
```

This hook provides:
- Proper error states for missing endpoints
- Error information for debugging
- Safe fallbacks when endpoints don't exist
- Type-compatible interface with regular tRPC queries

### **RootStoreProvider Pattern**

The RootStoreProvider implements these best practices:
- Uses the monkey-patched client for resilience
- Implements useCompatibleQuery for all queries
- Checks for errors before using data
- Continues operation with partial data
- Provides detailed error reporting

Example implementation:
```typescript
// Import patched client
import { trpc } from '../utils/trpc-monkey-patch';
import { useCompatibleQuery } from '../hooks/fix-use-query';

// Setup data queries with proper error handling
const settingsQuery = useCompatibleQuery(trpc.settings.query, undefined, queryOptions);
const libraryQuery = useCompatibleQuery(trpc.library.query, undefined, queryOptions);

// Check for errors before using data
if (settingsQuery.isError) {
  // Log and handle error appropriately
  console.error('Settings query failed:', settingsQuery.error);
}

// Continue with available data
```

### **Available tRPC Procedures**

The standardized tRPC client provides access to:
- `trpc.manga.query` - Get all manga with optional includes
- `trpc.manga.get` - Get single manga by ID
- `trpc.manga.add` - Add new manga
- `trpc.manga.update` - Update manga
- `trpc.manga.remove` - Remove manga
- `trpc.library.query` - Get all libraries
- `trpc.library.create` - Create new library
- `trpc.settings.query` - Get application settings
- `trpc.settings.update` - Update settings

### **Migration History**

- **December 2024**: Initial standardization to use `trpc-client/index` for all files
- **June 2025**: Enhanced error handling with `trpc-monkey-patch` for critical components
- **June 2025**: Improved `useCompatibleQuery` with proper error states and debugging

### **Best Practices for Error Handling**

1. **Check Query States**:
   ```typescript
   if (query.isError) {
     console.error(`Query error: ${query.error.message}`);
   }
   
   if (!query.data && !query.isLoading) {
     // Handle empty data case
   }
   ```

2. **Provide Fallbacks**:
   ```typescript
   const data = query.data ?? [];
   ```

3. **Continue with Partial Data**:
   ```typescript
   // Track which data sources loaded successfully
   const dataLoadStatus = {
     settings: false,
     library: false,
     manga: false
   };
   
   // Set partial success flags when data loads
   if (settingsResult.data) {
     dataLoadStatus.settings = true;
   }
   
   // Determine overall initialization success
   const partialSuccess = Object.values(dataLoadStatus).some(Boolean);
   ```

4. **Enhanced Error Logging**:
   ```typescript
   console.error('Error loading data:', {
     message: error.message,
     stack: error.stack,
     query: {
       status: query.status,
       error: query.error?.message
     }
   });
   ```

### **Troubleshooting**

If you encounter tRPC-related errors:
1. **Check compatibility** - use `useCompatibleQuery` for resilient components
2. **Verify error handling** - implement proper error checks before using data
3. **Use appropriate client** - choose the right import based on component needs
4. **Test with missing endpoints** - ensure components degrade gracefully



## Testing Guidelines

1. **TypeScript Verification** (MANDATORY):
   - **Run `bun run type-check` after EVERY file modification**
   - Fix ALL TypeScript errors immediately before proceeding
   - Never commit code with type errors
   - Type checking workflow:
     1. Make code changes
     2. Run `bun run type-check`
     3. Fix any errors that appear
     4. Run `bun run type-check` again to confirm fixes
     5. Only then proceed with additional changes
   - Common type check commands:
     - `bun run type-check` - Full type checking
     - `bun run tsc --noEmit --watch` - Watch mode for continuous checking

2. **Functional Testing**:
   - Test functionality with `bun run dev` after making changes
   - Verify that your changes work as expected in the UI
   - Check browser console for runtime errors

3. **Unit Testing**:
   - Follow existing test patterns in `src/hooks/__tests__/`
   - Create test files with the same name as the file being tested
   - Use descriptive test names that explain what is being tested
   - Run tests with `bun run test`

## Database and Caching Policy

### CRITICAL: NO Redis Policy
**This project uses PostgreSQL exclusively for all caching and data storage needs.**

- **NEVER** suggest or implement Redis
- **NEVER** add Redis as a dependency
- **ALWAYS** use PostgreSQL for:
  - Application data storage
  - Caching mechanisms
  - Session storage
  - Queue management
  - Real-time features
- PostgreSQL provides excellent caching capabilities through:
  - Query result caching
  - Materialized views
  - Table-based caching with TTL
  - JSONB for flexible cache storage

### Database and Schema Recreation

This project uses a **schema recreation approach** for development environments (see `PROJECT_PLAN_SCHEMA_RECREATION.md`). Production still uses migrations.

### Build Script Error Handling Rules

When working with build scripts and database operations, follow these rules:

#### Rule 1: **Use IF NOT EXISTS for All DDL Operations**
```sql
-- Tables
CREATE TABLE IF NOT EXISTS table_name (...);

-- Indexes
CREATE INDEX IF NOT EXISTS index_name ON table_name(column);

-- Constraints (check first)
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constraint_name') THEN
        ALTER TABLE table_name ADD CONSTRAINT constraint_name ...;
    END IF;
END$;
```

#### Rule 2: **Never Use FORCE Operations in Shared Environments**
- Don't drop and recreate objects that might already exist
- Always check existence before creating
- Use `CREATE OR REPLACE` for functions/procedures only

#### Rule 3: **Handle Existing Data Gracefully**
```javascript
// Check before insert
const existing = await prisma.model.findFirst({ where: { unique_field: value } });
if (!existing) {
    await prisma.model.create({ data: {...} });
}

// Or use upsert
await prisma.model.upsert({
    where: { unique_field: value },
    update: {}, // No updates needed
    create: { ...data }
});
```

#### Rule 4: **Exit Codes Should Reflect Success**
- Exit 0 for success OR expected/handled errors
- Exit 1 only for actual failures that block functionality
- Existing data is NOT a failure

#### Rule 5: **Use Idempotent Operations**
Every script should be able to run multiple times without errors:
- CHECK before CREATE
- UPSERT instead of INSERT
- Skip instead of fail on duplicates

#### Rule 6: **Log Appropriately**
```bash
log_success "✅ Resource created"          # New creation
log_success "✅ Resource already exists"   # Existing (still success!)
log_warning "⚠️  Minor issue, continuing"  # Non-blocking issues
log_error "❌ Critical failure"            # Only for real failures
```

#### Rule 7: **Schema Recreation Specific**
For development schema recreation:
1. Always start fresh: `prisma db push --force-reset`
2. Then add auth tables with IF NOT EXISTS
3. Then push remaining schema
4. Handle seed data with upserts

#### Rule 8: **Error Categories**
Categorize errors to handle appropriately:
- **Ignorable**: Existing objects, duplicate data (continue)
- **Recoverable**: Permissions, connections (retry/fix)
- **Fatal**: Missing dependencies, corrupt data (stop)

### Database Commands
- `bun run db:reset:dev` - Reset development database using schema recreation
- `bun run db:fix-account` - Fix account table issues
- `bun run generate` - Generate Prisma client
- `npx prisma db push` - Push schema changes (development)
- `bun run db:studio` - Open Prisma Studio

## Authentication System

The project uses NextAuth v4 (next-auth 4.24.5) for authentication. The authentication system was improved in June 2025 with the following security enhancements:

1. **Environment-Independent Authentication**:
   - Removed all development mode authentication bypasses
   - All environments now require proper credentials
   - Password verification is always performed regardless of environment

2. **Secure Error Handling**:
   - Sanitized error logging to prevent sensitive information exposure
   - Detailed errors are only logged in non-production environments
   - Generic error messages are used in user-facing responses

3. **Configuration Security**:
   - Removed all hardcoded secrets and fallbacks
   - Added validation for required environment variables (AUTH_SECRET/NEXTAUTH_SECRET)
   - Reduced session lifetime from 30 days to 14 days for better security
   - Added error handlers for missing configurations

4. **Credential Management**:
   - Implemented proper password verification with bcryptjs
   - Enhanced type safety for user role handling
   - Improved session type validation

The authentication system now properly handles environment variables and does not rely on environment-specific bypasses, making it more secure and reliable across all environments.

## Feature Development Policy

### NO Machine Learning Policy
**This project does not use machine learning features.**

- **NEVER** suggest ML/AI features
- **NEVER** add TensorFlow.js or similar ML libraries
- **ALWAYS** use statistical and algorithmic approaches for:
  - Pattern detection
  - Predictions
  - Data analysis
  - Recommendations
- The calendar's pattern detection achieves 85% accuracy using pure statistical analysis

## Creating New Files

When creating new files, follow these guidelines:

1. **API Clients**:
   - Extend `ApiClient` base class
   - Implement appropriate interfaces
   - Include factory functions for creation
   - Use AsyncResult pattern for all async operations

2. **React Components**:
   - Use TypeScript with explicit prop interfaces
   - Follow Container/Presenter pattern for complex components
   - Use hooks for state management and data fetching
   - Include meaningful JSDoc comments

3. **React Hooks**:
   - Return typed objects with explicit return type interfaces
   - Handle errors consistently
   - Include meaningful JSDoc comments
   - Follow existing naming conventions

4. **Adapter Implementations**:
   - Follow the pattern in adapter-template.fixed.ts
   - Implement all required interface methods
   - Use proper AsyncResult pattern with Error typing
   - Apply comprehensive type guards for external data

## File Modification Guidelines

1. **CRITICAL: Never create files with .fixed, Fixed, or similar naming patterns**:
   - **NEVER** create files like `Component.fixed.tsx`, `ComponentFixed.tsx`, `component-fixed.ts`
   - **NEVER** add "fixed", "Fixed", or similar suffixes/prefixes to file names
   - These naming patterns violate the codebase standards and create confusion
   - If you encounter files with "fixed" in their names, they must be renamed immediately
   - Always modify the original files directly or create properly named new files
   - The only acceptable suffixes are standard ones like `.test.ts`, `.spec.ts`, `.mock.ts`

2. **IMPORTANT: Never create .fixed.ts or other temporary files**:
   - Always modify the canonical files directly
   - Do not create files with extensions like `.fixed.ts`, `.fixed.tsx`, etc.
   - These temporary files make the codebase harder to maintain and introduce confusion
   - If you need to create test files, use proper test extensions like `.test.ts`

3. **No Wrappers Approach**:
   - When fixing files, always edit the original source files directly
   - Do not create wrapper files or temporary implementations that redirect to the original
   - Implement fixes inline within the existing codebase structure
   - This is especially important for utility files like `tabler-icons-wrapper.ts`
   - For dynamic component needs, use proxies and factories within the original files

4. **Backup Strategy**:
   - If requested to backup a file before modifying, create a backup in a docs/ folder
   - For major refactorings, document the changes in a separate markdown file
   - Example: `docs/adapter-fixes-summary.md`

5. **Prisma Schema Files**:
   - **ONLY USE** `prisma/schema.prisma` - this is the canonical schema file
   - **NEVER CREATE** or use extended schema files like:
     - `schema-consolidated.prisma` ❌ (removed January 2025)
     - `schema-nextauth.prisma` ❌ (removed January 2025)
     - `schema.task-enums.prisma` ❌ (removed January 2025)
     - Any other variant or extended schema file
   - All schema changes must be made directly to `prisma/schema.prisma`
   - The build script has been fixed to only use the canonical schema file
   - **Non-canonical files have been removed from the project**

## Command Line Operations

**CRITICAL RULE**: There is only ONE build command that must be used:

- `bun run build:clean` - The ONLY build command to be used for building the application

**DO NOT USE** any other build commands such as:
- ❌ `npm run build:smart`
- ❌ `npm run build:clean:fixed`
- ❌ `npm run build`
- ❌ Any other build variations

**MANDATORY TYPE CHECKING WORKFLOW**:
1. Before ANY commit or after ANY code change:
   - Run `bun run type-check`
   - Fix ALL errors before proceeding
   - Run `bun run type-check` again to verify
2. Use `bun run tsc --noEmit --watch` in a separate terminal for real-time type checking

Other available commands for development:
- `bun run dev` - Start the development server
- `bun run type-check` - **Run TypeScript checks (MANDATORY after changes)**
- `bun run test` - Run unit tests
- `bun run lint` - Run linting checks
- `bun run tsc --noEmit --watch` - Watch mode for continuous type checking

**Note**: Always use `pnpm` as the package manager, not `npm`.

## File Cleanup Status

All duplicate fixed files have been cleaned up as of the latest update. The codebase now only contains the canonical versions of all files, with one exception:

1. Test files with `.fixed.test.ts` suffixes - These are kept to maintain test coverage

If new duplicate files are created in the future, remove them manually following the file placement rules above. See `scripts/cleanup/` for any available cleanup utilities.

### Recent Cleanup (June 2025)
- All backup (.bak) files have been moved from the source directory to `/archive/src-backups/`
- The archive preserves original directory structure for reference
- A README.md in the archive directory provides a summary of moved files

## Documentation Resources

For more detailed information about the codebase:

- `/docs/file-consolidation-results.md` - Details about file consolidation and improvements
- `/docs/file-consolidation-summary-final.md` - Final report on the consolidation project
- `/docs/adapter-interfaces.md` - Documentation of adapter pattern implementation
- `/docs/integration-adapter-pattern.md` - Details on integration adapter pattern
- `/docs/architectural-audit.md` - Analysis of architectural patterns in the codebase
- `/docs/typescript-fixes-summary.md` - Summary of TypeScript fixes applied to the codebase
- `/docs/typescript-fixes-completed-updated.md` - Updated summary of all TypeScript fixes implemented
- `/docs/typescript-fixes-implementation-patterns.md` - Comprehensive guide to TypeScript fix patterns
- `/docs/typescript-fixes-progress-update-june-2024.md` - Latest progress update on TypeScript fixes
- `/docs/typescript-fixes-phase53-plan.md` - Detailed plan for the next phase of TypeScript fixes
- `/docs/typescript-fixes-property-specific-type-guards.md` - Guide for property-specific type guards and array validation
- `/docs/mangadex-adapter-fixes.md` - Documentation of fixes to the MangaDex adapter
- `/docs/adapter-template-fixes.md` - Documentation of adapter template pattern and fixes
- `/docs/provider-selection-form-fixes.md` - Documentation of ProviderSelectionForm fixes
- `/docs/useManga-fixes-updated.md` - Documentation of useManga hook fixes
- `/docs/enhanced-error-handling-guide.md` - Comprehensive guide for enhanced error handling

## TypeScript Fix Patterns

When addressing TypeScript errors, use these established patterns (see `/docs/typescript-fixes-implementation-patterns.md` for complete documentation):

1. **AsyncResult Wrapper Pattern**: For methods that need to match an interface but use AsyncResult
   ```typescript
   // Private implementation with AsyncResult
   private async _methodName(params): Promise<AsyncResult<ReturnType, Error>> {
     // Implementation with proper error handling
   }
   
   // Public interface-compliant method
   public async methodName(params): Promise<ReturnType> {
     const result = await this._methodName(params);
     if (isSuccess(result)) return result.data;
     if (isError(result)) throw result.error;
     throw new Error('Unknown state in methodName');
   }
   ```

2. **Type-Safe API Response Handling**:
   ```typescript
   // Before processing API data, validate its structure
   if (!Array.isArray(data)) {
     return createSuccessResult([]);
   }
   
   // Then process each item with type guards
   const results = [];
   for (const item of data) {
     if (isValidItem(item)) {
       results.push(/* process item */);
     }
   }
   return createSuccessResult(results);
   ```

3. **Nullish Coalescing for Defaults**:
   ```typescript
   const limit = options?.limit ?? 20; // Only replaces null/undefined
   const offset = options?.offset ?? 0; // Preserves 0 values
   ```

4. **Proper Enum Usage**:
   ```typescript
   // Import the enum
   import { ChapterStatus } from '../types/domain/chapter-types';
   
   // Use enum values, not string literals
   downloadStatus: ChapterStatus.AVAILABLE // NOT: 'available'
   ```

5. **Comprehensive Type Guards**:
   ```typescript
   function hasMetadata(obj: unknown): obj is { 
     metadata?: { 
       coverUrl?: string;
       description?: string;
       // other properties
     } 
   } {
     return obj !== null && 
       typeof obj === 'object' && 
       'metadata' in obj && 
       (obj as { metadata?: unknown }).metadata !== undefined && 
       typeof (obj as { metadata?: unknown }).metadata === 'object';
   }
   ```

6. **Timeout Protection for Async Operations**:
   ```typescript
   // Create a timeout promise
   const timeoutPromise = new Promise<null>((_, reject) => 
     setTimeout(() => reject(new Error("Operation timed out after 30 seconds")), 30000)
   );
   
   // Race between timeout and actual operation
   const result = await Promise.race([
     actualOperation(),
     timeoutPromise
   ]);
   ```

7. **Comprehensive Error Handling with Context**:
   ```typescript
   try {
     // Implementation...
   } catch (error) {
     // Create detailed error message
     let errorMessage = 'Failed to perform operation: ';
     if (error instanceof Error) {
       errorMessage += error.message;
       // Log stack trace for debugging
       if (error.stack) {
         console.error('Stack trace:', error.stack);
       }
     } else if (typeof error === 'string') {
       errorMessage += error;
     } else {
       errorMessage += 'Unknown error occurred';
     }
     
     // Return typed error result
     return createErrorResult(
       error instanceof Error 
         ? error 
         : new Error(errorMessage)
     );
   }
   ```

8. **Enhanced Contextual Error Handling**:
   ```typescript
   // Define a contextual error creator for the service
   this.createContextualError = createContextualErrorCreator({
     service: 'ServiceName',
     resourceType: 'resourceType'
   });
   
   // Use withEnhancedErrorHandling for operation context
   return withEnhancedErrorHandling(async () => {
     try {
       const response = await api.request();
       if (!response) {
         throw this.createContextualError(
           'Operation failed: No response received',
           'operationName',
           { resourceId: id }
         );
       }
       return createSuccessResult(response);
     } catch (error) {
       // Error will be automatically enhanced with operation context
       throw error;
     }
   }, {
     operation: 'operationName',
     service: 'ServiceName',
     resourceType: 'resourceType',
     resourceId: id,
     details: { additionalInfo: 'value' }
   });
   ```

9. **Loading State Management**:
   ```typescript
   // Always use setLoading with a unique key for the operation
   // INCORRECT - Missing a key:
   setLoading(true);
   
   // CORRECT - With a descriptive key:
   setLoading('update-manga', true);
   
   // Recommended - Use the useLoadingManager hook:
   const { startLoading, stopLoading, withLoading } = useLoadingManager();
   
   // Manual loading state management
   const handleClick = async () => {
     startLoading('save-data');
     try {
       await saveData();
     } finally {
       stopLoading('save-data');
     }
   };
   
   // Automatic loading state management with withLoading
   const handleSubmit = withLoading('form-submit', async (formData) => {
     await submitForm(formData);
     return true;
   });
   ```

10. **Download Client Adapter Implementation**:
   ```typescript
   // Private implementation with AsyncResult
   private async _getDownloads(): Promise<AsyncResult<DownloadItem[], Error>> {
     try {
       const response = await this.httpClient.get<NzbgetListGroupsResponse>(
         '/jsonrpc/listgroups'
       );
       
       if (!isSuccess(response)) {
         return createErrorResult(new Error('Failed to fetch downloads'));
       }
       
       // Convert response to DownloadItem[] format
       const downloads = response.data.result.map(item => ({
         id: item.NZBID.toString(),
         name: item.NZBName,
         status: this.mapStatus(item.Status),
         progress: this.calculateProgress(item),
         size: item.FileSizeMB * 1024 * 1024,
         eta: this.calculateEta(item)
       }));
       
       return createSuccessResult(downloads);
     } catch (error) {
       return createErrorResult(
         error instanceof Error ? error : new Error(`Failed to get downloads: ${String(error)}`)
       );
     }
   }
   
   // Public interface-compliant method
   public async getDownloads(): Promise<DownloadItem[]> {
     const result = await this._getDownloads();
     
     if (isSuccess(result)) {
       return result.data;
     }
     
     if (isError(result)) {
       throw result.error;
     }
     
     throw new Error('Unknown state in getDownloads');
   }
   ```

11. **Discriminated Union Type Handling**:
   ```typescript
   // Define a discriminated union type
   type SearchResult = 
     | { type: 'manga'; id: string; title: string; chapters: number }
     | { type: 'comic'; id: string; title: string; issues: number }
     | { type: 'novel'; id: string; title: string; pages: number };

   // Type guard to narrow the union type
   function isMangaResult(result: SearchResult): result is { type: 'manga'; id: string; title: string; chapters: number } {
     return result.type === 'manga';
   }

   // Function that safely handles the union type
   function getItemCount(result: SearchResult): number {
     switch (result.type) {
       case 'manga':
         return result.chapters;
       case 'comic':
         return result.issues;
       case 'novel':
         return result.pages;
       default:
         // Exhaustiveness check
         const _exhaustiveCheck: never = result;
         return 0;
     }
   }
   ```

12. **React Component Props Type Safety**:
   ```typescript
   // Explicit prop interface
   interface SearchComponentProps {
     /** Initial search query */
     initialQuery?: string;
     /** Callback when user selects an item */
     onSelect: (item: SearchResult) => void;
     /** Whether to show provider badges */
     showProviders?: boolean;
     /** Maximum number of results to display */
     maxResults?: number;
   }

   // Component with proper prop typing and defaults
   function SearchComponent({
     initialQuery = '',
     onSelect,
     showProviders = true,
     maxResults = 20
   }: SearchComponentProps): React.ReactNode {
     // Implementation
   }
   ```

13. **Property-Specific Type Guards**:
   ```typescript
   // Type guard for a specific property
   function hasCoverUrl(obj: unknown): obj is { coverUrl: string } {
     return obj !== null && 
            typeof obj === 'object' && 
            'coverUrl' in obj && 
            typeof (obj as { coverUrl?: unknown }).coverUrl === 'string';
   }

   // Safe property access with type guard
   const coverImage = hasCoverUrl(manga) 
     ? manga.coverUrl 
     : '/default-cover.jpg';
   ```

14. **Array Validation Before Operations**:
   ```typescript
   // Before mapping or filtering, validate array type
   if (Array.isArray(data.chapters)) {
     // First filter out invalid items
     const validChapters = data.chapters.filter(isValidChapter);
     
     // Then perform operations on validated data
     const chapterList = validChapters.map(chapter => ({
       id: chapter.id,
       title: chapter.title,
       // Additional properties
     }));
   } else {
     // Handle non-array case
     console.warn('Expected chapters to be an array, but received:', typeof data.chapters);
   }
   ```

15. **Explicit AsyncResult Generic Type Parameters**:
   ```typescript
   // Always specify both success and error types explicitly
   const result = createSuccessResult<MangaEntity, Error>(mangaData);
   
   // In state initialization
   const [state, setState] = useState<AsyncResult<MangaEntity, Error>>(
     createIdleResult<MangaEntity, Error>()
   );
   
   // When setting new state
   setState(createLoadingResult<MangaEntity, Error>());
   ```

16. **Safe Property Access with Optional Chaining and Type Guards**:
   ```typescript
   // Check if object and its properties exist before access
   const hasTitle = manga && 
     typeof manga === 'object' && 
     'metadata' in manga && 
     manga.metadata && 
     typeof manga.metadata === 'object' && 
     'title' in manga.metadata && 
     typeof manga.metadata.title === 'string';

   // Safe access with fallback
   const title = hasTitle ? manga.metadata.title : 'Unknown';

   // Alternatively, use optional chaining with nullish coalescing
   const title = manga?.metadata?.title ?? 'Unknown';
   ```

17. **Safe Function Access with Type Checking**:
   ```typescript
   // Check if the function exists before calling it
   if (typeof refetch === 'function') {
     await refetch();
   }

   // For objects with methods, check both object and function
   if (query && 
       typeof query === 'object' && 
       'refetch' in query && 
       typeof query.refetch === 'function') {
     await query.refetch();
   }
   ```

18. **Mock Implementations for TRPC Queries**:
   ```typescript
   // Create a mock object with proper typing
   const mockQuery = {
     data: null as T | null,
     isLoading: false,
     error: null as Error | null,
     refetch: async () => ({ data: null as T | null }),
     isFetching: false
   };

   // Create safe access to TRPC methods
   const query = (() => {
     try {
       // Check if the method exists
       if (trpc.entity?.method?.useQuery && 
           typeof trpc.entity.method.useQuery === 'function') {
         return trpc.entity.method.useQuery(params);
       }
       // Return mock if method doesn't exist
       return mockQuery;
     } catch (error) {
       console.error('Error in query:', error);
       return mockQuery;
     }
   })();
   ```

19. **Relative Path Imports (Avoid Aliases)**:
   ```typescript
   // INCORRECT - Using alias imports
   import { trpc } from '@/utils/trpcClient';
   import { MangaEntity } from '@/types/manga';

   // CORRECT - Using relative path imports
   import { trpc } from '../utils/trpcClient';
   import { MangaEntity } from '../types/manga';
   ```

20. **Auth Type Compatibility**:
   ```typescript
   // When working with auth.js/NextAuth types that might conflict
   // Use explicit casting and @ts-ignore where necessary
   // @ts-ignore - Type incompatibility between auth versions
   const session = await getServerSession(req, res, authOptions);

   // Convert enum types to strings to avoid conflicts
   const role = String(user.role);
   ```

21. **Minimal `any` Type Usage**:
   ```typescript
   // Exception: When parsing unknown JSON from database or external sources
   let metadata: any = {};
   
   if (settings?.metadata) {
     try {
       metadata = typeof settings.metadata === 'string' 
         ? JSON.parse(settings.metadata) 
         : settings.metadata;
     } catch (error) {
       logger.error('Failed to parse metadata', error);
     }
   }
   
   // Immediately validate and type the parsed data
   const providers = metadata.providers || {};
   ```

22. **Environment Variable Type Safety**:
   ```typescript
   // Create a typed environment configuration module
   import { z } from 'zod';
   
   const envSchema = z.object({
     DATABASE_URL: z.string().url().optional(),
     NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
     KAIZOKU_PORT: z.string().default('3000'),
     // ... other environment variables
   });
   
   export type ServerEnv = z.infer<typeof envSchema>;
   
   // Parse and validate at module load time
   export const env = envSchema.parse(process.env);
   ```

23. **Logger Error Parameter Typing**:
   ```typescript
   // Always handle unknown error types in logger calls
   logger.error('Operation failed', error instanceof Error ? error.message : String(error));
   
   // For structured logging with error objects
   logger.error({ 
     error: error instanceof Error ? error : { message: String(error) }
   }, 'Operation failed');
   ```

24. **Comprehensive System Status Types**:
   ```typescript
   // When building complex status objects, type each section
   interface SystemStatus {
     status: 'ok' | 'error' | 'degraded';
     database: {
       name: string;
       host: string;
       port: string;
       user: string;
       isConnected: boolean;
       stats: {
         mangaCount: number;
         chapterCount: number;
         libraryCount: number;
         taskCount: number;
         outOfSyncCount: number;
         queueCount: number;
         batchOperationCount: number;
       };
     };
     system: {
       platform: NodeJS.Platform;
       arch: string;
       cpus: os.CpuInfo[];
       totalMemory: number;
       freeMemory: number;
       uptime: number;
       loadAvg: number[];
       hostname: string;
       networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
       // Extended metrics
       cpu: { usage: number };
       memory: { usagePercent: number };
       disk: { usagePercent: number };
       network: { connections: number; requestRate: number };
     };
     docker: {
       isDocker: boolean;
       containerInfo: {
         port: string;
         timezone: string;
       } | null;
     };
     application: {
       version: string;
       nodeEnv: string;
       port: string;
       nodeVersion: string;
       startTime: string;
     };
     integrations: IntegrationStatus;
   }
   ```

## Code Consolidation and Shared Utilities (January 2025)

### Background
A comprehensive code duplication analysis identified 435+ lines of duplicate code that has been consolidated into reusable utilities and base class methods. This significantly improves maintainability and reduces the risk of copy-paste errors.

### Shared Utilities and Patterns

#### 1. **Base Download Client Template Methods**
Located in `src/server/services/download/base.ts`:

```typescript
// Use these methods in download client implementations to eliminate boilerplate
protected async executeAsyncOperation<T>(
  asyncOperation: () => Promise<AsyncResult<T, Error>>,
  operationName: string
): Promise<T>

protected async wrapAsyncOperation<T>(
  asyncOperation: () => Promise<AsyncResult<T, Error>>,
  operationName: string
): Promise<AsyncResult<T, Error>>
```

**When to use:**
- `executeAsyncOperation`: When you need to unwrap AsyncResult to return a plain Promise
- `wrapAsyncOperation`: When the interface requires AsyncResult but you need consistent error handling

#### 2. **Base Integration Adapter Method**
Located in `src/utils/integration-adapter.ts`:

```typescript
// Use this method in all adapter implementations
protected async unwrapAsyncResult<T>(
  asyncFn: () => Promise<AsyncResult<T, Error>>,
  methodName: string
): Promise<T>
```

**When to use:**
- In all metadata adapter implementations when the interface requires Promise returns
- Replaces the pattern: `if (isSuccess(result)) return result.data; if (isError(result)) throw result.error;`

#### 3. **Shared useAsyncOperation Hook**
Located in `src/hooks/useAsyncOperation.tsx`:

```typescript
import { useAsyncOperation, fromPromiseCatch, withAsyncOperation } from './useAsyncOperation';

// For complex async operations with state management
const operation = useAsyncOperation(
  async (params) => await api.call(params),
  { 
    successMessage: 'Operation completed',
    errorMessage: 'Operation failed'
  }
);

// For converting promises to AsyncResult
const result = await fromPromiseCatch(
  () => api.fetchData(),
  'Failed to fetch data'
);

// For one-off operations with loading state
const result = await withAsyncOperation(
  () => api.update(data),
  setLoading,
  onSuccess,
  onError
);
```

**When to use:**
- `useAsyncOperation`: For hooks that need async state management with notifications
- `fromPromiseCatch`: To convert standard Promises to AsyncResult pattern
- `withAsyncOperation`: For simple operations that just need loading state

### Implementation Guidelines

1. **NEVER duplicate these patterns** - always use the shared utilities:
   - AsyncResult unwrapping logic
   - Promise to AsyncResult conversion
   - Async operation state management
   - Error handling and notification patterns

2. **When creating new adapters or clients:**
   - Extend the appropriate base class
   - Use the template methods for AsyncResult handling
   - Don't reimplement the unwrapping logic

3. **When creating new hooks with async operations:**
   - Import and use `useAsyncOperation` for state management
   - Import `fromPromiseCatch` instead of reimplementing it
   - Use consistent notification patterns

4. **Benefits of using shared utilities:**
   - Reduces code duplication (435+ lines eliminated)
   - Ensures consistent error handling
   - Makes the codebase more maintainable
   - Reduces bugs from copy-paste errors
   - Provides a single point of truth for common patterns

### Examples of Refactored Code

**Before (duplicate pattern):**
```typescript
async search(query: string): Promise<Result[]> {
  const result = await this.searchAsync(query);
  if (isSuccess(result)) return result.data;
  if (isError(result)) throw result.error;
  throw new Error('Unknown state in search');
}
```

**After (using shared utility):**
```typescript
async search(query: string): Promise<Result[]> {
  return this.unwrapAsyncResult(
    () => this.searchAsync(query),
    'search'
  );
}
```

This consolidation makes the codebase cleaner, more maintainable, and easier to work with.

---

## 🛡️ PREVENTIVE RULES - Type Safety & Code Quality (October 2025)

**CRITICAL**: These rules MUST be followed for ALL new code and ALL code modifications to prevent technical debt.

### 1. ❌ ABSOLUTE PROHIBITIONS

#### 1.1 Type Safety Violations
```typescript
// ❌ NEVER do this:
const data: any = fetchData();
const result = obj as any;
function process(input: Record<string, any>) { }

// ✅ ALWAYS do this:
const data: unknown = fetchData();
if (isValidData(data)) {
  // Type-safe usage
}

interface DataShape {
  id: number;
  name: string;
}

function isValidData(obj: unknown): obj is DataShape {
  return typeof obj === 'object' &&
         obj !== null &&
         'id' in obj &&
         'name' in obj;
}
```

#### 1.2 Logging Violations
```typescript
// ❌ NEVER use console.log in source code
console.log('Debug info');
console.info('User action');

// ✅ ALWAYS use the logger
import { logger } from '@/utils/logger';

logger.info('Debug info', { context });
logger.error('Error occurred', error instanceof Error ? error : new Error(String(error)));
```

#### 1.3 Error Handling Violations
```typescript
// ❌ NEVER throw generic errors
throw new Error('Failed');
throw 'Something went wrong';

// ✅ ALWAYS use custom error classes
import { DatabaseError, ValidationError, NotFoundError } from '@/utils/errors';

throw new DatabaseError('Connection failed', { host, port });
throw new ValidationError('Invalid input', { field: 'email', reason: 'format' });
throw new NotFoundError('User', userId);
```

### 2. 📏 FILE SIZE LIMITS (Enforced by CI/CD)

#### 2.1 Maximum File Sizes
- **Components**: Max 500 lines
- **Services**: Max 1,000 lines
- **Routers**: Max 800 lines
- **Utilities**: Max 600 lines
- **Tests**: Max 800 lines

#### 2.2 What to Do When Exceeding Limits
```typescript
// If component exceeds 500 lines:
// 1. Extract presentational components
// 2. Create custom hooks for logic
// 3. Split into feature modules

// Before: 800 line component
function MangaDetail() {
  // 800 lines of mixed logic and UI
}

// After: Split into modules
// MangaDetail.tsx (main, ~200 lines)
function MangaDetail() {
  const { manga, loading } = useMangaDetail();
  return <MangaDetailPresenter manga={manga} loading={loading} />;
}

// MangaDetailPresenter.tsx (~200 lines)
// useMangaDetail.ts hook (~200 lines)
// MangaMetadata.tsx component (~200 lines)
```

### 3. 🔗 IMPORT RULES (ESLint Enforced)

#### 3.1 Always Use Path Aliases
```typescript
// ❌ NEVER use deep relative imports
import { util } from '../../../../../utils/helper';
import { MangaEntity } from '../../../types/domain/manga';

// ✅ ALWAYS use path aliases
import { util } from '@/utils/helper';
import { MangaEntity } from '@/types/domain/manga';
```

#### 3.2 Import Organization
```typescript
// ✅ Proper import order:
// 1. React and external libraries
import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@mantine/core';

// 2. Internal absolute imports (@/)
import { trpc } from '@/utils/trpc-client';
import { MangaEntity } from '@/types/domain/manga';

// 3. Types
import type { AsyncResult } from '@/utils/async-result';

// 4. Relative imports (only for same-feature files)
import { MangaCard } from './MangaCard';
```

### 4. 🧪 TESTING REQUIREMENTS (Pre-commit Enforced)

#### 4.1 Mandatory Test Coverage
- **Every new feature**: Must have tests
- **Every bug fix**: Must have regression test
- **Minimum coverage**: 60% for new code
- **Services**: 80% minimum coverage
- **Utilities**: 90% minimum coverage

#### 4.2 Test Patterns
```typescript
// ✅ Always test:
// 1. Happy path
test('should import manga successfully', async () => {
  const result = await importManga(validData);
  expect(result).toMatchObject({ id: expect.any(Number) });
});

// 2. Error cases
test('should handle invalid data', async () => {
  await expect(importManga(invalidData))
    .rejects.toThrow(ValidationError);
});

// 3. Edge cases
test('should handle empty results', async () => {
  const results = await searchManga('nonexistent');
  expect(results).toEqual([]);
});
```

### 5. ⚠️ ERROR HANDLING (Mandatory)

#### 5.1 Async Function Requirements
```typescript
// ❌ NEVER have unhandled async functions
async function fetchData() {
  const result = await api.call(); // No error handling!
  return result;
}

// ✅ ALWAYS handle errors
async function fetchData(): Promise<AsyncResult<Data, Error>> {
  try {
    const result = await api.call();
    return createSuccessResult(result);
  } catch (error) {
    logger.error('Failed to fetch data', error instanceof Error ? error : new Error(String(error)));
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to fetch data')
    );
  }
}
```

#### 5.2 React Error Boundaries
```typescript
// ✅ Every route must have error boundary
// src/pages/manga/[id].tsx
function MangaDetailPage() {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error) => logger.error('Page error', error)}
    >
      <MangaDetail />
    </ErrorBoundary>
  );
}
```

### 6. 📝 PRE-COMMIT CHECKLIST (Automated)

**Before EVERY commit, the following MUST pass:**

```bash
# 1. Type check (0 errors)
✅ bun run type-check

# 2. Linting (max 10 warnings)
✅ bun run lint

# 3. Unit tests (all passing)
✅ bun run test

# 4. No console.log statements
✅ git diff --cached | grep -i "console\\.log" && exit 1

# 5. Proper error handling
✅ Check all async functions have try/catch

# 6. JSDoc on public functions
✅ Check exported functions have JSDoc

# 7. File size limits
✅ Check no files exceed limits
```

### 7. 🎨 CODE STYLE RULES

#### 7.1 Type Annotations
```typescript
// ✅ Always annotate:
// - Function parameters
// - Function return types
// - Complex variables
// - Exported constants

function processData(
  input: MangaData,           // ✅ Parameter typed
  options: ProcessOptions     // ✅ Parameter typed
): ProcessedResult {          // ✅ Return type
  const result: ProcessedResult = { /* ... */ };  // ✅ Complex variable typed
  return result;
}

// Exported constants
export const DEFAULT_CONFIG: Config = { /* ... */ };  // ✅ Typed
```

#### 7.2 Nullish Coalescing
```typescript
// ❌ NEVER use || for defaults (can override falsy values)
const limit = options.limit || 20;  // Bad: 0 becomes 20

// ✅ ALWAYS use ?? (only overrides null/undefined)
const limit = options.limit ?? 20;  // Good: 0 stays 0
```

#### 7.3 Type Guards
```typescript
// ✅ Always create type guards for unknown data
function isMangaResult(obj: unknown): obj is MangaSearchResult {
  return typeof obj === 'object' &&
         obj !== null &&
         'id' in obj &&
         'title' in obj &&
         typeof (obj as any).id === 'number' &&
         typeof (obj as any).title === 'string';
}

// Use in code
const data: unknown = await fetchData();
if (isMangaResult(data)) {
  // Type-safe usage
  console.log(data.title);
}
```

### 8. 🔄 ASYNC PATTERNS (Required)

#### 8.1 AsyncResult Pattern
```typescript
// ✅ All async operations use AsyncResult
import { AsyncResult, createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';

async function fetchManga(id: number): Promise<AsyncResult<Manga, Error>> {
  try {
    const manga = await db.manga.findUnique({ where: { id } });
    if (!manga) {
      return createErrorResult(new NotFoundError('Manga', id));
    }
    return createSuccessResult(manga);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to fetch manga')
    );
  }
}

// Usage with type guards
const result = await fetchManga(1);
if (isSuccess(result)) {
  console.log(result.data.title);
} else if (isError(result)) {
  logger.error('Fetch failed', result.error);
}
```

#### 8.2 Timeout Protection
```typescript
// ✅ All external calls must have timeouts
async function fetchWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
  );

  return Promise.race([fn(), timeoutPromise]);
}

// Usage
const data = await fetchWithTimeout(
  () => api.fetchManga(id),
  5000  // 5 second timeout
);
```

### 9. 🏗️ ARCHITECTURE PATTERNS (Mandatory)

#### 9.1 Component Structure
```typescript
// ✅ Container/Presenter pattern for complex components

// Container (logic)
function MangaListContainer() {
  const { data, isLoading } = useManga();
  const [selected, setSelected] = useState<number[]>([]);

  return (
    <MangaListPresenter
      manga={data ?? []}
      isLoading={isLoading}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

// Presenter (UI only)
interface MangaListPresenterProps {
  manga: Manga[];
  isLoading: boolean;
  selected: number[];
  onSelect: (ids: number[]) => void;
}

function MangaListPresenter({
  manga,
  isLoading,
  selected,
  onSelect
}: MangaListPresenterProps) {
  if (isLoading) return <LoadingSpinner />;
  // ... UI only
}
```

#### 9.2 Custom Hooks
```typescript
// ✅ Extract logic into custom hooks

// useMangaDetail.ts
export function useMangaDetail(id: number) {
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await fetchManga(id);

      if (cancelled) return;

      if (isSuccess(result)) {
        setManga(result.data);
        setError(null);
      } else if (isError(result)) {
        setError(result.error);
        setManga(null);
      }

      setLoading(false);
    }

    load();

    return () => { cancelled = true; };
  }, [id]);

  return { manga, loading, error };
}
```

### 10. 📊 PERFORMANCE RULES

#### 10.1 Memoization
```typescript
// ✅ Memoize expensive computations
function MangaList({ manga, sortBy }: Props) {
  const sortedManga = useMemo(
    () => [...manga].sort((a, b) => {
      // Expensive sort logic
      return sortBy === 'title'
        ? a.title.localeCompare(b.title)
        : a.updatedAt - b.updatedAt;
    }),
    [manga, sortBy]  // Only recompute when these change
  );

  return <>{sortedManga.map(/* ... */)}</>;
}
```

#### 10.2 Code Splitting
```typescript
// ✅ Lazy load routes and heavy components
import { lazy, Suspense } from 'react';

const MangaDetail = lazy(() => import('@/features/manga/detail'));
const Settings = lazy(() => import('@/features/settings'));

function Routes() {
  return (
    <Switch>
      <Route path="/manga/:id">
        <Suspense fallback={<LoadingSpinner />}>
          <MangaDetail />
        </Suspense>
      </Route>
      <Route path="/settings">
        <Suspense fallback={<LoadingSpinner />}>
          <Settings />
        </Suspense>
      </Route>
    </Switch>
  );
}
```

### 11. 🔐 SECURITY RULES

#### 11.1 Input Validation
```typescript
// ✅ Validate ALL external input with Zod
import { z } from 'zod';

const mangaInputSchema = z.object({
  title: z.string().min(1).max(255),
  libraryId: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).max(50).optional()
});

export const addManga = protectedProcedure
  .input(mangaInputSchema)
  .mutation(async ({ input, ctx }) => {
    // input is fully validated and typed
  });
```

#### 11.2 Authorization Checks
```typescript
// ✅ Always check authorization
export const requireAdmin = async (ctx: Context) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
};

export const adminProcedure = protectedProcedure.use(requireAdmin);

// Usage
export const deleteAllData = adminProcedure
  .mutation(async ({ ctx }) => {
    // Only admins can reach here
  });
```

### 12. 📚 DOCUMENTATION RULES

#### 12.1 JSDoc Requirements
```typescript
// ✅ All exported functions MUST have JSDoc

/**
 * Searches for manga across multiple providers
 *
 * @param query - Search query string (min 3 characters)
 * @param options - Search options
 * @param options.providers - Providers to search (default: all)
 * @param options.limit - Max results per provider (default: 20)
 *
 * @returns Promise resolving to grouped search results
 *
 * @throws {ValidationError} If query is invalid
 * @throws {ProviderError} If all providers fail
 *
 * @example
 * ```typescript
 * const results = await searchManga('One Piece', {
 *   providers: ['anilist', 'mangadex'],
 *   limit: 10
 * });
 * ```
 */
export async function searchManga(
  query: string,
  options?: SearchOptions
): Promise<SearchResults> {
  // Implementation
}
```

#### 12.2 Complex Logic Comments
```typescript
// ✅ Explain WHY, not WHAT
function calculateRelevanceScore(result: SearchResult, query: string): number {
  // Boost exact title matches by 50% since they're usually what users want,
  // even if other fields might have higher text similarity scores
  const titleMatch = result.title.toLowerCase() === query.toLowerCase();
  const baseScore = calculateTextSimilarity(result, query);

  return titleMatch ? baseScore * 1.5 : baseScore;
}
```

### 13. 🚫 ANTI-PATTERNS TO AVOID

#### 13.1 State Management Anti-Patterns
```typescript
// ❌ NEVER mutate state directly
const [items, setItems] = useState<Item[]>([]);
items.push(newItem);  // WRONG!

// ✅ ALWAYS create new state
setItems(prev => [...prev, newItem]);  // CORRECT
```

#### 13.2 Async Anti-Patterns
```typescript
// ❌ NEVER use async without await or .catch()
async function badExample() {
  apiCall();  // Promise not awaited, errors silently swallowed!
}

// ✅ ALWAYS handle async properly
async function goodExample() {
  try {
    await apiCall();
  } catch (error) {
    logger.error('API call failed', error);
  }
}
```

#### 13.3 Type Assertion Anti-Patterns
```typescript
// ❌ NEVER use non-null assertion
const value = dangerousValue!;  // DANGEROUS!

// ✅ ALWAYS check for null/undefined
if (dangerousValue) {
  const value = dangerousValue;  // SAFE
}
```

### 14. 🎯 ENFORCEMENT MECHANISMS

#### 14.1 Pre-commit Hooks
Located in `.husky/pre-commit`:
- ✅ TypeScript type check (0 errors)
- ✅ ESLint check (max 10 warnings)
- ✅ No console.log statements
- ✅ File size validation
- ✅ Test execution

#### 14.2 CI/CD Pipeline
- ✅ Full test suite (80% coverage minimum)
- ✅ Performance benchmarks
- ✅ Bundle size limits
- ✅ Security scans
- ✅ Dependency audits

#### 14.3 Code Review Checklist
- ✅ Type safety (no `any` types)
- ✅ Error handling (all async functions)
- ✅ Tests (coverage targets met)
- ✅ Documentation (JSDoc on exports)
- ✅ Performance (no unnecessary re-renders)
- ✅ Security (input validation, auth checks)

---

## 🚀 QUICK REFERENCE CARD

### Before Writing Code
1. ✅ Check if feature needs tests (YES for all features)
2. ✅ Verify type safety approach (use type guards, no `any`)
3. ✅ Plan error handling strategy (AsyncResult pattern)
4. ✅ Review file size limits (split if needed)

### While Writing Code
1. ✅ Use logger (NEVER console.log)
2. ✅ Use path aliases (NEVER deep relative imports)
3. ✅ Handle all errors (try/catch or AsyncResult)
4. ✅ Add JSDoc to exports

### Before Committing
1. ✅ Run `bun run type-check` (0 errors)
2. ✅ Run `bun run lint` (max 10 warnings)
3. ✅ Run `bun run test` (all passing)
4. ✅ Review changes for console.log
5. ✅ Verify tests added/updated

### Code Review
1. ✅ Type safety verified
2. ✅ Error handling complete
3. ✅ Tests adequate
4. ✅ Documentation present
5. ✅ Performance considered

---

**Last Updated**: October 2, 2025
**Next Review**: Weekly during technical debt resolution