#!/bin/bash

# Script to clean and organize the root folder
# Author: Documentation Team
# Date: 2025-09-06

echo "Starting root folder organization..."

# Create necessary directories
mkdir -p scripts/fixes
mkdir -p scripts/migration
mkdir -p docs/reports/migration
mkdir -p docs/reports/test-results
mkdir -p logs

# Move Python fix scripts to scripts/fixes
echo "Moving Python fix scripts..."
mv final-syntax-fix.py scripts/fixes/ 2>/dev/null
mv fix-all-syntax-errors.py scripts/fixes/ 2>/dev/null
mv fix-imports.py scripts/fixes/ 2>/dev/null

# Move migration logs and reports to appropriate folders
echo "Moving migration reports and logs..."
mv migration-log.txt logs/ 2>/dev/null
mv migration-output.log logs/ 2>/dev/null
mv migration-results.log logs/ 2>/dev/null
mv typescript-errors-final.log logs/ 2>/dev/null

# Move migration JSON reports to docs
mv migration-report-*.json docs/reports/migration/ 2>/dev/null

# Move test results to docs
echo "Moving test results..."
mv fire-force-e2e-test-results.json docs/reports/test-results/ 2>/dev/null
mv fandomresults_manga_fandom_com.json docs/reports/test-results/ 2>/dev/null

# Move phase completion summary to docs
mv phase1-completion-summary.txt docs/migration/phase-reports/ 2>/dev/null

# List of files that should remain in root (config files)
# - .eslintrc.json
# - .release-please-manifest.json
# - claude.config.yml
# - docker-compose.yml
# - jest.config.mjs
# - next-env.d.ts
# - next.config.mjs
# - package.json
# - pnpm-lock.yaml
# - pnpm-workspace.yaml
# - postcss.config.mjs
# - release-please-config.json
# - server-wrapper.js
# - tailwind.config.mjs
# - tsconfig.json
# - tsconfig.tsbuildinfo

echo ""
echo "Root folder organization complete!"
echo ""
echo "Summary of changes:"
echo "- Python fix scripts moved to: scripts/fixes/"
echo "- Migration logs moved to: logs/"
echo "- Migration reports moved to: docs/reports/migration/"
echo "- Test results moved to: docs/reports/test-results/"
echo "- Phase reports moved to: docs/migration/phase-reports/"
echo ""
echo "Files remaining in root (all config files):"
ls -1 *.json *.yml *.mjs *.js *.ts 2>/dev/null | grep -v node_modules | sort