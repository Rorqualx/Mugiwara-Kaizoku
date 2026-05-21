/**
 * Component for displaying image loading states
 * Handles skeleton, blur, and custom loading displays
 */

import React from 'react';

import { Skeleton } from '@mantine/core';

export interface ImageLoadingStateProps {
  /** Loading type */
  loadingType: 'skeleton' | 'blur' | 'none';
  /** Placeholder image */
  placeholder?: string | undefined;
  /** Alternative text */
  alt: string;
  /** Custom style */
  style?: React.CSSProperties | undefined;
  /** Aspect ratio for maintaining space */
  aspectRatio?: number | undefined;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
}

export function ImageLoadingState({
  loadingType,
  placeholder,
  alt,
  style,
  aspectRatio,
  loadingComponent
}: ImageLoadingStateProps): React.ReactElement {
  // Return custom component if provided
  if (loadingComponent) {
    return <>{loadingComponent}</>;
  }

  // Handle different loading types
  switch (loadingType) {
    case 'skeleton':
      return (
        <Skeleton
          height={aspectRatio ? '100%' : 'auto'}
          style={style}
          radius="md"
        />
      );

    case 'blur':
      return (
        <div
          style={{
            ...style,
            backgroundImage: placeholder ? `url(${placeholder})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transition: 'filter 0.3s ease-out'
          }}
          aria-label={`Loading ${alt}`}
        />
      );

    case 'none':
    default:
      return (
        <div
          style={style}
          aria-label={`Loading ${alt}`}
        />
      );
  }
}