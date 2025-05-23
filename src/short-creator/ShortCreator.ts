import { OrientationEnum, MusicMoodEnum, VoiceEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";

import { Remotion } from "./libraries/Remotion";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import { type Music } from "../types/shorts";
import { SileroTTS } from "./libraries/SileroTTS";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicTag,
  MusicForVideo,
  Caption,
} from "../types/shorts";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];

  constructor(
    private globalConfig: Config,
    private remotion: Remotion,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(
    sceneInput: SceneInput[],
    config: RenderConfig,
  ): string {
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
    });
    this.processQueue();
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    const scenes: Scene[] = [];
    let totalDuration = 0;
    const excludeVideoIds = [];
    const tempFiles = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    const sileroTTS = await SileroTTS.init(this.globalConfig);

    let index = 0;
    for (const scene of inputScenes) {
      const tempId = cuid();
      const tempWavFileName = `${tempId}.wav`;
      const tempWavPath = path.join(this.globalConfig.tempDirPath, tempWavFileName);
      tempFiles.push(tempWavPath);

      let emotion = "neutral";
      if (scene.text.trim().endsWith("?")) {
        emotion = "question";
      } else if (scene.text.trim().endsWith("!")) {
        emotion = "exclamation";
      }
      const referenceAudioPath = config.referenceAudioPath || this.globalConfig.referenceAudioPath;
      logger.info({ 
        sceneText: scene.text,
        tempWavPath,
        emotion,
        language: config.language,
        referenceAudioPath,
        configReferenceAudioPath: config.referenceAudioPath,
        globalConfigReferenceAudioPath: this.globalConfig.referenceAudioPath,
        cwd: process.cwd()
      }, "🎙️ Preparando para gerar áudio com TTS");
      
      await sileroTTS.generateSpeech(scene.text, tempWavPath, emotion, config.language, referenceAudioPath);
      
      logger.info({ tempWavPath }, "✅ Áudio gerado com sucesso, lendo arquivo");
      const audioBuffer = await fs.readFile(tempWavPath);
      const audio = {
        audio: audioBuffer.buffer,
        audioLength: await this.ffmpeg.getAudioDuration(tempWavPath)
      };

      let { audioLength } = audio;
      const { audio: audioStream } = audio;

      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      const tempMp3FileName = `${tempId}.mp3`;
      const tempMp3Path = path.join(this.globalConfig.tempDirPath, tempMp3FileName);
      tempFiles.push(tempMp3Path);

      await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
      const video = await this.pexelsApi.findVideo(
        scene.searchTerms,
        audioLength,
        excludeVideoIds,
        orientation,
      );
      excludeVideoIds.push(video.id);

      // Generate captions
      const captions: Caption[] = [{
        text: scene.text,
        startMs: 0,
        endMs: audioLength * 1000,
        emotion: emotion as "question" | "exclamation" | "neutral"
      }];

      scenes.push({
        captions,
        video: video.url,
        audio: {
          url: `http://localhost:${this.globalConfig.port}/api/tmp/${tempMp3FileName}`,
          duration: audioLength,
        },
      });

      totalDuration += audioLength;
      index++;
    }
    if (config.paddingBack) {
      totalDuration += config.paddingBack / 1000;
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

    await this.remotion.render(
      {
        music: selectedMusic,
        scenes,
        config: {
          durationMs: totalDuration * 1000,
          paddingBack: config.paddingBack,
          ...{
            captionBackgroundColor: config.captionBackgroundColor || "#dd0000",
            captionTextColor: config.captionTextColor || "#ffffff",
            captionPosition: config.captionPosition,
          },
          musicVolume: config.musicVolume,
        },
      },
      videoId,
      orientation,
    );

    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.globalConfig.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });

    if (musicFiles.length === 0) {
      throw new Error("No music files found");
    }

    const music = musicFiles[Math.floor(Math.random() * musicFiles.length)];
    const musicDuration = music.end - music.start;
    const musicStart = Math.random() * (musicDuration - videoDuration);

    return {
      ...music,
      url: `http://localhost:${this.globalConfig.port}/api/music/${encodeURIComponent(music.file)}`,
    };
  }

  public ListAvailableMusicTags(): MusicTag[] {
    return Object.values(MusicMoodEnum);
  }

  public listAllVideos(): { id: string; status: VideoStatus }[] {
    if (!fs.existsSync(this.globalConfig.videosDirPath)) {
      return [];
    }

    const files = fs.readdirSync(this.globalConfig.videosDirPath);
    return files
      .filter((file) => file.endsWith(".mp4"))
      .map((file) => {
        const id = file.replace(".mp4", "");
        return {
          id,
          status: this.status(id),
        };
      });
  }

  public ListAvailableVoices(): string[] {
    return Object.values(VoiceEnum);
  }
}
