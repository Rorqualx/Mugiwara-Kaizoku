/**
 * Kindle Input Converter
 *
 * Handles conversion FROM MOBI and AZW3 (Kindle) formats to CBZ and EPUB.
 * Extracts images from Kindle files for conversion to comic book formats.
 *
 * Supported conversions:
 * - MOBI → CBZ
 * - MOBI → EPUB
 * - AZW3 → CBZ
 * - AZW3 → EPUB
 *
 * Note: Only DRM-free files can be processed.
 *
 * @module KindleConverter
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseConverter } from '../BaseConverter';
import { createCBZArchive } from '../utils/cbz-builder';
import { extractImagesFromKindle, getKindleMetadata, detectKindleFormat } from '../utils/kindle-extractor';

import type { ConversionOptions, ConversionResult, ConversionFormat } from '../BaseConverter';

/**
 * Kindle Input Converter Implementation
 *
 * Converts MOBI and AZW3 files to CBZ or EPUB format by extracting embedded images.
 * Uses @lingo-reader/mobi-parser for parsing Kindle formats.
 *
 * @extends BaseConverter
 */
export class KindleConverter extends BaseConverter {
  constructor() {
    super('KindleConverter');
  }

  /**
   * Get supported source formats
   *
   * @returns Array of source formats (mobi, azw3)
   */
  getSupportedSourceFormats(): ConversionFormat[] {
    return ['mobi', 'azw3'];
  }

  /**
   * Get supported target formats
   *
   * @returns Array of target formats (cbz, epub)
   */
  getSupportedTargetFormats(): ConversionFormat[] {
    return ['cbz', 'epub'];
  }

  /**
   * Perform the conversion from Kindle format
   *
   * @param options - Conversion options
   * @returns AsyncResult with conversion result
   */
  // eslint-disable-next-line complexity -- Format conversion with multiple output formats (CBZ, EPUB) and error handling paths
  protected async doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    const startTime = Date.now();

    try {
      const format = detectKindleFormat(options.sourceFile);
      const formatName = format === 'mobi' ? 'MOBI' : 'AZW3';

      logger.info(`[${this.converterName}] Starting ${formatName} to ${options.targetFormat} conversion`, {
        sourceFile: options.sourceFile,
        targetFile: options.targetFile
      });

      this.reportProgress(options, 0);

      // Step 1: Extract images from Kindle file (10-60% progress)
      logger.debug(`[${this.converterName}] Extracting images from ${formatName}`);

      const extractResult = await extractImagesFromKindle(options.sourceFile);

      if (extractResult.status === 'error') {
        return createErrorResult(extractResult.error);
      }

      if (extractResult.status !== 'success') {
        return createErrorResult(new Error('Unexpected extraction status'));
      }

      const images = extractResult.data.files;
      const kindleMetadata = extractResult.data.metadata;

      logger.info(`[${this.converterName}] Extracted ${images.length} images from ${formatName}`);
      this.reportProgress(options, 60);

      if (images.length === 0) {
        return createErrorResult(new Error(`No images found in ${formatName} file. The file may be text-only or DRM-protected.`));
      }

      // Get metadata if not already available
      let metadata = kindleMetadata;
      if (!metadata?.title) {
        const detectedFormat = detectKindleFormat(options.sourceFile);
        if (detectedFormat) {
          const metadataResult = await getKindleMetadata(options.sourceFile, detectedFormat);
          if (metadataResult.status === 'success') {
            metadata = metadataResult.data;
          }
        }
      }

      // Step 2: Create output format (60-90% progress)
      let createResult: AsyncResult<void, Error>;

      if (options.targetFormat === 'cbz') {
        createResult = await createCBZArchive(
          images,
          options.targetFile,
          options.compression ?? 6,
          (progress) => {
            const mappedProgress = 60 + (progress * 0.3);
            this.reportProgress(options, mappedProgress);
          }
        );
      } else if (options.targetFormat === 'epub') {
        createResult = await this.createEPUB(
          images,
          options.targetFile,
          {
            title: (metadata?.title as string | undefined) ?? (options.metadata?.['title'] as string | undefined) ?? 'Converted Kindle Book',
            author: (metadata?.author as string | undefined) ?? (options.metadata?.['author'] as string | undefined) ?? 'Unknown'
          },
          (progress) => {
            const mappedProgress = 60 + (progress * 0.3);
            this.reportProgress(options, mappedProgress);
          }
        );
      } else {
        return createErrorResult(new Error(`Unsupported target format: ${options.targetFormat}`));
      }

      if (createResult.status === 'error') {
        return createErrorResult(createResult.error);
      }

      this.reportProgress(options, 90);

      // Step 3: Get output file stats
      const stats = await fs.stat(options.targetFile);
      const duration = Date.now() - startTime;

      this.reportProgress(options, 100);

      const result: ConversionResult = {
        outputPath: options.targetFile,
        fileSize: stats.size,
        pageCount: images.length,
        duration,
        metadata: {
          sourceFormat: format ?? 'mobi',
          targetFormat: options.targetFormat,
          pageCount: images.length,
          title: metadata?.title,
          author: metadata?.author
        }
      };

      logger.info(`[${this.converterName}] Conversion completed`, {
        outputPath: result.outputPath,
        fileSize: result.fileSize,
        pageCount: result.pageCount,
        duration: `${duration}ms`
      });

      return createSuccessResult(result);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Conversion error`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

    /**
   * Create an EPUB document from images
   */
  private async createEPUB(
    images: Array<{ name: string; data: Buffer }>,
    outputPath: string,
    metadata: { title: string; author: string },
    onProgress?: (progress: number) => void
  ): Promise<AsyncResult<void, Error>> {
    try {
      const zip = new JSZip();
      const uuid = uuidv4();
      const { title, author } = metadata;

      // EPUB structure
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
      zip.file('META-INF/container.xml', this.generateContainerXML());
      zip.file('OEBPS/content.opf', this.generateContentOPF(images, title, author, uuid));
      zip.file('OEBPS/toc.ncx', this.generateTocNCX(images, title, author, uuid));
      zip.file('OEBPS/nav.xhtml', this.generateNavXHTML(images, title));

      // Add images and pages
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (!image) continue;

        const ext = path.extname(image.name).toLowerCase();
        const imageFileName = `image_${String(i + 1).padStart(4, '0')}${ext}`;
        const pageFileName = `page_${String(i + 1).padStart(4, '0')}.xhtml`;

        zip.file(`OEBPS/images/${imageFileName}`, image.data);
        zip.file(`OEBPS/pages/${pageFileName}`, this.generateImagePage(imageFileName, i + 1));

        if (onProgress) {
          onProgress(((i + 1) / images.length) * 100);
        }

        logger.debug(`[${this.converterName}] Added EPUB page ${i + 1}`);
      }

      const epubData = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      await fs.writeFile(outputPath, epubData);
      logger.info(`[${this.converterName}] EPUB file created: ${outputPath}`);

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to create EPUB`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // EPUB generation helper methods

  private generateContainerXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  private generateContentOPF(
    images: Array<{ name: string; data: Buffer }>,
    title: string,
    author: string,
    uuid: string
  ): string {
    const now = new Date().toISOString().split('T')[0];

    const manifestItems = images.map((image, i) => {
      const ext = path.extname(image.name).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      const pageNum = String(i + 1).padStart(4, '0');

      return `    <item id="image_${pageNum}" href="images/image_${pageNum}${ext}" media-type="${mimeType}"/>
    <item id="page_${pageNum}" href="pages/page_${pageNum}.xhtml" media-type="application/xhtml+xml"/>`;
    }).join('\n');

    const spineItems = images.map((_, i) => {
      const pageNum = String(i + 1).padStart(4, '0');
      return `    <itemref idref="page_${pageNum}"/>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uuid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uuid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${this.escapeXML(title)}</dc:title>
    <dc:creator>${this.escapeXML(author)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>${now}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
  }

  private generateTocNCX(
    images: Array<{ name: string; data: Buffer }>,
    title: string,
    author: string,
    uuid: string
  ): string {
    const navPoints = images.map((_, i) => {
      const pageNum = String(i + 1).padStart(4, '0');
      return `    <navPoint id="page_${pageNum}" playOrder="${i + 1}">
      <navLabel><text>Page ${i + 1}</text></navLabel>
      <content src="pages/page_${pageNum}.xhtml"/>
    </navPoint>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${this.escapeXML(title)}</text></docTitle>
  <docAuthor><text>${this.escapeXML(author)}</text></docAuthor>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
  }

  private generateNavXHTML(images: Array<{ name: string; data: Buffer }>, title: string): string {
    const navItems = images.map((_, i) => {
      const pageNum = String(i + 1).padStart(4, '0');
      return `      <li><a href="pages/page_${pageNum}.xhtml">Page ${i + 1}</a></li>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this.escapeXML(title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;
  }

  private generateImagePage(imageFileName: string, pageNumber: number): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Page ${pageNumber}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  <img src="../images/${imageFileName}" alt="Page ${pageNumber}"/>
</body>
</html>`;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
