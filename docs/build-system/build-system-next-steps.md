# Build System Next Steps

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Build System Next Steps

---
# Build System - Next Steps

## Overview

This document outlines the next steps for fully fixing the build system in the Mugiwara-Kaizoku project. While we've made significant progress by removing the transpiled JavaScript files that were causing import errors, there are still some remaining issues to address.

## Current Status

✅ **Completed**:
- Removed 695 transpiled JavaScript files and 687 source map files
- Created a simplified build script for testing purposes
- Updated .gitignore to prevent transpiled files from being committed
- Documented the JavaScript to TypeScript migration
- Created mock components for some problematic imports

❌ **Remaining Issues**:
- Missing mock components referenced in the codebase
- TypeScript type errors in task pages
- Dependency on simplified build script rather than standard Next.js build

## Action Plan

### 1. Create Missing Mock Components

Create the following mock components that are referenced in the codebase:

- `src/components/system/SourceTester.mock.tsx`
- `src/components/settings/downloadClients/ClientSettings.mock.tsx`
- `src/components/settings/downloadClients/DownloadDashboard.mock.tsx`
- `src/components/settings/EventSettings.mock.tsx`
- `src/components/settings/NotificationSettings.mock.tsx`
- `src/components/settings/IntegrationSettings.mock.tsx`
- `src/components/settings/DownloadSettings.mock.tsx`
- `src/components/settings/FileOrganizationSettings.mock.tsx`
- `src/components/settings/MetadataProvidersGrid.mock.tsx`
- `src/components/settings/DefaultMetadataProvider.mock.tsx`
- `src/components/system/LogViewer.mock.tsx`
- `src/components/system/StatusContent.mock.tsx`
- `src/components/tasks/TaskList.mock.tsx`

Each mock component should:
- Import only from React and other non-problematic modules
- Provide a minimal implementation that satisfies the component's interface
- Include proper TypeScript types for props and return values
- Be as simple as possible to avoid introducing new dependencies

### 2. Fix TypeScript Type Issues

Address the TypeScript type errors in the following files:

- `src/pages/tasks/failed.tsx` - Add explicit type annotation for parameter `id`
- `src/pages/tasks/queued.tsx` - Add explicit type annotation for parameter `id`
- `src/pages/tasks/scheduled.tsx` - Add explicit type annotation for parameter `id`

Example fix:
```typescript
// Before
const handleDelete = (id) => {
  // Implementation
};

// After
const handleDelete = (id: string) => {
  // Implementation
};
```

### 3. Update Webpack Configuration

Modify `next.config.mjs` to correctly alias the mock components:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Add aliases for all mock components
        './components/system/SourceTester': './components/system/SourceTester.mock',
        './components/settings/downloadClients/ClientSettings': './components/settings/downloadClients/ClientSettings.mock',
        // ... add other aliases
      };
    }
    return config;
  },
};
```

### 4. Restore Standard TypeScript Checking

Replace the mock TypeScript checking with the standard checking:

1. Create a new script in package.json:
```json
"scripts": {
  "type-check": "tsc --noEmit",
  "type-check:watch": "tsc --noEmit --watch",
  "type-check:mock": "node scripts/mock-type-check.js"
}
```

2. Update build scripts to use standard TypeScript checking:
```json
"scripts": {
  "prebuild": "npm run type-check",
  "build": "next build"
}
```

### 5. Test Standard Next.js Build

After implementing the above changes, test the standard Next.js build:

```bash
npm run build
```

If the build fails, analyze the errors and address them iteratively until the build succeeds.

### 6. Long-Term Improvements

Once the build is working properly, consider these long-term improvements:

1. **Component Standardization**:
   - Convert all mock components to real, properly implemented components
   - Standardize component patterns and interfaces

2. **Type System Enhancement**:
   - Improve type definitions throughout the codebase
   - Eliminate any remaining `any` types or type assertions

3. **Build Process Optimization**:
   - Optimize the build process for faster builds
   - Implement proper code splitting and tree shaking

4. **Testing Infrastructure**:
   - Add comprehensive tests for components and utilities
   - Implement CI/CD pipeline for automated testing

## Timeline and Priority

1. **High Priority** (Immediate):
   - Create missing mock components
   - Fix TypeScript type issues in task pages

2. **Medium Priority** (Next Week):
   - Update webpack configuration
   - Restore standard TypeScript checking
   - Test standard Next.js build

3. **Low Priority** (Future):
   - Implement long-term improvements
   - Convert mock components to real components
   - Enhance type system
   - Optimize build process
   - Improve testing infrastructure

## Conclusion

By following this action plan, we can fully restore the standard Next.js build process and eliminate the dependency on the simplified build script. This will result in a more maintainable and robust build system for the Mugiwara-Kaizoku project.

The cleanup of JavaScript files has already made significant progress by removing the root cause of many import errors. The next steps focus on addressing the remaining issues to achieve a fully functional and reliable build system.