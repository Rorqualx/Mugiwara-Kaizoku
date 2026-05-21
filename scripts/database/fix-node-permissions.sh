#!/bin/bash

# =============================================================================
# NODE MODULES PERMISSIONS FIX SCRIPT
# =============================================================================
# This script fixes permission issues with node_modules directory
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting Node Modules Permissions Fix${NC}"

# Check if node_modules directory exists
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}✅ No node_modules directory found, nothing to fix${NC}"
    exit 0
fi

# Fix permissions
echo -e "${BLUE}🔧 Fixing node_modules permissions...${NC}"

# Try to take ownership of node_modules
echo -e "${BLUE}🔧 Taking ownership of node_modules...${NC}"
if sudo chown -R $(whoami) node_modules 2>/dev/null; then
    echo -e "${GREEN}✅ Successfully took ownership of node_modules${NC}"
else
    echo -e "${YELLOW}⚠️ Could not take ownership of node_modules${NC}"
fi

# Set correct permissions
echo -e "${BLUE}🔧 Setting correct permissions...${NC}"
if sudo chmod -R 755 node_modules 2>/dev/null; then
    echo -e "${GREEN}✅ Successfully set permissions on node_modules${NC}"
else
    echo -e "${YELLOW}⚠️ Could not set permissions on node_modules${NC}"
fi

# Try to force remove node_modules if still having issues
echo -e "${BLUE}🔧 Checking if force removal is needed...${NC}"
if [ -d "node_modules" ] && ! rm -rf node_modules 2>/dev/null; then
    echo -e "${YELLOW}⚠️ Standard removal failed, trying force removal with sudo...${NC}"
    if sudo rm -rf node_modules; then
        echo -e "${GREEN}✅ Successfully removed node_modules directory${NC}"
    else
        echo -e "${RED}❌ Failed to remove node_modules directory${NC}"
        echo -e "${YELLOW}⚠️ You may need to manually remove it:${NC}"
        echo "   sudo rm -rf node_modules"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Node modules permissions fixed successfully${NC}"