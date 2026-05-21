/**
 * Provider Badge Component
 * 
 * A small, reusable badge that indicates which metadata provider supplied a field.
 * Features customizable appearance, size options, and informative tooltips.
 */
import type { CSSProperties} from 'react';
import React from "react";
import { forwardRef } from 'react';

import { Badge, Tooltip, Box } from '@mantine/core';

import type { BadgeProps} from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility

/**
 * Provider detail structure
 */
interface ProviderDetail {
  color: string;
  label: string;
  strengths: string[];
}

/**
 * Default provider fallback (guaranteed to exist)
 */
const DEFAULT_PROVIDER: ProviderDetail = {
  color: 'gray',
  label: 'Unknown',
  strengths: []
};

/**
 * Provider types and their corresponding colors/labels
 */
export const PROVIDER_DETAILS: Record<string, ProviderDetail> = {
  'anilist': {
    color: 'blue',
    label: 'AniList',
    strengths: ['Anime metadata', 'Seasonal information', 'User ratings', 'Staff details']
  },
  'comicvine': {
    color: 'green',
    label: 'ComicVine',
    strengths: ['Comic metadata', 'Character information', 'Publisher details', 'Series relationships']
  },
  'fandom': {
    color: 'violet',
    label: 'Fandom',
    strengths: ['Plot summaries', 'Character details', 'Volume information', 'Release details']
  },
  'wikipedia': {
    color: 'cyan',
    label: 'Wikipedia',
    strengths: ['Comprehensive plot summaries', 'Chapter lists', 'Publication history', 'Author details']
  },
  'default': DEFAULT_PROVIDER
};

/**
 * Props for the ProviderBadge component
 */
export interface ProviderBadgeProps extends Omit<BadgeProps, 'children'> {
  /**
   * The provider ID (e.g., 'anilist', 'comicvine', 'fandom', 'wikipedia')
   */
  providerId: string;
  
  /**
   * Whether to display the tooltip
   * @default true
   */
  showTooltip?: boolean;
  
  /**
   * Additional content to display in the tooltip
   */
  tooltipContent?: React.ReactNode;
  
  /**
   * Size variant for the badge
   * @default 'xs'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Badge style variant
   * @default 'subtle'
   */
  variant?: NonNullable<BadgeProps['variant']>;
  
  /**
   * CSS properties to apply to the badge
   */
  style?: CSSProperties;
  
  /**
   * Field type this badge is associated with
   * Used to show relevant provider strengths
   */
  fieldType?: string;
}

/**
 * A badge displaying which provider supplied a piece of metadata
 * 
 * @example
 * // Basic usage
 * <ProviderBadge providerId="anilist" />
 *
 * // With custom tooltip content
 * <ProviderBadge
 *   providerId="fandom"
 *   tooltipContent="This description came from Fandom"
 * />
 *
 * // Disabled tooltip
 * <ProviderBadge providerId="comicvine" showTooltip={false} />
 *
 * // Different size and variant
 * <ProviderBadge providerId="wikipedia" size="md" variant="filled" />
 */
export const ProviderBadge = forwardRef<HTMLDivElement, ProviderBadgeProps>(({
  providerId,
  showTooltip = true,
  tooltipContent,
  size = 'xs',
  variant = 'subtle',
  style,
  fieldType: _fieldType,
  ...rest
}, ref): React.ReactElement | null => {
  // Get provider details (default to DEFAULT_PROVIDER if not found)
  const provider = PROVIDER_DETAILS[providerId.toLowerCase()] ?? DEFAULT_PROVIDER;

  // Determine tooltip content
  const defaultTooltip = (
    <Box>
      <Box fw={500} mb={4}>Data from {provider.label}</Box>
      {provider.strengths.length > 0 && (
        <Box fs="italic" size="xs">
          Best for: {provider.strengths.join(', ')}
        </Box>
      )}
      {tooltipContent && <Box mt={4}>{tooltipContent}</Box>}
    </Box>
  );
  
  // For very small badges, just show a colored dot
  const miniVariant = size === 'xs' && !rest.radius;
  
  const badge = (
    <Badge
      color={provider.color}
      size={size}
      variant={variant}
      ref={ref}
      style={{
        padding: miniVariant ? '0' : undefined,
        width: miniVariant ? '8px' : undefined,
        height: miniVariant ? '8px' : undefined,
        minWidth: miniVariant ? '8px' : undefined,
        borderRadius: miniVariant ? '50%' : undefined,
        ...style
      }}
      {...rest}
    >
      {!miniVariant && provider.label}
    </Badge>
  );
  
  // Wrap in tooltip if enabled
  if (showTooltip) {
    return (
      <Tooltip 
        label={defaultTooltip}
        position="top"
        withArrow
        multiline
        w={200}
      >
        {badge}
      </Tooltip>
    );
  }
  
  return badge;
});

ProviderBadge.displayName = 'ProviderBadge';