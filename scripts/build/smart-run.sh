#!/bin/bash

# =============================================================================
# SMART RUN SCRIPT
# =============================================================================
# This script runs a command and automatically triggers database repair
# if it detects database schema errors.
# 
# Usage: ./scripts/smart-run.sh "command to run"
# Example: ./scripts/smart-run.sh "bun run build:clean"
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: No command provided${NC}"
    echo -e "${YELLOW}Usage: $0 \"command to run\"${NC}"
    echo -e "${YELLOW}Example: $0 \"bun run build:clean\"${NC}"
    exit 1
fi

# Save the command to run
COMMAND="$1"
echo -e "${BLUE}🚀 Running command: ${COMMAND}${NC}"

# Patterns to detect database schema errors
TABLE_PATTERN="table .* does not exist"
COLUMN_PATTERN="column .* does not exist"
MISSING_RELATION="relation .* does not exist"
ACCOUNT_TABLE_ERROR="The underlying table for model \`Account\` does not exist"

# Function to capture output and check for errors
run_and_check() {
    local command="$1"
    local temp_file=$(mktemp)
    
    # Run the command and capture output
    set +e  # Disable exit on error temporarily
    eval "$command" 2>&1 | tee "$temp_file"
    local exit_code=${PIPESTATUS[0]}
    set -e  # Re-enable exit on error
    
    # Check for schema errors in the output
    if [ $exit_code -ne 0 ]; then
        echo -e "${YELLOW}⚠️ Command failed with exit code $exit_code. Checking for database schema errors...${NC}"
        
        # Check for various error patterns
        if grep -q "$TABLE_PATTERN\|$COLUMN_PATTERN\|$MISSING_RELATION\|$ACCOUNT_TABLE_ERROR" "$temp_file"; then
            echo -e "${YELLOW}⚠️ Database schema error detected!${NC}"
            
            # Extract the error message
            local error_message=""
            if grep -q "$ACCOUNT_TABLE_ERROR" "$temp_file"; then
                error_message="$ACCOUNT_TABLE_ERROR"
            else
                error_message=$(grep -E "$TABLE_PATTERN|$COLUMN_PATTERN|$MISSING_RELATION" "$temp_file" | head -1)
            fi
            
            echo -e "${BLUE}🔍 Detected error: $error_message${NC}"
            
            # Run auto-repair with the error message
            echo -e "${BLUE}🔄 Triggering auto-repair...${NC}"
            if [ -f "scripts/database/auto-repair.sh" ]; then
                ./scripts/database/auto-repair.sh --error "$error_message"
                
                # If repair was successful, retry the command
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✅ Repair successful! Retrying the original command...${NC}"
                    # Re-run the command
                    eval "$command"
                    return $?
                else
                    echo -e "${RED}❌ Repair failed. Please check your schema and database setup.${NC}"
                    return 1
                fi
            else
                echo -e "${RED}❌ Auto-repair script not found at scripts/database/auto-repair.sh${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Command failed but no database schema error was detected.${NC}"
            echo -e "${RED}❌ This may require manual intervention.${NC}"
            return $exit_code
        fi
    else
        echo -e "${GREEN}✅ Command completed successfully${NC}"
        return 0
    fi
    
    # Clean up
    rm -f "$temp_file"
}

# Run the command with error checking
run_and_check "$COMMAND"
exit_code=$?

# Final message
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ Smart run completed successfully${NC}"
else
    echo -e "${RED}❌ Smart run failed with exit code $exit_code${NC}"
fi

exit $exit_code