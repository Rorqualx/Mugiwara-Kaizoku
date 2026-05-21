#!/bin/bash

# Type checking script for the Mugiwara-Kaizoku project
# Run this frequently to catch type errors early

echo "🔍 Running TypeScript type check..."
echo "================================="

# Run type check
bunx tsc --noEmit

# Check the exit code
if [ $? -eq 0 ]; then
    echo "✅ No type errors found!"
else
    echo "❌ Type errors detected. Please fix them before continuing."
    exit 1
fi

# Optional: Run ESLint type-aware rules
echo ""
echo "🔍 Running ESLint (type-aware rules)..."
echo "================================="
bunx eslint . --ext .ts,.tsx --max-warnings 0 --quiet

if [ $? -eq 0 ]; then
    echo "✅ No ESLint issues found!"
else
    echo "⚠️  ESLint issues detected."
fi

echo ""
echo "Type check complete!"