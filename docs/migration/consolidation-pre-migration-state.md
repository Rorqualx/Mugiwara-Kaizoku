# Pre-Migration State Documentation
**Date**: September 1, 2025  
**Branch**: consolidation/api-to-server  
**Backup**: backup/api-directory-20250901-151302.tar.gz

## Current State Summary

### Directory Statistics
- **api/ directory**: 87 TypeScript files
- **server/ directory**: 335+ TypeScript files
- **Files importing from api/**: 75 files
- **Components affected**: 5 files (Prowlarr and Suwayomi settings)

### API Directory Structure
```
src/api/
├── base/               # Base classes (MetadataProvider, DownloadClient, etc.)
├── downloadClients/    # 4 download client implementations
├── metadataProviders/  # 58 files
│   ├── adapters/      # Provider adapters
│   ├── anilist/       # AniList-specific modules
│   ├── comicvine/     # ComicVine-specific modules
│   ├── scrapers/      # Web scraping utilities
│   └── utils/         # Provider utilities
├── notifications/      # 13 files
│   ├── adapters/      # Notification adapters (Discord, Email, etc.)
│   ├── base/          # Base notification classes
│   ├── factory/       # Factory pattern implementation
│   └── utils/         # Notification utilities
└── utils/             # Shared utilities

Total: 87 files
```

### Import Dependencies

#### Top Import Consumers
1. **Components (5 files)**:
   - `src/components/settings/prowlarr/IndexerList.tsx`
   - `src/components/settings/prowlarr/ProwlarrConfig.tsx`
   - `src/components/settings/prowlarr/ProwlarrIndexerList.tsx`
   - `src/components/settings/prowlarr/ProwlarrTest.tsx`
   - `src/components/settings/suwayomi/SuwayomiSourceList.tsx`

2. **API Routes (20+ files)**:
   - Various files in `src/pages/api/v1/`
   - Health, metrics, monitoring endpoints

3. **Contexts (1 file)**:
   - `src/contexts/ProwlarrContext.tsx`

4. **Examples and Tests**:
   - `src/examples/notification-integration-examples.ts`
   - Various test files

5. **Internal API Cross-references**:
   - `src/api/base/HttpClient.ts`
   - `src/api/metadataProviders/adapters/anilistAdapter.ts`
   - `src/api/metadataProviders/adapters/fandomAdapter.ts`

### Identified Duplications

#### Complete Duplicates (Files with identical functionality)
1. **Notification Adapters** (5 files):
   - Discord, Email, Slack, Telegram, Webhook adapters exist in both:
     - `src/api/notifications/adapters/`
     - `src/server/adapters/notifications/`

2. **Download Clients**:
   - Transmission client exists in both:
     - `src/api/downloadClients/transmissionClient.ts`
     - `src/server/adapters/download/transmission.ts`

3. **Metadata Providers**:
   - AniList: `api/metadataProviders/anilistClient.ts` vs `server/services/anilist/`
   - ComicVine: `api/metadataProviders/comicvineClient.ts` vs `server/services/comicvine/`
   - Fandom: `api/metadataProviders/fandomClient.ts` vs `server/services/fandom/`

#### Unique Files to Migrate
1. **Base Classes** (5 files in `api/base/`)
2. **Unique Adapters**:
   - `suwayomiAdapter.ts`
   - `wikipediaAdapter.ts`
   - `websiteProviderAdapter.ts`
   - `baseKapowarrAdapter.ts`
   - `exampleMangaAdapter.ts`
   - `adapter-template.ts`
3. **Provider Modules**:
   - AniList modules (pagination, fragments, sorting, etc.)
   - ComicVine modules (rateLimiter, cache, etc.)
4. **Scrapers and Utils**

### TypeScript Configuration
Current paths in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Build Status (Pre-Migration)
```bash
# Current TypeScript errors: 0
# Build status: Success
# Test status: Unknown (to be checked)
```

## Migration Readiness Checklist

✅ **Completed**:
- [x] Feature branch created: `consolidation/api-to-server`
- [x] Backup created: `backup/api-directory-20250901-151302.tar.gz`
- [x] Import analysis complete: 75 files identified
- [x] Migration script tested (dry-run successful)
- [x] Pre-migration state documented

⬜ **Ready to Proceed**:
- [ ] Execute actual migration
- [ ] Update imports
- [ ] Run type checking
- [ ] Fix any TypeScript errors
- [ ] Run tests
- [ ] Validate functionality

## Risk Assessment

### Low Risk ✅
- Small directory to migrate (87 files)
- Automated script tested successfully
- Backup created
- Clear rollback path

### Medium Risk ⚠️
- 75 files need import updates
- Some files have complex import patterns
- Test coverage unknown for affected areas

### Mitigation
- Feature branch isolates changes
- Backup allows full restoration
- Dry-run validated script logic
- Import update script handles most cases automatically

## Next Steps

1. **Execute Migration**:
   ```bash
   bash scripts/consolidate-api-to-server.sh
   ```

2. **Validate Changes**:
   ```bash
   pnpm type-check
   pnpm build:clean
   pnpm test
   ```

3. **Manual Testing**:
   - Test Prowlarr integration
   - Test Suwayomi integration
   - Test notification sending
   - Test metadata providers
   - Test download clients

## Rollback Plan

If issues arise:
```bash
# Option 1: Restore from backup
tar -xzf backup/api-directory-20250901-151302.tar.gz -C src/

# Option 2: Git reset
git reset --hard HEAD
git checkout main
git branch -D consolidation/api-to-server
```

## Expected Outcomes

After successful migration:
- **File reduction**: ~40% fewer duplicate files
- **Import simplification**: All imports from `server/`
- **Architecture clarity**: Single source of truth
- **Bundle size**: Expected 25% reduction
- **Maintenance**: Significantly easier

---

**Status**: Ready to proceed with Phase 2 (Actual Migration)