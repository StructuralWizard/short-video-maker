process.env.LOG_LEVEL = "debug";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShortCreator } from "./ShortCreator";
import { Config } from "../config";
import { Remotion } from "./libraries/Remotion";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { MusicManager } from "./music";
import { LocalTTS } from "./libraries/LocalTTS";
import { OrientationEnum, MusicMoodEnum, MusicVolumeEnum } from "../types/shorts";

// mock remotion
vi.mock("@remotion/renderer", () => ({
  renderMedia: vi.fn().mockResolvedValue(undefined),
  selectComposition: vi.fn().mockResolvedValue({
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300,
  }),
  ensureBrowser: vi.fn().mockResolvedValue(undefined),
}));

// mock ffmpeg
vi.mock("fluent-ffmpeg", () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({
    input: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioBitrate: vi.fn().mockReturnThis(),
    audioChannels: vi.fn().mockReturnThis(),
    audioFrequency: vi.fn().mockReturnThis(),
    toFormat: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    save: vi.fn().mockReturnThis(),
    pipe: vi.fn().mockReturnThis(),
  }),
  setFfmpegPath: vi.fn(),
  ffprobe: vi.fn().mockImplementation((filePath, callback) => {
    callback(null, { format: { duration: 10 } });
  }),
}));

// mock ffmpeg-installer
vi.mock("@ffmpeg-installer/ffmpeg", () => ({
  path: "/usr/local/bin/ffmpeg",
}));

// mock pexels
vi.mock("./libraries/Pexels", () => ({
  PexelsAPI: vi.fn().mockImplementation(() => ({
    findVideo: vi.fn().mockResolvedValue({
      id: "1",
      url: "http://example.com/video.mp4",
      width: 1080,
      height: 1920,
    }),
  })),
}));

// mock music manager
vi.mock("./music", () => ({
  MusicManager: vi.fn().mockImplementation(() => ({
    musicList: vi.fn().mockReturnValue([
      {
        file: "test.mp3",
        start: 0,
        end: 10,
        mood: "happy",
        url: "http://localhost:3000/api/music/test.mp3",
      },
    ]),
  })),
}));

// mock local tts
vi.mock("./libraries/LocalTTS", () => ({
  LocalTTS: {
    init: vi.fn().mockResolvedValue({
      generateSpeech: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

describe("ShortCreator", () => {
  let shortCreator: ShortCreator;
  let config: Config;
  let remotion: Remotion;
  let ffmpeg: FFMpeg;
  let pexelsApi: PexelsAPI;
  let musicManager: MusicManager;

  beforeEach(async () => {
    config = new Config();
    config.port = 3000;
    config.tempDirPath = "/tmp";
    config.videosDirPath = "/tmp/videos";
    config.referenceAudioPath = "/tmp/reference.wav";
    config.packageDirPath = "/tmp";
    config.devMode = true;
    config.concurrency = 1;
    config.videoCacheSizeInBytes = 1024 * 1024;
    config.musicDirPath = "/tmp/music";
    config.pexelsApiKey = "mock-api-key";

    remotion = await Remotion.init(config);
    ffmpeg = await FFMpeg.init();
    pexelsApi = new PexelsAPI(config.pexelsApiKey);
    musicManager = new MusicManager(config);

    shortCreator = new ShortCreator(
      config,
      remotion,
      ffmpeg,
      pexelsApi,
      musicManager,
    );
  });

  it("should create a short video", async () => {
    const sceneInput = [
      {
        text: "Hello world",
        searchTerms: ["hello world"],
      },
    ];

    const renderConfig = {
      language: "pt" as const,
      orientation: OrientationEnum.portrait,
      paddingBack: 1000,
      musicVolume: MusicVolumeEnum.high,
    };

    const id = shortCreator.addToQueue(sceneInput, renderConfig);
    expect(id).toBeDefined();
  });

  it("should list available music tags", () => {
    const tags = shortCreator.ListAvailableMusicTags();
    expect(tags).toBeDefined();
  });

  it("should list all videos", () => {
    const videos = shortCreator.listAllVideos();
    expect(videos).toBeDefined();
  });

  it("should list available voices", () => {
    const voices = shortCreator.ListAvailableVoices();
    expect(voices).toBeDefined();
  });
});
