# File Converter System - Comprehensive Plan

*Status: Draft*
*Author: Development Team*
*Canonical: Yes*
*Last Updated: 2025-10-15*

## Overview

Design and implementation plan for a robust file format converter system that converts manga files between CBZ, PDF, and EPUB formats with built-in redundancy, error handling, and post-processing integration.

---

## Current State Analysis

### What Exists

**Reading Formats (via file-utils.ts)**
- ✅ CBZ, ZIP (adm-zip)
- ✅ CBR, RAR (unrar CLI)
- ✅ 7z (7z CLI)
- ✅ PDF (detection only)
- ✅ EPUB (detection only)

**Creating Formats (via package.json)**
- ✅ CBZ (jszip ^3.10.1)

**Post-Processing Pipeline (via downloadMonitor.ts + fileImporter.ts)**
- ✅ Download completion detection
- ✅ Archive extraction
- ✅ File copying to library
- ✅ Chapter record updates
- ❌ **NO format conversion**

### What's Missing

**Conversion Dependencies**
- ❌ PDF generation (need: jspdf or pdfkit)
- ❌ EPUB generation (need: epub-gen or similar)
- ❌ Image optimization (optional: sharp)
- ❌ Conversion orchestration service

**Infrastructure**
- ❌ Converter factory pattern
- ❌ Format detection/validation
- ❌ Conversion queue system
- ❌ Error recovery/retry logic
- ❌ Progress tracking
- ❌ Batch conversion support

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     User Downloads File                     │
│              (from Prowlarr/Download Client)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              DownloadMonitor (Existing)                     │
│  - Detects completed downloads                              │
│  - Triggers FileImporter                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              FileImporter (Enhanced)                        │
│  1. Extract archive (if needed)                             │
│  2. Validate file format                                    │
│  3. Check if conversion needed                              │
│  4. ┌──────────────────────────────────────┐               │
│     │ IF conversion needed:                │               │
│     │  - Queue conversion job              │               │
│     │  - Store original file               │               │
│     │  ELSE:                                │               │
│     │  - Copy to library as-is             │               │
│     └──────────────────────────────────────┘               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│          FormatConversionService (NEW)                      │
│  - Manages conversion queue                                 │
│  - Selects appropriate converter                            │
│  - Handles errors and retries                               │
│  - Tracks progress                                          │
│  - Notifies on completion/failure                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│          ConverterFactory (NEW)                             │
│  - Creates converter instances                              │
│  - Input format detection                                   │
│  - Output format selection                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Converter Adapters (NEW)                       │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │ CBZConverter │ PDFConverter │ EPUBConverter│            │
│  └──────────────┴──────────────┴──────────────┘            │
│                                                             │
│  Each implements:                                           │
│  - convert(input, output, options)                          │
│  - validate(file)                                           │
│  - getMetadata(file)                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              File Operations (NEW)                          │
│  - Image extraction from archives                           │
│  - Image optimization (optional)                            │
│  - Metadata preservation                                    │
│  - Page ordering/sorting                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Design

### 1. FormatConversionService

**Location**: `/src/server/services/conversion/formatConversionService.ts`

**Responsibilities**:
- Queue conversion jobs
- Manage job lifecycle (pending → processing → completed/failed)
- Retry failed conversions with exponential backoff
- Track conversion progress
- Send notifications on completion
- Clean up temporary files

**Key Methods**:
```typescript
class FormatConversionService {
  /**
   * Queue a conversion job
   */
  async queueConversion(params: {
    sourceFilePath: string;
    targetFormat: 'cbz' | 'pdf' | 'epub';
    mangaId: number;
    chapterId: number;
    priority?: number;
  }): Promise<ConversionJob>;

  /**
   * Process the conversion queue
   */
  async processQueue(): Promise<void>;

  /**
   * Get conversion status
   */
  async getStatus(jobId: string): Promise<ConversionJobStatus>;

  /**
   * Cancel a conversion
   */
  async cancelConversion(jobId: string): Promise<void>;

  /**
   * Retry a failed conversion
   */
  async retryConversion(jobId: string): Promise<void>;
}
```

**Database Schema** (add to prisma/schema.prisma):
```prisma
model ConversionJob {
  id               String   @id @default(cuid())
  mangaId          Int
  chapterId        Int
  sourceFilePath   String   // Original file
  targetFilePath   String?  // Converted file (when complete)
  sourceFormat     String   // Original format
  targetFormat     String   // Desired format
  status           ConversionStatus
  priority         Int      @default(5)
  attempts         Int      @default(0)
  maxAttempts      Int      @default(3)
  errorMessage     String?
  progress         Float    @default(0) // 0-100
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  completedAt      DateTime?

  manga   Manga   @relation(fields: [mangaId], references: [id], onDelete: Cascade)
  chapter Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@index([status, priority])
  @@index([mangaId])
  @@index([chapterId])
}

enum ConversionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

### 2. ConverterFactory

**Location**: `/src/server/services/conversion/converterFactory.ts`

**Responsibilities**:
- Detect source format
- Select appropriate converter
- Create converter instances
- Validate format compatibility

**Key Methods**:
```typescript
class ConverterFactory {
  /**
   * Create a converter for the given conversion path
   */
  static createConverter(
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat
  ): BaseConverter;

  /**
   * Detect file format from path/contents
   */
  static async detectFormat(filePath: string): Promise<SupportedFormat>;

  /**
   * Check if conversion is supported
   */
  static isConversionSupported(
    source: SupportedFormat,
    target: SupportedFormat
  ): boolean;

  /**
   * Get available converters
   */
  static getAvailableConverters(): ConversionPath[];
}
```

---

### 3. Base Converter Class

**Location**: `/src/server/services/conversion/base/BaseConverter.ts`

**Interface**:
```typescript
abstract class BaseConverter {
  protected logger: Logger;
  protected config: ConverterConfig;

  /**
   * Convert file from source to target format
   */
  abstract convert(
    sourceFile: string,
    targetFile: string,
    options?: ConversionOptions
  ): Promise<AsyncResult<ConversionResult, Error>>;

  /**
   * Validate source file
   */
  abstract validate(sourceFile: string): Promise<AsyncResult<boolean, Error>>;

  /**
   * Get metadata from source file
   */
  abstract getMetadata(sourceFile: string): Promise<AsyncResult<FileMetadata, Error>>;

  /**
   * Estimate conversion time (optional)
   */
  estimateTime?(fileSize: number): number; // seconds

  /**
   * Check if converter is available (dependencies installed)
   */
  abstract isAvailable(): Promise<boolean>;
}

interface ConversionOptions {
  quality?: number; // 1-100
  preserveMetadata?: boolean;
  pageOrder?: 'original' | 'sorted';
  compression?: 'none' | 'low' | 'medium' | 'high';
  imageOptimization?: boolean;
  targetSize?: number; // Max size in bytes
}

interface ConversionResult {
  outputPath: string;
  originalSize: number;
  convertedSize: number;
  pageCount: number;
  duration: number; // milliseconds
  metadata?: Record<string, unknown>;
}

interface FileMetadata {
  format: string;
  pageCount: number;
  dimensions?: { width: number; height: number };
  fileSize: number;
  title?: string;
  author?: string;
}
```

---

### 4. Converter Implementations

#### 4.1 CBZConverter

**Location**: `/src/server/services/conversion/converters/cbzConverter.ts`

**Conversions Supported**:
- PDF → CBZ
- EPUB → CBZ (extract images)
- ZIP → CBZ (rename/repackage)

**Implementation Strategy**:
```typescript
class CBZConverter extends BaseConverter {
  async convert(
    sourceFile: string,
    targetFile: string,
    options?: ConversionOptions
  ): Promise<AsyncResult<ConversionResult, Error>> {
    // 1. Extract images from source
    const images = await this.extractImages(sourceFile);

    // 2. Optional: Optimize images
    if (options?.imageOptimization) {
      await this.optimizeImages(images);
    }

    // 3. Sort pages if requested
    const sortedImages = options?.pageOrder === 'sorted'
      ? this.sortByPageNumber(images)
      : images;

    // 4. Create CBZ archive
    const zip = new JSZip();
    for (const [index, image] of sortedImages.entries()) {
      const filename = `${String(index + 1).padStart(4, '0')}.${image.ext}`;
      zip.file(filename, image.buffer);
    }

    // 5. Add metadata (ComicInfo.xml)
    if (options?.preserveMetadata) {
      const comicInfo = await this.generateComicInfoXML(sourceFile);
      zip.file('ComicInfo.xml', comicInfo);
    }

    // 6. Write to target file
    await zip.generateAsync({ type: 'nodebuffer' })
      .then(buffer => fs.writeFile(targetFile, buffer));

    return createSuccessResult({
      outputPath: targetFile,
      originalSize: (await fs.stat(sourceFile)).size,
      convertedSize: (await fs.stat(targetFile)).size,
      pageCount: sortedImages.length,
      duration: Date.now() - startTime
    });
  }

  private async extractImages(sourceFile: string): Promise<ImageFile[]> {
    const ext = path.extname(sourceFile).toLowerCase();

    if (ext === '.pdf') {
      return this.extractImagesFromPDF(sourceFile);
    } else if (ext === '.epub') {
      return this.extractImagesFromEPUB(sourceFile);
    } else if (['.cbz', '.zip'].includes(ext)) {
      return this.extractImagesFromZIP(sourceFile);
    }

    throw new Error(`Unsupported source format: ${ext}`);
  }

  private async extractImagesFromPDF(pdfPath: string): Promise<ImageFile[]> {
    // Use pdf-lib or pdfjs to extract images
    // Fallback: Use pdf2pic to render pages as images
  }

  private async extractImagesFromEPUB(epubPath: string): Promise<ImageFile[]> {
    // Extract EPUB, find all image files in OEBPS/images or similar
  }

  private async extractImagesFromZIP(zipPath: string): Promise<ImageFile[]> {
    // Use adm-zip or jszip to extract all images
  }
}
```

**Dependencies Needed**:
```json
{
  "pdf-lib": "^1.17.1",      // PDF manipulation
  "pdf2pic": "^3.0.3",       // PDF to images (fallback)
  "epub": "^2.0.0",          // EPUB parsing
  "sharp": "^0.33.0"         // Image optimization (optional)
}
```

#### 4.2 PDFConverter

**Location**: `/src/server/services/conversion/converters/pdfConverter.ts`

**Conversions Supported**:
- CBZ → PDF
- ZIP → PDF (treat as CBZ)
- EPUB → PDF

**Implementation Strategy**:
```typescript
class PDFConverter extends BaseConverter {
  async convert(
    sourceFile: string,
    targetFile: string,
    options?: ConversionOptions
  ): Promise<AsyncResult<ConversionResult, Error>> {
    // 1. Extract images
    const images = await this.extractImages(sourceFile);

    // 2. Create PDF with jspdf
    const { jsPDF } = require('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4',
      compress: options?.compression !== 'none'
    });

    // 3. Add each image as a page
    for (const [index, image] of images.entries()) {
      if (index > 0) pdf.addPage();

      const imgData = await this.imageToDataURL(image);
      const dims = this.calculateDimensions(image, pdf);

      pdf.addImage(
        imgData,
        image.format,
        0,
        0,
        dims.width,
        dims.height
      );
    }

    // 4. Add metadata
    if (options?.preserveMetadata) {
      const metadata = await this.getMetadata(sourceFile);
      pdf.setProperties({
        title: metadata.title || 'Manga',
        author: metadata.author || 'Unknown',
        creator: 'Mugiwara-Kaizoku'
      });
    }

    // 5. Save PDF
    await pdf.save(targetFile);

    return createSuccessResult({
      outputPath: targetFile,
      originalSize: (await fs.stat(sourceFile)).size,
      convertedSize: (await fs.stat(targetFile)).size,
      pageCount: images.length,
      duration: Date.now() - startTime
    });
  }

  private calculateDimensions(
    image: ImageFile,
    pdf: jsPDF
  ): { width: number; height: number } {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgRatio = image.width / image.height;
    const pageRatio = pageWidth / pageHeight;

    if (imgRatio > pageRatio) {
      // Image is wider than page
      return {
        width: pageWidth,
        height: pageWidth / imgRatio
      };
    } else {
      // Image is taller than page
      return {
        width: pageHeight * imgRatio,
        height: pageHeight
      };
    }
  }
}
```

**Dependencies Needed**:
```json
{
  "jspdf": "^2.5.1",         // PDF generation
  "pdf-lib": "^1.17.1"       // PDF manipulation (metadata)
}
```

#### 4.3 EPUBConverter

**Location**: `/src/server/services/conversion/converters/epubConverter.ts`

**Conversions Supported**:
- CBZ → EPUB
- PDF → EPUB (extract images first)
- ZIP → EPUB (treat as CBZ)

**Implementation Strategy**:
```typescript
class EPUBConverter extends BaseConverter {
  async convert(
    sourceFile: string,
    targetFile: string,
    options?: ConversionOptions
  ): Promise<AsyncResult<ConversionResult, Error>> {
    // 1. Extract images
    const images = await this.extractImages(sourceFile);

    // 2. Get metadata
    const metadata = options?.preserveMetadata
      ? await this.getMetadata(sourceFile)
      : null;

    // 3. Create EPUB
    const EPub = require('epub-gen');

    const epub = new EPub({
      title: metadata?.title || 'Manga',
      author: metadata?.author || 'Unknown',
      publisher: 'Mugiwara-Kaizoku',
      cover: images[0]?.buffer, // Use first image as cover
      content: images.map((img, index) => ({
        title: `Page ${index + 1}`,
        data: `<img src="${img.filename}" alt="Page ${index + 1}" style="width:100%;height:auto;" />`
      })),
      images: images.map(img => ({
        path: img.filename,
        data: img.buffer
      }))
    }, targetFile);

    await epub.promise;

    return createSuccessResult({
      outputPath: targetFile,
      originalSize: (await fs.stat(sourceFile)).size,
      convertedSize: (await fs.stat(targetFile)).size,
      pageCount: images.length,
      duration: Date.now() - startTime
    });
  }
}
```

**Dependencies Needed**:
```json
{
  "epub-gen": "^0.1.2",      // EPUB generation
  "jszip": "^3.10.1"         // Already installed
}
```

---

## Integration with Existing Systems

### 1. FileImporter Integration

**Location**: `/src/server/services/download/fileImporter.ts`

**Changes Needed**:
```typescript
export class FileImporter {
  private conversionService: FormatConversionService;

  async importDownload(completedDownload: CompletedDownload): Promise<void> {
    // Existing extraction logic...

    // NEW: Check if conversion needed
    const userFormat = await this.getUserPreferredFormat();
    const currentFormat = this.detectFormat(filePath);

    if (this.shouldConvert(currentFormat, userFormat)) {
      logger.info(`Queueing conversion: ${currentFormat} → ${userFormat}`);

      await this.conversionService.queueConversion({
        sourceFilePath: filePath,
        targetFormat: userFormat,
        mangaId: download.mangaId,
        chapterId: download.chapterId,
        priority: 5
      });

      // Store original file temporarily
      await this.storeOriginal(filePath);
    } else {
      // Copy as-is (existing logic)
      await this.copyToLibrary(filePath);
    }
  }

  private async getUserPreferredFormat(): Promise<SupportedFormat> {
    const setting = await configService.get<string>('defaultDownloadFormat', 'cbz');
    return setting as SupportedFormat;
  }

  private shouldConvert(current: string, preferred: string): boolean {
    return current !== preferred &&
           ConverterFactory.isConversionSupported(current, preferred);
  }
}
```

### 2. Background Job Processing

**Location**: `/src/server/services/conversion/conversionWorker.ts`

**Implementation**:
```typescript
/**
 * Background worker for processing conversion jobs
 */
export class ConversionWorker {
  private isRunning = false;
  private processInterval = 5000; // 5 seconds

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('ConversionWorker started');

    while (this.isRunning) {
      try {
        await this.processPendingJobs();
      } catch (error) {
        logger.error('Error processing conversion jobs', error);
      }

      await this.sleep(this.processInterval);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('ConversionWorker stopped');
  }

  private async processPendingJobs(): Promise<void> {
    const jobs = await prisma.conversionJob.findMany({
      where: { status: 'PENDING' },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 5 // Process 5 at a time
    });

    for (const job of jobs) {
      await this.processJob(job);
    }
  }

  private async processJob(job: ConversionJob): Promise<void> {
    const conversionService = new FormatConversionService();

    try {
      // Update status
      await prisma.conversionJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 }
        }
      });

      // Perform conversion
      const result = await conversionService.convertFile({
        jobId: job.id,
        sourceFilePath: job.sourceFilePath,
        targetFormat: job.targetFormat,
        options: {
          preserveMetadata: true,
          imageOptimization: true,
          compression: 'medium'
        }
      });

      if (isSuccess(result)) {
        // Update chapter with new file
        await this.updateChapterFile(job.chapterId, result.data.outputPath);

        // Mark job as completed
        await prisma.conversionJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            targetFilePath: result.data.outputPath,
            completedAt: new Date(),
            progress: 100
          }
        });

        // Send notification
        await this.notifySuccess(job);

        // Clean up original file
        await this.cleanupOriginal(job.sourceFilePath);
      } else if (isError(result)) {
        await this.handleError(job, result.error);
      }
    } catch (error) {
      await this.handleError(job, error as Error);
    }
  }

  private async handleError(job: ConversionJob, error: Error): Promise<void> {
    const shouldRetry = job.attempts < job.maxAttempts;

    await prisma.conversionJob.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? 'PENDING' : 'FAILED',
        errorMessage: error.message
      }
    });

    if (!shouldRetry) {
      // Notify failure
      await this.notifyFailure(job, error);
    } else {
      // Exponential backoff
      const delay = Math.pow(2, job.attempts) * 1000;
      await this.sleep(delay);
    }
  }
}
```

**Start Worker on App Init**:
```typescript
// src/server/index.ts or app startup
const conversionWorker = new ConversionWorker();
conversionWorker.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await conversionWorker.stop();
  process.exit(0);
});
```

---

## UI Integration

### 1. Global Format Setting (Already Exists)

**Component**: `/src/components/settings/GlobalDownloadPreferences.tsx`

**Already Implemented**:
- ✅ Dropdown to select default format (CBZ/PDF/EPUB)
- ✅ Saves to `defaultDownloadFormat` config key
- ✅ Loads current setting from config

### 2. Conversion Status Display (NEW)

**Component**: `/src/components/downloads/ConversionStatus.tsx`

**Features**:
- Show active conversions
- Display progress bars
- Show queue position
- Allow cancellation
- Retry failed conversions

**Example**:
```tsx
export function ConversionStatus() {
  const { data: jobs } = trpc.conversion.getActiveJobs.useQuery();

  return (
    <Stack>
      {jobs?.map(job => (
        <Card key={job.id}>
          <Group justify="space-between">
            <div>
              <Text fw={500}>{job.manga.title}</Text>
              <Text size="sm" c="dimmed">
                {job.sourceFormat.toUpperCase()} → {job.targetFormat.toUpperCase()}
              </Text>
            </div>
            <Progress value={job.progress} w={200} />
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
```

### 3. Batch Conversion Tool (NEW)

**Component**: `/src/components/tools/BatchConverter.tsx`

**Features**:
- Select multiple chapters
- Choose target format
- Queue batch conversion
- Show progress for all

---

## Error Handling & Redundancy

### 1. Retry Logic

**Strategy**: Exponential backoff with max 3 attempts
```typescript
const retryDelays = [0, 2000, 5000, 10000]; // ms

for (let attempt = 0; attempt < maxAttempts; attempt++) {
  try {
    const result = await converter.convert(...);
    return result;
  } catch (error) {
    if (attempt === maxAttempts - 1) throw error;

    const delay = retryDelays[attempt];
    logger.warn(`Conversion failed, retrying in ${delay}ms...`);
    await sleep(delay);
  }
}
```

### 2. Fallback Converters

**Strategy**: Use alternative libraries if primary fails
```typescript
class PDFConverter {
  private primaryLib = 'jspdf';
  private fallbackLib = 'pdfkit';

  async convert(...): Promise<AsyncResult<ConversionResult, Error>> {
    try {
      return await this.convertWithJSPDF(...);
    } catch (error) {
      logger.warn('jsPDF failed, trying pdfkit', error);
      return await this.convertWithPDFKit(...);
    }
  }
}
```

### 3. Validation & Verification

**Pre-Conversion Checks**:
- File exists and is readable
- Format is supported
- Sufficient disk space
- Dependencies are installed

**Post-Conversion Checks**:
- Output file exists
- Output file is valid (can be opened/read)
- Page count matches source
- File size is reasonable

```typescript
async validate(outputFile: string): Promise<boolean> {
  try {
    // Check file exists
    await fs.access(outputFile);

    // Check file size > 0
    const stats = await fs.stat(outputFile);
    if (stats.size === 0) return false;

    // Try to open/parse file
    const format = this.detectFormat(outputFile);
    const canRead = await this.canReadFormat(outputFile, format);

    return canRead;
  } catch {
    return false;
  }
}
```

### 4. Cleanup & Recovery

**On Failure**:
- Keep original file
- Remove incomplete conversion
- Log detailed error
- Notify user

**On Success**:
- Move converted file to library
- Delete original (or archive it)
- Update database
- Clear temp files

```typescript
async cleanup(job: ConversionJob, success: boolean): Promise<void> {
  if (success) {
    // Archive original
    await this.archiveOriginal(job.sourceFilePath);

    // Clean temp files
    await this.cleanupTempDir(job.id);
  } else {
    // Keep original
    // Remove incomplete output
    if (job.targetFilePath) {
      await fs.unlink(job.targetFilePath).catch(() => {});
    }
  }
}
```

---

## Performance Considerations

### 1. Parallel Processing

**Strategy**: Process multiple conversions in parallel (max 3)
```typescript
class ConversionWorker {
  private maxConcurrent = 3;
  private activeJobs: Set<string> = new Set();

  async processPendingJobs(): Promise<void> {
    const available = this.maxConcurrent - this.activeJobs.size;
    if (available <= 0) return;

    const jobs = await this.getPendingJobs(available);

    // Process in parallel
    await Promise.all(
      jobs.map(job => this.processJob(job))
    );
  }
}
```

### 2. Resource Management

**Disk Space**:
- Check before conversion
- Clean up temp files aggressively
- Implement max temp size limit

**Memory**:
- Process images in batches
- Stream large files
- Release resources after use

```typescript
async extractImagesInBatches(
  sourceFile: string,
  batchSize = 10
): Promise<ImageFile[]> {
  const allImages: ImageFile[] = [];
  let offset = 0;

  while (true) {
    const batch = await this.extractImageBatch(sourceFile, offset, batchSize);
    if (batch.length === 0) break;

    allImages.push(...batch);
    offset += batch.length;

    // Allow GC to run
    await new Promise(resolve => setImmediate(resolve));
  }

  return allImages;
}
```

### 3. Caching

**Cache Metadata**:
- Store file metadata to avoid repeated parsing
- Cache image dimensions
- Cache page counts

```typescript
interface MetadataCache {
  [fileHash: string]: FileMetadata;
}

async getMetadata(filePath: string): Promise<FileMetadata> {
  const hash = await this.hashFile(filePath);

  if (this.cache.has(hash)) {
    return this.cache.get(hash)!;
  }

  const metadata = await this.extractMetadata(filePath);
  this.cache.set(hash, metadata);

  return metadata;
}
```

---

## Testing Strategy

### 1. Unit Tests

**Test Each Converter**:
```typescript
describe('CBZConverter', () => {
  it('should convert PDF to CBZ', async () => {
    const converter = new CBZConverter();
    const result = await converter.convert('test.pdf', 'output.cbz');

    expect(isSuccess(result)).toBe(true);
    expect(result.data.pageCount).toBeGreaterThan(0);
  });

  it('should preserve metadata', async () => {
    const converter = new CBZConverter();
    const result = await converter.convert('test.pdf', 'output.cbz', {
      preserveMetadata: true
    });

    // Check ComicInfo.xml exists in CBZ
    const zip = await JSZip.loadAsync(fs.readFileSync('output.cbz'));
    expect(zip.file('ComicInfo.xml')).toBeTruthy();
  });

  it('should handle corrupted files', async () => {
    const converter = new CBZConverter();
    const result = await converter.convert('corrupt.pdf', 'output.cbz');

    expect(isError(result)).toBe(true);
  });
});
```

### 2. Integration Tests

**Test Full Pipeline**:
```typescript
describe('Conversion Pipeline', () => {
  it('should convert downloaded file automatically', async () => {
    // 1. Set user preference to EPUB
    await configService.set('defaultDownloadFormat', 'epub');

    // 2. Simulate download completion (CBZ file)
    const download = await createTestDownload('test-manga.cbz');

    // 3. Trigger import
    await fileImporter.importDownload(download);

    // 4. Wait for conversion
    await waitForConversion(download.chapterId);

    // 5. Check result
    const chapter = await prisma.chapter.findUnique({
      where: { id: download.chapterId }
    });

    expect(chapter.fileFormat).toBe('EPUB');
    expect(chapter.filePath).toContain('.epub');
  });
});
```

### 3. Manual Testing Checklist

- [ ] Convert CBZ → PDF
- [ ] Convert CBZ → EPUB
- [ ] Convert PDF → CBZ
- [ ] Convert EPUB → CBZ
- [ ] Batch conversion of 10 chapters
- [ ] Failed conversion retry logic
- [ ] Cancellation during conversion
- [ ] Disk space exhaustion handling
- [ ] Corrupted file handling
- [ ] Progress tracking accuracy

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database schema (ConversionJob model)
- [ ] Implement BaseConverter abstract class
- [ ] Implement ConverterFactory
- [ ] Create FormatConversionService (basic)
- [ ] Add unit tests

### Phase 2: Core Converters (Week 2)
- [ ] Implement CBZConverter (PDF → CBZ, EPUB → CBZ)
- [ ] Implement PDFConverter (CBZ → PDF)
- [ ] Implement EPUBConverter (CBZ → EPUB)
- [ ] Add metadata preservation
- [ ] Add validation logic

### Phase 3: Integration (Week 3)
- [ ] Integrate with FileImporter
- [ ] Create ConversionWorker
- [ ] Implement queue processing
- [ ] Add retry logic
- [ ] Add error handling

### Phase 4: UI & Monitoring (Week 4)
- [ ] Create ConversionStatus component
- [ ] Add progress tracking
- [ ] Create BatchConverter tool
- [ ] Add notifications
- [ ] Implement cancellation

### Phase 5: Optimization & Testing (Week 5)
- [ ] Add image optimization (sharp)
- [ ] Implement caching
- [ ] Add parallel processing
- [ ] Write integration tests
- [ ] Performance testing
- [ ] Documentation

---

## Dependencies Summary

**Required New Dependencies**:
```json
{
  "dependencies": {
    "jspdf": "^2.5.1",         // PDF generation
    "pdf-lib": "^1.17.1",      // PDF manipulation
    "epub-gen": "^0.1.2",      // EPUB generation
    "sharp": "^0.33.0"         // Image optimization (optional)
  }
}
```

**Existing Dependencies (Already Installed)**:
- `jszip` (CBZ creation) ✅
- `adm-zip` (ZIP extraction) ✅
- `archiver` (Archive creation) ✅

---

## Configuration

**Global Config Keys** (via configService):
```typescript
{
  // Format preference (already implemented)
  "defaultDownloadFormat": "cbz" | "pdf" | "epub",

  // NEW: Conversion settings
  "conversion.enabled": true,
  "conversion.autoConvert": true,
  "conversion.maxConcurrent": 3,
  "conversion.maxRetries": 3,
  "conversion.imageOptimization": true,
  "conversion.compression": "medium",
  "conversion.preserveMetadata": true,
  "conversion.cleanupOriginals": false, // Keep originals
  "conversion.quality": 90 // 1-100
}
```

---

## Success Criteria

**System is considered complete when**:
1. ✅ Can convert between CBZ ↔ PDF ↔ EPUB
2. ✅ Automatic conversion after download
3. ✅ Retry logic with 3 attempts
4. ✅ Progress tracking UI
5. ✅ Error notifications
6. ✅ Batch conversion support
7. ✅ Metadata preservation
8. ✅ Resource cleanup
9. ✅ All tests passing
10. ✅ Documentation complete

---

## Future Enhancements

**Post-MVP Features**:
- WebP/AVIF image format support
- AI-powered image upscaling
- OCR for PDF text extraction
- Custom conversion profiles
- Scheduled batch conversions
- Format auto-detection improvements
- Cloud storage integration
- Conversion statistics/analytics

---

## Security Considerations

**File Validation**:
- Validate file types before processing
- Check file sizes against limits
- Sanitize filenames
- Prevent path traversal attacks

**Resource Limits**:
- Max file size: 500 MB per file
- Max concurrent conversions: 3
- Max temp disk usage: 5 GB
- Timeout per conversion: 10 minutes

**Error Messages**:
- Don't expose file paths in errors
- Log sensitive info server-side only
- Sanitize user input

---

## Monitoring & Logging

**Metrics to Track**:
- Conversion success/failure rates
- Average conversion time by format
- Queue depth
- Disk space usage
- Error rates by type

**Logging**:
```typescript
logger.info('Conversion started', {
  jobId: job.id,
  sourceFormat: job.sourceFormat,
  targetFormat: job.targetFormat,
  fileSize: stats.size
});

logger.info('Conversion completed', {
  jobId: job.id,
  duration: result.duration,
  originalSize: result.originalSize,
  convertedSize: result.convertedSize,
  compressionRatio: result.convertedSize / result.originalSize
});

logger.error('Conversion failed', {
  jobId: job.id,
  attempt: job.attempts,
  error: error.message
});
```

---

## Documentation Updates Required

**Files to Update**:
1. `/docs/features/FILE_CONVERTER_SYSTEM.md` (new user guide)
2. `/docs/api/CONVERSION_API.md` (new API reference)
3. `/docs/development/DEVELOPMENT_RULES.md` (conversion patterns)
4. `/CLAUDE.md` (add converter architecture)

---

*This plan provides a complete blueprint for implementing a robust file conversion system with redundancy, error handling, and seamless integration with existing download workflows.*
