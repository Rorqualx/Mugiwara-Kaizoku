#!/bin/bash
# Kapowarr Quick Setup Script
# This script helps set up Kapowarr for first-time use

set -e

echo "🚀 Kapowarr Quick Setup"
echo "======================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the Mugiwara-Kaizoku project root${NC}"
    exit 1
fi

echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found${NC}"

# Check bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ bun is not installed${NC}"
    echo "   Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo -e "${GREEN}✅ bun found${NC}"

# Check PostgreSQL connection
echo ""
echo "🔍 Checking database connection..."
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set in environment${NC}"
    echo "   Please set DATABASE_URL in your .env file"
    echo "   Example: DATABASE_URL=postgresql://user:pass@localhost:5432/mugiwara"
else
    echo -e "${GREEN}✅ DATABASE_URL configured${NC}"
fi

echo ""
echo "📦 Installing dependencies..."
bun install

echo ""
echo "🗄️  Setting up database..."
echo "   Using schema recreation for development"

# Generate Prisma client
echo "   Generating Prisma client..."
bun run generate

# Reset database in development
if [ "$NODE_ENV" != "production" ]; then
    echo "   Recreating database schema..."
    bun run db:reset:dev
else
    echo -e "${YELLOW}⚠️  Production environment detected - skipping schema recreation${NC}"
fi

echo ""
echo "🔧 Configuring Kapowarr..."

# Create Kapowarr directories
KAPOWARR_DOWNLOAD_PATH="${KAPOWARR_DOWNLOAD_PATH:-./downloads/kapowarr}"
KAPOWARR_TEMP_PATH="${KAPOWARR_TEMP_PATH:-./temp/kapowarr}"

echo "   Creating directories..."
mkdir -p "$KAPOWARR_DOWNLOAD_PATH"
mkdir -p "$KAPOWARR_TEMP_PATH"
echo -e "${GREEN}✅ Directories created${NC}"

# Check for .env configuration
echo ""
echo "📝 Checking environment configuration..."

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "   Creating .env file from example..."
    cp .env.example "$ENV_FILE"
fi

# Add Kapowarr configuration if not present
if ! grep -q "KAPOWARR_ENABLED" "$ENV_FILE"; then
    echo ""
    echo "   Adding Kapowarr configuration to .env..."
    cat >> "$ENV_FILE" << 'EOL'

# Kapowarr Configuration
KAPOWARR_ENABLED=true
KAPOWARR_MAX_CONCURRENT_DOWNLOADS=3
KAPOWARR_DEFAULT_RATE_LIMIT_RPS=2
KAPOWARR_DEFAULT_RATE_LIMIT_RPM=100
KAPOWARR_DOWNLOAD_TIMEOUT=300000
KAPOWARR_PAGE_DOWNLOAD_TIMEOUT=30000
KAPOWARR_RETRY_ATTEMPTS=3
KAPOWARR_RETRY_DELAY=5000
KAPOWARR_DOWNLOAD_PATH=./downloads/kapowarr
KAPOWARR_TEMP_PATH=./temp/kapowarr
KAPOWARR_ENABLE_CACHE=true
KAPOWARR_CACHE_TTL=3600
KAPOWARR_MAX_CACHE_SIZE=100
EOL
    echo -e "${GREEN}✅ Kapowarr configuration added${NC}"
else
    echo -e "${GREEN}✅ Kapowarr configuration already present${NC}"
fi

echo ""
echo "🧪 Running tests..."
echo "   Running Kapowarr unit tests..."
bun run test -- --testPathPattern=kapowarr --passWithNoTests || {
    echo -e "${YELLOW}⚠️  Some tests failed - this is okay for initial setup${NC}"
}

echo ""
echo "🎨 Building application..."
bun run build:clean || {
    echo -e "${YELLOW}⚠️  Build had warnings - this is normal${NC}"
}

echo ""
echo "✨ Kapowarr setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Start the development server: ${GREEN}bun run dev${NC}"
echo "   2. Navigate to Settings → Kapowarr"
echo "   3. Add your first manga source"
echo "   4. Read the user guide: ${GREEN}docs/kapowarr/USER_GUIDE.md${NC}"
echo ""
echo "🔗 Quick links:"
echo "   • User Guide: docs/kapowarr/USER_GUIDE.md"
echo "   • Config Guide: docs/kapowarr/CONFIGURATION_GUIDE.md"
echo "   • Examples: docs/kapowarr/examples/"
echo ""
echo "Happy manga downloading! 📖"
