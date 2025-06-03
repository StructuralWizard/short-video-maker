import http from "http";
import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import path from "path";
import { exec, execSync } from "child_process";
import { ShortCreator } from "../short-creator/ShortCreator";
import { APIRouter } from "./routers/rest";
import { MCPRouter } from "./routers/mcp";
import { logger } from "../logger";
import { Config } from "../config";
import referenceAudioRouter from "./routes/referenceAudio";

export class Server {
  private app: express.Application;
  private config: Config;

  constructor(config: Config, shortCreator: ShortCreator) {
    this.config = config;
    this.app = express();

    // add healthcheck endpoint
    this.app.get("/health", (req: ExpressRequest, res: ExpressResponse) => {
      res.status(200).json({ status: "ok" });
    });

    const apiRouter = new APIRouter(config, shortCreator);
    const mcpRouter = new MCPRouter(shortCreator);
    this.app.use("/api", apiRouter.router);
    this.app.use("/mcp", mcpRouter.router);
    this.app.use("/api/reference-audio", referenceAudioRouter);

    // Serve static files from the UI build
    this.app.use(express.static(path.join(__dirname, "../../dist/ui")));
    this.app.use(
      "/static",
      express.static(path.join(__dirname, "../../static")),
    );

    // Serve the React app for all other routes (must be last)
    this.app.get("*", (req: ExpressRequest, res: ExpressResponse) => {
      res.sendFile(path.join(__dirname, "../../dist/ui/index.html"));
    });
  }

  private async killProcessOnPort(port: number): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Windows
        execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' });
        const output = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = output.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 4) {
            const pid = parts[parts.length - 1];
            if (pid) {
              execSync(`taskkill /F /PID ${pid}`);
            }
          }
        }
      } else {
        // Unix-like systems (Linux, macOS)
        const output = execSync(`lsof -i :${port} -t`).toString();
        const pids = output.split('\n').filter(Boolean);
        for (const pid of pids) {
          execSync(`kill -9 ${pid}`);
        }
      }
      logger.info(`Killed process using port ${port}`);
    } catch (error) {
      logger.warn(`No process found using port ${port}`);
    }
  }

  public async start(): Promise<void> {
    const port = Number(process.env.PORT) || 3123;
    
    try {
      // Tenta matar qualquer processo usando a porta antes de iniciar
      await this.killProcessOnPort(port);
      
      // Tenta iniciar o servidor
      let retries = 3;
      while (retries > 0) {
        try {
          await new Promise<void>((resolve, reject) => {
            const server = this.app.listen(port, () => {
              logger.info(`🚀 Server running on port ${port}`);
              // Envia sinal de ready para o PM2
              if (process.send) {
                process.send('ready');
              }
              resolve();
            }).on('error', (err: NodeJS.ErrnoException) => {
              if (err.code === 'EADDRINUSE') {
                logger.warn(`Port ${port} is in use, retrying...`);
                reject(err);
              } else {
                logger.error("Error starting server:", err);
                reject(err);
              }
            });
          });
          // Se chegou aqui, o servidor iniciou com sucesso
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            throw err;
          }
          // Espera um pouco antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      logger.error("Error starting server:", err);
      throw err;
    }
  }

  public getApp() {
    return this.app;
  }
}
