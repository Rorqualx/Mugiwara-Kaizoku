/**
 * Backup Upload Endpoint
 * 
 * Handles backup file uploads for restoration.
 * Accepts zip and gzip backup files with size limits.
 * 
 * @module pages/api/backup/upload
 */

import fs from 'fs/promises';
import path from 'path';

import formidable from 'formidable';

import { getBackupConfigSingleton } from '@/server/services/backup/config';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/server/utils/logger';
import { createApiRoute } from '@/utils/api-route-factory';

export const config = {
  api: {
    bodyParser: false, // Disable body parser for file uploads
  },
};

export default createApiRoute({
  requireAuth: true,
  permissions: {
    POST: { resource: 'backup', action: 'write' },
  },
  handlers: {
    POST: async (req, res): Promise<void> => {
      // Check admin role
      const authUser = req.auth && typeof req.auth === 'object' && 'role' in req.auth ? req.auth as { role: string } : null;
      if (authUser?.role !== 'ADMIN') {
        return res["status"](403).json({ error: 'Admin access required' });
      }

      try {
        const backupConfig = getBackupConfigSingleton();
        const uploadDir = backupConfig.BACKUP_UPLOAD_DIR;
        
        // Ensure upload directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        // Parse the form
        const form = formidable({
          uploadDir,
          keepExtensions: true,
          maxFileSize: backupConfig.BACKUP_MAX_SIZE_MB * 1024 * 1024,
          filter: function ({ mimetype }) {
            // Only allow zip and backup files
            return mimetype === 'application/zip' || 
                   mimetype === 'application/x-gzip' || 
                   mimetype === 'application/octet-stream';
          }
        });

        const [_fields, files] = await form.parse(req);
        
        const uploadedFile = Array.isArray(files["backup"]) ? files["backup"][0] : files["backup"];
        
        if (!uploadedFile) {
          return res["status"](400).json({ error: 'No file uploaded' });
        }

        // Generate a unique filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const originalName = uploadedFile.originalFilename ?? 'backup.zip';

        // Validate file extension (security: prevent upload of arbitrary file types)
        const validExtensions = ['.tar.gz', '.gz', '.zip', '.dump', '.kbak'];
        const lowerName = originalName.toLowerCase();
        const hasValidExtension = validExtensions.some((ext) => lowerName.endsWith(ext));
        if (!hasValidExtension) {
          // Clean up the uploaded temp file
          try {
            await fs.unlink(uploadedFile.filepath);
          } catch {
            // Ignore cleanup errors
          }
          return res["status"](400).json({
            error: `Invalid file type. Allowed extensions: ${validExtensions.join(', ')}`
          });
        }

        const fileExt = path.extname(originalName);
        const fileName = `restore-${timestamp}${fileExt}`;
        const finalPath = path.join(uploadDir, fileName);

        // Move the file to the final location
        if (uploadedFile.filepath !== finalPath) {
          await fs.rename(uploadedFile.filepath, finalPath);
        }

        logger.info(`Backup file uploaded: ${fileName}`);

        // Emit WebSocket event for real-time UI sync
        void realtimeEmitter.emitSystemEvent({
          eventType: 'backup:uploaded',
          source: 'backup-upload-api',
          message: `Backup file uploaded: ${fileName}`,
          data: { filename: fileName, size: uploadedFile.size }
        });

        return res["status"](200).json({
          success: true,
          filename: fileName,
          path: finalPath,
          size: uploadedFile.size,
        });
      } catch (error: unknown) {
        logger.error('Backup upload error:', error);

        // Operator-precedence fix: previously written as
        //   error instanceof Error ? error.message : String(error) === 'LIMIT_FILE_SIZE'
        // which JS parsed as
        //   error instanceof Error ? error.message : (String(error) === 'LIMIT_FILE_SIZE')
        // so any Error with a non-empty message returned 413, not just size-limit ones.
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'LIMIT_FILE_SIZE') {
          return res["status"](413).json({
            error: `File too large. Maximum size is ${getBackupConfigSingleton().BACKUP_MAX_SIZE_MB}MB`
          });
        }

        return res["status"](500).json({
          error: 'Failed to upload backup file',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },
});