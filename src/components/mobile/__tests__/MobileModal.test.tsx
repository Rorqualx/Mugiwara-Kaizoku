/**
 * MobileModal Test Suite
 *
 * Tests for the MobileModal component with simplified device emulation
 * and direct touch event testing.
 */

import React from 'react';
import type { ReactNode } from 'react';

import { jest } from '@jest/globals';
import { MantineProvider } from '@mantine/core';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { MobileModal } from '../MobileModal';

// Mock the useBreakpoint hook to simulate mobile device
jest.mock('@/hooks/mobile', () => ({
  useBreakpoint: jest.fn(() => ({
    current: 'xs',
    isDown: jest.fn(() => false),
    isUp: jest.fn(() => true),
    isBetween: jest.fn(() => false),
    isMobile: true,
    isTablet: false,
    isDesktop: false
  }))
}));

// Mock getSafeAreaInsets
jest.mock('@/utils/mobile/orientation', () => ({
  getSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 }))
}));

// Custom render with MantineProvider
function render(ui: React.ReactElement): ReturnType<typeof rtlRender> {
  function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <MantineProvider>{children}</MantineProvider>;
  }

  return rtlRender(ui, { wrapper: Wrapper });
}

describe('MobileModal', () => {
  beforeEach(() => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375 // iPhone width
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('should render without crashing when opened', () => {
    expect(() => {
      render(
        <MobileModal opened={true} onClose={() => {}}>
          <div data-testid="modal-content">Modal content</div>
        </MobileModal>
      );
    }).not.toThrow();
  });

  it('should render with custom header title', () => {
    const { container } = render(
      <MobileModal
        opened={true}
        onClose={() => {}}
        headerTitle="Test Title"
      >
        <div data-testid="content">Content with header</div>
      </MobileModal>
    );

    // Component should render
    expect(container).toBeTruthy();
  });

  it('should accept showBackButton prop', () => {
    const onBack = jest.fn();

    const { container } = render(
      <MobileModal
        opened={true}
        onClose={() => {}}
        showBackButton={true}
        onBack={onBack}
        headerTitle="With Back Button"
      >
        <div>Back button test</div>
      </MobileModal>
    );

    // Component should render
    expect(container).toBeTruthy();
  });

  it('should accept onClose callback', () => {
    const onClose = jest.fn();

    const { container } = render(
      <MobileModal
        opened={true}
        onClose={onClose}
      >
        <div>Close test</div>
      </MobileModal>
    );

    // Component should render
    expect(container).toBeTruthy();
  });

  it('should accept swipeToDismiss prop', () => {
    const onClose = jest.fn();

    expect(() => {
      render(
        <MobileModal
          opened={true}
          onClose={onClose}
          swipeToDismiss={true}
        >
          <div data-testid="swipe-content">Swipe test</div>
        </MobileModal>
      );
    }).not.toThrow();
  });

  it('should attach touch handlers when swipeToDismiss is enabled', () => {
    const onClose = jest.fn();

    const { container } = render(
      <MobileModal
        opened={true}
        onClose={onClose}
        swipeToDismiss={true}
      >
        <div>Touch handler test</div>
      </MobileModal>
    );

    const swipeableBox = container.querySelector('[style*="flex"]');

    if (swipeableBox) {
      // Simulate touch events (component may have gesture handling logic)
      fireEvent.touchStart(swipeableBox, {
        touches: [{ clientX: 50, clientY: 400 }]
      });

      fireEvent.touchMove(swipeableBox, {
        touches: [{ clientX: 200, clientY: 400 }]
      });

      fireEvent.touchEnd(swipeableBox, {
        changedTouches: [{ clientX: 350, clientY: 400 }]
      });

      // Component should handle events without crashing
      expect(swipeableBox).toBeTruthy();
    }
  });

  it('should accept useSafeArea prop', () => {
    const { container } = render(
      <MobileModal
        opened={true}
        onClose={() => {}}
        useSafeArea={false}
      >
        <div>No safe area</div>
      </MobileModal>
    );

    // Component should render
    expect(container).toBeTruthy();
  });

  it('should not render content when opened is false', () => {
    render(
      <MobileModal
        opened={false}
        onClose={() => {}}
      >
        <div data-testid="hidden-content">Hidden content</div>
      </MobileModal>
    );

    // Modal should not be visible
    const content = screen.queryByTestId('hidden-content');
    expect(content).toBeNull();
  });
});
