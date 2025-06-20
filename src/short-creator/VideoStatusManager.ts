import fs from "fs-extra";
import path from "path";
import { Config } from "../config";
import { logger } from "../logger";

export type VideoStatus = "pending" | "processing" | "ready" | "failed";

export class VideoStatusManager {
  private statusDir: string;

  constructor(config: Config) {
    this.statusDir = path.join(config.dataDirPath, "status");
    fs.ensureDirSync(this.statusDir);
  }

  private getStatusFilePath(videoId: string): string {
    return path.join(this.statusDir, `${videoId}.json`);
  }

  public async setStatus(videoId: string, status: VideoStatus): Promise<void> {
    const filePath = this.getStatusFilePath(videoId);
    try {
      await fs.writeJson(filePath, { status });
      logger.info({ videoId, status }, "Video status updated.");
    } catch (error) {
      logger.error({ videoId, status, error }, "Failed to set video status.");
    }
  }

  public async getStatus(videoId: string): Promise<VideoStatus> {
    const filePath = this.getStatusFilePath(videoId);
    try {
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        return data.status || "pending";
      }
    } catch (error) {
      logger.error({ videoId, error }, "Failed to get video status. Defaulting to 'pending'.");
    }
    return "pending";
  }
} 