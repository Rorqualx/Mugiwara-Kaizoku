# Next Steps - Phase 0 Complete

## Phase 0 Discovery: ✅ COMPLETE

**Result:** 3,230 violations identified and categorized across 788 files

---

## Immediate Next Steps

### 1. Review & Validate Findings (Today)

**Action Items:**
- [ ] Read `/tmp/PHASE0_EXECUTIVE_SUMMARY.md` (5 min)
- [ ] Review `/tmp/PHASE0_DISCOVERY_REPORT.md` full analysis (30 min)
- [ ] Spot-check top 5 files to validate counts
- [ ] Review agent strategy and approve/modify

**Validation Commands:**
```bash
# Verify counts in top files
npx eslint src/components/volumeChaptersTable.tsx --format json | jq '[.[] | .messages | map(select(.ruleId == "@typescript-eslint/no-unsafe-member-access")) | length] | add'

npx eslint src/pages/manga/[id].tsx --format json | jq '[.[] | .messages | map(select(.ruleId == "@typescript-eslint/no-unsafe-member-access")) | length] | add'
```

---

### 2. Create Phase 2 Infrastructure (Week 1)

**Priority 1: Type Guards Library**

Create `/home/user/Mugiwara-Kaizoku/src/lib/type-guards/index.ts`:

```typescript
/**
 * Common type guards for the codebase
 */

export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

export function hasProperties<K extends string>(
  obj: unknown,
  keys: readonly K[]
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null &&
    keys.every(key => key in obj);
}

export function isStringRecord(obj: unknown): obj is Record<string, string> {
  return typeof obj === 'object' && obj !== null &&
    Object.values(obj).every(v => typeof v === 'string');
}

export function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}
```

**Priority 2: Common Type Definitions**

Create `/home/user/Mugiwara-Kaizoku/src/types/external/index.ts`:

```typescript
/**
 * Common external API response types
 */

// AniList
export interface AniListMedia {
  id: number;
  title: {
    romaji: string;
    english?: string;
    native?: string;
  };
  coverImage?: {
    large?: string;
    medium?: string;
  };
  // ... add more fields as needed
}

// ComicVine
export interface ComicVineVolume {
  id: number;
  name: string;
  // ... add more fields as needed
}

// Raw provider data (from JSON.parse)
export interface RawProviderData {
  volumes?: Array<{
    title: string;
    number?: number;
    chapters?: unknown[];
  }>;
  totalVolumes?: number;
  totalChapters?: number;
  selectedCover?: string;
  selectedBanner?: string;
}
```

**Priority 3: Zod Schemas**

Add to `/home/user/Mugiwara-Kaizoku/src/lib/validation/schemas.ts`:

```typescript
import { z } from 'zod';

export const RawProviderDataSchema = z.object({
  volumes: z.array(z.object({
    title: z.string(),
    number: z.number().optional(),
    chapters: z.unknown().optional()
  })).optional(),
  totalVolumes: z.number().optional(),
  totalChapters: z.number().optional(),
  selectedCover: z.string().optional(),
  selectedBanner: z.string().optional()
});

export const AniListMediaSchema = z.object({
  id: z.number(),
  title: z.object({
    romaji: z.string(),
    english: z.string().optional(),
    native: z.string().optional()
  }),
  coverImage: z.object({
    large: z.string().optional(),
    medium: z.string().optional()
  }).optional()
});
```

---

### 3. Launch Agent 7: Quick Wins (Week 1)

**Objective:** Fix 270 low-risk violations for immediate progress

**Manifest:** `/tmp/quick-wins-manifest.json`

**Strategy:**
1. Start with test files (very safe)
2. Move to simple bracket notation (`["id"]`, `["title"]`)
3. Document patterns as you go

**Example Fix Pattern:**

**Before:**
```typescript
// src/server/adapters/unified-anilist-adapter.ts:182
if ((result as any)["id"]) {
  const id = (result as any)["id"];
  const title = (result as any)["title"];
}
```

**After:**
```typescript
// Define interface
interface AniListSearchResult {
  id: number;
  title: string;
}

// Use type guard
function isAniListResult(obj: unknown): obj is AniListSearchResult {
  return hasProperties(obj, ['id', 'title'] as const);
}

// Apply
if (isAniListResult(result)) {
  const id = result.id;      // ✅ Type-safe
  const title = result.title; // ✅ Type-safe
}
```

**Commands:**
```bash
# Work through quick wins manifest
cat /tmp/quick-wins-manifest.json | jq '.files[0]'

# Fix file, then test
bun run type-check
bun run lint
bun test src/path/to/file.test.ts

# Commit after each file
git add .
git commit -m "fix(types): Resolve no-unsafe-member-access in [filename]"
```

**Target:** Complete all 270 quick wins by end of Week 2

---

### 4. Prepare Specialized Agents (Week 2)

**Agent 1: Wizard & Import Specialist**
- **Manifest:** `/tmp/agent-1-wizard-manifest.json`
- **Files:** 29 files, 726 violations
- **Prep:** Study wizard data flow, create WizardState interface

**Agent 2: Volume & Chapter Specialist**
- **Manifest:** `/tmp/agent-2-volume-chapter-manifest.json`
- **Files:** 4 files, 195 violations
- **Prep:** Define Volume/Chapter interfaces, study data flow

**Agent 3: Router & API Specialist**
- **Manifest:** `/tmp/agent-3-routers-manifest.json`
- **Files:** 12 files, 304 violations
- **Prep:** Review tRPC schemas, plan Zod integration

**Agent 4: Service Layer Specialist**
- **Manifest:** `/tmp/agent-4-services-manifest.json`
- **Files:** 78 files, 709 violations
- **Prep:** Group services by domain, prioritize metadata services

**Agent 5: Utils & Adapters Specialist**
- **Manifest:** `/tmp/agent-5-utils-adapters-manifest.json`
- **Files:** 59 files, 432 violations
- **Prep:** Review utility patterns, plan adapter types

**Agent 6: Hooks & Components Specialist**
- **Manifest:** `/tmp/agent-6-hooks-components-manifest.json`
- **Files:** 81 files, 572 violations
- **Prep:** Study component props, plan type refactoring

---

## Week-by-Week Plan

### Week 1: Infrastructure + Quick Wins Start
- [ ] Set up type guards library
- [ ] Create common type definitions
- [ ] Add Zod schemas for external APIs
- [ ] Agent 7 fixes 50% of quick wins (135 violations)

### Week 2: Quick Wins Complete + Agent Prep
- [ ] Agent 7 completes remaining quick wins (135 violations)
- [ ] Review and approve agent strategies
- [ ] Create agent-specific documentation
- [ ] **Milestone:** 270 violations fixed (8% complete)

### Week 3-4: Routers + Utilities
- [ ] Agent 3 fixes all router violations (304)
- [ ] Agent 5 fixes all utils violations (432)
- [ ] Integration tests for routers
- [ ] **Milestone:** 1,006 violations fixed (31% complete)

### Week 5-6: Wizard Part 1
- [ ] Agent 1 fixes WizardContext.tsx (92 violations)
- [ ] Agent 1 fixes BasicInfoStep.tsx (44 violations)
- [ ] Agent 1 fixes MediaSelectionStep.tsx (33 violations)
- [ ] Heavy testing of wizard flow
- [ ] **Milestone:** 1,175 violations fixed (36% complete)

### Week 7-8: Wizard Part 2 + Volume/Chapter
- [ ] Agent 1 fixes remaining wizard files (~557 violations)
- [ ] Agent 2 fixes volume/chapter files (195 violations)
- [ ] Comprehensive wizard testing
- [ ] **Milestone:** 1,927 violations fixed (60% complete)

### Week 9-10: Services
- [ ] Agent 4 fixes metadata services (~200 violations)
- [ ] Agent 4 fixes backup/download services (~200 violations)
- [ ] Agent 4 fixes remaining services (~309 violations)
- [ ] Service integration tests
- [ ] **Milestone:** 2,636 violations fixed (82% complete)

### Week 11-12: Final Components + Validation
- [ ] Agent 6 fixes remaining components/hooks (572 violations)
- [ ] Full regression testing
- [ ] Update documentation
- [ ] Enable ESLint rule in CI (error level)
- [ ] **Milestone:** 3,230 violations fixed (100% complete) 🎉

---

## Success Criteria

### Per-File Criteria
- ✅ No new violations introduced
- ✅ All type-check passes
- ✅ All lint passes
- ✅ Existing tests pass
- ✅ No business logic changes

### Per-Agent Criteria
- ✅ All assigned violations fixed
- ✅ Integration tests added/updated
- ✅ Documentation updated
- ✅ Code reviewed and approved

### Overall Project Criteria
- ✅ Zero `no-unsafe-member-access` violations
- ✅ All tests passing
- ✅ No production bugs introduced
- ✅ Type system documented
- ✅ CI enforces rule (error level)

---

## Monitoring & Reporting

### Daily
- Count of violations fixed
- Count of violations introduced (should be 0)
- Test pass rate
- Blocked issues

### Weekly
- Progress against timeline
- Agent velocity
- Risk items identified
- Coordination needed

### Commands
```bash
# Check current violation count
npx eslint src/ --format json --rule '@typescript-eslint/no-unsafe-member-access: error' 2>/dev/null | jq '[.[] | .messages | map(select(.ruleId == "@typescript-eslint/no-unsafe-member-access")) | length] | add'

# Check specific directory
npx eslint src/components/ --format json | jq '[.[] | .messages | map(select(.ruleId == "@typescript-eslint/no-unsafe-member-access")) | length] | add'

# Run full validation
bun run type-check && bun run lint && bun test
```

---

## Risk Management

### High-Risk Areas (Extra Care)
1. **Wizard Components** (726 violations)
   - Test manga import flow after each change
   - Have rollback plan ready
   - Consider feature flag

2. **Volume/Chapter Management** (195 violations)
   - Test chapter display thoroughly
   - Verify download functionality
   - Check virtual scrolling performance

3. **Metadata Services** (55+ violations)
   - Validate against all metadata providers
   - Check AniList, ComicVine, MAL integrations
   - Verify metadata persistence

### Mitigation Strategies
- Work incrementally (one file at a time)
- Commit after each successful fix
- Run full test suite frequently
- Manual QA for critical flows
- Feature flags for risky changes

---

## Communication Plan

### Daily Standup Topics
- Violations fixed yesterday
- Violations planned for today
- Blockers or risks
- Help needed

### Weekly Review
- Progress vs plan
- Velocity trends
- Quality metrics (bugs, test failures)
- Adjustments needed

---

## Resources

### Documentation
- Full Report: `/tmp/PHASE0_DISCOVERY_REPORT.md`
- Executive Summary: `/tmp/PHASE0_EXECUTIVE_SUMMARY.md`
- This Document: `/tmp/NEXT_STEPS.md`

### Manifests
- All Violations: `/tmp/violations-manifest.json`
- Quick Wins: `/tmp/quick-wins-manifest.json`
- Agent 1: `/tmp/agent-1-wizard-manifest.json`
- Agent 2: `/tmp/agent-2-volume-chapter-manifest.json`
- Agent 3: `/tmp/agent-3-routers-manifest.json`
- Agent 4: `/tmp/agent-4-services-manifest.json`
- Agent 5: `/tmp/agent-5-utils-adapters-manifest.json`
- Agent 6: `/tmp/agent-6-hooks-components-manifest.json`

### Reference Code
```bash
# Example type guard
cat /tmp/PHASE0_DISCOVERY_REPORT.md | grep -A 15 "Type Guards Library"

# Example fix pattern
cat /tmp/PHASE0_DISCOVERY_REPORT.md | grep -A 20 "Pattern 1: Generic Type Assertion"
```

---

## Questions?

Refer to the full discovery report for:
- Detailed pattern analysis
- Code examples for each pattern
- Risk assessment methodology
- Category breakdown rationale

---

**Phase 0: ✅ Complete**
**Phase 1: ⏭️ Ready to Start**

Good luck! 🚀
