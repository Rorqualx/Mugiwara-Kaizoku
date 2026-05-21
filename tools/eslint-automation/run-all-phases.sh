#!/bin/bash
# Master script to run all ESLint fix phases
# Run with: ./run-all-phases.sh [--execute]

set -e

DRY_RUN=true
if [ "$1" == "--execute" ]; then
    DRY_RUN=false
fi

if $DRY_RUN; then
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo "   Run with --execute to apply all fixes"
    echo ""
fi

echo "════════════════════════════════════════════════════════════"
echo "  ESLint Violation Fix - Automated Remediation"
echo "════════════════════════════════════════════════════════════"
echo ""

# Track initial state
./track-progress.sh
echo ""

if ! $DRY_RUN; then
    read -p "Continue with automated fixes? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "Phase 1: Auto-fix import/order (2 minutes)"
echo "────────────────────────────────────────────────────────────"
echo ""

if $DRY_RUN; then
    echo "  Would run: ./1-fix-import-order.sh"
    echo "  Expected: ~207 violations fixed"
else
    ./1-fix-import-order.sh
    
    # Commit phase 1
    git add -A
    git commit -m "fix(eslint): Auto-fix import/order violations (Phase 1)"
    
    echo "✅ Phase 1 complete and committed"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "Phase 2A: Fix unused variables (10-20 minutes)"
echo "────────────────────────────────────────────────────────────"
echo ""

if $DRY_RUN; then
    ./2a-fix-unused-vars.py
else
    ./2a-fix-unused-vars.py --execute
    
    # Validate
    echo "Validating TypeScript..."
    npm run type-check || {
        echo "❌ Type check failed! Rolling back..."
        git reset --hard HEAD
        exit 1
    }
    
    # Commit phase 2A
    git add -A
    git commit -m "fix(eslint): Prefix unused variables with underscore (Phase 2A)"
    
    echo "✅ Phase 2A complete and committed"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "Phase 2B: Add return types (20-30 minutes)"
echo "────────────────────────────────────────────────────────────"
echo ""

if $DRY_RUN; then
    ./2b-add-return-types.py
else
    ./2b-add-return-types.py --execute
    
    # Validate
    echo "Validating TypeScript..."
    npm run type-check || {
        echo "❌ Type check failed! Rolling back..."
        git reset --hard HEAD~1
        exit 1
    }
    
    # Commit phase 2B
    git add -A
    git commit -m "fix(eslint): Add inferred return types (Phase 2B)"
    
    echo "✅ Phase 2B complete and committed"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Summary"
echo "════════════════════════════════════════════════════════════"
echo ""

./track-progress.sh

if $DRY_RUN; then
    echo ""
    echo "This was a DRY RUN - no changes were made"
    echo "To execute all phases, run: ./run-all-phases.sh --execute"
else
    echo ""
    echo "✅ All automated phases complete!"
    echo ""
    echo "Next steps:"
    echo "1. Run tests: npm test"
    echo "2. Push changes: git push"
    echo "3. Proceed with manual Phase 3 (see /tmp/eslint-acceleration-plan.md)"
fi

