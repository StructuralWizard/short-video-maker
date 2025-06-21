import { OrientationEnum, Video } from "../../types/shorts";

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
  ): Promise<Video>;
  findVideos(
    searchTerms: string[],
    duration: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    count: number
  ): Promise<Video[]>;
  findRandomVideo(
    excludeIds: string[],
    orientation: OrientationEnum
  ): Promise<Video>;
  getVideoByUrl(url: string): Promise<Video>;
}

export class VideoSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoSearchError';
  }
} 