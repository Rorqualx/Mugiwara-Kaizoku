/**
 * Tests for LongPressable Component
 */

import React from 'react';

import { fireEvent, waitFor, act } from '@testing-library/react';

import '@testing-library/react';

import { render } from '@/test/utils/testHelpers';

import { LongPressable } from '../LongPressable';

// Mock touch utilities - using explicit type guards for touch/mouse events
jest.mock('../../../utils/mobile/touch-utils', (): { getTouchPosition: jest.Mock; getTouchDistance: jest.Mock } => ({
  getTouchPosition: jest.fn((event: React.TouchEvent | React.MouseEvent) => {
    const touchEvent = event as React.TouchEvent;
    const mouseEvent = event as React.MouseEvent;
    const touch = 'touches' in touchEvent ? touchEvent.touches[0] : undefined;
    return {
      x: touch ? touch.clientX : mouseEvent.clientX,
      y: touch ? touch.clientY : mouseEvent.clientY
    };
  }),
  getTouchDistance: jest.fn((pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  })
}));

// Mock navigator.vibrate
const mockVibrate = jest.fn();
Object.defineProperty(navigator, 'vibrate', {
  value: mockVibrate,
  configurable: true
});

describe('LongPressable', () => {
  const mockOnLongPress = jest.fn();
  const mockOnClick = jest.fn();

  const renderComponent = (props?: Partial<React.ComponentProps<typeof LongPressable>>): ReturnType<typeof render> => {
    return render(
      <LongPressable
        onLongPress={mockOnLongPress}
        onClick={mockOnClick}
        {...props}
      >
        <button>Press and hold me</button>
      </LongPressable>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children content', () => {
    const { getByText } = renderComponent();
    expect(getByText('Press and hold me')).toBeInTheDocument();
  });

  it('triggers long press after duration', async () => {
    const { getByText } = renderComponent({ duration: 500 });
    const button = getByText('Press and hold me');

    // Start the press
    fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });

    // Wait for the long press duration to complete
    await waitFor(
      () => {
        expect(mockOnLongPress).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    // Verify vibrate was called
    expect(mockVibrate).toHaveBeenCalledWith(50);
  });

  it('triggers click on short press', async () => {
    const { getByText } = renderComponent({ duration: 500 });
    const button = getByText('Press and hold me');

    // Start the press
    fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });

    // Release before long press duration (100ms < 500ms)
    await new Promise(resolve => { setTimeout(resolve, 100); });
    fireEvent.mouseUp(button);

    // Click should be triggered, not long press
    await waitFor(() => {
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnLongPress).not.toHaveBeenCalled();
    });
  });

  it('cancels long press on movement beyond threshold', async () => {
    const { getByText } = renderComponent({ duration: 500, moveThreshold: 10 });
    const button = getByText('Press and hold me');

    // Start the press at position (100, 100)
    fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });

    // Move the mouse beyond the threshold (>10 pixels)
    // Moving to (120, 120) = sqrt((20)^2 + (20)^2) = ~28 pixels
    fireEvent.mouseMove(button, { clientX: 120, clientY: 120 });

    // Wait for duration to pass
    await new Promise(resolve => { setTimeout(resolve, 600); });

    // Long press should be canceled due to movement
    expect(mockOnLongPress).not.toHaveBeenCalled();

    // Cleanup
    fireEvent.mouseUp(button);
  });

  it('works with touch events', async () => {
    const { getByText } = renderComponent({ duration: 500 });
    const button = getByText('Press and hold me');

    // Start touch event at position (100, 100)
    fireEvent.touchStart(button, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    // Wait for the long press duration to pass
    await new Promise(resolve => { setTimeout(resolve, 600); });

    // Long press should be triggered
    await waitFor(() => {
      expect(mockOnLongPress).toHaveBeenCalledTimes(1);
    });

    // Cleanup
    fireEvent.touchEnd(button);
  });

  it('shows progress feedback', async () => {
    const { getByText, container } = renderComponent({
      showFeedback: true,
      feedbackPosition: 'inline'
    });
    const button = getByText('Press and hold me');

    // Trigger press start
    fireEvent.mouseDown(button, {
      clientX: 100,
      clientY: 100
    });

    // Wait for the inline feedback to render
    // The inline feedback is a div with specific styles rendered inside the component
    await waitFor(() => {
      const feedbackDiv = container.querySelector('[style*="position: absolute"]');
      expect(feedbackDiv).toBeInTheDocument();
    });

    // Cleanup
    fireEvent.mouseUp(button);
  });

  it('respects disabled prop', () => {
    const { getByText, container } = renderComponent({ disabled: true });
    const button = getByText('Press and hold me');

    // Trigger press start
    button.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 100,
        clientY: 100
      })
    );

    // Progress should not be shown when disabled
    const progressElements = container.querySelectorAll('[role="progressbar"]');
    expect(progressElements.length).toBe(0);

    // Callbacks should not be invoked
    expect(mockOnLongPress).not.toHaveBeenCalled();
    expect(mockOnClick).not.toHaveBeenCalled();

    // Cleanup
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  // Skip tests that require jest.useFakeTimers() - not supported in Bun
  it.skip('cleans up on mouse leave', () => {
    jest.useFakeTimers();

    const { getByText } = renderComponent();
    const button = getByText('Press and hold me');

    // Start pressing
    act(() => {
      fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });
    });

    // Advance time partially
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Mouse leaves before long press completes
    act(() => {
      fireEvent.mouseLeave(button);
    });

    // Advance past the long press duration
    act(() => {
      jest.advanceTimersByTime(400);
    });

    // Long press should not have been triggered
    expect(mockOnLongPress).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  // Skip tests that require jest.useFakeTimers() - not supported in Bun
  it.skip('cleans up on touch cancel', () => {
    jest.useFakeTimers();

    const { getByText } = renderComponent();
    const button = getByText('Press and hold me');

    // Start touch - create a proper Touch mock with all required properties
    const touch = {
      clientX: 100,
      clientY: 100,
      identifier: 0,
      target: button,
      force: 1,
      pageX: 100,
      pageY: 100,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      screenX: 100,
      screenY: 100
    } as unknown as Touch;
    act(() => {
      fireEvent.touchStart(button, {
        touches: [touch] as unknown as TouchList
      });
    });

    // Advance time partially
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Touch cancelled before long press completes
    act(() => {
      fireEvent.touchCancel(button);
    });

    // Advance past the long press duration
    act(() => {
      jest.advanceTimersByTime(400);
    });

    // Long press should not have been triggered
    expect(mockOnLongPress).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  // Skip tests that require jest.useFakeTimers() - not supported in Bun
  it.skip('uses custom feedback component', () => {
    jest.useFakeTimers();

    const CustomFeedback = (): JSX.Element => (
      <div data-testid="custom-feedback">Custom Feedback</div>
    );

    const { getByText, container } = renderComponent({
      feedbackPosition: 'overlay',
      feedbackComponent: <CustomFeedback />
    });
    const button = getByText('Press and hold me');

    // Start pressing
    act(() => {
      fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });
    });

    // Advance timers to trigger interval update
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Custom feedback should be rendered inside Portal
    const portal = container.querySelector('[data-portal="true"]');
    expect(portal).toBeInTheDocument();

    const customFeedback = container.querySelector('[data-testid="custom-feedback"]');
    expect(customFeedback).toBeInTheDocument();
    expect(customFeedback).toHaveTextContent('Custom Feedback');

    // Cleanup
    act(() => {
      fireEvent.mouseUp(button);
    });

    jest.useRealTimers();
  });

  // Skip tests that require jest.useFakeTimers() - not supported in Bun
  it.skip('shows inline feedback when specified', () => {
    jest.useFakeTimers();

    const { getByText, container } = renderComponent({
      feedbackPosition: 'inline'
    });
    const button = getByText('Press and hold me');

    // Start pressing
    act(() => {
      fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });
    });

    // Advance time to show feedback
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Inline feedback should be rendered (Progress component in inline position)
    const progressElements = container.querySelectorAll('[role="progressbar"]');
    expect(progressElements.length).toBeGreaterThan(0);

    // Cleanup
    act(() => {
      fireEvent.mouseUp(button);
    });

    jest.useRealTimers();
  });

  // Skip tests that require jest.useFakeTimers() - not supported in Bun
  it.skip('updates progress during press', () => {
    jest.useFakeTimers();

    const { getByText, container } = renderComponent({
      duration: 1000,
      feedbackPosition: 'inline'
    });
    const button = getByText('Press and hold me');

    // Start pressing
    act(() => {
      fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });
    });

    // Advance time to 25% completion
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Progress should be visible
    const progressElements = container.querySelectorAll('[role="progressbar"]');
    expect(progressElements.length).toBeGreaterThan(0);

    // Cleanup
    act(() => {
      fireEvent.mouseUp(button);
    });

    jest.useRealTimers();
  });

  // Skip tests that require jest.useFakeTimers() - not supported in Bun
  it.skip('does not trigger click after long press', () => {
    jest.useFakeTimers();

    const { getByText } = renderComponent();
    const button = getByText('Press and hold me');

    // Start pressing
    act(() => {
      fireEvent.mouseDown(button, { clientX: 100, clientY: 100 });
    });

    // Advance past long press duration
    act(() => {
      jest.advanceTimersByTime(600);
    });

    // Long press should have been triggered
    expect(mockOnLongPress).toHaveBeenCalledTimes(1);

    // Release after long press
    act(() => {
      fireEvent.mouseUp(button);
    });

    // Click handler should not be called
    expect(mockOnClick).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
