# Mantine v7 Migration Plan

*Date: September 20, 2025*
*Priority: High*
*Estimated Effort: 4-6 hours*

## Overview

This plan addresses the migration of deprecated Mantine props to v7 compatible props across the codebase. The migration affects 127+ prop usages across 35+ files.

## Scope of Changes

### Deprecated Props to Fix

| Old Prop | New Prop | Count | Components Affected |
|----------|----------|-------|-------------------|
| `spacing="*"` | `gap="*"` | 56 | SimpleGrid, Group, Stack |
| `position="*"` | `justify="*"` | 71 | Group, Stack |
| `weight={*}` | `fw={*}` | 0 | Text (already fixed) |
| `animate` | `animated` | 6 | Progress |

### Additional Migration Mappings

#### Position to Justify Mappings
- `position="apart"` → `justify="space-between"`
- `position="center"` → `justify="center"`
- `position="left"` → `justify="flex-start"`
- `position="right"` → `justify="flex-end"`

#### Spacing to Gap
- Direct conversion: `spacing="xs"` → `gap="xs"`
- Values: `xs`, `sm`, `md`, `lg`, `xl`, or numeric values

## Affected Files

### Critical Files (User-Facing Components)
1. **Add Manga Workflow** (9 files)
   - `src/components/addManga/components/display/*.tsx`
   - `src/components/addManga/components/media/*.tsx`
   - `src/components/addManga/steps/confirmationStep/components/*.tsx`

2. **Manga Detail Views** (4 files)
   - `src/components/mangaDetail.tsx`
   - `src/components/manga/CoverSelectorModal.tsx`
   - `src/components/manga/MobileMangaHeader.tsx`
   - `src/components/manga/VolumeDetailModal.tsx`

3. **Settings Pages** (7 files)
   - `src/components/settings/MetadataMergerSettings.tsx`
   - `src/components/settings/MetadataProvidersGrid.tsx`
   - `src/components/settings/suwayomi/SuwayomiSecuritySettings.tsx`
   - `src/pages/settings/integrations/index.tsx`
   - `src/pages/settings/release-blocklist.tsx`
   - `src/pages/settings/search-providers.tsx`

4. **Mobile/Responsive Components** (5 files)
   - `src/components/mobile/AppUpdatePrompt.tsx`
   - `src/components/mobile/MobileOptimizationChecklist.tsx`
   - `src/components/reader/MobileReader.tsx`
   - `src/components/responsive/ResponsiveGrid.tsx`

## Migration Strategy

### Phase 1: Automated Migration (2 hours)
1. Create and run migration script for simple replacements
2. Handle `spacing` → `gap` conversions
3. Handle `position` → `justify` with mappings
4. Handle `animate` → `animated` conversions

### Phase 2: Manual Review (1 hour)
1. Review complex components with custom spacing logic
2. Verify responsive breakpoints still work
3. Check for any conditional prop usage

### Phase 3: Testing (2 hours)
1. Visual regression testing on key pages
2. Test responsive behavior
3. Verify no layout breaks

### Phase 4: Documentation (1 hour)
1. Update DEVELOPMENT_RULES.md
2. Add examples of correct usage
3. Create component examples

## Implementation Plan

### Step 1: Create Migration Script

```bash
#!/bin/bash
# mantine-v7-migration.sh

echo "Starting Mantine v7 Migration..."

# Backup current state
git stash
git checkout -b mantine-v7-migration

# Function to replace spacing with gap
fix_spacing() {
  echo "Fixing spacing prop..."
  find src -name "*.tsx" -o -name "*.ts" | while read file; do
    sed -i '' 's/spacing="/gap="/g' "$file"
    sed -i '' 's/spacing={/gap={/g' "$file"
    sed -i '' "s/spacing='/gap='/g" "$file"
  done
}

# Function to replace position with justify
fix_position() {
  echo "Fixing position prop..."
  find src -name "*.tsx" -o -name "*.ts" | while read file; do
    # Map position values to justify values
    sed -i '' 's/position="apart"/justify="space-between"/g' "$file"
    sed -i '' 's/position="center"/justify="center"/g' "$file"
    sed -i '' 's/position="left"/justify="flex-start"/g' "$file"
    sed -i '' 's/position="right"/justify="flex-end"/g' "$file"
    sed -i '' "s/position='apart'/justify='space-between'/g" "$file"
    sed -i '' "s/position='center'/justify='center'/g" "$file"
    sed -i '' "s/position='left'/justify='flex-start'/g" "$file"
    sed -i '' "s/position='right'/justify='flex-end'/g" "$file"
  done
}

# Function to fix animate to animated
fix_animate() {
  echo "Fixing animate prop..."
  find src -name "*.tsx" -o -name "*.ts" | while read file; do
    sed -i '' 's/animate=/animated=/g' "$file"
    sed -i '' 's/animate}/animated}/g' "$file"
  done
}

# Run all fixes
fix_spacing
fix_position
fix_animate

echo "Migration complete! Please review changes."
```

### Step 2: Validation Script

```typescript
// validate-mantine-props.ts
import { glob } from 'glob';
import { readFileSync } from 'fs';

const deprecatedProps = [
  'spacing=',
  'position=',
  'weight=',
  'animate='
];

async function validateMantineProps() {
  const files = await glob('src/**/*.{ts,tsx}');
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const prop of deprecatedProps) {
      if (content.includes(prop)) {
        violations.push({ file, prop });
      }
    }
  }

  return violations;
}

validateMantineProps().then(violations => {
  if (violations.length > 0) {
    console.error('Found deprecated props:', violations);
    process.exit(1);
  } else {
    console.log('No deprecated props found!');
  }
});
```

## Risk Assessment

### Low Risk
- Simple prop replacements (`spacing` → `gap`)
- Well-defined mappings (`position` → `justify`)

### Medium Risk
- Components with custom responsive props
- Dynamically generated prop values

### Mitigation
- Create comprehensive test suite before migration
- Run on staging environment first
- Have rollback plan ready

## Success Criteria

1. **Zero deprecated props** in codebase
2. **All tests pass** after migration
3. **No visual regressions** in UI
4. **Documentation updated** with new patterns
5. **Linting rules** in place to prevent regression

## Rollback Plan

If issues are encountered:
1. `git stash` any uncommitted changes
2. `git checkout main`
3. `git branch -D mantine-v7-migration`
4. Document issues found for manual fixing

## Post-Migration Tasks

1. **Add ESLint rules** to prevent deprecated props
2. **Update component library** documentation
3. **Team training** on Mantine v7 patterns
4. **Monitor** for any missed conversions

## Timeline

- **Day 1** (4 hours)
  - Run automated migration
  - Manual review and fixes
  - Initial testing

- **Day 2** (2 hours)
  - Comprehensive testing
  - Documentation updates
  - Team review

## Notes

- The migration should be done in a single PR to avoid conflicts
- Consider running during low-traffic hours
- Coordinate with QA team for testing
- Update any component libraries or shared packages

## Checklist

- [ ] Backup current branch
- [ ] Create migration branch
- [ ] Run automated migration script
- [ ] Manual review of changes
- [ ] Run TypeScript compiler
- [ ] Run test suite
- [ ] Visual testing on key pages
- [ ] Update documentation
- [ ] Create PR
- [ ] Get code review
- [ ] Merge to main
- [ ] Monitor for issues
- [ ] Add linting rules