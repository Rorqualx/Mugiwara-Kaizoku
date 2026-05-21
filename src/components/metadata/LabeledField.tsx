/**
 * LabeledField Component
 * 
 * A reusable component for displaying a labeled field with optional provider badge
 * and strength indicator. Used for consistent metadata field display with provenance
 * tracking and provider quality indicators.
 */
import React from "react";
import type { ReactNode } from 'react';

import { Group, Text, Box } from '@mantine/core';


import { ProviderBadge } from './ProviderBadge';
import { ProviderStrengthIndicator } from './ProviderStrengthIndicator';

import type { ProviderBadgeProps } from './ProviderBadge';
import type { TextProps, BoxProps } from '@mantine/core';


/**
 * Props for the LabeledField component
 */
export interface LabeledFieldProps extends BoxProps {
  /**
   * Label text for the field
   */
  label: string;
  
  /**
   * Value to display (can be a string, number, or JSX)
   */
  value: ReactNode;
  
  /**
   * Props for the label Text component
   */
  labelProps?: TextProps;
  
  /**
   * Props for the value Text component (if value is not JSX)
   */
  valueProps?: TextProps;
  
  /**
   * Provider ID for the field (for provenance tracking)
   */
  providerId?: string;
  
  /**
   * Props for the provider badge
   */
  providerBadgeProps?: Omit<ProviderBadgeProps, 'providerId'>;
  
  /**
   * Whether to render value as a child (for JSX values)
   * @default false
   */
  renderAsChild?: boolean;
  
  /**
   * Whether to show the provider strength indicator
   * @default false
   */
  showStrength?: boolean;
  
  /**
   * The field name to use for the strength indicator
   * If not provided, the label will be used
   */
  fieldName?: string;
}

/**
 * A labeled field with optional provider badge and strength indicator for metadata display
 * 
 * @example
 * // Basic usage with string value
 * <LabeledField label="Title" value="One Piece" />
 * 
 * // With provider badge
 * <LabeledField 
 *   label="Description" 
 *   value="A pirate adventure" 
 *   providerId="anilist"
 * />
 * 
 * // With provider badge and strength indicator
 * <LabeledField 
 *   label="Summary"
 *   value="A pirate adventure"
 *   providerId="anilist"
 *   showStrength
 *   fieldName="summary"
 * />
 * 
 * // With JSX value
 * <LabeledField 
 *   label="Genres" 
 *   value={<Group>{genres.map(g => <Badge key={g}>{g}</Badge>)}</Group>}
 *   renderAsChild
 * />
 */
export function LabeledField({
  label,
  value,
  labelProps,
  valueProps,
  providerId,
  providerBadgeProps,
  renderAsChild = false,
  showStrength = false,
  fieldName,
  ...boxProps
}: LabeledFieldProps): React.ReactElement {
  // Normalize field name for strength indicator
  const normalizedFieldName = fieldName ?? label.toLowerCase();
  
  return (
    <Box {...boxProps}>
      <Group gap="xs" mb={4}>
        <Text fw={500} size="sm" {...labelProps}>{label}</Text>
        
        {providerId && (
          <>
            <ProviderBadge 
              providerId={providerId} 
              size="xs"
              fieldType={label.toLowerCase()}
              {...providerBadgeProps}
            />
            
            {showStrength && (
              <ProviderStrengthIndicator
                providerId={providerId}
                fieldName={normalizedFieldName}
                mode="minimal"
                size="xs"
              />
            )}
          </>
        )}
      </Group>
      
      {renderAsChild ? (
        value
      ) : (
        <Text {...valueProps}>
          {value}
        </Text>
      )}
    </Box>
  );
}