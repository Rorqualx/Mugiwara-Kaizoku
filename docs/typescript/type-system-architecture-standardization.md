# Type System Architecture Standardization

> ⚠️ **CANONICAL DOCUMENTATION** - Last Updated: January 2025
> 
> This document is the authoritative guide for the Mugiwara-Kaizoku type system architecture.

## Overview

This document clarifies the **actual** type system architecture used in Mugiwara-Kaizoku, resolving conflicts between proposed and implemented structures.

## The Actual Type System Structure

```
src/types/
├── domain/          # ✅ Core business logic types
├── adapters/        # ✅ Adapter interfaces and types
├── api/             # ✅ API request/response types
├── mangal/          # ✅ Mangal integration types
├── generated/       # ✅ Auto-generated types
└── [root files]     # ✅ Shared/utility types
```

## Directory Purpose and Contents

### `/src/types/domain/` - Business Domain Types
**Purpose**: Core business entities and logic types

**Key Files**:
- `manga-types.ts` - Core manga entities (Manga, MangaStatus enum)
- `chapter-types.ts` - Chapter entities
- `user-types.ts` - User domain models
- `library-types.ts` - Library management types
- `provider-types.ts` - Provider abstractions
- `search-types.ts` - Search interfaces
- `task-types.ts` - Background task types

**When to Use**: For any core business logic types that represent domain concepts

### `/src/types/adapters/` - Adapter Interfaces
**Purpose**: Type definitions for all adapters

**Key Files**:
- `base.ts` - Base adapter interfaces
- `anilist.ts` - AniList adapter types
- `mangadex.ts` - MangaDex adapter types
- `comicvine.ts` - ComicVine adapter types
- `fandom.ts` - Fandom adapter types

**When to Use**: When implementing or using adapter functionality

### `/src/types/api/` - API Layer Types
**Purpose**: API request/response types

**Key Files**:
- `requests.ts` - API request DTOs
- `responses.ts` - API response DTOs
- `error-types.ts` - API error structures

**When to Use**: For API endpoints, request validation, response formatting

### `/src/types/mangal/` - Mangal Integration Types
**Purpose**: Types for mangal CLI integration

**Key Files**:
- `manga.ts` - Mangal manga types
- `chapter.ts` - Mangal chapter types
- `config.ts` - Mangal configuration types
- `common.ts` - Shared mangal types

**When to Use**: When working with mangal CLI integration

### Root Level Types - Shared/Utility Types
**Purpose**: Types used across multiple domains

**Key Files**:
- `common.ts` - Common utility types
- `component-types.ts` - React component props
- `store-types.ts` - Zustand store types
- `error-types.ts` - General error types
- `prisma-exports.ts` - Prisma generated exports

**When to Use**: For cross-cutting concerns or utilities

## Important Clarifications

### 1. Proposed vs Actual Structure

**❌ INCORRECT (Proposed but not implemented)**:
```
/src/types/dto/        # Does NOT exist
/src/types/utils/      # Does NOT exist
/src/types/components/ # Does NOT exist
```

**✅ CORRECT (Actually implemented)**:
- Component types are in root level `component-types.ts`
- Utility types are in root level files
- DTOs are in `/src/types/api/`

### 2. File Naming Conventions

- Domain types: `{entity}-types.ts` (e.g., `manga-types.ts`)
- Adapter types: `{adapter-name}.ts` (e.g., `anilist.ts`)
- API types: `{layer}.ts` (e.g., `requests.ts`)
- Utilities: `{purpose}.ts` (e.g., `common.ts`)

### 3. Import Patterns

```typescript
// ✅ CORRECT - Import from specific files
import type { Manga, MangaPublicationStatus } from '@prisma/client';
import type { MangaWithMetadata } from '@/types/manga';
import { AniListAdapter } from '@/types/adapters/anilist';

// ❌ AVOID - Don't use barrel imports from index.ts
import { Manga } from '@/types'; // Too generic
```

## Migration Guidelines

If you find types in the wrong location:

1. **Check if it's actively used** - Don't move types that are working
2. **Create an issue** - Document the inconsistency
3. **Move gradually** - Update imports incrementally
4. **Update docs** - Keep this guide current

## Type Organization Rules

### 1. Domain Isolation
- Domain types should NOT import from adapters or API layers
- Domain types can import from common/shared types

### 2. Adapter Independence
- Each adapter should have self-contained types
- Adapters can import from domain and common

### 3. API Layer Separation
- API types handle serialization/deserialization
- API types can transform to/from domain types

### 4. No Circular Dependencies
- Use type-only imports when needed
- Extract shared interfaces to common files

## Common Mistakes to Avoid

### ❌ Creating New Type Directories
```typescript
// DON'T create new directories without team agreement
/src/types/dto/        // Not part of current architecture
/src/types/utilities/  // Use root level files instead
```

### ❌ Mixing Concerns
```typescript
// DON'T put API types in domain
// domain/manga-types.ts
export interface MangaApiResponse { ... } // Wrong location
```

### ❌ Over-organizing
```typescript
// DON'T create too many subdirectories
/src/types/domain/entities/manga/status/ // Too deep
```

## Quick Reference

| Type Category | Location | Example |
|--------------|----------|---------|
| Business Entities | `/domain/` | `Manga`, `Chapter` |
| Adapter Interfaces | `/adapters/` | `BaseAdapter`, `AniListAdapter` |
| API DTOs | `/api/` | `CreateMangaRequest` |
| Component Props | Root level | `component-types.ts` |
| Store Types | Root level | `store-types.ts` |
| Shared Utils | Root level | `common.ts` |

## Governance

- **Owner**: Core Team
- **Review**: Required for new directories
- **Updates**: Document in this file

---

**Remember**: When in doubt, follow the existing patterns in the codebase rather than proposed documentation.