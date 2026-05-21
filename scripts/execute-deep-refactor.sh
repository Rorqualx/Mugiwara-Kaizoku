#!/bin/bash
# Master Script for Deep Type Refactoring

echo "=============================================="
echo "DEEP TYPE SYSTEM REFACTORING"
echo "=============================================="
echo ""
echo "This will execute a comprehensive type system refactoring."
echo "A backup has been created at: $(cat .last-deep-backup 2>/dev/null || echo 'unknown')"
echo ""
echo "Phases to execute:"
echo "  1. Create type registry and domain redirect"
echo "  2. Fix import paths throughout codebase"
echo "  3. Clean up duplicates and archives"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Function to check if we should continue
check_continue() {
    local phase=$1
    local errors=$2
    local threshold=$3
    
    if [ "$errors" -gt "$threshold" ]; then
        echo ""
        echo "⚠️ ERROR THRESHOLD EXCEEDED!"
        echo "Phase $phase resulted in $errors errors (threshold: $threshold)"
        echo ""
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Refactoring stopped at phase $phase"
            echo "To rollback: $(cat .last-deep-backup)/restore.sh"
            exit 1
        fi
    fi
}

# Initial state
echo ""
echo "Checking initial state..."
INITIAL_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo "Starting with $INITIAL_ERRORS errors"
echo ""

# Phase 1
echo "▶️ Executing Phase 1: Type Registry"
echo "===================================="
./scripts/refactor-phase1-registry.sh
PHASE1_ERRORS=$(cat .phase1-error-count)
check_continue 1 "$PHASE1_ERRORS" 2000

sleep 2

# Phase 2
echo ""
echo "▶️ Executing Phase 2: Import Fixes"
echo "===================================="
./scripts/refactor-phase2-imports.sh
PHASE2_ERRORS=$(cat .phase2-error-count)
check_continue 2 "$PHASE2_ERRORS" 2000

sleep 2

# Phase 3
echo ""
echo "▶️ Executing Phase 3: Cleanup"
echo "==============================="
./scripts/refactor-phase3-cleanup.sh
PHASE3_ERRORS=$(cat .phase3-error-count)

# Final summary
echo ""
echo "=============================================="
echo "REFACTORING COMPLETE"
echo "=============================================="
echo ""
echo "Results Summary:"
echo "  Initial errors: $INITIAL_ERRORS"
echo "  Phase 1 errors: $PHASE1_ERRORS"
echo "  Phase 2 errors: $PHASE2_ERRORS"
echo "  Final errors:   $PHASE3_ERRORS"
echo ""

IMPROVEMENT=$((INITIAL_ERRORS - PHASE3_ERRORS))
if [ "$IMPROVEMENT" -gt 0 ]; then
    echo "✅ Successfully reduced errors by $IMPROVEMENT"
else
    echo "⚠️ Errors increased by $((-IMPROVEMENT))"
    echo "   Consider rolling back: $(cat .last-deep-backup)/restore.sh"
fi

echo ""
echo "To rollback all changes:"
echo "  $(cat .last-deep-backup)/restore.sh"