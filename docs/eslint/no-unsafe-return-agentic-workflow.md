# Agentic Workflow Implementation: no-unsafe-return Fixes

*Status: Ready to Execute*
*Created: 2025-11-08*
*Parent Plan: [no-unsafe-return-comprehensive-plan.md](./no-unsafe-return-comprehensive-plan.md)*

---

## Overview

This document provides the **exact commands and prompts** to execute the parallel agentic workflow for fixing 250-350 `@typescript-eslint/no-unsafe-return` violations.

**Execution Model:** Sequential phases with parallel agents within each phase

---

## Phase 1: Parallel Initial Analysis

**Duration:** ~2-3 hours
**Agents:** 4 parallel agents (A, B, C, D)
**Goal:** Categorize all violations by risk and pattern

### Step 1: Launch 4 Parallel Analysis Agents

**Execute these 4 Task calls in a SINGLE message:**

```typescript
// Agent A: Tier 1 Critical Files Analysis
Task({
  subagent_type: "Explore",
  model: "sonnet",
  description: "Analyze Tier 1 files for no-unsafe-return",
  prompt: `Analyze the top 5 most critical files for @typescript-eslint/no-unsafe-return violations:

1. src/utils/type-guards/generated.ts
2. src/server/trpc/routers/manga.ts
3. src/server/trpc/routers/metadata.ts
4. src/server/services/metadataMerger.ts
5. src/components/addManga/services/sourceManagementService.ts

For EACH file:
1. Search for functions that return values typed as 'any' or cast values unsafely
2. Identify the exact line numbers and function names
3. Categorize each violation as: CRITICAL 🔴 / HIGH 🟠 / MEDIUM 🟡 / LOW 🟢
4. Identify the pattern (Record property access, array operation, generic return, etc.)
5. Estimate complexity of fix (Simple/Moderate/Complex)

Provide a markdown report with:
- Total violations per file
- List of all violations with line numbers and risk level
- Common patterns found
- Recommended fix approaches per pattern

Save your findings to: docs/eslint/no-unsafe-return-tier1-analysis.md`
})

// Agent B: Tier 2 High-Volume Files Analysis
Task({
  subagent_type: "Explore",
  model: "sonnet",
  description: "Analyze Tier 2 files for no-unsafe-return",
  prompt: `Analyze files 6-20 for @typescript-eslint/no-unsafe-return violations:

6. src/server/services/fandom/FandomService.ts
7. src/server/services/wikipedia/WikipediaService.ts
8. src/server/services/config/configService.ts
9. src/server/services/fandom/dynamic/DynamicWikiParser.ts
10. src/server/services/fandom/dynamic/WikiContentScraper.ts
11. src/server/services/metadata/utils/fandomTableParser.ts
12. src/server/parsers/extractors/TableExtractor.ts
13. src/server/trpc/routers/system.ts
14. src/server/services/download/fileImporter.ts
15. src/server/parsers/UnifiedMetadataParser.ts
16. src/server/services/download/clients/transmissionClient.ts
17. src/sdk/kaizoku-api-sdk.ts
18. src/server/services/download/clients/delugeClient.ts
19. src/server/services/download/downloadManager.ts
20. src/server/services/backup/index.ts

For EACH file:
1. Search for unsafe return patterns
2. Document violations with line numbers
3. Categorize by risk level
4. Identify fix patterns

Provide a markdown report saved to: docs/eslint/no-unsafe-return-tier2-analysis.md`
})

// Agent C: Pattern Analysis
Task({
  subagent_type: "Explore",
  model: "sonnet",
  description: "Identify common no-unsafe-return patterns",
  prompt: `Analyze the ENTIRE src/ directory to identify common patterns that trigger @typescript-eslint/no-unsafe-return violations.

Search for these patterns:
1. Functions with explicit return types that access Record<string, unknown> properties
2. Functions that return "as any" cast values
3. Array.map/filter operations that return unchecked element types
4. Generic functions that return "value as T" without validation
5. API response property access chains

For each pattern:
1. Find 3-5 representative examples
2. Show the unsafe code
3. Propose a safe fix template
4. Estimate how many violations follow this pattern
5. Create reusable type guard utilities if applicable

Deliverable: Save comprehensive pattern guide to: docs/eslint/no-unsafe-return-patterns.md

Include:
- Pattern catalog (at least 5 patterns)
- Fix templates for each pattern
- Utility function proposals
- Estimated violation count per pattern`
})

// Agent D: Impact Analysis
Task({
  subagent_type: "Explore",
  model: "sonnet",
  description: "Analyze dependencies and impact",
  prompt: `Analyze the dependency impact of fixing @typescript-eslint/no-unsafe-return violations.

Tasks:
1. Identify shared utility functions that are used widely and have violations
   - Search for functions exported from src/utils/ that have unsafe returns
   - Check how many files import these utilities

2. Map type system dependencies
   - Which files define core types that are returned unsafely?
   - Which files depend on these type definitions?

3. Identify breaking change risks
   - Which functions are exported from src/server/trpc/routers/?
   - Which functions are part of the SDK (src/sdk/)?
   - What are the public APIs we must be careful with?

4. Create a dependency graph showing:
   - High-impact files (changing these affects many other files)
   - Low-impact files (isolated changes)
   - Critical paths (sequences of dependencies)

Deliverable: Save analysis to: docs/eslint/no-unsafe-return-impact.md

Include:
- List of high-impact utility functions
- List of public API functions requiring careful review
- Dependency chains to watch out for
- Recommended fix order based on dependencies`
})
```

### Step 2: Wait for All 4 Agents to Complete

All agents will create markdown reports in `docs/eslint/`.

### Step 3: Review Analysis Reports

Once complete, read all 4 reports:

```bash
# Read the reports
cat docs/eslint/no-unsafe-return-tier1-analysis.md
cat docs/eslint/no-unsafe-return-tier2-analysis.md
cat docs/eslint/no-unsafe-return-patterns.md
cat docs/eslint/no-unsafe-return-impact.md
```

### Step 4: Consolidate Findings

Create a summary report combining all findings to validate estimates and refine the plan.

---

## Phase 2: Wave 1 Execution (Low-Risk Violations)

**Duration:** 2 days
**Agents:** 4 parallel worker agents (E, F, G, H)
**Goal:** Fix 120-155 low-risk violations
**Batch Size:** 20-25 violations per batch

### Prerequisites

Before starting Wave 1:
1. ✅ Phase 1 analysis complete
2. ✅ Patterns documented
3. ✅ Utility functions designed (if needed)

### Batch Assignment Strategy

Coordinator divides low-risk violations into 4 batches based on patterns:

**Batch 1 (Agent E):** Simple Record property access with existing checks
**Batch 2 (Agent F):** Array element validation patterns
**Batch 3 (Agent G):** Straightforward cast removals
**Batch 4 (Agent H):** Mixed low-risk violations

### Step 1: Launch Batch 1 (Agent E)

```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Fix Wave 1 Batch 1 violations",
  prompt: `You are Agent E fixing @typescript-eslint/no-unsafe-return violations - Wave 1 Batch 1.

**Your batch:** Simple Record<string, unknown> property access violations with existing type checks

**Files to fix:** (Based on tier1-analysis.md - extract 20-25 LOW RISK violations)

Your task:
1. Read docs/eslint/no-unsafe-return-tier1-analysis.md
2. Read docs/eslint/no-unsafe-return-patterns.md for fix templates
3. Identify 20-25 LOW RISK violations in the pattern: "Simple Record property access"

For EACH violation:
1. Read the file and understand the function
2. Verify the issue is: returning property from Record without type narrowing
3. Apply the safe fix pattern:
   - Add typeof check before return
   - Return undefined if type check fails
   - Remove unsafe cast

4. After fixing ALL 20-25 violations:
   - Run: bun run type-check (must pass)
   - Run: bun run lint 2>&1 | grep "@typescript-eslint/no-unsafe-return" | wc -l
   - Report violations fixed

5. Create a detailed commit:
   feat(eslint): Fix no-unsafe-return violations - Wave 1 Batch 1

   Fixed 25 low-risk violations across 12 files:
   - Added type guards for Record property access
   - Validated types before return
   - Removed unsafe casts

   Pattern: Simple Record<string, unknown> property access
   Risk level: Low 🟢
   Validation: TypeScript ✅ ESLint ✅

   Violations fixed:
   - src/utils/search/searchResultAdapter.ts:45,67,89
   - src/server/parsers/extractors/MetadataExtractor.ts:120,145
   [list all files:lines]

   Before: [COUNT] violations | After: [COUNT] violations | Fixed: 25

6. Commit and push your changes

Report back:
- ✅ Success: [count] violations fixed, commit SHA
- ❌ Failure: [what went wrong], need guidance`
})
```

### Step 2: Launch Remaining Batches in Parallel

Once Batch 1 succeeds and you understand the pattern, launch batches 2-4 in parallel:

```typescript
// Agent F: Batch 2 - Array operations
Task({...})  // Similar structure, different pattern

// Agent G: Batch 3 - Cast removals
Task({...})  // Similar structure, different pattern

// Agent H: Batch 4 - Mixed low-risk
Task({...})  // Similar structure, different pattern
```

### Step 3: Validate Each Batch

For each completed batch, Validator Agent checks:

```typescript
Task({
  subagent_type: "general-purpose",
  model: "haiku",  // Fast validation
  description: "Validate Wave 1 Batch completion",
  prompt: `Validate that Wave 1 Batch [N] was successful:

1. Run: bun run type-check
   - Must show: "0 errors"
   - If errors: REPORT FAILURE

2. Run: bun run lint 2>&1 | grep -E "(error|warning)" | head -20
   - Check for new violations
   - If new @typescript-eslint errors: REPORT FAILURE

3. Run: bun test --passWithNoTests
   - If failures: REPORT WHICH TESTS FAILED

4. Count violations:
   Before: [expected count from agent]
   After: bun run lint 2>&1 | grep "@typescript-eslint/no-unsafe-return" | wc -l
   Fixed: [calculate delta]

5. Report:
   ✅ BATCH APPROVED - All checks passed
   OR
   ❌ BATCH FAILED - [specific issues]

   If failed: Recommend rollback with:
   git reset --hard HEAD~1`
})
```

---

## Phase 3: Wave 2 Execution (Medium-Risk Violations)

**Duration:** 2 days
**Agents:** 3 parallel worker agents (I, J, K)
**Goal:** Fix 80-120 medium-risk violations
**Batch Size:** 10-15 violations per batch

### Execution Pattern

Same as Wave 1, but:
1. Smaller batches (10-15 instead of 20-25)
2. More complex patterns (array map operations, config property access)
3. May require writing helper functions first
4. Run affected tests per batch

### Step 1: Create Helper Utilities (If Needed)

If patterns analysis identified need for utilities:

```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Create type safety utilities",
  prompt: `Create type safety utility functions based on no-unsafe-return-patterns.md

Create file: src/utils/type-guards/safe-access.ts

Include these functions:
1. getStringProperty(obj: Record<string, unknown>, key: string): string | undefined
2. getNumberProperty(obj: Record<string, unknown>, key: string): number | undefined
3. getStringArrayProperty(obj: Record<string, unknown>, key: string): string[] | undefined
4. getBooleanProperty(obj: Record<string, unknown>, key: string): boolean | undefined

Each function should:
- Access obj[key]
- Validate the type
- Return typed value or undefined

Also create tests: src/utils/type-guards/safe-access.test.ts

Run tests and ensure all pass before committing.

Commit message:
feat(utils): Add type-safe property access utilities

Created safe-access.ts with utilities for type-safe Record property access:
- getStringProperty, getNumberProperty, getStringArrayProperty, getBooleanProperty
- All functions validate types before return
- 100% test coverage

Supports: @typescript-eslint/no-unsafe-return violation fixes`
})
```

### Step 2: Launch Medium-Risk Batches

Similar to Wave 1, but with medium-risk patterns:

```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Fix Wave 2 Batch 1 violations",
  prompt: `Fix Wave 2 Batch 1: Array map operations (10-15 MEDIUM RISK violations)

Your task:
1. Identify 10-15 violations matching pattern: "Array map returning unchecked values"
2. For each violation:
   - Add element type validation
   - Use Array.isArray() check
   - Use .every() to validate all elements
   - Remove unsafe casts

3. Example fix:
   // ❌ Before
   return data.map(item => item.name as string);

   // ✅ After
   if (!Array.isArray(data)) return [];
   return data
     .map(item => typeof item === 'object' && item !== null ? item : null)
     .filter((item): item is { name: unknown } => item !== null && 'name' in item)
     .map(item => typeof item.name === 'string' ? item.name : null)
     .filter((name): name is string => name !== null);

4. Validate with type-check and lint
5. Commit with detailed message
6. Report results`
})
```

---

## Phase 4: Wave 3 Execution (High-Risk Violations)

**Duration:** 2 days
**Agents:** 2 parallel worker agents (L, M)
**Goal:** Fix 40-60 high-risk violations
**Batch Size:** 5-8 violations per batch

### Execution Pattern

1. **Smaller batches:** 5-8 violations
2. **More analysis:** Each agent must explain data flow
3. **Human approval:** Coordinator requires user approval for complex cases
4. **Comprehensive testing:** Full test suite per batch

### Step 1: Launch High-Risk Batch with Proposal-First Approach

```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Propose Wave 3 Batch 1 fixes",
  prompt: `Analyze and PROPOSE fixes for Wave 3 Batch 1: Generic type returns (5-8 HIGH RISK violations)

**DO NOT APPLY FIXES YET - PROPOSE ONLY**

Your task:
1. Identify 5-8 HIGH RISK violations matching pattern: "Generic functions returning value as T"

2. For EACH violation:
   a) Show the current code
   b) Trace the data flow (where does the value come from?)
   c) Identify the risk (why is it unsafe?)
   d) Propose 2-3 alternative fixes with pros/cons

3. Example analysis:

   ### Violation 1: src/server/services/metadata/metadataService.ts:204

   **Current Code:**
   \`\`\`typescript
   private getConfigProperty<T>(config: BaseProviderConfig | undefined, key: string, defaultValue?: T): T | undefined {
       if (!config) return defaultValue;
       const value = (config as unknown as Record<string, unknown>)[key];
       return value !== undefined ? value as T : defaultValue;  // ❌ UNSAFE
   }
   \`\`\`

   **Data Flow:**
   - config is BaseProviderConfig
   - Cast to Record<string, unknown>
   - Access property by key
   - Cast to generic T without validation

   **Risk:**
   - Runtime: value could be any type, not necessarily T
   - If caller expects string but gets number, runtime error
   - No validation that value matches T

   **Proposed Fixes:**

   **Option 1: Add validator parameter** ⭐ RECOMMENDED
   \`\`\`typescript
   private getConfigProperty<T>(
       config: BaseProviderConfig | undefined,
       key: string,
       validator: (value: unknown) => value is T,
       defaultValue?: T
   ): T | undefined {
       if (!config) return defaultValue;
       const value = (config as unknown as Record<string, unknown>)[key];
       if (value === undefined) return defaultValue;
       return validator(value) ? value : defaultValue;
   }
   \`\`\`
   Pros: Type-safe, reusable
   Cons: Requires updating all call sites

   **Option 2: Remove generic, use specific methods**
   \`\`\`typescript
   private getStringConfigProperty(config, key, defaultValue?): string | undefined {
       if (!config) return defaultValue;
       const value = (config as unknown as Record<string, unknown>)[key];
       return typeof value === 'string' ? value : defaultValue;
   }
   // + getNumberConfigProperty, etc.
   \`\`\`
   Pros: Simple, type-safe
   Cons: Code duplication

   **Option 3: Keep cast with comment + defensive checks in callers**
   \`\`\`typescript
   // eslint-disable-next-line @typescript-eslint/no-unsafe-return
   private getConfigProperty<T>(...): T | undefined {
       // UNSAFE: Callers must validate returned value
       return value !== undefined ? value as T : defaultValue;
   }
   \`\`\`
   Pros: Minimal changes
   Cons: Still unsafe, just suppressed

4. Create a proposal document: docs/eslint/wave3-batch1-proposals.md

5. Report back with:
   - List of 5-8 violations analyzed
   - Recommendations for each
   - Which ones need human decision
   - Overall recommended approach

DO NOT APPLY FIXES - Wait for approval.`
})
```

### Step 2: Human Review and Approval

1. Read proposal document
2. For each violation, select approach
3. Approve batch for execution

### Step 3: Execute Approved Fixes

```typescript
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Execute Wave 3 Batch 1 fixes",
  prompt: `Execute approved fixes from Wave 3 Batch 1 proposal.

Approved approaches:
- Violation 1 (metadataService.ts:204): Use Option 1 (validator parameter)
- Violation 2 (...): Use Option X
[etc.]

For each violation:
1. Implement the approved approach
2. Update all call sites if needed
3. Write tests for the fix
4. Validate with type-check and lint

Then:
1. Run full test suite: bun test
2. Commit with detailed message
3. Report results`
})
```

---

## Phase 5: Wave 4 Critical Review (Human-in-Loop)

**Duration:** 1 day
**Agents:** 1 agent + human collaboration
**Goal:** Fix 10-15 critical violations
**Batch Size:** 1-3 violations at a time

### Per-Violation Workflow

```typescript
// For EACH critical violation:
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Analyze critical violation [N]",
  prompt: `Deep analysis of CRITICAL violation [N]:

File: [specific file]
Line: [specific line]
Function: [specific function]

Tasks:
1. Show the complete function with full context
2. Trace the full data flow from source to return
3. Document current behavior with examples
4. Identify all call sites
5. Propose 3 different fix approaches
6. For each approach:
   - Show complete code
   - List pros and cons
   - Estimate breaking change impact
   - Estimate testing effort
   - Your recommendation

7. Create analysis document: docs/eslint/critical-violation-[N]-analysis.md

STOP and wait for human decision before implementing.`
})
```

Then:
1. Human reviews analysis
2. Human selects approach
3. Agent implements with tests
4. Human code reviews
5. Comprehensive validation
6. Commit

---

## Monitoring and Progress Tracking

### Daily Progress Check

Run this to monitor progress:

```bash
# Count remaining violations
echo "Remaining no-unsafe-return violations:"
bun run lint 2>&1 | grep "@typescript-eslint/no-unsafe-return" | wc -l

# View recent commits
git log --oneline --grep="no-unsafe-return" -10

# Check current branch status
git status
```

### Update Progress Document

After each wave, update `docs/eslint/no-unsafe-return-progress.md`:

```markdown
## Wave 1: Complete ✅

**Duration:** 2 days
**Agents:** E, F, G, H
**Batches Completed:** 4
**Violations Fixed:** 125

| Batch | Agent | Pattern | Violations | Status |
|-------|-------|---------|------------|--------|
| 1 | E | Record property access | 25 | ✅ Commit abc123 |
| 2 | F | Array element validation | 30 | ✅ Commit def456 |
| 3 | G | Cast removals | 35 | ✅ Commit ghi789 |
| 4 | H | Mixed low-risk | 35 | ✅ Commit jkl012 |

**Validation:** All TypeScript ✅ All Tests ✅ ESLint ✅

**Remaining Violations:** 195
**Progress:** 39% complete

**Issues Encountered:** None

**Learnings:**
- Pattern X was easier than expected
- Pattern Y required helper utilities
- [etc.]
```

---

## Emergency Procedures

### If Batch Validation Fails

1. **Immediate Rollback:**
   ```bash
   git reset --hard HEAD~1
   ```

2. **Analyze Failure:**
   - Read the validation error messages
   - Identify which fix caused the issue
   - Check if type-check or tests failed

3. **Adjust Approach:**
   - Break batch into smaller pieces (if too large)
   - Change fix pattern (if approach was wrong)
   - Add more tests (if test coverage was insufficient)

4. **Retry with Smaller Scope:**
   - Fix 1-2 violations manually to verify approach
   - Once working, continue with batch

---

### If TypeScript Errors Appear

1. **Don't panic** - This is expected during fixes
2. **Categorize the error:**
   - Type inference issue? → May need explicit type annotations
   - Missing property? → May need optional chaining
   - Type mismatch? → May need to update function signature

3. **Fix systematically:**
   - Start with the first error
   - Fix it properly
   - Re-run type-check
   - Move to next error

4. **If overwhelmed:**
   - Rollback the batch
   - Ask for human help
   - Adjust approach

---

### If Tests Fail

1. **Identify affected tests:**
   ```bash
   bun test 2>&1 | grep "FAIL"
   ```

2. **Understand why:**
   - Does test expect the OLD (unsafe) behavior?
   - Is test mocking broken by type changes?
   - Is test revealing a real bug in the fix?

3. **Fix appropriately:**
   - Update test if it was testing unsafe behavior
   - Update mocks if type signatures changed
   - Fix the code if test revealed a bug

4. **Re-run tests:**
   ```bash
   bun test
   ```

---

## Success Criteria Checklist

### Per-Batch Checklist

Before marking a batch complete:

- [ ] All violations in batch fixed
- [ ] `bun run type-check` passes (0 errors)
- [ ] `bun run lint` shows reduced violation count
- [ ] No new ESLint violations introduced
- [ ] Affected tests passing (or all tests for high-risk)
- [ ] Commit message is detailed and accurate
- [ ] Progress tracking doc updated

### Per-Wave Checklist

Before moving to next wave:

- [ ] All batches in wave complete
- [ ] Full test suite passing: `bun test`
- [ ] TypeScript compilation clean: `bun run type-check`
- [ ] ESLint violations reduced by expected amount
- [ ] No regressions in other ESLint rules
- [ ] Wave summary documented in progress doc
- [ ] Lessons learned captured

### Final Completion Checklist

Before declaring victory:

- [ ] 90%+ of estimated violations fixed (225+ out of 250)
- [ ] All critical violations resolved
- [ ] Zero TypeScript errors
- [ ] Full test suite passing (100%)
- [ ] ESLint passing (no new violations)
- [ ] Manual smoke testing complete
- [ ] Type safety utilities created and tested
- [ ] All helper functions documented
- [ ] Remaining violations documented with justification
- [ ] Progress tracking complete
- [ ] Final summary report written
- [ ] All analysis documents archived in docs/eslint/

---

## Quick Reference Commands

### For Coordinator

```bash
# Assign batch to agent
# Create Task with prompt from templates above

# Check agent progress
git log --oneline -5

# Validate batch completion
bun run type-check && bun run lint | head -20

# Count violations
bun run lint 2>&1 | grep "@typescript-eslint/no-unsafe-return" | wc -l
```

### For Worker Agents

```bash
# Before starting batch
git pull
bun install

# Read analysis docs
cat docs/eslint/no-unsafe-return-tier1-analysis.md
cat docs/eslint/no-unsafe-return-patterns.md

# After applying fixes
bun run type-check
bun run lint | grep "@typescript-eslint/no-unsafe-return" | wc -l
bun test

# Commit
git add .
git commit -m "feat(eslint): Fix no-unsafe-return violations - Wave X Batch Y"
git push
```

### For Validator Agent

```bash
# Full validation suite
bun run type-check
bun run lint 2>&1 | tee lint-output.txt
bun test
grep "@typescript-eslint/no-unsafe-return" lint-output.txt | wc -l
```

---

## Appendix: Full Prompt Templates

### Template: Worker Agent - Low Risk Batch

```
You are Agent [LETTER] fixing @typescript-eslint/no-unsafe-return violations - Wave 1 Batch [N].

**Your batch:** [PATTERN NAME] ([COUNT] violations)

**Files to fix:** (From [ANALYSIS-DOC])
[LIST OF FILES]

Your task:
1. Read docs/eslint/[RELEVANT-ANALYSIS].md
2. Read docs/eslint/no-unsafe-return-patterns.md for fix templates
3. Identify [COUNT] violations matching pattern: "[PATTERN]"

For EACH violation:
1. Read the file and understand the function
2. Verify the issue matches the expected pattern
3. Apply the safe fix:
   [PATTERN-SPECIFIC FIX STEPS]

4. After fixing ALL violations:
   - Run: bun run type-check (must pass)
   - Run: bun run lint 2>&1 | grep "@typescript-eslint/no-unsafe-return" | wc -l
   - Count violations fixed

5. Create a detailed commit:
   feat(eslint): Fix no-unsafe-return violations - Wave [N] Batch [M]

   Fixed [COUNT] [risk-level] violations across [N] files:
   - [Summary of changes]

   Pattern: [PATTERN NAME]
   Risk level: [LEVEL] [EMOJI]
   Validation: TypeScript ✅ ESLint ✅

   Violations fixed:
   - [file:lines]
   - [file:lines]

   Before: [COUNT] violations | After: [COUNT] violations | Fixed: [DELTA]

6. Push your changes

Report back:
- ✅ Success: [details]
- ❌ Failure: [what went wrong]
```

### Template: Worker Agent - Analysis Only (High Risk)

```
Analyze and PROPOSE fixes for Wave [N] Batch [M]: [PATTERN] ([COUNT] violations)

**DO NOT APPLY FIXES YET - PROPOSE ONLY**

Your task:
1. Identify [COUNT] violations matching pattern: "[PATTERN]"

2. For EACH violation:
   a) Show current code with full context
   b) Trace data flow (where does value originate?)
   c) Identify the risk (why unsafe?)
   d) Propose 2-3 alternative fixes with pros/cons
   e) Recommend best approach

3. Analysis format per violation:
   ### Violation [N]: [file:line]

   **Current Code:** [code block]
   **Data Flow:** [explanation]
   **Risk:** [why unsafe]
   **Proposed Fixes:**
   - Option 1: [approach] - Pros/Cons
   - Option 2: [approach] - Pros/Cons
   - Option 3: [approach] - Pros/Cons
   **Recommendation:** [your pick]

4. Save to: docs/eslint/wave[N]-batch[M]-proposals.md

5. Report:
   - Violations analyzed
   - Recommendations
   - Which need human decision
   - Overall approach

DO NOT APPLY FIXES - Wait for approval.
```

---

## Estimated Timeline

**With full parallel execution:**

| Phase | Duration | Agents | Output |
|-------|----------|--------|--------|
| Phase 1: Analysis | 2-3 hours | 4 | 4 analysis docs |
| Phase 2: Wave 1 | 2 days | 4 | 120-155 fixes |
| Phase 3: Wave 2 | 2 days | 3 | 80-120 fixes |
| Phase 4: Wave 3 | 2 days | 2 | 40-60 fixes |
| Phase 5: Wave 4 | 1 day | 1+human | 10-15 fixes |
| **TOTAL** | **7 days** | **4-6** | **250-350 fixes** |

**With conservative execution (1-2 agents at a time):**

Total: 10-12 days

---

*Last Updated: 2025-11-08*
*Status: Ready for Execution*
*Next Step: Launch Phase 1 Analysis*
