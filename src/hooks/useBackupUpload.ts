import React, { useState, useEffect, useRef, useCallback } from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { MAX_BACKUP_SIZE_MB, MAX_BACKUP_SIZE_BYTES, BACKUP_FILE_EXTENSIONS } from '@/constants/backup';
import { logger } from '@/utils/logger';

interface UploadResult {
  success: boolean;
  filename?: string;
  path?: string;
  size?: number;
  error?: string;
  message?: string;
}
interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}
export function useBackupUpload(): {
  uploadBackupFile: (file: File) => Promise<UploadResult | null>;
  isUploading: boolean;
  uploadProgress: UploadProgress;
} {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0
  });

  // Add ref to track XHR for cleanup
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
    };
  }, []);

  const uploadBackupFile = useCallback(async (file: File): Promise<UploadResult | null> => {
    setIsUploading(true);
    setUploadProgress({
      loaded: 0,
      total: file.size,
      percentage: 0
    });

    try {
      // File size validation
      if (file.size > MAX_BACKUP_SIZE_BYTES) {
        const error = `File too large. Maximum size is ${MAX_BACKUP_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`;
        logger.warn('Backup upload rejected: file too large', {
          fileSize: file.size,
          maxSize: MAX_BACKUP_SIZE_BYTES
        });
        showNotification({
          title: 'Upload Error',
          message: error,
          color: 'red',
          icon: React.createElement(IconAlertCircle, { size: 18 })
        });
        return { success: false, error };
      }

      // File type validation
      const fileName = file.name.toLowerCase();
      const hasValidExtension = BACKUP_FILE_EXTENSIONS.some(ext => fileName.endsWith(ext));

      if (!hasValidExtension) {
        const error = `Invalid file type. Allowed: ${BACKUP_FILE_EXTENSIONS.join(', ')}`;
        logger.warn('Backup upload rejected: invalid file type', { fileName });
        showNotification({
          title: 'Upload Error',
          message: error,
          color: 'red',
          icon: React.createElement(IconAlertCircle, { size: 18 })
        });
        return { success: false, error };
      }

      const formData = new FormData();
      formData.append('file', file);
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr; // Store reference

      // Set up progress tracking
      xhr.upload.onprogress = (event: unknown) => {
        if (event instanceof ProgressEvent && event.lengthComputable) {
          const percentage = Math.min(100, Math.round((event.loaded / event.total) * 100));
          setUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
        }
      };

      // Create a promise to handle the XHR request
      const response = await new Promise<UploadResult>((resolve, reject) => {
        xhr.onload = () => {
          xhrRef.current = null; // Clear reference
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText) as UploadResult;
              resolve(result);
            } catch (_error: unknown) {
              reject(new Error('Invalid server response'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText) as { error?: string };
              reject(new Error(errorResponse.error ?? 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => {
          xhrRef.current = null; // Clear reference
          reject(new Error('Network error during upload'));
        };
        xhr.onabort = () => {
          xhrRef.current = null; // Clear reference
          reject(new Error('Upload cancelled'));
        };

        // Send the request
        xhr.open('POST', '/api/backup/upload');
        xhr.send(formData);
      });
      showNotification({
        title: 'Upload Complete',
        message: `File ${file.name} uploaded successfully`,
        color: 'green',
        icon: React.createElement(IconCheck, {
          size: 18
        })
      });
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      showNotification({
        title: 'Upload Failed',
        message: errorMessage,
        color: 'red',
        icon: React.createElement(IconAlertCircle, {
          size: 18
        })
      });
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsUploading(false);
      setUploadProgress({
        loaded: 0,
        total: 0,
        percentage: 0
      });
    }
  }, []);
  return {
    uploadBackupFile,
    isUploading,
    uploadProgress
  };
}