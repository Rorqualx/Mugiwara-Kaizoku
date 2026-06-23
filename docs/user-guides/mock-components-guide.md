# Mock Components Guide for Build Process

This document describes the mock components created to facilitate the build process of the Mugiwara-Kaizoku application.

## Overview

The application uses several complex components that have dependencies on external services, native modules, or complex browser APIs. To allow for successful builds, especially in CI/CD environments, mock versions of these components have been created.

## List of Mock Components

The following mock components have been created to aid the build process:

1. **Settings Components**
   - `src/test/mocks/components/settings/EventSettings.mock.tsx`
   - `src/test/mocks/components/settings/NotificationSettings.mock.tsx`
   - `src/test/mocks/components/settings/DownloadSettings.mock.tsx`
   - `src/test/mocks/components/settings/FileOrganizationSettings.mock.tsx`
   - `src/test/mocks/components/settings/MetadataProvidersGrid.mock.tsx`
   - `src/test/mocks/components/settings/DefaultMetadataProvider.mock.tsx`

2. **System Components**
   - `src/components/system/StatusContent.mock.tsx`
   - `src/test/mocks/components/system/StatusContent.mock.tsx`

3. **Task Components**
   - `src/test/mocks/components/tasks/TaskList.mock.tsx`
   - `src/test/mocks/components/tasks/TaskNav.mock.tsx`

4. **Auth Configuration**
   - `src/lib/auth/config.mock.ts` (avoids bcrypt native dependencies)

## How to Use

### Building with Mock Components

To build the application, the mock components under `src/test/mocks/` and `src/components/system/` are used automatically. The mock auth configuration (`src/lib/auth/config.mock.ts`) avoids bcrypt native dependencies during builds.

Refer to `scripts/build/build-clean.sh` and `scripts/build/dev-integrated.sh` for the available build helpers.

## Implementation Details

### Mock Component Structure

Each mock component follows a similar pattern:

```tsx
/**
 * Mock implementation of ComponentName for build compatibility
 */
import React from 'react';

export function ComponentName(props) {
  return <div data-testid="component-name">Mock ComponentName</div>;
}
```

These simplified implementations allow the build process to complete without requiring complex dependencies or native modules.

### Auth Configuration

The mock auth configuration avoids the use of bcrypt, which requires native compilation. It provides:

- A mock PrismaAdapter
- Simplified auth callbacks
- A dummy authorize function

### Development Server

For local development, use the integrated dev server script at `scripts/build/dev-integrated.sh`, which starts the application on HTTP port 3000.

## Troubleshooting

If you encounter issues with the build process:

1. **Missing Mock Component**:
   - Check if a component is imported in pages but doesn't have a mock version
   - Create a simple mock following the pattern above

2. **Native Module Errors**:
   - Look for direct dependencies on modules like bcrypt, sharp, etc.
   - Create mock versions or use dynamic imports with fallbacks

3. **Server Startup Issues**:
   - Ensure PostgreSQL is running
   - Check that all required database migrations have been applied

## Contributing

When adding new components that have complex dependencies:

1. Create a standard implementation in the appropriate directory
2. Create a mock version with the `.mock.tsx` suffix
3. Update import statements to use the mock version during builds
4. Document the mock in this guide

## Future Improvements

Potential improvements to the build process:

1. **Automated Mock Generation**: Create a script to auto-generate mocks for components
2. **Webpack Aliases**: Configure webpack to automatically use mock versions during builds
3. **Test Coverage**: Add tests specifically for mock components to ensure build compatibility
4. **Docker Build Environment**: Create a standardized Docker build environment with all dependencies