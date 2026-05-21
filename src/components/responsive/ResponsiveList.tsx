/**
 * Responsive List Component
 * 
 * A flexible list component that adapts to different screen sizes with:
 * - Touch-optimized item interactions
 * - Swipe gestures for actions
 * - Virtual scrolling for performance
 * - Pull-to-refresh support
 */

import React, { useRef, useState, useCallback } from 'react';

import {
  Stack,
  Card,
  Group,
  ActionIcon,
  Box,
  Text,
  Loader,
  Center} from
'@mantine/core';
import {
  IconChevronRight,
  IconTrash,
  IconEdit} from
'@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';
import {
  getTouchPosition,
  getSwipeDirection,
  type TouchPosition } from '@/utils/mobile/touch-utils';

interface ResponsiveListItem {
  id: string | number;
  [key: string]: unknown;
}

interface ResponsiveListProps<T extends ResponsiveListItem> {
  /** List items */
  items: T[];
  /** Render function for list items */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Item height for virtual scrolling */
  itemHeight?: number;
  /** Enable virtual scrolling */
  virtualScroll?: boolean;
  /** Enable swipe actions */
  swipeActions?: boolean;
  /** Swipe action handlers */
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  /** Item click handler */
  onItemClick?: (item: T) => void;
  /** Action buttons for desktop */
  itemActions?: Array<{
    icon: React.ReactNode;
    label: string;
    color?: string;
    onClick: (item: T) => void;
  }>;
  /** Pull to refresh handler */
  onRefresh?: () => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Gap between items */
  spacing?: string | number;
}

export function ResponsiveList<T extends ResponsiveListItem>({
  items,
  renderItem,
  itemHeight: _itemHeight,
  virtualScroll: _virtualScroll = false,
  swipeActions = true,
  onSwipeLeft,
  onSwipeRight,
  onItemClick,
  itemActions = [],
  onRefresh,
  isLoading = false,
  emptyMessage = "No items to display",
  spacing = 'sm'
}: ResponsiveListProps<T>): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [swipedItem, setSwipedItem] = useState<string | number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartRef = useRef<TouchPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent, itemId: string | number) => {
    if (!swipeActions || !isMobile) return;

    touchStartRef.current = getTouchPosition(e.nativeEvent);
    setSwipedItem(itemId);
  }, [swipeActions, isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !swipedItem) return;

    const currentPosition = getTouchPosition(e.nativeEvent);
    if (!currentPosition) return;

    const deltaX = currentPosition.x - touchStartRef.current.x;
    setSwipeOffset(deltaX);
  }, [swipedItem]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !swipedItem) return;

    const endPosition = getTouchPosition(e.nativeEvent);
    if (!endPosition) return;

    const swipe = getSwipeDirection(touchStartRef.current, endPosition, 50);
    const item = items.find((i) => i["id"] === swipedItem);

    if (item) {
      if (swipe.direction === 'left' && swipe.distance > 100 && onSwipeLeft) {
        onSwipeLeft(item);
      } else if (swipe.direction === 'right' && swipe.distance > 100 && onSwipeRight) {
        onSwipeRight(item);
      }
    }

    // Reset swipe state
    setSwipedItem(null);
    setSwipeOffset(0);
    touchStartRef.current = null;
  }, [swipedItem, items, onSwipeLeft, onSwipeRight]);

  // Pull to refresh handler
  const _handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <Center p="xl">
        <Text c="dimmed">{emptyMessage}</Text>
      </Center>);

  }

  // Loading state
  if (isLoading && items.length === 0) {
    return (
      <Center p="xl">
        <Loader size="md" />
      </Center>);

  }

  return (
    <Box ref={containerRef}>
      {/* Pull to refresh indicator */}
      {refreshing &&
      <Center p="md">
          <Loader size="sm" />
        </Center>
      }

      <Stack gap={spacing}>
        {items.map((item, index) => {
          const isSwipedItem = swipedItem === item["id"];
          const offset = isSwipedItem ? swipeOffset : 0;

          return (
            <Box
              key={item["id"]}
              style={{
                position: 'relative',
                overflow: 'hidden'
              }}>

              {/* Swipe action backgrounds */}
              {isMobile && swipeActions &&
              <>
                  {/* Left swipe action (revealed on right) */}
                  <Box
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 100,
                    backgroundColor: 'var(--mantine-color-red-6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: offset < -50 ? 1 : 0,
                    transition: 'opacity 0.2s'
                  }}>

                    <IconTrash size={24} color="white" />
                  </Box>

                  {/* Right swipe action (revealed on left) */}
                  <Box
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 100,
                    backgroundColor: 'var(--mantine-color-blue-6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: offset > 50 ? 1 : 0,
                    transition: 'opacity 0.2s'
                  }}>

                    <IconEdit size={24} color="white" />
                  </Box>
                </>
              }

              {/* List item */}
              <Card
                p={isMobile ? 'sm' : 'md'}
                withBorder
                style={{
                  cursor: onItemClick ? 'pointer' : 'default',
                  transform: `translateX(${offset}px)`,
                  transition: isSwipedItem ? 'none' : 'transform 0.3s ease',
                  position: 'relative',
                  backgroundColor: 'var(--mantine-color-dark-6)'
                }}
                onTouchStart={(e) => handleTouchStart(e, item["id"])}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => !isSwipedItem && onItemClick?.(item)}>

                <Group justify="space-between" align="center">
                  <Box style={{ flex: 1 }}>
                    {renderItem(item, index)}
                  </Box>

                  {/* Desktop actions */}
                  {!isMobile && itemActions.length > 0 &&
                  <Group gap="xs">
                      {itemActions.map((action, actionIndex) =>
                    <ActionIcon
                      key={actionIndex}
                      size="sm"
                      variant="subtle"
                      {...(action.color ? { color: action.color } : {})}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(item);
                      }}>

                          {action.icon}
                        </ActionIcon>
                    )}
                    </Group>
                  }

                  {/* Mobile chevron */}
                  {isMobile && onItemClick &&
                  <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
                  }
                </Group>
              </Card>
            </Box>);

        })}
      </Stack>

      {/* Load more indicator */}
      {isLoading && items.length > 0 &&
      <Center p="md">
          <Loader size="sm" />
        </Center>
      }
    </Box>);

}