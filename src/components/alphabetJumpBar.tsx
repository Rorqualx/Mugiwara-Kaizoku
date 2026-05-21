/**
 * AlphabetJumpBar component for quick navigation by first letter
 * 
 * This component provides a vertical alphabet navigation bar positioned
 * on the right side of the screen. Features include:
 * - Fixed positioning below action bar
 * - Full height extending to bottom of screen
 * - Smooth scroll to sections based on selected letter
 * - Hover effects for better user interaction
 * 
 * @remarks
 * Layout Structure:
 * - Fixed position on right side
 * - Starts below action bar (top: 112px - accounts for header and action bar)
 * - Extends to bottom of viewport
 * - Narrow width (30px) to minimize content overlap
 * 
 * Styling:
 * - Consistent with application theme
 * - Shadow and border for visual separation
 * - Hover effects for interactive feedback
 * - Properly spaced letters for easy targeting
 */

import React, { useCallback, useState, useEffect } from 'react';

import { Box, Button, Stack } from '@mantine/core';

/**
 * Props for the AlphabetJumpBar component
 */
export interface AlphabetJumpBarProps {
  /** Optional classname for styling */
  className?: string;

  /** Optional custom styling */
  style?: React.CSSProperties;

  /** Optional additional letters/characters to include */
  additionalCharacters?: string[];

  /** Optional callback when a letter is clicked */
  onLetterClick?: (letter: string) => void;

  /** Optional custom offset from top (defaults to 112px) */
  topOffset?: number;

  /** Optional flag to include numeric character group */
  includeNumeric?: boolean;
}

/**
 * AlphabetJumpBar component for quick manga navigation
 * 
 * @param props - Component props
 * @returns Vertical alphabet navigation bar
 */
export function AlphabetJumpBar({
  className,
  style,
  additionalCharacters = [],
  onLetterClick,
  topOffset = 112,
  includeNumeric = true
}: AlphabetJumpBarProps): React.ReactElement {
  // Base alphabet letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Add numeric character if enabled
  if (includeNumeric) {
    alphabet.push('#');
  }

  // Add any additional characters
  const fullAlphabet = [...alphabet, ...additionalCharacters];

  // Track which letter is currently active (in view)
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // Set up intersection observer to detect which letter section is in view
  useEffect(() => {
    // Create options for the observer
    const options = {
      root: null, // Use viewport as root
      rootMargin: '-120px 0px -50% 0px', // Top margin accounts for header
      threshold: 0.1 // 10% visibility threshold
    };

    // Callback for the observer
    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Get the letter from the data-letter attribute
          const letter = entry.target.getAttribute('data-letter');
          if (letter) {
            setActiveLetter(letter);
          }
        }
      });
    };

    // Create the observer
    const observer = new IntersectionObserver(handleIntersect, options);

    // Observe all letter sections
    const sections = document.querySelectorAll('[data-letter]');
    sections.forEach((section) => {
      observer.observe(section);
    });

    // Clean up when component unmounts
    return () => {
      sections.forEach((section) => {
        observer.unobserve(section);
      });
    };
  }, []);

  /**
   * Default letter click handler if none provided
   * Finds the first manga card whose title starts with the letter (case-insensitive).
   * `#` matches the first card whose title doesn't start with A-Z (digits/symbols).
   * Scrolls the Mantine ScrollArea viewport that contains the grid.
   *
   * @param letter - Selected alphabet letter
   */
  const defaultLetterClickHandler = useCallback((letter: string) => {
    // Primary path: broadcast to virtualized consumers (PosterView). They own
    // scroll because the target row isn't guaranteed to be mounted.
    window.dispatchEvent(new CustomEvent('library-jump', { detail: { letter } }));

    // Fallback path for non-virtualized callers (table/details views).
    // No-op silently if no matching card exists in the DOM.
    const cards = document.querySelectorAll<HTMLElement>('[data-manga-title]');
    const target = Array.from(cards).find((el) => {
      const title = el.getAttribute('data-manga-title') ?? '';
      const firstChar = title.charAt(0).toUpperCase();
      if (letter === '#') return firstChar === '' || !/[A-Z]/.test(firstChar);
      return firstChar === letter;
    });
    if (!target) return;

    let scroller: HTMLElement | null = target.parentElement;
    let depth = 0;
    while (scroller) {
      const cs = window.getComputedStyle(scroller);
      if (/(auto|scroll|overlay)/.test(`${cs.overflowY} ${cs.overflow}`)) break;
      scroller = scroller.parentElement;
      depth++;
      if (depth > 30) break;
    }

    if (scroller && scroller !== document.documentElement) {
      const targetRect = target.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const newTop = scroller.scrollTop + (targetRect.top - scrollerRect.top) - 8;
      scroller.scrollTo({ top: newTop, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    target.classList.add('highlight-section');
    setTimeout(() => {
      target.classList.remove('highlight-section');
    }, 2000);
  }, []);

  // Use provided click handler or default implementation
  const handleLetterClick = onLetterClick ?? defaultLetterClickHandler;

  return (
    <Box
      {...(className ? { className } : {})}
      style={{
        position: "fixed",
        top: `${topOffset}px`,
        right: 0,
        width: "30px",
        backgroundColor: "#333333",
        borderLeft: "1px solid rgba(0, 0, 0, 0.1)",
        boxShadow: "var(--mantine-shadow-md)",
        zIndex: 100,
        height: `calc(100vh - ${topOffset}px)`,
        ...style
      }}>

      <Stack
        gap={0}
        align="center"
        style={{
          height: "100%",
          justifyContent: "space-between",
          padding: "8px 0"
        }}>

        {fullAlphabet.map((letter) =>
        <Button
          key={letter}
          variant={activeLetter === letter ? "filled" : "subtle"}
          size="compact-xs"
          styles={{
            root: {
              width: "30px",
              height: `calc((100vh - ${topOffset + 16}px) / ${fullAlphabet.length})`, // Auto-calculate height
              maxHeight: "28px", // Prevent buttons from getting too tall
              minHeight: "18px", // Ensure minimum visibility
              padding: 0,
              transition: 'all 0.2s ease',
              color: activeLetter === letter ? '#ffffff' : '#e9ecef',
              fontSize: '12px',
              fontWeight: activeLetter === letter ? 700 : 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeLetter === letter ? 'var(--mantine-color-blue-7)' : 'transparent',
              transform: activeLetter === letter ? 'scale(1.15)' : 'scale(1)',
              boxShadow: activeLetter === letter ? '0 0 12px rgba(25, 113, 194, 0.7)' : 'none',
              '&:hover': {
                backgroundColor: activeLetter === letter ? 'var(--mantine-color-blue-8)' : 'rgba(0, 0, 0, 0.4)',
                color: '#ffffff',
                transform: 'scale(1.15)',
                boxShadow: '0 0 12px rgba(255, 255, 255, 0.7)'
              }
            }
          }}
          onClick={() => handleLetterClick(letter)}>

            {letter}
          </Button>
        )}
      </Stack>
    </Box>);

}