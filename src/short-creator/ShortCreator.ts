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
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
  }[] = [];
  private videoSearch: VideoSearch;
  private threadPool: ThreadPool;
  private outputDir: string;

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
    const videoPath = this.getVideoPath(id);
    const queueItem = this.queue.find((item) => item.id === id);
    
    if (queueItem) {
      if (queueItem.status === "completed") {
        return "ready";
      }
      if (queueItem.status === "failed") {
        return "failed";
      }
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

    // Process scenes sequentially to maintain video exclusion
    for (let index = 0; index < inputScenes.length; index++) {
      const scene = inputScenes[index];
      // Split text into two parts if possible
      const textParts = this.splitTextIntoTwoParts(scene.text);

      // Se a cena foi dividida, fazemos apenas uma busca de vídeo
      let video: Video;
      if (textParts.length > 1) {
        const videoResult = await this.videoSearch.findVideo(
          scene.searchTerms,
          10, // Initial duration estimate
          excludeVideoIds,
          orientation
        );
        video = {
          ...videoResult,
          width: orientation === OrientationEnum.portrait ? 1080 : 1920,
          height: orientation === OrientationEnum.portrait ? 1920 : 1080
        };
        excludeVideoIds.push(video.id);
      }

      for (const part of textParts) {
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
        const referenceAudioPath = config.referenceAudioPath || this.globalConfig.referenceAudioPath;
        
        // Generate audio and search for video in parallel
        const [audioResult, sceneVideo] = await Promise.all([
          (async () => {
            const sceneText = cleanSceneText(part);
            const phrases = splitTextByPunctuation(sceneText);
            
            logger.info("🎙️ Preparando para gerar áudio com TTS", {
              sceneText,
              phrases,
              tempWavPath,
              emotion,
              language: config.language,
              referenceAudioPath,
            });

            // Garanta que phraseAudioFiles é inicializado aqui, dentro do loop da cena
            const phraseAudioFiles: string[] = [];
            const silencePath = path.join(this.globalConfig.dataDirPath, "silence-1s.wav");

            // Garante que o arquivo de silêncio existe
            if (!fs.existsSync(silencePath)) {
              logger.info("[TTS] Gerando arquivo de silêncio de 1s");
              execSync(`ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 -q:a 9 -acodec pcm_s16le "${silencePath}" -y`);
            }

            for (let i = 0; i < phrases.length; i++) {
              let phrase = phrases[i]
                .replace(/["']/g, '') // Remove aspas
                .replace(/\.+$/, '') // Remove múltiplos pontos no final
                .replace(/\.(?=\s*[.!?])/g, '') // Remove pontos antes de outros sinais de pontuação
                .trim(); // Remove espaços extras
              
              logger.info(`[TTS] Cena ${index}, frase ${i}: ${phrase}`, { sceneIndex: index, phraseIndex: i, phrase });
              const phraseTempId = cuid();
              const phraseWavPath = path.join(this.globalConfig.tempDirPath, `${phraseTempId}.wav`);
              tempFiles.push(phraseWavPath);

              await this.localTTS.generateSpeech(
                phrase,
                phraseWavPath,
                emotion,
                config.language,
                referenceAudioPath
              );

              phraseAudioFiles.push(phraseWavPath);
              // Adiciona 1s de silêncio entre frases, exceto após a última
              if (i < phrases.length - 1) {
                phraseAudioFiles.push(silencePath);
              }
            }

            // Unir os áudios das frases
            await this.ffmpeg.concatAudioFiles(phraseAudioFiles, tempWavPath);
            
            logger.info({ tempWavPath }, "✅ Áudio gerado com sucesso, lendo arquivo");
            const audioBuffer = await fs.readFile(tempWavPath);
            const audioLength = await this.ffmpeg.getAudioDuration(tempWavPath);
            
            return {
              audioLength,
              tempWavFileName: tempWavFileName
            };
          })(),
          // Se a cena não foi dividida, fazemos a busca de vídeo aqui
          textParts.length === 1 ? this.videoSearch.findVideo(
            scene.searchTerms,
            10, // Initial duration estimate
            excludeVideoIds,
            orientation
          ) : Promise.resolve(video!)
        ]);

        let { audioLength } = audioResult;
        if (index + 1 === inputScenes.length && config.paddingBack) {
          audioLength += config.paddingBack / 1000;
        }

        const sceneText = cleanSceneText(part);
        const phrases = splitTextByPunctuation(sceneText);
        
        // Calcule o tempo de silêncio total entre frases
        const silenceBetweenPhrases = 1; // segundos
        const numSilences = phrases.length - 1;
        const totalSilence = numSilences * silenceBetweenPhrases;
        
        // Calcule o tempo de áudio falado (sem silêncios)
        const spokenAudioLength = audioLength - totalSilence;

        // Legendas palavra por palavra
        const words = part.split(" ");
        const wordCount = words.length;
        
        // Calcula o tempo base para cada palavra (em milissegundos)
        const baseWordDuration = (spokenAudioLength * 1000) / wordCount;
        
        // Ajusta o tempo base para palavras mais longas ou mais curtas
        let currentTime = 0;
        const captions: Caption[] = words.map((word, i) => {
          // Ajusta o tempo base baseado no tamanho da palavra
          const wordLength = word.length;
          // Ajusta o multiplicador para dar mais tempo para palavras mais longas
          const durationMultiplier = Math.max(0.7, Math.min(2.0, wordLength / 4));
          const wordDuration = baseWordDuration * durationMultiplier;
          
          // Calcula o tempo de início e fim
          const startMs = currentTime;
          currentTime += wordDuration;
          
          // Adiciona uma pequena pausa após pontuação
          if (/[.,!?]$/.test(word)) {
            currentTime += 200; // 200ms de pausa após pontuação
          }
          
          return {
            text: word + (i < words.length - 1 ? " " : ""),
            startMs,
            endMs: currentTime,
            emotion: emotion as "question" | "exclamation" | "neutral"
          };
        });

        // Ajusta o tempo final para garantir que as legendas terminem junto com o áudio
        const totalCaptionDuration = captions[captions.length - 1].endMs;
        const timeAdjustment = (audioLength * 1000) - totalCaptionDuration;
        
        if (timeAdjustment !== 0) {
          const adjustmentPerWord = timeAdjustment / wordCount;
          captions.forEach((caption, i) => {
            caption.startMs += adjustmentPerWord * i;
            caption.endMs += adjustmentPerWord * (i + 1);
          });
        }

        totalDuration += audioLength;
        if (textParts.length === 1) {
          excludeVideoIds.push(sceneVideo.id);
        }

        scenes.push({
          id: tempId,
          text: part,
          searchTerms: scene.searchTerms,
          duration: audioLength,
          orientation,
          captions: captions,
          videos: [this.ensureAbsoluteUrl(sceneVideo.url)],
          audio: {
            url: this.ensureAbsoluteUrl(`/api/tmp/${audioResult.tempWavFileName}`),
            duration: audioLength,
          }
        });
      }
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

    await this.remotion.render(
      {
        music: {
          ...selectedMusic,
        },
        scenes,
        config: {
          durationMs: totalDuration * 1000,
          paddingBack: (config.paddingBack || 0) + (extraPadding * 1000), // Adiciona 2 segundos ao padding
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

    // Clean up temp files
    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  private splitTextIntoTwoParts(text: string): string[] {
    // Remove espaços extras e pontuação no final
    text = text.trim().replace(/[.!?]+$/, '');
    
    // Procura por pontuação de fim de frase
    const match = text.match(/[.!?:](?=\s+)/);
    
    if (match) {
      const splitIndex = match.index! + 1;
      const firstPart = text.substring(0, splitIndex).trim();
      const secondPart = text.substring(splitIndex).trim();
      
      // Verifica se a segunda parte tem pelo menos 10 caracteres
      // e se não é apenas uma palavra curta
      if (secondPart.length >= 10 && secondPart.split(/\s+/).length > 1) {
        return [firstPart, secondPart];
      }
    }
    
    // Se não encontrou um bom ponto para dividir ou a segunda parte é muito curta,
    // retorna o texto original como uma única parte
    return [text];
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

  public async getVideo(videoId: string): Promise<Buffer> {
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
}
