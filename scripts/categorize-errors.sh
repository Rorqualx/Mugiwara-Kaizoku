#!/bin/bash
# Error Categorization Script
# Week 2-3 - Type Safety Blitz
#
# Groups errors by file and generates priority list

echo "📋 Categorizing TypeScript Errors by File"
echo "=========================================="
echo ""

# Run type check and capture output
echo "Running type check..."
bun run type-check 2>&1 > type-check-full.txt

# Extract errors and count by file
echo ""
echo "Analyzing errors..."
grep "error TS" type-check-full.txt | \
  awk -F: '{print $1}' | \
  sort | \
  uniq -c | \
  sort -rn > errors-by-file.txt

# Display top 50 files
echo ""
echo "Top 50 Files with Most Errors:"
echo "==============================="
head -50 errors-by-file.txt | while read count file; do
  printf "%4d  %s\n" "$count" "$file"
done

echo ""
echo "Full report saved to: errors-by-file.txt"
echo ""

# Categorize by team
echo "Team Assignments (Top Priority Files):"
echo "======================================="
echo ""

echo "Team A (Backend) - Priority Files:"
grep "src/server" errors-by-file.txt | head -20
echo ""

echo "Team B (Frontend) - Priority Files:"
grep -E "src/components|src/pages" errors-by-file.txt | head -20
echo ""

echo "Team C (Infrastructure) - Priority Files:"
grep -E "src/utils|src/hooks|src/types" errors-by-file.txt | head -20
echo ""

# Summary stats
TOTAL_FILES=$(wc -l < errors-by-file.txt)
TOTAL_ERRORS=$(awk '{sum+=$1} END {print sum}' errors-by-file.txt)

echo "Summary:"
echo "--------"
echo "Total files with errors: $TOTAL_FILES"
echo "Total errors: $TOTAL_ERRORS"
echo ""

# Generate team-specific error lists
echo "Generating team-specific priority lists..."
grep "src/server" errors-by-file.txt > errors-team-a.txt
grep -E "src/components|src/pages" errors-by-file.txt > errors-team-b.txt
grep -E "src/utils|src/hooks|src/types" errors-by-file.txt > errors-team-c.txt

echo "✅ Team priority lists created:"
echo "   - errors-team-a.txt (Backend)"
echo "   - errors-team-b.txt (Frontend)"
echo "   - errors-team-c.txt (Infrastructure)"
