/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';

import { hasAdminRole, useIsAdmin } from '@/hooks/useIsAdmin';

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));

const mockUseSession = useSession as jest.Mock;

describe('hasAdminRole', () => {
  it('accepts only the exact ADMIN role the server checks for', () => {
    expect(hasAdminRole({ role: 'ADMIN' })).toBe(true);
    expect(hasAdminRole({ role: 'USER' })).toBe(false);
    expect(hasAdminRole({ role: 'admin' })).toBe(false);
    expect(hasAdminRole({})).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
    expect(hasAdminRole(undefined)).toBe(false);
    expect(hasAdminRole('ADMIN')).toBe(false);
  });
});

describe('useIsAdmin', () => {
  it('is true for an authenticated admin', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated', data: { user: { id: '1', role: 'ADMIN' } } });
    expect(renderHook(() => useIsAdmin()).result.current).toBe(true);
  });

  it('is false for an authenticated regular user', () => {
    mockUseSession.mockReturnValue({ status: 'authenticated', data: { user: { id: '2', role: 'USER' } } });
    expect(renderHook(() => useIsAdmin()).result.current).toBe(false);
  });

  it('is false while the session is loading, so admin controls never flash', () => {
    mockUseSession.mockReturnValue({ status: 'loading', data: null });
    expect(renderHook(() => useIsAdmin()).result.current).toBe(false);
  });

  it('is false when signed out', () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    expect(renderHook(() => useIsAdmin()).result.current).toBe(false);
  });
});
