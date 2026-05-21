# Agent Orchestration Plan - Critical Violations Remediation

*Created*: 2025-11-08
*Status*: Ready for Execution
*Parent Document*: [CRITICAL_VIOLATIONS_ANALYSIS.md](./CRITICAL_VIOLATIONS_ANALYSIS.md)

---

## Quick Start

This document provides **step-by-step execution instructions** for running the coordinated agentic workflow to fix 5,580 ESLint violations.

**Prerequisites**:
1. Read [CRITICAL_VIOLATIONS_ANALYSIS.md](./CRITICAL_VIOLATIONS_ANALYSIS.md) - Understand the full context
2. Review [agentic-workflow-guide.md](./agentic-workflow-guide.md) - Understand existing workflow patterns
3. Have access to parallel agent execution
4. Working development environment with all dependencies installed

---

## Phase 0: Discovery & Categorization (Week 1)

### Objective

Generate three comprehensive reports categorizing all 5,580 violations by:
- File location
- Pattern type
- Risk level
- Suggested fix approach
- Dependencies

### Agent Configuration

Launch **3 agents in parallel** with these exact prompts:

#### Agent Alpha: no-explicit-any Analyzer

**Prompt**:
```
Your task is to analyze ALL 1,776 violations of the @typescript-eslint/no-explicit-any rule in the codebase.

For each violation, determine:

1. **Location**: File path and line number
2. **Pattern Type**:
   - Function parameter
   - Return type
   - Variable declaration
   - Type assertion
   - Generic type argument
   - Array type
   - Object property
   - Callback type

3. **Context**: What is this 'any' type used for?

4. **Risk Level**:
   - Low: Simple utility, logger, obvious type available
   - Medium: Component props, hooks, event handlers
   - High: API responses, service methods, type adapters
   - Critical: Core services, auth, payment processing

5. **Suggested Fix**:
   - Specific interface/type to use
   - Or: Use unknown + type guard
   - Or: Use generic <T>
   - Or: Needs domain expert input

6. **Cascade Impact**: List any no-unsafe-call violations that will auto-fix when this is resolved

Generate a comprehensive report in this format:

## no-explicit-any Full Analysis

### Summary
- Total violations: 1,776
- Low risk: [count] ([%])
- Medium risk: [count] ([%])
- High risk: [count] ([%])
- Critical risk: [count] ([%])

### By Pattern Type
[Table of counts per pattern]

### By File Location
[Top 20 files with most violations]

### Detailed Violations

[For each violation, provide analysis using template below]

#### Violation #1: [File:Line] - [Variable Name]

**Code**:
```typescript
[Show the actual code]
```

**Pattern**: [Function parameter / Return type / etc.]

**Context**: [What is this used for based on code analysis]

**Risk**: [Low/Medium/High/Critical]

**Suggested Fix**:
```typescript
[Show the proposed fix with proper type]
```

**Cascade Impact**:
- Will also fix: [List of related no-unsafe-call violations]
- May affect: [List of dependent code]

**Notes**: [Any special considerations]

---

Save your complete analysis to: docs/eslint/phase0-no-explicit-any-analysis.md

Use ast-grep to find violations:
ast-grep --pattern '$VAR: any' src/
ast-grep --pattern 'function $NAME($PARAM: any)' src/
ast-grep --pattern ': any' src/

Take your time. Thoroughness is more important than speed. This analysis will drive the entire remediation effort.
```

**Expected Output**: `docs/eslint/phase0-no-explicit-any-analysis.md` (comprehensive, ~50-100 pages)

---

#### Agent Beta: no-unsafe-call Analyzer

**Prompt**:
```
Your task is to analyze ALL 2,157 violations of the @typescript-eslint/no-unsafe-call rule in the codebase.

For each violation, determine:

1. **Location**: File path and line number

2. **Call Expression**: What function/method is being called unsafely?

3. **Root Cause**:
   - Trace back to where the 'any' type originates
   - Identify the source file and line
   - Understand why it's typed as 'any'

4. **Cascade Relationship**:
   - Is this a downstream effect of a no-explicit-any violation?
   - If yes, which violation? (file:line)
   - Will fixing the root cause auto-fix this?

5. **Risk Level**:
   - Low: Will auto-fix when root any is fixed
   - Medium: Requires type assertion
   - High: External library, needs type declaration
   - Critical: Complex type system issue

6. **Fix Strategy**:
   - Primary: Fix root any type at [file:line] (CASCADE FIX)
   - Alternative: Add type assertion here
   - Alternative: Create typed wrapper
   - Alternative: Add library type declarations

Generate a comprehensive report in this format:

## no-unsafe-call Full Analysis

### Summary
- Total violations: 2,157
- Cascade fixes (auto-resolve): [count] ([%])
- Requires type assertion: [count] ([%])
- Requires library types: [count] ([%])
- Complex cases: [count] ([%])

### Cascade Map
[Visualization of which any types cause which unsafe-call violations]

Example:
src/utils/api.ts:45 (any type)
  ↓ Causes 23 no-unsafe-call violations:
    - src/components/MangaList.tsx:67
    - src/components/MangaCard.tsx:34
    [etc.]

### By File Location
[Top 20 files with most violations]

### Detailed Violations

[For each violation, provide analysis using template below]

#### Violation #1: [File:Line] - [Call Expression]

**Code**:
```typescript
[Show the actual code with context]
```

**Root Cause**:
- Variable: [name]
- Declared at: [file:line]
- Type: any
- Reason: [why it's any]

**Fix Strategy**:
1. **PRIMARY (Cascade Fix)**: Fix any type at [file:line]
   - This will auto-resolve this violation
   - Also fixes: [list of other violations]
   - Priority: [High/Medium/Low]

2. **ALTERNATIVE (Type Assertion)**:
   ```typescript
   (variable as ProperType).method()
   ```
   - Use when: [scenario]
   - Risk: [assessment]

**Cascade Impact**:
- Depends on: [other violations that must be fixed first]
- Will fix: [other violations that will auto-resolve]

**Risk**: [Low/Medium/High/Critical]

**Recommendation**: [Which fix strategy to use]

---

Save your complete analysis to: docs/eslint/phase0-no-unsafe-call-analysis.md

Use grep to find violations:
grep -r "no-unsafe-call" . --include="*.ts" --include="*.tsx"

Cross-reference with no-explicit-any violations to map cascade relationships.

Take your time. Understanding cascade relationships is KEY to efficient remediation.
```

**Expected Output**: `docs/eslint/phase0-no-unsafe-call-analysis.md` (comprehensive, ~60-120 pages)

---

#### Agent Gamma: no-unnecessary-condition Analyzer

**Prompt**:
```
Your task is to analyze ALL 1,647 violations of the @typescript-eslint/no-unnecessary-condition rule in the codebase.

For each violation, determine:

1. **Location**: File path and line number

2. **Condition Type**:
   - Null check on non-nullable
   - Undefined check on required property
   - Optional chaining on non-optional
   - Nullish coalescing on non-nullable
   - Always-true boolean condition
   - Always-false boolean condition

3. **Why Unnecessary**:
   - What is the TypeScript type?
   - Why can't it be null/undefined?
   - Proof that condition is always true/false

4. **Root Cause**:
   - Defensive programming
   - Type was refined over time
   - Developer misunderstanding
   - Copy-pasted code
   - Intentional production safety

5. **Safety Analysis**:
   - Is the type definition correct?
   - Do all callers pass correct types?
   - Any runtime scenarios where value could be null/undefined?
   - Could this be intentional defensive code?

6. **Risk Level**:
   - Low: Safe to remove, clearly redundant
   - Medium: Investigate type definition first
   - High: Might be intentionally defensive

Generate a comprehensive report in this format:

## no-unnecessary-condition Full Analysis

### Summary
- Total violations: 1,647
- Low risk (safe to remove): [count] ([%])
- Medium risk (investigate first): [count] ([%])
- High risk (might be defensive): [count] ([%])

### By Condition Type
[Table of counts per type]

### By Root Cause
[Table of counts per cause]

### By File Location
[Top 20 files with most violations]

### Detailed Violations

[For each violation, provide analysis using template below]

#### Violation #1: [File:Line] - [Condition]

**Code**:
```typescript
[Show the actual code with context]
```

**Condition Type**: [Null check / Optional chaining / etc.]

**Type Analysis**:
- Variable: [name]
- Type: [TypeScript type]
- Can be null?: No (reason: [why])
- Can be undefined?: No (reason: [why])

**Why Unnecessary**:
[Explain with TypeScript type proof]

**Root Cause**: [Defensive / Type refinement / etc.]

**Safety Analysis**:
- ✅ Type definition is correct
- ✅ All callers pass non-null values
- ✅ No runtime scenarios where value is null
- ❓ Might be defensive for production safety

**Fix Recommendation**:
```typescript
// Current (unnecessary check)
[current code]

// Proposed (remove check)
[code without check]

// Alternative (if defensive)
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
[current code]  // Defensive: [reason]
```

**Risk**: [Low/Medium/High]

**Recommendation**: [Remove / Investigate / Keep with disable]

**Notes**: [Any special considerations]

---

Save your complete analysis to: docs/eslint/phase0-no-unnecessary-condition-analysis.md

Use ast-grep to find patterns:
ast-grep --pattern 'if ($VAR !== null)' src/
ast-grep --pattern 'if ($VAR !== undefined)' src/
ast-grep --pattern '$VAR?.$PROP' src/
ast-grep --pattern '$VAR ?? $DEFAULT' src/

Take your time. Some conditions might be intentionally defensive - mark these for review.
```

**Expected Output**: `docs/eslint/phase0-no-unnecessary-condition-analysis.md` (comprehensive, ~50-80 pages)

---

### Execution Steps for Phase 0

**Step 1**: Launch all three agents **in parallel**

```bash
# In your agent orchestration tool
launch_parallel_agents([
  { id: "alpha", prompt: [Agent Alpha prompt] },
  { id: "beta", prompt: [Agent Beta prompt] },
  { id: "gamma", prompt: [Agent Gamma prompt] }
])
```

**Step 2**: Monitor progress

Each agent should:
- Run for 8-24 hours
- Generate comprehensive report
- Save to specified file

**Step 3**: Review outputs

Once all three agents complete:
- Read all three reports
- Verify completeness
- Check for anomalies
- Identify hot spots

**Step 4**: Create Phase 0 Summary

Synthesize findings into:
- `docs/eslint/phase0-summary.md`
- Executive summary for stakeholders
- Refined timeline based on actual complexity
- Adjusted risk assessments

**Completion Criteria**:
- ✅ All 5,580 violations analyzed
- ✅ Three comprehensive reports generated
- ✅ Cascade relationships mapped
- ✅ Risk levels assigned
- ✅ Hot spot files identified
- ✅ Ready to begin Phase 1

---

## Phase 1: Fix no-explicit-any Types (Weeks 2-8)

### Objective

Eliminate `no-explicit-any` violations through 10 waves of targeted fixes.

### Wave Configuration

Based on Phase 0 analysis, configure waves:

| Wave | Risk | Target Category | Batch Size | Est. Count |
|------|------|----------------|------------|------------|
| 1 | Low | Simple utilities | 20-25 | 150 |
| 2 | Low | Logger/debug | 20-25 | 150 |
| 3 | Med | Component props | 15-20 | 200 |
| 4 | Med | Event handlers | 15-20 | 200 |
| 5 | Med | Hook parameters | 15-20 | 200 |
| 6 | High | API responses | 10-15 | 300 |
| 7 | High | Service methods | 10-15 | 300 |
| 8 | High | Type adapters | 10-15 | 250 |
| 9 | Crit | Core services | 5-10 | 150 |
| 10 | Crit | Complex cases | 1-5 | 76 |

### Agent Workflow Per Wave

#### Setup

**Coordinator Agent** (running throughout):
- Reviews all proposals
- Makes final decisions
- Escalates to user when needed
- Tracks progress

**Analyzer Agent** (per batch):
- Selects batch from wave target
- Proposes specific fixes
- Generates diff previews

**Type Expert Agent** (on-demand):
- Determines correct types
- Consults schemas, APIs, docs
- Advises on complex types

**Validator Agent** (after each batch):
- Runs type-check
- Runs lint
- Runs tests
- Reports results

#### Batch Workflow

**For each batch in wave:**

**Step 1**: Analyzer selects batch

```
Coordinator: "Begin Wave 1 Batch 1 - 20 simple utility functions with any"

Analyzer: [Uses Phase 0 report to select 20 violations]
```

**Step 2**: Type Expert determines types

```
Analyzer: "Need type recommendations for these 20 violations"

Type Expert: [For each violation]
- Analyzes usage
- Determines correct type
- Provides interface/type definition
```

**Step 3**: Analyzer proposes fixes

```
Analyzer: "Here are proposed fixes for Batch 1:

### Fix 1: src/utils/logger.ts:45 - logData parameter

**Current**:
```typescript
function logData(label: string, data: any) {
  logger.info(label, data);
}
```

**Proposed**:
```typescript
function logData<T>(label: string, data: T) {
  logger.info(label, data);
}
```

**Rationale**: Generic preserves type information, works with any type safely

**Risk**: Low - purely additive change

**Tests Affected**: None (backward compatible)

---

[19 more fixes...]

**Batch Summary**:
- Violations fixed: 20 no-explicit-any
- Cascade fixes: ~25 no-unsafe-call
- Files changed: 15
- Risk: Low
- Tests to run: utils tests

**Recommendation**: Approve
```

**Step 4**: Coordinator reviews

```
Coordinator: [Reviews all 20 fixes]

Decision: ✅ APPROVED

Notes:
- All fixes follow established patterns
- Generics are appropriate for utilities
- No breaking changes detected
- Batch is cohesive and low-risk

Action: Proceed with implementation
```

**Step 5**: Apply fixes

```
[Agent or developer applies the 20 fixes to codebase]
```

**Step 6**: Validator runs checks

```
Validator: "Running validation for Wave 1 Batch 1..."

## Validation Report: Wave 1 Batch 1

**Batch**: Simple utilities (20 violations)
**Files Changed**: 15

### TypeScript Compilation
- Status: ✅ PASS
- Errors before: 245
- Errors after: 245
- New errors: 0

### ESLint
- Status: ✅ PASS
- no-explicit-any: 1,776 → 1,756 (Δ -20) ✅
- no-unsafe-call: 2,157 → 2,132 (Δ -25) ✅ CASCADE!
- no-unnecessary-condition: 1,647 → 1,647 (Δ 0)
- New violations: 0

### Tests
- Status: ✅ PASS
- Tests run: 45 (utils suite)
- Passed: 45
- Failed: 0

### Decision
✅ COMMIT - All checks passed

### Notes
- Cascade effect as expected: 25 unsafe-call auto-fixed
- No regressions detected
- Ready for commit
```

**Step 7**: Commit

```bash
git add .
git commit -m "fix(types): Replace any with generics - Wave 1 Batch 1

Fixed 20 no-explicit-any violations in utility functions:
- logData: any → generic <T>
- formatDate: any → Date | string | number
- parseJson: any → unknown with validation
- safeAccess: any → generic with type guard
[etc.]

Cascade fixes: 25 no-unsafe-call violations auto-resolved

Risk level: Low
Validation: TypeScript ✅ ESLint ✅ Tests ✅

Files changed:
- src/utils/logger.ts
- src/utils/formatters.ts
- src/utils/parsers.ts
[etc.]"
```

**Step 8**: Update tracking

```markdown
# docs/eslint/critical-violations-decisions.md

### Phase 1 Wave 1 Batch 1: Simple Utilities (Low Risk)

**Date**: 2025-11-09
**Status**: ✅ Completed

| File | Line | Variable | Current | Fixed To | Risk |
|------|------|----------|---------|----------|------|
| src/utils/logger.ts | 45 | data | any | <T> | Low |
| src/utils/formatters.ts | 67 | value | any | Date\|string | Low |
[etc.]

**Violations Fixed**: 20 no-explicit-any, 25 no-unsafe-call (cascade)
**Commit**: `abc123`
**Lessons**: Generics work well for utilities, cascade effect confirmed
**Next**: Batch 2 - Logger functions (20 violations)
```

**Step 9**: Repeat for next batch

```
Coordinator: "Wave 1 Batch 1 complete. Beginning Batch 2..."
```

### Escalation Scenarios

**Scenario 1**: Complex Type Needed

```
Type Expert: "This API response has 50+ fields. Creating full interface will take 2 hours."

Coordinator: "Escalate to user"

To User:
"We can either:
A) Create full interface (2 hours, perfect types)
B) Use Partial<KnownFields> & Record<string, unknown> (15 min, good enough)
C) Use unknown + runtime validation (30 min, safest)

Recommendation: B for now, can refine later. Thoughts?"
```

**Scenario 2**: Potential Breaking Change

```
Analyzer: "Fixing this any type will change function signature.
Found 15 call sites that may break."

Coordinator: "Escalate to user"

To User:
"Changing this function signature affects 15 callers:
- 12 are internal (we can update)
- 3 are in separate modules (might break)

Options:
A) Update all callers in one batch (3-4 hours)
B) Create new typed function, deprecate old one (migration path)
C) Skip this one for now

Recommendation: A if we have time, B if we need to move fast. Thoughts?"
```

**Scenario 3**: External Library Issue

```
Type Expert: "This external library has incomplete types."

Coordinator: "Escalate to user"

To User:
"The 'old-manga-api' library is missing types.

Options:
A) Create local .d.ts declarations (1-2 hours, best solution)
B) Use type assertions (quick, less safe)
C) Contribute types to DefinitelyTyped (long-term, helps community)

Recommendation: A for now, C as follow-up. Thoughts?"
```

### Wave Completion Criteria

**Before moving to next wave:**

- ✅ All batches in wave completed
- ✅ All commits successful
- ✅ Decision log updated
- ✅ Progress dashboard updated
- ✅ No outstanding issues
- ✅ Team review (for High/Critical waves)

---

## Phase 2: Verify Cascade Effect (Week 9)

### Objective

Quantify how many `no-unsafe-call` violations auto-resolved by fixing `no-explicit-any`.

### Execution

**Step 1**: Full re-scan

```bash
# Run ESLint with JSON output
npx eslint . --format json --max-warnings 10000 > phase2-rescan.json

# Count remaining violations
cat phase2-rescan.json | jq '[.[] | .messages[] | select(.ruleId == "no-unsafe-call")] | length'
```

**Step 2**: Compare with Phase 0

```
Phase 0: 2,157 no-unsafe-call violations
Phase 2: [actual count] no-unsafe-call violations

Cascade fixed: [difference] ([percentage]%)
Remaining: [actual count]
```

**Step 3**: Analyze remaining violations

Launch **Agent Beta** again with new prompt:

```
Your task is to re-analyze the REMAINING no-unsafe-call violations after Phase 1 completion.

We started with 2,157 violations.
We fixed 1,420 no-explicit-any violations in Phase 1.
We expected 30-50% cascade reduction.

Now analyze:
1. How many violations remain?
2. Why didn't they auto-resolve?
3. What is needed to fix them?

For each remaining violation:
- Is the any type in code we can control?
- Is it from an external library?
- What fix strategy is needed?

Categorize remaining violations into:
- Can fix with type assertion
- Need library type declarations
- Complex type system issue
- Other

Generate: docs/eslint/phase2-remaining-no-unsafe-call-analysis.md
```

**Step 4**: Update plans for Phase 3

Based on actual remaining count, adjust Phase 3 waves.

---

## Phase 3: Fix Remaining no-unsafe-call (Weeks 10-14)

### Objective

Address `no-unsafe-call` violations that didn't auto-resolve in Phase 1.

### Strategy

Similar to Phase 1, but focus on:
- Library wrapper fixes
- Type assertions
- Complex dependencies

### Wave Configuration

Adjust based on Phase 2 findings. Example:

| Wave | Risk | Target | Batch Size | Est. Count |
|------|------|--------|------------|------------|
| 11 | Med | Library wrappers | 15-20 | 300 |
| 12 | Med | Type assertions | 15-20 | 300 |
| 13 | High | Complex deps | 10-15 | 400 |
| 14 | Crit | Core system | 5-10 | 200 |

### Agent Workflow

Same as Phase 1, but with different fix strategies:

**Fix Pattern 1: Type Assertion**
```typescript
// Before
const result: any = externalLib.getData();
result.process();  // no-unsafe-call

// After
interface LibResult {
  process(): void;
}
const result = externalLib.getData() as LibResult;
result.process();  // Safe
```

**Fix Pattern 2: Typed Wrapper**
```typescript
// Before
import oldLib from 'old-lib';  // Returns any
oldLib.call();  // no-unsafe-call

// After
import oldLib from 'old-lib';

interface OldLib {
  call(): void;
}

const typedLib = oldLib as unknown as OldLib;
export { typedLib as oldLib };

// Usage
typedLib.call();  // Safe
```

**Fix Pattern 3: Library Declarations**
```typescript
// types/old-lib.d.ts
declare module 'old-lib' {
  export function getData(): Promise<Data>;
  export function process(data: Data): Result;
}

// Now imports are typed
import { getData, process } from 'old-lib';  // Typed!
```

---

## Phase 4: Fix no-unnecessary-condition (Weeks 15-18)

### Objective

Remove unnecessary conditions now that types are more accurate.

### Strategy

**Wave Configuration**:

| Wave | Risk | Target | Batch Size | Est. Count |
|------|------|--------|------------|------------|
| 15 | Low | Redundant null checks | 25-30 | 400 |
| 16 | Low | Unnecessary optional chaining | 25-30 | 400 |
| 17 | Med | Always-true conditions | 15-20 | 500 |
| 18 | Med | Investigate defensive code | 10-15 | 347 |

### Special Consideration

**Before removing conditions**, verify:

1. Type definition is actually correct
2. All callers pass correct types
3. No production scenarios where value could be null
4. Not intentionally defensive

**When in doubt**:
```typescript
// Keep with disable and comment
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (user !== null) {  // Defensive: production safety for legacy callers
  // ...
}
```

### Agent Workflow

**Analyzer checks each condition**:

```
### Violation: src/components/MangaCard.tsx:67

**Code**:
```typescript
function MangaCard({ manga }: Props) {
  if (!manga) {  // manga is never null/undefined per Props type
    return null;
  }
  return <div>{manga.title}</div>;
}
```

**Analysis**:
- Variable: manga
- Type: Manga (non-nullable per interface Props)
- Condition: if (!manga)
- Always false: Yes (manga is guaranteed by Props)

**Safety Check**:
✅ Props interface defines manga as required
✅ TypeScript enforces non-null at all call sites
✅ No production logs showing null manga errors
❓ Could be defensive from legacy JavaScript days

**Recommendation**: REMOVE (type system guarantees non-null)

**Proposed Fix**:
```typescript
function MangaCard({ manga }: Props) {
  return <div>{manga.title}</div>;
}
```

**Risk**: Low (type system provides safety)
```

---

## Progress Tracking & Reporting

### Daily Updates

**Update**: `docs/eslint/critical-violations-progress.md`

```markdown
# Progress Dashboard - 2025-11-10

## Today's Progress

**Phase**: 1
**Wave**: 2
**Batch**: 5

**Violations Fixed Today**: 45
- no-explicit-any: 20
- no-unsafe-call: 25 (cascade)

**Cumulative Progress**:
- no-explicit-any: 1,776 → 1,656 (Δ -120, 7% complete)
- no-unsafe-call: 2,157 → 2,082 (Δ -75)
- Total: 5,580 → 5,485 (Δ -95, 2% complete)

**Status**: ✅ On track

**Blockers**: None

**Next**: Wave 2 Batch 6 - Logger functions
```

### Weekly Reports

**Report to stakeholders**:

```markdown
# Week 2 Summary - Critical Violations Remediation

## Accomplishments

- ✅ Completed Wave 1 (150 violations) - Simple utilities
- ✅ Started Wave 2 (100/150 complete) - Logger functions
- ✅ Zero production incidents
- ✅ All tests passing

## Metrics

- Violations fixed: 250 (4.5% of total)
- Cascade fixes: 75 bonus (no-unsafe-call auto-resolved)
- Batches completed: 15
- Average batch time: 3.1 hours
- Rollbacks: 0

## Learnings

- Cascade effect stronger than expected (30% vs. projected 25%)
- Generic types work well for utilities
- Team is efficient with small batches

## Next Week

- Complete Wave 2 (50 remaining)
- Start Wave 3 (Component props - medium risk)
- Estimated: 200 more violations fixed

## Risks

- None currently
```

---

## Tool & Script Setup

### Validation Script

**File**: `scripts/validate-batch.sh`

```bash
#!/bin/bash
# Validates a batch of changes before commit

echo "🔍 Validating batch..."

# 1. TypeScript compilation
echo "📘 TypeScript check..."
bun run type-check
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found"
  exit 1
fi

# 2. ESLint
echo "📋 ESLint check..."
bun run lint > /tmp/lint-after.txt 2>&1

# Count violations
ANY_AFTER=$(grep -c "no-explicit-any" /tmp/lint-after.txt || echo "0")
CALL_AFTER=$(grep -c "no-unsafe-call" /tmp/lint-after.txt || echo "0")
COND_AFTER=$(grep -c "no-unnecessary-condition" /tmp/lint-after.txt || echo "0")

echo "no-explicit-any: $ANY_AFTER"
echo "no-unsafe-call: $CALL_AFTER"
echo "no-unnecessary-condition: $COND_AFTER"

# 3. Run tests
echo "🧪 Running tests..."
bun test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi

echo "✅ All validations passed!"
```

### Progress Tracker Script

**File**: `scripts/track-progress.sh`

```bash
#!/bin/bash
# Tracks daily progress on violations

echo "📊 Tracking progress..."

# Run lint and capture
bun run lint > /tmp/lint-current.txt 2>&1

# Count each type
ANY_COUNT=$(grep -c "no-explicit-any" /tmp/lint-current.txt || echo "0")
CALL_COUNT=$(grep -c "no-unsafe-call" /tmp/lint-current.txt || echo "0")
COND_COUNT=$(grep -c "no-unnecessary-condition" /tmp/lint-current.txt || echo "0")
TOTAL=$((ANY_COUNT + CALL_COUNT + COND_COUNT))

# Append to log
DATE=$(date +"%Y-%m-%d")
echo "$DATE,$ANY_COUNT,$CALL_COUNT,$COND_COUNT,$TOTAL" >> docs/eslint/progress-log.csv

# Display
echo "📈 Current counts:"
echo "  no-explicit-any: $ANY_COUNT"
echo "  no-unsafe-call: $CALL_COUNT"
echo "  no-unnecessary-condition: $COND_COUNT"
echo "  TOTAL: $TOTAL"

# Calculate progress
START_TOTAL=5580
FIXED=$((START_TOTAL - TOTAL))
PERCENT=$((FIXED * 100 / START_TOTAL))

echo "✅ Fixed: $FIXED ($PERCENT%)"
echo "📋 Remaining: $TOTAL"
```

### Hot Spots Identifier

**File**: `scripts/find-hotspots.sh`

```bash
#!/bin/bash
# Identifies files with most violations

echo "🔥 Finding hot spot files..."

bun run lint 2>&1 | \
  grep -E "(no-explicit-any|no-unsafe-call|no-unnecessary-condition)" | \
  cut -d: -f1 | \
  sort | \
  uniq -c | \
  sort -rn | \
  head -20

echo ""
echo "💡 These files should be prioritized for fixes"
```

---

## Communication Templates

### Daily Standup Update

```
**Yesterday**:
- Completed Wave 2 Batch 5 (20 violations)
- Fixed logger utility functions
- All validations passed

**Today**:
- Wave 2 Batch 6 (20 violations)
- Debug/error utility functions
- Expect similar low-risk pattern

**Blockers**:
None

**Progress**:
- 270/5,580 fixed (4.8%)
- On track for Week 2 goals
```

### Escalation Template

```
🚨 **Escalation Needed**: Wave 3 Batch 2

**Context**:
Fixing any type in `src/components/MangaList.tsx:45`

**Issue**:
This changes the `onMangaSelect` prop signature
Affects 15 parent components

**Options**:
1. Update all 15 parents in one batch (3-4 hours)
2. Create new typed prop, deprecate old (migration)
3. Skip for now, revisit later

**Recommendation**:
Option 1 - we have capacity this week

**Question**:
Approve Option 1? Or prefer different approach?

**Impact if delayed**:
Wave 3 will be incomplete (180/200 instead of 200/200)
```

### Weekly Status Report

```
# Weekly Report: Week 3 - Critical Violations Remediation

**Period**: Nov 11-15, 2025

## Summary
Successfully completed Wave 2 and started Wave 3 (component props).
Ahead of schedule by 1 day.

## Metrics
- **Violations Fixed**: 350 this week, 600 total (10.8%)
- **Cascade Bonus**: 125 unsafe-call violations auto-resolved
- **Batches**: 20 completed, 0 rollbacks
- **Efficiency**: 3.2 hours/batch average

## Progress by Rule
| Rule | Start | Current | Fixed | % Complete |
|------|-------|---------|-------|------------|
| no-explicit-any | 1,776 | 1,426 | 350 | 20% |
| no-unsafe-call | 2,157 | 2,032 | 125 | 6% (cascade) |
| no-unnecessary-condition | 1,647 | 1,647 | 0 | 0% (Phase 4) |

## Highlights
- ✅ Zero production incidents
- ✅ All tests remain passing
- ✅ Type safety measurably improved
- ✅ Team velocity increasing (learning curve)

## Challenges
- Some external libraries need type declarations (expected)
- Coordinating with feature development (minimal conflicts so far)

## Next Week Plan
- Complete Wave 3 (100 remaining)
- Start Wave 4 (Event handlers)
- Goal: 400 more violations fixed

## Risks
- 🟡 Wave 4 might take longer (event handlers more complex)
- Mitigation: Smaller batch sizes (15 instead of 20)

## Questions/Needs
None currently - team is unblocked
```

---

## Success Metrics

### Quantitative Goals

Track daily:
- Violations fixed
- Cascade effect ratio
- Batch completion time
- Test pass rate
- Rollback frequency

### Qualitative Goals

Track weekly:
- Type safety improvement (subjective)
- Developer confidence
- Code review feedback
- Production stability

### Milestones

- ✅ **Week 1**: Phase 0 complete (5,580 violations analyzed)
- ✅ **Week 4**: 500+ violations fixed (9%)
- ✅ **Week 6**: 1,000+ violations fixed (18%)
- ✅ **Week 8**: Phase 1 complete (1,400+ violations, 25%)
- ✅ **Week 9**: Cascade effect verified
- ✅ **Week 12**: 3,000+ violations fixed (54%)
- ✅ **Week 16**: 4,000+ violations fixed (72%)
- ✅ **Week 18**: 4,500+ violations fixed (81%)

**Final Goal**: 80%+ fixed (4,500+/5,580) by Week 18

---

## Appendix: Agent Prompts Reference

### Quick Agent Launcher

**For any batch**:

```
Launch Analyzer Agent:

"Analyze batch of [N] violations from Wave [X] targeting [category].

For each violation:
1. Show current code
2. Determine correct type
3. Propose specific fix
4. Assess risk
5. Identify cascade impact

Format as detailed report with recommendations.
Use Phase 0 analysis: docs/eslint/phase0-[rule]-analysis.md
Take your time, be thorough."
```

**For validation**:

```
Launch Validator Agent:

"Validate the changes from Wave [X] Batch [Y].

Run:
1. bun run type-check
2. bun run lint (capture before/after counts)
3. bun test [relevant pattern]

Generate validation report with:
- Pass/fail status for each check
- Violation counts (before → after)
- Any new errors introduced
- Recommendation: COMMIT / ROLLBACK / NEEDS REVIEW"
```

---

## Next Actions

1. **Review this plan** with coordination team
2. **Set up infrastructure**:
   - Create progress tracking files
   - Set up validation scripts
   - Configure agent access
3. **Launch Phase 0**:
   - Start 3 agents in parallel
   - Monitor progress
   - Review generated reports
4. **Kick off Phase 1** once Phase 0 complete

---

**Ready to systematically eliminate 5,580 violations through coordinated agentic workflow!** 🚀

---

*Last Updated*: 2025-11-08
*Status*: Ready for Execution
*Next Review*: After Phase 0 completion
