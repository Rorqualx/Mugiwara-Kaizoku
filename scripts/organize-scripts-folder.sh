#!/bin/bash

# Script to organize the scripts folder into categories
# Author: Documentation Team
# Date: 2025-09-06

echo "Organizing scripts folder..."

# Create subdirectories for better organization
mkdir -p scripts/analysis
mkdir -p scripts/database
mkdir -p scripts/migration
mkdir -p scripts/fixes
mkdir -p scripts/testing
mkdir -p scripts/build
mkdir -p scripts/utilities
mkdir -p scripts/type-fixes

# Move analysis scripts
echo "Moving analysis scripts..."
mv scripts/analyze-*.ts scripts/analysis/ 2>/dev/null
mv scripts/analyze-*.js scripts/analysis/ 2>/dev/null
mv scripts/analyze-*.mjs scripts/analysis/ 2>/dev/null
mv scripts/add-*-pattern.ts scripts/analysis/ 2>/dev/null

# Move database scripts
echo "Moving database scripts..."
mv scripts/*-database*.sh scripts/database/ 2>/dev/null
mv scripts/*-db*.sh scripts/database/ 2>/dev/null
mv scripts/reset-*.sh scripts/database/ 2>/dev/null
mv scripts/seed-*.js scripts/database/ 2>/dev/null
mv scripts/create-admin*.js scripts/utilities/ 2>/dev/null

# Move migration scripts
echo "Moving migration scripts..."
mv scripts/migrate-*.ts scripts/migration/ 2>/dev/null
mv scripts/migrate-*.js scripts/migration/ 2>/dev/null
mv scripts/*-migration*.ts scripts/migration/ 2>/dev/null
mv scripts/*-migration*.js scripts/migration/ 2>/dev/null

# Move fix scripts
echo "Moving fix scripts..."
mv scripts/fix-*.ts scripts/fixes/ 2>/dev/null
mv scripts/fix-*.js scripts/fixes/ 2>/dev/null
mv scripts/fix-*.sh scripts/fixes/ 2>/dev/null
mv scripts/add-missing-*.ts scripts/fixes/ 2>/dev/null

# Move test scripts
echo "Moving test scripts..."
mv scripts/test-*.js scripts/testing/ 2>/dev/null
mv scripts/test-*.ts scripts/testing/ 2>/dev/null
mv scripts/test-*.mjs scripts/testing/ 2>/dev/null

# Move build scripts
echo "Moving build scripts..."
mv scripts/build-*.sh scripts/build/ 2>/dev/null
mv scripts/start*.sh scripts/build/ 2>/dev/null
mv scripts/dev*.sh scripts/build/ 2>/dev/null
mv scripts/run-*.sh scripts/build/ 2>/dev/null
mv scripts/smart-run.sh scripts/build/ 2>/dev/null

# Move type-fix scripts
echo "Moving type-fix scripts..."
if [ -d "scripts/type-fixes" ]; then
    echo "type-fixes folder already exists and contains scripts"
fi

# Move utility scripts
echo "Moving utility scripts..."
mv scripts/install-*.mjs scripts/utilities/ 2>/dev/null
mv scripts/setup-*.sh scripts/utilities/ 2>/dev/null
mv scripts/check-*.js scripts/utilities/ 2>/dev/null

# Keep organization scripts in root of scripts folder
echo "Keeping organization scripts in scripts root..."
# organize-docs.sh
# organize-docs-phase2.sh
# organize-root-folder.sh
# organize-scripts-folder.sh

echo ""
echo "Scripts folder organization complete!"
echo ""
echo "New structure:"
echo "scripts/"
echo "├── analysis/        - Analysis and pattern scripts"
echo "├── build/           - Build, start, and dev scripts"
echo "├── database/        - Database management scripts"
echo "├── fixes/           - Fix and patch scripts"
echo "├── migration/       - Migration scripts"
echo "├── testing/         - Test scripts"
echo "├── type-fixes/      - TypeScript type fixing scripts"
echo "├── utilities/       - Utility and helper scripts"
echo "└── organize-*.sh    - Organization scripts"
echo ""
echo "Files in each folder:"
for dir in scripts/*/; do
    if [ -d "$dir" ]; then
        count=$(ls -1 "$dir" 2>/dev/null | wc -l)
        echo "$(basename $dir): $count files"
    fi
done