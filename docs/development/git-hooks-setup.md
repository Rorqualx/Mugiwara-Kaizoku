# Git Hooks Setup

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Git Hooks Setup

---
# Git Hooks Setup for Type Safety

This guide explains how to set up Git hooks to enforce type safety in the Mugiwara-Kaizoku project.

## Pre-commit Hook for Type Safety

The pre-commit hook runs our type safety check script before allowing commits.

### Installation Steps

1. Create a `.git/hooks/pre-commit` file:

```bash
#!/bin/bash

# Type safety pre-commit hook
echo "Running type safety checks..."

# Run the type safety check script
node scripts/type-safety-check.js

# Check the exit code
if [ $? -ne 0 ]; then
  echo "❌ Type safety check failed. Please fix the issues before committing."
  echo "   Run 'node scripts/type-safety-check.js --fix' to attempt automatic fixes."
  exit 1
fi

echo "✅ Type safety check passed."
exit 0
```

2. Make the hook executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Using Husky (Alternative)

For teams, it's easier to use Husky to manage Git hooks.

1. Install Husky:

```bash
npm install husky --save-dev
```

2. Set up Husky:

```bash
npx husky install
```

3. Add the pre-commit hook:

```bash
npx husky add .husky/pre-commit "node scripts/type-safety-check.js"
```

## Configuring the Type Safety Check

The type safety check script supports these options:

- `--fix`: Attempts to automatically fix simple issues
- `--strict`: Enables stricter checks

Example with options:

```bash
node scripts/type-safety-check.js --fix --strict
```

## Skipping the Hook (Emergency Only)

If you need to bypass the hook in an emergency:

```bash
git commit --no-verify -m "Emergency fix"
```

**Note**: This should be used only in exceptional circumstances.

## CI Integration

The same type safety check should also run in your CI pipeline:

```yaml
# .github/workflows/type-safety.yml
name: Type Safety Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  type-safety:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm ci
      - name: Run type safety check
        run: node scripts/type-safety-check.js --strict
```