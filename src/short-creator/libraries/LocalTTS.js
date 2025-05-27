"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalTTS = void 0;
var logger_1 = require("../../utils/logger");
var path_1 = __importDefault(require("path"));
var promises_1 = __importDefault(require("fs/promises"));
var child_process_1 = require("child_process");
var LocalTTS = /** @class */ (function () {
    function LocalTTS(config, outputDir) {
        if (outputDir === void 0) { outputDir = "output/audio"; }
        this.config = config;
        this.scriptPath = path_1.default.join(process.cwd(), "scripts", "tts", "generate_audio.py");
        this.outputDir = outputDir;
    }
    LocalTTS.init = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new LocalTTS(config)];
            });
        });
    };
    LocalTTS.prototype.generateSpeech = function (text_1, outputPath_1) {
        return __awaiter(this, arguments, void 0, function (text, outputPath, emotion, language, referenceAudioPath) {
            var refPath, request, pythonProcess_1, stdout_1, stderr_1, response, error_1;
            if (emotion === void 0) { emotion = "neutral"; }
            if (language === void 0) { language = "pt"; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info("🚀 Iniciando geração de áudio com TTS local", {
                            text: text,
                            outputPath: outputPath,
                            emotion: emotion,
                            language: language,
                            referenceAudioPath: referenceAudioPath,
                            cwd: process.cwd()
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        refPath = referenceAudioPath || this.config.referenceAudioPath;
                        logger_1.logger.info("📂 Usando arquivo de referência", {
                            refPath: refPath,
                            absolutePath: path_1.default.resolve(refPath)
                        });
                        // Cria o diretório de saída se não existir
                        return [4 /*yield*/, promises_1.default.mkdir(path_1.default.dirname(outputPath), { recursive: true })];
                    case 2:
                        // Cria o diretório de saída se não existir
                        _a.sent();
                        request = {
                            text: text.replace(/["']/g, ''),
                            reference_audio: path_1.default.basename(refPath),
                            language: language,
                            emotion: emotion
                        };
                        pythonProcess_1 = (0, child_process_1.spawn)("python", [this.scriptPath], {
                            stdio: ["pipe", "pipe", "pipe"]
                        });
                        // Envia a requisição para o script
                        pythonProcess_1.stdin.write(JSON.stringify(request));
                        pythonProcess_1.stdin.end();
                        stdout_1 = "";
                        stderr_1 = "";
                        pythonProcess_1.stdout.on("data", function (data) {
                            var chunk = data.toString();
                            // Tenta encontrar um JSON válido na saída
                            var jsonMatch = chunk.match(/\{.*\}/);
                            if (jsonMatch) {
                                stdout_1 = jsonMatch[0];
                            }
                            else {
                                stdout_1 += chunk;
                            }
                        });
                        pythonProcess_1.stderr.on("data", function (data) {
                            stderr_1 += data.toString();
                            logger_1.logger.debug("TTS Python script output:", data.toString());
                        });
                        // Aguarda o processo terminar
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                pythonProcess_1.on("close", function (code) {
                                    if (code === 0) {
                                        resolve();
                                    }
                                    else {
                                        reject(new Error("Python script exited with code ".concat(code)));
                                    }
                                });
                            })];
                    case 3:
                        // Aguarda o processo terminar
                        _a.sent();
                        // Processa a resposta
                        if (!stdout_1) {
                            throw new Error("No response received from Python script");
                        }
                        response = JSON.parse(stdout_1);
                        if (!response.success) {
                            throw new Error(response.error || "Falha ao gerar áudio");
                        }
                        // Copia o arquivo gerado para o local desejado
                        return [4 /*yield*/, promises_1.default.copyFile(response.output_path, outputPath)];
                    case 4:
                        // Copia o arquivo gerado para o local desejado
                        _a.sent();
                        logger_1.logger.info("🎵 Speech generated successfully", { outputPath: outputPath });
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        logger_1.logger.error("❌ Failed to generate speech", {
                            error: error_1,
                            text: text,
                            outputPath: outputPath,
                            emotion: emotion,
                            language: language,
                            referenceAudioPath: referenceAudioPath,
                            cwd: process.cwd()
                        });
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return LocalTTS;
}());
exports.LocalTTS = LocalTTS;
