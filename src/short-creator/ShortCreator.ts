import { OrientationEnum, MusicMoodEnum, VoiceEnum, Video, ShortResult, AudioResult, SceneInput, RenderConfig, Scene, VideoStatus, MusicTag, MusicForVideo, Caption, ShortQueue } from "../types/shorts";
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import { execSync } from "child_process";

import { Remotion } from "./libraries/Remotion";
import { FFMpeg } from "./libraries/FFmpeg";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import { type Music } from "../types/shorts";
import { LocalTTS } from "./libraries/LocalTTS";
import { VideoSearch } from "./libraries/VideoSearch";
import { ThreadPool } from './libraries/ThreadPool';
import { VideoProcessor } from './libraries/VideoProcessor';
import { cleanSceneText, splitTextByPunctuation } from "./utils/textCleaner";
import { LocalImageAPI } from "./libraries/LocalImageAPI";

export class ShortCreator {
  private queue: {
    id: string;
    sceneInput: SceneInput[];
    config: RenderConfig;
    status: "pending" | "processing" | "completed" | "failed";
  }[] = [];
  private videoSearch: VideoSearch;
  private threadPool: ThreadPool;
  private outputDir: string;
  private processingVideos = new Map<string, Video>();

  constructor(
    private globalConfig: Config,
    private remotion: Remotion,
    private ffmpeg: FFMpeg,
    private localImageApi: LocalImageAPI,
    private musicManager: MusicManager,
    private localTTS: LocalTTS,
    _pixabayApiKey: string | undefined,
    _pexelsApiKey: string | undefined,
    private videoProcessor: VideoProcessor,
    private maxWorkers: number = 4
  ) {
    this.videoSearch = new VideoSearch(
      new LocalImageAPI(this.globalConfig.port)
    );
    this.threadPool = new ThreadPool(maxWorkers);
    this.outputDir = this.globalConfig.videosDirPath;
  }

  /**
   * Garante que a URL seja absoluta, adicionando o prefixo do servidor se necessário
   */
  private ensureAbsoluteUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:${this.globalConfig.port}${url}`;
  }

  public status(id: string): VideoStatus {
    try {
      const videoPath = this.getVideoPath(id);
      const queueItem = this.queue.find((item) => item.id === id);
      
      logger.debug({ videoId: id, queueItem, videoPath }, "Checking video status");
      
      if (queueItem) {
        if (queueItem.status === "completed") {
          logger.info({ videoId: id }, "Video is ready");
          return "ready";
        }
        if (queueItem.status === "failed") {
          logger.error({ videoId: id }, "Video generation failed");
          return "failed";
        }
        logger.info({ videoId: id }, "Video is still processing");
        return "processing";
      }
      
      if (fs.existsSync(videoPath)) {
        logger.info({ videoId: id }, "Video file exists and is ready");
        return "ready";
      }
      
      logger.error({ videoId: id }, "Video not found in queue or filesystem");
      return "failed";
    } catch (error) {
      logger.error({ error, videoId: id }, "Error checking video status");
      return "failed";
    }
  }

  public addToQueue(
    sceneInput: SceneInput[],
    config: RenderConfig,
  ): string {
    const id = cuid();
    this.queue.push({
      sceneInput: JSON.parse(JSON.stringify(sceneInput)),
      config: JSON.parse(JSON.stringify(config)),
      id,
      status: "pending"
    });

    this.processQueue();
    return id;
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }
    const queueItem = this.queue[0];
    if (queueItem.status === "pending") {
      queueItem.status = "processing";
      logger.debug(
        { sceneInput: queueItem.sceneInput, config: queueItem.config, id: queueItem.id },
        "Processing video item in the queue",
      );
      try {
        await this.createShort(queueItem.id, queueItem.sceneInput, queueItem.config);
        queueItem.status = "completed";
        logger.debug({ id: queueItem.id }, "Video created successfully");
      } catch (error: unknown) {
        queueItem.status = "failed";
        logger.error(error, "Error creating video");
      } finally {
        this.queue.shift();
        this.processQueue();
      }
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    const startTime = Date.now();
    logger.info({ videoId }, "Starting video creation process");

    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    let totalDuration = 0;
    const excludeVideoIds: string[] = [];
    const tempFiles: string[] = [];
    const scenes: Scene[] = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    // Pré-busca de vídeos para todas as cenas
    const videoSearchStart = Date.now();
    logger.info({ videoId }, "Starting video search phase");
    
    const videoPromises = inputScenes.map(async (scene, sceneIndex) => {
      const sceneStartTime = Date.now();
      logger.debug({ videoId, sceneIndex }, "Processing scene video search");
      
      // Split text into two parts if possible
      const textParts = this.splitTextIntoTwoParts(scene.text);
      
      // Filtra termos muito curtos (menos de 4 letras)
      const filteredTerms = scene.searchTerms
        .filter(term => term.length >= 4)
        .join(" ");

      // Se não houver termos válidos após o filtro, usa o termo original
      const searchTerms = filteredTerms.length > 0 ? filteredTerms : scene.searchTerms.join(" ");
      
      // Faz uma única busca para a cena e pega múltiplos resultados
      const searchResults = await this.videoSearch.findVideos(
        searchTerms,
        10, // Initial duration estimate
        excludeVideoIds,
        orientation,
        textParts.length // Número de vídeos necessários
      );

      // Adiciona os IDs dos vídeos selecionados ao excludeVideoIds
      searchResults.forEach(video => excludeVideoIds.push(video.id));

      const sceneEndTime = Date.now();
      logger.debug({ 
        videoId, 
        sceneIndex, 
        duration: sceneEndTime - sceneStartTime 
      }, "Scene video search completed");

      return { scene, videos: searchResults, textParts };
    });

    // Aguarda todas as buscas de vídeo
    const videoResults = await Promise.all(videoPromises);
    const videoSearchEnd = Date.now();
    logger.info({ 
      videoId, 
      duration: videoSearchEnd - videoSearchStart,
      scenesCount: inputScenes.length 
    }, "Video search phase completed");

    // Processa todas as cenas em paralelo
    const sceneProcessingStart = Date.now();
    logger.info({ videoId }, "Starting scene processing phase");

    let sceneProcessingEnd: number;
    try {
      const scenePromises = videoResults.map(async ({ scene, videos, textParts }, sceneIndex) => {
        const sceneStartTime = Date.now();
        logger.debug({ videoId, sceneIndex }, "Processing scene");
        
      const sceneResults: Scene[] = [];

        try {
      for (let i = 0; i < textParts.length; i++) {
            const partStartTime = Date.now();
        const part = textParts[i];
        const video = videos[i];
        const tempId = cuid();
        const tempWavFileName = `${tempId}.wav`;
        const tempWavPath = path.join(this.globalConfig.tempDirPath, tempWavFileName);
        tempFiles.push(tempWavPath);

        let emotion = "neutral";
        if (part.trim().endsWith("?")) {
          emotion = "question";
        } else if (part.trim().endsWith("!")) {
          emotion = "exclamation";
        }

            // Substitui ponto final por vírgula
            let textForTTS = part.trim();
            if (textForTTS.endsWith(".")) {
              textForTTS = textForTTS.slice(0, -1) + ", ";
            }

            logger.debug({ 
              videoId, 
              sceneIndex, 
              partIndex: i,
              text: textForTTS,
              emotion,
            }, "Generating TTS audio");

            try {
              // Gera o áudio usando TTS
              await this.localTTS.generateSpeech(
                textForTTS,
                tempWavPath,
                emotion,
                config.language || "pt"
              );

              // Obtém a duração do áudio
              const audioLength = await this.ffmpeg.getAudioDuration(tempWavPath);
              let finalAudioLength = audioLength;
              
              if (inputScenes.indexOf(scene) + 1 === inputScenes.length && config.paddingBack) {
                finalAudioLength += config.paddingBack / 1000;
              }

              const sceneText = cleanSceneText(part);
              const phrases = splitTextByPunctuation(sceneText);
              
              const silenceBetweenPhrases = 1;
              const numSilences = phrases.length - 1;
              const totalSilence = numSilences * silenceBetweenPhrases;
              const spokenAudioLength = finalAudioLength - totalSilence;

              const words = part.split(" ");
              const wordCount = words.length;
              const baseWordDuration = (spokenAudioLength * 1000) / wordCount;
              
              let currentTime = 0;
              const captions: Caption[] = words.map((word, i) => {
                const wordLength = word.length;
                const durationMultiplier = Math.max(0.7, Math.min(2.0, wordLength / 4));
                const wordDuration = baseWordDuration * durationMultiplier;
                
                const startMs = currentTime;
                currentTime += wordDuration;
                
                if (/[.,!?;]$/.test(word)) {
                  currentTime += 200;
                }
                
                return {
                  text: word + (i < words.length - 1 ? " " : ""),
                  startMs,
                  endMs: currentTime,
                  emotion: emotion as "question" | "exclamation" | "neutral"
                };
              });

              const totalCaptionDuration = captions[captions.length - 1].endMs;
              const timeAdjustment = (finalAudioLength * 1000) - totalCaptionDuration;
              
              if (timeAdjustment !== 0) {
                const adjustmentPerWord = timeAdjustment / wordCount;
                captions.forEach((caption, i) => {
                  caption.startMs += adjustmentPerWord * i;
                  caption.endMs += adjustmentPerWord * (i + 1);
                });
              }

              totalDuration += finalAudioLength;

              // Adiciona a cena ao array de resultados
              sceneResults.push({
                id: tempId,
                text: part,
                searchTerms: scene.searchTerms,
                duration: finalAudioLength,
                orientation,
                captions: captions,
                videos: [this.ensureAbsoluteUrl(video.url)],
                audio: {
                  url: this.ensureAbsoluteUrl(`/api/tmp/${tempWavFileName}`),
                  duration: finalAudioLength,
                }
              });

              const partEndTime = Date.now();
              logger.debug({ 
                videoId, 
                sceneIndex, 
                partIndex: i,
                duration: partEndTime - partStartTime 
              }, "Scene part processing completed");
            } catch (error) {
              logger.error({ 
                error, 
                videoId, 
                sceneIndex, 
                partIndex: i,
                text: part,
                emotion,
              }, "Error processing scene part");
              throw error;
            }
          }

          const sceneEndTime = Date.now();
          logger.debug({ 
            videoId, 
            sceneIndex, 
            duration: sceneEndTime - sceneStartTime 
          }, "Scene processing completed");

      return sceneResults;
        } catch (error) {
          logger.error({ 
            error, 
            videoId, 
            sceneIndex,
            sceneText: scene.text,
            searchTerms: scene.searchTerms
          }, "Error processing scene");
          throw error;
        }
      });

    const sceneResults = await Promise.all(scenePromises);
      sceneProcessingEnd = Date.now();
      logger.info({ 
        videoId, 
        duration: sceneProcessingEnd - sceneProcessingStart,
        scenesCount: inputScenes.length 
      }, "Scene processing phase completed");

    // Flatten the array of scenes
    const allScenes = sceneResults.flat();
    scenes.push(...allScenes);
    } catch (error) {
      logger.error({ 
        error, 
        videoId,
        scenesCount: inputScenes.length,
        duration: Date.now() - sceneProcessingStart
      }, "Error in scene processing phase");
      throw error;
    }

    // Adiciona 2 segundos extras no início e fim além do padding configurado
    const extraPadding = 2; // 2 segundos
    if (config.paddingBack) {
      totalDuration += (config.paddingBack / 1000) + extraPadding;
    } else {
      totalDuration += extraPadding;
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

    const renderStart = Date.now();
    logger.info({ videoId }, "Starting video rendering phase");

    try {
    await this.remotion.render(
      {
        music: {
          ...selectedMusic,
        },
        scenes,
        config: {
          durationMs: totalDuration * 1000,
          paddingBack: (config.paddingBack || 0) + (extraPadding * 1000),
          ...{
            captionBackgroundColor: config.captionBackgroundColor || "#dd0000",
            captionTextColor: config.captionTextColor || "#ffffff",
            captionPosition: config.captionPosition,
          },
          musicVolume: config.musicVolume,
          overlay: config.overlay,
        },
      },
      videoId,
      orientation
    );
    } catch (error: any) {
      logger.error({ 
        error, 
        videoId,
        scenes: scenes.map(s => ({ id: s.id, text: s.text })),
        duration: totalDuration
      }, "Error during video rendering");
      
      // Limpa arquivos temporários em caso de erro
      for (const file of tempFiles) {
        try {
          fs.removeSync(file);
        } catch (cleanupError) {
          logger.error({ error: cleanupError, file }, "Error cleaning up temp file");
        }
      }
      
      throw new Error(`Failed to render video: ${error.message || 'Unknown error'}`);
    }

    const renderEnd = Date.now();
    logger.info({ 
      videoId, 
      duration: renderEnd - renderStart 
    }, "Video rendering phase completed");

    // Clean up temp files
    const cleanupStart = Date.now();
    logger.info({ videoId }, "Starting cleanup phase");
    
    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    const cleanupEnd = Date.now();
    logger.info({ 
      videoId, 
      duration: cleanupEnd - cleanupStart 
    }, "Cleanup phase completed");

    const totalEndTime = Date.now();
    logger.info({ 
      videoId, 
      totalDuration: totalEndTime - startTime,
      phases: {
        videoSearch: videoSearchEnd - videoSearchStart,
        sceneProcessing: sceneProcessingEnd - sceneProcessingStart,
        rendering: renderEnd - renderStart,
        cleanup: cleanupEnd - cleanupStart
      }
    }, "Video creation process completed");

    return videoId;
  }

  private splitTextIntoTwoParts(text: string): string[] {
    // Remove espaços extras e pontuação no final
    text = text.trim().replace(/[.!?]+$/, '');
    
    // Divide o texto em partes usando pontuação de fim de frase
    const parts = text.split(/(?<=[.!?:])\s+/);
    
    // Filtra as partes que têm pelo menos 7 palavras
    const validParts = parts.filter(part => {
      const wordCount = part.split(/\s+/).length;
      return wordCount >= 7;
    });

    // Se não houver partes válidas, retorna o texto original
    if (validParts.length === 0) {
      return [text];
    }

    return validParts;
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
    
    // Calculate how many times the music can fit in the video duration
    const possibleSegments = Math.floor(musicDuration / duration);
    
    if (possibleSegments < 1) {
      // If music is shorter than video, loop it
      return {
        file: music.file,
        url: this.ensureAbsoluteUrl(`/api/music/${encodeURIComponent(music.file)}`),
        start: music.start,
        end: music.start + duration,
        mood: music.mood,
        loop: true
      };
    }

    // Select a random segment from the music
    const segmentIndex = Math.floor(Math.random() * possibleSegments);
    const startTime = music.start + (segmentIndex * duration);
    
    return {
      file: music.file,
      url: this.ensureAbsoluteUrl(`/api/music/${encodeURIComponent(music.file)}`),
      start: startTime,
      end: startTime + duration,
      mood: music.mood,
      loop: true
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

  public async getVideoBuffer(videoId: string): Promise<Buffer> {
    const videoPath = this.getVideoPath(videoId);
    const queueItem = this.queue.find((item) => item.id === videoId);
    
    // Se o vídeo ainda está na fila, verifica o status
    if (queueItem) {
      if (queueItem.status === "failed") {
        throw new Error('Video generation failed');
      }
      if (queueItem.status !== "completed") {
        throw new Error('Video is still being processed');
      }
    }
    
    // Verifica se o arquivo existe
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video not found');
    }

    // Espera até que o arquivo esteja completamente escrito
    let lastSize = 0;
    let currentSize = fs.statSync(videoPath).size;
    let attempts = 0;
    const maxAttempts = 30; // 30 segundos máximo de espera
    
    // Espera até que o tamanho do arquivo pare de mudar ou atinja o tempo máximo
    while (currentSize !== lastSize && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
      lastSize = currentSize;
      currentSize = fs.statSync(videoPath).size;
      attempts++;
      
      // Se o arquivo não existe mais, lança erro
      if (!fs.existsSync(videoPath)) {
        throw new Error('Video file was removed during processing');
      }
    }

    // Se atingiu o tempo máximo e o arquivo ainda está mudando, lança erro
    if (currentSize !== lastSize) {
      throw new Error('Video file is still being written after maximum wait time');
    }

    // Lê o arquivo
    return fs.readFileSync(videoPath);
  }

  private async getVideoInfo(id: string): Promise<Video> {
    logger.debug({ videoId: id }, "Checking video status");
    
    // Verificar se o vídeo está na fila
    const queuedVideo = this.queue.find((v) => v.id === id);
    if (queuedVideo) {
      logger.debug({ videoId: id }, "Video found in queue");
      return {
        id,
        url: this.getVideoPath(id),
        width: 1080,
        height: 1920,
        duration: 0
      };
    }

    // Verificar se o vídeo existe no sistema de arquivos
    const videoPath = path.join(this.globalConfig.videosDirPath, `${id}.mp4`);
    if (fs.existsSync(videoPath)) {
      logger.debug({ videoId: id, path: videoPath }, "Video found in filesystem");
      return {
        id,
        url: videoPath,
        width: 1080,
        height: 1920,
        duration: 0 // Será preenchido quando necessário
      };
    }

    // Verificar se o vídeo está em processamento
    const processingVideo = this.processingVideos.get(id);
    if (processingVideo) {
      logger.debug({ videoId: id }, "Video is still processing");
      return processingVideo;
    }

    logger.error({ videoId: id }, "Video not found in queue or filesystem");
    throw new Error("Video not found");
  }

  private async cleanupVideo(id: string): Promise<void> {
    logger.debug({ videoId: id }, "Starting cleanup for video");
    
    try {
      // Remover da fila
      this.queue = this.queue.filter((v) => v.id !== id);
      logger.debug({ videoId: id }, "Removed from queue");

      // Remover do processamento
      this.processingVideos.delete(id);
      logger.debug({ videoId: id }, "Removed from processing");

      // Limpar arquivos temporários
      const tempDir = path.join(this.globalConfig.tempDirPath, id);
      if (fs.existsSync(tempDir)) {
        await fs.remove(tempDir);
        logger.debug({ videoId: id, path: tempDir }, "Cleaned up temp directory");
      }

      logger.debug({ videoId: id }, "Cleanup completed successfully");
    } catch (error) {
      logger.error({ videoId: id, error }, "Error during cleanup");
      throw error;
    }
  }
}
