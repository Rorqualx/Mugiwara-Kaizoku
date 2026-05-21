#!/bin/bash
# Progress Tracking Dashboard
# Week 2-3 - Type Safety Blitz
#
# Real-time error count by team area

echo "📊 Type Safety Progress Dashboard"
echo "=================================="
echo ""
echo "Scanning codebase for TypeScript errors..."
echo ""

# Create temp file for type check output
TEMP_FILE=$(mktemp)

# Run type check (suppress output, save to temp)
bun run type-check 2>&1 > "$TEMP_FILE"

# Count total errors
TOTAL_ERRORS=$(grep -c "error TS" "$TEMP_FILE" 2>/dev/null || echo "0")

# Count errors by team area
echo "Team Breakdown:"
echo "---------------"

# Team A: Backend (routers + services)
ROUTER_ERRORS=$(grep "src/server/trpc/routers" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
SERVICE_ERRORS=$(grep "src/server/services" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
TEAM_A_TOTAL=$((ROUTER_ERRORS + SERVICE_ERRORS))

echo "Team A (Backend):  $TEAM_A_TOTAL errors"
echo "  - Routers:  $ROUTER_ERRORS"
echo "  - Services: $SERVICE_ERRORS"
echo ""

# Team B: Frontend (components + pages)
COMPONENT_ERRORS=$(grep "src/components" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
PAGE_ERRORS=$(grep "src/pages" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
TEAM_B_TOTAL=$((COMPONENT_ERRORS + PAGE_ERRORS))

echo "Team B (Frontend): $TEAM_B_TOTAL errors"
echo "  - Components: $COMPONENT_ERRORS"
echo "  - Pages:      $PAGE_ERRORS"
echo ""

# Team C: Infrastructure (utils + hooks + types)
UTILS_ERRORS=$(grep "src/utils" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
HOOKS_ERRORS=$(grep "src/hooks" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
TYPES_ERRORS=$(grep "src/types" "$TEMP_FILE" | grep -c "error TS" 2>/dev/null || echo "0")
TEAM_C_TOTAL=$((UTILS_ERRORS + HOOKS_ERRORS + TYPES_ERRORS))

echo "Team C (Infrastructure): $TEAM_C_TOTAL errors"
echo "  - Utils:  $UTILS_ERRORS"
echo "  - Hooks:  $HOOKS_ERRORS"
echo "  - Types:  $TYPES_ERRORS"
echo ""

# Other errors (not assigned to teams)
OTHER_ERRORS=$((TOTAL_ERRORS - TEAM_A_TOTAL - TEAM_B_TOTAL - TEAM_C_TOTAL))

echo "Other:             $OTHER_ERRORS errors"
echo ""
echo "=================================="
echo "TOTAL: $TOTAL_ERRORS errors"
echo ""

# Calculate progress if baseline exists
if [ -f "baseline-type-errors-week1.txt" ]; then
  BASELINE=$(grep -c "error TS" baseline-type-errors-week1.txt 2>/dev/null || echo "4354")
  if [ "$BASELINE" -gt 0 ]; then
    FIXED=$((BASELINE - TOTAL_ERRORS))
    PROGRESS=$(( (FIXED * 100) / BASELINE ))
    echo "Progress: $PROGRESS% complete ($FIXED/$BASELINE errors fixed)"
  fi
fi

echo ""
echo "Target: 0 errors by end of Week 3"
echo ""

# Cleanup
rm "$TEMP_FILE"

# Save summary to file
echo "$(date): $TOTAL_ERRORS total errors (A:$TEAM_A_TOTAL B:$TEAM_B_TOTAL C:$TEAM_C_TOTAL)" >> progress-log.txt
