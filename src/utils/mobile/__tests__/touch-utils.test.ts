import {
  getTouchDistance,
  getSwipeDirection,
  getTouchPosition,
  preventTouchDefault,
  isTap,
  normalizeTouch,
  getPassiveTouchOptions
} from '../touch-utils';

describe('Touch Utilities', () => {
  describe('getTouchDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 3, y: 4 };
      
      expect(getTouchDistance(start, end)).toBe(5); // 3-4-5 triangle
    });

    it('should return 0 for same points', () => {
      const point = { x: 100, y: 200 };
      
      expect(getTouchDistance(point, point)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const start = { x: -10, y: -10 };
      const end = { x: 10, y: 10 };
      
      const distance = getTouchDistance(start, end);
      expect(distance).toBeCloseTo(28.28, 2); // sqrt(20^2 + 20^2)
    });
  });

  describe('getSwipeDirection', () => {
    it('should detect right swipe', () => {
      const start = { x: 100, y: 200 };
      const end = { x: 200, y: 200 };
      
      const result = getSwipeDirection(start, end);
      expect(result.direction).toBe('right');
      expect(result.distance).toBe(100);
    });

    it('should detect left swipe', () => {
      const start = { x: 200, y: 200 };
      const end = { x: 100, y: 200 };
      
      const result = getSwipeDirection(start, end);
      expect(result.direction).toBe('left');
      expect(result.distance).toBe(100);
    });

    it('should detect up swipe', () => {
      const start = { x: 200, y: 200 };
      const end = { x: 200, y: 100 };
      
      const result = getSwipeDirection(start, end);
      expect(result.direction).toBe('up');
      expect(result.distance).toBe(100);
    });

    it('should detect down swipe', () => {
      const start = { x: 200, y: 100 };
      const end = { x: 200, y: 200 };
      
      const result = getSwipeDirection(start, end);
      expect(result.direction).toBe('down');
      expect(result.distance).toBe(100);
    });

    it('should return null for short swipes', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 110, y: 110 };
      
      const result = getSwipeDirection(start, end, 50);
      expect(result.direction).toBe(null);
      expect(result.distance).toBeCloseTo(14.14, 2);
    });

    it('should detect diagonal swipes correctly', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 200, y: 150 }; // More horizontal than vertical
      
      const result = getSwipeDirection(start, end);
      expect(result.direction).toBe('right');
    });
  });

  describe('getTouchPosition', () => {
    it('should extract touch position from TouchEvent', () => {
      const mockEvent = {
        touches: [{
          clientX: 150,
          clientY: 250
        }]
      } as unknown as TouchEvent;
      
      const position = getTouchPosition(mockEvent);
      expect(position).toEqual({ x: 150, y: 250 });
    });

    it('should return null for empty touches', () => {
      const mockEvent = {
        touches: []
      } as unknown as TouchEvent;
      
      const position = getTouchPosition(mockEvent);
      expect(position).toBe(null);
    });
  });

  describe('preventTouchDefault', () => {
    it('should call preventDefault if event is cancelable', () => {
      const mockEvent = {
        cancelable: true,
        preventDefault: jest.fn()
      } as unknown as TouchEvent;
      
      preventTouchDefault(mockEvent);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not call preventDefault if event is not cancelable', () => {
      const mockEvent = {
        cancelable: false,
        preventDefault: jest.fn()
      } as unknown as TouchEvent;
      
      preventTouchDefault(mockEvent);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('isTap', () => {
    it('should return true for small movements', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 105, y: 105 };
      
      expect(isTap(start, end)).toBe(true);
    });

    it('should return false for large movements', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 150, y: 150 };
      
      expect(isTap(start, end)).toBe(false);
    });

    it('should respect custom distance threshold', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 120, y: 120 };
      
      expect(isTap(start, end, 30)).toBe(true);
      expect(isTap(start, end, 20)).toBe(false);
    });
  });

  describe('normalizeTouch', () => {
    it('should normalize touch coordinates relative to element', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100
        })
      } as HTMLElement;
      
      const mockEvent = {
        touches: [{
          clientX: 150,
          clientY: 250
        }]
      } as unknown as TouchEvent;
      
      const normalized = normalizeTouch(mockEvent, mockElement);
      expect(normalized).toEqual({ x: 100, y: 150 });
    });

    it('should return null if no touch position', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0
        })
      } as HTMLElement;
      
      const mockEvent = {
        touches: []
      } as unknown as TouchEvent;
      
      const normalized = normalizeTouch(mockEvent, mockElement);
      expect(normalized).toBe(null);
    });
  });

  describe('getPassiveTouchOptions', () => {
    it('should return passive options object or false', () => {
      const options = getPassiveTouchOptions();

      // Should be either { passive: true }, true, or false
      if (typeof options === 'boolean') {
        // Boolean: true or false
        expect(typeof options).toBe('boolean');
      } else {
        // Object: AddEventListenerOptions
        expect('passive' in options).toBe(true);
        expect(options.passive).toBe(true);
      }
    });
  });
});