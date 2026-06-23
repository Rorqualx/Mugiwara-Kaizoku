# Mugiwara-Kaizoku Startup Commands

## Understanding Environment Modes

The application can run in two modes:
- **Development** (`NODE_ENV=development`): More verbose logging, development features enabled
- **Production** (`NODE_ENV=production`): Optimized for performance, production logging

## Available Startup Commands

### For Production Use
```bash
bun run start:prod
```
- Forces `NODE_ENV=production`
- Uses `.env.production` if available, falls back to `.env`
- Runs the standalone build
- **Recommended for production deployments**

### For Development Use
```bash
bun run dev
```
- Runs in development mode with hot reloading
- Uses `dev-integrated.sh` (starts PostgreSQL, Prisma, FlareSolverr, Suwayomi, and Next.js)
- **Recommended for active development**

### Generic Start
```bash
bun run start
```
- Forces `NODE_ENV=production` and runs `bun src/server/index.ts` directly
- Uses environment settings from `.env` file

## Environment Files

### `.env` (Development)
- Contains `NODE_ENV=development`
- Used by default for local development
- Contains development secrets and settings

### `.env.production` (Production)
- Contains `NODE_ENV=production`
- Used when running `bun run start:prod`
- Should contain production-safe values

## Why Different Commands?

1. **Security**: Production shouldn't use development secrets
2. **Performance**: Production mode enables optimizations
3. **Logging**: Different log levels for each environment
4. **Features**: Some features may be dev-only or prod-only

## Best Practices

1. **Local Development**: Use `bun run dev`
2. **Testing Production Build Locally**: Use `bun run start:prod`
3. **Production Server**: Use `bun run start:prod` with proper `.env.production`

## Troubleshooting

If you see `NODE_ENV=development` when expecting production:
1. Check which command you're using
2. Use `bun run start:prod` to force production mode
3. Verify `.env.production` exists and has `NODE_ENV=production`
