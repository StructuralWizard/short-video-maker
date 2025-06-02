import http from "http";
import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import path from "path";
import { exec } from "child_process";
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
    return new Promise((resolve, reject) => {
      const cmd = process.platform === 'win32' 
        ? `netstat -ano | findstr :${port}`
        : `lsof -i :${port} -t`;
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          logger.debug(`No process found on port ${port}`);
          resolve();
          return;
        }

        const pid = stdout.trim();
        if (!pid) {
          resolve();
          return;
        }

        const killCmd = process.platform === 'win32'
          ? `taskkill /F /PID ${pid}`
          : `kill -9 ${pid}`;

        exec(killCmd, (killError) => {
          if (killError) {
            logger.error(`Failed to kill process ${pid}:`, killError);
            reject(killError);
            return;
          }
          logger.info(`Killed process ${pid} on port ${port}`);
          resolve();
        });
      });
    });
  }

  public async start(): Promise<void> {
    const port = Number(process.env.PORT) || 3123;
    
    try {
      // Tenta matar qualquer processo usando a porta antes de iniciar
      await this.killProcessOnPort(port);
      
      await new Promise<void>((resolve, reject) => {
        this.app.listen(port, () => {
          logger.info(`🚀 Server running on port ${port}`);
          // Envia sinal de ready para o PM2
          if (process.send) {
            process.send('ready');
          }
          resolve();
        }).on('error', (err: NodeJS.ErrnoException) => {
          logger.error("Error starting server:", err);
          reject(err);
        });
      });
    } catch (err) {
      logger.error("Error starting server:", err);
      throw err;
    }
  }

  public getApp() {
    return this.app;
  }
}
