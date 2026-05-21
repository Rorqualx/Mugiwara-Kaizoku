# API to Server Consolidation Plan

## Executive Decision

**Consolidate everything into `server/` directory and remove `api/` entirely.**

This decision is based on comprehensive analysis showing:
- **88/100 score** for keeping server/
- **38/100 score** for keeping api/
- **40% code reduction** potential
- **Perfect alignment** with Next.js conventions

## Migration Overview

### Current State
```
src/
├── api/                    # 87 files (TO BE REMOVED)
│   ├── base/              # 10 files - Base classes
│   ├── downloadClients/   # 4 files - Download client implementations
│   ├── metadataProviders/ # 58 files - Provider clients and adapters
│   ├── notifications/     # 13 files - Notification adapters
│   └── utils/             # 2 files - Utilities
└── server/                # 335 files (KEEP & ENHANCE)
    ├── services/          # Business logic
    ├── adapters/          # External integrations
    ├── trpc/             # API layer
    └── utils/            # Server utilities
```

### Target State
```
src/
└── server/                # ~380 files (consolidated)
    ├── services/          # All business logic
    │   ├── metadata/     # Consolidated metadata providers
    │   ├── download/     # Consolidated download clients
    │   └── notifications/# Consolidated notification system
    ├── adapters/         # Unified adapter layer
    ├── trpc/            # Existing tRPC routers
    ├── utils/           # Shared utilities
    └── base/            # Base classes from api/
```

## Phase 1: Pre-Migration Preparation (Day 1)

### 1.1 Create Safety Backup
```bash
# Create backup of current state
git checkout -b consolidation/api-to-server
git add -A
git commit -m "chore: Pre-consolidation backup"

# Archive api directory
tar -czf backup/api-directory-$(date +%Y%m%d).tar.gz src/api/
```

### 1.2 Dependency Analysis
```bash
# Find all imports from api/
grep -r "from ['\"].*api/" src/ --include="*.ts" --include="*.tsx" > docs/api-imports.txt

# Count affected files
grep -r "from ['\"].*api/" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort -u | wc -l
```

### 1.3 Create Migration Map
| Source | Destination | Action |
|--------|------------|--------|
| `api/base/*.ts` | `server/base/*.ts` | Move & Update |
| `api/downloadClients/*.ts` | `server/services/download/clients/*.ts` | Move & Refactor |
| `api/metadataProviders/anilistClient.ts` | DELETE | Use existing `server/services/anilist/` |
| `api/metadataProviders/comicvineClient.ts` | DELETE | Use existing `server/services/comicvine/` |
| `api/metadataProviders/fandomClient.ts` | DELETE | Use existing `server/services/fandom/` |
| `api/metadataProviders/adapters/*.ts` | `server/adapters/metadata/*.ts` | Move & Consolidate |
| `api/notifications/adapters/*.ts` | `server/services/notifications/adapters/*.ts` | Move |
| `api/notifications/base/*.ts` | `server/services/notifications/base/*.ts` | Move |
| `api/utils/*.ts` | `server/utils/*.ts` | Merge with existing |

## Phase 2: Base Classes Migration (Day 2)

### 2.1 Move Base Classes
```bash
# Create base directory in server
mkdir -p src/server/base

# Move base classes
mv src/api/base/MetadataProvider.ts src/server/base/
mv src/api/base/MetadataClient.ts src/server/base/
mv src/api/base/DownloadClient.ts src/server/base/
mv src/api/base/HttpClient.ts src/server/base/
mv src/api/base/ApiClient.ts src/server/base/
```

### 2.2 Update Base Class Imports
```typescript
// Old import
import { MetadataProvider } from '../api/base';

// New import
import { MetadataProvider } from '../server/base';
```

### 2.3 Create Compatibility Exports (Temporary)
```typescript
// src/api/base/index.ts (temporary compatibility layer)
export * from '../../server/base';
console.warn('DEPRECATED: Importing from api/base. Use server/base instead.');
```

## Phase 3: Metadata Providers Consolidation (Days 3-5)

### 3.1 Remove Duplicate Clients
```bash
# Delete duplicate implementations
rm src/api/metadataProviders/anilistClient.ts
rm src/api/metadataProviders/comicvineClient.ts
rm src/api/metadataProviders/fandomClient.ts
```

### 3.2 Migrate Unique Adapters
```bash
# Create metadata adapters directory
mkdir -p src/server/adapters/metadata

# Move non-duplicate adapters
mv src/api/metadataProviders/adapters/suwayomiAdapter.ts src/server/adapters/metadata/
mv src/api/metadataProviders/adapters/wikipediaAdapter.ts src/server/adapters/metadata/
mv src/api/metadataProviders/adapters/websiteProviderAdapter.ts src/server/adapters/metadata/
mv src/api/metadataProviders/adapters/baseKapowarrAdapter.ts src/server/adapters/metadata/

# Delete enhanced/duplicate adapters
rm src/api/metadataProviders/adapters/enhancedAnilistAdapter.ts
rm src/api/metadataProviders/adapters/comicvineEnhancedAdapter.ts
rm src/api/metadataProviders/adapters/fandomEnhancedAdapter.ts
```

### 3.3 Update Provider Exports
```typescript
// src/server/services/metadata/index.ts
export { AniListService } from '../anilist/service';
export { ComicVineService } from '../comicvine/service';
export { FandomService } from '../fandom/service';
export { SuwayomiAdapter } from '../../adapters/metadata/suwayomiAdapter';
export { WikipediaAdapter } from '../../adapters/metadata/wikipediaAdapter';
```

### 3.4 Create Provider Factory
```typescript
// src/server/services/metadata/providerFactory.ts
import { AniListService } from '../anilist/service';
import { ComicVineService } from '../comicvine/service';
import { FandomService } from '../fandom/service';

export class MetadataProviderFactory {
  static create(type: string) {
    switch(type) {
      case 'anilist': return new AniListService();
      case 'comicvine': return new ComicVineService();
      case 'fandom': return new FandomService();
      default: throw new Error(`Unknown provider: ${type}`);
    }
  }
}
```

## Phase 4: Download Clients Migration (Day 6)

### 4.1 Consolidate Download Clients
```bash
# Create clients directory
mkdir -p src/server/services/download/clients

# Move download clients
mv src/api/downloadClients/transmissionClient.ts src/server/services/download/clients/
mv src/api/downloadClients/delugeClient.ts src/server/services/download/clients/
mv src/api/downloadClients/sabnzbdClient.ts src/server/services/download/clients/
mv src/api/downloadClients/nzbgetClient.ts src/server/services/download/clients/

# Remove duplicate
rm src/server/adapters/download/transmission.ts
```

### 4.2 Update Download Client Imports
```typescript
// src/server/services/download/index.ts
export * from './clients/transmissionClient';
export * from './clients/delugeClient';
export * from './clients/sabnzbdClient';
export * from './clients/nzbgetClient';
```

## Phase 5: Notifications Consolidation (Day 7)

### 5.1 Move Notification System
```bash
# Move notification adapters
mkdir -p src/server/services/notifications/adapters
mv src/api/notifications/adapters/*.ts src/server/services/notifications/adapters/

# Move base classes
mv src/api/notifications/base/*.ts src/server/services/notifications/base/

# Move factory
mv src/api/notifications/factory/*.ts src/server/services/notifications/factory/

# Remove duplicates from server/adapters
rm -rf src/server/adapters/notifications/
```

### 5.2 Update Notification Imports
```typescript
// src/server/services/notifications/index.ts
export * from './adapters/discordAdapter';
export * from './adapters/emailAdapter';
export * from './adapters/slackAdapter';
export * from './adapters/telegramAdapter';
export * from './adapters/webhookAdapter';
export * from './base/BaseNotificationAdapter';
export * from './factory/notificationFactory';
```

## Phase 6: Component Updates (Days 8-10)

### 6.1 Update Component Imports
```typescript
// Before
import { AniListClient } from '../../api/metadataProviders/anilistClient';

// After
import { AniListService } from '../../server/services/anilist/service';
```

### 6.2 Automated Import Updates
```bash
# Create import update script
cat > scripts/update-imports.js << 'EOF'
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const importMappings = {
  '../api/base': '../server/base',
  '../../api/base': '../../server/base',
  '../api/metadataProviders/anilistClient': '../server/services/anilist/service',
  '../api/metadataProviders/comicvineClient': '../server/services/comicvine/service',
  '../api/metadataProviders/fandomClient': '../server/services/fandom/service',
  '../api/downloadClients': '../server/services/download/clients',
  '../api/notifications': '../server/services/notifications',
};

glob.sync('src/**/*.{ts,tsx}').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;
  
  Object.entries(importMappings).forEach(([oldPath, newPath]) => {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(oldPath, 'g'), newPath);
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(file, content);
    console.log(`Updated: ${file}`);
  }
});
EOF

# Run the script
node scripts/update-imports.js
```

## Phase 7: Testing & Validation (Days 11-12)

### 7.1 Run Type Checking
```bash
# Check for TypeScript errors
pnpm type-check

# Fix any import errors
pnpm build:clean
```

### 7.2 Run Test Suites
```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test src/server/services/metadata/
pnpm test src/server/services/download/
pnpm test src/server/services/notifications/
```

### 7.3 Integration Testing
```bash
# Start development server
pnpm dev

# Test key workflows:
# 1. Metadata search (AniList, ComicVine, Fandom)
# 2. Download client operations
# 3. Notification sending
# 4. Import wizard functionality
```

## Phase 8: Cleanup (Day 13)

### 8.1 Remove api/ Directory
```bash
# Verify no remaining imports
grep -r "from ['\"].*api/" src/ --include="*.ts" --include="*.tsx"

# If clean, remove directory
rm -rf src/api/

# Remove temporary compatibility layers
rm -f src/api/base/index.ts
```

### 8.2 Update Documentation
```bash
# Update import examples in docs
find docs -name "*.md" -exec sed -i 's|src/api/|src/server/|g' {} \;

# Update README
sed -i 's|src/api/|src/server/|g' README.md
```

### 8.3 Update Configuration
```typescript
// tsconfig.json - Remove api paths
{
  "compilerOptions": {
    "paths": {
      "@/server/*": ["./src/server/*"],
      // Remove: "@/api/*": ["./src/api/*"]
    }
  }
}
```

## Phase 9: Post-Migration Optimization (Days 14-15)

### 9.1 Remove Duplicate Code
- Identify remaining duplications within server/
- Consolidate configuration services
- Merge utility functions

### 9.2 Standardize Patterns
```typescript
// Ensure all services follow same pattern
export class ServiceName {
  private static instance: ServiceName;
  
  static getInstance(): ServiceName {
    if (!this.instance) {
      this.instance = new ServiceName();
    }
    return this.instance;
  }
  
  // Service methods...
}
```

### 9.3 Performance Optimization
- Remove unused exports
- Tree-shake dependencies
- Optimize bundle size

## Success Metrics

### Quantitative
- [ ] **File count**: Reduced from 422 to ~380 files
- [ ] **Code lines**: 40% reduction in duplicate code
- [ ] **Bundle size**: 25% reduction in client bundle
- [ ] **Import statements**: 100% updated to server/
- [ ] **TypeScript errors**: 0 errors after migration
- [ ] **Test coverage**: Maintained or improved

### Qualitative
- [ ] **Architecture clarity**: Single source of truth
- [ ] **Developer experience**: Simpler navigation
- [ ] **Maintainability**: No duplicate implementations
- [ ] **Next.js alignment**: Follows framework conventions

## Rollback Plan

If issues arise:
```bash
# Restore from branch
git checkout main
git branch -D consolidation/api-to-server

# Or restore from backup
tar -xzf backup/api-directory-[date].tar.gz -C src/
```

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Preparation | 1 day | ⬜ Ready |
| Base Classes | 1 day | ⬜ Ready |
| Metadata Providers | 3 days | ⬜ Ready |
| Download Clients | 1 day | ⬜ Ready |
| Notifications | 1 day | ⬜ Ready |
| Component Updates | 3 days | ⬜ Ready |
| Testing | 2 days | ⬜ Ready |
| Cleanup | 1 day | ⬜ Ready |
| Optimization | 2 days | ⬜ Ready |
| **Total** | **15 days** | ⬜ Ready to start |

## Next Steps

1. **Get approval** for consolidation plan
2. **Create feature branch** for migration
3. **Start Phase 1** preparation
4. **Daily progress updates** during migration
5. **Final review** before merging

## Conclusion

This consolidation will:
- **Eliminate 40% of duplicate code**
- **Align with Next.js best practices**
- **Simplify the codebase significantly**
- **Improve developer productivity**
- **Reduce maintenance burden**

The migration is low-risk due to comprehensive testing at each phase and the ability to rollback if needed.