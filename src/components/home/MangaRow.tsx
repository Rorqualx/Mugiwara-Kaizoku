"use client";

/**
 * MangaRow component for Netflix-style horizontal scrolling
 *
 * This component provides a horizontal scrolling row of manga cards with:
 * - Section title with optional "View All" link
 * - Native CSS scroll-snap for smooth scrolling
 * - Left/right arrow navigation buttons (desktop only)
 * - Touch/swipe support for mobile
 * - Responsive card display (2-6 cards per view)
 * - Skeleton loading state
 * - Empty state message
 *
 * @remarks
 * Implementation:
 * - Uses native CSS overflow-x with scroll-snap-type
 * - Arrow buttons positioned absolute at edges
 * - Hides scrollbar but keeps functionality
 * - Shows/hides arrows based on scroll position
 *
 * Accessibility:
 * - Keyboard navigation (arrow keys)
 * - ARIA labels for screen readers
 * - Focus management
 *
 * Performance:
 * - useMemo for card list optimization
 * - Efficient scroll event handling
 * - Minimal re-renders
 */

import * as React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";

import {
  Box,
  Text,
  Group,
  ActionIcon,
  Anchor,
  Skeleton,
  Paper,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useRouter } from "next/router";

import { MangaRowCard, type MangaRowCardProps } from "./MangaRowCard";

/**
 * Props for the MangaRow component
 */
export interface MangaRowProps {
  /** Section title */
  title: string;
  /** Array of manga to display */
  manga: Array<MangaRowCardProps["manga"]>;
  /** Optional "View All" link href */
  viewAllHref?: string;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Click handler for manga cards - receives AniList ID */
  onMangaClick?: (anilistId: number) => void;
}

/**
 * Calculate card width based on viewport
 *
 * @param containerWidth - Width of the container
 * @returns Card width in pixels
 */
function getCardWidth(containerWidth: number): number {
  // Mobile: 150px, Desktop: 180px
  if (containerWidth < 768) {
    return 150;
  }
  return 180;
}

/**
 * Calculate number of visible cards based on viewport
 *
 * @param containerWidth - Width of the container
 * @returns Number of visible cards
 */
function getVisibleCards(
  containerWidth: number
): number {
  if (containerWidth < 576) return 2; // Mobile
  if (containerWidth < 768) return 3; // Small tablet
  if (containerWidth < 992) return 4; // Tablet
  if (containerWidth < 1200) return 5; // Small desktop
  return 6; // Desktop
}

/**
 * Horizontal scrolling row of manga cards with arrow navigation
 *
 * This component displays manga in a Netflix-style horizontal scrolling row.
 * It includes navigation arrows, touch support, and responsive behavior.
 *
 * @param props - Component properties
 * @param props.title - Section title
 * @param props.manga - Array of manga to display
 * @param props.viewAllHref - Optional "View All" link
 * @param props.loading - Loading state
 * @param props.emptyMessage - Empty state message
 * @returns A horizontal scrolling row component
 *
 * @example
 * ```tsx
 * <MangaRow
 *   title="Recently Added"
 *   manga={mangaList}
 *   viewAllHref="/manga/recent"
 *   loading={isLoading}
 *   emptyMessage="No manga found"
 * />
 * ```
 */
export function MangaRow({
  title,
  manga,
  viewAllHref,
  loading = false,
  emptyMessage = "No manga to display",
  onMangaClick,
}: MangaRowProps): React.JSX.Element {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);

  /**
   * Handle manga card click
   * - If anilistId exists, use the provided onMangaClick handler (opens modal)
   * - If only local id exists, navigate to manga detail page
   */
  const handleMangaClick = useCallback((item: MangaRowCardProps["manga"]): void => {
    if (item.anilistId !== undefined && item.anilistId !== null && onMangaClick) {
      // AniList manga - use modal
      onMangaClick(item.anilistId);
    } else if (item.id) {
      // Local manga - navigate to detail page
      void router.push(`/manga/${item.id}`);
    }
  }, [onMangaClick, router]);

  // Calculate card dimensions
  const cardWidth = useMemo(
    () => getCardWidth(containerWidth),
    [containerWidth]
  );
  const gap = 16; // Gap between cards
  const visibleCards = useMemo(
    () => getVisibleCards(containerWidth),
    [containerWidth]
  );

  const updateArrowVisibility = useCallback((): void => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft: sl, scrollWidth, clientWidth } = container;

    setShowLeftArrow(sl > 0);
    setShowRightArrow(sl < scrollWidth - clientWidth - 10);
  }, []);

  const scrollLeft = useCallback((): void => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = visibleCards * (cardWidth + gap);
    container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  }, [visibleCards, cardWidth, gap]);

  const scrollRight = useCallback((): void => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = visibleCards * (cardWidth + gap);
    container.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }, [visibleCards, cardWidth, gap]);

  /**
   * Handle container resize
   */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateArrowVisibility);
    updateArrowVisibility();

    return () => {
      container.removeEventListener("scroll", updateArrowVisibility);
    };
  }, [updateArrowVisibility]);

  /**
   * Memoized card list for performance
   */
  const cardList = useMemo(() => {
    if (loading) {
      // Show skeleton cards
      return Array.from({ length: visibleCards }).map((_, index) => (
        <Box
          key={`skeleton-${index}`}
          style={{
            minWidth: `${cardWidth}px`,
            scrollSnapAlign: "start",
          }}
        >
          <Skeleton height={cardWidth * 1.5} radius="md" />
          <Skeleton height={20} mt="xs" width="80%" />
        </Box>
      ));
    }

    if (manga.length === 0) {
      return null;
    }

    return manga.map((item) => (
      <Box
        key={item.id}
        style={{
          minWidth: `${cardWidth}px`,
          scrollSnapAlign: "start",
        }}
      >
        <MangaRowCard
          manga={item}
          onClick={() => handleMangaClick(item)}
        />
      </Box>
    ));
  }, [manga, loading, visibleCards, cardWidth, handleMangaClick]);

  return (
    <Box
      style={{
        width: "100%",
        position: "relative",
        paddingTop: "20px",
        paddingBottom: "20px",
      }}
    >
      {/* Header with title and View All link */}
      <Group justify="space-between" mb="md" px="20px">
        <Text size="xl" fw={700} c="white">
          {title}
        </Text>
        {viewAllHref && (
          <Anchor href={viewAllHref} size="sm" c="dimmed">
            View All
          </Anchor>
        )}
      </Group>

      {/* Scrollable container */}
      <Box
        style={{
          position: "relative",
        }}
      >
        {/* Left arrow */}
        {showLeftArrow && !loading && (
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="dark"
            onClick={scrollLeft}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 20,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(8px)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.9)",
              },
            }}
            aria-label="Scroll left"
          >
            <IconChevronLeft size={24} />
          </ActionIcon>
        )}

        {/* Right arrow */}
        {showRightArrow && !loading && (
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="dark"
            onClick={scrollRight}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 20,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(8px)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.9)",
              },
            }}
            aria-label="Scroll right"
          >
            <IconChevronRight size={24} />
          </ActionIcon>
        )}

        {/* Scroll container */}
        <Box
          ref={scrollContainerRef}
          className="hide-scrollbar"
          style={{
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            gap: `${gap}px`,
            scrollSnapType: "x mandatory",
            scrollBehavior: "smooth",
            paddingLeft: "20px",
            paddingRight: "20px",
            paddingBottom: "10px",
          }}
        >
          {cardList}
        </Box>

        {/* Empty state */}
        {!loading && manga.length === 0 && (
          <Paper
            shadow="sm"
            p="xl"
            radius="md"
            mx="20px"
            style={{
              textAlign: "center",
            }}
          >
            <Text c="dimmed">{emptyMessage}</Text>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
