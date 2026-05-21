# PRIORITY_FEATURES_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for PRIORITY_FEATURES_GUIDE

---
# Priority Features Implementation Guide

## 1. Double Page Mode Implementation

### Overview
Enable side-by-side page viewing for a more authentic manga reading experience on larger screens.

### Implementation Steps

#### Step 1: Update Reader Types
```typescript
// Add to reader-types.ts
export interface DoublePageState {
  showDouble: boolean;
  currentLeftPage: number;
  currentRightPage: number;
  offset: boolean; // For cover pages
}
```

#### Step 2: Modify useReader Hook
```typescript
// In useReader.ts
const getDoublePageUrls = useCallback((pageNumber: number): { left: string | null; right: string | null } => {
  if (settings.readingMode !== 'double') {
    return { left: null, right: null };
  }
  
  const isRTL = settings.readingDirection === 'rtl';
  const offset = settings.doublePageOffset ? 1 : 0;
  
  // Calculate page pairs based on reading direction
  let leftPage: number, rightPage: number;
  
  if (isRTL) {
    // Right-to-left: odd pages on right, even on left
    rightPage = pageNumber + offset;
    leftPage = rightPage + 1;
  } else {
    // Left-to-right: even pages on left, odd on right
    leftPage = pageNumber + offset;
    rightPage = leftPage + 1;
  }
  
  // Ensure pages are within bounds
  const leftUrl = leftPage <= totalPages ? getPageUrl(leftPage) : null;
  const rightUrl = rightPage <= totalPages ? getPageUrl(rightPage) : null;
  
  return { left: leftUrl, right: rightUrl };
}, [settings, totalPages, getPageUrl]);

// Update navigation for double page mode
const nextPage = useCallback(() => {
  const increment = settings.readingMode === 'double' ? 2 : 1;
  const newPage = Math.min(currentPage + increment, totalPages);
  setPage(newPage);
  saveProgress(newPage);
}, [currentPage, totalPages, settings.readingMode]);
```

#### Step 3: Create DoublePageCanvas Component
```typescript
// components/reader/DoublePageCanvas.tsx
export function DoublePageCanvas({ 
  leftUrl, 
  rightUrl, 
  settings,
  onLoad 
}: DoublePageCanvasProps) {
  return (
    <Box className="double-page-container" style={{ 
      display: 'flex', 
      flexDirection: settings.readingDirection === 'rtl' ? 'row-reverse' : 'row',
      gap: '2px',
      backgroundColor: settings.backgroundColor 
    }}>
      <Box style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {leftUrl && (
          <img 
            src={leftUrl} 
            alt="Left page"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100vh',
              filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`
            }}
            onLoad={() => onLoad('left')}
          />
        )}
      </Box>
      <Box style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {rightUrl && (
          <img 
            src={rightUrl} 
            alt="Right page"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100vh',
              filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`
            }}
            onLoad={() => onLoad('right')}
          />
        )}
      </Box>
    </Box>
  );
}
```

#### Step 4: Update NativeReader Component
```typescript
// In NativeReader.tsx, replace single image display with:
{settings.readingMode === 'double' ? (
  <DoublePageCanvas
    leftUrl={doublePageUrls.left}
    rightUrl={doublePageUrls.right}
    settings={settings}
    onLoad={handlePageLoad}
  />
) : (
  // Existing single page display
)}
```

## 2. Touch Gestures Implementation

### Overview
Add swipe navigation and pinch-to-zoom for mobile devices.

### Implementation Steps

#### Step 1: Install Gesture Library
```bash
pnpm add @use-gesture/react
```

#### Step 2: Create useReaderGestures Hook
```typescript
// hooks/reader/useReaderGestures.ts
import { useGesture } from '@use-gesture/react';
import { useState, useCallback } from 'react';

export function useReaderGestures({
  onSwipeLeft,
  onSwipeRight,
  onPinchZoom,
  onPan,
  enabled = true
}: GestureHandlers & { enabled?: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const bind = useGesture({
    onDrag: ({ movement: [mx, my], first, last, velocity: [vx] }) => {
      if (!enabled) return;
      
      // If zoomed in, pan instead of swipe
      if (zoom > 1) {
        onPan?.({ x: mx, y: my });
        return;
      }
      
      // Detect swipe on release
      if (last && Math.abs(vx) > 0.5) {
        if (vx > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    },
    
    onPinch: ({ offset: [scale], last }) => {
      if (!enabled) return;
      
      const newZoom = Math.max(0.5, Math.min(3, scale));
      setZoom(newZoom);
      onPinchZoom?.(newZoom);
      
      // Reset position when zoom returns to 1
      if (last && Math.abs(newZoom - 1) < 0.1) {
        setOffset({ x: 0, y: 0 });
      }
    },
    
    onWheel: ({ delta: [, dy], shiftKey }) => {
      if (!enabled || !shiftKey) return;
      
      // Ctrl/Cmd + Scroll for zoom
      const zoomDelta = dy * -0.01;
      const newZoom = Math.max(0.5, Math.min(3, zoom + zoomDelta));
      setZoom(newZoom);
      onPinchZoom?.(newZoom);
    }
  });
  
  return {
    bind,
    zoom,
    offset,
    resetZoom: () => {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  };
}
```

#### Step 3: Apply Gestures to Reader Canvas
```typescript
// In ReaderCanvas component
const { bind, zoom, offset } = useReaderGestures({
  onSwipeLeft: () => nextPage(),
  onSwipeRight: () => prevPage(),
  onPinchZoom: (scale) => console.log('Zoom:', scale),
  enabled: settings.enableGestures
});

return (
  <Box {...bind()} style={{ touchAction: 'none' }}>
    <img 
      style={{ 
        transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`,
        transition: 'transform 0.2s'
      }}
    />
  </Box>
);
```

## 3. Smart Preloading Implementation

### Overview
Intelligently preload pages based on reading speed and patterns.

### Implementation Steps

#### Step 1: Create PreloaderService
```typescript
// services/reader/PreloaderService.ts
export class PreloaderService {
  private cache = new Map<string, string>(); // pageKey -> blob URL
  private preloadQueue = new Set<number>();
  private readingSpeed: number[] = [];
  private lastPageTime = Date.now();
  
  async preloadPages(
    pages: PageInfo[],
    currentPage: number,
    direction: 'forward' | 'backward' | 'both',
    bufferSize: number
  ): Promise<void> {
    const pagesToPreload = this.calculatePagesToPreload(
      currentPage,
      pages.length,
      direction,
      bufferSize
    );
    
    // Cancel previous preloads not in new set
    this.preloadQueue.forEach(page => {
      if (!pagesToPreload.includes(page)) {
        this.cancelPreload(page);
      }
    });
    
    // Preload new pages
    for (const pageNum of pagesToPreload) {
      if (!this.cache.has(this.getCacheKey(pageNum))) {
        this.preloadPage(pages[pageNum - 1], pageNum);
      }
    }
  }
  
  private calculatePagesToPreload(
    current: number,
    total: number,
    direction: string,
    baseBuffer: number
  ): number[] {
    // Adaptive buffer based on reading speed
    const avgSpeed = this.getAverageReadingSpeed();
    const fastReader = avgSpeed < 3000; // Less than 3s per page
    const buffer = fastReader ? Math.min(10, baseBuffer * 2) : baseBuffer;
    
    const pages: number[] = [];
    
    if (direction === 'forward' || direction === 'both') {
      for (let i = 1; i <= buffer; i++) {
        const page = current + i;
        if (page <= total) pages.push(page);
      }
    }
    
    if (direction === 'backward' || direction === 'both') {
      for (let i = 1; i <= Math.floor(buffer / 2); i++) {
        const page = current - i;
        if (page >= 1) pages.push(page);
      }
    }
    
    return pages;
  }
  
  recordPageView(pageNumber: number): void {
    const now = Date.now();
    const timeDiff = now - this.lastPageTime;
    
    if (timeDiff > 500 && timeDiff < 60000) {
      this.readingSpeed.push(timeDiff);
      if (this.readingSpeed.length > 20) {
        this.readingSpeed.shift();
      }
    }
    
    this.lastPageTime = now;
  }
  
  private getAverageReadingSpeed(): number {
    if (this.readingSpeed.length === 0) return 5000;
    const sum = this.readingSpeed.reduce((a, b) => a + b, 0);
    return sum / this.readingSpeed.length;
  }
  
  getPreloadedUrl(pageNumber: number): string | null {
    return this.cache.get(this.getCacheKey(pageNumber)) || null;
  }
  
  cleanup(): void {
    this.cache.forEach(url => URL.revokeObjectURL(url));
    this.cache.clear();
    this.preloadQueue.clear();
  }
}
```

#### Step 2: Integrate with useReader Hook
```typescript
// In useReader.ts
const [preloader] = useState(() => new PreloaderService());

// Track page views for reading speed
useEffect(() => {
  preloader.recordPageView(currentPage);
}, [currentPage]);

// Preload pages when current page changes
useEffect(() => {
  if (pages.length > 0) {
    preloader.preloadPages(
      pages,
      currentPage,
      'both',
      settings.preloadPages
    );
  }
}, [currentPage, pages, settings.preloadPages]);

// Modify getPageUrl to check preloader first
const getPageUrl = useCallback((pageNumber: number): string | null => {
  // Check preloader cache first
  const preloaded = preloader.getPreloadedUrl(pageNumber);
  if (preloaded) return preloaded;
  
  // Fall back to extraction
  const cached = extractedPages.get(pageNumber);
  if (cached) return cached;
  
  const pageInfo = pages[pageNumber - 1];
  if (!pageInfo) return null;
  
  const url = URL.createObjectURL(pageInfo.data);
  setExtractedPages(prev => new Map(prev).set(pageNumber, url));
  
  return url;
}, [pages, extractedPages, preloader]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    preloader.cleanup();
  };
}, [preloader]);
```

## 4. Continuous Scroll Mode

### Quick Implementation for Vertical Scroll

```typescript
// components/reader/ContinuousReader.tsx
export function ContinuousReader({ pages, settings, onPageInView }: Props) {
  const observerRef = useRef<IntersectionObserver>();
  
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '1');
            onPageInView(pageNum);
          }
        });
      },
      { threshold: 0.5 }
    );
    
    return () => observerRef.current?.disconnect();
  }, [onPageInView]);
  
  const setObserver = useCallback((element: HTMLDivElement | null, page: number) => {
    if (element) {
      element.setAttribute('data-page', page.toString());
      observerRef.current?.observe(element);
    }
  }, []);
  
  return (
    <Box style={{ 
      overflowY: 'auto', 
      height: '100vh',
      backgroundColor: settings.backgroundColor 
    }}>
      {pages.map((page, index) => (
        <Box
          key={index}
          ref={(el) => setObserver(el, index + 1)}
          style={{ 
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '2px solid #333'
          }}
        >
          <img 
            src={getPageUrl(index + 1)}
            alt={`Page ${index + 1}`}
            style={{ 
              maxWidth: '100%',
              filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`
            }}
            loading="lazy"
          />
        </Box>
      ))}
    </Box>
  );
}
```

## 5. Quick OCR Integration

### Basic Text Extraction

```typescript
// Install: pnpm add tesseract.js

// services/reader/SimpleOCR.ts
import Tesseract from 'tesseract.js';

export class SimpleOCR {
  async extractText(imageUrl: string, lang = 'eng'): Promise<string> {
    try {
      const result = await Tesseract.recognize(imageUrl, lang, {
        logger: (m) => console.log('OCR Progress:', m)
      });
      
      return result.data.text;
    } catch (error) {
      console.error('OCR failed:', error);
      return '';
    }
  }
  
  async extractFromSelection(
    canvas: HTMLCanvasElement,
    selection: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = selection.width;
    tempCanvas.height = selection.height;
    
    const ctx = tempCanvas.getContext('2d')!;
    ctx.drawImage(
      canvas,
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      0,
      0,
      selection.width,
      selection.height
    );
    
    return this.extractText(tempCanvas.toDataURL());
  }
}
```

## Implementation Priority

### Week 1: Core Features
1. **Double Page Mode** (2-3 days)
   - Basic implementation
   - Responsive breakpoints
   - Settings integration

2. **Touch Gestures** (2 days)
   - Swipe navigation
   - Basic pinch zoom
   - Settings toggle

### Week 2: Performance
3. **Smart Preloading** (3-4 days)
   - Basic preloader service
   - Reading speed tracking
   - Memory management

4. **Continuous Scroll** (2-3 days)
   - Vertical scroll mode
   - Page detection
   - Lazy loading

### Week 3: Advanced
5. **OCR Integration** (2-3 days)
   - Basic text extraction
   - Selection tool
   - Copy functionality

## Testing Checklist

- [ ] Double page mode on desktop (1920x1080)
- [ ] Double page mode on tablet (768x1024)
- [ ] Single page fallback on mobile
- [ ] Touch gestures on mobile devices
- [ ] Gesture conflicts with scrolling
- [ ] Preloading performance metrics
- [ ] Memory usage with 100+ pages
- [ ] Continuous scroll smoothness
- [ ] OCR accuracy on different fonts

## Next Steps

1. Start with double page mode as it's the most requested feature
2. Add touch gestures for mobile experience
3. Implement smart preloading for performance
4. Add continuous scroll for webtoon readers
5. Integrate OCR as a premium feature
