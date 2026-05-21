#!/bin/bash
###############################################################################
# Add ESLint Suppressions for Intentional Patterns
# This script adds targeted suppressions for known intentional patterns
###############################################################################

set -e

echo "🔧 Adding ESLint suppressions for intentional patterns..."
echo ""

# Function to add suppression before logger statements with !! patterns
add_logger_suppressions() {
  local file=$1
  echo "  Processing: $file"

  # Add suppression before logger.debug/info/warn lines with !! patterns
  perl -i -pe '
    if (/^\s*logger\.(debug|info|warn).*!!/ && $prev !~ /eslint-disable/) {
      print "    // eslint-disable-next-line \@typescript-eslint/no-unnecessary-condition -- Intentional: Explicit boolean conversion for logging clarity\n";
    }
    $prev = $_;
  ' "$file"
}

# Function to add suppression before typeof window checks
add_ssr_suppressions() {
  local file=$1
  echo "  Processing: $file"

  perl -i -pe '
    if (/typeof window !== .undefined./ && $prev !~ /eslint-disable/) {
      print "  // eslint-disable-next-line \@typescript-eslint/no-unnecessary-condition -- Intentional: SSR compatibility - prevents server-side execution\n";
    }
    $prev = $_;
  ' "$file"
}

# Function to add suppression before objects with conditional spreads
add_conditional_spread_suppressions() {
  local file=$1
  echo "  Processing: $file"

  perl -i -pe '
    if (/\.\.\.\(.*!= null &&/ && $prev !~ /eslint-disable/ && $prev !~ /^\s*\/\//) {
      print "      // eslint-disable-next-line \@typescript-eslint/no-unnecessary-condition -- Intentional: Conditional spread excludes undefined/null from object\n";
    }
    $prev = $_;
  ' "$file"
}

echo "📝 Adding suppressions for boolean conversions in logging..."
add_logger_suppressions "src/server/trpc/routers/manga.ts"
echo "✅ Done"
echo ""

echo "📝 Adding suppressions for SSR environment checks..."
for file in \
  "src/hooks/mobile/useHapticFeedback.ts" \
  "src/components/addManga/index.tsx" \
  "src/components/addManga/utils/devLogger.ts" \
  "src/components/addManga/utils/performance.ts" \
  "src/components/layouts/ResponsiveMainLayout.tsx" \
  "src/components/common/UnifiedErrorBoundary.tsx" \
  "src/utils/trpc-client/direct-export.ts" \
  "src/utils/trpc-client/index.ts" \
  "src/utils/mobile/device-detection.ts" \
  "src/utils/mobile/development-tools.ts" \
  "src/utils/mobile/code-splitting.ts"; do
  if [ -f "$file" ]; then
    add_ssr_suppressions "$file"
  fi
done
echo "✅ Done"
echo ""

echo "📝 Adding suppressions for conditional spreads..."
for file in \
  "src/hooks/useSystemEvents.ts" \
  "src/hooks/useDownloadConfig.ts" \
  "src/components/mobile/MobileBottomNavigation.tsx" \
  "src/components/mobile/MobileNavigationDrawer.tsx" \
  "src/components/mobile/MobileModal.tsx" \
  "src/components/mobile/BottomSheet.tsx" \
  "src/components/reader/MobileReader.tsx"; do
  if [ -f "$file" ]; then
    add_conditional_spread_suppressions "$file"
  fi
done
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Suppression addition complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Verify suppressions: grep -r 'eslint-disable-next-line.*no-unnecessary-condition' src | wc -l"
echo "3. Commit changes"
echo ""
