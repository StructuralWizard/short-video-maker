import z from "zod";

export enum MusicMoodEnum {
  sad = "sad",
  melancholic = "melancholic",
  happy = "happy",
  euphoric = "euphoric/high",
  excited = "excited",
  chill = "chill",
  uneasy = "uneasy",
  angry = "angry",
  dark = "dark",
  hopeful = "hopeful",
  contemplative = "contemplative",
  funny = "funny/quirky",
  inspirational = "inspirational",
  cinematic = "cinematic",
  worship = "worship",
}

export enum CaptionPositionEnum {
  top = "top",
  center = "center",
  bottom = "bottom",
}

export interface Scene {
  id: string;
  text: string;
  searchTerms: string[];
  duration: number;
  orientation: OrientationEnum;
  captions: Caption[];
  videos: string[];
  audio: {
    url: string;
    duration: number;
  };
}

export const sceneInput = z.object({
  text: z.string().describe("Text to be spoken in the video"),
  searchTerms: z
    .array(z.string())
    .describe(
      "Search term for video, 1 word, and at least 2-3 search terms should be provided for each scene. Make sure to match the overall context with the word - regardless what the video search result would be.",
    ),
  videos: z.array(z.string()).optional().describe("Pre-defined video URLs to be used for the scene, bypassing search."),
  audio: z.object({ url: z.string(), duration: z.number() }).optional().describe("Pre-defined audio to be used for the scene, bypassing TTS."),
  captions: z.array(z.any()).optional().describe("Pre-defined captions for the scene."),
});
export type SceneInput = z.infer<typeof sceneInput>;

export enum VoiceEnum {
  Paulo = "Paulo",
  Noel = "Noel", 
  Hamilton = "Hamilton",
  Ines = "Ines",
  Pilar = "Pilar",
  Charlotte = "Charlotte",
}

export enum OrientationEnum {
  portrait = "portrait",
  landscape = "landscape",
  square = "square"
}

export enum MusicVolumeEnum {
  muted = "muted",
  low = "low",
  medium = "medium",
  high = "high",
}

export const renderConfig = z.object({
  paddingBack: z
    .number()
    .optional()
    .describe(
      "For how long the video should be playing after the speech is done, in milliseconds. 1500 is a good value.",
    ),
  music: z
    .nativeEnum(MusicMoodEnum)
    .optional()
    .describe("Music tag to be used to find the right music for the video"),
  captionPosition: z
    .nativeEnum(CaptionPositionEnum)
    .optional()
    .describe("Position of the caption in the video"),
  captionBackgroundColor: z
    .string()
    .optional()
    .describe(
      "Background color of the caption, a valid css color, default is blue",
    ),
  captionTextColor: z
    .string()
    .optional()
    .describe(
      "Text color of the caption, a valid css color, default is white",
    ),
  voice: z
    .nativeEnum(VoiceEnum)
    .optional()
    .describe("Voice to be used for the speech, default is Paulo"),
  orientation: z
    .nativeEnum(OrientationEnum)
    .optional()
    .describe("Orientation of the video, default is portrait"),
  musicVolume: z
    .nativeEnum(MusicVolumeEnum)
    .optional()
    .describe("Volume of the music, default is high"),
  language: z.enum(["pt", "en", "es"]).default("pt").describe("Language for text-to-speech"),
  referenceAudioPath: z.string().optional().describe("Path to reference audio file for TTS"),
  overlay: z.string().optional().describe("Name of the overlay image file (without extension) from static/overlays directory"),
  port: z.number().optional().describe("Port number for the server"),
  hook: z.string().optional().describe("Text to be displayed in the first frame of the video"),
});
export type RenderConfig = z.infer<typeof renderConfig>;

export type Voices = `${VoiceEnum}`;

export interface Video {
  id: string;
  url: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: string; // Preview image URL for better thumbnails
  status?: "pending" | "processing" | "completed" | "failed";
  sceneInput?: SceneInput[];
  config?: RenderConfig;
}

export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  emotion?: "question" | "exclamation" | "neutral";
};

export type CaptionLine = {
  texts: Caption[];
};
export type CaptionPage = {
  startMs: number;
  endMs: number;
  lines: CaptionLine[];
};

export const createShortInput = z.object({
  scenes: z.array(sceneInput).describe("Each scene to be created"),
  config: renderConfig.describe("Configuration for rendering the video"),
});
export type CreateShortInput = z.infer<typeof createShortInput>;

export type RenderRequest = CreateShortInput & {
  id?: string; // Para edição de vídeos existentes
};

export type Music = {
  file: string;
  start: number;
  end: number;
  mood: string;
};
export type MusicForVideo = Music & {
  url: string;
  fadeOut?: boolean;
  fadeOutDuration?: number;
  loop?: boolean;
};

export type MusicTag = `${MusicMoodEnum}`;

export type kokoroModelPrecision = "fp32" | "fp16" | "q8" | "q4" | "q4f16";

export interface AudioResult {
  audioPath: string;
  subtitles: Subtitle[];
}

export interface Subtitle {
  text: string;
  start: number;
  end: number;
}

export interface ShortResult {
  id: string;
  videoPath: string;
  scenes: Scene[];
  audioResults: AudioResult[];
}

export interface ShortQueue {
  items: {
    id: string;
    scenes: Scene[];
  }[];
}

export enum AvailableComponentsEnum {
  PortraitVideo = "ShortVideo",
  LandscapeVideo = "LandscapeVideo",
}

export type OrientationConfig = {
  width: number;
  height: number;
  component: AvailableComponentsEnum;
};

export type VideoConfig = {
  durationMs: number;
  paddingBack: number;
  captionBackgroundColor: string;
  captionTextColor: string;
  captionPosition: string;
  musicVolume: number;
  overlay?: string;
  hook?: string;
  port?: number;
}

export type MusicData = {
  file: string;
  duration: number;
};

export type ShortVideoData = {
  scenes: any[]; // Definir um tipo mais específico se possível
  music: {
    file: string;
    url: string;
    start: number;
    end: number;
    mood?: string;
    loop?: boolean;
  };
  config: VideoConfig;
}
