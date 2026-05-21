#!/bin/bash
# Track ESLint violation progress over time

PROGRESS_FILE="/tmp/eslint-progress.log"

# Get current violation count
CURRENT=$(npm run lint 2>&1 | grep -oP '\d+(?= problems)' | head -1 || echo "0")
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%S)

# Append to log
echo "$DATE $TIME $CURRENT" >> "$PROGRESS_FILE"

# Display progress
echo "📊 ESLint Violation Progress"
echo "============================="
echo ""

if [ -f "$PROGRESS_FILE" ]; then
    # Get first entry
    FIRST=$(head -1 "$PROGRESS_FILE" | awk '{print $3}')
    FIRST_DATE=$(head -1 "$PROGRESS_FILE" | awk '{print $1}')
    
    # Calculate reduction
    FIXED=$((FIRST - CURRENT))
    PERCENT=$(awk "BEGIN {printf \"%.1f\", ($FIXED / $FIRST) * 100}")
    
    echo "Starting point ($FIRST_DATE): $FIRST violations"
    echo "Current ($DATE): $CURRENT violations"
    echo ""
    echo "✅ Fixed: $FIXED violations"
    echo "📉 Reduction: $PERCENT%"
    echo ""
    
    # Show recent history (last 10 entries)
    echo "Recent history:"
    tail -10 "$PROGRESS_FILE" | while read date time count; do
        prev_count=${prev:-$count}
        diff=$((prev_count - count))
        if [ $diff -gt 0 ]; then
            echo "  $date $time: $count (-$diff)"
        else
            echo "  $date $time: $count"
        fi
        prev=$count
    done
else
    echo "First run: $CURRENT violations"
fi

echo ""
echo "Breakdown by rule:"
npm run lint 2>&1 | grep -oP '@typescript-eslint/[a-z-]+|^[a-z-]+' | sort | uniq -c | sort -rn | head -15

