# QUICK_START_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for QUICK_START_GUIDE

---
# Reader Integration - Quick Start Guide

## Overview

This guide provides a quick path to implementing the native manga reader in Mugiwara-Kaizoku. Follow these steps to get a basic reader up and running.

## Prerequisites

1. **Install Required Dependencies**
```bash
pnpm add comicbook.js jszip pdf.js tesseract.js comlink framer-motion
pnpm add -D @types/pdfjs-dist
```

2. **Update TypeScript Config**
Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

## Step 1: Create Basic File Structure

```bash
# Create directories
mkdir -p src/components/reader
mkdir -p src/hooks/reader
mkdir -p src/services/reader
mkdir -p src/services/reader/handlers
mkdir -p src/types/reader
mkdir -p src/pages/read
```

## Step 2: Add Reader Types

Create `src/types/reader/reader-types.ts`:

```typescript
export interface MangaFile {
  id: string;
  mangaId: number;
  chapterId: number;
  blob: Blob;
  format: 'cbz' | 'cbr' | 'pdf' | 'zip';
  totalPages: number;
}

export interface ReaderSettings {
  readingMode: 'single' | 'double' | 'continuous';
  readingDirection: 'ltr' | 'rtl';
  fitMode: 'fit-width' | 'fit-height' | 'original';
  backgroundColor: string;
}
```

## Step 3: Create Reader Store

Add to `src/store/readerSlice.ts`:

```typescript
import { create } from 'zustand';

interface ReaderStore {
  currentFile: MangaFile | null;
  currentPage: number;
  settings: ReaderSettings;
  
  setFile: (file: MangaFile) => void;
  setPage: (page: number) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

export const useReaderStore = create<ReaderStore>((set) => ({
  currentFile: null,
  currentPage: 1,
  settings: {
    readingMode: 'single',
    readingDirection: 'rtl',
    fitMode: 'fit-width',
    backgroundColor: '#000000'
  },
  
  setFile: (file) => set({ currentFile: file, currentPage: 1 }),
  setPage: (page) => set({ currentPage: page }),
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  }))
}));
```

## Step 4: Create Basic Reader Component

Create `src/components/reader/BasicReader.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { Box, Button, Group, Text } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { useReaderStore } from '@/store/readerSlice';

export function BasicReader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentFile, currentPage, setPage } = useReaderStore();
  
  const nextPage = () => {
    if (currentFile && currentPage < currentFile.totalPages) {
      setPage(currentPage + 1);
    }
  };
  
  const prevPage = () => {
    if (currentPage > 1) {
      setPage(currentPage - 1);
    }
  };
  
  useEffect(() => {
    // Basic page rendering logic here
    if (canvasRef.current && currentFile) {
      // Render page to canvas
      console.log('Rendering page', currentPage);
    }
  }, [currentFile, currentPage]);
  
  if (!currentFile) {
    return <Text>No file loaded</Text>;
  }
  
  return (
    <Box h="100vh" bg="black">
      <Group position="apart" p="md">
        <Button onClick={prevPage} disabled={currentPage === 1}>
          <IconArrowLeft />
        </Button>
        
        <Text c="white">
          Page {currentPage} / {currentFile.totalPages}
        </Text>
        
        <Button onClick={nextPage} disabled={currentPage === currentFile.totalPages}>
          <IconArrowRight />
        </Button>
      </Group>
      
      <Box p="md">
        <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '80vh' }} />
      </Box>
    </Box>
  );
}
```

## Step 5: Create Reader Route

Add to your Next.js routing:

```typescript
// src/pages/read/[mangaId]/[chapterId].tsx
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { BasicReader } from '@/components/reader/BasicReader';
import { useReaderStore } from '@/store/readerSlice';
import { trpc } from '@/utils/trpc-client/index';

export default function ReadPage() {
  const router = useRouter();
  const { mangaId, chapterId } = router.query;
  const setFile = useReaderStore((state) => state.setFile);
  
  // Fetch chapter data
  const { data: chapter } = trpc.chapters.get.useQuery(
    { id: Number(chapterId) },
    { enabled: !!chapterId }
  );
  
  useEffect(() => {
    if (chapter?.filePath) {
      // Load the file
      fetch(chapter.filePath)
        .then(res => res.blob())
        .then(blob => {
          setFile({
            id: `${mangaId}-${chapterId}`,
            mangaId: Number(mangaId),
            chapterId: Number(chapterId),
            blob,
            format: 'cbz', // Detect from file
            totalPages: 20 // Get from file
          });
        });
    }
  }, [chapter, mangaId, chapterId, setFile]);
  
  return <BasicReader />;
}
```

## Step 6: Add Archive Support

Create `src/services/reader/SimpleArchiveHandler.ts`:

```typescript
import JSZip from 'jszip';

export class SimpleArchiveHandler {
  async extractPages(blob: Blob): Promise<Blob[]> {
    const zip = new JSZip();
    const contents = await zip.loadAsync(blob);
    
    const pages: Blob[] = [];
    const files = Object.keys(contents.files).sort();
    
    for (const filename of files) {
      if (this.isImage(filename)) {
        const fileData = contents.files[filename];
        const blob = await fileData.async('blob');
        pages.push(blob);
      }
    }
    
    return pages;
  }
  
  private isImage(filename: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  }
}
```

## Step 7: Update Reader to Display Pages

Update `BasicReader.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { SimpleArchiveHandler } from '@/services/reader/SimpleArchiveHandler';

export function BasicReader() {
  const [pages, setPages] = useState<Blob[]>([]);
  const [currentImage, setCurrentImage] = useState<string>('');
  
  useEffect(() => {
    if (currentFile) {
      const handler = new SimpleArchiveHandler();
      handler.extractPages(currentFile.blob).then(setPages);
    }
  }, [currentFile]);
  
  useEffect(() => {
    if (pages[currentPage - 1]) {
      const url = URL.createObjectURL(pages[currentPage - 1]);
      setCurrentImage(url);
      
      return () => URL.revokeObjectURL(url);
    }
  }, [pages, currentPage]);
  
  // Update render to show image instead of canvas
  return (
    <Box h="100vh" bg="black">
      {/* Navigation stays the same */}
      
      <Box p="md" style={{ textAlign: 'center' }}>
        {currentImage && (
          <img 
            src={currentImage} 
            alt={`Page ${currentPage}`}
            style={{ maxWidth: '100%', maxHeight: '80vh' }}
          />
        )}
      </Box>
    </Box>
  );
}
```

## Step 8: Add Keyboard Navigation

Add to `BasicReader.tsx`:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        prevPage();
        break;
      case 'ArrowRight':
        nextPage();
        break;
      case ' ':
        e.preventDefault();
        nextPage();
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentPage, currentFile]);
```

## Step 9: Add Progress Tracking

Create tRPC mutation:

```typescript
// In your tRPC router
export const readingRouter = router({
  updateProgress: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      chapterId: z.number(),
      page: z.number(),
      totalPages: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.readingProgress.upsert({
        where: {
          userId_mangaId_chapterId: {
            userId: ctx.session?.user?.id || 0,
            mangaId: input.mangaId,
            chapterId: input.chapterId
          }
        },
        create: {
          userId: ctx.session?.user?.id || 0,
          ...input,
          currentPage: input.page
        },
        update: {
          currentPage: input.page,
          lastReadAt: new Date()
        }
      });
    })
});
```

Add to reader:

```typescript
const progressMutation = trpc.reading.updateProgress.useMutation();

useEffect(() => {
  if (currentFile && currentPage) {
    progressMutation.mutate({
      mangaId: currentFile.mangaId,
      chapterId: currentFile.chapterId,
      page: currentPage,
      totalPages: currentFile.totalPages
    });
  }
}, [currentPage]);
```

## Step 10: Add Basic Settings

Create `src/components/reader/ReaderSettings.tsx`:

```typescript
import { Popover, Stack, Select, ColorInput } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { useReaderStore } from '@/store/readerSlice';

export function ReaderSettings() {
  const { settings, updateSettings } = useReaderStore();
  
  return (
    <Popover>
      <Popover.Target>
        <Button variant="subtle">
          <IconSettings />
        </Button>
      </Popover.Target>
      
      <Popover.Dropdown>
        <Stack>
          <Select
            label="Reading Mode"
            value={settings.readingMode}
            onChange={(value) => updateSettings({ readingMode: value as any })}
            data={[
              { value: 'single', label: 'Single Page' },
              { value: 'double', label: 'Double Page' },
              { value: 'continuous', label: 'Continuous' }
            ]}
          />
          
          <Select
            label="Direction"
            value={settings.readingDirection}
            onChange={(value) => updateSettings({ readingDirection: value as any })}
            data={[
              { value: 'ltr', label: 'Left to Right' },
              { value: 'rtl', label: 'Right to Left' }
            ]}
          />
          
          <ColorInput
            label="Background"
            value={settings.backgroundColor}
            onChange={(value) => updateSettings({ backgroundColor: value })}
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
```

## Quick Implementation Checklist

- [ ] Install dependencies
- [ ] Create file structure
- [ ] Add reader types
- [ ] Create reader store
- [ ] Build basic reader component
- [ ] Add reader route
- [ ] Implement archive extraction
- [ ] Add keyboard navigation
- [ ] Setup progress tracking
- [ ] Add settings panel

## Testing the Reader

1. **Add a test button to your manga detail page:**

```typescript
<Button 
  onClick={() => router.push(`/read/${manga.id}/${chapters[0].id}`)}
>
  Read Chapter
</Button>
```

2. **Ensure you have test CBZ files in your manga directory**

3. **Run the development server:**
```bash
pnpm dev
```

## Next Steps

Once the basic reader is working:

1. **Enhance Performance**
   - Add page preloading
   - Implement image caching
   - Use Web Workers for extraction

2. **Improve UX**
   - Add loading indicators
   - Implement smooth transitions
   - Add touch gestures

3. **Add Smart Features**
   - Panel detection
   - Smart zoom
   - Reading analytics

4. **Polish the UI**
   - Better toolbar design
   - Fullscreen mode
   - Mobile optimization

## Troubleshooting

### Common Issues

1. **Pages not loading**: Check file paths and CORS settings
2. **Memory issues**: Implement proper cleanup of object URLs
3. **Performance**: Use canvas instead of img tags for large files
4. **Mobile gestures**: Use touch event libraries like Hammer.js

### Debug Mode

Add debug logging:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Reader Debug:', {
    currentFile,
    currentPage,
    totalPages: pages.length
  });
}
```

## Resources

- [ComicBook.js Documentation](https://github.com/ComicBookJS/ComicBook.js)
- [JSZip Documentation](https://stuk.github.io/jszip/)
- [PDF.js Examples](https://mozilla.github.io/pdf.js/examples/)
- [Tesseract.js Guide](https://tesseract.projectnaptha.com/)

## Support

For issues or questions:
1. Check the full implementation plan
2. Review the technical specifications
3. Consult the architecture documentation
4. Open an issue with detailed information
