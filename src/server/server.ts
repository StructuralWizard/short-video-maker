import http from "http";
import express from "express";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import path from "path";
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

  public async start(): Promise<void> {
    const server = this.app.listen(this.config.port, () => {
      logger.info(`🚀 Server running on port ${this.config.port}`);
      // Envia sinal de ready para o PM2
      if (process.send) {
        process.send('ready');
      }
    });
    server.on('error', (err: Error) => {
      logger.error({ err }, 'Error starting server:');
      process.exit(1);
    });
  }

  public getApp() {
    return this.app;
  }
}
