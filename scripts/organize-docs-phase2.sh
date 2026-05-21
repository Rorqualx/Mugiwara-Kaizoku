#!/bin/bash

# Phase 2: Organize remaining documentation files in docs folder
# Author: Documentation Team
# Date: 2025-09-06

echo "Phase 2: Organizing remaining documentation files..."

# Move loose migration files to appropriate folders
echo "Moving migration-related files from docs root..."

# API migration files
mv docs/api-route-factory-migration.md docs/migration/api/ 2>/dev/null
mv docs/api-route-migration-analysis.md docs/migration/api/ 2>/dev/null
mv docs/frontend-migration-plan.md docs/migration/ 2>/dev/null

# Cleanup files
mv docs/api-utils-cleanup-analysis.md docs/cleanup-reports/ 2>/dev/null
mv docs/api-utils-cleanup-complete.md docs/cleanup-reports/ 2>/dev/null
mv docs/cleanup-analysis-src-services.md docs/cleanup-reports/ 2>/dev/null
mv docs/cleanup-executed-src-services.md docs/cleanup-reports/ 2>/dev/null
mv docs/server-cleanup-report.md docs/cleanup-reports/ 2>/dev/null
mv docs/server-cleanup-summary.md docs/cleanup-reports/ 2>/dev/null
mv docs/server-cleanup-verification.md docs/cleanup-reports/ 2>/dev/null
mv docs/utils-cleanup-summary.md docs/cleanup-reports/ 2>/dev/null

# Type migration files
mv docs/prisma-migration-progress.md docs/migration/typescript-migration/ 2>/dev/null
mv docs/prisma-types-migration-plan.md docs/migration/typescript-migration/ 2>/dev/null
mv docs/type-migration-progress-2025-09.md docs/migration/typescript-migration/ 2>/dev/null
mv docs/consolidation-pre-migration-state.md docs/migration/ 2>/dev/null

# Status and metadata migration
mv docs/status-migration-complete.md docs/migration/ 2>/dev/null
mv docs/unified-metadata-migration-complete.md docs/migration/ 2>/dev/null
mv docs/unified-metadata-migration.md docs/migration/ 2>/dev/null
mv docs/services-layer-migration-complete.md docs/migration/ 2>/dev/null

# Archive plan files
mv docs/cleanup-and-archive-plan.md docs/archive/ 2>/dev/null

# Migration execution logs
mv docs/migration-execution-log.txt docs/migration/ 2>/dev/null
mv docs/migration-validation-report.md docs/migration/ 2>/dev/null

# Consolidate duplicate folders
echo "Consolidating duplicate folders..."

# Merge architecture-migration into migration/architecture
if [ -d "docs/architecture-migration" ]; then
    mkdir -p docs/migration/architecture
    cp -r docs/architecture-migration/* docs/migration/architecture/ 2>/dev/null
    rm -rf docs/architecture-migration
    echo "Merged architecture-migration into migration/architecture"
fi

# Merge migration-archive into archive/migration-history
if [ -d "docs/migration-archive" ]; then
    mkdir -p docs/archive/migration-history
    cp -r docs/migration-archive/* docs/archive/migration-history/ 2>/dev/null
    rm -rf docs/migration-archive
    echo "Merged migration-archive into archive/migration-history"
fi

# Organize research folder better
echo "Organizing research folder..."
if [ -d "docs/research" ]; then
    # Clean up folder names
    mv "docs/research/comprehensive api" "docs/research/comprehensive-api" 2>/dev/null
    mv "docs/research/japan comments" "docs/research/japan-comments" 2>/dev/null
fi

# Clean up session and temporary folders
echo "Organizing session and temporary documentation..."
if [ -d "docs/session-notes" ]; then
    mkdir -p docs/archive/session-notes
    cp -r docs/session-notes/* docs/archive/session-notes/ 2>/dev/null
    rm -rf docs/session-notes
    echo "Moved session-notes to archive"
fi

# Move project planning session notes
if [ -d "docs/project-planning/session" ]; then
    mkdir -p docs/archive/planning-sessions
    cp -r docs/project-planning/session/* docs/archive/planning-sessions/ 2>/dev/null
    rm -rf docs/project-planning/session
    echo "Moved planning sessions to archive"
fi

# Clean up navigation issue diagnosis (likely temporary)
if [ -d "docs/navigation-issue-diagnosis" ]; then
    mkdir -p docs/troubleshooting/navigation
    cp -r docs/navigation-issue-diagnosis/* docs/troubleshooting/navigation/ 2>/dev/null
    rm -rf docs/navigation-issue-diagnosis
    echo "Moved navigation issues to troubleshooting"
fi

# Consolidate reader integration
if [ -d "docs/reader-integration" ]; then
    mkdir -p docs/features/reader
    cp -r docs/reader-integration/* docs/features/reader/ 2>/dev/null
    rm -rf docs/reader-integration
    echo "Moved reader-integration to features/reader"
fi

# Clean up known issues
if [ -d "docs/known-issues" ]; then
    cp -r docs/known-issues/* docs/troubleshooting/ 2>/dev/null
    rm -rf docs/known-issues
    echo "Merged known-issues into troubleshooting"
fi

# Consolidate build system docs
if [ -d "docs/build-typescript" ]; then
    cp -r docs/build-typescript/* docs/build-system/ 2>/dev/null
    rm -rf docs/build-typescript
    echo "Merged build-typescript into build-system"
fi

# Move standards to documentation-meta
if [ -d "docs/standards" ]; then
    cp -r docs/standards/* docs/documentation-meta/ 2>/dev/null
    rm -rf docs/standards
    echo "Merged standards into documentation-meta"
fi

# Move events to system
if [ -d "docs/events" ]; then
    mkdir -p docs/system/events
    cp -r docs/events/* docs/system/events/ 2>/dev/null
    rm -rf docs/events
    echo "Moved events to system/events"
fi

# Move refactoring to migration
if [ -d "docs/refactoring" ]; then
    mkdir -p docs/migration/refactoring
    cp -r docs/refactoring/* docs/migration/refactoring/ 2>/dev/null
    rm -rf docs/refactoring
    echo "Moved refactoring to migration/refactoring"
fi

# Move consolidation-work to archive
if [ -d "docs/consolidation-work" ]; then
    mkdir -p docs/archive/consolidation-work
    cp -r docs/consolidation-work/* docs/archive/consolidation-work/ 2>/dev/null
    rm -rf docs/consolidation-work
    echo "Moved consolidation-work to archive"
fi

echo ""
echo "Phase 2 organization complete!"
echo ""
echo "Summary of changes:"
echo "- Moved loose migration files to organized folders"
echo "- Consolidated duplicate folders"
echo "- Organized research and session folders"
echo "- Cleaned up temporary and diagnostic folders"
echo "- Merged related documentation into appropriate categories"