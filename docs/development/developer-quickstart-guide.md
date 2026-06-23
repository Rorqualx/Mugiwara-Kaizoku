# Developer Quickstart Guide

This guide will help you get started with the Mugiwara-Kaizoku project quickly as a new developer.

## 1. Project Overview

Mugiwara-Kaizoku is a self-hosted manga downloader and management application. It provides:

- Manga searching and metadata collection from multiple sources
- Chapter downloading via various providers
- Library management for your manga collection
- Cross-provider metadata enrichment
- Integration with external services like Suwayomi and Prowlarr

The application is built with Next.js, TypeScript, and PostgreSQL, following a structured architecture with well-defined patterns.

## 2. Environment Setup

### Prerequisites

- Node.js 20+ (as specified in package.json engines)
- Bun 1.3+ (required; other package managers are not supported)
- Docker (for database and development environment)
- Java 21+ (for the bundled Suwayomi engine)

### First-Time Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Rorqualx/Mugiwara-Kaizoku.git
   cd Mugiwara-Kaizoku
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env` file in the project root:
   ```
   # Application settings
   KAIZOKU_PORT=3000
   NODE_ENV=development

   # Database settings
   DATABASE_URL="postgresql://kaizoku:kaizoku@localhost:5432/kaizoku"

   # NextAuth settings (generate secrets with: openssl rand -base64 32)
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=
   AUTH_SECRET=

   # Optional: Suwayomi integration status
   DISABLE_SUWAYOMI=true  # Set to false if you have Java 21+ installed
   ```

4. After starting the application for the first time, create an admin user:
   ```bash
   bun run create-admin
   ```

## 3. Running the Application

### Development

Start the development server (includes database setup):
```bash
bun run dev
```

This will automatically:
- Set up a PostgreSQL database (using Docker if available)
- Run necessary migrations
- Start the Next.js development server

The application will be available at [http://localhost:3000](http://localhost:3000).

### Alternative Start Commands

```bash
# Start without using Docker
bun run dev:no-docker

# Start with an existing database (skip setup)
bun run dev:skip-db

# Production build and start
bun run build
bun run start
```

### Troubleshooting

If you encounter build issues:

```bash
# Clean build artifacts
bun run clean

# Deep clean (caches, logs, build artifacts)
bun run deep-clean

# Full reset (everything including node_modules)
bun run reset
```

For database issues:

```bash
# Reset the database (completely deletes and recreates it)
bun run reset:db

# For macOS users (recommended and most reliable on macOS)
bun run reset:db:mac

# Reset the database with local PostgreSQL
bun run reset:db:local
```

## 4. Codebase Structure

The project follows a clear directory structure:

- **Server**: `src/server/` - Server-side code (tRPC routers, services, queue, startup)
  - **tRPC routers**: `src/server/trpc/routers/`
  - **Services**: `src/server/services/` - external integrations (mangadex, comicvine, fandom, prowlarr, download, native-download, suwayomi, …)
  - **Adapters**: `src/server/adapters/` (+ `src/server/parsers/adapters/`) - provider adapters, registered via `AdapterFactory`
- **React Components**: `src/components/` - UI components
- **React Hooks**: `src/hooks/` - custom hooks for state management and data fetching
- **Types**: `src/types/` - TypeScript type definitions (`domain/`, `adapters/`, `api/`)
- **Utils**: `src/utils/` - utilities (`async-result/`, `validation/`, `id-converters.ts`, …)
- **Store**: `src/store/` - global state management (Zustand)
- **Pages**: `src/pages/` - Next.js page + API-route components

## 5. Key Architectural Patterns

The project uses several architectural patterns that you should understand:

### Adapter Pattern

Used for external integrations to standardize API communications. Adapters provide a consistent interface for different external APIs.

Example: `src/server/adapters/unified-anilist-adapter.ts`

[Learn more in the Adapter Pattern Guide](../adapters-clients/integration-adapter-pattern.md)

### AsyncResult Pattern

Used for handling asynchronous operations with typed results. This pattern provides type-safe success/error handling.

Example: `src/utils/async-result/`

Basic pattern:
```typescript
type AsyncResult<T, E> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: E }
  | { status: 'loading' }
  | { status: 'idle' };
```

Learn more in the AsyncResult Best Practices Guide

### Container/Presenter Pattern

Used for UI component separation of concerns. Container components handle state and data fetching, while presenter components focus on rendering and UI.

Example: `src/components/addManga/steps/searchStep.tsx`

### Factory Pattern

Used for creating client instances with proper configuration. Factory functions encapsulate creation logic and ensure proper initialization.

Example: `src/server/services/comicvine/service.ts` (createComicVineClient function)

## 6. Development Workflow

### Git Workflow

1. Create a feature or fix branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. Make your changes, following the project's architectural patterns and coding standards

3. Run type checking before committing:
   ```bash
   npm run type-check
   ```

4. Commit your changes with descriptive messages:
   ```bash
   git commit -m "Descriptive message about what changed and why"
   ```

5. Push your branch and create a pull request against `main`

6. Wait for code review and address any feedback

### Pull Request Guidelines

When creating a pull request:

1. Use a clear, descriptive title
2. Include a summary of the changes
3. Explain the approach taken
4. Include a test plan
5. List any documentation updates
6. Mention related issues or PRs

[See an example PR template](./pull-request-template.md)

## 7. Common Development Tasks

### Adding a New Metadata Provider

1. Create a new client in `src/server/services/providers/`
2. Create a new adapter in `src/server/adapters/`
3. Register the provider in `src/server/adapters/AdapterFactory.ts`
4. Add types in `src/types/adapters/`
5. Add UI components for configuration in `src/components/settings/`

### Adding a New Component

1. Create the component in the appropriate directory under `src/components/`
2. Define prop types using TypeScript interfaces
3. Follow the Container/Presenter pattern for complex components
4. Use custom hooks for data fetching and state management
5. Add error handling using the AsyncResult pattern

### Working with the Database

The project uses Prisma ORM for database access:

1. Update the schema in `prisma/schema.prisma`
2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
3. Create migrations:
   ```bash
   npx prisma migrate dev --name descriptive-migration-name
   ```

## 8. Troubleshooting

### Common Issues

#### Database Migration Errors

The project currently has issues with the `remove_legacy_settings` migration. If you encounter this error:

1. Use a clean database for development (postgres with empty schema)
2. Skip the failing migration if possible
3. Focus on TypeScript and code improvements, not database changes

#### Authentication Issues

If you encounter authentication problems:

1. Ensure `NEXTAUTH_URL` is set correctly in your `.env` file
2. Do not use `0.0.0.0` in `NEXTAUTH_URL` - use `localhost` or your actual IP address
3. Check that `NEXTAUTH_SECRET` is set
4. Try creating a new admin user with `bun run create-admin`

See Authentication Guide for more details.

#### Build Issues

If the build process fails:

1. Make sure you're using bun run (not npm or yarn)
2. Run `bun run clean` to remove build artifacts
3. Check for TypeScript errors with `npm run type-check`
4. Ensure all dependencies are installed with `bun install`

### Getting Help

If you're stuck:

1. Check the documentation in the `docs/` directory
2. Look for similar issues in the project's issue tracker
3. Review the code comments and JSDoc documentation

## 9. Additional Resources

- AsyncResult Pattern Best Practices
- [TypeScript Patterns Reference](../typescript/typescript-patterns.md)
- [Integration Adapter Pattern](../adapters-clients/integration-adapter-pattern.md)
- [Type Safety Guidelines](../typescript/typescript-cheat-sheet.md)
- Authentication Guide
- [Code Comments Style Guide](./code-comments-style-guide.md)
- [Environment Variables Guide](../configuration/environment-variables.md)
- [Suwayomi Setup Guide](../user-guides/suwayomi-setup.md)
- Build System Documentation