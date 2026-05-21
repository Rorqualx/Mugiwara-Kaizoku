// ReaderCanvas component with gesture support
import type { ReactNode } from 'react';
import React from 'react';

import { Box } from '@mantine/core';

import { useReaderGestures } from '@/hooks/reader/useReaderGestures';
import type { ReaderSettings } from '@/types/reader/reader-types';

interface ReaderCanvasProps {
  children: ReactNode;
  settings: ReaderSettings;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onZoom?: (scale: number) => void;
}

export const ReaderCanvas = React.memo(function ReaderCanvas({
  children,
  settings,
  onSwipeLeft,
  onSwipeRight,
  onZoom
}: ReaderCanvasProps): React.ReactElement {
  const { bind, zoom, offset } = useReaderGestures({
    onSwipeLeft,
    onSwipeRight,
    onPinchZoom: (scale) => {
      onZoom?.(scale);
    },
    enabled: settings.enableGestures
  });
  
  return (
    <Box
      {...bind()}
      style={{ 
        touchAction: 'none',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: zoom > 1 ? 'grab' : 'default'
      }}
    >
      <Box
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
          transition: 'transform 0.1s ease-out',
          transformOrigin: 'center center',
          // GPU acceleration: hint browser to prepare for transform changes when zoomed
          willChange: zoom > 1 ? 'transform' : 'auto'
        }}
      >
        {children}
      </Box>
    </Box>
  );
});

ReaderCanvas.displayName = 'ReaderCanvas';
