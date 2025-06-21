import { RenderConfig, SceneInput } from "../../types/shorts";

export interface QueueItem {
  id: string;
  sceneInput: SceneInput[];
  config: RenderConfig;
  status: "pending" | "processing" | "completed" | "failed";
} 