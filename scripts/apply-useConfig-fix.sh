#!/bin/bash
# Quick fix script to replace mock useConfig with tRPC implementation

echo "🔧 Applying useConfig tRPC fix..."
echo ""
echo "This will replace the mock useConfig with the tRPC implementation"
echo "affecting 24+ files across the codebase."
echo ""
echo "⚠️  Make sure to test the application after applying this fix!"
echo ""

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp src/hooks/useConfig.ts "src/hooks/useConfig.mock_${TIMESTAMP}.bak"
echo "✅ Created backup: src/hooks/useConfig.mock_${TIMESTAMP}.bak"

# Apply the fix
cat > src/hooks/useConfig.ts << 'EOF'
/**
 * Configuration Hook - tRPC Implementation
 * 
 * This module now uses the tRPC-based implementation for real data persistence.
 * All configuration data is saved to the database and persists across sessions.
 * 
 * Migration Date: January 2025
 * Previous mock implementation backed up with timestamp
 */

// Export everything from the tRPC implementation
export * from './useConfigTRPC';

// Log successful migration
if (process.env.NODE_ENV === 'development') {
  console.log('✅ useConfig: Using tRPC implementation with database persistence');
}
EOF

echo "✅ Applied tRPC implementation to useConfig.ts"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: bun run dev"
echo "2. Test the following features:"
echo "   - ComicVine toggle and settings"
echo "   - AniList configuration"
echo "   - Theme changes"
echo "   - Download client settings"
echo "3. Verify settings persist after page refresh"
echo ""
echo "🔄 To rollback if needed:"
echo "   cp src/hooks/useConfig.mock_${TIMESTAMP}.bak src/hooks/useConfig.ts"
echo ""
echo "✨ Fix applied successfully!"
