/**
 * Pull-to-Search Component
 *
 * Mobile-optimized search with:
 * - Pull down gesture to reveal search
 * - Auto-focus on reveal
 * - Recent searches
 * - Search suggestions
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { JSX } from 'react';


import { Box, TextInput, ActionIcon, Text, ScrollArea, Group, Badge } from '@mantine/core';
import { useDebouncedValue, useClickOutside, useMergedRef } from '@mantine/hooks';
import { IconSearch, IconX, IconClock, IconArrowUp } from '@tabler/icons-react';
import { z } from 'zod';

import { MotionSafe } from '@/components/performance/ReducedMotion';
import { logger } from '@/utils/logger';

/** Helper component for suggestion items with proper hover handling */
function SuggestionItem({
    suggestion,
    onClick
}: {
    suggestion: SearchSuggestion;
    onClick: () => void;
}): JSX.Element {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Box
            style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderRadius: 'var(--mantine-radius-sm)',
                transition: 'background-color 0.2s ease',
                backgroundColor: isHovered ? 'var(--mantine-color-gray-0)' : 'transparent'
            }}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Group justify="space-between">
                <Group gap="sm">
                    {suggestion.type === 'recent' &&
                        <IconClock size={16} color="var(--mantine-color-gray-6)"/>}
                    {suggestion.type === 'trending' &&
                        <IconArrowUp size={16} color="var(--mantine-color-blue-6)"/>}
                    <Text size="sm">{suggestion.text}</Text>
                </Group>

                {suggestion.count &&
                    <Badge size="sm" variant="light">
                        {suggestion.count}
                    </Badge>}
            </Group>
        </Box>
    );
}

// Zod schema for validating recent searches from localStorage
const RecentSearchesSchema = z.array(z.string());

export interface SearchSuggestion {
    id: string;
    text: string;
    type: 'recent' | 'trending' | 'suggestion';
    count?: number;
}
export interface PullToSearchProps {
    /** Placeholder text */
    placeholder?: string;
    /** Search handler */
    onSearch: (query: string) => void;
    /** Get search suggestions */
    getSuggestions?: (query: string) => Promise<SearchSuggestion[]>;
    /** Recent searches */
    recentSearches?: string[];
    /** Trending searches */
    trendingSearches?: SearchSuggestion[];
    /** Max recent searches to show */
    maxRecentSearches?: number;
    /** Auto focus on reveal */
    autoFocus?: boolean;
    /** Pull threshold */
    pullThreshold?: number;
    /** Z-index */
    zIndex?: number;
    /** Custom styles */
    style?: React.CSSProperties;
}

// Stable default values to prevent useEffect infinite loops from new array references
const DEFAULT_RECENT_SEARCHES: string[] = [];
const DEFAULT_TRENDING_SEARCHES: SearchSuggestion[] = [];

export function PullToSearch({ placeholder = 'Search...', onSearch, getSuggestions, recentSearches = DEFAULT_RECENT_SEARCHES, trendingSearches = DEFAULT_TRENDING_SEARCHES, maxRecentSearches = 5, autoFocus = true, pullThreshold = 80, zIndex = 100, style }: PullToSearchProps): JSX.Element {
    const [isRevealed, setIsRevealed] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const startYRef = useRef(0);
    const [debouncedQuery] = useDebouncedValue(query, 300);
    // Click outside to close
    const clickOutsideRef = useClickOutside(() => {
        if (isRevealed && !query) {
            setIsRevealed(false);
            setShowSuggestions(false);
        }
    });
    // Combine refs using useMergedRef
    const mergedSearchRef = useMergedRef(searchRef, clickOutsideRef);
    // Handle touch start
    const handleTouchStart = useCallback((e: TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) return;
        startYRef.current = touch.clientY;
        setIsPulling(true);
    }, []);
    // Handle touch move
    const handleTouchMove = useCallback((e: TouchEvent): void => {
        if (!isPulling)
            return;
        const touch = e.touches[0];
        if (!touch) return;
        const deltaY = touch.clientY - startYRef.current;
        if (deltaY > 0 && window.scrollY === 0) {
            e.preventDefault();
            setPullDistance(Math.min(deltaY, pullThreshold * 1.5));
            if (deltaY > pullThreshold && !isRevealed) {
                setIsRevealed(true);
            }
        }
    }, [isPulling, pullThreshold, isRevealed]);
    // Handle touch end
    const handleTouchEnd = useCallback((): void => {
        setIsPulling(false);
        setPullDistance(0);
    }, []);
    // Add touch listeners
    useEffect(() => {
        if (!isRevealed) {
            document.addEventListener('touchstart', handleTouchStart, { passive: true });
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
            return () => {
                document.removeEventListener('touchstart', handleTouchStart);
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [isRevealed, handleTouchStart, handleTouchMove, handleTouchEnd]);
    // Auto focus when revealed
    useEffect(() => {
        if (isRevealed && autoFocus && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
        }
    }, [isRevealed, autoFocus]);
    // Load suggestions
    useEffect(() => {
        const loadSuggestions = async (): Promise<void> => {
            if (debouncedQuery && getSuggestions) {
                const results = await getSuggestions(debouncedQuery);
                setSuggestions(results);
            }
            else if (!query) {
                // Show recent and trending when no query
                const combined: SearchSuggestion[] = [];
                // Add recent searches
                recentSearches.slice(0, maxRecentSearches).forEach((text, i) => {
                    combined.push({
                        id: `recent-${i}`,
                        text,
                        type: 'recent'
                    });
                });
                // Add trending searches
                combined.push(...trendingSearches);
                setSuggestions(combined);
            }
        };
        void loadSuggestions();
    }, [debouncedQuery, query, getSuggestions, recentSearches, trendingSearches, maxRecentSearches]);
    // Handle search submit
    const handleSearchSubmit = useCallback((searchQuery: string): void => {
        if (searchQuery.trim()) {
            onSearch(searchQuery);
            setQuery('');
            setIsRevealed(false);
            setShowSuggestions(false);
        }
    }, [onSearch]);
    // Handle suggestion click
    const handleSuggestionClick = useCallback((suggestion: SearchSuggestion): void => {
        handleSearchSubmit(suggestion.text);
    }, [handleSearchSubmit]);
    return (<>
      {/* Pull indicator */}
      {!isRevealed &&
            <MotionSafe style={{
                    position: 'fixed',
                    top: 0,
                    left: '50%',
                    transform: `translateX(-50%) translateY(${Math.min(pullDistance, pullThreshold)}px)`,
                    opacity: Math.min(pullDistance / pullThreshold, 1),
                    transition: isPulling ? 'none' : 'all 0.3s ease-out',
                    pointerEvents: 'none',
                    zIndex
                }}>

          <Box style={{
                    backgroundColor: 'var(--mantine-color-body)',
                    borderRadius: 'var(--mantine-radius-xl)',
                    padding: '8px 16px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}>

            <Group gap="xs">
              <IconSearch size={16}/>
              <Text size="sm">Pull down to search</Text>
            </Group>
          </Box>
        </MotionSafe>}
      
      {/* Search overlay */}
      <MotionSafe ref={mergedSearchRef as unknown as React.Ref<HTMLElement>} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${isRevealed ? 0 : -100}%)`,
            transition: 'transform 0.3s ease-out',
            backgroundColor: 'var(--mantine-color-body)',
            boxShadow: isRevealed ? '0 4px 20px rgba(0, 0, 0, 0.1)' : 'none',
            zIndex,
            ...style
        }} animation={{
            willChange: 'transform'
        }}>

        <Box style={{ padding: 'md' }}>
          <TextInput ref={inputRef} value={query} onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
        }} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                handleSearchSubmit(query);
            }
            else if (e.key === 'Escape') {
                setIsRevealed(false);
                setShowSuggestions(false);
            }
        }} placeholder={placeholder} leftSection={<IconSearch size={18}/>} rightSection={query &&
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setQuery('')}>

                  <IconX size={16}/>
                </ActionIcon>} size="lg" radius="xl" styles={{
            input: {
                backgroundColor: 'var(--mantine-color-gray-0)',
                border: 'none'
            }
        }}/>

        </Box>
        
        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 &&
            <ScrollArea style={{
                    maxHeight: '60vh',
                    borderTop: '1px solid var(--mantine-color-gray-2)'
                }}>

            <Box style={{ padding: 'sm' }}>
              {suggestions.map((suggestion) => (
                  <SuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                  />
              ))}
            </Box>
          </ScrollArea>}
      </MotionSafe>
    </>);
}
/**
 * Hook for managing search state
 */
export function usePullToSearch(): {
    recentSearches: string[];
    addRecentSearch: (query: string) => void;
    clearRecentSearches: () => void;
} {
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    // Load recent searches from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('mugiwara-recent-searches');
        if (stored) {
            try {
                const parsed: unknown = JSON.parse(stored);
                const result = RecentSearchesSchema.safeParse(parsed);

                if (result.success) {
                    setRecentSearches(result.data);
                } else {
                    logger.warn('Invalid recent searches format, clearing storage:', result.error);
                    localStorage.removeItem('mugiwara-recent-searches');
                }
            }
            catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('Failed to load recent searches:', errorMessage);
            }
        }
    }, []);
    // Add to recent searches
    const addRecentSearch = useCallback((query: string): void => {
        setRecentSearches((prev) => {
            const filtered = prev.filter((q) => q !== query);
            const updated = [query, ...filtered].slice(0, 10);
            // Save to localStorage
            localStorage.setItem('mugiwara-recent-searches', JSON.stringify(updated));
            return updated;
        });
    }, []);
    // Clear recent searches
    const clearRecentSearches = useCallback((): void => {
        setRecentSearches([]);
        localStorage.removeItem('mugiwara-recent-searches');
    }, []);
    return {
        recentSearches,
        addRecentSearch,
        clearRecentSearches
    };
}
