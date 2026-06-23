# Mugiwara-Kaizoku Startup Commands

## Understanding Environment Modes

The application can run in two modes:
- **Development** (`NODE_ENV=development`): More verbose logging, development features enabled
- **Production** (`NODE_ENV=production`): Optimized for performance, production logging

## Available Startup Commands

### For Production Use
```bash
bun run start:production
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
- Uses nodemon for auto-restart
- **Recommended for active development**

```bash
bun run start:dev
```
- Forces `NODE_ENV=development`
- Runs the standalone build (if available)
- Useful for testing the production build in development mode

### Generic Start
```bash
bun run start
```
- Uses environment settings from `.env` file
- Runs the standalone build (if available)
- Falls back to `next start` with a warning

## Environment Files

### `.env` (Development)
- Contains `NODE_ENV=development`
- Used by default for local development
- Contains development secrets and settings

### `.env.production` (Production)
- Contains `NODE_ENV=production`
- Used when running `bun run start:production`
- Should contain production-safe values

## Why Different Commands?

1. **Security**: Production shouldn't use development secrets
2. **Performance**: Production mode enables optimizations
3. **Logging**: Different log levels for each environment
4. **Features**: Some features may be dev-only or prod-only

## Best Practices

1. **Local Development**: Use `bun run dev`
2. **Testing Production Build Locally**: Use `bun run start:production`
3. **Production Server**: Use `bun run start:production` with proper `.env.production`

## Troubleshooting

If you see `NODE_ENV=development` when expecting production:
1. Check which command you're using
2. Use `bun run start:production` to force production mode
3. Verify `.env.production` exists and has `NODE_ENV=production`
