#!/bin/bash

echo "Finding return-await and no-throw-literal violations..."
echo "======================================================="
echo ""

# Run ESLint and capture JSON output
echo "Running ESLint (this may take a few minutes)..."
ESLINT_OUTPUT=$(bunx eslint src/ --format=json --max-warnings=999999 2>/dev/null)

# Count violations
RETURN_AWAIT_COUNT=$(echo "$ESLINT_OUTPUT" | jq '[.[] | .messages[] | select(.ruleId == "@typescript-eslint/return-await")] | length')
NO_THROW_LITERAL_COUNT=$(echo "$ESLINT_OUTPUT" | jq '[.[] | .messages[] | select(.ruleId == "@typescript-eslint/no-throw-literal")] | length')

echo ""
echo "=== VIOLATION COUNTS ==="
echo "return-await: $RETURN_AWAIT_COUNT"
echo "no-throw-literal: $NO_THROW_LITERAL_COUNT"
echo "Total: $((RETURN_AWAIT_COUNT + NO_THROW_LITERAL_COUNT))"
echo ""

# Show sample return-await violations
echo "=== SAMPLE RETURN-AWAIT VIOLATIONS (first 10) ==="
echo "$ESLINT_OUTPUT" | jq -r '.[] | .filePath as $file | .messages[] | select(.ruleId == "@typescript-eslint/return-await") | "\($file):\(.line):\(.column) - \(.message)"' | head -10
echo ""

# Show sample no-throw-literal violations
echo "=== SAMPLE NO-THROW-LITERAL VIOLATIONS (first 10) ==="
echo "$ESLINT_OUTPUT" | jq -r '.[] | .filePath as $file | .messages[] | select(.ruleId == "@typescript-eslint/no-throw-literal") | "\($file):\(.line):\(.column) - \(.message)"' | head -10
echo ""

# Export full data to files
echo "$ESLINT_OUTPUT" | jq -r '.[] | .filePath as $file | .messages[] | select(.ruleId == "@typescript-eslint/return-await") | "\($file):\(.line):\(.column) - \(.message)"' > /tmp/return-await-violations.txt
echo "$ESLINT_OUTPUT" | jq -r '.[] | .filePath as $file | .messages[] | select(.ruleId == "@typescript-eslint/no-throw-literal") | "\($file):\(.line):\(.column) - \(.message)"' > /tmp/no-throw-literal-violations.txt

echo "Full violation lists saved to:"
echo "  /tmp/return-await-violations.txt"
echo "  /tmp/no-throw-literal-violations.txt"
