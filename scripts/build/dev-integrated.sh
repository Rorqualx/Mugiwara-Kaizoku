#!/bin/bash
set -e

# Mugiwara-Kaizoku Development Server Starter
# This script starts the development environment with all necessary components
# Now includes smart database error detection and auto-repair

# Cleanup function to stop services when script exits
cleanup() {
    echo -e "\033[0;31m🛑 Stopping development environment...\033[0m"
    # Kill any Suwayomi processes
    pkill -f "Suwayomi-Server.jar" 2>/dev/null || true
    # Kill FlareSolverr on port 8191
    echo -e "\033[0;34mℹ️  Stopping FlareSolverr...\033[0m"
    lsof -ti:8191 2>/dev/null | xargs kill -9 2>/dev/null || true
    # Clean up FlareSolverr PID file
    rm -f .flaresolverr.pid 2>/dev/null || true
    # Kill any node dev processes from this script
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null || true
    fi
    exit
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Error patterns to detect database schema issues
TABLE_PATTERN="table .* does not exist"
COLUMN_PATTERN="column .* does not exist"
MISSING_RELATION="relation .* does not exist"
ACCOUNT_TABLE_ERROR="The underlying table for model \`Account\` does not exist"
PERMISSION_ERROR="permission denied for schema public"

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Detect if auto-repair script exists
AUTO_REPAIR_AVAILABLE=false
if [ -f "scripts/database/auto-repair.sh" ]; then
    AUTO_REPAIR_AVAILABLE=true
    log_info "Smart database repair is available"
fi

# Smart error handling
handle_error() {
    local step="$1"
    local error_output="$2"
    
    log_error "Development server failed at step: $step"
    
    # Check for permission error
    if echo "$error_output" | grep -q "$PERMISSION_ERROR"; then
        log_warning "PostgreSQL permission error detected. Attempting to fix permissions..."
        
        # Check if permissions fix script exists
        if [ -f "scripts/database/fix-postgres-permissions.sh" ]; then
            log_info "Running PostgreSQL permissions fix script..."
            if ./scripts/database/fix-postgres-permissions.sh; then
                log_success "Permissions fixed successfully! Continuing..."
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
            log_success "Auto-repair successful! Continuing..."
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

log_info "Starting Mugiwara-Kaizoku development environment..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_warning "Dependencies not found. Installing..."
    run_with_error_capture "Install Dependencies" "bun install"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env from .env.example"
    else
        log_warning ".env file not found. Creating basic one..."
        cat > .env << EOF
DATABASE_URL=postgresql://kaizoku:kaizoku@localhost:5432/kaizoku
AUTH_SECRET=developmentsecret123
NEXTAUTH_SECRET=developmentsecret123
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
EOF
        log_success "Created basic .env file"
    fi
fi

# Export .env variables so Prisma and other tools can access them
set -a
source .env
set +a

# Check database connection
log_info "Checking database connection..."

# Function to start database if needed
start_database() {
    log_info "Checking database connection..."
    
    # Check if PostgreSQL is already running
    if pg_isready -h localhost -p 5432 -U kaizoku >/dev/null 2>&1; then
        log_success "PostgreSQL is running and accessible"
        return 0
    fi
    
    # Check if we have PostgreSQL available locally
    if command -v psql >/dev/null 2>&1; then
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
        fi
        
        # Verify PostgreSQL is now running
        if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
            log_success "PostgreSQL started successfully"
            
            # Ensure kaizoku user and database exist
            for superuser in postgres $(whoami) root; do
                if psql -h localhost -U "$superuser" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
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
            return 0
        fi
    fi
    
    # Fallback to Docker if PostgreSQL couldn't be started locally
    if command -v docker >/dev/null 2>&1; then
        log_info "Falling back to PostgreSQL with Docker..."
        
        # Check if container already exists
        if docker ps -a --format '{{.Names}}' | grep -q kaizoku-postgres; then
            log_info "Starting existing PostgreSQL container..."
            docker start kaizoku-postgres
        else
            log_info "Creating new PostgreSQL container..."
            docker run -d \
                --name kaizoku-postgres \
                -e POSTGRES_USER=kaizoku \
                -e POSTGRES_PASSWORD=kaizoku \
                -e POSTGRES_DB=kaizoku \
                -p 5432:5432 \
                postgres:15-alpine
        fi
        sleep 3
        log_success "PostgreSQL container started"
        return 0
    fi
    
    log_warning "Could not start PostgreSQL locally or with Docker"
    log_info "Please install PostgreSQL or Docker, or manually start PostgreSQL"
    log_info "You can also continue - the app will show setup instructions"
}

start_database

# Generate Prisma client if needed
if [ ! -d "node_modules/.prisma" ]; then
    log_info "Generating Prisma client..."
    run_with_error_capture "Generate Prisma" "bunx prisma generate"
    log_success "Prisma client generated"
fi

# Database setup for development using schema recreation approach
log_info "Setting up development database..."

# Use direct SQL approach for NextAuth tables first
log_info "Creating NextAuth tables with direct SQL..."
bunx prisma db execute --stdin <<EOF
-- Set schema to public
SET search_path TO public;

-- Create User table
CREATE TABLE IF NOT EXISTS public."users" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "emailVerified" TIMESTAMP(3),
  "image" TEXT,
  "userName" TEXT NOT NULL,
  "hashedPassword" TEXT NOT NULL,
  "avatar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes for User
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON public."users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_userName_key" ON public."users"("userName");

-- Create Session table
CREATE TABLE IF NOT EXISTS public."sessions" (
  "id" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Create unique index for Session
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON public."sessions"("sessionToken");

-- Create Account table
CREATE TABLE IF NOT EXISTS public."accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- Create unique index for Account
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON public."accounts"("provider", "providerAccountId");

-- Create VerificationToken table
CREATE TABLE IF NOT EXISTS public."verificationtokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

-- Create unique indexes for VerificationToken
CREATE UNIQUE INDEX IF NOT EXISTS "verificationtokens_token_key" ON public."verificationtokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verificationtokens_identifier_token_key" ON public."verificationtokens"("identifier", "token");

-- Add foreign key references (only if they don't exist)
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_userId_fkey') THEN
        ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_userId_fkey') THEN
        ALTER TABLE public."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END \$\$;
EOF

# Run schema push for development with smart error detection
log_info "Pushing schema to database..."
run_with_error_capture "Prisma Push" "bunx prisma db push --accept-data-loss"

# Apply UNLOGGED cache tables after schema push
# These tables are not tracked in schema.prisma and get dropped by db push
log_info "Applying UNLOGGED cache tables..."
if [ -f "scripts/database/apply-unlogged-tables.sh" ]; then
    ./scripts/database/apply-unlogged-tables.sh || log_warning "Could not apply UNLOGGED tables (non-critical)"
else
    log_warning "UNLOGGED tables script not found - hot cache will use fallback"
fi

# Check if we need to run seed script
USER_COUNT=$(bunx prisma query 'SELECT COUNT(*) FROM "users"' 2>/dev/null | grep -oE '[0-9]+' || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    log_info "Running development seed script..."
    if [ -f "scripts/database/seed-dev.js" ]; then
        run_with_error_capture "Seed Database" "bun scripts/database/seed-dev.js"
    fi
fi

log_success "Development database is ready"

# Set development environment
export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1

# ============================================================================
# FLARESOLVERR STARTUP (optional Cloudflare bypass)
# ============================================================================
# FlareSolverr provides Cloudflare bypass for scraping protected sites.
# Without it, some metadata sources (like ComicVine) may not work.

if [ "${FLARESOLVERR_ENABLED:-true}" = "true" ]; then
    log_info "FlareSolverr enabled - binary will be auto-downloaded at server startup"

    # Check if there's already an accessible instance
    FLARESOLVERR_URL="${FLARESOLVERR_URL:-http://localhost:8191/v1}"
    # Strip /v1 suffix if present for health check
    FLARESOLVERR_BASE_URL=$(echo "$FLARESOLVERR_URL" | sed 's|/v1$||')

    if curl -s "${FLARESOLVERR_BASE_URL}/health" 2>/dev/null | grep -q '"status"'; then
        log_success "FlareSolverr is already available at ${FLARESOLVERR_BASE_URL}"
    elif curl -s -X POST "${FLARESOLVERR_URL}" -H "Content-Type: application/json" -d '{"cmd":"sessions.list"}' 2>/dev/null | grep -q '"status":"ok"'; then
        log_success "FlareSolverr is already available at ${FLARESOLVERR_URL}"
    else
        log_info "FlareSolverr not running - will be available via Settings > FlareSolverr"
    fi
else
    log_info "FlareSolverr is disabled (FLARESOLVERR_ENABLED=false)"
fi

# ============================================================================
# SUWAYOMI STARTUP (check if available and enabled in settings)
# ============================================================================
# Add Java 21 to PATH if available
if [ -d "/usr/local/opt/openjdk@21/bin" ]; then
    export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
    export JAVA_HOME="/usr/local/opt/openjdk@21"
    log_info "Using Java 21 from Homebrew (Intel Mac)"
elif [ -d "/opt/homebrew/opt/openjdk@21/bin" ]; then
    export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
    log_info "Using Java 21 from Homebrew (Apple Silicon)"
fi

# Check if Suwayomi is enabled in application settings
log_info "Checking Suwayomi settings..."
SUWAYOMI_ENABLED=$(bun scripts/check-setting.js suwayomiEnabled 2>/dev/null || echo "false")

# Check if Suwayomi JAR exists and Java is available
SUWAYOMI_JAR="data/suwayomi-server/Suwayomi-Server.jar"
if [ "$SUWAYOMI_ENABLED" = "true" ] && [ -f "$SUWAYOMI_JAR" ] && command -v java >/dev/null 2>&1; then
    log_info "Suwayomi is enabled. Starting server..."
    
    # Check if Suwayomi is already running
    if ! lsof -i:4567 >/dev/null 2>&1; then
        # Start Suwayomi in background
        log_info "Starting Suwayomi server on port 4567..."
        
        # Create logs directory if it doesn't exist
        mkdir -p logs
        
        # Start Suwayomi with proper configuration
        nohup java -jar "$SUWAYOMI_JAR" \
            -Dsuwayomi.tachidesk.config.server.rootDir=data/suwayomi-config \
            -Dsuwayomi.tachidesk.config.server.port=4567 \
            -Dsuwayomi.tachidesk.config.server.webUIEnabled=false \
            -Dsuwayomi.tachidesk.config.server.webUIInterface=0.0.0.0 \
            -Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false \
            -Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false \
            -Djava.awt.headless=true \
            > logs/suwayomi-dev.log 2>&1 &
        
        SUWAYOMI_PID=$!
        echo $SUWAYOMI_PID > .suwayomi-dev.pid
        
        # Wait for Suwayomi to start
        sleep 5
        
        # Check if Suwayomi started successfully
        if lsof -i:4567 >/dev/null 2>&1; then
            log_success "Suwayomi server started (PID: $SUWAYOMI_PID)"
            log_info "Suwayomi UI available at: http://localhost:4567"
        else
            log_warning "Suwayomi failed to start. Check logs/suwayomi-dev.log for details"
        fi
    else
        log_info "Suwayomi is already running"
    fi
else
    if [ "$SUWAYOMI_ENABLED" != "true" ]; then
        log_info "Suwayomi is disabled in application settings"
        log_info "Enable it in Settings > Integrations to use Suwayomi"
    elif [ ! -f "$SUWAYOMI_JAR" ]; then
        log_info "Suwayomi not installed. Run 'bun install:suwayomi' to install"
    elif ! command -v java >/dev/null 2>&1; then
        log_warning "Java not found. Install Java 11+ to use Suwayomi integration"
    fi
fi

# Note: cleanup function is already defined at the top of the file

# Start the development server
log_success "Starting Next.js development server..."
echo
log_info "🌟 Mugiwara-Kaizoku will be available at:"
log_info "   Local:    http://localhost:3000"
log_info "   Network:  http://0.0.0.0:3000"
if lsof -i:4567 >/dev/null 2>&1; then
    log_info "   Suwayomi: http://localhost:4567"
fi
echo
log_info "💡 Tips:"
log_info "   • Create an admin user with 'bun run create-admin'"
log_info "   • Reset database with 'bun run db:reset:dev'"
log_info "   • View database with 'bun run db:studio'"
if [ ! -f "data/suwayomi-server/Suwayomi-Server.jar" ]; then
    log_info "   • Install Suwayomi with 'bun install:suwayomi'"
fi
echo

# Start unified server with all backend services + WebSocket support
NODE_ENV=development bun src/server/index.ts &
DEV_PID=$!
echo "Development server started with PID: $DEV_PID"

# Wait for the dev server to finish
wait $DEV_PID