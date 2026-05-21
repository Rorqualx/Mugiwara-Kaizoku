# ESLint no-unsafe-assignment Comprehensive Remediation Plan

*Status: Phase 1 - Analysis In Progress*
*Created: 2025-11-08*
*Branch: `claude/scan-eslint-unsafe-assignment-011CUv1Dqtq5e4vn5RZS55MX`*
*Total Violations: 6,028*

---

## Executive Summary

This document outlines the comprehensive plan to eliminate all 6,028 `@typescript-eslint/no-unsafe-assignment` violations from the Mugiwara-Kaizoku codebase through a coordinated agentic workflow.

**Current Status**: 6,028 violations (up from 3,203 in October 2025)
**Risk Level**: 🔴 High - Type safety compromise across codebase
**Estimated Effort**: 40-52 hours across 6 waves
**Approach**: Parallel analysis → Sequential execution with validation gates

---

## Violation Breakdown

### By Pattern Type

| Pattern | Count | % | Risk | Fix Complexity |
|---------|-------|---|------|----------------|
| JSON operations (parse/response.json) | ~2,100 | 35% | 🔴 High | Medium |
| Explicit `any` declarations | ~1,500 | 25% | 🔴 High | Low-Medium |
| Type assertions (`as any`) | ~900 | 15% | 🟡 Medium | Low |
| Dynamic property access (`obj[key]`) | ~600 | 10% | 🟡 Medium | Medium-High |
| Function params/returns | ~480 | 8% | 🟡 Medium | Medium |
| Double casts (`as unknown as`) | ~480 | 8% | 🟢 Low | Low |
| Array operations | ~360 | 6% | 🟡 Medium | Medium |
| Spread/Object assignments | ~300 | 5% | 🟢 Low | Low |
| Type properties with `any` | ~240 | 4% | 🟡 Medium | Medium |
| Third-party integration | ~68 | 1% | 🟢 Low | High |
| **TOTAL** | **6,028** | **100%** | | |

### By Risk Level

- **High Risk** (35%): 2,100 violations - JSON operations without validation
- **Medium Risk** (53%): 3,200 violations - Type assertions and dynamic access
- **Low Risk** (12%): 728 violations - Safe refactorings

---

## Wave Structure

### Wave 1: Quick Wins (Low Risk)
**Target**: 1,020 violations | **Est. Time**: 4-6 hours | **Risk**: 🟢 Low

**Batches**:
- 1.1: Double casts (480) - Replace `as unknown as` with type guards
- 1.2: Spread/Object assignments (300) - Add proper typing
- 1.3: Type properties (240) - Replace `any` with `unknown` or proper types

**Success Criteria**:
- Zero type errors introduced
- All tests passing
- -1,020 violations

---

### Wave 2: Type Assertions
**Target**: 1,380 violations | **Est. Time**: 6-8 hours | **Risk**: 🟡 Medium

**Batches**:
- 2.1: Simple `as any` casts (900) - Replace with proper type assertions
- 2.2: Explicit `any` declarations (480) - Use `unknown` or specific types

**Success Criteria**:
- No new `any` types introduced
- Type safety improved
- -1,380 violations

---

### Wave 3: JSON Operations
**Target**: 2,100 violations | **Est. Time**: 10-12 hours | **Risk**: 🔴 High

**Batches**:
- 3.1: JSON.parse() (630) - Add Zod validation
- 3.2: response.json() (1,470) - Add schema validation

**Prerequisites**:
- Create Zod schemas for all data shapes
- Document expected API response formats
- Add validation error handling

**Success Criteria**:
- All JSON parsing validated
- Runtime safety improved
- -2,100 violations

---

### Wave 4: Function Typing
**Target**: 840 violations | **Est. Time**: 8-10 hours | **Risk**: 🟡 Medium

**Batches**:
- 4.1: Function parameters (480) - Add explicit types
- 4.2: Function returns (360) - Add return type annotations

**Success Criteria**:
- All functions properly typed
- IntelliSense improved
- -840 violations

---

### Wave 5: Dynamic Access
**Target**: 600 violations | **Est. Time**: 8-10 hours | **Risk**: 🔴 High

**Batches**:
- 5.1: Object bracket notation (600) - Add type guards or key constraints

**Success Criteria**:
- Safe dynamic access
- No runtime errors
- -600 violations

---

### Wave 6: Complex Cases
**Target**: 88 violations | **Est. Time**: 4-6 hours | **Risk**: 🟢 Low

**Batches**:
- 6.1: Third-party integration (68) - Add type definitions or wrappers
- 6.2: Edge cases (20) - Manual review and resolution

**Success Criteria**:
- All edge cases documented
- Intentional `any` usage clearly marked
- -88 violations

---

## Agent Team Structure

```
┌─────────────────────────────────────────────────────────┐
│                  COORDINATOR AGENT                       │
│  • Orchestrates all sub-agents                          │
│  • Makes final approval decisions                       │
│  • Manages batch sequencing                             │
│  • Validates after each wave                            │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼───────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  ANALYZER-A   │  │ ANALYZER-B  │  │  ANALYZER-C     │
│               │  │             │  │                 │
│ • Wave 1-2    │  │ • Wave 3-4  │  │ • Wave 5-6      │
│ • Low risk    │  │ • Medium    │  │ • High risk     │
│ • Quick fixes │  │ • JSON ops  │  │ • Complex logic │
└───────┬───────┘  └──────┬──────┘  └────────┬────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                  ┌────────▼────────┐
                  │   VALIDATOR     │
                  │                 │
                  │ • Type-check    │
                  │ • ESLint        │
                  │ • Tests         │
                  │ • Rollback      │
                  └─────────────────┘
```

---

## Phase 1: Parallel Analysis (CURRENT)

### Analyzer-A: Waves 1-2 (Low/Medium Risk)
**Scope**: 2,400 violations

**Tasks**:
1. Scan for all double cast patterns (`as unknown as`)
2. Identify all `as any` type assertions
3. Find explicit `any` declarations
4. Locate spread/Object.assign patterns
5. Generate type guard functions for each case
6. Propose replacements with proper types

**Output**: `wave1-2-analysis.json`

---

### Analyzer-B: Waves 3-4 (JSON & Functions)
**Scope**: 2,940 violations

**Tasks**:
1. Find all JSON.parse() calls
2. Find all response.json() calls
3. Identify expected data shapes from usage
4. Create Zod schemas for each data shape
5. Find untyped function parameters
6. Find missing return type annotations
7. Propose typed replacements

**Output**: `wave3-4-analysis.json` + `schemas/` directory

---

### Analyzer-C: Waves 5-6 (Dynamic Access)
**Scope**: 688 violations

**Tasks**:
1. Find all bracket notation access (`obj[key]`)
2. Determine if keys are compile-time known
3. Identify safe vs. risky dynamic access
4. Categorize third-party integration issues
5. Propose type narrowing strategies
6. Flag cases needing manual review

**Output**: `wave5-6-analysis.json`

---

## Validation Gates

Every batch must pass:

### TypeScript Validation
```bash
npx tsc --noEmit
# Must: Zero new errors
# Must: Existing errors not increased
```

### ESLint Validation
```bash
npx eslint . --max-warnings=999999
# Must: no-unsafe-assignment count decreased
# Must: No new critical violations
```

### Test Validation
```bash
bun test
# Must: All existing passing tests still pass
# Must: No new test failures
```

### Manual Smoke Test (for UI changes)
- Start dev server
- Navigate to affected pages
- Verify no runtime errors
- Verify functionality unchanged

---

## Rollback Strategy

**Trigger Conditions**:
- ❌ TypeScript errors increase
- ❌ Test failures increase
- ❌ Runtime errors detected
- ❌ Build fails

**Rollback Process**:
```bash
git reset --hard HEAD~1  # Undo last batch commit
# Review failure logs
# Adjust approach
# Retry with smaller batch or different strategy
```

---

## Safety Mechanisms

1. **Small Batches**: 20-60 files per batch depending on risk level
2. **Separate Commits**: Each batch is its own atomic commit
3. **Validation Required**: No batch advances without passing gates
4. **Human Escalation**: Agents escalate uncertain cases
5. **Progressive Rollout**: Wave 1 must succeed before Wave 2 starts
6. **Documentation**: All decisions logged in tracking files

---

## Success Metrics

| Metric | Baseline | Target | Current |
|--------|----------|--------|---------|
| Total violations | 6,028 | 0 | 6,028 |
| High-risk violations | 2,700 | 0 | 2,700 |
| Medium-risk violations | 2,600 | <100 | 2,600 |
| Low-risk violations | 728 | 0 | 728 |
| Type coverage | ~85% | 100% | ~85% |
| Test pass rate | TBD | 100% | TBD |

---

## Timeline Estimate

| Phase | Duration | Completion |
|-------|----------|------------|
| Phase 1: Analysis | 2-3 hours | 0% |
| Wave 1: Quick Wins | 4-6 hours | 0% |
| Wave 2: Type Assertions | 6-8 hours | 0% |
| Wave 3: JSON Operations | 10-12 hours | 0% |
| Wave 4: Function Typing | 8-10 hours | 0% |
| Wave 5: Dynamic Access | 8-10 hours | 0% |
| Wave 6: Complex Cases | 4-6 hours | 0% |
| **TOTAL** | **42-55 hours** | **0%** |

---

## Current Status

**Phase**: Analysis
**Started**: 2025-11-08
**Completion**: 0%

**Active Tasks**:
- [ ] Analyzer-A launched (Waves 1-2)
- [ ] Analyzer-B launched (Waves 3-4)
- [ ] Analyzer-C launched (Waves 5-6)
- [ ] Analysis reports received
- [ ] Execution plan refined

**Next**: Launch parallel analysis agents

---

## References

- [ESLint Rules Reference](./eslint-rules-reference.md)
- [Agentic Workflow Guide](./agentic-workflow-guide.md)
- [Violations Categorized](./violations-categorized.md)
- [CLAUDE.md](../../CLAUDE.md) - Project conventions

---

*Last Updated: 2025-11-08*
*Next Update: After Phase 1 analysis completion*
