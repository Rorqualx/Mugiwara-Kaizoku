# Type Safety ESLint Violations - Coordinated Agentic Workflow Plan

*Created*: 2025-11-08
*Branch*: `claude/eslint-violations-fix-plan-011CUv1WsgD8RZUSn7mDYfuD`
*Status*: Planning Phase
*Total Violations*: 3,204

---

## Executive Summary

This plan addresses **3,204 TypeScript type safety violations** across three critical ESLint rules that enforce explicit typing and prevent unsafe type operations. These violations represent a significant technical debt that undermines the project's strict type safety goals.

### Target Rules

| Rule | Count | Severity | Impact |
|------|-------|----------|--------|
| `@typescript-eslint/explicit-function-return-type` | 1,382 | High | Missing explicit return types on functions |
| `@typescript-eslint/no-unsafe-argument` | 1,093 | Critical | Arguments passed to functions with unsafe types |
| `@typescript-eslint/explicit-module-boundary-types` | 729 | High | Exported functions missing explicit types |
| **TOTAL** | **3,204** | | |

### Why This Matters

These violations directly contradict the project's strict type safety requirements:
- **CLAUDE.md** mandates "NO `any` TYPES ALLOWED"
- **tsconfig.json** has `strict: true` enabled
- **eslint.config.mjs** enforces these rules as errors
- Current violations prevent full type safety guarantees

---

## Rule Analysis

### 1. explicit-function-return-type (1,382 violations)

**What it enforces**: All functions must have explicit return type annotations.

**Current config** (eslint.config.mjs:101-105):
```typescript
'@typescript-eslint/explicit-function-return-type': ['error', {
  allowExpressions: true,              // Arrow functions in expressions OK
  allowTypedFunctionExpressions: true, // Typed function expressions OK
  allowHigherOrderFunctions: true      // HOF with inferred types OK
}]
```

**Common patterns needing fixes**:
```typescript
// ❌ VIOLATION
export function getManga(id: number) {
  return prisma.manga.findUnique({ where: { id } })
}

// ✅ FIXED
export function getManga(id: number): Promise<Manga | null> {
  return prisma.manga.findUnique({ where: { id } })
}
```

**Complexity levels**:
- **Low**: Simple synchronous functions with obvious return types
- **Medium**: Async functions returning Prisma queries
- **High**: Generic functions, higher-order functions, complex conditional returns

---

### 2. no-unsafe-argument (1,093 violations)

**What it enforces**: Prevents passing arguments with `any` or unsafe types to functions.

**Current config** (eslint.config.mjs:98):
```typescript
'@typescript-eslint/no-unsafe-argument': 'error'
```

**Common patterns needing fixes**:
```typescript
// ❌ VIOLATION
const data: any = await fetchData()
someFunction(data)  // Passing 'any' type

// ✅ FIXED - Option 1: Type assertion with validation
const data: unknown = await fetchData()
if (isValidData(data)) {
  someFunction(data)  // Now properly typed
}

// ✅ FIXED - Option 2: Explicit typing
const data: SomeType = await fetchData() as SomeType
someFunction(data)
```

**Root causes**:
- Functions receiving `any` from external APIs
- Untyped data from Prisma queries
- Type assertions bypassing safety
- Missing type guards

---

### 3. explicit-module-boundary-types (729 violations)

**What it enforces**: Exported functions must have explicit parameter and return types.

**Current config** (eslint.config.mjs:108):
```typescript
'@typescript-eslint/explicit-module-boundary-types': 'error'
```

**Common patterns needing fixes**:
```typescript
// ❌ VIOLATION
export function searchManga(query) {  // Missing parameter type
  return api.search(query)
}

// ✅ FIXED
export function searchManga(query: string): Promise<SearchResult[]> {
  return api.search(query)
}
```

**Overlap with Rule #1**: This rule is similar to `explicit-function-return-type` but specifically targets **module boundaries** (exports).

---

## Coordinated Agentic Workflow

### Agent Team Structure

#### 1. Coordinator Agent (You/Primary Claude Instance)
**Role**: Orchestration, final decisions, user escalation

**Responsibilities**:
- Reviews all agent proposals before execution
- Makes final decisions on ambiguous cases
- Escalates to user for domain knowledge
- Tracks overall progress
- Ensures no agent breaks type safety

**Authority**: Final approval on all changes

---

#### 2. Agent A: explicit-function-return-type Specialist
**Focus**: 1,382 violations - Adding explicit return types

**Analysis checklist**:
- ✅ Determine actual return type (static analysis)
- ✅ Check if function is async
- ✅ Identify conditional returns (union types)
- ✅ Handle generic functions
- ✅ Verify against existing usage

**Proposal format**:
```markdown
### Violation: [File:Line] - [Function Name]

**Complexity**: [Low/Medium/High]
**Return Type Analysis**: [Inferred type from implementation]

**Current Code**:
```typescript
function foo(x: number) {
  return x * 2
}
```

**Proposed Fix**:
```typescript
function foo(x: number): number {
  return x * 2
}
```

**Confidence**: [High/Medium/Low]
**Rationale**: [Why this return type is correct]
```

---

#### 3. Agent B: no-unsafe-argument Specialist
**Focus**: 1,093 violations - Fixing unsafe argument passing

**Analysis checklist**:
- ✅ Identify source of unsafe type
- ✅ Determine expected parameter type
- ✅ Check if type guard exists
- ✅ Assess if refactoring needed
- ✅ Verify no runtime errors

**Proposal format**:
```markdown
### Violation: [File:Line] - [Function Call]

**Risk**: [Low/Medium/High/Critical]
**Unsafe Argument**: [Parameter name and current type]
**Expected Type**: [What function expects]

**Root Cause**:
- Source: [Where does unsafe value come from?]
- Why unsafe: [any type? Missing assertion?]

**Proposed Fix**:
```typescript
// Before
const data: any = await fetch()
someFunc(data)

// After
const data: unknown = await fetch()
if (isValidType(data)) {
  someFunc(data)
}
```

**Type Guard Needed**: [Yes/No - provide implementation if yes]
**Testing Required**: [What needs to be tested]
```

---

#### 4. Agent C: explicit-module-boundary-types Specialist
**Focus**: 729 violations - Adding types to exported functions

**Analysis checklist**:
- ✅ Identify all parameters needing types
- ✅ Determine return type
- ✅ Check if function is used externally
- ✅ Verify against call sites
- ✅ Handle overloaded signatures

**Proposal format**:
```markdown
### Violation: [File:Line] - [Exported Function]

**Export Type**: [Named/Default/Re-export]
**Parameters Missing Types**: [List]
**Return Type Missing**: [Yes/No]

**Call Site Analysis**:
- Internal usage: [Count] files
- External usage: [Yes/No]
- Parameter types inferred from usage: [Types]

**Proposed Fix**:
```typescript
// Before
export function search(query) {
  return api.search(query)
}

// After
export function search(query: string): Promise<SearchResult[]> {
  return api.search(query)
}
```

**Confidence**: [High/Medium/Low]
```

---

#### 5. Validator Agent
**Role**: Post-fix validation

**Validation checklist**:
```bash
# 1. TypeScript compilation
npm run type-check

# 2. ESLint validation
npm run lint

# 3. Relevant tests
npm test -- [pattern]

# 4. Count remaining violations
npm run lint 2>&1 | grep -E "(explicit-function-return-type|no-unsafe-argument|explicit-module-boundary-types)" | wc -l
```

**Report format**:
```markdown
## Validation Report: Wave [N] Batch [M]

**Files Changed**: [Count]
**Violations Fixed**: [Count]

### TypeScript Compilation
- Status: ✅ PASS / ❌ FAIL
- New Errors: [List if any]

### ESLint
- Status: ✅ PASS / ❌ FAIL
- Violations Remaining: [Count]
- New Violations: [Count]

### Tests
- Status: ✅ PASS / ❌ FAIL
- Tests Run: [Count]
- Failures: [List]

### Recommendation
- Action: ✅ COMMIT / ❌ ROLLBACK / ⚠️ NEEDS REVIEW
```

---

## Execution Strategy

### Phase 1: Parallel Analysis (Est. 4-6 hours)

**Objective**: Categorize all 3,204 violations by complexity and risk

**Agent deployment**:
```
Coordinator: "Launch 3 agents in parallel to analyze violations"

Agent A → Analyze all 1,382 explicit-function-return-type violations
Agent B → Analyze all 1,093 no-unsafe-argument violations
Agent C → Analyze all 729 explicit-module-boundary-types violations
```

**Deliverables**:
1. `agent-a-return-types-analysis.md` - All 1,382 violations categorized
2. `agent-b-unsafe-args-analysis.md` - All 1,093 violations categorized
3. `agent-c-boundary-types-analysis.md` - All 729 violations categorized

**Categorization schema**:
```markdown
| File | Line | Function | Complexity | Risk | Estimated Fix Time |
|------|------|----------|------------|------|-------------------|
| src/foo.ts | 45 | getFoo | Low | Low | 30s |
| src/bar.ts | 120 | searchBar | High | Medium | 5min |
```

---

### Phase 2: Wave-Based Execution (Est. 40-60 hours)

**Wave structure** (from lowest to highest complexity):

#### Wave 1: Low Complexity - Quick Wins (Est. 8-12 hours)
**Target**: ~800 violations (25%)

**Criteria**:
- Simple synchronous functions with obvious return types
- Functions with single return statement
- Non-exported utility functions
- Type guards with clear expected types

**Batch size**: 25-30 violations per batch
**Expected outcome**: 800 violations fixed, ~70% reduction in low-hanging fruit

---

#### Wave 2: Medium Complexity - Async & Prisma (Est. 12-16 hours)
**Target**: ~1,200 violations (37%)

**Criteria**:
- Async functions returning Prisma queries
- Functions with conditional returns (union types)
- Exported utility functions
- Type assertions needing validation

**Batch size**: 15-20 violations per batch
**Expected outcome**: 1,200 violations fixed, core business logic typed

---

#### Wave 3: High Complexity - Generics & HOF (Est. 12-16 hours)
**Target**: ~800 violations (25%)

**Criteria**:
- Generic functions
- Higher-order functions
- Complex conditional logic
- Functions with multiple overloads
- tRPC procedures with complex inputs

**Batch size**: 10-15 violations per batch
**Expected outcome**: 800 violations fixed, advanced patterns properly typed

---

#### Wave 4: Critical Cases - Manual Review (Est. 8-12 hours)
**Target**: ~400 violations (13%)

**Criteria**:
- Ambiguous return types requiring domain knowledge
- Complex type narrowing scenarios
- Functions with side effects
- Cases requiring refactoring

**Batch size**: 5-10 violations per batch
**Expected outcome**: 400 violations fixed or documented as exceptions

---

#### Wave 5: Deferred Wave 1 Work - Complex Hooks & Utilities (Est. 6-10 hours)
**Target**: ~75 violations (deferred from Wave 1)

**Criteria**:
- Complex React hooks requiring detailed interface types
- Hooks with destructured return values (cannot use `:unknown`)
- Remaining utils/services violations requiring careful analysis
- Functions in src/hooks/** that break type inference when typed with `:unknown`

**What was deferred**:
1. **Complex hooks (est. 50-60 violations)**:
   - useProviderSearch, useReader, useReaderGestures
   - useLibraryScanner, usePatternLearning
   - useGenreBlacklist, useConfigTRPC
   - All hooks that return objects destructured in components

2. **Remaining utils/services (est. 74 violations)**:
   - src/utils/** - Utility functions not yet covered
   - src/server/services/** - Service functions requiring analysis

**Why deferred**:
- Wave 1 Batch 4 rollback: Using `:unknown` breaks type inference
- Example error: `Property 'results' does not exist on type 'unknown'`
- Requires creating detailed interface types for each hook
- High effort, high risk of TypeScript errors

**Approach**:
- Create proper interface types for each hook's return value
- Manual analysis of component usage to ensure correct typing
- Small batches (5-10 violations) with thorough validation

**Batch size**: 5-10 violations per batch
**Expected outcome**: Complete remaining Wave 1 work with proper interface types

---

## Parallel Execution Plan

### Option A: Sequential Agent Deployment (Safer, Slower)
**Timeline**: 40-60 hours over 1-2 weeks

```
Week 1:
- Phase 1: Parallel analysis (4-6 hours)
- Wave 1: Low complexity (8-12 hours)
- Wave 2 Part 1: Medium complexity (6-8 hours)

Week 2:
- Wave 2 Part 2: Medium complexity (6-8 hours)
- Wave 3: High complexity (12-16 hours)
- Wave 4: Critical cases (8-12 hours)
```

**Pros**:
- Lower risk of conflicts
- Easier to review and validate
- Can stop and adjust strategy

**Cons**:
- Takes 1-2 weeks
- Single-threaded execution

---

### Option B: Parallel Agent Deployment (Faster, Higher Risk)
**Timeline**: 20-30 hours over 3-5 days

```
Day 1:
- Phase 1: Parallel analysis (4-6 hours)
- Coordinator reviews and creates file allocation plan

Day 2-3:
- Agent A: Files 1-100 (Wave 1 + Wave 2)
- Agent B: Files 101-200 (Wave 1 + Wave 2)
- Agent C: Files 201-300 (Wave 1 + Wave 2)
- Running in parallel, non-overlapping files

Day 4-5:
- All agents: Wave 3 + Wave 4 (sequential, requires more care)
- Final validation and integration
```

**Pros**:
- 2x faster completion
- Efficient use of multiple agents

**Cons**:
- Higher risk of merge conflicts
- Requires careful file allocation
- More complex coordination

**File allocation strategy**:
```
Agent A: src/server/trpc/routers/**
Agent B: src/server/services/**
Agent C: src/components/**, src/pages/**
```

---

## Risk Mitigation

### 1. Type Safety Validation
**Before fixing ANY violation**:
```bash
# Run TypeScript compiler to establish baseline
npm run type-check 2>&1 | tee /tmp/baseline-errors.txt

# After each batch
npm run type-check 2>&1 | tee /tmp/current-errors.txt
diff /tmp/baseline-errors.txt /tmp/current-errors.txt
```

**Rule**: If new TypeScript errors appear, ROLLBACK immediately.

---

### 2. Git Commit Strategy
Each batch = separate commit:

```
feat(types): Add explicit return types - Wave 1 Batch 3

Fixed 25 explicit-function-return-type violations across 12 files:
- Added return types to utility functions in src/lib/utils
- Added Promise<T> types to async functions in src/server/api
- Added union return types to conditional functions

Complexity: Low
Risk: Low
Validation: TypeScript ✅ ESLint ✅ Tests ✅

Files changed:
- src/lib/utils/date-helpers.ts: 3 functions
- src/server/api/manga.ts: 5 functions
- src/hooks/useManga.ts: 4 functions
[etc.]
```

---

### 3. Rollback Plan
If validation fails:
```bash
git reset --hard HEAD~1
git log -1 > /tmp/failed-batch.txt
# Document in manual-review-decisions.md
```

---

### 4. Testing Strategy
- **Wave 1**: Run affected tests after each batch
- **Wave 2**: Run full test suite after each wave
- **Wave 3**: Run full test suite + manual smoke testing
- **Wave 4**: Comprehensive testing including edge cases

---

## Human-in-the-Loop Triggers

Agents MUST escalate to user when:

### 1. Domain Knowledge Required
**Example**: "Function returns different types based on runtime config. Should we use union type or refactor?"

### 2. Type Ambiguity
**Example**: "Function can return `Manga | null | undefined`. Should we use `Manga | null` or add explicit undefined handling?"

### 3. Breaking Changes
**Example**: "Adding explicit type reveals that function currently returns wrong type. This may break callers."

### 4. Refactoring Needed
**Example**: "To fix `no-unsafe-argument`, we need to add 5 new type guards. Should we proceed or document as tech debt?"

---

## Progress Tracking

### Metrics Dashboard
Update after each batch in `TYPE_SAFETY_PROGRESS.md`:

```markdown
## Progress Dashboard

**Last Updated**: 2025-11-08 14:30

| Rule | Total | Fixed | Remaining | % Complete |
|------|-------|-------|-----------|------------|
| explicit-function-return-type | 1,382 | 250 | 1,132 | 18% |
| no-unsafe-argument | 1,093 | 0 | 1,093 | 0% |
| explicit-module-boundary-types | 729 | 0 | 729 | 0% |
| **TOTAL** | **3,204** | **250** | **2,954** | **8%** |

### Current Wave
- Wave: 1
- Batch: 8
- Status: In Progress
- Agent: A
- Files: src/lib/utils/*

### Latest Commits
- a1b2c3d: Wave 1 Batch 8 - 25 violations fixed
- d4e5f6g: Wave 1 Batch 7 - 28 violations fixed
- h7i8j9k: Wave 1 Batch 6 - 22 violations fixed
```

---

## Decision Trees

### For explicit-function-return-type

```
Does function have single return statement?
├─ Yes → Infer type directly → LOW COMPLEXITY
└─ No
   ├─ Are all returns same type?
   │  ├─ Yes → Use that type → LOW-MEDIUM COMPLEXITY
   │  └─ No → Use union type → MEDIUM COMPLEXITY
   └─ Is function generic?
      ├─ Yes → Analyze type parameters → HIGH COMPLEXITY
      └─ No → Analyze each return path → MEDIUM-HIGH COMPLEXITY
```

### For no-unsafe-argument

```
Where does unsafe value come from?
├─ External API
│  ├─ Add type guard → MEDIUM COMPLEXITY
│  └─ Use unknown + validation → MEDIUM COMPLEXITY
├─ Prisma query
│  ├─ Use generated types → LOW COMPLEXITY
│  └─ Add type assertion → LOW-MEDIUM COMPLEXITY
├─ Type assertion
│  ├─ Replace with proper type → MEDIUM COMPLEXITY
│  └─ Add validation → HIGH COMPLEXITY
└─ Function parameter
   ├─ Fix caller's type → CASCADE FIX
   └─ Add type guard → MEDIUM COMPLEXITY
```

### For explicit-module-boundary-types

```
Is function exported?
├─ Yes
│  ├─ Used externally?
│  │  ├─ Yes → CRITICAL - must match existing usage
│  │  └─ No → MEDIUM - can infer from internal usage
│  └─ Missing parameter types?
│     ├─ Yes → Add from call sites → MEDIUM COMPLEXITY
│     └─ No → Only missing return type → LOW COMPLEXITY
└─ No → Should not be exported → REFACTOR NEEDED
```

---

## Success Criteria

### Per-Wave Criteria
- ✅ All batches completed
- ✅ All validations passed
- ✅ TypeScript compilation clean (no new errors)
- ✅ ESLint violations reduced by target amount
- ✅ All tests passing
- ✅ Decisions documented

### Overall Completion Criteria
- ✅ 90%+ of violations fixed (2,884/3,204)
- ✅ No new type safety violations introduced
- ✅ TypeScript strict mode still passing
- ✅ All tests passing
- ✅ Manual smoke test complete
- ✅ Remaining violations documented with justification

---

## Tools & Scripts

### 1. Count Violations by Rule
```bash
#!/bin/bash
# count-type-violations.sh

echo "Counting type safety violations..."

echo -n "explicit-function-return-type: "
npm run lint 2>&1 | grep "explicit-function-return-type" | wc -l

echo -n "no-unsafe-argument: "
npm run lint 2>&1 | grep "no-unsafe-argument" | wc -l

echo -n "explicit-module-boundary-types: "
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l
```

### 2. Generate Violation Manifest
```bash
#!/bin/bash
# generate-manifest.sh

npm run lint --format json > /tmp/violations.json

node -e "
const data = require('/tmp/violations.json');
const violations = data.flatMap(file =>
  file.messages
    .filter(m => [
      'explicit-function-return-type',
      'no-unsafe-argument',
      'explicit-module-boundary-types'
    ].some(rule => m.ruleId?.includes(rule)))
    .map(m => ({
      file: file.filePath,
      line: m.line,
      rule: m.ruleId,
      message: m.message
    }))
);
console.log(JSON.stringify(violations, null, 2));
" > /tmp/violations-manifest.json
```

### 3. Batch Progress Tracker
```bash
#!/bin/bash
# track-progress.sh

WAVE=$1
BATCH=$2
VIOLATIONS_FIXED=$3

echo "## Wave $WAVE Batch $BATCH - $(date)" >> TYPE_SAFETY_PROGRESS.md
echo "" >> TYPE_SAFETY_PROGRESS.md
echo "**Violations Fixed**: $VIOLATIONS_FIXED" >> TYPE_SAFETY_PROGRESS.md
echo "" >> TYPE_SAFETY_PROGRESS.md

# Count remaining
./count-type-violations.sh >> TYPE_SAFETY_PROGRESS.md
echo "" >> TYPE_SAFETY_PROGRESS.md
```

---

## Recommended Next Steps

### Option 1: Full Parallel Analysis (Recommended)
**Action**: Launch Phase 1 with 3 agents in parallel

**Command**:
```
I need you to:
1. Launch Agent A to analyze all explicit-function-return-type violations
2. Launch Agent B to analyze all no-unsafe-argument violations
3. Launch Agent C to analyze all explicit-module-boundary-types violations

Run them in parallel. Each should produce a categorized analysis report.
```

**Timeline**: 4-6 hours for complete analysis
**Outcome**: Three detailed reports categorizing all 3,204 violations

---

### Option 2: Pilot Wave (Cautious Start)
**Action**: Start with Wave 1 on a small subset

**Command**:
```
Let's start with a pilot:
1. Analyze 100 low-complexity explicit-function-return-type violations
2. Fix 25 violations in Batch 1
3. Validate and commit
4. Review results before scaling
```

**Timeline**: 2-3 hours for pilot
**Outcome**: Proof of concept with learnings to refine strategy

---

### Option 3: Strategic File-by-File
**Action**: Target high-impact files first

**Command**:
```
Focus on these critical files first:
1. src/server/trpc/routers/* - API boundary types
2. src/server/services/* - Core business logic
3. src/lib/utils/* - Shared utilities

Fix all violations in these directories before moving to components.
```

**Timeline**: 8-12 hours for critical paths
**Outcome**: Core functionality fully typed, UI can follow

---

## Key Takeaways

1. **Type Safety is Non-Negotiable**: 3,204 violations undermine the project's strict mode
2. **Systematic Approach Required**: Too many to fix manually, agents are essential
3. **Validation is Critical**: Every batch must pass TypeScript + ESLint + Tests
4. **Incremental Progress**: Small batches, frequent commits, easy rollback
5. **Parallel Where Possible**: 3 agents can work non-overlapping files simultaneously
6. **User Input When Needed**: Domain knowledge beats guessing

---

## References

- **ESLint Config**: `eslint.config.mjs` (rules defined lines 101, 98, 108)
- **TypeScript Config**: `tsconfig.json` (strict mode enabled)
- **Existing Workflow**: `docs/eslint/agentic-workflow-guide.md` (567 violations)
- **CLAUDE.md**: Project conventions and type safety requirements
- **Progress Tracking**: `TYPE_SAFETY_PROGRESS.md` (to be created)

---

*Last Updated*: 2025-11-08
*Status*: **READY FOR EXECUTION**
*Estimated Total Time*: 40-60 hours (sequential) or 20-30 hours (parallel)
*Recommended Start*: Option 1 - Full Parallel Analysis
