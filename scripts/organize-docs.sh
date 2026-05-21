#!/bin/bash

# Script to organize documentation files from root to appropriate folders
# Author: Documentation Team
# Date: 2025-09-06

echo "Starting documentation organization..."

# Create necessary directories if they don't exist
mkdir -p docs/migration/typescript-migration
mkdir -p docs/migration/phase-reports
mkdir -p docs/migration/error-handling
mkdir -p docs/migration/console-migration
mkdir -p docs/migration/code-cleanup
mkdir -p docs/fixes-summaries/typescript-fixes
mkdir -p docs/fixes-summaries/error-fixes
mkdir -p docs/fixes-summaries/type-fixes
mkdir -p docs/project-info/breaking-changes
mkdir -p docs/kapowarr/fixes
mkdir -p docs/testing/test-reports

# Function to move file with confirmation
move_file() {
    local source="$1"
    local dest="$2"
    
    if [ -f "$source" ]; then
        echo "Moving $source to $dest"
        mv "$source" "$dest"
    fi
}

echo "Organizing TypeScript migration files..."
# TypeScript migration files
move_file "TYPESCRIPT_ERROR_ANALYSIS_REPORT.md" "docs/migration/typescript-migration/"
move_file "TYPESCRIPT_MIGRATION_REPORT.md" "docs/migration/typescript-migration/"
move_file "typescript-error-analysis-report.md" "docs/migration/typescript-migration/"
move_file "typescript-error-analysis.md" "docs/migration/typescript-migration/"
move_file "typescript-error-fix-plan.md" "docs/migration/typescript-migration/"
move_file "typescript-error-report.md" "docs/migration/typescript-migration/"
move_file "typescript-errors-analysis-report.md" "docs/migration/typescript-migration/"
move_file "typescript-fix-progress.md" "docs/migration/typescript-migration/"
move_file "typescript-fixes-applied.md" "docs/migration/typescript-migration/"
move_file "typescript-fixes-final-report.md" "docs/migration/typescript-migration/"
move_file "typescript-fixes-summary.md" "docs/migration/typescript-migration/"
move_file "typescript-migration-report.md" "docs/migration/typescript-migration/"
move_file "type-migration-report.md" "docs/migration/typescript-migration/"

echo "Organizing phase completion reports..."
# Phase completion reports
move_file "PHASE1_COMPLETION_REPORT.md" "docs/migration/phase-reports/"
move_file "PHASE_2_COMPLETION_REPORT.md" "docs/migration/phase-reports/"
move_file "PHASE3_EXECUTION_REPORT.md" "docs/migration/phase-reports/"
move_file "PHASE4_COMPLETION_REPORT.md" "docs/migration/phase-reports/"
move_file "PHASE_4_CLEANUP_COMPLETE.md" "docs/migration/phase-reports/"
move_file "phase1-completion-report.md" "docs/migration/phase-reports/"
move_file "phase1-completion-summary.md" "docs/migration/phase-reports/"
move_file "phase2-completion-report.md" "docs/migration/phase-reports/"
move_file "phase2-typescript-fixes-summary.md" "docs/migration/phase-reports/"
move_file "phase3-completion-report.md" "docs/migration/phase-reports/"
move_file "phase3-state-management-completion-report.md" "docs/migration/phase-reports/"
move_file "phase3-state-management-completion.md" "docs/migration/phase-reports/"
move_file "phase4-completion-report.md" "docs/migration/phase-reports/"
move_file "phase4-validation-complete.md" "docs/migration/phase-reports/"
move_file "phase5-completion-report.md" "docs/migration/phase-reports/"
move_file "MIGRATION_PHASE_7.md" "docs/migration/phase-reports/"
move_file "stage2-report.md" "docs/migration/phase-reports/"

echo "Organizing error handling and fixes..."
# Error handling and fixes
move_file "ERROR_HANDLING_AST_MIGRATION_PLAN.md" "docs/migration/error-handling/"
move_file "ERROR_MESSAGE_CONSOLIDATION_ANALYSIS.md" "docs/migration/error-handling/"
move_file "27-errors-resolution-report.md" "docs/fixes-summaries/error-fixes/"
move_file "addmanga-errors-resolution-final-report.md" "docs/fixes-summaries/error-fixes/"
move_file "MIGRATION_PLAN_USEMANGA_ERRORS.md" "docs/migration/error-handling/"
move_file "USEMANGA_ERRORS_FIXED_REPORT.md" "docs/fixes-summaries/error-fixes/"
move_file "non-critical-errors-fix-report.md" "docs/fixes-summaries/error-fixes/"
move_file "TRPC_ROUTER_ERROR_ANALYSIS.md" "docs/api/"

echo "Organizing type system files..."
# Type system and canonical types
move_file "canonical-migration-report.md" "docs/fixes-summaries/type-fixes/"
move_file "canonical-types-consolidation-report.md" "docs/fixes-summaries/type-fixes/"
move_file "canonical-types-fix-summary.md" "docs/fixes-summaries/type-fixes/"
move_file "canonical-types-fixes.md" "docs/fixes-summaries/type-fixes/"
move_file "canonical-types-resolution-plan.md" "docs/fixes-summaries/type-fixes/"
move_file "canonical-types-resolution-report.md" "docs/fixes-summaries/type-fixes/"
move_file "canonical-types-resolution-summary.md" "docs/fixes-summaries/type-fixes/"
move_file "complex-type-fixes-report.md" "docs/fixes-summaries/type-fixes/"
move_file "duplicate-resolution-report.md" "docs/fixes-summaries/type-fixes/"
move_file "duplicate-types-resolution-plan.md" "docs/fixes-summaries/type-fixes/"
move_file "duplicate-types-resolution-summary.md" "docs/fixes-summaries/type-fixes/"
move_file "interface-consolidation-report.md" "docs/fixes-summaries/type-fixes/"
move_file "utils-type-migration-plan.md" "docs/fixes-summaries/type-fixes/"
move_file "utils-type-migration-report.md" "docs/fixes-summaries/type-fixes/"

echo "Organizing console migration files..."
# Console migration
move_file "CONSOLE_MIGRATION_SUMMARY.md" "docs/migration/console-migration/"
move_file "CONSOLE_TO_LOGGER_MIGRATION_PLAN.md" "docs/migration/console-migration/"
move_file "CONSOLE_VIOLATIONS_ANALYSIS.md" "docs/migration/console-migration/"

echo "Organizing code cleanup files..."
# Code cleanup and duplication
move_file "CODE_DUPLICATION_ANALYSIS.md" "docs/migration/code-cleanup/"
move_file "CODE_DUPLICATION_MIGRATION_PLAN.md" "docs/migration/code-cleanup/"
move_file "code-duplication-report.md" "docs/migration/code-cleanup/"
move_file "FINAL_CLEANUP_COMPLETE.md" "docs/migration/code-cleanup/"
move_file "priority1-completion-summary.md" "docs/migration/code-cleanup/"
move_file "simple-fixes-completion-report.md" "docs/migration/code-cleanup/"

echo "Organizing project info files..."
# Project info and breaking changes
move_file "BREAKING_CHANGES.md" "docs/project-info/breaking-changes/"
move_file "STATUS_SYSTEM_IMPLEMENTATION_GUIDE.md" "docs/system/"
move_file "status-type-refactor-plan.md" "docs/system/"

echo "Organizing Kapowarr files..."
# Kapowarr related
move_file "baseKapowarrAdapter-fix.md" "docs/kapowarr/fixes/"

echo "Organizing test files..."
# Test related
move_file "test-volumes-display.md" "docs/testing/test-reports/"

echo "Documentation organization complete!"
echo ""
echo "Summary of organized files:"
echo "- TypeScript migration: docs/migration/typescript-migration/"
echo "- Phase reports: docs/migration/phase-reports/"
echo "- Error fixes: docs/fixes-summaries/error-fixes/"
echo "- Type fixes: docs/fixes-summaries/type-fixes/"
echo "- Console migration: docs/migration/console-migration/"
echo "- Code cleanup: docs/migration/code-cleanup/"
echo "- Project info: docs/project-info/breaking-changes/"
echo "- Kapowarr: docs/kapowarr/fixes/"
echo "- Testing: docs/testing/test-reports/"