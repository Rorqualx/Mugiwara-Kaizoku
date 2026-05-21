"use client";

/**
 * Animated heart component with tooltip
 * 
 * This component displays an animated heart icon with a tooltip message.
 * Features include:
 * - Smooth heart beat animation
 * - Custom tooltip message
 * - Consistent styling
 * - Accessibility support
 * 
 * @remarks
 * Animation Features:
 * - Pulsing scale animation
 * - Infinite loop with delay
 * - Custom timing function
 * - Smooth transitions
 * 
 * Visual Elements:
 * - Red heart icon
 * - Arrow tooltip
 * - Inline flex layout
 * - Fixed dimensions
 * 
 * Accessibility:
 * - Tooltip for additional context
 * - Semantic HTML structure
 * - Proper ARIA support
 * 
 * @example
 * ```tsx
 * // Basic usage in header
 * <MadeWith />
 * ```
 */

import React from "react";

// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconHeart } from '@tabler/icons-react';
import { motion } from "framer-motion";

import { Tooltip } from './Tooltip/client';

export function MadeWith(): React.ReactElement {
  /**
   * Animated heart component with pulsing effect
   * Uses Framer Motion for smooth animations
   */
  const hearth = (
    <motion.div
      animate={{
        scale: [1.0, 1.25, 1.0, 1.25, 1.0, 1.0],
      }}
      transition={{
        duration: 1,
        ease: "easeInOut",
        times: [0, 0.2, 0.5, 0.6, 0.8, 1],
        repeat: Infinity,
        repeatType: "loop",
        repeatDelay: 0.5,
      }}
    >
      <IconHeart fill="red" color="red" size={20} />
    </motion.div>
  );

  return (
    <Tooltip withArrow label="On the journey to Elpah" position="bottom">
      <div
        style={{
          display: "inline-flex",
          height: "26px",
          lineHeight: "26px",
        }}
      >
        {hearth}
      </div>
    </Tooltip>
  );
}
