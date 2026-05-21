# Phase 2 Wave 1: Cascade Validation - Action Plan

**Created**: 2025-11-08
**Wave**: Phase 2 Wave 1
**Status**: Ready to Execute
**Duration**: 1-2 days

---

## Overview

This wave validates the cascade effect from Phase 1 and prepares for targeted Phase 2 remediation.

### Prerequisites

✅ **Phase 1 Wave 1 Complete**: All 150 no-explicit-any violations fixed
✅ **Phase 2 Strategy**: Created and reviewed
⏳ **ESLint Environment**: Needs dependency fixes
⏳ **Full ESLint Scan**: Pending

---

## Objectives

1. **Measure Cascade Effect**: Determine actual remaining no-unsafe-call violations
2. **Identify Hot Spots**: Find files with 20+ violations
3. **Categorize Patterns**: Group violations by type and fixability
4. **Plan Wave 2**: Create detailed batch plans for hot spot files

---

## Step-by-Step Actions

### Step 1: Fix ESLint Environment (Local Machine Required)

**Commands**:
```bash
# Navigate to project
cd /path/to/Mugiwara-Kaizoku

# Fix dependencies
npm install

# OR if using Bun
bun install

# Verify ESLint works
npm run lint -- --version
```

**Expected Output**: ESLint version 9.39.1 (or similar)

**Troubleshooting**:
- If `@eslint/js` missing: `npm install @eslint/js --save-dev`
- If other deps missing: `npm install` should fix
- Check `package.json` for missing dependencies

---

### Step 2: Run Full ESLint Scan

**Commands**:
```bash
# Run full scan with all rules
npm run lint 2>&1 | tee eslint-phase2-scan.txt

# Generate JSON for analysis
npm run lint -- --format json > eslint-phase2-scan.json 2>&1

# Count violations by rule
grep -E "no-unsafe-call|no-explicit-any|no-unsafe-member-access" eslint-phase2-scan.txt | wc -l
```

**Expected Results**:
- `no-explicit-any`: **0-10** (down from 1,776) ✅
- `no-unsafe-call`: **500-700** (down from 2,157) 🎯
- `no-unsafe-member-access`: **150-200** (if tracking)

**Record**:
- Total violations: __________
- no-unsafe-call: __________
- Cascade effectiveness: __________ %

---

### Step 3: Analyze Violation Distribution

**Extract Hot Spot Files**:
```bash
# Parse JSON to find files with most violations
cat eslint-phase2-scan.json | jq '.[] | select(.messages[].ruleId == "no-unsafe-call") | .filePath' | sort | uniq -c | sort -rn | head -20 > hotspots.txt

# Show top 10 hot spots
head -10 hotspots.txt
```

**Categorize by Pattern**:
```bash
# Find Cheerio/jQuery patterns
grep -r "\.each(.*: any" src/ --include="*.ts" --include="*.tsx" | wc -l

# Find array callback patterns
grep -r "\.map(.*: any" src/ --include="*.ts" --include="*.tsx" | wc -l

# Find event handler patterns
grep -r "onChange.*: any\|onClick.*: any" src/ --include="*.tsx" | wc -l
```

**Create Distribution Table**:
| Pattern | Count | % of Total | Priority |
|---------|-------|------------|----------|
| Cheerio operations | ___ | ___% | High |
| Array callbacks | ___ | ___% | Medium |
| Event handlers | ___ | ___% | Medium |
| API responses | ___ | ___% | High |
| Other | ___ | ___% | Low |

---

### Step 4: Create Hot Spot Analysis Document

**Template**: `phase2-wave1-cascade-analysis.md`

```markdown
# Phase 2 Wave 1: Cascade Validation Results

**Date**: 2025-11-08
**Analyst**: [Your Name]

## Summary

### Violation Counts

**Before Phase 1**:
- no-unsafe-call: 2,157
- no-explicit-any: 1,776

**After Phase 1 Wave 1**:
- no-unsafe-call: _____ (↓ _____ / _____%)
- no-explicit-any: _____ (↓ _____ / _____%)

**Cascade Effectiveness**: _____% (Expected: 65-75%)

### Top 10 Hot Spot Files

1. **[file path]** - _____ violations
   - Pattern: _____
   - Risk: Low/Medium/High
   - Priority: 1-5

2. **[file path]** - _____ violations
   ...

### Pattern Distribution

[Insert table from Step 3]

### Wave 2 Recommendations

Based on analysis, recommend:
1. Batch 1: [Hot spot file 1] - _____ violations
2. Batch 2: [Hot spot file 2] - _____ violations
3. Batch 3: [Pattern-based fix] - _____ violations
...

## Detailed Analysis

[For each hot spot file, provide:]
- Line number ranges
- Violation patterns
- Proposed fix strategy
- Estimated time
- Risk level
```

---

### Step 5: Plan Wave 2 Batches

Based on hot spot analysis, create batch plans:

**Wave 2 Structure**:
```
Phase 2 Wave 2: Hot Spot Files
├── Batch 1: [Largest hot spot] (~50-100 violations)
├── Batch 2: [Second largest] (~40-80 violations)
├── Batch 3: [Third largest] (~30-60 violations)
└── Batch 4-6: [Remaining hot spots] (~20-40 each)
```

**For Each Batch, Document**:
1. File path and violation count
2. Violation patterns (with examples)
3. Interface definitions needed
4. Risk assessment
5. Estimated time
6. Success criteria

---

## Alternative: Manual Sampling (If ESLint Can't Run)

If ESLint environment can't be fixed, perform manual sampling:

### Sample Hot Spot Files

Based on Phase 0 analysis, manually check these files:

1. **src/components/addManga/UniversalImportWizard.tsx**
   ```bash
   grep -n "as any" src/components/addManga/UniversalImportWizard.tsx | wc -l
   ```

2. **src/components/addManga/form.tsx**
   ```bash
   grep -n ": any" src/components/addManga/form.tsx | wc -l
   ```

3. **src/server/trpc/routers/metadata.ts**
   ```bash
   grep -n "\.each(.*: any" src/server/trpc/routers/metadata.ts | wc -l
   ```

### Estimate Cascade

Manual calculation:
- Count `as any` instances in 10 random files
- Multiply by unsafe-call ratio (~1.5:1)
- Extrapolate to full codebase

**Formula**:
```
Remaining violations ≈ (Total files × Avg violations per file × Pattern ratio)
```

---

## Deliverables

After completing Wave 1, you should have:

1. ✅ **cascade-analysis.md** - Full violation breakdown
2. ✅ **hotspots.txt** - Top 20 files with violation counts
3. ✅ **pattern-distribution.md** - Violation patterns categorized
4. ✅ **wave2-batch-plans.md** - Detailed plans for 4-6 batches

---

## Success Criteria

Wave 1 is complete when:

✅ Cascade effect measured (actual % known)
✅ Hot spot files identified (top 10+ files)
✅ Violations categorized by pattern
✅ Wave 2 batch plans created
✅ Priorities established
✅ Timeline estimated

---

## Timeline

**Estimated Duration**: 1-2 days

**Breakdown**:
- Fix ESLint environment: 1-2 hours
- Run scans: 30 minutes
- Analyze results: 2-3 hours
- Create documentation: 2-3 hours
- Plan Wave 2: 2-3 hours

**Total**: 8-12 hours

---

## Next Steps

After Wave 1 completion:

1. **Review findings** with team
2. **Prioritize hot spots** based on business impact
3. **Start Wave 2 Batch 1** - First hot spot file
4. **Continue systematic remediation** through Waves 2-5

---

## Notes

- **Environment Issues**: If ESLint can't run in this session, complete locally
- **Cascade Lower Than Expected**: May need to review Phase 1 fixes
- **Cascade Higher Than Expected**: Great! Phase 2 will be faster
- **Hot Spots Differ**: Phase 0 analysis was estimate, actuals may vary

---

*Ready to execute Phase 2 Wave 1!*
*Next: Run ESLint scan and analyze results*
