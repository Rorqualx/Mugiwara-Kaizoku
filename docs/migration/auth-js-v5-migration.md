# Auth Js V5 Migration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Auth Js V5 Migration

---
# Auth.js v5 Migration Summary

This document summarizes the migration of the authentication system from NextAuth.js to Auth.js v5 in the Mugiwara-Kaizoku project.

## Overview

The project was using an older version of NextAuth.js and needed to be updated to Auth.js v5 (the new name for NextAuth.js). This migration involved updating imports, API calls, and session handling throughout the codebase.

## Key Changes

1. **Import Changes**
   - Updated imports from `next-auth` to use the Auth.js v5 API
   - Replaced `getServerSession` direct imports with the `auth()` function
   - Updated client-side imports to use the correct paths

2. **Configuration Updates**
   - Updated `authConfig` to use `NextAuthConfig` type instead of `AuthOptions`
   - Created a wrapper `auth()` function for session access
   - Fixed secret configuration to use environment variables properly

3. **API Route Updates**
   - Updated the `[...nextauth].ts` route to export the `auth` handler directly
   - Fixed API routes to use the new `auth()` function
   - Created a `credentials.ts` module to handle credential validation

4. **Middleware Updates**
   - Updated the middleware to use the Auth.js v5 API
   - Fixed session access in the middleware
   - Improved typing for middleware functions

5. **Type Definitions**
   - Updated `auth-types.d.ts` to properly extend Auth.js v5 types
   - Added an `AuthSession` interface for easier use elsewhere in the code
   - Improved session type safety

## Files Modified

1. **Core Auth Files**
   - `src/lib/auth/config.ts`
   - `src/lib/auth/index.ts`
   - `src/lib/auth/actions.ts`
   - `src/lib/auth/validate-request.ts`
   - `src/types/auth-types.d.ts`

2. **API Routes**
   - `src/pages/api/auth/[...nextauth].ts`
   - `src/pages/api/auth/login.ts`
   - `src/pages/api/auth/check.ts`
   - `src/pages/api/auth/signout.ts`
   - `src/pages/api/events/metadata-updates.ts`

3. **Middleware**
   - `src/middleware.ts`
   - `src/middleware/auth.ts`

4. **New Files Created**
   - `src/lib/auth/credentials.ts` - Credential validation utilities
   - `src/lib/client-side-auth.ts` - Client-side auth function wrappers

## Implementation Patterns

1. **Auth Function Pattern**
   ```typescript
   // src/lib/auth/config.ts
   import { getServerSession } from "next-auth";
   
   export const auth = async () => {
     return await getServerSession(authConfig);
   };
   ```

2. **API Route Pattern**
   ```typescript
   // src/pages/api/auth/[...nextauth].ts
   import { auth } from "../../../lib/auth/config";
   
   export default auth;
   ```

3. **Session Access Pattern**
   ```typescript
   // In API routes and middleware
   const session = await auth();
   
   if (!session) {
     // Handle unauthenticated state
   }
   
   // Access user data
   const userRole = session?.user?.role;
   ```

## Remaining Issues

While the core Auth.js v5 migration is complete, there are some remaining issues that need to be addressed:

1. **Login Page Integration**
   - The login page UI needs to be updated to use Auth.js v5 hooks
   - Client-side authentication flows should be updated

2. **Client Components**
   - `useSession` hook usage in client components needs to be checked
   - Session provider needs to be updated in the root layout

3. **API Route Validation**
   - Some API routes still need validation against Auth.js v5 patterns
   - Edge API route compatibility needs to be verified

## Next Steps

1. Complete the remaining client-side integration with Auth.js v5
2. Test authentication flows end-to-end
3. Add comprehensive test coverage for authentication
4. Update documentation with new Auth.js v5 patterns

## References

- [Auth.js v5 Documentation](https://authjs.dev/)
- [Migration Guide from NextAuth.js to Auth.js v5](https://authjs.dev/guides/upgrade-to-v5)
- [Auth.js v5 API Reference](https://authjs.dev/reference)