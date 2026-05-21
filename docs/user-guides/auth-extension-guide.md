# Auth Extension Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Auth Extension Guide

---
# Auth.js Extension Guide

This guide provides information on how to extend and customize the Auth.js implementation in the Kaizoku application.

## Overview

The Kaizoku application uses Auth.js for authentication. Auth.js is a complete authentication solution for Next.js applications. This guide explains how to customize and extend the authentication system for future needs.

## Authentication Configuration

The main authentication configuration is located in `/src/lib/auth/config.ts`. This file contains the Auth.js options including:

- Adapter configuration (Prisma)
- Authentication providers
- Session handling
- Callbacks for JWT and session handling
- Security options

## Adding Custom Providers

To add a new authentication provider:

1. Install the provider package from Auth.js:
   ```bash
   pnpm add @auth/provider-name
   ```

2. Import the provider in the configuration file:
   ```typescript
   import ProviderName from "@auth/core/providers/provider-name";
   ```

3. Add the provider to the providers array:
   ```typescript
   providers: [
     CredentialsProvider({
       // existing provider configuration
     }),
     ProviderName({
       clientId: process.env.PROVIDER_CLIENT_ID,
       clientSecret: process.env.PROVIDER_CLIENT_SECRET,
       // additional provider-specific configuration
     }),
   ],
   ```

4. Update type definitions if necessary in `/src/types/auth-types.d.ts`.

## Customizing Session Handling

To customize session handling:

1. Modify the session configuration in `/src/lib/auth/config.ts`:
   ```typescript
   session: {
     strategy: "jwt", // or "database"
     maxAge: 30 * 24 * 60 * 60, // session duration in seconds
   },
   ```

2. Update the callbacks to include custom data in the session:
   ```typescript
   callbacks: {
     async session({ session, token }) {
       // Add custom data to the session
       session.user.customData = token.customData;
       return session;
     },
     async jwt({ token, user }) {
       if (user) {
         // Add custom data to the token
         token.customData = user.customData;
       }
       return token;
     }
   },
   ```

3. Update type definitions in `/src/types/auth-types.d.ts` to include your custom data:
   ```typescript
   declare module "@auth/core/types" {
     interface Session {
       user: {
         // existing properties
         customData?: any;
       }
     }
     
     interface JWT {
       // existing properties
       customData?: any;
     }
   }
   ```

## Role-Based Access Control

The application implements role-based access control using the UserRole enum. To customize roles:

1. Update the UserRole enum in `/src/utils/typescript-compat.ts` if you need more roles:
   ```typescript
   export enum UserRole {
     USER = 'USER',
     ADMIN = 'ADMIN',
     EDITOR = 'EDITOR', // new role example
   }
   ```

2. Update the Prisma schema to include the new role:
   ```prisma
   enum UserRole {
     USER
     ADMIN
     EDITOR
   }
   ```

3. Update middleware in `/src/middleware.ts` to handle the new role:
   ```typescript
   // Example for editor-only routes
   const editorRoutes = [
     '/editor',
     '/content-management',
   ];
   
   if (editorRoutes.some(route => path.startsWith(route)) && userRole !== 'EDITOR' && userRole !== 'ADMIN') {
     return NextResponse.redirect(new URL('/', req.url));
   }
   ```

4. Update the withAuth HOC in `/src/components/auth/withAuth.tsx` to add a new role-specific wrapper:
   ```typescript
   export function withEditor(Component: React.ComponentType<any>) {
     return withRole(Component, 'EDITOR');
   }
   
   function withRole(Component: React.ComponentType<any>, requiredRole: UserRole) {
     // Implementation to check for specific role
   }
   ```

## Testing Authentication

The application includes a test script for authentication flows at `/scripts/test-auth-flows.js`. Use this to verify changes to the authentication system:

```bash
pnpm test:auth
```

The test script validates:
- User registration
- Login/logout
- Protected route access
- Role-based access control

## Troubleshooting Authentication Issues

Common authentication issues and solutions:

1. **Session Not Persisting**: Check the `maxAge` setting in the session configuration and ensure cookies are being properly set.

2. **Role-Based Access Not Working**: Verify that user roles are being correctly added to the JWT token and session.

3. **Redirect Issues**: Check the redirect URLs in the Auth.js configuration and components.

4. **Database Adapter Issues**: Ensure the Prisma adapter is properly configured and the database schema matches the expected structure.

## Best Practices

1. **Environment Variables**: Store sensitive authentication data in environment variables.

2. **Error Handling**: Implement proper error handling for authentication failures.

3. **Type Safety**: Keep type definitions up to date in `/src/types/auth-types.d.ts`.

4. **Security**: Regularly review and update authentication security practices.

5. **Testing**: Add tests for new authentication features.

## Resources

- [Auth.js Documentation](https://authjs.dev/)
- [Auth.js Provider Documentation](https://authjs.dev/reference/core/providers)
- [Auth.js Prisma Adapter](https://authjs.dev/reference/adapter/prisma)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)