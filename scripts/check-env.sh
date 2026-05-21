#!/bin/bash
# Show which environment configuration will be used

echo "🔍 Mugiwara-Kaizoku Environment Configuration Check"
echo "=================================================="
echo ""

# Function to check environment
check_env() {
    local cmd=$1
    local desc=$2
    echo "Command: $cmd"
    echo "Description: $desc"
    
    # Simulate what would happen
    if [[ $cmd == *"production"* ]]; then
        echo "Would use: NODE_ENV=production (forced)"
        if [ -f ".env.production" ]; then
            echo "Env file: .env.production ✅"
        else
            echo "Env file: .env (with NODE_ENV override) ⚠️"
        fi
    elif [[ $cmd == *"dev"* ]] && [[ $cmd != *"bun run dev"* ]]; then
        echo "Would use: NODE_ENV=development (forced)"
        echo "Env file: .env ✅"
    else
        if [ -f ".env" ]; then
            NODE_ENV_VALUE=$(grep "^NODE_ENV=" .env | cut -d'=' -f2)
            echo "Would use: NODE_ENV=$NODE_ENV_VALUE (from .env)"
            echo "Env file: .env"
        else
            echo "Would use: NODE_ENV=production (default)"
            echo "Env file: none"
        fi
    fi
    echo "---"
    echo ""
}

# Check each command
check_env "bun run start" "Generic start - uses .env settings"
check_env "bun run start:production" "Production start - forces production mode"
check_env "bun run start:dev" "Development start - forces development mode"
check_env "bun run dev" "Development with hot reload"

echo "Current .env files:"
echo "-------------------"
if [ -f ".env" ]; then
    echo "✅ .env exists"
    grep "^NODE_ENV=" .env || echo "   No NODE_ENV setting"
fi

if [ -f ".env.production" ]; then
    echo "✅ .env.production exists"
    grep "^NODE_ENV=" .env.production || echo "   No NODE_ENV setting"
else
    echo "❌ .env.production missing"
fi

echo ""
echo "💡 Recommendation:"
echo "  - For production deployments: Use 'bun run start:production'"
echo "  - For development: Use 'bun run dev'"
echo "  - Create .env.production with production settings"
