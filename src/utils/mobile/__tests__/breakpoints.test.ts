import { getCurrentBreakpoint,
  isBreakpointDown,
  isBreakpointUp,
  isBreakpointBetween,
  getResponsiveValue
} from '../breakpoints';

// Mock browser globals if not defined (for Bun test environment)
if (typeof window === 'undefined') {
  (global as typeof global & { window: Window & typeof globalThis }).window = {} as Window & typeof globalThis;
}

describe('Breakpoint Utilities', () => {
  beforeEach(() => {
    // Reset window width for each test
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true
    });
  });

  describe('getCurrentBreakpoint', () => {
    it('should return xs for width < 576px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 320 });
      expect(getCurrentBreakpoint()).toBe('xs');
    });

    it('should return sm for width >= 576px and < 768px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 576 });
      expect(getCurrentBreakpoint()).toBe('sm');
      
      Object.defineProperty(window, 'innerWidth', { value: 767 });
      expect(getCurrentBreakpoint()).toBe('sm');
    });

    it('should return md for width >= 768px and < 992px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768 });
      expect(getCurrentBreakpoint()).toBe('md');
      
      Object.defineProperty(window, 'innerWidth', { value: 991 });
      expect(getCurrentBreakpoint()).toBe('md');
    });

    it('should return lg for width >= 992px and < 1200px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 992 });
      expect(getCurrentBreakpoint()).toBe('lg');
      
      Object.defineProperty(window, 'innerWidth', { value: 1199 });
      expect(getCurrentBreakpoint()).toBe('lg');
    });

    it('should return xl for width >= 1200px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      expect(getCurrentBreakpoint()).toBe('xl');
      
      Object.defineProperty(window, 'innerWidth', { value: 1920 });
      expect(getCurrentBreakpoint()).toBe('xl');
    });
  });

  describe('isBreakpointDown', () => {
    it('should return true when viewport is below breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500 });

      // isBreakpointDown checks if width < BREAKPOINTS[breakpoint]
      expect(isBreakpointDown('xs')).toBe(true);  // 500 < 576
      expect(isBreakpointDown('sm')).toBe(true);  // 500 < 768
      expect(isBreakpointDown('md')).toBe(true);  // 500 < 992
      expect(isBreakpointDown('lg')).toBe(true);  // 500 < 1200
      expect(isBreakpointDown('xl')).toBe(true);  // 500 < 1408
    });

    it('should return false when viewport is at or above breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      
      expect(isBreakpointDown('xs')).toBe(false);
      expect(isBreakpointDown('sm')).toBe(false);
      expect(isBreakpointDown('md')).toBe(false);
      expect(isBreakpointDown('lg')).toBe(false);
      expect(isBreakpointDown('xl')).toBe(true); // 1200 < 1408
    });
  });

  describe('isBreakpointUp', () => {
    it('should return true when viewport is at or above breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      
      expect(isBreakpointUp('xs')).toBe(true);  // 800 >= 576
      expect(isBreakpointUp('sm')).toBe(true);  // 800 >= 768
      expect(isBreakpointUp('md')).toBe(false); // 800 < 992
      expect(isBreakpointUp('lg')).toBe(false); // 800 < 1200
      expect(isBreakpointUp('xl')).toBe(false); // 800 < 1408
    });

    it('should return false when viewport is below breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500 });
      
      expect(isBreakpointUp('xs')).toBe(false); // 500 < 576
      expect(isBreakpointUp('sm')).toBe(false); // 500 < 768
      expect(isBreakpointUp('md')).toBe(false); // 500 < 992
    });
  });

  describe('isBreakpointBetween', () => {
    it('should return true when viewport is between breakpoints', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      
      expect(isBreakpointBetween('sm', 'md')).toBe(true);  // 800 >= 768 && 800 < 992
      expect(isBreakpointBetween('xs', 'lg')).toBe(true);  // 800 >= 576 && 800 < 1200
    });

    it('should return false when viewport is outside range', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500 });
      
      expect(isBreakpointBetween('sm', 'md')).toBe(false); // 500 < 768
      expect(isBreakpointBetween('md', 'lg')).toBe(false); // 500 < 992
    });

    it('should return false when viewport is above range', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1300 });
      
      expect(isBreakpointBetween('xs', 'sm')).toBe(false); // 1300 >= 768
      expect(isBreakpointBetween('sm', 'md')).toBe(false); // 1300 >= 992
    });
  });

  describe('getResponsiveValue', () => {
    it('should return value for current breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 }); // md breakpoint
      
      const values = {
        xs: 1,
        sm: 2,
        md: 3,
        lg: 4,
        xl: 5
      };
      
      expect(getResponsiveValue(values, 0)).toBe(3);
    });

    it('should fall back to lower breakpoint value if current not defined', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 }); // md breakpoint
      
      const values = {
        xs: 1,
        sm: 2,
        // md not defined
        lg: 4,
        xl: 5
      };
      
      expect(getResponsiveValue(values, 0)).toBe(2); // Falls back to sm
    });

    it('should return default value if no breakpoints match', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 }); // md breakpoint
      
      const values = {
        lg: 4,
        xl: 5
      };
      
      expect(getResponsiveValue(values, 99)).toBe(99);
    });

    it('should handle empty values object', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      
      expect(getResponsiveValue({}, 'default')).toBe('default');
    });

    it('should work with different value types', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 }); // xs breakpoint
      
      const stringValues = {
        xs: 'small',
        md: 'medium',
        xl: 'large'
      };
      
      expect(getResponsiveValue(stringValues, 'default')).toBe('small');
      
      const objectValues = {
        xs: { columns: 1 },
        md: { columns: 2 },
        xl: { columns: 3 }
      };
      
      expect(getResponsiveValue(objectValues, { columns: 0 })).toEqual({ columns: 1 });
    });
  });
});