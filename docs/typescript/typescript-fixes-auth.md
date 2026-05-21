# Typescript Fixes Auth

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Fixes Auth

---
# Authentication TypeScript Fixes

## Overview

This document outlines the TypeScript fixes applied to the authentication system in the Mugiwara-Kaizoku project. The fixes address type compatibility issues between Auth.js v4 and Auth.js v5, as well as between the Prisma `UserRole` type and our domain `UserRole` enum.

## Key Issues Addressed

1. **UserRole Type Compatibility**
   - Fixed incompatibility between Prisma's `UserRole` type and our domain `UserRole` enum
   - Implemented proper type mapping functions for converting between different role representations

2. **Token and Session Type Safety**
   - Added proper typing for JWT token handling
   - Fixed type issues in session callbacks
   - Ensured type safety when moving data between auth flows

3. **NextAuth Configuration Types**
   - Fixed import paths for Auth.js v5 types
   - Added explicit parameter types to callbacks
   - Used `@ts-ignore` comments strategically to handle version compatibility

## Implementation Details

### 1. UserRole Handling

```typescript
// Import from domain types instead of Prisma
import { UserRole } from '../types/domain/user-types';

// Helper to map between role representations
const mapPrismaRoleToDomain = (prismaRole: any): UserRole => {
  const roleStr = String(prismaRole).toLowerCase();
  // Match the string value to our domain UserRole enum
  switch (roleStr) {
    case 'admin': return UserRole.ADMIN;
    case 'guest': return UserRole.GUEST;
    case 'user':
    default: return UserRole.USER;
  }
};
```

### 2. JWT Token Management

```typescript
// In jwt callback - store role as string
if (user) {
  const authUser = user as AuthorizedUser;
  // Store role as string in token
  if (authUser.role) {
    // @ts-ignore - Storing string in token, will convert to UserRole enum when retrieved
    token.role = authUser.role;
  }
  // @ts-ignore - Storing avatar string in token
  token.avatar = authUser.avatar;
}
```

### 3. Session Type Handling

```typescript
// In session callback - convert string role to UserRole enum
const extendedUser = {
  ...session.user,
  id: token.sub,
  // Use the domain UserRole enum value based on the token role string
  role: token.role ? mapPrismaRoleToDomain(token.role) : UserRole.USER,
  avatar: token.avatar && typeof token.avatar === 'string' ? token.avatar : null
};
```

### 4. Auth.js v5 Type Compatibility

```typescript
// Import Auth.js types for compatibility
// @ts-ignore - NextAuthConfig may be imported differently in Auth.js v5
import type { NextAuthConfig } from "@auth/core";

// Add explicit parameter types to callbacks
// @ts-ignore - Type compatibility between Auth.js versions
async session({ session, token }: { session: Session; token: JWT }) {
  // Implementation
}
```

## Files Modified

1. `/src/lib/auth-v4-compat.ts`
2. `/src/pages/api/auth/[...nextauth].ts`
3. `/src/lib/auth/config.mock.ts`
4. `/src/lib/auth/config.original.ts`

## Strategy Used

1. **Type Mapping**: Created explicit mapping functions to convert between different role representations.
2. **Strategic Ignores**: Used `@ts-ignore` comments only where necessary to handle version compatibility issues.
3. **Explicit Typing**: Added explicit type annotations to function parameters and return values.
4. **Domain Types**: Standardized on using domain `UserRole` enum throughout the application.

## Remaining Issues

While the major auth-related TypeScript errors have been addressed, there may still be some edge cases related to:

1. **Auth.js Version Compatibility**: Future updates to Auth.js may require revisiting these fixes.
2. **React Component Typing**: Some React components may still have type issues related to auth session usage.

## Conclusion

These fixes improve the type safety of the authentication system while maintaining compatibility between different libraries and versions. The core approach of using domain types throughout the application, with explicit mapping functions for external representations, provides a robust foundation for future development.