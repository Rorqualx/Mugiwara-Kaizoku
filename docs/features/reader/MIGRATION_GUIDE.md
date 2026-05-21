# MIGRATION_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for MIGRATION_GUIDE

---
# Reader Integration - Migration Guide

## Overview

This guide outlines how to integrate the native reader into the existing Mugiwara-Kaizoku codebase while following established patterns and maintaining compatibility.

## Integration Points

### 1. Database Schema Updates

Add the reader-related tables to your existing schema:

```sql
-- Add to your migration file
-- These tables complement existing manga/chapter tables

ALTER TABLE chapters 
ADD COLUMN IF NOT EXISTS file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS file_format VARCHAR(10),
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0;

-- Then create new tables as specified in the implementation plan
```

Update Prisma schema:

```prisma
// Add to existing Chapter model
model Chapter {
  // ... existing fields
  filePath        String?
  fileFormat      String?
  pageCount       Int          @default(0)
  
  // New relations
  readingProgress ReadingProgress[]
  readingHistory  ReadingHistory[]
  bookmarks       ReaderBookmark[]
}

// Add new models as specified
```

### 2. Router Integration

Add reader endpoints to your tRPC router:

```typescript
// src/server/api/routers/reader.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import path from 'path';
import fs from 'fs/promises';

export const readerRouter = router({
  getChapterFile: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      chapterId: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
        include: { manga: true }
      });
      
      if (!chapter) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      // Validate user has access
      const hasAccess = await validateUserAccess(
        ctx.session?.user?.id,
        input.mangaId
      );
      
      if (!hasAccess) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      
      return {
        filePath: chapter.filePath,
        format: chapter.fileFormat,
        pageCount: chapter.pageCount,
        title: chapter.title
      };
    }),
    
  updateProgress: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      chapterId: z.number(),
      currentPage: z.number(),
      totalPages: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      
      return ctx.prisma.readingProgress.upsert({
        where: {
          userId_mangaId_chapterId: {
            userId: ctx.session.user.id,
            mangaId: input.mangaId,
            chapterId: input.chapterId
          }
        },
        create: {
          userId: ctx.session.user.id,
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          currentPage: input.currentPage,
          totalPages: input.totalPages
        },
        update: {
          currentPage: input.currentPage,
          lastReadAt: new Date()
        }
      });
    }),
    
  getProgress: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      chapterId: z.number()
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) return null;
      
      return ctx.prisma.readingProgress.findUnique({
        where: {
          userId_mangaId_chapterId: {
            userId: ctx.session.user.id,
            mangaId: input.mangaId,
            chapterId: input.chapterId
          }
        }
      });
    })
});

// Add to root router
export const appRouter = router({
  // ... existing routers
  reader: readerRouter
});
```

### 3. File Access Service

Create a secure file access service following existing patterns:

```typescript
// src/services/reader/FileAccessService.ts
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';
import { prisma } from '@/server/db';
import path from 'path';
import fs from 'fs/promises';

export class FileAccessService {
  private baseDir: string;
  
  constructor() {
    this.baseDir = process.env.MANGA_FILES_DIR || '/data/manga';
  }
  
  async getChapterFile(
    userId: number | undefined,
    mangaId: number,
    chapterId: number
  ): Promise<AsyncResult<Buffer, Error>> {
    try {
      // Validate access
      if (!userId) {
        return createErrorResult(new Error('Unauthorized'));
      }
      
      // Get chapter info
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { manga: true }
      });
      
      if (!chapter || !chapter.filePath) {
        return createErrorResult(new Error('Chapter file not found'));
      }
      
      // Validate user has access to this manga
      const hasAccess = await this.validateAccess(userId, mangaId);
      if (!hasAccess) {
        return createErrorResult(new Error('Access denied'));
      }
      
      // Read file
      const fullPath = path.join(this.baseDir, chapter.filePath);
      const fileBuffer = await fs.readFile(fullPath);
      
      return createSuccessResult(fileBuffer);
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to read file')
      );
    }
  }
  
  private async validateAccess(
    userId: number,
    mangaId: number
  ): Promise<boolean> {
    // Check if user has access to this manga
    const access = await prisma.userManga.findFirst({
      where: {
        userId,
        mangaId,
        OR: [
          { owned: true },
          { shared: true }
        ]
      }
    });
    
    return !!access;
  }
}
```

### 4. Update Manga Components

Add reader integration to existing manga components:

```typescript
// Update src/components/manga/ChapterList.tsx
import { useRouter } from 'next/router';
import { IconBook, IconDownload } from '@tabler/icons-react';
import { Button, Group } from '@mantine/core';

interface ChapterItemProps {
  chapter: Chapter;
  mangaId: number;
}

function ChapterItem({ chapter, mangaId }: ChapterItemProps) {
  const router = useRouter();
  
  const handleRead = () => {
    router.push(`/read/${mangaId}/${chapter.id}`);
  };
  
  return (
    <Group position="apart">
      <Text>{chapter.title}</Text>
      <Group>
        {chapter.downloadStatus === 'COMPLETED' && chapter.filePath && (
          <Button 
            size="xs" 
            leftIcon={<IconBook size={16} />}
            onClick={handleRead}
          >
            Read
          </Button>
        )}
        <Button 
          size="xs" 
          leftIcon={<IconDownload size={16} />}
          onClick={() => downloadChapter(chapter.id)}
        >
          Download
        </Button>
      </Group>
    </Group>
  );
}
```

### 5. Add Reader to Navigation

Update your layout to include reader-specific navigation:

```typescript
// src/components/layout/MainLayout.tsx
import { useRouter } from 'next/router';

export function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isReaderPage = router.pathname.startsWith('/read/');
  
  // Hide navigation for reader pages
  if (isReaderPage) {
    return <>{children}</>;
  }
  
  return (
    <AppShell
      navbar={<NavigationBar />}
      header={<Header />}
    >
      {children}
    </AppShell>
  );
}
```

### 6. Download System Integration

Update download clients to save file information:

```typescript
// Update download completion handler
async function handleDownloadComplete(download: Download) {
  const { mangaId, chapterId, filePath } = download;
  
  // Update chapter with file info
  await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      filePath: path.relative(MANGA_FILES_DIR, filePath),
      fileFormat: detectFormat(filePath),
      pageCount: await countPages(filePath),
      downloadStatus: 'COMPLETED'
    }
  });
  
  // Trigger notification
  await notificationService.notify({
    type: 'DOWNLOAD_COMPLETE',
    title: 'Chapter Ready to Read',
    message: `Chapter ${chapter.number} is ready`,
    actions: [{
      label: 'Read Now',
      url: `/read/${mangaId}/${chapterId}`
    }]
  });
}
```

### 7. Settings Integration

Add reader settings to user preferences:

```typescript
// Update src/store/settingsSlice.ts
interface SettingsState {
  // ... existing settings
  reader: {
    mode: 'single' | 'double' | 'continuous';
    direction: 'ltr' | 'rtl';
    theme: 'dark' | 'light' | 'sepia';
    preloadPages: number;
    showToolbar: boolean;
  };
}

// Add to settings page
export function ReaderSettingsSection() {
  const { reader, updateReaderSettings } = useSettings();
  
  return (
    <Stack>
      <Title order={3}>Reader Settings</Title>
      
      <Select
        label="Default Reading Mode"
        value={reader.mode}
        onChange={(value) => updateReaderSettings({ mode: value })}
        data={[
          { value: 'single', label: 'Single Page' },
          { value: 'double', label: 'Double Page' },
          { value: 'continuous', label: 'Continuous Scroll' }
        ]}
      />
      
      <Select
        label="Reading Direction"
        value={reader.direction}
        onChange={(value) => updateReaderSettings({ direction: value })}
        data={[
          { value: 'rtl', label: 'Right to Left (Manga)' },
          { value: 'ltr', label: 'Left to Right (Comics)' }
        ]}
      />
      
      <NumberInput
        label="Preload Pages"
        value={reader.preloadPages}
        onChange={(value) => updateReaderSettings({ preloadPages: value })}
        min={1}
        max={10}
      />
    </Stack>
  );
}
```

### 8. Progress Display Integration

Show reading progress in manga list:

```typescript
// Update manga card component
function MangaCard({ manga }: { manga: MangaWithProgress }) {
  const progress = manga.readingProgress?.[0];
  
  return (
    <Card>
      <Card.Section>
        <Image src={manga.coverUrl} height={200} />
        {progress && (
          <Progress
            value={(progress.currentChapter / manga.totalChapters) * 100}
            label={`${progress.currentChapter}/${manga.totalChapters}`}
            size="sm"
            radius={0}
          />
        )}
      </Card.Section>
      
      <Text weight={500}>{manga.title}</Text>
      
      {progress && (
        <Button
          size="xs"
          fullWidth
          onClick={() => continueReading(manga.id, progress.chapterId)}
        >
          Continue Chapter {progress.currentChapter}
        </Button>
      )}
    </Card>
  );
}
```

### 9. API File Serving

Set up secure file serving for the reader:

```typescript
// pages/api/reader/file/[...params].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { FileAccessService } from '@/services/reader/FileAccessService';
import { isSuccess } from '@/utils/async-result';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { params } = req.query;
  if (!Array.isArray(params) || params.length !== 2) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  
  const [mangaId, chapterId] = params.map(Number);
  
  const fileService = new FileAccessService();
  const result = await fileService.getChapterFile(
    session.user.id,
    mangaId,
    chapterId
  );
  
  if (isSuccess(result)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(result.data);
  } else {
    res.status(404).json({ error: result.error.message });
  }
}

export const config = {
  api: {
    responseLimit: '100mb',
  },
};
```

### 10. Testing Integration

Add reader tests to existing test suite:

```typescript
// src/tests/reader.test.ts
import { render, screen } from '@testing-library/react';
import { ReaderPage } from '@/pages/read/[mangaId]/[chapterId]';
import { mockTrpcClient } from '@/tests/utils/mockTrpc';

describe('Reader Integration', () => {
  it('should load chapter file', async () => {
    const mockChapter = {
      id: 1,
      title: 'Chapter 1',
      filePath: 'manga1/chapter1.cbz',
      pageCount: 20
    };
    
    mockTrpcClient.reader.getChapterFile.mockResolvedValue(mockChapter);
    
    render(<ReaderPage mangaId={1} chapterId={1} />);
    
    await screen.findByText('Page 1 / 20');
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
  
  it('should save reading progress', async () => {
    const updateProgress = jest.fn();
    mockTrpcClient.reader.updateProgress.mockImplementation(updateProgress);
    
    // Test progress saving logic
  });
});
```

## Migration Checklist

### Phase 1: Foundation (Week 1)
- [ ] Update database schema
- [ ] Run migrations
- [ ] Add reader router to tRPC
- [ ] Create file access service
- [ ] Set up basic reader page

### Phase 2: Integration (Week 2)
- [ ] Update chapter components with read buttons
- [ ] Add reader settings to preferences
- [ ] Integrate with download system
- [ ] Set up file serving API

### Phase 3: Enhancement (Week 3)
- [ ] Add progress tracking UI
- [ ] Implement continue reading feature
- [ ] Add reader to navigation
- [ ] Set up analytics

### Phase 4: Testing (Week 4)
- [ ] Unit tests for reader services
- [ ] Integration tests for file access
- [ ] E2E tests for reading flow
- [ ] Performance testing

## Common Integration Issues

### 1. File Path Resolution

```typescript
// Always use absolute paths internally
const absolutePath = path.resolve(MANGA_FILES_DIR, chapter.filePath);

// Store relative paths in database
const relativePath = path.relative(MANGA_FILES_DIR, absolutePath);
```

### 2. CORS Issues

```typescript
// Configure Next.js for reader assets
module.exports = {
  async headers() {
    return [
      {
        source: '/api/reader/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};
```

### 3. Memory Management

```typescript
// Clean up blob URLs
useEffect(() => {
  return () => {
    if (currentImageUrl) {
      URL.revokeObjectURL(currentImageUrl);
    }
  };
}, [currentImageUrl]);
```

### 4. Session Handling

```typescript
// Ensure session is available in reader
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  
  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }
  
  return {
    props: { session },
  };
};
```

## Performance Considerations

### 1. Lazy Loading
- Load pages on demand, not entire archive
- Use Intersection Observer for continuous mode
- Implement virtual scrolling for large chapters

### 2. Caching Strategy
- Cache extracted pages in IndexedDB
- Use service workers for offline support
- Implement smart cache eviction

### 3. Bundle Optimization
- Lazy load reader components
- Use dynamic imports for heavy libraries
- Separate reader chunk in build

## Security Considerations

### 1. File Access Control
- Always validate user permissions
- Use signed URLs for file access
- Implement rate limiting

### 2. Input Validation
- Validate file formats before processing
- Sanitize file paths
- Check file sizes

### 3. Content Security
- Set appropriate CSP headers
- Validate image content
- Prevent script injection

## Monitoring & Analytics

Add reader-specific metrics:

```typescript
// Track reader events
analytics.track('reader.opened', {
  mangaId,
  chapterId,
  format: chapter.fileFormat
});

analytics.track('reader.progress', {
  mangaId,
  chapterId,
  currentPage,
  totalPages,
  readingTime
});
```

## Rollback Plan

If issues arise:

1. Feature flag to disable reader
2. Revert database migrations
3. Remove reader routes
4. Clean up file references

The modular design ensures the reader can be disabled without affecting core functionality.
