import { OrientationEnum, MusicMoodEnum, VoiceEnum, Video, ShortResult, AudioResult, SceneInput, RenderConfig, Scene, VideoStatus, MusicTag, MusicForVideo, Caption, ShortQueue } from "../types/shorts";
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
import { VideoSearch } from "./libraries/VideoSearch";
import { PixabayAPI } from "./libraries/Pixabay";
import { ThreadPool } from './libraries/ThreadPool';
import { VideoProcessor } from './libraries/VideoProcessor';
import { cleanSceneText } from "./utils/textCleaner";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];
  private videoSearch: VideoSearch;
  private threadPool: ThreadPool;
  private outputDir: string;

  constructor(
    private globalConfig: Config,
    private remotion: Remotion,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
    private sileroTTS: SileroTTS,
    private pixabayApiKey: string,
    private pexelsApiKey: string,
    private videoProcessor: VideoProcessor,
    private maxWorkers: number = 4
  ) {
    this.videoSearch = new VideoSearch(
      new PixabayAPI(pixabayApiKey),
      new PexelsAPI(pexelsApiKey)
    );
    this.threadPool = new ThreadPool(maxWorkers);
    this.outputDir = this.globalConfig.videosDirPath;
  }

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
      id
    });
    this.processQueue();
    return id;
  }

  private async processQueue(): Promise<void> {
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
    const excludeVideoIds: string[] = [];
    const tempFiles: string[] = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    // Process all scenes in parallel
    const scenePromises = inputScenes.map(async (scene, index) => {
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
      
      // Generate audio and search for video in parallel
      const [audioResult, video] = await Promise.all([
        (async () => {
          const sceneText = cleanSceneText(scene.text);
          
          logger.info("🎙️ Preparando para gerar áudio com TTS", {
            sceneText,
            tempWavPath,
            emotion,
            language: config.language,
            referenceAudioPath,
            configReferenceAudioPath: config.referenceAudioPath,
            globalConfigReferenceAudioPath: this.globalConfig.referenceAudioPath,
            cwd: process.cwd()
          });
          
          await this.sileroTTS.generateSpeech(
            sceneText,
            tempWavPath,
            emotion,
            config.language,
            referenceAudioPath
          );
          
          logger.info({ tempWavPath }, "✅ Áudio gerado com sucesso, lendo arquivo");
          const audioBuffer = await fs.readFile(tempWavPath);
          const audioLength = await this.ffmpeg.getAudioDuration(tempWavPath);
          
          const tempMp3FileName = `${tempId}.mp3`;
          const tempMp3Path = path.join(this.globalConfig.tempDirPath, tempMp3FileName);
          tempFiles.push(tempMp3Path);

          await this.ffmpeg.saveToMp3(audioBuffer.buffer, tempMp3Path);
          
          return {
            audioLength,
            tempMp3FileName
          };
        })(),
        // Busca o vídeo com a duração estimada inicial
        this.videoSearch.findVideo(
          scene.searchTerms,
          10, // Initial duration estimate
          excludeVideoIds,
          orientation
        )
      ]);

      let { audioLength } = audioResult;
      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      // Generate captions with actual timing from audio
      const words = scene.text.split(" ");
      const wordCount = words.length;
      const wordDuration = (audioLength * 1000) / wordCount; // ms

      const captions: Caption[] = words.map((word, i) => ({
        text: word + (i < words.length - 1 ? " " : ""),
        startMs: i * wordDuration,
        endMs: (i + 1) * wordDuration,
        emotion: emotion as "question" | "exclamation" | "neutral"
      }));

      scenes.push({
        id: tempId,
        text: scene.text,
        searchTerms: scene.searchTerms,
        duration: audioLength,
        orientation,
        captions: captions,
        video: video.url,
        audio: {
          url: `http://localhost:${this.globalConfig.port}/api/tmp/${audioResult.tempMp3FileName}`,
          duration: audioLength,
        },
      });

      totalDuration += audioLength;
      excludeVideoIds.push(video.id);
    });

    // Wait for all scenes to be processed
    await Promise.all(scenePromises);

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
      orientation
    );

    // Clean up temp files
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

  private findMusic(duration: number, mood?: MusicTag): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (mood) {
        return music.mood === mood;
      }
      return true;
    });

    if (musicFiles.length === 0) {
      throw new Error("No music files found");
    }

    const music = musicFiles[Math.floor(Math.random() * musicFiles.length)];
    const musicDuration = music.end - music.start;
    const musicStart = Math.random() * (musicDuration - duration);

    return {
      file: music.file,
      url: `http://localhost:${this.globalConfig.port}/api/music/${encodeURIComponent(music.file)}`,
      start: musicStart,
      end: musicStart + duration,
      mood: music.mood
    };
  }

  public ListAvailableMusicTags(): MusicMoodEnum[] {
    return Object.values(MusicMoodEnum);
  }

  public ListAvailableVoices(): VoiceEnum[] {
    return Object.values(VoiceEnum);
  }

  public listAllVideos(): string[] {
    const videosDir = this.globalConfig.videosDirPath;
    if (!fs.existsSync(videosDir)) {
      return [];
    }
    return fs.readdirSync(videosDir)
      .filter(file => file.endsWith('.mp4'))
      .map(file => file.replace('.mp4', ''));
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video not found');
    }
    return fs.readFileSync(videoPath);
  }
}
