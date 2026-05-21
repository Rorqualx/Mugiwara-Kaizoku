#!/bin/bash
# Setup script for pre-commit hooks

echo "🔧 Setting up pre-commit hooks for Mugiwara-Kaizoku..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .husky

# Check if bun is installed (preferred), otherwise fallback
if command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
else
    echo "❌ Error: No package manager found (bun or npm)"
    exit 1
fi

# Install husky if not already installed
if [ ! -d "node_modules/husky" ]; then
    echo "📦 Installing husky..."
    $PKG_MANAGER add -D husky
fi

# Initialize husky
echo "🚀 Initializing husky..."
$PKG_MANAGER exec husky install

# Copy pre-commit hook
echo "📋 Installing pre-commit hook..."
cp scripts/pre-commit-hook.sh .husky/pre-commit
chmod +x .husky/pre-commit

# Make scripts executable
chmod +x scripts/*.sh

# Create git hooks directory if using git directly
if [ -d ".git/hooks" ]; then
    echo "🔗 Creating git hook symlink..."
    ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
fi

# Update package.json if needed
if ! grep -q "\"prepare\": \"husky install\"" package.json; then
    echo "📝 Adding husky prepare script to package.json..."
    # This is a simplified approach - in production, use a proper JSON tool
    echo ""
    echo "⚠️  Please add this to your package.json scripts section:"
    echo '  "prepare": "husky install"'
fi

echo ""
echo "✅ Pre-commit hooks setup complete!"
echo ""
echo "The following checks will run before each commit:"
echo "  - TypeScript type checking"
echo "  - Mantine v7 compatibility"
echo "  - tRPC v10 syntax"
echo "  - ID type conversions"
echo "  - ESLint"
echo ""
echo "To test the hook manually, run:"
echo "  ./scripts/pre-commit-hook.sh"
echo ""
echo "To bypass the hook in emergencies (not recommended):"
echo "  git commit --no-verify"
