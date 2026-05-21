/**
 * Responsive Manga Grid Component
 *
 * An enhanced version of MangaGrid with mobile optimizations:
 * - Touch-friendly card interactions
 * - Optimized grid layout for mobile
 * - Pull-to-refresh support
 * - Lazy image loading
 * - Virtual scrolling for performance
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

import { Card, Text, Box, Loader, Center } from '@mantine/core';

import { useBreakpoint, useMobileState } from '@/hooks/mobile';
import { useStoreActions } from '@/store/useStoreActions';
import { useStoreSelectors } from '@/store/useStoreSelectors';
import type { MangaWithRelations } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { AddMangaButton } from '../addManga/AddMangaButton';

import { ResponsiveGrid } from './ResponsiveGrid';
import { ResponsiveMangaCard } from './ResponsiveMangaCard';
interface ResponsiveMangaGridProps {
    /** Optional custom update handler */
    onMangaUpdate?: (mangaId: number, data: Partial<MangaWithRelations>) => void;
    /** Optional custom selection handler */
    onMangaSelect?: (mangaId: number) => void;
    /** Enable pull to refresh on mobile */
    enablePullToRefresh?: boolean;
    /** Enable virtual scrolling for performance */
    enableVirtualScroll?: boolean;
    /** Items per page for virtual scrolling */
    itemsPerPage?: number;
}
export function ResponsiveMangaGrid({ onMangaUpdate, onMangaSelect, enablePullToRefresh = true, enableVirtualScroll = true, itemsPerPage = 30 }: ResponsiveMangaGridProps): React.ReactElement {
    const { filteredManga, currentLibrary } = useStoreSelectors();
    const storeActions = useStoreActions();
    const { handleUpdateManga } = storeActions;

    // Type assertions for actions from spread stores (Record<string, unknown>)
    // Use bracket notation for index signature access
    const setSelectedManga = storeActions["setSelectedManga"] as ((id: number | null) => void) | undefined;
    const setModal = storeActions["setModal"] as ((modalId: string | null) => void) | undefined;

    const { isMobile } = useBreakpoint();
    const { touchSettings } = useMobileState();
    // State for virtual scrolling
    // Use Manga type from Prisma (as that's what filteredManga provides)
    const [visibleItems, setVisibleItems] = useState<typeof filteredManga>([]);
    const [page, setPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    // Refs for pull to refresh
    const containerRef = useRef<HTMLDivElement>(null);
    const pullStartY = useRef<number | null>(null);
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    // Intersection observer for infinite scrolling
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    // Initialize visible items
    useEffect(() => {
        if (!enableVirtualScroll) {
            setVisibleItems(filteredManga);
        }
        else {
            setVisibleItems(filteredManga.slice(0, itemsPerPage));
        }
        setPage(1);
    }, [filteredManga, enableVirtualScroll, itemsPerPage]);
    // Load more items
    const loadMore = useCallback(() => {
        if (!enableVirtualScroll || isLoadingMore)
            return;
        setIsLoadingMore(true);
        const nextPage = page + 1;
        const startIndex = (nextPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const newItems = filteredManga.slice(0, endIndex);
        // Simulate network delay for smooth experience
        setTimeout(() => {
            setVisibleItems(newItems);
            setPage(nextPage);
            setIsLoadingMore(false);
        }, 300);
    }, [page, itemsPerPage, filteredManga, enableVirtualScroll, isLoadingMore]);
    // Setup intersection observer
    useEffect(() => {
        if (!enableVirtualScroll)
            return;
        const options = {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        };
        observerRef.current = new IntersectionObserver(entries => {
            const firstEntry = entries[0];
            if (firstEntry?.isIntersecting && !isLoadingMore) {
                loadMore();
            }
        }, options);
        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [loadMore, isLoadingMore, enableVirtualScroll]);
    // Pull to refresh handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enablePullToRefresh || !isMobile || !touchSettings.pullToRefreshEnabled)
            return;
        const touch = e.touches[0];
        if (touch && containerRef.current?.scrollTop === 0) {
            pullStartY.current = touch.clientY;
        }
    }, [enablePullToRefresh, isMobile, touchSettings.pullToRefreshEnabled]);
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!pullStartY.current)
            return;
        const touch = e.touches[0];
        if (touch) {
            const distance = touch.clientY - pullStartY.current;
            if (distance > 0 && containerRef.current?.scrollTop === 0) {
                e.preventDefault();
                setIsPulling(true);
                setPullDistance(Math.min(distance, 150)); // Max pull distance
            }
        }
    }, []);
    const handleRefresh = useCallback(() => {
        // Implement refresh logic here
        logger.info('Refreshing manga list...');
        // You would typically call a refresh action from your store here
    }, []);
    const handleTouchEnd = useCallback(() => {
        if (isPulling && pullDistance > 80) {
            // Trigger refresh
            void handleRefresh();
        }
        pullStartY.current = null;
        setIsPulling(false);
        setPullDistance(0);
    }, [handleRefresh, isPulling, pullDistance]);
    // Show message if no library is selected
    if (!currentLibrary) {
        return <Card shadow="sm" p="xl">
        <Text>No library selected. Please create or select a library.</Text>
      </Card>;
    }
    return <Box ref={containerRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{
            position: 'relative',
            overflow: 'hidden'
        }}>

      {/* Pull to refresh indicator */}
      {isPulling && <Box style={{
                position: 'absolute',
                top: -50,
                left: '50%',
                transform: `translateX(-50%) translateY(${pullDistance}px)`,
                transition: 'none',
                zIndex: 10
            }}>

          <Loader size="sm"/>
        </Box>}

      <ResponsiveGrid cols={{
            base: 2,
            xs: 2,
            sm: 3,
            md: 4,
            lg: 5,
            xl: 6
        }} compactOnMobile minColWidth={150} style={{
            transform: isPulling ? `translateY(${pullDistance / 3}px)` : 'translateY(0)',
            transition: isPulling ? 'none' : 'transform 0.3s ease'
        }}>

        {/* Add Manga button */}
        <AddMangaButton onClick={() => {
                if (setModal !== undefined) {
                    setModal('addManga');
                }
            }}/>

        {/* Manga cards */}
        {visibleItems.map(manga => <ResponsiveMangaCard key={manga["id"]} manga={manga as MangaWithRelations} onRemove={shouldRemoveFiles => {
                // Handle remove - To be implemented
                logger.info(`Remove manga ${manga["id"]}, remove files: ${shouldRemoveFiles}`);
            }} onUpdate={() => {
                if (onMangaUpdate) {
                    onMangaUpdate(toNumberId(manga["id"]), {});
                }
                else {
                    void handleUpdateManga(typeof manga["id"] === 'string' ? toNumberId(manga["id"]) : manga["id"], {});
                }
            }} onRefresh={() => {
                // Handle refresh - To be implemented
                logger.info(`Refresh manga ${manga["id"]}`);
            }} onClick={() => {
                if (onMangaSelect) {
                    onMangaSelect(toNumberId(manga["id"]));
                }
                else {
                    if (setSelectedManga !== undefined) {
                        setSelectedManga(typeof manga["id"] === 'string' ? toNumberId(manga["id"]) : manga["id"]);
                    }
                    if (setModal !== undefined) {
                        setModal('mangaDetail');
                    }
                }
            }} showMobileActions={touchSettings.swipeEnabled}/>)}
      </ResponsiveGrid>

      {/* Load more trigger */}
      {enableVirtualScroll && visibleItems.length < filteredManga.length && <Center ref={loadMoreRef} p="xl">
          {isLoadingMore && <Loader size="sm"/>}
        </Center>}

      {/* No more items message */}
      {enableVirtualScroll && visibleItems.length >= filteredManga.length && filteredManga.length > itemsPerPage && <Center p="md">
          <Text size="sm" c="dimmed">All manga loaded</Text>
        </Center>}
    </Box>;
}
