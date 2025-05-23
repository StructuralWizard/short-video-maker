import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";
import { VideoSearchError } from "./VideoProvider";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean", "technology", "business", "city", "abstract"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

export class PixabayAPI {
  constructor(private API_KEY: string) {
    if (!API_KEY) {
      throw new Error("Pixabay API key is required");
    }
  }

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video> {
    logger.debug(
      { searchTerm, minDurationSeconds, orientation },
      "Searching for video in Pixabay API",
    );

    try {
      const response = await fetch(
        `https://pixabay.com/api/videos/?key=${this.API_KEY}&q=${encodeURIComponent(searchTerm)}&pretty=true&per_page=80`,
        {
          method: "GET",
          signal: AbortSignal.timeout(timeout),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          "Pixabay API request failed",
        );
        throw new Error(`Pixabay API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.hits || !Array.isArray(data.hits)) {
        logger.error(
          { response: data },
          "Invalid response format from Pixabay API",
        );
        throw new Error("Invalid response format from Pixabay API");
      }

      const videos = data.hits as {
        id: string;
        duration: number;
        videos: {
          large: { url: string; width: number; height: number };
          medium: { url: string; width: number; height: number };
          small: { url: string; width: number; height: number };
          tiny: { url: string; width: number; height: number };
        };
      }[];

      // Consider only the first 20 videos instead of 10 to increase chances of finding a match
      const topVideos = videos.slice(0, 20);

      const { width: requiredVideoWidth, height: requiredVideoHeight } =
        getOrientationConfig(orientation);

      if (!topVideos || topVideos.length === 0) {
        logger.debug(
          { searchTerm, orientation },
          "No videos found in Pixabay API",
        );
        throw new VideoSearchError("No videos found");
      }

      // Find all videos that fit the criteria, then select one randomly
      const filteredVideos = topVideos
        .map((video) => {
          if (excludeIds.includes(video.id.toString())) {
            return;
          }

          if (video.duration >= minDurationSeconds + durationBufferSeconds) {
            // Pixabay provides different video sizes, we'll use the one that matches our requirements
            const videoSize = video.videos.large || video.videos.medium || video.videos.small;
            
            // Allow for more flexibility in video dimensions (200px tolerance)
            const widthMatch = Math.abs(videoSize.width - requiredVideoWidth) <= 200;
            const heightMatch = Math.abs(videoSize.height - requiredVideoHeight) <= 200;
            
            if (widthMatch && heightMatch) {
              return {
                id: video.id.toString(),
                url: videoSize.url,
                width: videoSize.width,
                height: videoSize.height,
                duration: video.duration
              };
            }
          }
        })
        .filter(Boolean);

      if (!filteredVideos.length) {
        logger.debug({ searchTerm }, "No videos found in Pixabay API");
        throw new VideoSearchError("No videos found");
      }

      const video = filteredVideos[
        Math.floor(Math.random() * filteredVideos.length)
      ];

      if (!video) {
        throw new VideoSearchError("No videos found");
      }

      logger.debug(
        { searchTerm, video: video, minDurationSeconds, orientation },
        "Found video from Pixabay API",
      );

      return video;
    } catch (error: unknown) {
      if (error instanceof VideoSearchError) {
        logger.debug(
          { error: error.message, searchTerm },
          "No videos found in Pixabay API",
        );
      } else if (error instanceof Error) {
        logger.error(
          { error: error.message, searchTerm },
          "Error in Pixabay video search",
        );
      }
      throw error;
    }
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    retryCounter: number = 0,
  ): Promise<Video> {
    // Simplify search terms by removing special characters and extra spaces
    const simplifiedTerms = searchTerms.map(term => 
      term.replace(/[^\w\s]/g, '').trim().toLowerCase()
    ).filter(term => term.length > 0);

    // Split complex terms into individual words
    const individualTerms = simplifiedTerms
      .flatMap(term => term.split(' '))
      .filter(term => term.length > 3);

    // Shuffle the search terms to randomize the search order
    const shuffledJokerTerms = jokerTerms.sort(() => Math.random() - 0.5);
    const shuffledSearchTerms = [...simplifiedTerms, ...individualTerms].sort(() => Math.random() - 0.5);

    for (const searchTerm of [...shuffledSearchTerms, ...shuffledJokerTerms]) {
      try {
        return await this._findVideo(
          searchTerm,
          minDurationSeconds,
          excludeIds,
          orientation,
          timeout,
        );
      } catch (error: unknown) {
        if (error instanceof VideoSearchError) {
          logger.debug(
            { searchTerm },
            "No videos found in Pixabay API for term",
          );
          continue;
        }
        
        if (
          error instanceof Error &&
          error instanceof DOMException &&
          error.name === "TimeoutError"
        ) {
          if (retryCounter < retryTimes) {
            logger.warn(
              { searchTerm, retryCounter },
              "Timeout error, retrying...",
            );
            return await this.findVideo(
              searchTerms,
              minDurationSeconds,
              excludeIds,
              orientation,
              timeout,
              retryCounter + 1,
            );
          }
          logger.error(
            { searchTerm, retryCounter },
            "Timeout error, retry limit reached",
          );
          throw error;
        }

        logger.error(error, "Error finding video in Pixabay API for term");
        throw error;
      }
    }
    logger.debug(
      { searchTerms },
      "No videos found in Pixabay API for the given terms",
    );
    throw new VideoSearchError("No videos found in Pixabay API");
  }
} 