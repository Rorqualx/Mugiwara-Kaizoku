# Core Dependency Alignment

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Core Dependency Alignment

---
# Core Dependency Alignment

This document details the core dependency alignment implemented as part of the TypeScript error resolution project.

## Overview

The project has been updated to ensure consistent versions of core dependencies across the application. This alignment resolves type conflicts, improves type safety, and ensures compatibility between related packages.

## Key Dependencies Aligned

### React and Next.js Ecosystem

- **React 19.0.0**: Latest major version of React
- **React DOM 19.0.0**: Matching React DOM version
- **Next.js 15.2.3**: Latest version of Next.js compatible with React 19
- **@types/react 19.0.12**: Type definitions for React 19
- **@types/react-dom 19.0.4**: Type definitions for React DOM 19

### tRPC Ecosystem

- **@trpc/client 11.0.0**: Client for making type-safe API calls
- **@trpc/server 11.0.0**: Server implementation for type-safe APIs
- **@trpc/next 11.0.0**: Next.js integration for tRPC
- **@trpc/react-query 11.0.0**: React Query integration for tRPC
- **@tanstack/react-query 5.69.0**: Data fetching and caching library
- **superjson 2.2.2**: JSON serialization with support for rich data types

### UI Component Library

- **@mantine/core 7.17.2**: Main Mantine UI library
- **mantine-datatable 7.17.1**: Data table component for Mantine
- **@mantine/form 7.17.2**: Form handling library
- **@mantine/hooks 7.17.2**: React hooks collection
- **@mantine/notifications 7.17.2**: Notification system
- **@mantine/modals 7.17.2**: Modal dialogs
- **@mantine/spotlight 7.17.2**: Command palette component
- **@mantine/vanilla-extract 7.17.2**: CSS-in-JS solution

## Implementation Changes

### 1. Package Resolutions

The `resolutions` field in `package.json` was updated to enforce consistent versions:

```json
"resolutions": {
  "@types/react": "19.0.12",
  "@types/react-dom": "19.0.4",
  "@types/node": "22.13.11",
  "typescript": "5.8.2",
  "@mantine/core": "7.17.2",
  // ... other Mantine packages ...
  "@trpc/client": "11.0.0",
  "@trpc/next": "11.0.0",
  "@trpc/react-query": "11.0.0",
  "@trpc/server": "11.0.0",
  "@tanstack/react-query": "5.69.0",
  "react": "19.0.0",
  "react-dom": "19.0.0",
  "next": "15.2.3",
  "superjson": "2.2.2"
}
```

### 2. tRPC Client Configuration Updates

The tRPC client configuration was updated to be compatible with tRPC v11:

- Removed root-level `transformer` property (now specified in links only)
- Updated hook usage for error handling in components
- Fixed query options to match v11 API

### 3. Component Prop Updates

- Updated Mantine component props to match the latest API:
  - Changed `spacing` to `gap` in Stack components
  - Updated Group component props

## Known Issues and Workarounds

### tRPC v11 Migration Notes

- The `onSuccess` and `onError` callbacks must now be handled separately with `useEffect` instead of in the query options
- The transformer is now specified in the link configuration, not at the root level
- The `createTRPCNext` configuration structure has changed

### React 19 Type Compatibility

- Some third-party components may not yet have type definitions for React 19
- When encountering such issues, use type assertions or create custom type declarations

## Dependency Update Process

When updating dependencies in the future:

1. Check compatibility between React, Next.js, and tRPC versions
2. Update the `resolutions` field in package.json
3. Run `pnpm install` to apply the resolutions
4. Test thoroughly, especially components using tRPC hooks
5. Run type checking to identify and fix any type errors