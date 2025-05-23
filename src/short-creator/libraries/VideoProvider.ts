import { OrientationEnum } from "../../types/shorts";

export interface VideoResult {
  id: string;
  url: string;
  duration: number;
}

export interface VideoProvider {
  findVideo(
    searchTerms: string[],
    duration: number,
    excludeIds: string[],
    orientation: OrientationEnum
  ): Promise<VideoResult>;
}

export class VideoSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoSearchError';
  }
} 