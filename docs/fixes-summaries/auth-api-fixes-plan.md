# Auth Api Fixes Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Auth Api Fixes Plan

---
# Authentication and API Fixes Implementation Plan

## Overview

This document outlines the detailed strategy for fixing TypeScript errors in the authentication and API route files. The goal is to ensure type safety, consistent implementation patterns, and proper error handling across all authentication-related files.

## Files Requiring Fixes

1. **Authentication Configuration**
   - `src/lib/auth/config.ts` (3 errors)
   - `src/middleware/auth.ts` (potential errors)

2. **API Routes**
   - `src/pages/api/users/[id].ts` (2 errors)
   - `src/pages/api/users/index.ts` (3 errors)

3. **Page Components with Authentication**
   - `src/pages/index.tsx` (2 errors)
   - `src/pages/login.tsx` (2 errors)
   - Other pages with auth checks (various errors)

## Common Error Patterns

1. **Session Type Safety Issues**
   - Incorrect typing for Auth.js session objects
   - Type mismatches between session and domain user types
   - Unsafe type assertions

2. **User Role Enum Compatibility**
   - Mismatches between Prisma-generated and domain user role enums
   - Using string literals where enums are expected
   - Missing type conversions between enum types

3. **API Response Type Safety**
   - Inconsistent response structures
   - Missing type safety in response construction
   - Type incompatibilities in error handling

4. **Authentication Callback Issues**
   - Type errors in NextAuth callbacks
   - Missing type definitions for tokens and session objects
   - Type safety issues in JWT token handling

## Implementation Strategy

### 1. Fix Authentication Configuration (`src/lib/auth/config.ts`)

The auth configuration file has several type safety issues related to NextAuth callbacks and session handling. The key fixes needed are:

1. **Improve Session Type Definitions**:
   ```typescript
   // Import proper session types
   import { Session, JWT } from "next-auth";
   import { User } from "next-auth/core/types";
   import { UserRole } from "../../../types/domain/user-types";
   
   // Create custom session type
   interface CustomSession extends Session {
     user?: {
       id?: string;
       name?: string;
       email?: string;
       role?: UserRole;
       avatar?: string;
     };
   }
   ```

2. **Fix JWT Callback Type Safety**:
   ```typescript
   // Properly type the JWT callback
   async jwt({ token, user }: { token: JWT; user?: User & { role?: UserRole; avatar?: string } }) {
     if (user) {
       // User object is defined during sign in
       if ('role' in user && user.role) {
         token.role = user.role;
       }
       
       if ('avatar' in user && typeof user.avatar === 'string') {
         token.avatar = user.avatar;
       }
     }
     return token;
   }
   ```

3. **Fix Session Callback Type Safety**:
   ```typescript
   // Properly type the session callback
   async session({ session, token }: { session: CustomSession; token: JWT & { role?: UserRole; avatar?: string } }) {
     if (!session.user) {
       session.user = {};
     }
     
     if (token.sub) {
       session.user.id = token.sub;
     }
     
     // Add role to session with proper type handling
     if (token.role) {
       session.user.role = token.role;
     }
     
     // Add additional user data with type safety
     if (token.avatar) {
       session.user.avatar = token.avatar;
     }
     
     return session;
   }
   ```

### 2. Fix API Routes (`src/pages/api/users/[id].ts` and `index.ts`)

The API routes have issues with domain type compatibility and error handling. The key fixes needed are:

1. **Fix Domain Type Conversion**:
   ```typescript
   // Create a type-safe conversion function
   function convertToDomainUser(dbUser: any): Domain.UserEntity {
     return {
       id: dbUser.id,
       username: dbUser.userName, // Map userName to username for domain type
       email: dbUser.email,
       role: dbUser.role as Domain.UserRole, // Ensure proper typing
       createdAt: dbUser.createdAt,
       updatedAt: dbUser.updatedAt,
       avatarUrl: dbUser.avatar || '', // Map avatar to avatarUrl for domain type with fallback
       isActive: true // Default value for isActive
     };
   }
   ```

2. **Improve Error Type Safety**:
   ```typescript
   // Create a type-safe error handler
   function handleApiError(error: unknown, res: NextApiResponse, defaultMsg: string): void {
     console.error('API error:', error);
     
     // Check if it's a Prisma error
     if (error && typeof error === 'object' && 'code' in error) {
       const prismaError = error as { code?: string; message?: string };
       
       if (prismaError.code === 'P2025') {
         return res.status(404).json({
           success: false,
           error: 'User not found'
         });
       }
     }
     
     // Default error response
     res.status(500).json({
       success: false,
       error: defaultMsg
     });
   }
   ```

3. **Fix Role Validation**:
   ```typescript
   // Create a type guard for user roles
   function isValidUserRole(role: unknown): role is Domain.UserRole {
     return role === 'ADMIN' || role === 'USER';
   }
   
   // Use the type guard for validation
   if (!isValidUserRole(role)) {
     return res.status(400).json({
       success: false,
       error: 'Invalid role - must be USER or ADMIN'
     });
   }
   ```

### 3. Fix Page Components (`src/pages/index.tsx` and `login.tsx`)

The page components have issues with session typing and user type conversions. The key fixes needed are:

1. **Fix Session Type Assertions**:
   ```typescript
   // Use a type guard instead of direct assertion
   function isDomainUser(user: unknown): user is Domain.UserEntity {
     return user !== null && 
       typeof user === 'object' && 
       'id' in user && 
       'role' in user;
   }
   
   // Use the type guard with session data
   const sessionUser = session?.user;
   if (isDomainUser(sessionUser)) {
     // Safe to use sessionUser as Domain.UserEntity
   } else {
     // Handle case where user is not a valid domain user
   }
   ```

2. **Improve Auth Validation**:
   ```typescript
   // Create a helper function for auth validation
   async function validateAuth(context: GetServerSidePropsContext): Promise<{
     authenticated: boolean;
     user?: Domain.UserEntity;
   }> {
     const session = await validateSession(context);
     
     if (!session?.user) {
       return { authenticated: false };
     }
     
     // Safely convert session user to domain user
     try {
       const user: Domain.UserEntity = {
         id: session.user.id || '',
         username: session.user.name || '',
         email: session.user.email || '',
         role: session.user.role as Domain.UserRole || 'USER',
         avatarUrl: session.user.avatar || '',
         isActive: true,
         createdAt: new Date(),
         updatedAt: new Date()
       };
       
       return { authenticated: true, user };
     } catch (error) {
       console.error('Error converting session user to domain user:', error);
       return { authenticated: false };
     }
   }
   ```

## Implementation Order

For effective implementation, follow this order:

1. Start with `src/lib/auth/config.ts` to establish the core session and token types
2. Update `src/middleware/auth.ts` to ensure consistent auth checking patterns
3. Fix the API routes to ensure proper domain type handling
4. Update page components to use the improved auth validation

## Verification Steps

After implementing the fixes, verify:

1. Run TypeScript checks to ensure no new errors are introduced
2. Test authentication flow to ensure it works as expected
3. Test API routes to ensure proper type handling
4. Verify page redirects and authentication checks work correctly

## Benefits of Implementation

Implementing these fixes will:

1. Improve type safety across the authentication layer
2. Ensure consistent handling of user types between API and UI
3. Reduce runtime errors through stronger type checking
4. Make the codebase more maintainable with clearer type definitions
5. Provide a more reliable authentication experience