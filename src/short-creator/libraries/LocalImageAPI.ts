import { OrientationEnum, Video } from "../../types/shorts";
import { VideoSearchError, VideoProvider } from "./VideoProvider";

export class LocalImageAPI implements VideoProvider {
  constructor(private port: number = 3123) {}

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = 5000,
    retryCounter: number = 0,
  ): Promise<Video> {
    const videos = await this.findVideos(searchTerms, minDurationSeconds, excludeIds, orientation, 1);
    return videos[0];
  }

  async findVideos(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    count: number = 1,
    timeout: number = 5000,
    retryCounter: number = 0,
  ): Promise<Video[]> {
    try {
      const response = await fetch(`http://localhost:8000/v1/videos?query=${encodeURIComponent(searchTerms.join(" "))}&per_page=20&orientation=${orientation === OrientationEnum.portrait ? "portrait" : "landscape"}`);

      if (!response.ok) {
        throw new VideoSearchError("LocalImageAPI request failed");
      }
      const data = await response.json();
      const availableVideos = data
        .filter((video: any) => !excludeIds.includes(video.id.toString()))
        .sort((a: any, b: any) => Math.abs(a.duration - minDurationSeconds) - Math.abs(b.duration - minDurationSeconds));

      if (!availableVideos.length) {
        throw new VideoSearchError("No videos found in LocalImageAPI");
      }

      // Seleciona 'count' vídeos aleatórios
      const selectedVideos = [];
      const maxAttempts = Math.min(availableVideos.length, count * 2); // Tenta pegar o dobro para ter mais opções
      const usedIndices = new Set<number>();

      while (selectedVideos.length < count && usedIndices.size < maxAttempts) {
        const randomIndex = Math.floor(Math.random() * availableVideos.length);
        if (!usedIndices.has(randomIndex)) {
          usedIndices.add(randomIndex);
          const video = availableVideos[randomIndex];
          
          // Ensure the URL is absolute and uses the video server URL
          const videoUrl = video.file_path.startsWith('http') 
            ? video.file_path 
            : `http://localhost:8000${video.file_path}`;

          selectedVideos.push({
            id: video.id.toString(),
            url: videoUrl,
            duration: video.duration,
            width: video.width,
            height: video.height,
          });
        }
      }

      if (selectedVideos.length === 0) {
        throw new VideoSearchError("No videos found in LocalImageAPI");
      }

      return selectedVideos;
    } catch (error) {
      throw new VideoSearchError("Error finding video in LocalImageAPI");
    }
  }
} 