import { OrientationEnum, MusicMoodEnum, VoiceEnum, Video, ShortResult, AudioResult, SceneInput, RenderConfig, Scene, MusicTag, MusicForVideo, Caption, ShortQueue } from "../types/shorts";
import fs from "fs-extra";
import { promises as fsPromises } from "fs";
import cuid from "cuid";
import path from "path";
import { execSync, spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";

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
import { VideoStatus, VideoStatusManager } from "./VideoStatusManager";

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
  private videoData: Map<string, any> = new Map();

  constructor(
    private globalConfig: Config,
    private remotion: Remotion,
    private ffmpeg: FFMpeg,
    private localImageApi: LocalImageAPI,
    private musicManager: MusicManager,
    private localTTS: LocalTTS,
    private statusManager: VideoStatusManager,
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
  private ensureAbsoluteUrl(url: string | undefined | null): string {
    if (!url) {
      throw new Error("URL cannot be undefined or null");
    }
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:${this.globalConfig.port}${url}`;
  }

  public async status(id: string): Promise<VideoStatus> {
    const status = await this.statusManager.getStatus(id);
    if (status && status !== 'pending') { // Don't return pending if file exists
      return status;
    }
    // Fallback for videos created before this change
    if (fs.existsSync(this.getVideoPath(id))) {
      await this.statusManager.setStatus(id, "ready");
      return "ready";
    }
    return "failed"; // Or a more appropriate default status
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
    this.statusManager.setStatus(id, "processing"); // Set initial status

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
      this.statusManager.setStatus(queueItem.id, "processing");
      logger.debug(
        { sceneInput: queueItem.sceneInput, config: queueItem.config, id: queueItem.id },
        "Processing video item in the queue",
      );
      try {
        await this.createShort(queueItem.id, queueItem.sceneInput, queueItem.config);
        queueItem.status = "completed";
        this.statusManager.setStatus(queueItem.id, "ready");
        logger.debug({ id: queueItem.id }, "Video created successfully");
      } catch (error: unknown) {
        queueItem.status = "failed";
        this.statusManager.setStatus(queueItem.id, "failed");
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

    const videoPromises = inputScenes.map(async (scene, sceneIndex) => {
      const sceneStartTime = Date.now();
      logger.debug({ videoId, sceneIndex }, "Processing scene video search");

      const textParts = this.splitTextIntoScenes(scene.text);
      let finalVideos: any[] = [];

      // Se os vídeos já foram fornecidos (re-renderização), use-os
      if (scene.videos && scene.videos.length > 0) {
        logger.debug({ videoId, sceneIndex }, "Using pre-defined videos for scene");
        // Precisamos buscar as informações completas de cada vídeo
        finalVideos = await Promise.all(
          scene.videos.map(videoUrl => this.videoSearch.getVideoByUrl(videoUrl))
        );
      } else {
        // Senão, busca por novos vídeos
        logger.debug({ videoId, sceneIndex }, "Searching for new videos for scene");
        const filteredTerms = scene.searchTerms.filter(term => term.length >= 4).join(" ");
        const searchTerms = filteredTerms.length > 0 ? filteredTerms : scene.searchTerms.join(" ");
        
        const searchResults = await this.videoSearch.findVideos(
          searchTerms,
          10,
          excludeVideoIds,
          orientation,
          textParts.length
        );
        
        if (searchResults.length === 0) {
          throw new Error(`No videos found for scene ${sceneIndex} with search terms: ${searchTerms}`);
        }
        
        for (let i = 0; i < textParts.length; i++) {
          finalVideos.push(searchResults[i % searchResults.length]);
        }
        searchResults.forEach(video => excludeVideoIds.push(video.id));
      }

      const sceneEndTime = Date.now();
      logger.debug({ 
        videoId, 
        sceneIndex, 
        duration: sceneEndTime - sceneStartTime,
        videosFound: finalVideos.length,
        videosNeeded: textParts.length
      }, "Scene video search completed");

      return { scene, videos: finalVideos, textParts };
    });

    // Aguarda todas as buscas de vídeo
    const videoResults = await Promise.all(videoPromises);
    const videoSearchEnd = Date.now();
    logger.info({ 
      videoId, 
      duration: videoSearchEnd - startTime,
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
            
            if (!video || !video.url) {
              throw new Error(`No video available for part ${i} of scene ${sceneIndex}`);
            }

            let audioPath: string;
            let audioDuration: number;
            let captions: Caption[] = scene.captions || [];

            if (scene.audio && scene.audio.url && scene.audio.duration) {
              logger.debug({ videoId, sceneIndex }, "Using pre-existing audio for scene");
              audioPath = scene.audio.url;
              audioDuration = scene.audio.duration;
            } else {
              logger.debug({ videoId, sceneIndex }, "Generating new audio for scene part");
              const tempId = cuid();
              const tempWavFileName = `${tempId}.wav`;
              const tempWavPath = path.join(this.globalConfig.tempDirPath, tempWavFileName);
              tempFiles.push(tempWavPath);

              const audioResult = await this.localTTS.generateSpeech(part, tempWavPath, config.voice, config.language, config.referenceAudioPath);
              tempFiles.push(audioResult.audioPath);
              
              // Constrói a URL para o arquivo de áudio
              audioPath = `${this.ensureAbsoluteUrl('/temp/')}${path.basename(audioResult.audioPath)}`;
              audioDuration = audioResult.duration; 
              captions = audioResult.subtitles.map((s: any) => ({ text: s.text, startMs: s.start, endMs: s.end }));
              
              if (audioDuration <= 0) {
                throw new Error(`Generated audio for scene part has an invalid duration of ${audioDuration} seconds.`);
              }

              logger.debug({ videoId, sceneIndex, audioDuration }, "Audio generated successfully for scene part");
            }
            
            totalDuration += audioDuration;
            
            const finalScene: Scene = {
              id: cuid(),
              text: part,
              searchTerms: scene.searchTerms,
              duration: audioDuration,
              orientation: orientation,
              captions: captions,
              videos: [video.url],
              audio: {
                url: audioPath,
                duration: audioDuration
              }
            };
            
            sceneResults.push(finalScene);

            const partEndTime = Date.now();
            logger.debug({ 
              videoId, 
              sceneIndex,
              partIndex: i,
              duration: partEndTime - partStartTime 
            }, "Part processing completed");
          }
        } catch (error) {
          logger.error({ error, videoId, sceneIndex }, "Error processing part of scene");
          throw error;
        }

        const sceneEndTime = Date.now();
        logger.debug({ 
          videoId, 
          sceneIndex, 
          duration: sceneEndTime - sceneStartTime,
          sceneResultsCount: sceneResults.length
        }, "Scene processing completed");
        
        return sceneResults;
      });

      const processedScenesNested = await Promise.all(scenePromises);
      scenes.push(...processedScenesNested.flat());

      const sceneProcessingEnd = Date.now();
      logger.info({ 
        videoId, 
        duration: sceneProcessingEnd - sceneProcessingStart,
        scenesCount: scenes.length 
      }, "Scene processing phase completed");
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
      const music = this.findMusic(totalDuration, config.music);
      const videoData = { scenes, music, config };

      // Salva os dados completos que serão usados para a renderização
      fs.writeFileSync(path.join(this.outputDir, `${videoId}.json`), JSON.stringify(videoData, null, 2));

      await this.renderVideoFromData(videoId);
      
    } catch (error) {
      logger.error({ error, videoId }, "Error during createShort preparation phase");
      this.statusManager.setStatus(videoId, "failed");
      throw error;
    }

    const renderEnd = Date.now();
    logger.info({ 
      videoId, 
      duration: renderEnd - renderStart 
    }, "Video rendering phase completed");

    const endTime = Date.now();
    logger.info({ videoId, duration: endTime - startTime }, "Video creation process finished");

    return videoId;
  }

  private splitTextIntoScenes(text: string): string[] {
    // Limpa e divide o texto em sentenças
    const sentences = text.trim().replace(/(\\r\\n|\\n|\\r)/gm, " ").split(/(?<=[.!?])\\s+/).filter(s => s);

    if (sentences.length <= 1) {
      return sentences;
    }

    const MIN_WORDS_PER_SCENE = 5;
    const parts: string[] = [];
    let currentPart = "";

    for (const sentence of sentences) {
      // Se a parte atual está vazia, começa com a nova sentença
      if (currentPart === "") {
        currentPart = sentence;
      } else {
        // Se a parte atual é muito curta, anexa a nova sentença
        if (currentPart.split(/\\s+/).length < MIN_WORDS_PER_SCENE) {
          currentPart += ` ${sentence}`;
        } else {
          // Senão, a parte atual tem tamanho suficiente. Salva e começa uma nova.
          parts.push(currentPart);
          currentPart = sentence;
        }
      }
    }

    // Adiciona a última parte que sobrou
    if (currentPart) {
      parts.push(currentPart);
    }

    return parts;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.globalConfig.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public clearAllVideos(): void {
    const videosDir = this.globalConfig.videosDirPath;
    if (!fs.existsSync(videosDir)) {
      logger.info("Videos directory does not exist, nothing to clear");
      return;
    }

    const files = fs.readdirSync(videosDir);
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    const metadataFiles = files.filter(file => 
      file.endsWith('.json') || file.endsWith('.jsx') || file.endsWith('.tsx')
    );

    logger.info({ 
      videoFilesCount: videoFiles.length, 
      metadataFilesCount: metadataFiles.length 
    }, "Clearing all videos");

    // Deletar arquivos de vídeo
    for (const file of videoFiles) {
      const filePath = path.join(videosDir, file);
      fs.removeSync(filePath);
      logger.debug({ file }, "Deleted video file");
    }

    // Deletar arquivos de metadados
    for (const file of metadataFiles) {
      const filePath = path.join(videosDir, file);
      fs.removeSync(filePath);
      logger.debug({ file }, "Deleted metadata file");
    }

    // Limpar diretório temporário
    const tempDir = this.globalConfig.tempDirPath;
    if (fs.existsSync(tempDir)) {
      fs.emptyDirSync(tempDir);
      logger.debug("Cleared temp directory");
    }

    // Limpar fila e processamento
    this.queue = [];
    this.processingVideos.clear();

    logger.info("All videos cleared successfully");
  }

  public getVideoData(videoId: string): any {
    const videoDataPath = path.join(this.globalConfig.videosDirPath, `${videoId}.json`);
    if (!fs.existsSync(videoDataPath)) {
      throw new Error('Video data not found');
    }

    const jsonContent = fs.readFileSync(videoDataPath, 'utf-8');
    return JSON.parse(jsonContent);
  }

  public saveVideoData(videoId: string, data: any): void {
    const jsonPath = path.join(this.globalConfig.videosDirPath, `${videoId}.json`);
    const jsxPath = path.join(this.globalConfig.videosDirPath, `${videoId}.jsx`);
    const tsxPath = path.join(this.globalConfig.videosDirPath, `${videoId}.tsx`);

    // Salva o JSON
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

    // Atualiza os arquivos JSX e TSX (simplificado - em produção você pode querer regenerar completamente)
    logger.info({ videoId }, "Video data saved successfully");
  }

  public async searchVideos(query: string, count: number = 10): Promise<any[]> {
    try {
      const videos = await this.videoSearch.findVideos(
        query,
        10, // duration estimate
        [], // excludeIds
        OrientationEnum.portrait,
        count
      );
      return videos;
    } catch (error) {
      logger.error({ error, query }, "Error searching videos");
      return [];
    }
  }

  public async reRenderVideo(videoId: string): Promise<void> {
    logger.info({ videoId }, "Spawning re-render worker");
    await this.statusManager.setStatus(videoId, "processing");

    const scriptPath = path.resolve(__dirname, "../../scripts/render-video.ts");
    
    // Usa 'npx' para garantir que o ts-node local seja usado
    const child = spawn('npx', ['ts-node', scriptPath, videoId], {
      detached: true, // Permite que o processo filho continue se o pai morrer
      stdio: 'pipe' // Redireciona stdio para que possamos logar
    });

    child.stdout.on('data', (data) => {
      logger.info(`Render worker [${videoId}] stdout: ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      logger.error(`Render worker [${videoId}] stderr: ${data.toString().trim()}`);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        logger.error({ videoId, exitCode: code }, "Render worker exited with error");
        this.statusManager.setStatus(videoId, "failed");
      } else {
        logger.info({ videoId }, "Render worker finished successfully");
        // O status será atualizado para "ready" pelo polling quando o arquivo for encontrado
      }
    });

    child.unref(); // Desvincula o processo filho do pai
  }

  // Novo método para conter a lógica de renderização
  public async renderVideoFromData(videoId: string): Promise<void> {
    const videoData = this.getVideoData(videoId);
    const { scenes, music, config } = videoData;

    try {
      // Calcula a duração total em milissegundos
      const totalDurationMs = scenes.reduce((acc: number, scene: any) => acc + (scene.duration * 1000), 0);
      
      // Estrutura os dados no formato esperado pelo Remotion
      const remotionData = {
        scenes: scenes.map((scene: any) => ({
          videos: scene.videos,
          captions: scene.captions || [],
          audio: {
            url: scene.audio.url,
            duration: scene.duration
          }
        })),
        music: {
          file: music.file,
          url: music.url,
          start: music.start,
          end: music.end,
          mood: music.mood,
          loop: music.loop
        },
        config: {
          ...config,
          durationMs: totalDurationMs
        }
      };

      await this.remotion.renderMedia(
        videoId,
        remotionData,
        (progress: number) => {
          logger.info(`Rendering progress: ${Math.round(progress * 100)}%`);
        },
      );
      await this.statusManager.setStatus(videoId, "ready");
    } catch (error: any) {
      const duration = scenes.reduce((acc: number, s: any) => acc + s.duration, 0)
      logger.error({ error, videoId, scenes, duration }, "Error during video rendering");
      await this.statusManager.setStatus(videoId, "failed");
      throw new Error(`Failed to render video: ${error.message || 'Unknown error'}`);
    }
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

  public async listAllVideos(): Promise<{ id: string, status: VideoStatus }[]> {
    const videosDir = this.globalConfig.videosDirPath;
    if (!fs.existsSync(videosDir)) {
      return [];
    }
    
    const videoIds = fs.readdirSync(videosDir)
      .filter(file => file.endsWith('.mp4') || file.endsWith('.json'))
      .map(file => file.replace('.mp4', '').replace('.json', ''))
      // Unique IDs
      .filter((id, index, self) => self.indexOf(id) === index);
  
    const videoStatuses = await Promise.all(
      videoIds.map(async (id) => {
        const status = await this.status(id);
        return { id, status };
      })
    );

    return videoStatuses;
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
    const videoPath = this.getVideoPath(id);
    
    // First, check if video is being processed
    const processingVideo = this.processingVideos.get(id);
    if (processingVideo) {
      logger.debug({ videoId: id }, "Video is currently being processed, returning cached data.");
      return processingVideo;
    }

    try {
      await fsPromises.access(videoPath);
    } catch (error) {
      logger.error({ videoId: id, path: videoPath }, "Video file not found for ffprobe, cannot get info.");
      throw new Error(`Video file does not exist at path: ${videoPath}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err: any, metadata: ffmpeg.FfprobeData) => {
        if (err) {
          logger.error({ videoId: id, error: err }, "Error getting video metadata with ffprobe");
          reject(err);
          return;
        }

        const stream = metadata.streams.find(s => s.codec_type === 'video');
        if (!stream || !stream.width || !stream.height || !stream.duration) {
          logger.error({ videoId: id, metadata }, "Video stream metadata is incomplete");
          reject(new Error("Incomplete video stream data"));
          return;
        }
        
        const video: Video = {
          id,
          url: videoPath,
          width: stream.width,
          height: stream.height,
          duration: parseFloat(stream.duration),
        };
        resolve(video);
      });
    });
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

  public get(id: string): Video | undefined {
    return this.processingVideos.get(id);
  }
}
