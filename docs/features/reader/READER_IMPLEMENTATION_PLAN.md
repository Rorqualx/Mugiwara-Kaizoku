# READER_IMPLEMENTATION_PLAN

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for READER_IMPLEMENTATION_PLAN

---
# Native Manga Reader Integration - Full Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to integrate a powerful, feature-rich manga reader into Mugiwara-Kaizoku. The reader will support multiple formats (CBZ, CBR, PDF, ZIP), provide smart features for an optimal reading experience, and integrate seamlessly with the existing architecture.

## Table of Contents
1. [Requirements & Objectives](#requirements--objectives)
2. [Technology Selection](#technology-selection)
3. [Architecture Design](#architecture-design)
4. [Core Features](#core-features)
5. [Implementation Phases](#implementation-phases)
6. [Technical Implementation](#technical-implementation)
7. [Database Schema Updates](#database-schema-updates)
8. [UI/UX Design](#uiux-design)
9. [Performance Optimization](#performance-optimization)
10. [Security Considerations](#security-considerations)
11. [Testing Strategy](#testing-strategy)
12. [Timeline & Milestones](#timeline--milestones)

## Requirements & Objectives

### Functional Requirements
- Support for common manga formats: CBZ, CBR, PDF, ZIP (containing images)
- Seamless integration with downloaded manga files
- Progress tracking and synchronization
- Multiple reading modes (single page, double page, continuous scroll)
- Offline reading capability
- Chapter navigation and management

### Non-Functional Requirements
- Fast loading and page transitions (<100ms)
- Memory-efficient image handling
- Responsive design for desktop and tablet
- Accessibility support (keyboard navigation, screen readers)
- Extensible architecture for future features

### Smart Features
1. **Intelligent Preloading**: Predict and preload pages based on reading speed
2. **Smart Zoom**: Auto-detect panels for guided reading
3. **Reading Analytics**: Track reading patterns and provide insights
4. **AI-Enhanced Features**: Text extraction from manga pages (OCR)
5. **Social Features**: Share panels, create collections
6. **Smart Bookmarks**: Auto-bookmark at chapter boundaries

## Technology Selection

### Recommended Solution: Custom Reader with ComicBook.js Core

After evaluating multiple options, we recommend building a custom reader using **ComicBook.js** as the core rendering engine, enhanced with React components for UI and additional smart features.

#### Why ComicBook.js?
- Mature library specifically designed for comic/manga reading
- Supports CBZ, CBR, PDF formats natively
- Lightweight and performant
- MIT licensed
- Active community

#### Technology Stack
```typescript
// Core Technologies
- React 18+ (UI framework)
- TypeScript (Type safety)
- ComicBook.js (Core reader engine)
- PDF.js (PDF rendering)
- JSZip (Archive handling)
- Canvas API (Image rendering)
- IndexedDB (Offline storage)
- Web Workers (Background processing)

// Additional Libraries
- Framer Motion (Animations)
- React Intersection Observer (Lazy loading)
- Tesseract.js (OCR capabilities)
- Comlink (Web Worker communication)
```

### Alternative Options Considered
1. **Tachiyomi-style Web Reader**: Good but requires significant customization
2. **PDF.js Only**: Limited to PDF format
3. **Commercial Solutions**: Licensing costs and customization limitations

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mugiwara-Kaizoku App                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Manga Library  │  │ Reader Route │  │ Reader Store │ │
│  │   Components    │  │  /read/:id   │  │   (Zustand)  │ │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘ │
│           │                   │                  │          │
│  ┌────────▼─────────────────▼──────────────────▼───────┐  │
│  │              Native Reader Component                 │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │   Reader    │  │   Toolbar   │  │  Settings   │ │  │
│  │  │   Canvas    │  │ & Controls  │  │    Panel    │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Reader Core Services                    │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │   File     │  │   Rendering  │  │  Progress   │ │  │
│  │  │  Manager   │  │    Engine    │  │   Tracker   │ │  │
│  │  └────────────┘  └──────────────┘  └─────────────┘ │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │   Cache    │  │   Preloader  │  │     OCR     │ │  │
│  │  │  Manager   │  │    Service   │  │   Service   │ │  │
│  │  └────────────┘  └──────────────┘  └─────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

```typescript
src/
├── components/
│   └── reader/
│       ├── NativeReader.tsx           // Main reader component
│       ├── ReaderCanvas.tsx          // Canvas rendering component
│       ├── ReaderToolbar.tsx         // Navigation and controls
│       ├── ReaderSettings.tsx        // Settings panel
│       ├── PageNavigator.tsx         // Page navigation UI
│       ├── ChapterSelector.tsx       // Chapter dropdown
│       └── ReadingModeToggle.tsx     // Reading mode selector
├── hooks/
│   └── reader/
│       ├── useReader.ts              // Main reader hook
│       ├── useReaderGestures.ts      // Touch/mouse gestures
│       ├── useReaderKeyboard.ts      // Keyboard shortcuts
│       ├── useReadingProgress.ts     // Progress tracking
│       └── usePreloader.ts           // Smart preloading
├── services/
│   └── reader/
│       ├── FileManager.ts            // File handling service
│       ├── RenderingEngine.ts        // Page rendering
│       ├── CacheManager.ts           // Image caching
│       ├── PreloaderService.ts       // Smart preloading
│       ├── ProgressTracker.ts        // Reading progress
│       └── OCRService.ts             // Text extraction
├── store/
│   └── readerSlice.ts                // Reader state management
└── types/
    └── reader/
        ├── reader-types.ts           // Reader type definitions
        └── file-types.ts             // File format types
```

## Core Features

### 1. Multi-Format Support

```typescript
interface SupportedFormats {
  cbz: {
    extension: '.cbz',
    mimeType: 'application/x-cbz',
    handler: 'ZipArchiveHandler'
  },
  cbr: {
    extension: '.cbr',
    mimeType: 'application/x-cbr',
    handler: 'RarArchiveHandler'
  },
  pdf: {
    extension: '.pdf',
    mimeType: 'application/pdf',
    handler: 'PDFHandler'
  },
  zip: {
    extension: '.zip',
    mimeType: 'application/zip',
    handler: 'ZipArchiveHandler'
  }
}
```

### 2. Reading Modes

```typescript
enum ReadingMode {
  SINGLE_PAGE = 'single',
  DOUBLE_PAGE = 'double',
  CONTINUOUS_VERTICAL = 'continuous_vertical',
  CONTINUOUS_HORIZONTAL = 'continuous_horizontal',
  WEBTOON = 'webtoon'
}

enum ReadingDirection {
  LEFT_TO_RIGHT = 'ltr',
  RIGHT_TO_LEFT = 'rtl'  // Default for manga
}
```

### 3. Smart Navigation

```typescript
interface NavigationFeatures {
  // Gesture controls
  swipe: { left: 'nextPage', right: 'prevPage' },
  pinchZoom: boolean,
  doubleTap: 'smartZoom',
  
  // Keyboard shortcuts
  shortcuts: {
    'ArrowLeft': 'prevPage',
    'ArrowRight': 'nextPage',
    'Space': 'nextPage',
    'f': 'fullscreen',
    'g': 'goToPage',
    'b': 'bookmark',
    'm': 'menu'
  },
  
  // Mouse controls
  clickZones: {
    left: 'prevPage',
    right: 'nextPage',
    center: 'menu'
  }
}
```

### 4. Smart Features Implementation

#### 4.1 Intelligent Preloading
```typescript
class SmartPreloader {
  private readingSpeed: number;
  private bufferSize: number;
  
  async predictNextPages(): Promise<number[]> {
    // Analyze reading speed
    const avgTimePerPage = this.calculateReadingSpeed();
    
    // Determine optimal buffer
    this.bufferSize = Math.ceil(avgTimePerPage < 5000 ? 5 : 3);
    
    // Preload based on direction and speed
    return this.getPageRange(this.currentPage, this.bufferSize);
  }
}
```

#### 4.2 Panel Detection & Smart Zoom
```typescript
interface PanelDetection {
  detectPanels(page: ImageData): Panel[];
  guidedReading: boolean;
  autoZoomToPanel: boolean;
  panelOrder: 'traditional' | 'webtoon';
}
```

#### 4.3 Reading Analytics
```typescript
interface ReadingAnalytics {
  sessionDuration: number;
  pagesRead: number;
  readingSpeed: number; // pages per minute
  favoriteGenres: string[];
  readingPatterns: {
    timeOfDay: Distribution;
    daysOfWeek: Distribution;
    sessionLength: Distribution;
  };
}
```

## Implementation Phases

### Phase 1: Core Reader (Weeks 1-3)
- [ ] Basic file loading and display
- [ ] Single page reading mode
- [ ] Basic navigation (prev/next)
- [ ] CBZ/ZIP support
- [ ] Progress tracking

### Phase 2: Enhanced Navigation (Weeks 4-5)
- [ ] Multiple reading modes
- [ ] Gesture controls
- [ ] Keyboard shortcuts
- [ ] Chapter navigation
- [ ] Settings panel

### Phase 3: Smart Features (Weeks 6-8)
- [ ] Intelligent preloading
- [ ] Smart zoom
- [ ] Panel detection
- [ ] Bookmarking system
- [ ] Reading analytics

### Phase 4: Advanced Features (Weeks 9-11)
- [ ] OCR integration
- [ ] Text extraction
- [ ] Note-taking
- [ ] Social features
- [ ] Export functionality

### Phase 5: Optimization & Polish (Weeks 12-13)
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Accessibility improvements
- [ ] Bug fixes
- [ ] Documentation

## Technical Implementation

### 1. File Manager Service

```typescript
// src/services/reader/FileManager.ts
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

export class FileManager {
  private fileCache: Map<string, Blob> = new Map();
  
  async loadMangaFile(
    mangaId: number, 
    chapterId: number
  ): Promise<AsyncResult<MangaFile, Error>> {
    try {
      // Get file path from database
      const filePath = await this.getFilePath(mangaId, chapterId);
      
      // Check cache first
      if (this.fileCache.has(filePath)) {
        return createSuccessResult({
          blob: this.fileCache.get(filePath)!,
          format: this.detectFormat(filePath),
          metadata: await this.extractMetadata(filePath)
        });
      }
      
      // Load file
      const blob = await this.loadFile(filePath);
      this.fileCache.set(filePath, blob);
      
      return createSuccessResult({
        blob,
        format: this.detectFormat(filePath),
        metadata: await this.extractMetadata(filePath)
      });
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to load file')
      );
    }
  }
  
  private detectFormat(filePath: string): SupportedFormat {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
      case '.cbz':
      case '.zip':
        return 'cbz';
      case '.cbr':
        return 'cbr';
      case '.pdf':
        return 'pdf';
      default:
        throw new Error(`Unsupported format: ${extension}`);
    }
  }
}
```

### 2. Rendering Engine

```typescript
// src/services/reader/RenderingEngine.ts
export class RenderingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private comicBook: ComicBook;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.comicBook = new ComicBook();
  }
  
  async renderPage(
    file: Blob, 
    pageNumber: number,
    options: RenderOptions
  ): Promise<void> {
    // Load the comic book
    await this.comicBook.load(file);
    
    // Get page
    const page = await this.comicBook.getPage(pageNumber);
    
    // Apply rendering options
    const processedImage = await this.processImage(page, options);
    
    // Render to canvas
    this.drawToCanvas(processedImage, options);
  }
  
  private async processImage(
    image: ImageData,
    options: RenderOptions
  ): Promise<ImageData> {
    // Apply filters (brightness, contrast, etc.)
    if (options.filters) {
      image = this.applyFilters(image, options.filters);
    }
    
    // Apply zoom
    if (options.zoom !== 1) {
      image = this.applyZoom(image, options.zoom);
    }
    
    return image;
  }
}
```

### 3. Reader Component

```typescript
// src/components/reader/NativeReader.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, LoadingOverlay } from '@mantine/core';
import { useReader } from '@/hooks/reader/useReader';
import { ReaderCanvas } from './ReaderCanvas';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSettings } from './ReaderSettings';

export function NativeReader() {
  const { mangaId, chapterId } = useParams<{ 
    mangaId: string; 
    chapterId: string; 
  }>();
  
  const {
    file,
    currentPage,
    totalPages,
    isLoading,
    error,
    loadChapter,
    nextPage,
    prevPage,
    goToPage,
    settings,
    updateSettings
  } = useReader();
  
  useEffect(() => {
    if (mangaId && chapterId) {
      loadChapter(parseInt(mangaId), parseInt(chapterId));
    }
  }, [mangaId, chapterId]);
  
  if (error) {
    return <ErrorDisplay error={error} />;
  }
  
  return (
    <Box className="native-reader" h="100vh" pos="relative">
      <LoadingOverlay visible={isLoading} />
      
      <ReaderToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        onNavigate={{ next: nextPage, prev: prevPage, goto: goToPage }}
        settings={settings}
        onSettingsChange={updateSettings}
      />
      
      {file && (
        <ReaderCanvas
          file={file}
          page={currentPage}
          settings={settings}
          onPageChange={goToPage}
        />
      )}
      
      <ReaderSettings
        settings={settings}
        onChange={updateSettings}
      />
    </Box>
  );
}
```

### 4. Reader Hook

```typescript
// src/hooks/reader/useReader.ts
import { useState, useCallback } from 'react';
import { useReaderStore } from '@/store/readerSlice';
import { FileManager } from '@/services/reader/FileManager';
import { trpc } from '@/utils/trpc-client/index';

export function useReader() {
  const fileManager = new FileManager();
  const {
    currentFile,
    currentPage,
    settings,
    setFile,
    setPage,
    updateSettings,
    addToHistory
  } = useReaderStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const progressMutation = trpc.reading.updateProgress.useMutation();
  
  const loadChapter = useCallback(async (
    mangaId: number,
    chapterId: number
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fileManager.loadMangaFile(mangaId, chapterId);
      
      if (isSuccess(result)) {
        setFile(result.data);
        
        // Load saved progress
        const progress = await trpc.reading.getProgress.query({
          mangaId,
          chapterId
        });
        
        if (progress) {
          setPage(progress.page);
        }
        
        // Add to reading history
        addToHistory({ mangaId, chapterId, timestamp: Date.now() });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load'));
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const saveProgress = useCallback(async (page: number) => {
    if (!currentFile) return;
    
    await progressMutation.mutateAsync({
      mangaId: currentFile.mangaId,
      chapterId: currentFile.chapterId,
      page,
      totalPages: currentFile.totalPages,
      completedAt: page === currentFile.totalPages ? new Date() : null
    });
  }, [currentFile]);
  
  const nextPage = useCallback(() => {
    if (currentPage < currentFile?.totalPages) {
      const newPage = currentPage + 1;
      setPage(newPage);
      saveProgress(newPage);
    }
  }, [currentPage, currentFile]);
  
  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setPage(newPage);
      saveProgress(newPage);
    }
  }, [currentPage]);
  
  return {
    file: currentFile,
    currentPage,
    totalPages: currentFile?.totalPages || 0,
    isLoading,
    error,
    loadChapter,
    nextPage,
    prevPage,
    goToPage: (page: number) => {
      setPage(page);
      saveProgress(page);
    },
    settings,
    updateSettings
  };
}
```

## Database Schema Updates

### New Tables

```sql
-- Reading progress tracking
CREATE TABLE reading_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  manga_id INTEGER REFERENCES manga(id),
  chapter_id INTEGER REFERENCES chapters(id),
  current_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER NOT NULL,
  reading_time INTEGER DEFAULT 0, -- seconds
  completed_at TIMESTAMP,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, manga_id, chapter_id)
);

-- Reading history
CREATE TABLE reading_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  manga_id INTEGER REFERENCES manga(id),
  chapter_id INTEGER REFERENCES chapters(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  pages_read INTEGER DEFAULT 0,
  total_time INTEGER DEFAULT 0 -- seconds
);

-- Reader bookmarks
CREATE TABLE reader_bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  manga_id INTEGER REFERENCES manga(id),
  chapter_id INTEGER REFERENCES chapters(id),
  page_number INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reader settings per user
CREATE TABLE reader_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  reading_mode VARCHAR(50) DEFAULT 'single',
  reading_direction VARCHAR(10) DEFAULT 'rtl',
  background_color VARCHAR(7) DEFAULT '#000000',
  fit_mode VARCHAR(20) DEFAULT 'fit-width',
  show_toolbar BOOLEAN DEFAULT true,
  preload_pages INTEGER DEFAULT 3,
  double_page_offset BOOLEAN DEFAULT false,
  brightness DECIMAL(3,2) DEFAULT 1.0,
  contrast DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reading analytics
CREATE TABLE reading_analytics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE NOT NULL,
  pages_read INTEGER DEFAULT 0,
  chapters_completed INTEGER DEFAULT 0,
  reading_time INTEGER DEFAULT 0, -- seconds
  genres JSONB, -- Array of genres read
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);
```

### Prisma Schema Updates

```prisma
model ReadingProgress {
  id           Int       @id @default(autoincrement())
  userId       Int
  mangaId      Int
  chapterId    Int
  currentPage  Int       @default(1)
  totalPages   Int
  readingTime  Int       @default(0)
  completedAt  DateTime?
  lastReadAt   DateTime  @default(now())
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  user         User      @relation(fields: [userId], references: [id])
  manga        Manga     @relation(fields: [mangaId], references: [id])
  chapter      Chapter   @relation(fields: [chapterId], references: [id])
  
  @@unique([userId, mangaId, chapterId])
}

model ReadingHistory {
  id           Int       @id @default(autoincrement())
  userId       Int
  mangaId      Int
  chapterId    Int
  startedAt    DateTime  @default(now())
  endedAt      DateTime?
  pagesRead    Int       @default(0)
  totalTime    Int       @default(0)
  
  user         User      @relation(fields: [userId], references: [id])
  manga        Manga     @relation(fields: [mangaId], references: [id])
  chapter      Chapter   @relation(fields: [chapterId], references: [id])
}

model ReaderBookmark {
  id           Int       @id @default(autoincrement())
  userId       Int
  mangaId      Int
  chapterId    Int
  pageNumber   Int
  note         String?
  createdAt    DateTime  @default(now())
  
  user         User      @relation(fields: [userId], references: [id])
  manga        Manga     @relation(fields: [mangaId], references: [id])
  chapter      Chapter   @relation(fields: [chapterId], references: [id])
}

model ReaderSettings {
  id                  Int      @id @default(autoincrement())
  userId              Int      @unique
  readingMode         String   @default("single")
  readingDirection    String   @default("rtl")
  backgroundColor     String   @default("#000000")
  fitMode             String   @default("fit-width")
  showToolbar         Boolean  @default(true)
  preloadPages        Int      @default(3)
  doublePageOffset    Boolean  @default(false)
  brightness          Float    @default(1.0)
  contrast            Float    @default(1.0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  user                User     @relation(fields: [userId], references: [id])
}

model ReadingAnalytics {
  id                Int      @id @default(autoincrement())
  userId            Int
  date              DateTime @db.Date
  pagesRead         Int      @default(0)
  chaptersCompleted Int      @default(0)
  readingTime       Int      @default(0)
  genres            Json?
  createdAt         DateTime @default(now())
  
  user              User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, date])
}
```

## UI/UX Design

### Desktop Layout
```
┌─────────────────────────────────────────────────────┐
│  [←] [→] Page 15/200  [⊞] [📖] [⚙️] [🔍] [↗️]     │ <- Toolbar
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│                                                     │
│                   Canvas Area                       │
│                 (Manga Pages)                       │
│                                                     │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Chapter 3: The Journey Begins          Reading: 5m  │ <- Status Bar
└─────────────────────────────────────────────────────┘
```

### Mobile/Tablet Layout
```
┌─────────────────────┐
│     Page 15/200     │ <- Minimal header
├─────────────────────┤
│                     │
│                     │
│                     │
│    Canvas Area      │
│   (Full Screen)     │
│                     │
│   Tap zones for     │
│    navigation       │
│                     │
│                     │
└─────────────────────┘
```

### Theme Options
1. **Dark Mode** (Default)
   - Background: #000000
   - Toolbar: #1a1a1a
   - Text: #ffffff
   
2. **Light Mode**
   - Background: #ffffff
   - Toolbar: #f5f5f5
   - Text: #000000
   
3. **Sepia Mode**
   - Background: #f4ecd8
   - Toolbar: #e8dcc6
   - Text: #5c4b37

## Performance Optimization

### 1. Image Optimization
```typescript
class ImageOptimizer {
  // Resize images based on viewport
  async optimizeForDisplay(
    image: ImageData,
    viewport: { width: number; height: number }
  ): Promise<ImageData> {
    const optimalSize = this.calculateOptimalSize(image, viewport);
    return this.resizeImage(image, optimalSize);
  }
  
  // Progressive loading
  async loadProgressive(url: string): Promise<ImageData> {
    // Load low quality first
    const lowQuality = await this.loadImage(url, { quality: 0.2 });
    this.displayImage(lowQuality);
    
    // Then load full quality
    const fullQuality = await this.loadImage(url, { quality: 1.0 });
    return fullQuality;
  }
}
```

### 2. Memory Management
```typescript
class MemoryManager {
  private maxCacheSize = 100 * 1024 * 1024; // 100MB
  private cache = new Map<string, ImageData>();
  
  addToCache(key: string, image: ImageData): void {
    const size = image.data.length;
    
    // Evict old entries if needed
    while (this.getCurrentSize() + size > this.maxCacheSize) {
      const oldest = this.getOldestEntry();
      this.cache.delete(oldest);
    }
    
    this.cache.set(key, image);
  }
}
```

### 3. Web Worker for Heavy Operations
```typescript
// reader.worker.ts
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'EXTRACT_ARCHIVE':
      const pages = await extractArchive(data.file);
      self.postMessage({ type: 'ARCHIVE_EXTRACTED', pages });
      break;
      
    case 'PROCESS_IMAGE':
      const processed = await processImage(data.image, data.options);
      self.postMessage({ type: 'IMAGE_PROCESSED', processed });
      break;
      
    case 'OCR_PAGE':
      const text = await performOCR(data.image);
      self.postMessage({ type: 'OCR_COMPLETE', text });
      break;
  }
});
```

## Security Considerations

### 1. File Access Control
```typescript
// Validate file access permissions
async function validateFileAccess(
  userId: number,
  mangaId: number
): Promise<boolean> {
  // Check if user owns or has access to the manga
  const hasAccess = await prisma.userManga.findFirst({
    where: {
      userId,
      mangaId,
      OR: [
        { owned: true },
        { shared: true }
      ]
    }
  });
  
  return !!hasAccess;
}
```

### 2. Content Security Policy
```typescript
// Set CSP headers for reader
const readerCSP = {
  'default-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'script-src': ["'self'", "'unsafe-inline'"], // For reader scripts
  'style-src': ["'self'", "'unsafe-inline'"],
  'worker-src': ["'self'", 'blob:'],
  'connect-src': ["'self'"]
};
```

### 3. Input Validation
```typescript
// Validate and sanitize file uploads
const fileValidation = {
  maxSize: 500 * 1024 * 1024, // 500MB
  allowedTypes: ['application/x-cbz', 'application/x-cbr', 'application/pdf'],
  allowedExtensions: ['.cbz', '.cbr', '.pdf', '.zip'],
  
  validate(file: File): ValidationResult {
    if (file.size > this.maxSize) {
      return { valid: false, error: 'File too large' };
    }
    
    if (!this.allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type' };
    }
    
    const ext = path.extname(file.name).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      return { valid: false, error: 'Invalid file extension' };
    }
    
    return { valid: true };
  }
};
```

## Testing Strategy

### 1. Unit Tests
```typescript
// FileManager.test.ts
describe('FileManager', () => {
  it('should load CBZ files correctly', async () => {
    const manager = new FileManager();
    const result = await manager.loadMangaFile(1, 1);
    
    expect(isSuccess(result)).toBe(true);
    expect(result.data.format).toBe('cbz');
  });
  
  it('should handle corrupted files gracefully', async () => {
    const manager = new FileManager();
    const result = await manager.loadMangaFile(999, 999);
    
    expect(isError(result)).toBe(true);
    expect(result.error.message).toContain('Failed to load');
  });
});
```

### 2. Integration Tests
```typescript
// NativeReader.test.tsx
describe('NativeReader', () => {
  it('should render and load manga chapter', async () => {
    const { getByText, getByRole } = render(
      <NativeReader mangaId={1} chapterId={1} />
    );
    
    await waitFor(() => {
      expect(getByText('Page 1/20')).toBeInTheDocument();
    });
    
    const canvas = getByRole('img');
    expect(canvas).toBeInTheDocument();
  });
});
```

### 3. E2E Tests
```typescript
// reader.e2e.ts
test('complete reading flow', async ({ page }) => {
  // Navigate to manga
  await page.goto('/manga/1');
  await page.click('text=Read Chapter 1');
  
  // Wait for reader to load
  await page.waitForSelector('.native-reader');
  
  // Test navigation
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.page-indicator')).toContainText('2/20');
  
  // Test settings
  await page.click('[aria-label="Settings"]');
  await page.click('text=Double Page');
  
  // Verify double page mode
  await expect(page.locator('.reader-canvas')).toHaveClass(/double-page/);
});
```

## Timeline & Milestones

### Development Timeline (13 weeks)

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 1: Core Reader** | 3 weeks | Basic reader with CBZ support |
| **Phase 2: Enhanced Navigation** | 2 weeks | All reading modes, gestures |
| **Phase 3: Smart Features** | 3 weeks | Preloading, zoom, analytics |
| **Phase 4: Advanced Features** | 3 weeks | OCR, social features |
| **Phase 5: Polish** | 2 weeks | Performance, accessibility |

### Key Milestones

1. **Week 3**: Basic reader functional (MVP)
2. **Week 5**: All navigation features complete
3. **Week 8**: Smart features integrated
4. **Week 11**: Advanced features ready
5. **Week 13**: Production-ready release

### Success Metrics

- Page load time < 100ms
- Memory usage < 200MB for typical manga
- User satisfaction score > 4.5/5
- Zero critical bugs in production
- 95%+ test coverage

## Conclusion

This comprehensive implementation plan provides a roadmap for integrating a powerful, feature-rich manga reader into Mugiwara-Kaizoku. The phased approach allows for incremental development while maintaining high quality standards. The architecture is designed to be extensible, performant, and user-friendly, setting the foundation for an exceptional reading experience.

### Next Steps
1. Review and approve the implementation plan
2. Set up the development environment
3. Begin Phase 1 implementation
4. Create detailed technical specifications for each component
5. Establish testing and QA processes
