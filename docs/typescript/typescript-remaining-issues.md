# Typescript Remaining Issues

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Remaining Issues

---
# Remaining TypeScript Issues

This document outlines the remaining TypeScript issues in the codebase that require broader changes beyond the scope of simple file-by-file fixes.

## Categories of Issues

### 1. Module Resolution and Alias Paths

Many files use the `@/` alias path syntax which creates TypeScript errors when running the TypeScript compiler directly. While this works in the Next.js runtime due to the path mapping configuration, it causes TypeScript errors when checking files outside of the Next.js context.

**Affected files:**
- `src/server/trpc/router.ts` with imports like `@/server/services/search/registerProviders`
- `src/server/trpc/routers/manga.ts` with imports like `@/server/services/mangadex/chapter.service`
- `src/server/utils/providerMatcher.ts` with imports like `@/server/services/search/types`

**Resolution approaches:**
- Replace all `@/` imports with relative paths throughout the codebase
- Add `@ts-ignore` comments to affected import statements
- Configure path aliases in the TypeScript compiler options more robustly

### 2. Iterator and Collection Types

Some files use modern JavaScript collection types like `Map` and `Set` with iteration methods that require ES2015 or higher target settings and the `downlevelIteration` flag.

**Affected files:**
- `src/pages/api/events/metadata-updates.ts` with `MapIterator<[string, Client]>`
- `src/server/services/comicvine/service.ts` with `MapIterator<[string, { data: unknown; timestamp: number; }]>`
- `src/server/services/suwayomi/downloadManager.ts` with `Set<string>` iteration

**Resolution approaches:**
- Enable `downlevelIteration` in the tsconfig.json
- Set target to ES2015 or higher in the tsconfig.json
- Refactor code to use array methods instead of iterators

### 3. Modern JavaScript Features

Some files use modern JavaScript features that require ES2018 or higher target settings.

**Affected files:**
- `src/server/services/mangal/manga.service.ts` with RegExp features requiring ES2018
- `src/server/services/mangal/config.service.ts` with Promise types

**Resolution approaches:**
- Set target to ES2018 or higher in the tsconfig.json
- Refactor code to use polyfills or alternative approaches

### 4. Dynamic Imports

Some files use dynamic imports that require specific module settings.

**Affected files:**
- `src/server/services/anilist/service.ts`
- `src/server/services/comicvine/service.ts`
- `src/server/trpc/routers/manga.ts`

**Resolution approaches:**
- Set module to 'esnext', 'commonjs', or another compatible value in the tsconfig.json
- Refactor code to use static imports where possible

## Recommended Approach

For a comprehensive fix, we recommend:

1. Update tsconfig.json with these settings:
   ```json
   {
     "compilerOptions": {
       "target": "ES2018",
       "module": "ESNext",
       "moduleResolution": "node",
       "esModuleInterop": true,
       "allowSyntheticDefaultImports": true,
       "downlevelIteration": true,
       // Other existing settings...
     }
   }
   ```

2. Implement a standardized approach to imports:
   - Either consistently use `@/` alias paths with proper TypeScript configuration
   - Or consistently use relative paths throughout the codebase

3. Add focused @ts-ignore comments only where absolutely necessary:
   - For third-party library compatibility issues
   - For intentional type casts that cannot be expressed otherwise

4. Add clear documentation for any non-obvious type handling patterns:
   - Comments explaining why certain patterns are used
   - References to this document for broader context

## Applying the Fixes

Due to the breadth of these issues, we recommend addressing them in phases:

1. **Phase 1:** Update the TypeScript configuration to accommodate modern JavaScript features
2. **Phase 2:** Standardize the import patterns across the codebase
3. **Phase 3:** Address specific collection and iterator issues
4. **Phase 4:** Clean up remaining @ts-ignore comments where possible

This phased approach allows for incremental improvements while maintaining codebase functionality.