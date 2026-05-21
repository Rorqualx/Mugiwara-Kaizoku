# TECHNICAL_SPECIFICATIONS

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for TECHNICAL_SPECIFICATIONS

---
# Reader Integration - Technical Specifications

## Component Specifications

### 1. ReaderCanvas Component

```typescript
// src/components/reader/ReaderCanvas.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Box } from '@mantine/core';
import { useReaderGestures } from '@/hooks/reader/useReaderGestures';
import { RenderingEngine } from '@/services/reader/RenderingEngine';
import type { ReaderSettings, MangaFile } from '@/types/reader/reader-types';

interface ReaderCanvasProps {
  file: MangaFile;
  page: number;
  settings: ReaderSettings;
  onPageChange: (page: number) => void;
  onZoomChange?: (zoom: number) => void;
}

export function ReaderCanvas({ 
  file, 
  page, 
  settings, 
  onPageChange,
  onZoomChange 
}: ReaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderingEngine, setRenderingEngine] = useState<RenderingEngine | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Initialize rendering engine
  useEffect(() => {
    if (canvasRef.current) {
      const engine = new RenderingEngine(canvasRef.current);
      setRenderingEngine(engine);
      
      return () => {
        engine.dispose();
      };
    }
  }, []);
  
  // Handle gestures
  const { 
    onTouchStart, 
    onTouchMove, 
    onTouchEnd,
    onWheel,
    onClick 
  } = useReaderGestures({
    onSwipeLeft: () => onPageChange(Math.min(page + 1, file.totalPages)),
    onSwipeRight: () => onPageChange(Math.max(page - 1, 1)),
    onPinchZoom: (delta) => {
      const newZoom = Math.max(0.5, Math.min(3, zoom + delta));
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    },
    onPan: (delta) => {
      setOffset(prev => ({
        x: prev.x + delta.x,
        y: prev.y + delta.y
      }));
    }
  });
  
  // Render page
  useEffect(() => {
    if (renderingEngine && file) {
      renderingEngine.renderPage(file.blob, page, {
        zoom,
        offset,
        mode: settings.readingMode,
        fitMode: settings.fitMode,
        filters: {
          brightness: settings.brightness,
          contrast: settings.contrast
        }
      });
    }
  }, [renderingEngine, file, page, zoom, offset, settings]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          if (settings.readingDirection === 'rtl') {
            onPageChange(Math.min(page + 1, file.totalPages));
          } else {
            onPageChange(Math.max(page - 1, 1));
          }
          break;
        case 'ArrowRight':
          if (settings.readingDirection === 'rtl') {
            onPageChange(Math.max(page - 1, 1));
          } else {
            onPageChange(Math.min(page + 1, file.totalPages));
          }
          break;
        case ' ':
          e.preventDefault();
          onPageChange(Math.min(page + 1, file.totalPages));
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(3, prev + 0.1));
          break;
        case '-':
          setZoom(prev => Math.max(0.5, prev - 0.1));
          break;
        case '0':
          setZoom(1);
          setOffset({ x: 0, y: 0 });
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page, file.totalPages, settings.readingDirection, onPageChange]);
  
  return (
    <Box
      ref={containerRef}
      className="reader-canvas-container"
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: settings.backgroundColor,
        overflow: 'hidden',
        cursor: zoom > 1 ? 'grab' : 'default',
        '&:active': {
          cursor: zoom > 1 ? 'grabbing' : 'default'
        }
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        className="reader-canvas"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          maxWidth: '100%',
          maxHeight: '100%',
          imageRendering: zoom > 2 ? 'pixelated' : 'auto'
        }}
      />
    </Box>
  );
}
```

### 2. Smart Preloader Service

```typescript
// src/services/reader/PreloaderService.ts
import { LRUCache } from '@/utils/LRUCache';

interface PreloadOptions {
  bufferSize: number;
  direction: 'forward' | 'backward' | 'both';
  priority: 'sequential' | 'predictive';
}

export class PreloaderService {
  private cache: LRUCache<string, ImageData>;
  private preloadQueue: Set<number> = new Set();
  private readingSpeed: number[] = [];
  private lastPageTime: number = Date.now();
  
  constructor(maxCacheSize: number = 50 * 1024 * 1024) { // 50MB
    this.cache = new LRUCache<string, ImageData>(maxCacheSize);
  }
  
  async preloadPages(
    file: MangaFile,
    currentPage: number,
    options: PreloadOptions
  ): Promise<void> {
    const pagesToPreload = this.calculatePagesToPreload(
      currentPage,
      file.totalPages,
      options
    );
    
    // Remove pages that are already being preloaded
    const newPages = pagesToPreload.filter(p => !this.preloadQueue.has(p));
    
    // Add to queue
    newPages.forEach(p => this.preloadQueue.add(p));
    
    // Preload in parallel with concurrency limit
    const concurrency = 3;
    const chunks = this.chunkArray(newPages, concurrency);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(pageNum => this.preloadPage(file, pageNum))
      );
    }
  }
  
  private calculatePagesToPreload(
    currentPage: number,
    totalPages: number,
    options: PreloadOptions
  ): number[] {
    const pages: number[] = [];
    
    if (options.priority === 'predictive') {
      // Use reading speed to predict pages
      const avgSpeed = this.getAverageReadingSpeed();
      const fastReader = avgSpeed < 3000; // Less than 3 seconds per page
      
      options.bufferSize = fastReader ? 
        Math.min(10, options.bufferSize * 2) : 
        options.bufferSize;
    }
    
    switch (options.direction) {
      case 'forward':
        for (let i = 1; i <= options.bufferSize; i++) {
          const page = currentPage + i;
          if (page <= totalPages) pages.push(page);
        }
        break;
        
      case 'backward':
        for (let i = 1; i <= options.bufferSize; i++) {
          const page = currentPage - i;
          if (page >= 1) pages.push(page);
        }
        break;
        
      case 'both':
        const halfBuffer = Math.floor(options.bufferSize / 2);
        // Forward
        for (let i = 1; i <= halfBuffer + 1; i++) {
          const page = currentPage + i;
          if (page <= totalPages) pages.push(page);
        }
        // Backward
        for (let i = 1; i <= halfBuffer; i++) {
          const page = currentPage - i;
          if (page >= 1) pages.push(page);
        }
        break;
    }
    
    return pages;
  }
  
  private async preloadPage(file: MangaFile, pageNumber: number): Promise<void> {
    const cacheKey = `${file.id}-${pageNumber}`;
    
    // Check if already cached
    if (this.cache.has(cacheKey)) {
      return;
    }
    
    try {
      // Extract and render page
      const pageData = await this.extractPage(file, pageNumber);
      
      // Add to cache
      this.cache.set(cacheKey, pageData);
      
      // Remove from queue
      this.preloadQueue.delete(pageNumber);
    } catch (error) {
      console.error(`Failed to preload page ${pageNumber}:`, error);
      this.preloadQueue.delete(pageNumber);
    }
  }
  
  recordPageView(pageNumber: number): void {
    const now = Date.now();
    const timeDiff = now - this.lastPageTime;
    
    // Only record if reasonable time (between 0.5s and 60s)
    if (timeDiff > 500 && timeDiff < 60000) {
      this.readingSpeed.push(timeDiff);
      
      // Keep only last 20 readings
      if (this.readingSpeed.length > 20) {
        this.readingSpeed.shift();
      }
    }
    
    this.lastPageTime = now;
  }
  
  private getAverageReadingSpeed(): number {
    if (this.readingSpeed.length === 0) return 5000; // Default 5s
    
    const sum = this.readingSpeed.reduce((a, b) => a + b, 0);
    return sum / this.readingSpeed.length;
  }
  
  getFromCache(fileId: string, pageNumber: number): ImageData | null {
    return this.cache.get(`${fileId}-${pageNumber}`) || null;
  }
  
  clearCache(): void {
    this.cache.clear();
    this.preloadQueue.clear();
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  private async extractPage(file: MangaFile, pageNumber: number): Promise<ImageData> {
    // Implementation depends on file format
    // This is a placeholder
    throw new Error('extractPage must be implemented');
  }
}
```

### 3. OCR Service Integration

```typescript
// src/services/reader/OCRService.ts
import Tesseract from 'tesseract.js';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

interface OCROptions {
  language: 'eng' | 'jpn' | 'kor' | 'chi_sim' | 'chi_tra';
  mode: 'fast' | 'accurate';
  region?: { x: number; y: number; width: number; height: number };
}

interface OCRResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
}

interface TextBlock {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;
  
  async initialize(options: OCROptions): Promise<void> {
    if (this.isInitialized) return;
    
    this.worker = await Tesseract.createWorker({
      logger: (m) => console.log('OCR:', m),
      errorHandler: (err) => console.error('OCR Error:', err)
    });
    
    await this.worker.loadLanguage(options.language);
    await this.worker.initialize(options.language);
    
    // Set recognition mode
    await this.worker.setParameters({
      tessedit_ocr_engine_mode: options.mode === 'fast' ? 
        Tesseract.OEM.LSTM_ONLY : 
        Tesseract.OEM.TESSERACT_LSTM_COMBINED
    });
    
    this.isInitialized = true;
  }
  
  async extractText(
    image: ImageData | HTMLCanvasElement | string,
    options?: OCROptions
  ): Promise<AsyncResult<OCRResult, Error>> {
    try {
      if (!this.worker) {
        await this.initialize(options || { language: 'eng', mode: 'fast' });
      }
      
      const result = await this.worker!.recognize(image, {
        rectangle: options?.region
      });
      
      const ocrResult: OCRResult = {
        text: result.data.text,
        confidence: result.data.confidence,
        blocks: result.data.blocks.map(block => ({
          text: block.text,
          bbox: block.bbox,
          confidence: block.confidence
        }))
      };
      
      return createSuccessResult(ocrResult);
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error('OCR extraction failed')
      );
    }
  }
  
  async extractFromSelection(
    canvas: HTMLCanvasElement,
    selection: { x: number; y: number; width: number; height: number }
  ): Promise<AsyncResult<string, Error>> {
    try {
      // Create a temporary canvas for the selection
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
      
      const result = await this.extractText(tempCanvas);
      
      if (isSuccess(result)) {
        return createSuccessResult(result.data.text);
      } else {
        return result;
      }
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Selection extraction failed')
      );
    }
  }
  
  async detectTextRegions(
    image: ImageData | HTMLCanvasElement
  ): Promise<AsyncResult<TextBlock[], Error>> {
    try {
      const result = await this.extractText(image, {
        language: 'eng',
        mode: 'fast'
      });
      
      if (isSuccess(result)) {
        return createSuccessResult(result.data.blocks);
      } else {
        return createErrorResult(result.error);
      }
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Text detection failed')
      );
    }
  }
  
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// Usage in reader
export function useOCR() {
  const [ocrService] = useState(() => new OCRService());
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  
  const extractTextFromRegion = useCallback(async (
    canvas: HTMLCanvasElement,
    region: { x: number; y: number; width: number; height: number }
  ) => {
    setIsExtracting(true);
    
    try {
      const result = await ocrService.extractFromSelection(canvas, region);
      
      if (isSuccess(result)) {
        setExtractedText(result.data);
        return result.data;
      } else {
        throw result.error;
      }
    } finally {
      setIsExtracting(false);
    }
  }, [ocrService]);
  
  useEffect(() => {
    return () => {
      ocrService.dispose();
    };
  }, [ocrService]);
  
  return {
    extractTextFromRegion,
    isExtracting,
    extractedText
  };
}
```

### 4. Archive Handler Implementation

```typescript
// src/services/reader/handlers/ArchiveHandler.ts
import JSZip from 'jszip';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

export interface PageInfo {
  index: number;
  name: string;
  data: Blob;
  size: number;
}

export abstract class ArchiveHandler {
  abstract canHandle(file: File | Blob): boolean;
  abstract extractPages(file: File | Blob): Promise<AsyncResult<PageInfo[], Error>>;
  abstract getPageCount(file: File | Blob): Promise<number>;
}

export class ZipArchiveHandler extends ArchiveHandler {
  private supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  
  canHandle(file: File | Blob): boolean {
    if (file instanceof File) {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.cbz') || ext.endsWith('.zip');
    }
    return file.type === 'application/zip' || file.type === 'application/x-cbz';
  }
  
  async extractPages(file: File | Blob): Promise<AsyncResult<PageInfo[], Error>> {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      // Get all image files
      const imageFiles = Object.keys(contents.files)
        .filter(filename => this.isImageFile(filename))
        .filter(filename => !contents.files[filename].dir)
        .sort(this.naturalSort);
      
      const pages: PageInfo[] = [];
      
      for (let i = 0; i < imageFiles.length; i++) {
        const filename = imageFiles[i];
        const fileData = contents.files[filename];
        
        const blob = await fileData.async('blob');
        
        pages.push({
          index: i + 1,
          name: filename,
          data: blob,
          size: blob.size
        });
      }
      
      return createSuccessResult(pages);
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to extract archive')
      );
    }
  }
  
  async getPageCount(file: File | Blob): Promise<number> {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      const imageFiles = Object.keys(contents.files)
        .filter(filename => this.isImageFile(filename))
        .filter(filename => !contents.files[filename].dir);
      
      return imageFiles.length;
    } catch (error) {
      console.error('Failed to count pages:', error);
      return 0;
    }
  }
  
  private isImageFile(filename: string): boolean {
    const ext = filename.toLowerCase();
    return this.supportedImageTypes.some(type => ext.endsWith(type));
  }
  
  private naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    });
  }
}

// RAR handler would require additional library like unrar.js
export class RarArchiveHandler extends ArchiveHandler {
  canHandle(file: File | Blob): boolean {
    if (file instanceof File) {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.cbr') || ext.endsWith('.rar');
    }
    return file.type === 'application/x-cbr' || file.type === 'application/x-rar-compressed';
  }
  
  async extractPages(file: File | Blob): Promise<AsyncResult<PageInfo[], Error>> {
    // Implementation would use unrar.js or similar
    return createErrorResult(new Error('RAR support not yet implemented'));
  }
  
  async getPageCount(file: File | Blob): Promise<number> {
    return 0;
  }
}

// Factory to get appropriate handler
export class ArchiveHandlerFactory {
  private handlers: ArchiveHandler[] = [
    new ZipArchiveHandler(),
    new RarArchiveHandler()
  ];
  
  getHandler(file: File | Blob): ArchiveHandler | null {
    for (const handler of this.handlers) {
      if (handler.canHandle(file)) {
        return handler;
      }
    }
    return null;
  }
}
```

## Reader Store Implementation

```typescript
// src/store/readerSlice.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ReaderState, ReaderSettings, MangaFile } from '@/types/reader/reader-types';

interface ReaderStore extends ReaderState {
  // State
  currentFile: MangaFile | null;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  settings: ReaderSettings;
  history: ReadingHistoryItem[];
  bookmarks: Bookmark[];
  
  // Actions
  setFile: (file: MangaFile) => void;
  setPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  addToHistory: (item: ReadingHistoryItem) => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  reset: () => void;
}

const defaultSettings: ReaderSettings = {
  readingMode: 'single',
  readingDirection: 'rtl',
  backgroundColor: '#000000',
  fitMode: 'fit-width',
  showToolbar: true,
  preloadPages: 3,
  doublePageOffset: false,
  brightness: 1.0,
  contrast: 1.0,
  enableGestures: true,
  enableKeyboard: true,
  clickNavigation: true,
  smoothScrolling: true,
  panelDetection: false,
  ocrEnabled: false
};

export const useReaderStore = create<ReaderStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentFile: null,
        currentPage: 1,
        totalPages: 0,
        isLoading: false,
        error: null,
        settings: defaultSettings,
        history: [],
        bookmarks: [],
        
        // Actions
        setFile: (file) => set({
          currentFile: file,
          totalPages: file.totalPages,
          currentPage: 1,
          error: null
        }),
        
        setPage: (page) => set({ currentPage: page }),
        
        setLoading: (loading) => set({ isLoading: loading }),
        
        setError: (error) => set({ error }),
        
        updateSettings: (newSettings) => set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
        
        addToHistory: (item) => set((state) => ({
          history: [item, ...state.history.slice(0, 99)] // Keep last 100
        })),
        
        addBookmark: (bookmark) => set((state) => ({
          bookmarks: [...state.bookmarks, bookmark]
        })),
        
        removeBookmark: (bookmarkId) => set((state) => ({
          bookmarks: state.bookmarks.filter(b => b.id !== bookmarkId)
        })),
        
        reset: () => set({
          currentFile: null,
          currentPage: 1,
          totalPages: 0,
          isLoading: false,
          error: null
        })
      }),
      {
        name: 'reader-storage',
        partialize: (state) => ({
          settings: state.settings,
          history: state.history.slice(0, 20), // Only persist recent history
          bookmarks: state.bookmarks
        })
      }
    ),
    {
      name: 'reader-store'
    }
  )
);
```

## Type Definitions

```typescript
// src/types/reader/reader-types.ts
export interface MangaFile {
  id: string;
  mangaId: number;
  chapterId: number;
  chapterTitle: string;
  blob: Blob;
  format: SupportedFormat;
  totalPages: number;
  fileSize: number;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  year?: number;
  tags?: string[];
}

export type SupportedFormat = 'cbz' | 'cbr' | 'pdf' | 'zip';

export interface ReaderSettings {
  readingMode: ReadingMode;
  readingDirection: ReadingDirection;
  backgroundColor: string;
  fitMode: FitMode;
  showToolbar: boolean;
  preloadPages: number;
  doublePageOffset: boolean;
  brightness: number;
  contrast: number;
  enableGestures: boolean;
  enableKeyboard: boolean;
  clickNavigation: boolean;
  smoothScrolling: boolean;
  panelDetection: boolean;
  ocrEnabled: boolean;
}

export type ReadingMode = 
  | 'single' 
  | 'double' 
  | 'continuous_vertical' 
  | 'continuous_horizontal' 
  | 'webtoon';

export type ReadingDirection = 'ltr' | 'rtl';

export type FitMode = 
  | 'fit-width' 
  | 'fit-height' 
  | 'fit-both' 
  | 'original' 
  | 'stretch';

export interface ReadingHistoryItem {
  mangaId: number;
  chapterId: number;
  timestamp: number;
  page?: number;
}

export interface Bookmark {
  id: string;
  mangaId: number;
  chapterId: number;
  page: number;
  note?: string;
  createdAt: number;
}

export interface RenderOptions {
  zoom: number;
  offset: { x: number; y: number };
  mode: ReadingMode;
  fitMode: FitMode;
  filters?: ImageFilters;
}

export interface ImageFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  sharpen?: boolean;
}

export interface ReaderState {
  currentFile: MangaFile | null;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  settings: ReaderSettings;
  history: ReadingHistoryItem[];
  bookmarks: Bookmark[];
}
```
