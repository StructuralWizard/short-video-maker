import { Scene, Video } from "../../types/shorts";
import { logger } from "../../utils/logger";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";

export class VideoProcessor {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async processVideo(scene: Scene, video: Video): Promise<string> {
    const outputPath = path.join(this.outputDir, `${scene.id}.mp4`);
    
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(video.url)
          .setFfmpegPath(process.env.FFMPEG_PATH || "ffmpeg")
          .setFfprobePath(process.env.FFPROBE_PATH || "ffprobe")
          .outputOptions([
            "-c:v libx264",
            "-preset medium",
            "-crf 23",
            "-c:a pcm_s16le",
            "-ar 44100",
            "-movflags +faststart"
          ])
          .duration(scene.duration)
          .size(`${video.width}x${video.height}`)
          .output(outputPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });

      return outputPath;
    } catch (error) {
      logger.error("Error processing video:", error);
      throw error;
    }
  }

  async combineVideos(scenes: Scene[], videoPaths: string[]): Promise<string> {
    const outputPath = path.join(this.outputDir, "final.mp4");
    const tempFile = path.join(this.outputDir, "temp.txt");

    try {
      // Create a file listing all videos to concatenate
      const fileContent = videoPaths.map(p => `file '${p}'`).join("\n");
      await fs.writeFile(tempFile, fileContent);

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .setFfmpegPath(process.env.FFMPEG_PATH || "ffmpeg")
          .setFfprobePath(process.env.FFPROBE_PATH || "ffprobe")
          .input(tempFile)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions([
            "-c:v libx264",
            "-preset medium",
            "-crf 23",
            "-c:a aac",
            "-b:a 128k",
            "-movflags +faststart"
          ])
          .output(outputPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });

      // Clean up temp file
      await fs.unlink(tempFile);

      return outputPath;
    } catch (error) {
      logger.error("Error combining videos:", error);
      throw error;
    }
  }
} 