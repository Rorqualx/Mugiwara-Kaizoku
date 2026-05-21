# Authentication Standardization

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Authentication Standardization

---
# Authentication System Standardization

> ⚠️ **CANONICAL DOCUMENTATION** - Last Updated: January 2025
> 
> This document resolves conflicting authentication documentation and clarifies the ACTUAL authentication system used in Mugiwara-Kaizoku.

## Critical Conflict Resolution

There are THREE conflicting authentication systems documented:

1. **Auth.js (NextAuth v5)** - Referenced in `authentication-guide.md`
2. **Lucia Auth** - Referenced in `auth-system.md` and `production-auth-setup.md`
3. **NextAuth.js v4** - Referenced in troubleshooting sections

## The ACTUAL Authentication System

After examining the codebase structure and file patterns, Kaizoku uses:

### **✅ CORRECT: NextAuth.js (Auth.js)**

**Evidence**:
- Environment variables use `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- Error messages reference `[next-auth][error][JWT_SESSION_ERROR]`
- Files like `auth.config.ts` and type extensions match Auth.js patterns
- JWT-based sessions are mentioned consistently

**Key Implementation Details**:
- **Library**: Auth.js (NextAuth v5) with JWT sessions
- **Configuration**: `/auth.config.ts` and `/auth.ts`
- **Session Strategy**: JWT tokens (not database sessions)
- **Cookie Management**: HTTP-only secure cookies for JWT storage
- **Role System**: ADMIN and USER roles stored in JWT

### **❌ INCORRECT: Lucia Auth**

The documentation mentioning Lucia Auth appears to be:
- From a different project or earlier version
- Incorrectly copied/migrated documentation
- Should be archived or removed

## Correct Authentication Architecture

```
Authentication Flow:
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  NextAuth.js │────▶│  Database   │
│   (JWT)     │◀────│  Middleware  │◀────│  (Users)    │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Core Files
- `/auth.config.ts` - Static Auth.js configuration
- `/auth.ts` - Auth.js initialization with PrismaAdapter
- `/src/middleware.ts` - Route protection middleware
- `/src/pages/api/auth/[...nextauth].ts` - Auth API routes
- `/src/types/auth-types.d.ts` - Type extensions

### Environment Variables
```env
# Required
NEXTAUTH_SECRET=your-secret-key      # JWT signing secret
NEXTAUTH_URL=http://localhost:3000    # Callback URL

# Optional
AUTH_SECRET=your-secret-key           # Alternative to NEXTAUTH_SECRET
AUTH_URL=http://localhost:3000        # Alternative to NEXTAUTH_URL
AUTH_TRUST_HOST=true                  # For proxy environments
```

## Common Authentication Tasks

### 1. Creating Admin User
```bash
pnpm create-admin <email> <username> <password>
# or
node scripts/create-admin.js <email> <username> <password>
```

### 2. Testing Authentication
```bash
pnpm test:auth-js    # Test Auth.js migration
pnpm test:auth       # Legacy test (backward compatibility)
```

### 3. Protecting Routes

**Middleware Protection** (in `src/middleware.ts`):
```typescript
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
};
```

**Component Protection**:
```typescript
import { withAuth } from '@/components/auth/withAuth';
import { withAdmin } from '@/components/auth/withAdmin';

// Require authentication
export default withAuth(MyComponent);

// Require admin role
export default withAdmin(AdminComponent);
```

### 4. Accessing User Session

**Server-side**:
```typescript
import { auth } from '@/auth';

const session = await auth();
const user = session?.user;
```

**Client-side**:
```typescript
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();
```

## Troubleshooting Guide

### JWT Decryption Errors
**Error**: `[next-auth][error][JWT_SESSION_ERROR] decryption operation failed`

**Causes & Solutions**:
1. **Domain Mismatch**: 
   - Use `NEXTAUTH_URL=http://localhost:3000` for local development
   - Never use `0.0.0.0` in NEXTAUTH_URL
   - For network access, use your machine's IP: `NEXTAUTH_URL=http://192.168.1.x:3000`

2. **Secret Changed**: 
   - Ensure NEXTAUTH_SECRET hasn't changed
   - All users must re-login if secret changes

3. **Cookie Issues**:
   - Clear browser cookies
   - Restart the application after changing NEXTAUTH_URL

### Session Not Persisting
1. Check cookie settings match your domain
2. Verify HTTPS in production (secure cookies)
3. Check JWT expiration settings

### Debug Mode
Enable detailed logging:
```env
NEXTAUTH_DEBUG=true
```

## Migration from Incorrect Documentation

If you followed the Lucia Auth documentation:

1. **Database Schema**: The User/Session tables are compatible
2. **Scripts**: `create-admin.js` works with both systems
3. **Key Difference**: NextAuth uses JWT sessions, not database sessions
4. **Action Required**: Update environment variables to use NEXTAUTH_* format

## Production Deployment

### Docker Configuration
```yaml
environment:
  - DATABASE_URL=postgresql://user:pass@db:5432/kaizoku
  - NEXTAUTH_SECRET=your-production-secret
  - NEXTAUTH_URL=https://your-domain.com
  - NODE_ENV=production
```

### Security Checklist
- [ ] Use HTTPS in production
- [ ] Set strong NEXTAUTH_SECRET (32+ characters)
- [ ] Enable secure cookies
- [ ] Configure proper CORS settings
- [ ] Implement rate limiting
- [ ] Monitor authentication logs

## References to Remove/Archive

The following files contain incorrect authentication information:
- `docs/auth-system.md` - References Lucia Auth
- `docs/production-auth-setup.md` - References Lucia Auth

These should be:
1. Marked with deprecation warnings
2. Moved to archive
3. Updated to reference this standardization guide

---

**Remember**: Always use NextAuth.js/Auth.js documentation and patterns. Ignore any references to Lucia Auth in the Kaizoku codebase.