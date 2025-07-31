import { OrientationEnum, Video } from "../../types/shorts";
import { VideoSearchError, VideoProvider } from "./VideoProvider";
import { logger } from "../../logger";
import { Config } from "../../config";
import { PexelsAPI } from "./PexelsAPI";

export class LocalImageAPI implements VideoProvider {
  private pexelsApi: PexelsAPI;

  constructor(private config: Config, private port: number = 3123) {
    if (!process.env.PEXELS_API_KEY) {
      throw new Error("PEXELS_API_KEY environment variable is required");
    }
    this.pexelsApi = new PexelsAPI(process.env.PEXELS_API_KEY);
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = 30000,
    retryCounter: number = 0,
  ): Promise<Video> {
    logger.info({ searchTerms, minDurationSeconds, excludeIds, orientation }, "🔍 Starting video search with Pexels API");
    
    try {
      return await this.pexelsApi.findVideo(
        searchTerms,
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
        retryCounter
      );
    } catch (error) {
      logger.error({ error, searchTerms }, "Error in video search");
      throw new VideoSearchError(`An unexpected error occurred during video search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findVideos(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    count: number = 1,
    timeout: number = 30000,
    retryCounter: number = 0,
  ): Promise<Video[]> {
    logger.info({ searchTerms, count, minDurationSeconds, excludeIds, orientation }, "🔍 Starting video search for multiple videos with Pexels API");
    
    const videos: Video[] = [];
    const usedIds = new Set(excludeIds);

    try {
      // Try to find multiple videos by making multiple calls
      for (let i = 0; i < count; i++) {
        try {
          const video = await this.pexelsApi.findVideo(
            searchTerms,
            minDurationSeconds,
            Array.from(usedIds),
            orientation,
            timeout,
            retryCounter
          );
          videos.push(video);
          usedIds.add(video.id);
        } catch (error) {
          logger.warn({ i, searchTerms }, "Could not find additional video, stopping search");
          break;
        }
      }

      if (videos.length === 0) {
        throw new VideoSearchError(`No videos found for search terms: ${searchTerms.join(", ")}`);
      }

      logger.info({ count: videos.length, searchTerms }, "Successfully found videos");
      return videos;
    } catch (error) {
      logger.error({ error, searchTerms }, "Error in videos search");
      throw new VideoSearchError(`An unexpected error occurred during video search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async findRandomVideo(
    excludeIds: string[],
    orientation: OrientationEnum = OrientationEnum.portrait
  ): Promise<Video> {
    logger.info("Searching for a random video with Pexels API");
    
    try {
      // Use some generic search terms for random videos
      const randomTerms = ["nature", "ocean", "city", "sky", "landscape"];
      const video = await this.pexelsApi.findVideo(
        randomTerms,
        10, // minimum duration
        excludeIds,
        orientation
      );
      return video;
    } catch (error) {
      logger.error({ error }, "Error finding random video");
      throw new VideoSearchError("Could not find any random video.");
    }
  }

  async getVideoById(id: string): Promise<Video> {
    logger.warn({ id }, "getVideoById called but not fully supported with Pexels API");
    
    // Since Pexels doesn't have a direct "get by ID" API, we'll use a fallback
    try {
      // Try to return a mock video object with the provided ID
      return {
        id: id,
        url: `https://www.pexels.com/video/${id}/`, // Mock URL
        duration: 30,
        width: 1920,
        height: 1080,
      };
    } catch (error) {
      throw new VideoSearchError(`Error getting video by id in Pexels API: ${id}`);
    }
  }

  // Mock implementation for getVideoByUrl - since Pexels doesn't have this concept
  async getVideoByUrl(url: string): Promise<Video> {
    logger.warn({ url }, "getVideoByUrl called but not supported with Pexels API");
    
    // Try to extract video ID from URL if it's a Pexels URL
    const pexelsVideoRegex = /(?:pexels\.com\/video\/.*?(\d+))|(?:\/(\d+)\.mp4)/;
    const match = url.match(pexelsVideoRegex);
    
    if (match) {
      const id = match[1] || match[2];
      logger.info({ id, url }, "Extracted video ID from URL");
      
      // Return a mock video object since we can't easily get video details from Pexels by ID
      return {
        id: id,
        url: url,
        width: 1920,
        height: 1080,
        duration: 30, // Default duration since we can't get it from URL
      };
    } else {
      // If we can't extract an ID, try to use the URL as-is for compatibility
      logger.warn({ url }, "Could not extract video ID from URL, using fallback");
      return {
        id: Math.random().toString(36).substr(2, 9), // Generate random ID
        url: url,
        width: 1920,
        height: 1080,
        duration: 30,
      };
    }
  }
}
