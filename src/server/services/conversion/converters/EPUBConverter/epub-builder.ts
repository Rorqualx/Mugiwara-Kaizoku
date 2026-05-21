/**
 * EPUB document builder
 *
 * Free functions that assemble an EPUB3 document from a sorted image list.
 * Extracted from EPUBConverter.ts so the converter class stays under the
 * project file-size cap.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const LOG_TAG = '[EPUBConverter]';

export interface ImageEntry {
  name: string;
  data: Buffer;
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateContainerXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function generateContentOPF(
  images: ImageEntry[],
  title: string,
  author: string,
  uuid: string
): string {
  const now = new Date().toISOString().split('T')[0];

  const manifestItems = images.map((_, i) => {
    const ext = path.extname(images[i]?.name ?? '').toLowerCase();
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
    <dc:title>${escapeXML(title)}</dc:title>
    <dc:creator>${escapeXML(author)}</dc:creator>
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

function generateTocNCX(
  images: ImageEntry[],
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
  <docTitle><text>${escapeXML(title)}</text></docTitle>
  <docAuthor><text>${escapeXML(author)}</text></docAuthor>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

function generateNavXHTML(images: ImageEntry[], title: string): string {
  const navItems = images.map((_, i) => {
    const pageNum = String(i + 1).padStart(4, '0');
    return `      <li><a href="pages/page_${pageNum}.xhtml">Page ${i + 1}</a></li>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXML(title)}</title>
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

function generateImagePage(imageFileName: string, pageNumber: number): string {
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

function addPageEntries(
  zip: JSZip,
  images: ImageEntry[],
  onProgress?: (progress: number) => void
): void {
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image) continue;

    const ext = path.extname(image.name).toLowerCase();
    const imageFileName = `image_${String(i + 1).padStart(4, '0')}${ext}`;
    const pageFileName = `page_${String(i + 1).padStart(4, '0')}.xhtml`;

    zip.file(`OEBPS/images/${imageFileName}`, image.data);
    zip.file(`OEBPS/pages/${pageFileName}`, generateImagePage(imageFileName, i + 1));

    if (onProgress) {
      onProgress(((i + 1) / images.length) * 100);
    }

    logger.debug(`${LOG_TAG} Added page ${i + 1}: ${image.name}`);
  }
}

export async function createEPUB(
  images: ImageEntry[],
  outputPath: string,
  metadata: Record<string, unknown>,
  compressionLevel: number,
  onProgress?: (progress: number) => void
): Promise<AsyncResult<void, Error>> {
  try {
    const zip = new JSZip();
    const uuid = uuidv4();
    const title = (metadata['title'] as string) || 'Manga';
    const author = (metadata['author'] as string) || 'Unknown';

    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', generateContainerXML());
    zip.file('OEBPS/content.opf', generateContentOPF(images, title, author, uuid));
    zip.file('OEBPS/toc.ncx', generateTocNCX(images, title, author, uuid));
    zip.file('OEBPS/nav.xhtml', generateNavXHTML(images, title));

    addPageEntries(zip, images, onProgress);

    logger.debug(`${LOG_TAG} Generating EPUB file`);
    const epubData = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel }
    });

    await fs.writeFile(outputPath, epubData);

    logger.info(`${LOG_TAG} EPUB file created: ${outputPath}`);

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error(`${LOG_TAG} Failed to create EPUB`, error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
