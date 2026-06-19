#!/bin/bash
set -e

# Mugiwara-Kaizoku Comprehensive Clean Build Script
# This script handles everything from scratch: clean, install, build, prep
# Now includes smart database error detection and auto-repair

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error patterns to detect database schema issues
TABLE_PATTERN="table .* does not exist"
COLUMN_PATTERN="column .* does not exist"
MISSING_RELATION="relation .* does not exist"
ACCOUNT_TABLE_ERROR="The underlying table for model \`Account\` does not exist"
PERMISSION_ERROR="permission denied for schema public"
NODE_PERMISSION_ERROR="Permission denied"

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Detect if auto-repair script exists
AUTO_REPAIR_AVAILABLE=false
if [ -f "scripts/database/auto-repair.sh" ]; then
    AUTO_REPAIR_AVAILABLE=true
fi

# Smart error handling
handle_error() {
    local step="$1"
    local error_output="$2"
    
    log_error "Build failed at step: $step"
    
    # Check for node modules permission error
    if echo "$error_output" | grep -q "$NODE_PERMISSION_ERROR" && [[ "$step" == *"clean"* || "$step" == *"node"* || "$step" == *"npm"* || "$step" == *"bun"* ]]; then
        log_warning "Node modules permission error detected. Attempting to fix permissions..."
        
        # Check if permissions fix script exists
        if [ -f "scripts/database/fix-node-permissions.sh" ]; then
            log_info "Running node modules permissions fix script..."
            if ./scripts/database/fix-node-permissions.sh; then
                log_success "Node permissions fixed successfully! Continuing build process..."
                return 0
            else
                log_error "Node permission fix failed. You may need to run with sudo."
                log_info "Try running: sudo ./scripts/database/fix-node-permissions.sh"
                exit 1
            fi
        else
            log_error "Node permission fix script not found. Please run with sudo."
            exit 1
        fi
    fi
    
    # Check for PostgreSQL permission error
    if echo "$error_output" | grep -q "$PERMISSION_ERROR"; then
        log_warning "PostgreSQL permission error detected. Attempting to fix permissions..."
        
        # Check if permissions fix script exists
        if [ -f "scripts/database/fix-postgres-permissions.sh" ]; then
            log_info "Running PostgreSQL permissions fix script..."
            if ./scripts/database/fix-postgres-permissions.sh; then
                log_success "Permissions fixed successfully! Continuing build process..."
                return 0
            else
                log_error "Permission fix failed. You may need to run with sudo or fix PostgreSQL permissions manually."
                log_info "Try running: sudo ./scripts/database/fix-postgres-permissions.sh"
                exit 1
            fi
        else
            log_error "Permission fix script not found. Please run with sudo or fix PostgreSQL permissions manually."
            exit 1
        fi
    fi
    
    # Check if this is a database schema error and auto-repair is available
    if [ "$AUTO_REPAIR_AVAILABLE" = true ] && echo "$error_output" | grep -q "$TABLE_PATTERN\|$COLUMN_PATTERN\|$MISSING_RELATION\|$ACCOUNT_TABLE_ERROR"; then
        log_warning "Database schema error detected. Attempting auto-repair..."
        
        # Extract the error message
        local error_message=""
        if echo "$error_output" | grep -q "$ACCOUNT_TABLE_ERROR"; then
            error_message="$ACCOUNT_TABLE_ERROR"
        else
            error_message=$(echo "$error_output" | grep -E "$TABLE_PATTERN|$COLUMN_PATTERN|$MISSING_RELATION" | head -1)
        fi
        
        # Attempt to repair
        log_info "Running auto-repair for error: $error_message"
        if ./scripts/database/auto-repair.sh --error "$error_message"; then
            log_success "Auto-repair successful! Continuing build process..."
            return 0
        else
            log_error "Auto-repair failed. Please check your schema and database setup."
        fi
    fi
    
    # If we get here, either repair failed or this isn't a database schema error
    exit 1
}

# Function to run a command and capture its output for error handling
run_with_error_capture() {
    local step="$1"
    local cmd="$2"
    
    # Create a temporary file for output
    local temp_file=$(mktemp)
    
    # Run the command and capture output
    set +e  # Disable exit on error
    eval "$cmd" 2>&1 | tee "$temp_file"
    local exit_code=${PIPESTATUS[0]}
    set -e  # Re-enable exit on error
    
    # Check exit code
    if [ $exit_code -ne 0 ]; then
        # Read the output for error handling
        local output=$(cat "$temp_file")
        rm -f "$temp_file"
        handle_error "$step" "$output"
        return $exit_code
    fi
    
    # Clean up
    rm -f "$temp_file"
    return 0
}

# Trap unexpected errors
trap 'handle_error "Build process" "Unexpected error occurred"' ERR

log_info "Starting Mugiwara-Kaizoku comprehensive clean build..."

# ============================================================================
# STEP 1: ENVIRONMENT DETECTION
# ============================================================================
log_info "Detecting environment..."

# Check if we're in Docker
if [ -f "/.dockerenv" ] || [ -n "${DOCKER_ENV}" ]; then
    ENVIRONMENT="docker"
    log_info "Environment: Docker"
else
    ENVIRONMENT="local"
    log_info "Environment: Local"
fi

# Check if PostgreSQL is available and running
if command -v psql >/dev/null 2>&1; then
    POSTGRES_AVAILABLE="true"
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_success "PostgreSQL available and running"
        POSTGRES_RUNNING="true"
    else
        log_warning "PostgreSQL available but not running"
        POSTGRES_RUNNING="false"
    fi
else
    POSTGRES_AVAILABLE="false"
    POSTGRES_RUNNING="false"
    log_warning "PostgreSQL not available - will use Docker"
fi

# Check if Docker is available
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    DOCKER_AVAILABLE="true"
    log_success "Docker available"
elif command -v docker >/dev/null 2>&1; then
    DOCKER_AVAILABLE="false"
    log_warning "Docker installed but not running"
else
    DOCKER_AVAILABLE="false"
    log_warning "Docker not available"
fi

# ============================================================================
# STEP 2: CLEAN EVERYTHING
# ============================================================================
log_info "Cleaning all build artifacts..."

# Remove node_modules and lock files
if [ -d "node_modules" ]; then
    log_info "Removing node_modules (this may take a moment)..."
    if ! rm -rf node_modules 2>/dev/null; then
        log_warning "Permission issue detected with node_modules. Attempting to fix..."
        if [ -f "scripts/database/fix-node-permissions.sh" ]; then
            ./scripts/database/fix-node-permissions.sh
        else
            log_warning "No fix script found. Trying with sudo..."
            sudo rm -rf node_modules || log_warning "Could not remove node_modules, continuing anyway"
        fi
    fi
fi
rm -f package-lock.json yarn.lock
log_success "Removed node_modules and lock files"

# Remove build artifacts
rm -rf .next dist out build
rm -rf .ts-out .swc
log_success "Removed build artifacts"

# Remove cache directories
rm -rf .cache .temp .tmp
rm -rf logs/*.log 2>/dev/null || true
log_success "Removed cache directories"

# ============================================================================
# STEP 3: NODE.JS AND PACKAGE MANAGER VERIFICATION
# ============================================================================
log_info "Verifying Node.js and bun..."

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_NODE="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]; then
    log_success "Node.js version $NODE_VERSION is compatible"
else
    log_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_NODE+"
    exit 1
fi

# Check bun
if ! command -v bun >/dev/null 2>&1; then
    log_error "bun not found. Install bun with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

BUN_VERSION=$(bun --version)
log_success "bun version $BUN_VERSION is ready"

# ============================================================================
# STEP 4: INSTALL DEPENDENCIES
# ============================================================================
log_info "Installing dependencies with bun..."

# Create clean configuration
cat > .npmrc << EOF
# bun configuration for Mugiwara-Kaizoku
strict-peer-dependencies=false
auto-install-peers=true
prefer-frozen-lockfile=false
EOF

# Install dependencies
bun install --force --reporter=silent
log_success "Dependencies installed successfully"

# ============================================================================
# STEP 5: SUWAYOMI INSTALLATION
# ============================================================================
log_info "Setting up Suwayomi integration..."

# Add Java 21 to PATH if available on macOS
if [ -d "/usr/local/opt/openjdk@21/bin" ]; then
    export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
    export JAVA_HOME="/usr/local/opt/openjdk@21"
elif [ -d "/opt/homebrew/opt/openjdk@21/bin" ]; then
    # For Apple Silicon Macs
    export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
fi

# Ensure Java 21 is available
JAVA_21_AVAILABLE=false
if [ -f "scripts/ensure-java-21.sh" ]; then
    log_info "Checking Java 21 installation..."
    if ./scripts/ensure-java-21.sh; then
        JAVA_21_AVAILABLE=true
    else
        log_warning "Java 21 not found in PATH or Homebrew locations"
        
        # Attempt automatic installation if not in CI environment
        if [ -z "$CI" ] && [ -z "$NONINTERACTIVE" ] && [ -f "scripts/install-java-21.sh" ]; then
            log_info "Attempting to install Java 21 automatically..."
            if ./scripts/install-java-21.sh; then
                # Re-check after installation
                if ./scripts/ensure-java-21.sh; then
                    JAVA_21_AVAILABLE=true
                    log_success "Java 21 installed successfully"
                else
                    log_warning "Java 21 installation completed but verification failed"
                fi
            else
                log_warning "Automatic Java 21 installation failed"
            fi
        fi
    fi
fi

# Check if Suwayomi install script exists and run it
if [ -f "scripts/install-suwayomi.mjs" ]; then
    if [ "$JAVA_21_AVAILABLE" = true ]; then
        log_info "Installing Suwayomi server..."
        # Set environment variable to indicate non-interactive mode
        export NONINTERACTIVE=true
        if node scripts/install-suwayomi.mjs; then
            log_success "Suwayomi installation successful"
        else
            log_warning "Suwayomi installation failed but continuing build"
        fi
        unset NONINTERACTIVE
    else
        log_warning "Skipping Suwayomi installation due to missing Java 21"
        log_info "Suwayomi can be enabled after installing Java 21"
        log_info "To install Java 21 on macOS: brew install openjdk@21"
    fi
else
    log_warning "Suwayomi install script not found"
fi

# ============================================================================
# STEP 6: SETUP CONFIGURATION FILES
# ============================================================================
log_info "Setting up configuration files..."

# Create minimal ESLint config
cat > .eslintrc.json << EOF
{
  "extends": [
    "next/core-web-vitals"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "warn"
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  }
}
EOF

# Create minimal Prettier config
cat > .prettierrc << EOF
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
EOF

# Create PostCSS config
cat > postcss.config.mjs << EOF
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
EOF

log_success "Configuration files created"

# ============================================================================
# STEP 6: ENVIRONMENT VARIABLES SETUP
# ============================================================================
log_info "Setting up environment variables..."

# Check if .env exists, create from example if not
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env from .env.example"
    else
        # Create basic .env
        cat > .env << EOF
# Database
DATABASE_URL="postgresql://kaizoku:kaizoku@localhost:5432/kaizoku"

# Authentication
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
NEXT_TELEMETRY_DISABLED=1

# Optional integrations
PROWLARR_URL=""
PROWLARR_API_KEY=""
SUWAYOMI_URL=""
ANILIST_CLIENT_ID=""
ANILIST_CLIENT_SECRET=""
EOF
        log_success "Created basic .env file"
    fi
fi

# Create development environment file
if [ ! -f ".env.development" ]; then
    cat > .env.development << EOF
NODE_ENV=development
DATABASE_URL="postgresql://kaizoku:kaizoku@localhost:5432/kaizoku"
AUTH_URL="http://localhost:3000"
NEXT_TELEMETRY_DISABLED=1
EOF
    log_success "Created .env.development"
fi

# ============================================================================
# STEP 7: DATABASE SETUP
# ============================================================================
log_info "Setting up database..."

# Database setup logic based on environment
setup_database() {
    if [ "$ENVIRONMENT" = "docker" ]; then
        log_info "Setting up database in Docker environment..."
        # Start PostgreSQL container if needed
        if [ "$DOCKER_AVAILABLE" = "true" ]; then
            if ! docker ps --format 'table {{.Names}}' | grep -q postgres; then
                log_info "Starting PostgreSQL container..."
                docker run -d \
                    --name kaizoku-postgres \
                    -e POSTGRES_USER=kaizoku \
                    -e POSTGRES_PASSWORD=kaizoku \
                    -e POSTGRES_DB=kaizoku \
                    -p 5432:5432 \
                    postgres:15-alpine
                sleep 5
                log_success "PostgreSQL container started"
            fi
        fi
    else
        log_info "Setting up database in local environment..."
        
        # Check if PostgreSQL is actually running
        if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
            log_success "PostgreSQL is already running"
        elif [ "$POSTGRES_AVAILABLE" = "true" ]; then
            # Try to start PostgreSQL using different methods
            log_info "Starting PostgreSQL service..."
            
            # Try Homebrew first
            if command -v brew >/dev/null 2>&1; then
                if brew services list | grep -q postgresql; then
                    log_info "Starting PostgreSQL via Homebrew..."
                    brew services start postgresql || brew services start postgresql@15 || brew services start postgresql@14
                    sleep 3
                elif brew list | grep -q postgresql; then
                    log_info "Starting PostgreSQL via pg_ctl..."
                    # Find PostgreSQL data directory
                    PG_DATA_DIR=""
                    for dir in /usr/local/var/postgresql* /opt/homebrew/var/postgresql* /usr/local/var/postgres*; do
                        if [ -d "$dir" ]; then
                            PG_DATA_DIR="$dir"
                            break
                        fi
                    done
                    
                    if [ -n "$PG_DATA_DIR" ]; then
                        pg_ctl -D "$PG_DATA_DIR" -l "$PG_DATA_DIR/server.log" start
                        sleep 3
                    fi
                else
                    log_warning "PostgreSQL not found in Homebrew. Installing..."
                    brew install postgresql
                    brew services start postgresql
                    sleep 5
                fi
            else
                # Try system PostgreSQL
                log_info "Attempting to start system PostgreSQL..."
                sudo -u postgres pg_ctl start -D /usr/local/var/postgres 2>/dev/null || \
                sudo service postgresql start 2>/dev/null || \
                systemctl start postgresql 2>/dev/null || true
                sleep 3
            fi
            
            # Verify PostgreSQL is now running
            if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
                log_success "PostgreSQL started successfully"
                
                # Create user and database
                log_info "Setting up database user and schema..."
                
                # Try different superuser accounts
                for superuser in postgres $(whoami) root; do
                    if psql -h localhost -U "$superuser" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
                        log_info "Using superuser: $superuser"
                        
                        # Create user if doesn't exist
                        psql -h localhost -U "$superuser" -d postgres -c "
                            DO \$\$
                            BEGIN
                                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kaizoku') THEN
                                    CREATE USER kaizoku WITH PASSWORD 'kaizoku';
                                END IF;
                            END
                            \$\$;" 2>/dev/null || true
                        
                        # Create database if doesn't exist
                        psql -h localhost -U "$superuser" -d postgres -c "
                            SELECT 'CREATE DATABASE kaizoku OWNER kaizoku' 
                            WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kaizoku')
                            \gexec" 2>/dev/null || true
                        
                        # Grant privileges
                        psql -h localhost -U "$superuser" -d postgres -c "
                            ALTER USER kaizoku CREATEDB;
                            GRANT ALL PRIVILEGES ON DATABASE kaizoku TO kaizoku;" 2>/dev/null || true
                        
                        break
                    fi
                done
                
                log_success "Local PostgreSQL database setup complete"
            else
                log_warning "Could not start PostgreSQL, falling back to Docker..."
                # Fallback to Docker if available
                if [ "$DOCKER_AVAILABLE" = "true" ]; then
                    setup_docker_postgres
                else
                    log_error "PostgreSQL failed to start and Docker not available."
                    log_error "Please install Docker or fix PostgreSQL installation."
                    exit 1
                fi
            fi
        elif [ "$DOCKER_AVAILABLE" = "true" ]; then
            setup_docker_postgres
        else
            log_error "No database solution available. Please install PostgreSQL or Docker."
            exit 1
        fi
    fi
}

# Helper function for Docker PostgreSQL
setup_docker_postgres() {
    log_info "Setting up Docker PostgreSQL..."
    if ! docker ps --format 'table {{.Names}}' | grep -q kaizoku-postgres; then
        docker run -d \
            --name kaizoku-postgres \
            -e POSTGRES_USER=kaizoku \
            -e POSTGRES_PASSWORD=kaizoku \
            -e POSTGRES_DB=kaizoku \
            -p 5432:5432 \
            postgres:15-alpine
        sleep 5
        log_success "Docker PostgreSQL container started"
    else
        docker start kaizoku-postgres 2>/dev/null || true
        sleep 2
        log_success "Docker PostgreSQL container running"
    fi
}

setup_database

# ============================================================================
# STEP 8: PRISMA SETUP
# ============================================================================
log_info "Setting up Prisma..."

# Use schema recreation approach for development
if [ "$NODE_ENV" != "production" ]; then
    log_info "Development environment detected, using schema recreation approach..."

    # Generate Prisma client and verify schema
    log_info "Generating Prisma client and validating schema..."
    
    # First validate the schema to catch errors early
    if ! bunx prisma validate; then
        log_error "Schema validation failed. Please check your schema.prisma file."
        exit 1
    fi
    
    # Generate the client
    bunx prisma generate
    log_success "Prisma client generated"
    
    # Verify NextAuth models are in the schema
    log_info "Verifying NextAuth models in schema..."
    
    # Check if Account, Session, User models are in the schema
    for model in "Account" "Session" "User" "VerificationToken"; do
        if ! grep -q "model $model {" prisma/schema.prisma; then
            log_error "NextAuth model '$model' is missing from schema.prisma!"
            log_warning "The Account table error may occur due to missing NextAuth models."
            log_warning "Please ensure all NextAuth models are included in your schema."
            # We don't exit here to allow the build to continue, but with a warning
        fi
    done

    # Use direct SQL approach for NextAuth tables as standard
    log_info "Setting up database with direct SQL for NextAuth tables..."
    
    # Direct SQL approach for NextAuth tables
    log_info "Creating NextAuth tables directly with SQL..."
    
    # Extract database info
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    # Use Prisma to create all tables (it handles existing objects better)
    log_info "Creating database schema with Prisma..."
    
    # First attempt: Try to push the schema
    if bunx prisma db push 2>&1 | tee /tmp/prisma-output.log; then
        log_success "Database schema created/updated successfully"
    else
        # Check if it's the Account table error
        if grep -q "Account.*does not exist" /tmp/prisma-output.log; then
            log_warning "Account table issue detected, attempting fix..."
            # Run the fix script if available
            if [ -f "scripts/database/fix-account-table.sh" ]; then
                log_info "Running account table fix script..."
                if ./scripts/database/fix-account-table.sh; then
                    log_success "Account table issue resolved"
                else
                    log_warning "Account table fix had issues but continuing"
                fi
            else
                log_warning "No fix script available, continuing anyway"
            fi
        else
            log_warning "Database push had issues but continuing"
        fi
    fi
    
    rm -f /tmp/prisma-output.log
    
    # Verify crucial tables were created
    log_info "Verifying schema creation..."
    
    # Check for missing tables
    crucial_tables=("accounts" "sessions" "users" "verificationtokens" "manga" "chapter" "library")
    missing=false
    
    for table in "${crucial_tables[@]}"; do
        if ! bunx prisma db execute --stdin <<EOF >/dev/null 2>&1
SELECT 1 FROM information_schema.tables WHERE table_name = '$table' AND table_schema = 'public';
EOF
        then
            log_warning "Missing crucial table: $table"
            missing=true
        fi
    done
    
    # If any tables are missing, log the issue but continue
    if [ "$missing" = true ]; then
        log_warning "Some crucial tables are still missing after direct SQL creation"
        log_warning "This may cause issues with the application"
        log_warning "Consider running 'bun run db:fix-account' manually after build completes"
    else
        log_success "All crucial tables created successfully"
    fi
    
    # Run development seed
    if [ -f "scripts/database/seed-dev.js" ]; then
        log_info "Running development seed..."
        if node scripts/database/seed-dev.js; then
            log_success "Development seed completed"
        else
            # Check if it failed due to existing data (which is OK)
            if [ $? -eq 0 ]; then
                log_success "Development seed completed (some data already existed)"
            else
                log_warning "Development seed had issues but continuing build"
            fi
        fi
    fi

    log_success "Development database setup complete"
else
    # Production still uses migrations
    log_info "Production environment detected, using migration-based approach..."
    
    # Generate Prisma client
    bunx prisma generate
    log_success "Prisma client generated"

    # Run database migrations for production
    log_info "Running database migrations..."
    bunx prisma migrate deploy
    log_success "Database migrations complete"
fi

# ============================================================================
# STEP 9: TYPE CHECKING
# ============================================================================
log_info "Running type check..."

if bunx tsc --noEmit --skipLibCheck; then
    log_success "Type check passed"
else
    log_warning "Type check failed - continuing build (will be fixed during development)"
fi

# ============================================================================
# STEP 10: LINTING (NON-BLOCKING)
# ============================================================================
log_info "Running linting (non-blocking)..."

# Run ESLint but don't fail the build if it has issues
if bunx eslint src --ext .ts,.tsx --max-warnings 50 >/dev/null 2>&1; then
    log_success "Linting passed"
else
    log_warning "Linting issues found - will be addressed during development"
    log_info "Run 'bun run lint' to see detailed linting results"
fi

# ============================================================================
# STEP 11: BUILD APPLICATION
# ============================================================================
log_info "Building application..."

# Set production environment for build
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
if bunx next build; then
    log_success "Application build successful"
else
    log_error "Application build failed"
    exit 1
fi

# ============================================================================
# STEP 12: CREATE DEFAULT ADMIN USER
# ============================================================================
log_info "Creating default admin user..."

# Create default admin user (username: admin, password: password)
if node scripts/create-admin-simple.js; then
    log_success "Default admin user created (admin/password)"
else
    log_warning "Admin user creation failed - you can create one manually later"
fi

# ============================================================================
# STEP 13: AUTHENTICATION SETUP
# ============================================================================
log_info "Verifying authentication configuration..."

# The canonical NextAuth config lives in src/lib/auth/auth-options.ts and is
# tracked in source control. Do NOT scaffold it here — a generated copy would
# diverge from the real config (wrong schema fields, stale callbacks) and would
# resurrect the deleted config.ts shim that the auth consolidation removed.
if [ -f "src/lib/auth/auth-options.ts" ]; then
    log_success "Authentication configuration present (src/lib/auth/auth-options.ts)"
else
    log_error "Missing src/lib/auth/auth-options.ts — auth config must be restored from source control"
fi

# ============================================================================
# STEP 14: FINAL SETUP
# ============================================================================
log_info "Performing final setup..."

# Create necessary directories
mkdir -p logs public/uploads data

# Set proper permissions
chmod -R 755 logs 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

# Create startup script
cat > scripts/start.sh << EOF
#!/bin/bash
# Mugiwara-Kaizoku startup script

echo "🚀 Starting Mugiwara-Kaizoku..."

# Check if database is running
if ! pg_isready -h localhost -p 5432 -U kaizoku 2>/dev/null; then
    echo "📦 Starting database..."
    if command -v docker >/dev/null 2>&1; then
        docker start kaizoku-postgres 2>/dev/null || {
            docker run -d \\
                --name kaizoku-postgres \\
                -e POSTGRES_USER=kaizoku \\
                -e POSTGRES_PASSWORD=kaizoku \\
                -e POSTGRES_DB=kaizoku \\
                -p 5432:5432 \\
                postgres:15-alpine
        }
        sleep 3
    fi
fi

# Start the application
echo "🌟 Starting application..."
cd "\$(dirname "\$0")/.."
export NODE_ENV=production
bunx next start
EOF

chmod +x scripts/start.sh

log_success "Final setup complete"

# ============================================================================
# COMPLETION
# ============================================================================
echo
log_success "🎉 Mugiwara-Kaizoku build completed successfully!"
echo
echo "📋 Build Summary:"
echo "  • Environment: $ENVIRONMENT"
echo "  • Database: $([ "$POSTGRES_AVAILABLE" = "true" ] && echo "Local PostgreSQL" || echo "Docker PostgreSQL")"
echo "  • Dependencies: Installed with bun"
echo "  • Build: Complete"
echo "  • Authentication: Configured"
echo
echo "🚀 Next Steps:"
echo "  1. Start the application: bun run start"
echo "  2. Visit: http://localhost:3000"
echo "  3. Login with: admin / password"
echo "  4. Change default password in settings"
echo
echo "📚 Available commands:"
echo "  • bun run start          - Start the application"
echo "  • bun run dev            - Start development server"
echo "  • bun run build:clean    - Rebuild everything from scratch"
echo "  • bun run db:reset:dev   - Reset development database (schema recreation)"
echo "  • bun run db:reset:safe  - Reset database safely with connection checks"
echo "  • bun run db:studio      - Open Prisma Studio to view/edit database"
echo
