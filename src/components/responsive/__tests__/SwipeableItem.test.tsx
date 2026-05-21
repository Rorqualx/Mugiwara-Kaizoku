/**
 * Tests for SwipeableItem Component
 */

import React from 'react';

import { IconTrash, IconEdit, IconStar } from '@tabler/icons-react';
import { fireEvent, waitFor } from '@testing-library/react';

import { render } from '@/test/utils/testHelpers';

import { SwipeableItem, type SwipeAction } from '../SwipeableItem';

// Mock touch utilities - using explicit type guards for touch/mouse events
jest.mock('../../../utils/mobile/touch-utils', () => ({
  getTouchPosition: jest.fn((event: TouchEvent | MouseEvent) => {
    const touchEvent = event as TouchEvent;
    const mouseEvent = event as MouseEvent;
    const touch = 'touches' in touchEvent ? touchEvent.touches[0] : undefined;
    return {
      x: touch ? touch.clientX : mouseEvent.clientX,
      y: touch ? touch.clientY : mouseEvent.clientY
    };
  }),
  getSwipeDirection: jest.fn((start: { x: number; y: number }, end: { x: number; y: number }, threshold: number) => {
    const deltaX = end.x - start.x;
    const _deltaY = end.y - start.y;

    if (Math.abs(deltaX) < threshold) return null;

    return {
      direction: deltaX > 0 ? 'right' : 'left',
      distance: Math.abs(deltaX),
      velocity: Math.abs(deltaX) / 100
    };
  })
}));

// Helper to create proper touch events with all required properties
const createTouchEvent = (clientX: number, clientY: number): Partial<TouchEvent> => {
  const touch = { clientX, clientY, identifier: 0 } as Touch;
  const touchList = {
    length: 1,
    item: (index: number) => (index === 0 ? touch : null),
    [0]: touch,
    [Symbol.iterator]: function* () { yield touch; }
  } as unknown as TouchList;
  return {
    touches: touchList,
    changedTouches: touchList,
    targetTouches: touchList
  };
};

describe('SwipeableItem', () => {
  const mockActions: {
    left: SwipeAction[];
    right: SwipeAction[];
  } = {
    left: [
      {
        id: 'delete',
        icon: <IconTrash size={20} />,
        color: 'red',
        label: 'Delete',
        onAction: jest.fn(),
        destructive: true
      },
      {
        id: 'edit',
        icon: <IconEdit size={20} />,
        color: 'blue',
        label: 'Edit',
        onAction: jest.fn()
      }
    ],
    right: [
      {
        id: 'star',
        icon: <IconStar size={20} />,
        color: 'yellow',
        label: 'Star',
        onAction: jest.fn()
      }
    ]
  };

  const renderComponent = (props?: Partial<React.ComponentProps<typeof SwipeableItem>>): ReturnType<typeof render> => {
    return render(
      <SwipeableItem
        leftActions={mockActions.left}
        rightActions={mockActions.right}
        {...props}
      >
        <div style={{ padding: '16px' }}>Swipeable Content</div>
      </SwipeableItem>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children content', () => {
    const { getByText } = renderComponent();
    expect(getByText('Swipeable Content')).toBeInTheDocument();
  });

  it('reveals right actions on left swipe', async () => {
    const { container, queryByText } = renderComponent();
    const content = container.querySelector('[style*="translateX"]');

    // Simulate swipe left - need to exceed threshold and maxSwipe to show labels
    fireEvent.touchStart(content!, createTouchEvent(200, 100));
    fireEvent.touchMove(content!, createTouchEvent(0, 100)); // 200px swipe left to show labels

    // During swipe, check that labels are visible
    await waitFor(() => {
      expect(queryByText('Delete')).toBeInTheDocument();
      expect(queryByText('Edit')).toBeInTheDocument();
    });

    fireEvent.touchEnd(content!, createTouchEvent(0, 100));
  });

  it('reveals left actions on right swipe', async () => {
    const { container, queryByText } = renderComponent();
    const content = container.querySelector('[style*="translateX"]');

    // Simulate swipe right - need to exceed 100px to show labels
    fireEvent.touchStart(content!, createTouchEvent(0, 100));
    fireEvent.touchMove(content!, createTouchEvent(150, 100)); // 150px swipe right to show label

    // During swipe, check that label is visible
    await waitFor(() => {
      expect(queryByText('Star')).toBeInTheDocument();
    });

    fireEvent.touchEnd(content!, createTouchEvent(150, 100));
  });

  it('triggers action on full swipe', async () => {
    const mockDeleteAction = jest.fn();
    const actions = {
      left: [
        {
          id: 'delete',
          icon: <IconTrash size={20} />,
          color: 'red',
          label: 'Delete',
          onAction: mockDeleteAction,
          destructive: true
        }
      ],
      right: []
    };

    const { container } = renderComponent({
      leftActions: actions.left,
      rightActions: actions.right,
      fullSwipeTrigger: true,
      fullSwipeThreshold: 0.7
    });
    const content = container.querySelector('[style*="translateX"]');

    // Mock container width for percentage calculation
    Object.defineProperty(content, 'offsetWidth', { value: 300, writable: true });

    // Simulate full swipe left (70% of 300px = 210px)
    fireEvent.touchStart(content!, createTouchEvent(300, 100));
    fireEvent.touchMove(content!, createTouchEvent(80, 100)); // 220px swipe exceeds threshold

    // Wait for state update to trigger action
    await waitFor(() => {
      fireEvent.touchEnd(content!, createTouchEvent(80, 100));
    });

    // Action should be triggered
    await waitFor(() => {
      expect(mockDeleteAction).toHaveBeenCalledTimes(1);
    });
  });

  it('triggers action on action click', async () => {
    const mockEditAction = jest.fn();
    const actions = {
      left: [
        {
          id: 'edit',
          icon: <IconEdit size={20} />,
          color: 'blue',
          label: 'Edit',
          onAction: mockEditAction
        }
      ],
      right: []
    };

    const { container, queryByText } = renderComponent({
      leftActions: actions.left,
      rightActions: actions.right
    });
    const content = container.querySelector('[style*="translateX"]');

    // First swipe to reveal the action
    fireEvent.touchStart(content!, createTouchEvent(200, 100));
    fireEvent.touchMove(content!, createTouchEvent(0, 100)); // 200px swipe left

    // Wait for action to be visible during swipe
    let editLabel: HTMLElement | null = null;
    await waitFor(() => {
      editLabel = queryByText('Edit');
      expect(editLabel).toBeInTheDocument();
    });

    // Find the action button container - it's the parent with backgroundColor style
    const actionButton = editLabel!.parentElement!.parentElement!;

    // Click the action button while still swiped
    fireEvent.click(actionButton);

    // Action should be triggered and swipe should reset
    await waitFor(() => {
      expect(mockEditAction).toHaveBeenCalledTimes(1);
    });

    // Verify swipe has reset (transform back to 0)
    await waitFor(() => {
      expect(content).toHaveStyle({ transform: 'translateX(0px)' });
    });
  });

  it('snaps back when swipe is below threshold', async () => {
    const { container } = renderComponent({ threshold: 75 });
    const content = container.querySelector('[style*="translateX"]');

    // Simulate small swipe below threshold
    fireEvent.touchStart(content!, createTouchEvent(100, 100));
    fireEvent.touchMove(content!, createTouchEvent(50, 100)); // 50px swipe (below 75px threshold)
    fireEvent.touchEnd(content!, createTouchEvent(50, 100));

    // Should snap back to 0
    await waitFor(() => {
      expect(content).toHaveStyle({ transform: 'translateX(0px)' });
    });
  });

  it('respects maxSwipe limit', () => {
    const { container } = renderComponent({ maxSwipe: 100 });
    const content = container.querySelector('[style*="translateX"]');

    // Try to swipe beyond max
    fireEvent.touchStart(content!, createTouchEvent(300, 100));
    fireEvent.touchMove(content!, createTouchEvent(50, 100)); // 250px swipe attempt

    // Should be clamped to maxSwipe
    const transform = window.getComputedStyle(content!).transform;
    expect(transform).toContain('100'); // Max 100px
  });

  it('disables swipe when disabled prop is true', () => {
    const { container } = renderComponent({ disabled: true });
    const content = container.querySelector('[style*="translateX"]');

    fireEvent.touchStart(content!, createTouchEvent(200, 100));
    fireEvent.touchMove(content!, createTouchEvent(100, 100));
    fireEvent.touchEnd(content!, createTouchEvent(100, 100));

    // Should not move
    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
  });

  it('cancels swipe on touch cancel', () => {
    const { container } = renderComponent();
    const content = container.querySelector('[style*="translateX"]');

    fireEvent.touchStart(content!, createTouchEvent(200, 100));
    fireEvent.touchMove(content!, createTouchEvent(100, 100));
    fireEvent.touchCancel(content!);

    // Should reset to 0
    expect(content).toHaveStyle({ transform: 'translateX(0px)' });
  });

  it('shows action labels when swiped far enough', async () => {
    const { container, queryByText } = renderComponent();
    const content = container.querySelector('[style*="translateX"]');

    // Swipe past 100px to show labels
    fireEvent.touchStart(content!, createTouchEvent(200, 100));
    fireEvent.touchMove(content!, createTouchEvent(0, 100)); // 200px swipe left

    // Labels should be visible during swipe when offset > 100
    await waitFor(() => {
      expect(queryByText('Delete')).toBeInTheDocument();
      expect(queryByText('Edit')).toBeInTheDocument();
    });

    fireEvent.touchEnd(content!, createTouchEvent(0, 100));
  });
});