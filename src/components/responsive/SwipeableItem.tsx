/**
 * Swipeable Item Component
 * 
 * Provides swipe gesture support for list items with:
 * - Customizable swipe actions
 * - Visual feedback during swipe
 * - Smooth animations
 * - Threshold configuration
 */

import React, { useRef, useState, useCallback } from 'react';

import { Box, Text} from '@mantine/core';

import {
  getTouchPosition,
  getSwipeDirection,
  type TouchPosition } from '@/utils/mobile/touch-utils';
import { isObject, hasPropertyOfType, isNumber } from '@/utils/type-guards';


export interface SwipeAction {
  /** Unique identifier for the action */
  id: string;
  /** Icon to display */
  icon: React.ReactNode;
  /** Background color */
  color: string;
  /** Action label (for accessibility) */
  label: string;
  /** Action handler */
  onAction: () => void;
  /** Whether this is a destructive action */
  destructive?: boolean;
}

interface SwipeableItemProps {
  /** Item content */
  children: React.ReactNode;
  /** Left swipe actions (revealed on right) */
  leftActions?: SwipeAction[];
  /** Right swipe actions (revealed on left) */
  rightActions?: SwipeAction[];
  /** Swipe threshold in pixels */
  threshold?: number;
  /** Maximum swipe distance */
  maxSwipe?: number;
  /** Whether to allow full swipe to trigger action */
  fullSwipeTrigger?: boolean;
  /** Full swipe threshold (percentage of width) */
  fullSwipeThreshold?: number;
  /** Disable swipe */
  disabled?: boolean;
  /** Custom styles */
  style?: React.CSSProperties;
}

export function SwipeableItem({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 75,
  maxSwipe = 200,
  fullSwipeTrigger = true,
  fullSwipeThreshold = 0.7,
  disabled = false,
  style
}: SwipeableItemProps): React.ReactElement {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [triggeredAction, setTriggeredAction] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchPosition | null>(null);
  const startTimeRef = useRef<number>(0);

  // Determine which actions to show based on swipe direction
  const visibleActions = offset > 0 ? rightActions : leftActions;
  const _actionWidth = Math.min(Math.abs(offset), maxSwipe) / visibleActions.length;

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    const touchPosition = getTouchPosition(e.nativeEvent);
    if (touchPosition && isObject(touchPosition) && hasPropertyOfType(touchPosition, 'x', isNumber) && hasPropertyOfType(touchPosition, 'y', isNumber)) {
      touchStartRef.current = touchPosition;
      startTimeRef.current = Date.now();
      setIsDragging(true);
    }
  }, [disabled]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || disabled) return;

    const currentPosition = getTouchPosition(e.nativeEvent);
    if (!currentPosition || !isObject(currentPosition) || !hasPropertyOfType(currentPosition, 'x', isNumber)) return;

    const deltaX = currentPosition.x - touchStartRef.current.x;
    const clampedOffset = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));

    setOffset(clampedOffset);

    // Check for full swipe trigger
    if (fullSwipeTrigger && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const swipePercentage = Math.abs(clampedOffset) / containerWidth;

      if (swipePercentage >= fullSwipeThreshold) {
        const actions = clampedOffset > 0 ? rightActions : leftActions;
        const primaryAction = actions.find((a) => a.destructive) ?? actions[0];

        if (primaryAction && primaryAction.id !== triggeredAction) {
          setTriggeredAction(primaryAction.id);
          // Haptic feedback would go here
        }
      } else {
        setTriggeredAction(null);
      }
    }
  }, [disabled, maxSwipe, fullSwipeTrigger, fullSwipeThreshold, leftActions, rightActions, triggeredAction]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || disabled) return;

    const endPosition = getTouchPosition(e.nativeEvent);
    if (!endPosition || !isObject(endPosition) || !hasPropertyOfType(endPosition, 'x', isNumber) || !hasPropertyOfType(endPosition, 'y', isNumber)) return;

    const _duration = Date.now() - startTimeRef.current;
    const _swipe = getSwipeDirection(touchStartRef.current, endPosition, 10);

    // Execute triggered action
    if (triggeredAction) {
      const action = [...leftActions, ...rightActions].find((a) => a.id === triggeredAction);
      action?.onAction();
      setOffset(0);
    }
    // Check if swipe exceeded threshold
    else if (Math.abs(offset) >= threshold) {
      // Keep the item open to show actions
      const targetOffset = offset > 0 ?
      Math.min(maxSwipe, rightActions.length * 80) :
      Math.max(-maxSwipe, -leftActions.length * 80);
      setOffset(targetOffset);
    }
    // Snap back if below threshold
    else {
      setOffset(0);
    }

    setIsDragging(false);
    setTriggeredAction(null);
    touchStartRef.current = null;
  }, [disabled, offset, threshold, maxSwipe, triggeredAction, leftActions, rightActions]);

  // Handle action click
  const handleActionClick = (action: SwipeAction): void => {
    action.onAction();
    setOffset(0);
  };

  return (
    <Box
      ref={containerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'pan-y',
        ...style
      }}>

      {/* Action backgrounds */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: offset > 0 ? 0 : undefined,
          right: offset < 0 ? 0 : undefined,
          width: Math.abs(offset),
          display: 'flex',
          flexDirection: offset > 0 ? 'row' : 'row-reverse',
          alignItems: 'center',
          opacity: Math.min(1, Math.abs(offset) / threshold)
        }}>

        {visibleActions.map((action, _index) =>
        <Box
          key={action.id}
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: action.color,
            opacity: triggeredAction === action.id ? 1 : 0.8,
            transform: triggeredAction === action.id ? 'scale(1.1)' : 'scale(1)',
            transition: isDragging ? 'none' : 'all 0.2s ease'
          }}
          onClick={() => handleActionClick(action)}>

            <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: 'white'
            }}>

              {action.icon}
              {Math.abs(offset) > 100 &&
            <Text size="xs" fw={500}>
                  {action.label}
                </Text>
            }
            </Box>
          </Box>
        )}
      </Box>

      {/* Main content */}
      <Box
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease',
          position: 'relative',
          backgroundColor: 'var(--mantine-color-body)',
          zIndex: 1
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          setOffset(0);
          setIsDragging(false);
        }}>

        {children}
      </Box>
    </Box>);

}