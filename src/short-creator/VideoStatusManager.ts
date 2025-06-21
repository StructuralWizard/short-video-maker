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

  constructor(config: Config) {
    this.statusDir = path.join(config.dataDirPath, "status");
    fs.ensureDirSync(this.statusDir);
  }

  private getStatusFilePath(videoId: string): string {
    return path.join(this.statusDir, `${videoId}.json`);
  }

  public async setStatus(
    videoId: string, 
    status: VideoStatus, 
    message?: string,
    progress?: number,
    stage?: string
  ): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    // Carrega o status atual para preservar campos existentes
    let currentData: VideoStatusObject = { status: 'pending' };
    try {
      if (await fs.pathExists(filePath)) {
        currentData = await fs.readJson(filePath);
      }
    } catch (error) {
      logger.warn({ videoId, error }, "Could not load existing status, starting fresh");
    }

    const data: VideoStatusObject = { 
      ...currentData,
      status,
      message,
      progress,
      stage
    };

    // Adiciona timestamps
    if (status === 'processing' && !currentData.startedAt) {
      data.startedAt = new Date().toISOString();
    }
    if (status === 'ready' || status === 'failed') {
      data.completedAt = new Date().toISOString();
    }

    // Remove error se não for failed
    if (status !== 'failed') {
      delete data.error;
    }

    try {
      await fs.writeJson(filePath, data);
      logger.info({ 
        videoId, 
        status, 
        progress, 
        stage, 
        message 
      }, "Video status updated.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error({ videoId, status, error: errorMessage }, "Failed to set video status.");
    }
  }

  public async setProgress(
    videoId: string, 
    progress: number, 
    stage?: string,
    estimatedTimeRemaining?: number
  ): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    let currentData: VideoStatusObject = { status: 'pending' };
    try {
      if (await fs.pathExists(filePath)) {
        currentData = await fs.readJson(filePath);
      }
    } catch (error) {
      logger.warn({ videoId, error }, "Could not load existing status for progress update");
    }

    const data: VideoStatusObject = { 
      ...currentData,
      progress: Math.min(100, Math.max(0, progress)),
      stage,
      estimatedTimeRemaining
    };

    try {
      await fs.writeJson(filePath, data);
      logger.debug({ 
        videoId, 
        progress, 
        stage, 
        estimatedTimeRemaining 
      }, "Video progress updated.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error({ videoId, progress, error: errorMessage }, "Failed to update video progress.");
    }
  }

  public async setError(videoId: string, error: string): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    
    let currentData: VideoStatusObject = { status: 'pending' };
    try {
      if (await fs.pathExists(filePath)) {
        currentData = await fs.readJson(filePath);
      }
    } catch (e) {
      logger.warn({ videoId, error: e }, "Could not load existing status for error update");
    }

    const data: VideoStatusObject = { 
      ...currentData,
      status: 'failed',
      error,
      completedAt: new Date().toISOString()
    };

    try {
      await fs.writeJson(filePath, data);
      logger.error({ videoId, error }, "Video error status set.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      logger.error({ videoId, error: errorMessage }, "Failed to set video error status.");
    }
  }

  public async getStatus(videoId: string): Promise<VideoStatusObject> {
    const filePath = this.getStatusFilePath(videoId);
    const defaultStatus: VideoStatusObject = { status: 'pending' };
    try {
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
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
} 