import { renderHook, act } from '@testing-library/react';

import { useMediaQuery, useMediaQueries, mediaQueries } from '../useMediaQuery';

// Mock matchMedia
const createMockMediaQuery = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

describe('useMediaQuery Hook', () => {
  let mockMediaQueries: Record<string, ReturnType<typeof createMockMediaQuery>>;

  beforeEach(() => {
    mockMediaQueries = {};

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn((query: string) => {
        mockMediaQueries[query] ??= createMockMediaQuery(false);
        return mockMediaQueries[query];
      })
    });
  });

  describe('useMediaQuery', () => {
    it('should return initial match state', () => {
      mockMediaQueries['(min-width: 768px)'] = createMockMediaQuery(true);
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      
      expect(result.current).toBe(true);
    });

    it('should update when media query changes', () => {
      const query = '(min-width: 768px)';
      const mockQuery = createMockMediaQuery(false);
      mockMediaQueries[query] = mockQuery;
      
      const { result } = renderHook(() => useMediaQuery(query));
      
      expect(result.current).toBe(false);
      
      // Simulate media query change
      act(() => {
        mockQuery.matches = true;
        const changeHandler = mockQuery.addEventListener.mock.calls
          .find(call => call[0] === 'change')?.[1];
        
        if (changeHandler) {
          changeHandler({ matches: true } as MediaQueryListEvent);
        }
      });
      
      expect(result.current).toBe(true);
    });

    it('should use addEventListener for modern browsers', () => {
      const query = '(min-width: 768px)';
      const mockQuery = createMockMediaQuery(false);
      mockMediaQueries[query] = mockQuery;

      const { result } = renderHook(() => useMediaQuery(query));

      expect(result.current).toBe(false);
      expect(mockQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should clean up listeners on unmount', () => {
      const query = '(min-width: 768px)';
      const mockQuery = createMockMediaQuery(false);
      mockMediaQueries[query] = mockQuery;
      
      const { unmount } = renderHook(() => useMediaQuery(query));
      
      unmount();
      
      expect(mockQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should handle query changes', () => {
      const query1 = '(min-width: 768px)';
      const query2 = '(min-width: 1024px)';
      
      mockMediaQueries[query1] = createMockMediaQuery(true);
      mockMediaQueries[query2] = createMockMediaQuery(false);
      
      const { result, rerender } = renderHook(
        ({ query }) => useMediaQuery(query),
        { initialProps: { query: query1 } }
      );
      
      expect(result.current).toBe(true);
      
      rerender({ query: query2 });
      
      expect(result.current).toBe(false);
    });
  });

  describe('useMediaQueries', () => {
    it('should return all media query states', () => {
      // Set up various media queries
      mockMediaQueries[mediaQueries.portrait] = createMockMediaQuery(true);
      mockMediaQueries[mediaQueries.landscape] = createMockMediaQuery(false);
      mockMediaQueries[mediaQueries.mobile] = createMockMediaQuery(true);
      mockMediaQueries[mediaQueries.tablet] = createMockMediaQuery(false);
      mockMediaQueries[mediaQueries.desktop] = createMockMediaQuery(false);
      mockMediaQueries[mediaQueries.touch] = createMockMediaQuery(true);
      mockMediaQueries[mediaQueries.mouse] = createMockMediaQuery(false);
      mockMediaQueries[mediaQueries.darkMode] = createMockMediaQuery(true);
      mockMediaQueries[mediaQueries.reducedMotion] = createMockMediaQuery(false);
      
      const { result } = renderHook(() => useMediaQueries());
      
      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isTouchDevice).toBe(true);
      expect(result.current.hasMouseDevice).toBe(false);
      expect(result.current.prefersDarkMode).toBe(true);
      expect(result.current.prefersReducedMotion).toBe(false);
    });

    it('should update individual states when queries change', () => {
      const mobileQuery = createMockMediaQuery(false);
      mockMediaQueries[mediaQueries.mobile] = mobileQuery;
      
      const { result } = renderHook(() => useMediaQueries());
      
      expect(result.current.isMobile).toBe(false);
      
      // Simulate mobile query change
      act(() => {
        mobileQuery.matches = true;
        const changeHandler = mobileQuery.addEventListener.mock.calls
          .find(call => call[0] === 'change')?.[1];
        
        if (changeHandler) {
          changeHandler({ matches: true } as MediaQueryListEvent);
        }
      });
      
      expect(result.current.isMobile).toBe(true);
    });
  });

  describe('mediaQueries constants', () => {
    it('should have correct query strings', () => {
      expect(mediaQueries.mobile).toBe('(max-width: 767px)');
      expect(mediaQueries.tablet).toBe('(min-width: 768px) and (max-width: 991px)');
      expect(mediaQueries.desktop).toBe('(min-width: 992px)');
      expect(mediaQueries.portrait).toBe('(orientation: portrait)');
      expect(mediaQueries.landscape).toBe('(orientation: landscape)');
      expect(mediaQueries.touch).toBe('(hover: none) and (pointer: coarse)');
      expect(mediaQueries.darkMode).toBe('(prefers-color-scheme: dark)');
    });
  });
});