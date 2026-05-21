/**
 * Hook for gallery zoom functionality
 * Handles zoom controls, pinch-to-zoom, and zoom state management
 */

import { useState, useCallback } from 'react';

export interface UseGalleryZoomOptions {
  /** Initial zoom level */
  initialZoom?: number;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Zoom step size */
  zoomStep?: number;
}

export interface UseGalleryZoomReturn {
  /** Current zoom level */
  zoom: number;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Reset zoom to default */
  resetZoom: () => void;
}

export function useGalleryZoom({
  initialZoom = 1,
  minZoom = 0.5,
  maxZoom = 3,
  zoomStep = 0.5
}: UseGalleryZoomOptions = {}): UseGalleryZoomReturn {
  const [zoom, setZoom] = useState(initialZoom);

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + zoomStep, maxZoom));
  }, [zoomStep, maxZoom]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - zoomStep, minZoom));
  }, [zoomStep, minZoom]);

  const resetZoom = useCallback(() => {
    setZoom(initialZoom);
  }, [initialZoom]);

  // Keyboard controls for zoom
  useCallback(() => {
    // Note: Keyboard controls are handled by the parent component
    // This hook only provides the zoom functionality
  }, []);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom
  };
}