# API Consolidation - Import Update Guide

## Overview
This document tracks all import statements that need updating during the api/ to server/ consolidation.

## Affected Files Count
- **Total files with api/ imports**: ~10-15 files
- **Components**: 5 files (Prowlarr and Suwayomi settings)
- **Server files**: ~5 files (cross-references)
- **Tests**: Unknown (to be discovered during migration)

## Import Mapping Reference

### Base Classes
| Old Import | New Import |
|------------|------------|
| `from '../api/base'` | `from '../server/base'` |
| `from '../../api/base'` | `from '../../server/base'` |
| `from '../../../api/base'` | `from '../../../server/base'` |
| `from '@/api/base'` | `from '@/server/base'` |

### Metadata Providers

#### AniList
| Old Import | New Import |
|------------|------------|
| `from '../api/metadataProviders/anilistClient'` | `from '../server/services/anilist/service'` |
| `from '@/api/metadataProviders/anilistClient'` | `from '@/server/services/anilist/service'` |
| `from '../api/metadataProviders/anilist/*'` | `from '../server/services/anilist/modules/*'` |

#### ComicVine
| Old Import | New Import |
|------------|------------|
| `from '../api/metadataProviders/comicvineClient'` | `from '../server/services/comicvine/service'` |
| `from '@/api/metadataProviders/comicvineClient'` | `from '@/server/services/comicvine/service'` |
| `from '../api/metadataProviders/comicvine/*'` | `from '../server/services/comicvine/modules/*'` |

#### Fandom
| Old Import | New Import |
|------------|------------|
| `from '../api/metadataProviders/fandomClient'` | `from '../server/services/fandom/service'` |
| `from '@/api/metadataProviders/fandomClient'` | `from '@/server/services/fandom/service'` |

### Adapters
| Old Import | New Import |
|------------|------------|
| `from '../api/metadataProviders/adapters/suwayomiAdapter'` | `from '../server/adapters/metadata/suwayomiAdapter'` |
| `from '../api/metadataProviders/adapters/wikipediaAdapter'` | `from '../server/adapters/metadata/wikipediaAdapter'` |
| `from '../api/metadataProviders/adapters/websiteProviderAdapter'` | `from '../server/adapters/metadata/websiteProviderAdapter'` |
| `from '../api/metadataProviders/adapters/baseKapowarrAdapter'` | `from '../server/adapters/metadata/baseKapowarrAdapter'` |

### Download Clients
| Old Import | New Import |
|------------|------------|
| `from '../api/downloadClients/transmissionClient'` | `from '../server/services/download/clients/transmissionClient'` |
| `from '../api/downloadClients/delugeClient'` | `from '../server/services/download/clients/delugeClient'` |
| `from '../api/downloadClients/sabnzbdClient'` | `from '../server/services/download/clients/sabnzbdClient'` |
| `from '../api/downloadClients/nzbgetClient'` | `from '../server/services/download/clients/nzbgetClient'` |
| `from '../api/downloadClients'` | `from '../server/services/download/clients'` |

### Notifications
| Old Import | New Import |
|------------|------------|
| `from '../api/notifications/adapters/*'` | `from '../server/services/notifications/adapters/*'` |
| `from '../api/notifications/base/*'` | `from '../server/services/notifications/base/*'` |
| `from '../api/notifications/factory/*'` | `from '../server/services/notifications/factory/*'` |
| `from '../api/notifications'` | `from '../server/services/notifications'` |

### Utilities
| Old Import | New Import |
|------------|------------|
| `from '../api/utils/caching'` | `from '../server/utils/caching'` |
| `from '../api/utils/rateLimit'` | `from '../server/utils/rateLimit'` |
| `from '../api/utils/retry'` | `from '../server/utils/retry'` |
| `from '../api/utils/httpClient'` | `from '../server/utils/httpClient'` |

### Other API Files
| Old Import | New Import |
|------------|------------|
| `from '../api/prowlarrClient'` | `from '../server/services/prowlarrClient'` |
| `from '../api/suwayomiApi'` | `from '../server/services/suwayomiApi'` |

## Files Requiring Manual Updates

### Components (5 files)
```typescript
// src/components/settings/prowlarr/ProwlarrIndexerList.tsx
// src/components/settings/prowlarr/ProwlarrTest.tsx
// src/components/settings/prowlarr/IndexerList.tsx
// src/components/settings/prowlarr/ProwlarrConfig.tsx
// src/components/settings/suwayomi/SuwayomiSourceList.tsx
```

These files import from `api/` and need updating to `server/` paths.

### Potential Cross-References
Files that might reference api/ modules:
- Test files in `__tests__` directories
- Mock files in `__mocks__` directories
- Documentation files with code examples
- Configuration files

## Export Updates Required

### Create New Index Files

#### `src/server/services/metadata/index.ts`
```typescript
// Consolidated metadata provider exports
export { AniListService } from '../anilist/service';
export { ComicVineService } from '../comicvine/service';
export { FandomService } from '../fandom/service';

// Re-export adapters
export * from '../../adapters/metadata';

// Re-export utilities
export * from './utils';
export * from './scrapers';
```

#### `src/server/services/download/index.ts`
```typescript
// Consolidated download client exports
export * from './clients/transmissionClient';
export * from './clients/delugeClient';
export * from './clients/sabnzbdClient';
export * from './clients/nzbgetClient';
```

#### `src/server/services/notifications/index.ts`
```typescript
// Consolidated notification exports
export * from './adapters';
export * from './base';
export * from './factory';
export * from './utils';
```

## TypeScript Path Mapping Updates

### tsconfig.json
```json
{
  "compilerOptions": {
    "paths": {
      "@/server/*": ["./src/server/*"],
      // Remove: "@/api/*": ["./src/api/*"]
    }
  }
}
```

### jest.config.js (if using path mapping)
```javascript
moduleNameMapper: {
  '^@/server/(.*)$': '<rootDir>/src/server/$1',
  // Remove: '^@/api/(.*)$': '<rootDir>/src/api/$1',
}
```

## Validation Checklist

After running the migration:

1. **TypeScript Compilation**
   ```bash
   pnpm type-check
   ```
   Expected: 0 errors related to missing imports

2. **Import Verification**
   ```bash
   # Check for any remaining api/ imports
   grep -r "from ['\"].*api/" src/ --include="*.ts" --include="*.tsx"
   ```
   Expected: No results

3. **Build Verification**
   ```bash
   pnpm build:clean
   ```
   Expected: Successful build

4. **Test Suite**
   ```bash
   pnpm test
   ```
   Expected: All tests passing

5. **Runtime Verification**
   ```bash
   pnpm dev
   ```
   Test these features:
   - Metadata provider search (AniList, ComicVine, Fandom)
   - Download client operations
   - Notification sending
   - Prowlarr integration
   - Suwayomi integration

## Common Issues & Solutions

### Issue: Circular Dependencies
**Solution**: Use dynamic imports or restructure exports
```typescript
// Instead of direct import
import { Service } from '../service';

// Use dynamic import
const { Service } = await import('../service');
```

### Issue: Missing Type Exports
**Solution**: Ensure interfaces/types are re-exported
```typescript
// In server/services/metadata/index.ts
export type { MetadataProvider, SearchOptions } from './types';
```

### Issue: Test Files Breaking
**Solution**: Update test imports and mocks
```typescript
// Old mock
jest.mock('../../../api/metadataProviders/anilistClient');

// New mock
jest.mock('../../../server/services/anilist/service');
```

### Issue: Relative Path Depth
**Solution**: Use TypeScript path aliases
```typescript
// Instead of
import { Service } from '../../../../server/services/anilist/service';

// Use
import { Service } from '@/server/services/anilist/service';
```

## Rollback Instructions

If issues occur, restore from backup:
```bash
# Restore api directory
tar -xzf backup/api-directory-[timestamp].tar.gz -C src/

# Revert import changes
git checkout -- src/

# Or use git to revert
git reset --hard HEAD
```

## Success Metrics

- ✅ Zero imports from `api/` directory
- ✅ All TypeScript errors resolved
- ✅ Build completes successfully
- ✅ All tests passing
- ✅ Application functions correctly
- ✅ Bundle size reduced by ~25%