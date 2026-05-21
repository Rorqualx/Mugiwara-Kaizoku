#!/bin/bash

# Ensure Java 21 is available
# This script checks for Java 21 and returns appropriate exit codes

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check Java version
check_java_version() {
    local java_cmd="$1"
    if [ -x "$java_cmd" ]; then
        local version=$("$java_cmd" -version 2>&1 | grep "version" | awk -F '"' '{print $2}' | cut -d'.' -f1)
        if [ "$version" -ge 21 ] 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Check Homebrew Java 21 locations first
if [ -x "/usr/local/opt/openjdk@21/bin/java" ] && check_java_version "/usr/local/opt/openjdk@21/bin/java"; then
    echo -e "${GREEN}✅ Java 21 found at /usr/local/opt/openjdk@21/bin/java${NC}"
    exit 0
elif [ -x "/opt/homebrew/opt/openjdk@21/bin/java" ] && check_java_version "/opt/homebrew/opt/openjdk@21/bin/java"; then
    echo -e "${GREEN}✅ Java 21 found at /opt/homebrew/opt/openjdk@21/bin/java${NC}"
    exit 0
fi

# Check Java in PATH
if command -v java >/dev/null 2>&1 && check_java_version "$(command -v java)"; then
    echo -e "${GREEN}✅ Java 21+ found in PATH${NC}"
    exit 0
fi

# Java 21 not found
echo -e "${YELLOW}⚠️  Java 21 or higher is not installed or not in PATH${NC}"
exit 1