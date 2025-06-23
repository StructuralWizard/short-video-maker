import fs from "fs-extra";
import path from "path";
import { Config } from "../config";
import { logger } from "../logger";

export type VideoStatus = "pending" | "processing" | "ready" | "failed";

export interface VideoStatusObject {
  status: VideoStatus;
  error?: string;
  progress?: number;
  stage?: string;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
}

export class VideoStatusManager {
  private statusDir: string;
  private writeLocks: Set<string> = new Set(); // Track files being written

  constructor(config: Config) {
    this.statusDir = path.join(config.dataDirPath, "status");
    fs.ensureDirSync(this.statusDir);
  }

  private getStatusFilePath(videoId: string): string {
    return path.join(this.statusDir, `${videoId}.json`);
  }

  private async waitForWriteLock(videoId: string): Promise<void> {
    while (this.writeLocks.has(videoId)) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
    }
  }

  private async safeWriteJson(filePath: string, data: VideoStatusObject): Promise<void> {
    // Ensure the directory exists
    await fs.ensureDir(path.dirname(filePath));
    
    const tempPath = `${filePath}.tmp`;
    await fs.writeJson(tempPath, data);
    await fs.move(tempPath, filePath, { overwrite: true });
  }

  private async safeReadJson(filePath: string): Promise<VideoStatusObject | null> {
    try {
      // Check if file exists and is not empty
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        logger.warn({ filePath }, "Status file is empty, skipping read");
        return null;
      }
      
      return await fs.readJson(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      
      // Check for various JSON corruption patterns
      const errorMessage = error.message || '';
      const isJsonCorruption = 
        errorMessage.includes('Unexpected end of JSON input') ||
        errorMessage.includes('Unexpected non-whitespace character') ||
        errorMessage.includes('Unexpected token') ||
        errorMessage.includes('JSON') ||
        errorMessage.includes('parse');
      
      if (isJsonCorruption) {
        logger.warn({ filePath, error: errorMessage }, "Corrupted JSON file detected, removing...");
        try {
          await fs.remove(filePath);
          logger.info({ filePath }, "Corrupted JSON file removed successfully");
        } catch (removeError) {
          logger.error({ filePath, removeError }, "Failed to remove corrupted JSON file");
        }
        return null; // Return null to use default status
      }
      
      throw error;
    }
  }

  public async setStatus(
    videoId: string, 
    status: VideoStatus, 
    message?: string, 
    progress?: number, 
    stage?: string
  ): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    // Wait for any ongoing writes to complete
    await this.waitForWriteLock(videoId);
    
    // Acquire write lock
    this.writeLocks.add(videoId);
    
    try {
      let currentData: VideoStatusObject = { status: 'pending' };
      
      // Try to read existing data safely
      const existingData = await this.safeReadJson(filePath);
      if (existingData) {
        currentData = existingData;
      }

      const data: VideoStatusObject = { 
        ...currentData,
        status,
        message,
        progress,
        stage,
        startedAt: currentData.startedAt || new Date().toISOString(),
        completedAt: (status === 'ready' || status === 'failed') ? new Date().toISOString() : currentData.completedAt
      };

      await this.safeWriteJson(filePath, data);
      logger.info({ videoId, status, progress, stage, message }, "Video status updated.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error({ videoId, status, error: errorMessage }, "Failed to update video status.");
    } finally {
      // Release write lock
      this.writeLocks.delete(videoId);
    }
  }

  public async setProgress(
    videoId: string, 
    progress: number, 
    stage?: string,
    estimatedTimeRemaining?: number
  ): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    // Wait for any ongoing writes to complete
    await this.waitForWriteLock(videoId);
    
    // Acquire write lock
    this.writeLocks.add(videoId);
    
    try {
      let currentData: VideoStatusObject = { status: 'pending' };
      
      // Try to read existing data safely
      const existingData = await this.safeReadJson(filePath);
      if (existingData) {
        currentData = existingData;
      }

      const data: VideoStatusObject = { 
        ...currentData,
        progress: Math.min(100, Math.max(0, progress)),
        stage,
        estimatedTimeRemaining
      };

      await this.safeWriteJson(filePath, data);
      logger.debug({ 
        videoId, 
        progress, 
        stage, 
        estimatedTimeRemaining 
      }, "Video progress updated.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error({ videoId, progress, error: errorMessage }, "Failed to update video progress.");
    } finally {
      // Release write lock
      this.writeLocks.delete(videoId);
    }
  }

  public async setError(videoId: string, error: string): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    // Wait for any ongoing writes to complete
    await this.waitForWriteLock(videoId);
    
    // Acquire write lock
    this.writeLocks.add(videoId);
    
    try {
      let currentData: VideoStatusObject = { status: 'pending' };
      
      // Try to read existing data safely
      const existingData = await this.safeReadJson(filePath);
      if (existingData) {
        currentData = existingData;
      }

      const data: VideoStatusObject = { 
        ...currentData,
        status: 'failed',
        error,
        completedAt: new Date().toISOString()
      };

      await this.safeWriteJson(filePath, data);
      logger.error({ videoId, error }, "Video error status set.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error({ videoId, error: errorMessage }, "Failed to set video error status.");
    } finally {
      // Release write lock
      this.writeLocks.delete(videoId);
    }
  }

  public async getStatus(videoId: string): Promise<VideoStatusObject> {
    const filePath = this.getStatusFilePath(videoId);
    const defaultStatus: VideoStatusObject = { status: 'pending' };
    
    // Wait for any ongoing writes to complete
    await this.waitForWriteLock(videoId);
    
    try {
      const data = await this.safeReadJson(filePath);
      if (data) {
        return {
          status: data.status || 'pending',
          error: data.error,
          progress: data.progress,
          stage: data.stage,
          message: data.message,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          estimatedTimeRemaining: data.estimatedTimeRemaining
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ videoId, error: errorMessage }, "Failed to get video status. Defaulting to 'pending'.");
    }
    
    return defaultStatus;
  }

  public async deleteStatus(videoId: string): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    // Wait for any ongoing writes to complete
    await this.waitForWriteLock(videoId);
    
    // Acquire write lock
    this.writeLocks.add(videoId);
    
    try {
      if (fs.existsSync(filePath)) {
        await fs.remove(filePath);
        logger.info({ videoId, filePath }, "Video status file deleted");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ videoId, error: errorMessage }, "Failed to delete video status file");
    } finally {
      // Release write lock
      this.writeLocks.delete(videoId);
    }
  }
} 