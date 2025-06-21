import { OrientationEnum, MusicMoodEnum, VoiceEnum, Video, ShortResult, AudioResult, SceneInput, RenderConfig, Scene, MusicTag, MusicForVideo, Caption, ShortQueue } from "../types/shorts";
import fs from "fs-extra";
import { promises as fsPromises } from "fs";
import cuid from "cuid";
import path from "path";
import { execSync, spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import * as crypto from 'crypto';
import { getAudioDurationInSeconds } from "@remotion/media-utils";

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
import { VideoStatus, VideoStatusManager, VideoStatusObject } from "./VideoStatusManager";
import { QueueItem } from "./types/QueueItem";

export class ShortCreator {
  private bundled: string;
  private globalConfig: Config;
  private videoSearch: VideoSearch;
  private localTTS: LocalTTS;
  private remotion: Remotion;
  private statusManager: VideoStatusManager;
  private ffmpeg: FFMpeg;
  private outputDir: string;
  private musicManager: MusicManager;

  // Filas de processamento
  private creationQueue: QueueItem[] = [];
  private renderQueue: string[] = [];
  private isProcessingCreation = false;
  private isProcessingRender = false;

  constructor(
    bundled: string,
    globalConfig: Config,
    remotion: Remotion,
    ffmpeg: FFMpeg,
    localImageApi: LocalImageAPI,
    localTTS: LocalTTS,
    statusManager: VideoStatusManager
  ) {
    this.bundled = bundled;
    this.globalConfig = globalConfig;
    this.remotion = remotion;
    this.ffmpeg = ffmpeg;
    this.localTTS = localTTS;
    this.statusManager = statusManager;
    this.videoSearch = new VideoSearch(localImageApi);
    this.musicManager = new MusicManager(globalConfig);
    this.outputDir = path.join(this.globalConfig.dataDirPath, "temp");
    fs.ensureDirSync(this.outputDir);
  }

  /**
   * Garante que a URL seja absoluta, adicionando o prefixo do servidor se necessário
   */
  private ensureAbsoluteUrl(url: string | undefined | null): string {
    if (!url) {
      throw new Error("URL cannot be undefined or null");
    }
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:${this.globalConfig.port}${url}`;
  }

  public processTextForTTS(text: string): string[] {
    const cleanedText = cleanSceneText(text);
    return this.splitTextIntoScenes(cleanedText);
  }

  public async status(id: string): Promise<VideoStatusObject> {
    const status = await this.statusManager.getStatus(id);
    
    // Se o vídeo já existe, atualiza o status para "ready" independentemente do status atual
    if (fs.existsSync(this.getVideoPath(id))) {
      if (status.status !== 'ready') {
        await this.statusManager.setStatus(id, "ready");
        return { status: "ready" };
      }
      return status;
    }
    
    // Se o status não é pending, retorna o status atual
    if (status.status !== 'pending') {
      return status;
    }
    
    return { status: "failed", error: "Video file not found and no status was recorded." };
  }

  public addToQueue(
    sceneInput: SceneInput[],
    config: RenderConfig,
  ): string {
    const id = cuid();
    this.creationQueue.push({
      id,
      sceneInput: JSON.parse(JSON.stringify(sceneInput)),
      config: JSON.parse(JSON.stringify(config)),
      status: "pending"
    });
    this.statusManager.setStatus(id, "processing"); // Set initial status

    // Salva o script do vídeo
    const scriptData = {
      scenes: sceneInput,
      config: config,
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${id}.script.json`);
    try {
      fs.ensureDirSync(path.dirname(scriptPath));
      fs.writeJsonSync(scriptPath, scriptData);
      logger.info({ id }, "Saved video script");
    } catch (error) {
      logger.error({ id, error }, "Error saving video script");
    }

    this.processCreationQueue();
    return id;
  }

  private async processCreationQueue(): Promise<void> {
    if (this.isProcessingCreation || this.creationQueue.length === 0) return;
    this.isProcessingCreation = true;

    const item = this.creationQueue.shift();
    if (!item) {
      this.isProcessingCreation = false;
      return;
    }
    
    try {
      await this.prepareAndRender(item.id);
    } catch (error) {
      logger.error({ videoId: item.id, error }, "Error in creation pipeline");
    } finally {
      this.isProcessingCreation = false;
      this.processCreationQueue();
    }
  }

  private async prepareAndRender(videoId: string): Promise<void> {
    await this.statusManager.setStatus(videoId, "processing", "Preparing assets...");
    
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${videoId}.script.json`);
    const scriptData = fs.readJsonSync(scriptPath);

    const { remotionData, updatedScriptScenes } = await this.processScenes(videoId, scriptData.scenes, scriptData.config);

    const renderJsonPath = path.join(this.globalConfig.videosDirPath, `${videoId}.render.json`);
    fs.writeJsonSync(renderJsonPath, remotionData, { spaces: 2 });
    
    scriptData.scenes = updatedScriptScenes;
    fs.writeJsonSync(scriptPath, scriptData, { spaces: 2 });

    await this.renderFromRenderJson(videoId);
  }

  private async processScenes(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig
  ): Promise<{ remotionData: any, updatedScriptScenes: SceneInput[] }> {
    const orientation: OrientationEnum = config.orientation || OrientationEnum.portrait;
    const excludeVideoIds: string[] = [];
    const remotionDataNested: Scene[][] = [];
    const newScriptScenes: SceneInput[] = [];

    // Usar um loop imperativo para garantir que a mutação aconteça de forma previsível.
    for (const originalScene of inputScenes) {
      // Cria uma cópia para trabalhar, garantindo que o original não seja modificado por referência.
      const scene: SceneInput = JSON.parse(JSON.stringify(originalScene));
      
      let finalVideos: Video[];

      // Lógica para encontrar os vídeos
      if (scene.videos && scene.videos.length > 0 && scene.videos.every(v => v)) {
        logger.debug({ videoId, sceneIndex: inputScenes.indexOf(originalScene) }, "Re-render: Using pre-defined videos.");
        finalVideos = await Promise.all(
          scene.videos.map(videoUrl =>
            this.videoSearch.getVideoByUrl(videoUrl).catch(error => {
              logger.error({ videoId, sceneIndex: inputScenes.indexOf(originalScene), videoUrl, error }, "Pre-defined video not found.");
              throw new Error(`Failed to find pre-defined video: ${videoUrl}.`);
            }),
          ),
        );
      } else {
        logger.debug({ videoId, sceneIndex: inputScenes.indexOf(originalScene) }, "Creation: Searching for new videos.");
        const searchTerms =
          scene.searchTerms.filter(term => term.length >= 4).join(" ") || scene.searchTerms.join(" ");
        finalVideos = await this.videoSearch.findVideos(
          searchTerms,
          10,
          excludeVideoIds,
          orientation,
          this.processTextForTTS(scene.text).length,
        );
        // **CORREÇÃO DEFINITIVA: Salva as URLs na CÓPIA da cena.**
        scene.videos = finalVideos.map(v => v.url);
        finalVideos.forEach(video => video && excludeVideoIds.push(video.id));
      }

      const textParts = this.processTextForTTS(scene.text);
      if (finalVideos.length < textParts.length) {
        throw new Error(
          `Could not find enough videos for scene ${inputScenes.indexOf(originalScene)}. Found ${finalVideos.length}, needed ${textParts.length}.`,
        );
      }
      
      const sceneAudioData = await this.generateAudioForScene(videoId, scene, textParts, config);
      
      const sceneParts: Scene[] = [];
      for(let i = 0; i < textParts.length; i++) {
        const video = finalVideos[i];
        if (!video || !video.url) throw new Error(`No video for part ${i} of scene ${inputScenes.indexOf(originalScene)}`);
        
        // Validate audio duration
        const audioDuration = sceneAudioData[i].duration;
        if (!audioDuration || audioDuration <= 0 || isNaN(audioDuration)) {
          logger.error({ 
            videoId, 
            sceneIndex: inputScenes.indexOf(originalScene), 
            partIndex: i, 
            audioDuration,
            text: textParts[i]
          }, "Invalid audio duration detected");
          throw new Error(`Invalid audio duration for part ${i} of scene ${inputScenes.indexOf(originalScene)}: ${audioDuration}`);
        }
        
        sceneParts.push({
          id: cuid(),
          text: textParts[i],
          searchTerms: scene.searchTerms,
          duration: audioDuration,
          orientation,
          captions: sceneAudioData[i].captions,
          videos: [video.url],
          audio: { url: sceneAudioData[i].url, duration: audioDuration }
        });
      }
      remotionDataNested.push(sceneParts);
      // Adiciona a cena atualizada (com as URLs dos vídeos) à nova lista.
      newScriptScenes.push(scene);
    }

    // Calcula a duração total e encontra a música
    const totalDuration = remotionDataNested.flat().reduce((acc: number, s: any) => acc + s.duration, 0);
    const music = this.findMusic(totalDuration, config.music);

    // Cria o objeto remotionData com a estrutura correta desde o início
    const remotionData = {
      scenes: remotionDataNested.flat(),
      music,
      config: {
        ...config,
        durationMs: totalDuration * 1000,
      },
    };

    return {
      remotionData,
      updatedScriptScenes: newScriptScenes
    };
  }

  private async getCachedOrGenerateTTS(
    text: string,
    config: RenderConfig,
    forceRegenerate: boolean = false
  ): Promise<{ audioPath: string, duration: number, subtitles: any[] }> {
    const configHash = crypto.createHash('md5')
      .update(`${text}_${config.voice}_${config.language}_${config.referenceAudioPath}`)
      .digest('hex');
    
    const cachedAudioPath = path.join(this.globalConfig.tempDirPath, `${configHash}.wav`);

    if (!forceRegenerate && fs.existsSync(cachedAudioPath)) {
      try {
        const duration = await this.remotion.getMediaDuration(cachedAudioPath);
        logger.debug({ text, hash: configHash }, "TTS audio found in cache.");
        return { audioPath: cachedAudioPath, duration, subtitles: [] };
      } catch(e) {
        logger.warn({ text, path: cachedAudioPath, error: e }, "Found cached TTS file, but failed to get duration. Regenerating.")
      }
    }
    
    logger.debug({ text, hash: configHash }, "TTS audio not in cache. Generating...");
    const tempId = cuid();
    const tempWavPath = path.join(this.globalConfig.tempDirPath, `${tempId}.wav`);

    const result = await this.localTTS.generateSpeech(text, tempWavPath, config.voice, config.language, config.referenceAudioPath);
    
    fs.copyFileSync(result.audioPath, cachedAudioPath);

    return { ...result, audioPath: cachedAudioPath };
  }

  private async generateAudioForScene(
    videoId: string,
    scene: SceneInput,
    textParts: string[],
    config: RenderConfig
  ): Promise<{ url: string; duration: number; captions: Caption[] }[]> {
    const audioResults = [];
    const sceneAudio = scene.audio as any;

    if (sceneAudio && sceneAudio.url && sceneAudio.duration && sceneAudio.duration > 0) {
        logger.debug({ videoId }, "Using pre-existing single audio for entire scene.");
        
        // Validate pre-existing audio duration
        if (isNaN(sceneAudio.duration) || sceneAudio.duration <= 0) {
          logger.error({ videoId, sceneAudio }, "Pre-existing audio has invalid duration");
          throw new Error(`Pre-existing audio has invalid duration: ${sceneAudio.duration}`);
        }
        
        // Se já existe um áudio único, precisamos dividi-lo ou usá-lo para a primeira parte.
        // Por simplicidade, vamos atribuí-lo à primeira parte e gerar para as demais.
        audioResults.push({
            url: sceneAudio.url,
            duration: sceneAudio.duration,
            captions: scene.captions || []
        });
        // Preenche o resto com silêncio ou gera novos áudios. Gerar novos é mais seguro.
        for (let i = 1; i < textParts.length; i++) {
            const audioResult = await this.generateSingleAudioPart(textParts[i], config);
            audioResults.push(audioResult);
        }
    } else {
        // Gera áudio para cada parte do texto
        for (const part of textParts) {
            const audioResult = await this.generateSingleAudioPart(part, config);
            audioResults.push(audioResult);
        }
    }
    return audioResults;
  }

  private async generateSingleAudioPart(
    text: string,
    config: RenderConfig
  ): Promise<{ url: string, duration: number, captions: Caption[] }> {
    
    const audioResult = await this.getCachedOrGenerateTTS(text, config);
    
    const audioPath = this.ensureAbsoluteUrl(`/temp/${path.basename(audioResult.audioPath)}`);
    const captions = audioResult.subtitles.map((s: any) => ({ text: s.text, startMs: s.start, endMs: s.end }));
    
    if (audioResult.duration <= 0) throw new Error(`Invalid audio duration for text: "${text}".`);

    return { url: audioPath, duration: audioResult.duration, captions };
  }

  private splitTextIntoScenes(text: string): string[] {
    // Lógica simples e direta: quebra o texto pela pontuação.
    return text
      .trim()
      .split(/(?<=[.!?])\s+/)
      .filter(s => s);
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.globalConfig.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videosDir = path.join(this.globalConfig.videosDirPath);
    const filesToDelete = [
      path.join(videosDir, `${videoId}.mp4`),
      path.join(videosDir, `${videoId}.script.json`),
      path.join(videosDir, `${videoId}.json`)
    ];

    let deletedCount = 0;
    for (const filePath of filesToDelete) {
      if (fs.existsSync(filePath)) {
        try {
          fs.removeSync(filePath);
          deletedCount++;
          logger.info({ videoId, filePath }, "Deleted video file");
        } catch (error) {
          logger.error({ videoId, filePath, error }, "Error deleting video file");
        }
      }
    }

    // Remove da memória também
    this.creationQueue = this.creationQueue.filter(item => item.id !== videoId);
    
    logger.info({ videoId, deletedCount }, "Video deletion completed");
  }

  public clearAllVideos(): void {
    const videosDir = this.globalConfig.videosDirPath;
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir);
      for (const file of files) {
        fs.removeSync(path.join(videosDir, file));
      }
      logger.info("All video files have been cleared.");
    }
  }

  public getVideoData(videoId: string): any {
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${videoId}.script.json`);
    if (!fs.existsSync(scriptPath)) {
      return null;
    }
    return fs.readJsonSync(scriptPath);
  }

  public saveVideoData(videoId: string, data: any): void {
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${videoId}.script.json`);
    try {
      fs.writeJsonSync(scriptPath, data, { spaces: 2 });
      logger.info({ videoId }, "Successfully saved video data.");
    } catch (error) {
      logger.error({ videoId, error }, "Failed to save video data.");
      throw error;
    }
  }

  public async searchVideos(query: string): Promise<any> {
    logger.debug({ query }, "Searching videos");
    const searchResults = await this.videoSearch.findVideos(query, 25, [], OrientationEnum.portrait, 25);
    logger.debug({ query, count: searchResults.length }, "Found videos");
    return searchResults.map(v => ({
      ...v,
      // Garante que a URL do vídeo seja absoluta
      url: this.ensureAbsoluteUrl(v.url)
    }));
  }

  public async reRenderVideo(
    videoId: string,
    scenes: SceneInput[],
    config: RenderConfig,
  ): Promise<void> {
    logger.info({ videoId }, "[FIXED RE-RENDER] Starting clean re-render process.");

    // 1. Apaga o vídeo existente para garantir um processo limpo
    const existingVideoPath = this.getVideoPath(videoId);
    if (fs.existsSync(existingVideoPath)) {
      fs.removeSync(existingVideoPath);
      logger.info({ videoId }, "Deleted existing video file for clean re-render.");
    }

    // 2. Reseta o status para "processing"
    await this.statusManager.setStatus(videoId, "processing", "Starting re-render...");

    // 3. Reprocessa as cenas enviadas pelo editor.
    // Isso recalcula durações e legendas de forma segura no backend,
    // mas reutiliza as mídias (vídeos/áudios) existentes.
    const { remotionData, updatedScriptScenes } = await this.processScenes(videoId, scenes, config);

    // 4. Salva os dados reprocessados e seguros no .render.json para a renderização.
    const renderJsonPath = path.join(this.globalConfig.videosDirPath, `${videoId}.render.json`);
    fs.writeJsonSync(renderJsonPath, remotionData, { spaces: 2 });
    logger.info({ videoId }, ".render.json updated with sanitized, reprocessed data.");

    // 5. Salva as edições de texto do usuário no .script.json para persistência.
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${videoId}.script.json`);
    if (fs.existsSync(scriptPath)) {
      const scriptData = fs.readJsonSync(scriptPath);
      scriptData.scenes = updatedScriptScenes;
      scriptData.config = config;
      fs.writeJsonSync(scriptPath, scriptData, { spaces: 2 });
    }

    // 6. Adiciona o vídeo à fila de renderização pura.
    if (!this.renderQueue.includes(videoId)) {
      this.renderQueue.push(videoId);
    }
    this.processRenderQueue();
  }

  // Este método agora só renderiza. A preparação dos dados é feita antes.
  public async renderVideoFromData(videoId: string, videoData: any): Promise<void> {
    const { scenes, music, config } = videoData;

    try {
      const totalDurationSecs = scenes.reduce((acc: number, scene: any) => acc + scene.duration, 0);
      
      await this.remotion.renderMedia(
        videoId,
        { ...videoData, config: { ...config, durationInSec: totalDurationSecs } },
        (progress: number) => {
          logger.info(`Rendering progress: ${Math.round(progress * 100)}%`);
        },
      );
    } catch (error: any) {
      const duration = scenes.reduce((acc: number, s: any) => acc + s.duration, 0);
      logger.error({ error, videoId, scenes, duration }, "Error during video rendering");
      throw new Error(`Failed to render video: ${error.message || 'Unknown error'}`);
    }
  }

  public ListAvailableMusicTags(): MusicMoodEnum[] {
    return Object.values(MusicMoodEnum);
  }

  public ListAvailableVoices(): VoiceEnum[] {
    return Object.values(VoiceEnum);
  }

  public async getAllVideos(): Promise<any[]> {
    const videoDir = this.globalConfig.videosDirPath;
    if (!fs.existsSync(videoDir)) {
      return [];
    }

    const files = fs.readdirSync(videoDir);
    const videoScripts = files.filter(file => file.endsWith('.script.json'));

    const videos = await Promise.all(
      videoScripts.map(async (file) => {
        try {
          const filePath = path.join(videoDir, file);
          const data = fs.readJsonSync(filePath);
          
          // O ID está no nome do arquivo ou no JSON.
          const id = data.id || file.replace('.script.json', '');

          // Pega o status mais recente do gerenciador de status.
          const statusInfo = await this.statusManager.getStatus(id);

          return {
            id: id,
            createdAt: data.createdAt,
            status: statusInfo.status || 'unknown',
            error: statusInfo.error,
            // Adiciona um thumbnail se o vídeo estiver pronto.
            thumbnail: statusInfo.status === 'ready' ? `/videos/${id}.mp4` : null,
          };
        } catch (error) {
          logger.error({ file, error }, "Failed to process video script file");
          return null;
        }
      })
    );

    // Filtra nulos e ordena pelos mais recentes
    return videos
      .filter(v => v !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getVideoById(id: string): any | null {
    const renderJsonPath = path.join(this.globalConfig.videosDirPath, `${id}.render.json`);
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${id}.script.json`);
    const legacyJsonPath = path.join(this.globalConfig.dataDirPath, `${id}.json`);
    const legacyScriptPath = path.join(this.globalConfig.dataDirPath, `${id}.script.json`);

    // Prioriza o render.json, que tem os dados mais completos para edição.
    if (fs.existsSync(renderJsonPath)) {
      logger.debug({ videoId: id }, "Serving .render.json for editor.");
      return fs.readJsonSync(renderJsonPath);
    }
    
    // Se não houver render.json, usa o script.json como fallback.
    if (fs.existsSync(scriptPath)) {
      logger.debug({ videoId: id }, "Serving .script.json as fallback for editor.");
      return fs.readJsonSync(scriptPath);
    }

    // Fallback para os caminhos antigos
    if (fs.existsSync(legacyJsonPath)) {
      logger.warn({ id }, "Serving legacy .json file from data directory");
      return fs.readJsonSync(legacyJsonPath);
    }
    
    if (fs.existsSync(legacyScriptPath)) {
      logger.warn({ id }, "Serving legacy .script.json file from data directory");
      return fs.readJsonSync(legacyScriptPath);
    }

    logger.warn({ videoId: id }, "No data file found for video.");
    return null;
  }

  public getScriptById(id: string) {
    const scriptPath = path.join(this.globalConfig.videosDirPath, `${id}.script.json`);
    const legacyScriptPath = path.join(this.globalConfig.dataDirPath, `${id}.script.json`);

    if (fs.existsSync(scriptPath)) {
      const data = fs.readFileSync(scriptPath, "utf-8");
      return JSON.parse(data);
    }

    if (fs.existsSync(legacyScriptPath)) {
      logger.warn({ id }, "Serving legacy .script.json file from data directory for getScriptById");
      const data = fs.readFileSync(legacyScriptPath, "utf-8");
      return JSON.parse(data);
    }

    return null;
  }

  // =================================================================
  // == FLUXO DE RENDERIZAÇÃO PURO (Render.json -> Render)
  // =================================================================

  private async processRenderQueue(): Promise<void> {
    if (this.isProcessingRender || this.renderQueue.length === 0) return;
    this.isProcessingRender = true;

    const videoId = this.renderQueue.shift();
    if (!videoId) {
      this.isProcessingRender = false;
      return;
    }

    try {
      await this.renderFromRenderJson(videoId);
    } catch (error) {
      logger.error({ videoId, error }, "Error in render queue");
    } finally {
      this.isProcessingRender = false;
      this.processRenderQueue();
    }
  }

  private async renderFromRenderJson(videoId: string): Promise<void> {
    logger.info({ videoId }, "Starting pure render from .render.json");
    await this.statusManager.setStatus(videoId, "processing", "Rendering video...", 0, "Initializing");
    
    const renderJsonPath = path.join(this.globalConfig.videosDirPath, `${videoId}.render.json`);
    if (!fs.existsSync(renderJsonPath)) {
      throw new Error(`.render.json not found for ${videoId}`);
    }
    
    const renderData = fs.readJsonSync(renderJsonPath);

    // Debug logs para verificar os dados
    logger.debug({ videoId, renderData }, "Render data loaded from .render.json");
    
    // Verificar durações das cenas
    if (renderData.scenes) {
      renderData.scenes.forEach((scene: any, index: number) => {
        logger.debug({ 
          videoId, 
          sceneIndex: index, 
          sceneId: scene.id,
          audioDuration: scene.audio?.duration,
          audioUrl: scene.audio?.url 
        }, "Scene audio data");
      });
    }

    try {
      await this.remotion.renderMedia(videoId, renderData, (progress) => {
        const progressPercent = Math.round(progress * 100);
        const stage = progress < 0.2 ? "Initializing" : 
                     progress < 0.5 ? "Processing frames" :
                     progress < 0.8 ? "Encoding video" : "Finalizing";
        
        this.statusManager.setProgress(videoId, progressPercent, stage);
      });
      
      await this.statusManager.setStatus(videoId, "ready", "Video rendered successfully", 100, "Completed");
    } catch (error: any) {
      await this.statusManager.setError(videoId, error.message);
      throw error;
    }
  }

  // =================================================================
  // == MÉTODOS AUXILIARES E PONTOS DE ENTRADA
  // =================================================================

  public async generateSingleTTSAndUpdate(videoId: string, sceneId: string, text: string, config: RenderConfig, forceRegenerate: boolean = false) {
      const audioResult = await this.getCachedOrGenerateTTS(text, config, forceRegenerate);
      const audioUrl = this.ensureAbsoluteUrl(`/temp/${path.basename(audioResult.audioPath)}`);

      const renderJsonPath = path.join(this.globalConfig.videosDirPath, `${videoId}.render.json`);
      if(fs.existsSync(renderJsonPath)) {
          const renderData = fs.readJsonSync(renderJsonPath);
          const scene = renderData.scenes.find((s: any) => s.id === sceneId);
          if (scene) {
              scene.audio = { url: audioUrl, duration: audioResult.duration };
              scene.captions = audioResult.subtitles;
              fs.writeJsonSync(renderJsonPath, renderData, { spaces: 2 });
          }
      }
      return { audioUrl, duration: audioResult.duration, subtitles: audioResult.subtitles };
  }

  private findMusic(duration: number, mood?: MusicTag): MusicForVideo {
    logger.debug({ duration, mood }, "Finding suitable music.");
    
    // Obtém a lista de músicas do MusicManager
    const availableMusic = this.musicManager.musicList();
    
    // Filtra músicas pelo mood especificado
    const musicForMood = mood 
      ? availableMusic.filter(m => m.mood === mood)
      : availableMusic;
    
    if (musicForMood.length === 0) {
      logger.warn({ mood }, "No music found for mood, using any available music");
      return availableMusic[0];
    }
    
    // Seleciona uma música aleatória do mood apropriado
    const randomIndex = Math.floor(Math.random() * musicForMood.length);
    const selectedMusic = musicForMood[randomIndex];
    
    // Ajusta o end time para a duração do vídeo se necessário
    const adjustedMusic = {
      ...selectedMusic,
      end: Math.min(selectedMusic.end, duration)
    };
    
    logger.debug({ 
      selectedFile: selectedMusic.file, 
      mood: selectedMusic.mood, 
      duration: adjustedMusic.end 
    }, "Music selected successfully");
    
    return adjustedMusic;
  }
}