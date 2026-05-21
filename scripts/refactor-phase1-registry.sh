#!/bin/bash
# Phase 1: Create Type Registry

echo "========================================="
echo "Phase 1: Creating Type Registry"
echo "========================================="

# Save initial error count
INITIAL_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo "Initial error count: $INITIAL_ERRORS"

# Create type registry file
cat > src/types/type-registry.ts << 'EOF'
/**
 * Type Registry - Single Source of Truth
 * 
 * This file maps all legacy type names to their canonical equivalents.
 * It provides backward compatibility during migration.
 */

// Import canonical types
import { 
  MangaMetadata,
  MangaStatus,
  Chapter,
  ChapterStatus,
  ChapterInfo
} from './canonical';

// Legacy Entity Types (for backward compatibility)
export type MangaEntity = MangaMetadata & {
  id: number | string;
  chapters?: Chapter[];
};

export type ChapterEntity = Chapter & {
  id?: number | string;
  number?: string | number;
  mangaId?: number | string;
};

export interface LibraryEntity {
  id: number | string;
  name: string;
  path: string;
  type?: 'manga' | 'comic' | 'manhwa' | 'manhua';
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Re-export canonical types
export {
  MangaMetadata,
  MangaStatus,
  Chapter,
  ChapterStatus,
  ChapterInfo
};

// Common type aliases
export type Manga = MangaEntity;
export type ID = string | number;
export type DateLike = Date | string | number;

// Export everything from canonical for convenience
export * from './canonical';
EOF

echo "✅ Created type registry"

# Create domain redirect (since many files import from @/types/domain)
mkdir -p src/types/domain
cat > src/types/domain/index.ts << 'EOF'
/**
 * Domain Types Redirect
 * 
 * This file redirects all domain imports to the type registry.
 * It exists to fix broken imports from @/types/domain.
 */

// Export everything from type registry
export * from '../type-registry';

// Also export from canonical for types that might be imported directly
export * from '../canonical';

// Export specific types that are commonly imported from domain
export type {
  MangaEntity,
  ChapterEntity,
  LibraryEntity,
  Manga,
  ID,
  DateLike
} from '../type-registry';
EOF

echo "✅ Created domain redirect"

# Check error count after changes
NEW_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo ""
echo "Results:"
echo "--------"
echo "Initial errors: $INITIAL_ERRORS"
echo "Current errors: $NEW_ERRORS"

DIFF=$((NEW_ERRORS - INITIAL_ERRORS))
if [ $DIFF -gt 50 ]; then
    echo "⚠️ Warning: Errors increased by $DIFF (threshold: 50)"
    echo "Consider rolling back if this is unexpected"
else
    echo "✅ Phase 1 complete successfully"
fi

# Save state
echo "$NEW_ERRORS" > .phase1-error-count