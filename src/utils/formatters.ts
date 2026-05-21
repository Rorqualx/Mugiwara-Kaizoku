/**
 * Formats a number of bytes into a human-readable string
 * @param bytes The number of bytes to format
 * @param decimals The number of decimal places to include
 * @returns A formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a duration in seconds into a human-readable string
 * @param seconds The number of seconds
 * @returns A formatted string (e.g., "2 hours 30 minutes")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)} seconds`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    if (remainingMinutes === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (remainingHours === 0) return `${days} day${days !== 1 ? 's' : ''}`;
  return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
}

/**
 * Formats a date to a localized string
 * @param date The date to format
 * @returns A formatted date string
 */
export function formatDate(date: Date | string | number): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  return dateObj.toLocaleString();
}

/**
 * Formats a date as relative time (e.g., "2 hours ago", "in 3 days")
 * @param date The date to format
 * @returns A relative time string
 */
export function formatRelativeTime(date: Date | string | number): string {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (Math.abs(diffSec) < 60) {
    return 'just now';
  } else if (Math.abs(diffMin) < 60) {
    const mins = Math.abs(diffMin);
    return diffMin < 0 ? `${mins} minute${mins === 1 ? '' : 's'} ago` : `in ${mins} minute${mins === 1 ? '' : 's'}`;
  } else if (Math.abs(diffHour) < 24) {
    const hours = Math.abs(diffHour);
    return diffHour < 0 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `in ${hours} hour${hours === 1 ? '' : 's'}`;
  } else if (Math.abs(diffDay) < 30) {
    const days = Math.abs(diffDay);
    return diffDay < 0 ? `${days} day${days === 1 ? '' : 's'} ago` : `in ${days} day${days === 1 ? '' : 's'}`;
  } else {
    return formatDate(dateObj);
  }
}

/**
 * Alias for formatBytes for file size formatting
 * @param bytes The file size in bytes
 * @param decimals The number of decimal places
 * @returns A formatted file size string
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  return formatBytes(bytes, decimals);
}

/**
 * Formats an array of chapter numbers into a readable range string
 * @param chapters Array of chapter numbers
 * @returns A formatted range string (e.g., "1-10, 15, 20-25")
 */
export function formatChapterRange(chapters: number[] | null | undefined): string {
  if (!chapters || chapters.length === 0) return 'None';
  
  // Sort chapters
  const sorted = [...chapters].sort((a, b) => a - b);
  const ranges: string[] = [];
  
  const firstChapter = sorted[0];

  if (firstChapter === undefined) {
    return '';
  }

  let start = firstChapter;
  let end = firstChapter;

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (i === sorted.length || (current !== undefined && current !== end + 1)) {
      // End of a range
      if (start === end) {
        ranges.push(start.toString());
      } else if (end === start + 1) {
        ranges.push(`${start}, ${end}`);
      } else {
        ranges.push(`${start}-${end}`);
      }

      if (i < sorted.length && current !== undefined) {
        start = current;
        end = current;
      }
    } else if (current !== undefined) {
      end = current;
    }
  }
  
  return ranges.join(', ');
}

/**
 * Gets chapter ranges from a list of chapter IDs and chapter entities
 * @param chapterIds Array of selected chapter IDs
 * @param chapters Array of all chapter entities
 * @returns Array of formatted range strings
 */
export function getChapterRanges(chapterIds: number[], chapters: Array<{ id: number; index: number }>): string[] {
  // Map IDs to indices
  const indices = chapterIds
    .map(id => {
      const chapter = chapters.find(ch => ch["id"] === id);
      return chapter?.index;
    })
    .filter((index): index is number => index !== undefined);
  
  if (indices.length === 0) return [];
  
  // Sort indices
  const sorted = [...indices].sort((a, b) => a - b);
  const ranges: string[] = [];
  
  let start = sorted[0];
  let end = sorted[0];

  if (start === undefined || end === undefined) {
    return [];
  }

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (i === sorted.length || (current !== undefined && current !== end + 1)) {
      // End of a range
      if (start === end) {
        ranges.push(`Chapter ${start}`);
      } else {
        ranges.push(`Chapters ${start}-${end}`);
      }


      if (i < sorted.length && current !== undefined) {
        start = current;
        end = current;
      }
    } else if (current !== undefined) {
      end = current;
    }
  }
  
  return ranges;
}
