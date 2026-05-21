#!/bin/bash

# Find return-await violations
echo "=== RETURN-AWAIT VIOLATIONS ==="
echo "Searching for return statements in try/catch/finally blocks without await..."

bunx eslint src/ --format=json --no-color 2>/dev/null | \
  jq -r '.[] |
    select(.messages != null) |
    .messages[] |
    select(.ruleId == "@typescript-eslint/return-await") |
    "\(.filePath):\(.line):\(.column) - \(.message)"' | \
  head -50

echo ""
echo "=== NO-THROW-LITERAL VIOLATIONS ==="
echo "Searching for throw statements with non-Error objects..."

bunx eslint src/ --format=json --no-color 2>/dev/null | \
  jq -r '.[] |
    select(.messages != null) |
    .messages[] |
    select(.ruleId == "@typescript-eslint/no-throw-literal") |
    "\(.filePath):\(.line):\(.column) - \(.message)"' | \
  head -50
