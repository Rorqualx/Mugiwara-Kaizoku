# Agentic Workflow Guide for ESLint Manual Review

*Branch*: eslint/manual-review-workflow
*Created*: 2025-11-07
*Purpose*: Define how agents analyze and propose fixes for ESLint violations

---

## Overview

This guide establishes the agent team structure and workflow for systematically reviewing and fixing 567 ESLint violations across three rules, with emphasis on **manual review** and **no automated fixes that cause trouble**.

### Core Principle
**"Analyze first, propose carefully, execute conservatively"**

Agents MUST NOT apply bulk automated fixes. Each violation requires contextual analysis and deliberate decision-making.

---

## Agent Team Structure

### 1. Coordinator Agent (Primary)
**Role**: Orchestrates workflow, makes final decisions

**Responsibilities**:
- Reviews all agent proposals
- Makes final decision on ambiguous cases
- Escalates to user when domain knowledge needed
- Tracks progress across all waves
- Ensures no agent applies fixes without approval

**Authority**: Final say on all changes

---

### 2. Analyzer Agent A: no-unused-vars Specialist
**Focus**: 243 violations of unused variables, imports, parameters

**Analysis Checklist**:
- ✅ Is the variable/import truly unused? (Check all references)
- ✅ Is it exported? (Can't remove if exported)
- ✅ Is it required by interface contract?
- ✅ Does it indicate incomplete feature? (useState setters)
- ✅ Is it used in type narrowing or runtime checks?

**Proposal Format**:
```markdown
### Violation: [File:Line] - [Variable Name]

**Type**: [Import/Variable/Parameter/State Setter]
**Risk**: [Low/Medium/High]

**Analysis**:
- [What the violation is]
- [Why it exists]
- [Impact of removal]

**References Check**:
- Searched codebase: [Number of references found]
- Used in types: [Yes/No]
- Used in JSDoc: [Yes/No]

**Recommendation**: [Remove/Prefix with _/Keep with comment/User decision needed]

**Rationale**: [Explain why]
```

**DO NOT**:
- Apply fixes without coordinator approval
- Remove exports without checking downstream usage
- Remove interface-required parameters

---

### 3. Analyzer Agent B: no-non-null-assertion Specialist
**Focus**: 213 violations of non-null assertions (!)

**Analysis Checklist**:
- ✅ Is there a null/undefined check before assertion?
- ✅ What is the data flow? Where does the value come from?
- ✅ Can the value actually be null/undefined at runtime?
- ✅ Is this a Map.get() or array access assumption?
- ✅ Would optional chaining be safer?

**Proposal Format**:
```markdown
### Violation: [File:Line] - [Expression]

**Pattern**: [After undefined check/Map operation/No visible check]
**Risk**: [Low/Medium/High]

**Context Analysis**:
```typescript
// Code before assertion
[Relevant code showing data flow]

// The assertion
[Line with !]

// Code after
[Usage of value]
```

**Safety Assessment**:
- Value source: [Where does it come from?]
- Null/undefined possible?: [Yes/No/Unknown]
- Check present?: [Yes/No]
- Alternative approaches: [List options]

**Recommendation**: [Remove !/Add check/Use optional chaining/Refactor]

**Proposed Fix**:
```typescript
// Current (unsafe)
[Current code]

// Proposed (safe)
[Safer code]
```

**Testing Impact**: [What needs to be tested]
```

**DO NOT**:
- Remove assertions without understanding data flow
- Assume checks from other functions are sufficient
- Apply fixes that could cause runtime errors

---

### 4. Analyzer Agent C: require-await Specialist
**Focus**: 111 violations of async without await

**Analysis Checklist**:
- ✅ Is this an event handler?
- ✅ Does the function have any async operations?
- ✅ Is async required by interface?
- ✅ Do callers expect a Promise?
- ✅ Is it future-proofing for planned async operations?

**Proposal Format**:
```markdown
### Violation: [File:Line] - [Function Name]

**Type**: [Event handler/Method/Simple wrapper/Complex logic]
**Risk**: [Low/Medium/High]

**Function Analysis**:
```typescript
[Full function code]
```

**Async Usage**:
- Has await statements: No
- Returns Promise: [Yes/No]
- Calls async functions: [Yes/No]

**Interface Check**:
- Part of interface?: [Yes/No]
- Interface requires async?: [Yes/No - Include interface definition]
- Callers expect Promise?: [Yes - list call sites / No]

**Recommendation**: [Remove async/Keep with comment/User decision needed]

**If Remove Async**:
```typescript
// Before
async function foo() {
  return value
}

// After
function foo() {
  return value
}
```

**If Keep with Comment**:
```typescript
// eslint-disable-next-line @typescript-eslint/require-await
async function foo() {  // Required by IFoo interface
  return value
}
```

**Impact**: [What changes in calling code, if any]
```

**DO NOT**:
- Remove async from interface-required methods
- Change signatures that would break call sites
- Remove async without checking if callers use await/then

---

### 5. Validator Agent
**Role**: Runs after each batch of approved fixes

**Validation Checklist**:
```bash
# 1. TypeScript Compilation
cd ../eslint-cleanup-worktree
bun run type-check

# 2. ESLint Validation
bun run lint

# 3. Relevant Tests (based on changed files)
bun test [pattern]

# 4. Count Remaining Violations
bun run lint 2>&1 | grep -E "(no-unused-vars|no-non-null-assertion|require-await)" | wc -l
```

**Report Format**:
```markdown
## Validation Report: Wave [N] Batch [M]

**Files Changed**: [List]
**Violations Fixed**: [Count]

### TypeScript Compilation
- ✅ PASS / ❌ FAIL
- Errors: [List any errors]

### ESLint
- ✅ PASS / ❌ FAIL
- New violations: [Any new violations introduced?]
- Violations remaining: [Count]

### Tests
- ✅ PASS / ❌ FAIL
- Tests run: [Count]
- Failures: [List any failures]

### Recommendation
- ✅ COMMIT / ❌ ROLLBACK / ⚠️ NEEDS REVIEW
```

**Authority**: Can BLOCK commits if validation fails

---

## Workflow Phases

### Phase 1: Parallel Analysis (Initial Categorization)

Run 3 analyzer agents in PARALLEL to categorize all violations:

```
Coordinator: "Analyze all violations in parallel"

Agent A → Analyzes all 243 no-unused-vars violations
Agent B → Analyzes all 213 no-non-null-assertion violations
Agent C → Analyzes all 111 require-await violations

Output: Three categorization reports (Low/Medium/High risk)
```

**Deliverables**:
1. `no-unused-vars-analysis.md` - All 243 violations categorized
2. `no-non-null-assertion-analysis.md` - All 213 violations categorized
3. `require-await-analysis.md` - All 111 violations categorized

---

### Phase 2: Wave-Based Execution (Sequential)

For each wave, process in small batches:

```
Wave 1 (Low Risk) → Batch 1 (15 violations)
  ↓
Agent analyzes batch → Proposes fixes
  ↓
Coordinator reviews → Approves/Rejects/Escalates
  ↓
[If approved] Apply fixes
  ↓
Validator runs checks
  ↓
[If PASS] Commit | [If FAIL] Rollback
  ↓
Continue to next batch
```

### Batch Sizing
- **Low risk**: 15-20 violations per batch
- **Medium risk**: 10-15 violations per batch
- **High risk**: 5-10 violations per batch
- **Critical**: 1-3 violations per batch (full testing each)

---

## Decision Trees

### For no-unused-vars

```
Is variable used anywhere?
├─ Yes → Keep, investigate why flagged
└─ No
   ├─ Is it exported?
   │  ├─ Yes → Check downstream consumers
   │  │  ├─ Used downstream → Keep
   │  │  └─ Not used → Remove export + variable
   │  └─ No
   │     ├─ Is it a parameter?
   │     │  ├─ Required by interface → Prefix with _
   │     │  └─ Not required → Remove
   │     ├─ Is it a state setter?
   │     │  └─ Ask user: Incomplete feature or remove state?
   │     └─ Is it a type import?
   │        ├─ Used in JSDoc/types → Keep
   │        └─ Not used → Remove
```

### For no-non-null-assertion

```
Is there a null check before assertion?
├─ Yes (clearly visible)
│  └─ Low risk → Remove !, TypeScript should infer
└─ No visible check
   ├─ Where does value come from?
   │  ├─ Map.get() → Use optional chaining
   │  ├─ Array access → Add bounds check
   │  ├─ Property access → Use optional chaining
   │  └─ Function return → Check function, add type guard
   └─ High risk → Add proper null handling
```

### For require-await

```
Does function have await?
└─ No
   ├─ What type of function?
   │  ├─ Event handler → Remove async (LOW RISK)
   │  ├─ Simple getter → Check interface requirement
   │  │  ├─ Interface requires async → Keep with comment
   │  │  └─ Not required → Remove async
   │  └─ Complex logic → Manual review
   │     ├─ Check call sites
   │     ├─ Check if future-proofing
   │     └─ User decision if unclear
```

---

## Human-in-the-Loop Triggers

Agents MUST escalate to user when:

### 1. Domain Knowledge Required
- **Example**: "Is this feature incomplete or can we remove the state?"
- **Example**: "Should this async signature be kept for future async operations?"

### 2. Multiple Valid Approaches
- **Example**: "We can either refactor to use optional chaining OR add explicit null checks. Which fits the codebase style better?"

### 3. High-Risk Changes
- **Example**: "Removing this non-null assertion may cause runtime errors in edge cases we can't fully analyze."

### 4. Breaking Changes
- **Example**: "Removing async from this method may break external consumers if this is a public API."

### Escalation Format
```markdown
## User Decision Required

**Context**: [File:Line] - [What we're trying to fix]

**Issue**: [Why we need user input]

**Options**:
1. [Option A]: [Pros/Cons]
2. [Option B]: [Pros/Cons]
3. [Option C]: [Pros/Cons]

**Recommendation**: [Agent's suggestion if any]

**Impact**: [What changes based on decision]

**Question**: [Clear, specific question for user]
```

---

## Safety Mechanisms

### 1. No Bulk Operations
- ❌ "Fix all unused imports in one batch"
- ✅ "Fix 15 unused imports from unrelated files in batch 1"

### 2. Git Commit Strategy
Each batch is a separate commit with detailed message:

```
feat(eslint): Fix no-unused-vars violations - Wave 1 Batch 3

Fixed 15 unused variable violations across 8 files:
- Removed unused imports: useCallback, logger
- Removed unused helper functions: isValidDate, safeGet
- Prefixed unused parameters: _libraryId, _onRefresh

Risk level: Low
Validation: TypeScript ✅ ESLint ✅ Tests ✅

Files changed:
- src/hooks/useManga.ts: Removed unused useCallback import
- src/components/MangaCard.tsx: Removed unused isValidDate helper
[etc.]
```

### 3. Rollback Plan
If validator fails:
1. Immediately run `git reset --hard HEAD~1`
2. Log issue in `manual-review-decisions.md`
3. Analyze what went wrong
4. Adjust approach before retrying

### 4. Testing Strategy
- **Wave 1**: Run full test suite after wave complete
- **Wave 2**: Run full test suite + manual smoke test
- **Wave 3**: Per-file testing + integration tests
- **Wave 4**: Comprehensive testing, may need staging environment

---

## Agent Communication Protocol

### Agent → Coordinator
```markdown
**From**: Agent [A/B/C]
**Batch**: Wave [N] Batch [M]
**Status**: [Analyzed/Awaiting Approval/Question]

[Analysis or proposal using formats above]
```

### Coordinator → Agent
```markdown
**Decision**: [Approved/Rejected/Revise/Escalated]
**Feedback**: [Comments if rejected/needs revision]
**Action**: [What agent should do next]
```

### Coordinator → User
```markdown
**Escalation**: Wave [N] Batch [M] - [Brief description]
**Question**: [Clear question]
**Options**: [Numbered list]
**Recommendation**: [If any]
```

---

## Progress Tracking

Update `manual-review-decisions.md` after each batch:

```markdown
### Wave 1 Batch 3: Unused Imports (Low Risk)

**Date**: 2025-11-07
**Agent**: Analyzer A
**Status**: ✅ Completed

| File | Line | Variable | Decision | Rationale |
|------|------|----------|----------|-----------|
| src/hooks/useManga.ts | 5 | useCallback | REMOVED | No references, import unused |
| src/components/MangaCard.tsx | 10 | logger | REMOVED | Component uses console instead |

**Validation**:
- TypeScript: ✅ PASS
- ESLint: ✅ PASS (15 violations resolved)
- Tests: ✅ PASS (all tests passing)

**Commit**: `abc123def`
```

---

## Example Workflows

### Example 1: Low-Risk Unused Import

**Agent A Analysis**:
```markdown
### Violation: src/hooks/useManga.ts:5 - useCallback

**Type**: Import
**Risk**: Low

**Analysis**:
- import { useCallback } from 'react' is present
- Searched codebase for useCallback usage in this file: 0 references
- File uses other React hooks but not useCallback

**References Check**:
- Searched codebase: 0 references in this file
- Used in types: No
- Used in JSDoc: No

**Recommendation**: Remove

**Rationale**: Import is unused, safe to remove with no impact.
```

**Coordinator Review**: ✅ Approved

**Validator Check**: ✅ All checks pass

**Action**: Commit

---

### Example 2: High-Risk Non-Null Assertion

**Agent B Analysis**:
```markdown
### Violation: src/hooks/useProviderSearch.ts:150 - result.error!

**Pattern**: No visible check
**Risk**: High

**Context Analysis**:
```typescript
// Line 145-152
if (result.isErr()) {
  onError(result.provider, result.error!);  // ⚠️ HIGH RISK
  return;
}
```

**Safety Assessment**:
- Value source: AsyncResult.error property
- Null/undefined possible?: Yes - error may be undefined if isErr() has bug
- Check present?: Only isErr() check, doesn't guarantee error exists
- Alternative approaches: Use optional chaining, add explicit check

**Recommendation**: Refactor - Add explicit error check

**Proposed Fix**:
```typescript
// Current (unsafe)
if (result.isErr()) {
  onError(result.provider, result.error!);
  return;
}

// Proposed (safe)
if (result.isErr() && result.error) {
  onError(result.provider, result.error);
  return;
}
// Alternative: Update AsyncResult type to guarantee error when isErr()
```

**Testing Impact**: Need to test error handling paths
```

**Coordinator Review**: Escalate to user

**User Question**:
```markdown
## User Decision Required

**Context**: useProviderSearch.ts:150 - Non-null assertion on result.error

**Issue**: AsyncResult.isErr() doesn't type-guarantee that error exists

**Options**:
1. Add explicit error check (defensive): `if (result.isErr() && result.error)`
2. Fix AsyncResult type to guarantee error when isErr() (structural fix)
3. Keep assertion with comment explaining isErr() contract

**Recommendation**: Option 2 - Fix AsyncResult type (more robust)

**Impact**: Option 2 requires updating AsyncResult implementation and all usages

**Question**: Should we fix the AsyncResult type system to properly guarantee error exists when isErr() is true, or use defensive checks?
```

---

## Completion Criteria

### Per-Wave Criteria
- ✅ All batches in wave completed
- ✅ All validations passed
- ✅ All changes committed
- ✅ Decision log updated
- ✅ Progress metrics updated

### Overall Completion
- ✅ 80%+ of target violations resolved (484/567)
- ✅ No new ESLint violations introduced
- ✅ All tests passing
- ✅ TypeScript compilation clean
- ✅ Manual smoke testing complete
- ✅ Decision log complete with patterns documented
- ✅ Remaining violations documented with justification

---

## Key Takeaways

1. **Analyze Before Acting**: Every violation needs contextual understanding
2. **Small Batches**: Easier to review, easier to rollback
3. **Test Everything**: No commit without validation
4. **Document Decisions**: Future maintainers need to understand why
5. **Escalate When Uncertain**: User input is better than guessing
6. **Safety Over Speed**: Taking time prevents introducing bugs

---

## Reference Documents

- [Violations Categorized](./violations-categorized.md) - Detailed breakdown of all 567 violations
- [Manual Review Decisions](./manual-review-decisions.md) - Decision log (updated per batch)
- [ESLint Rules Reference](./eslint-rules-reference.md) - Rule documentation
- [AST-Grep Guide](../development/ast-grep-guide.md) - Code search patterns

---

*Last Updated*: 2025-11-07
*Maintainer*: Development Team
*Status*: Ready for use
