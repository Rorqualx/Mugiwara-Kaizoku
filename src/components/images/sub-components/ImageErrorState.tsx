/**
 * Component for displaying image error states
 * Handles fallback images and custom error displays
 */

import React from 'react';

import { Alert } from '@mantine/core';

export interface ImageErrorStateProps {
  /** Alternative text */
  alt: string;
  /** Fallback image source */
  fallbackSrc?: string | undefined;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Custom style */
  style?: React.CSSProperties | undefined;
  /** Aspect ratio for maintaining space */
  aspectRatio?: number | undefined;
}

export function ImageErrorState({
  alt,
  fallbackSrc,
  errorComponent,
  style,
  aspectRatio
}: ImageErrorStateProps): React.ReactElement {
  // Return custom component if provided
  if (errorComponent) {
    return <>{errorComponent}</>;
  }

  // Use fallback image if available
  if (fallbackSrc) {
    return (
      <img
        src={fallbackSrc}
        alt={`Fallback for ${alt}`}
        style={{
          ...style,
          objectFit: 'cover',
          width: '100%',
          height: aspectRatio ? '100%' : 'auto'
        }}
      />
    );
  }

  // Default error display
  return (
    <Alert
      color="red"
      title="Failed to load image"
      style={style}
    >
      Unable to load: {alt}
    </Alert>
  );
}