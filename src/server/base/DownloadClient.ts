/**
 * Base Download Client
 * 
 * This abstract class extends ApiClient to provide specialized functionality
 * for download clients like Transmission, Deluge, etc. It standardizes common
 * operations and status mapping across different clients.
 * 
 * Features:
 * - Standardized download operations (add, status, pause, resume, remove)
 * - Common status mapping
 * - Consistent error handling
 */

import { JobStatus } from '@/utils/job-validation';

import { ApiClient} from './ApiClient';

import type { ApiClientConfig as _ApiClientConfig} from './ApiClient';

/**
 * Download item interface
 */
export interface DownloadItem {
  id: string;
  name: string;
  status: JobStatus;
  progress: number; // 0-100
  downloadSpeed?: number; // bytes per second
  uploadSpeed?: number; // bytes per second
  eta?: number; // seconds
  size?: number; // bytes
  downloaded?: number; // bytes
  uploaded?: number; // bytes
  ratio?: number;
  dateAdded?: Date;
  dateCompleted?: Date;
  error?: string;
  savePath?: string; // Path where files are saved
  files?: Array<{ name: string; size: number; progress: number }>; // File details
  clientSpecific?: Record<string, unknown>; // Client-specific data
}

/**
 * Add download options
 */
export interface AddDownloadOptions {
  url: string;
  destination?: string;
  category?: string;
  paused?: boolean;
  priority?: number;
  clientSpecific?: Record<string, unknown>; // Client-specific options
}

/**
 * Get status options
 */
export interface GetStatusOptions {
  includeFiles?: boolean;
  includePeers?: boolean;
  includeTrackers?: boolean;
  clientSpecific?: Record<string, unknown>; // Client-specific options
}

/**
 * Abstract base class for download clients
 */
export abstract class DownloadClient extends ApiClient {

  /**
   * Adds a download from a URL
   *
   * @param options - Download options
   * @returns Promise that resolves to the download ID
   */
  public abstract addUrl(options: AddDownloadOptions): Promise<string>;
  
  /**
   * Gets the status of a download
   * 
   * @param id - Download ID
   * @param options - Status options
   * @returns Promise that resolves to the download status
   */
  public abstract getStatus(id: string, options?: GetStatusOptions): Promise<DownloadItem>;
  
  /**
   * Gets all downloads
   * 
   * @param options - Status options
   * @returns Promise that resolves to a list of download items
   */
  public abstract getAllItems(options?: GetStatusOptions): Promise<DownloadItem[]>;
  
  /**
   * Pauses a download
   * 
   * @param id - Download ID
   * @returns Promise that resolves to true if successful
   */
  public abstract pauseItem(id: string): Promise<boolean>;
  
  /**
   * Resumes a download
   * 
   * @param id - Download ID
   * @returns Promise that resolves to true if successful
   */
  public abstract resumeItem(id: string): Promise<boolean>;
  
  /**
   * Removes a download
   * 
   * @param id - Download ID
   * @param deleteFiles - Whether to delete downloaded files
   * @returns Promise that resolves to true if successful
   */
  public abstract removeItem(id: string, deleteFiles?: boolean): Promise<boolean>;
  
  /**
   * Gets the client type
   * 
   * @returns Client type (e.g., 'transmission', 'deluge')
   */
  public abstract getClientType(): string;
  
  /**
   * Gets the download speed for all downloads
   * 
   * @returns Promise that resolves to the download speed in bytes per second
   */
  public async getDownloadSpeed(): Promise<number> {
    try {
      const items = await this.getAllItems();
      return items.reduce((total, item) => total + (item.downloadSpeed ?? 0), 0);
    } catch (error: unknown) {
      console.error(`Error getting download speed: ${error}`);
      return 0;
    }
  }
  
  /**
   * Gets the upload speed for all downloads
   * 
   * @returns Promise that resolves to the upload speed in bytes per second
   */
  public async getUploadSpeed(): Promise<number> {
    try {
      const items = await this.getAllItems();
      return items.reduce((total, item) => total + (item.uploadSpeed ?? 0), 0);
    } catch (error: unknown) {
      console.error(`Error getting upload speed: ${error}`);
      return 0;
    }
  }
  
  /**
   * Pauses all downloads
   * 
   * @returns Promise that resolves to true if successful
   */
  public async pauseAll(): Promise<boolean> {
    try {
      const items = await this.getAllItems();
      const activeItems = items.filter(item => 
        item["status"] === JobStatus.active || 
        item["status"] === JobStatus.pending
      );
      
      const results = await Promise.all(
        activeItems.map(item => this.pauseItem(item["id"]))
      );
      
      return results.every(result => result);
    } catch (error: unknown) {
      console.error(`Error pausing all downloads: ${error}`);
      return false;
    }
  }
  
  /**
   * Resumes all downloads
   * 
   * @returns Promise that resolves to true if successful
   */
  public async resumeAll(): Promise<boolean> {
    try {
      const items = await this.getAllItems();
      // Note: JobStatus doesn't have PAUSED, using CANCELLED for paused items
      const pausedItems = items.filter(item => item["status"] === JobStatus.cancelled);
      
      const results = await Promise.all(
        pausedItems.map(item => this.resumeItem(item["id"]))
      );
      
      return results.every(result => result);
    } catch (error: unknown) {
      console.error(`Error resuming all downloads: ${error}`);
      return false;
    }
  }
  
  /**
   * Gets stats about downloads
   * 
   * @returns Promise that resolves to download stats
   */
  public async getStats(): Promise<{
    total: number;
    active: number;
    paused: number;
    completed: number;
    errored: number;
    downloadSpeed: number;
    uploadSpeed: number;
  }> {
    try {
      const items = await this.getAllItems();
      
      const stats = {
        total: items.length,
        active: items.filter(item => 
          item["status"] === JobStatus.active || 
          item["status"] === JobStatus.pending
        ).length,
        paused: items.filter(item => item["status"] === JobStatus.cancelled).length,
        completed: items.filter(item => item["status"] === JobStatus.completed).length,
        errored: items.filter(item => item["status"] === JobStatus.failed).length,
        downloadSpeed: items.reduce((total, item) => total + (item.downloadSpeed ?? 0), 0),
        uploadSpeed: items.reduce((total, item) => total + (item.uploadSpeed ?? 0), 0)
      };
      
      return stats;
    } catch (error: unknown) {
      console.error(`Error getting download stats: ${error}`);
      
      return {
        total: 0,
        active: 0,
        paused: 0,
        completed: 0,
        errored: 0,
        downloadSpeed: 0,
        uploadSpeed: 0
      };
    }
  }
  
  /**
   * Converts a client-specific status to a standard TaskStatus
   * 
   * @param clientStatus - Client-specific status
   * @returns Standardized download status
   */
  protected abstract mapStatus(clientStatus: unknown): JobStatus;
  
  /**
   * Gets the service name for error reporting
   * 
   * @returns Service name based on client type
   */
  protected getServiceName(): string {
    return this.getClientType();
  }
  
  /**
   * Updates the connection status with client version
   * 
   * @param connected - Whether the connection is successful
   * @param options - Additional status options
   */
  protected override updateConnectionStatus(connected: boolean, options?: {
    version?: string;
    error?: string;
  }): void {
    super.updateConnectionStatus(connected, {
      ...options,
      version: options?.version || `${this.getClientType()} Client`
    });
  }
}