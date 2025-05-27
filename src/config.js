"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
var path_1 = __importDefault(require("path"));
var zod_1 = require("zod");
var dotenv_1 = __importDefault(require("dotenv"));
var logger_1 = require("./logger");
var fs_extra_1 = __importDefault(require("fs-extra"));
// Load environment variables from .env file
var envPath = path_1.default.join(process.cwd(), ".env");
dotenv_1.default.config({ path: envPath });
logger_1.logger.info({ envPath: envPath }, "ENV file path");
// Define the schema for environment variables
var envSchema = zod_1.z.object({
    DATA_DIR_PATH: zod_1.z.string().optional(),
    RUNNING_IN_DOCKER: zod_1.z.string().optional(),
    TTS_VERBOSE: zod_1.z.string().optional(),
    TTS_MODEL: zod_1.z.string().optional(),
    PEXELS_API_KEY: zod_1.z.string().optional(),
    PORT: zod_1.z.string().optional(),
    DEV: zod_1.z.string().optional(),
    CONCURRENCY: zod_1.z.string().optional(),
    VIDEO_CACHE_SIZE_IN_BYTES: zod_1.z.string().optional(),
    REFERENCE_AUDIO_PATH: zod_1.z.string().optional(),
    PIXABAY_API_KEY: zod_1.z.string().optional(),
});
// Parse and validate environment variables
var env = envSchema.parse(process.env);
// Default paths
var defaultDataDirPath = path_1.default.join(process.cwd(), "data");
var defaultLibsDirPath = path_1.default.join(process.cwd(), "libs");
var defaultPort = 3123;
var Config = /** @class */ (function () {
    function Config() {
        this.dataDirPath = env.DATA_DIR_PATH || defaultDataDirPath;
        this.libsDirPath = defaultLibsDirPath;
        this.runningInDocker = env.RUNNING_IN_DOCKER === "true";
        this.ttsVerbose = env.TTS_VERBOSE === "true";
        this.ttsModel = env.TTS_MODEL || "default";
        this.pexelsApiKey = env.PEXELS_API_KEY || "";
        this.pixabayApiKey = env.PIXABAY_API_KEY || "";
        this.port = env.PORT ? parseInt(env.PORT) : defaultPort;
        this.devMode = env.DEV === "true";
        this.concurrency = env.CONCURRENCY ? parseInt(env.CONCURRENCY) : 4;
        this.videoCacheSizeInBytes = env.VIDEO_CACHE_SIZE_IN_BYTES ? parseInt(env.VIDEO_CACHE_SIZE_IN_BYTES) : 1024 * 1024 * 1024;
        this.referenceAudioPath = env.REFERENCE_AUDIO_PATH || path_1.default.join(process.cwd(), "NinoSample.wav");
        // Initialize paths
        this.videosDirPath = path_1.default.join(this.dataDirPath, "videos");
        this.tempDirPath = path_1.default.join(this.dataDirPath, "temp");
        this.packageDirPath = path_1.default.join(__dirname, "..");
        this.musicDirPath = path_1.default.join(this.packageDirPath, "static", "music");
        this.overlaysDirPath = path_1.default.join(this.packageDirPath, "static", "overlays");
        this.installationSuccessfulPath = path_1.default.join(this.dataDirPath, "installation-successful");
        // Create directories
        fs_extra_1.default.ensureDirSync(this.dataDirPath);
        fs_extra_1.default.ensureDirSync(this.libsDirPath);
        fs_extra_1.default.ensureDirSync(this.videosDirPath);
        fs_extra_1.default.ensureDirSync(this.tempDirPath);
        logger_1.logger.info({ DATA_DIR_PATH: this.dataDirPath }, "DATA_DIR_PATH");
    }
    Config.prototype.ensureConfig = function () {
        if (!this.pexelsApiKey) {
            throw new Error("PEXELS_API_KEY environment variable is missing. Get your free API key: https://www.pexels.com/api/key/ - see how to run the project: https://github.com/gyoridavid/short-video-maker");
        }
    };
    return Config;
}());
exports.Config = Config;
