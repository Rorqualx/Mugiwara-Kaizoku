# ESLint Acceleration - Local Execution Guide

## Quick Start (Run on Your Local Machine)

### Prerequisites
```bash
cd ~/Documents/Cline/code/Mugiwara-Kaizoku
git checkout claude/setup-eslint-scan-011CUyaSHqyEDLgfCmSK4uxo
git pull
```

---

## Phase 2A: Fix Unused Variables (~459 violations)

**Estimated Time:** 10-20 minutes  
**Risk Level:** LOW

### Step 1: Preview Changes (Dry Run)
```bash
cd tools/eslint-automation
python3 ./2a-fix-unused-vars.py
```

This will show you:
- How many violations found
- Which files will be modified
- Preview of changes (e.g., `unused` → `_unused`)

### Step 2: Apply Fixes
```bash
python3 ./2a-fix-unused-vars.py --execute
```

### Step 3: Validate
```bash
cd ../..
npm run type-check
```

If errors occur, review the changes:
```bash
git diff
```

### Step 4: Commit & Push
```bash
git add -A
git commit -m "fix(eslint): Prefix unused variables with underscore (Phase 2A)"
git push
```

---

## Phase 2B: Add Return Types (~200-300 violations)

**Estimated Time:** 20-30 minutes  
**Risk Level:** LOW-MEDIUM (requires manual review)

### Step 1: Preview
```bash
cd tools/eslint-automation
python3 ./2b-add-return-types.py
```

### Step 2: Apply
```bash
python3 ./2b-add-return-types.py --execute
```

### Step 3: Validate & Review
```bash
cd ../..
npm run type-check
git diff
```

⚠️ **Important:** Review inferred types carefully!
- React components should be `React.ReactElement`
- Event handlers should be `void` or `Promise<void>`
- Some types may be too broad (e.g., `Promise<void>` for async functions)

### Step 4: Commit
```bash
git add -A
git commit -m "fix(eslint): Add inferred return types to functions (Phase 2B)"
git push
```

---

## Track Your Progress

At any time, run:
```bash
cd tools/eslint-automation
./track-progress.sh
```

This shows:
- Current violation count
- Total violations fixed
- Percentage reduction
- Recent history

---

## Run All Phases at Once (Advanced)

**⚠️ Only recommended after testing each phase individually**

```bash
cd tools/eslint-automation

# Dry run first
./run-all-phases.sh

# Execute all
./run-all-phases.sh --execute
```

This will:
1. Run Phase 2A (unused vars)
2. Run Phase 2B (return types)
3. Validate TypeScript after each phase
4. Auto-commit each phase separately
5. Auto-rollback if validation fails

---

## Expected Results

| Phase | Violations Fixed | Time | Cumulative Total |
|-------|-----------------|------|------------------|
| **Baseline** | - | - | **10,400** |
| Phase 2A | ~459 | 15 min | **9,941** |
| Phase 2B | ~250 | 25 min | **9,691** |
| **Total Reduction** | **~709** | **40 min** | **6.8% reduction** |

---

## Troubleshooting

### Script Errors
```bash
# Check Python version (need 3.7+)
python3 --version

# Check if npm/npx work
npx eslint --version
```

### TypeScript Errors After Fix
```bash
# Review changes
git diff

# Revert if needed
git reset --hard HEAD
```

### ESLint Scan Too Slow
The first scan takes 5-10 minutes on large codebases. Subsequent scans are cached and faster.

---

## Next Steps After Phase 2

Once Phase 2A and 2B are complete, you'll have ~9,700 violations remaining.

**Manual Work Recommended (See /tmp/eslint-acceleration-plan.md):**
1. Fix `no-unsafe-*` violations (~2,500) - Type safety
2. Fix `no-unnecessary-condition` (~2,600) - Dead code removal
3. Address remaining return types manually (~600)
4. Consider suppressing complexity metrics for legacy code

**Or use Claude to help:**
- Launch Task agents for specific file types
- Use parallel agents for type safety work
- Continue with automation scripts for other rules

---

## Support

All automation scripts include:
- `--help` flag for usage
- Dry-run mode by default
- TypeScript validation
- Automatic rollback on errors

Refer to `/tmp/eslint-acceleration-plan.md` for the complete strategy.

---

**Good luck! You're on track to eliminate 1,000+ violations this week! 🚀**
