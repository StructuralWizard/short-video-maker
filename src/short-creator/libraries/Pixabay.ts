import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

export class PixabayAPI {
  constructor(private API_KEY: string) {}

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("API key not set");
    }

    logger.debug(
      { searchTerm, minDurationSeconds, orientation },
      "Searching for video in Pixabay API",
    );

    const response = await fetch(
      `https://pixabay.com/api/videos/?key=${this.API_KEY}&q=${encodeURIComponent(searchTerm)}&pretty=true`,
      {
        method: "GET",
        signal: AbortSignal.timeout(timeout),
      },
    )
      .then((res) => res.json())
      .catch((error: unknown) => {
        logger.error(error, "Error fetching videos from Pixabay API");
        throw error;
      });

    const videos = response.hits as {
      id: string;
      duration: number;
      videos: {
        large: { url: string; width: number; height: number };
        medium: { url: string; width: number; height: number };
        small: { url: string; width: number; height: number };
        tiny: { url: string; width: number; height: number };
      };
    }[];

    // Consider only the first 10 videos
    const topVideos = videos.slice(0, 10);

    const { width: requiredVideoWidth, height: requiredVideoHeight } =
      getOrientationConfig(orientation);

    if (!topVideos || topVideos.length === 0) {
      logger.error(
        { searchTerm, orientation },
        "No videos found in Pixabay API",
      );
      throw new Error("No videos found");
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
          
          if (
            videoSize.width === requiredVideoWidth &&
            videoSize.height === requiredVideoHeight
          ) {
            return {
              id: video.id.toString(),
              url: videoSize.url,
              width: videoSize.width,
              height: videoSize.height,
            };
          }
        }
      })
      .filter(Boolean);

    if (!filteredVideos.length) {
      logger.error({ searchTerm }, "No videos found in Pixabay API");
      throw new Error("No videos found");
    }

    const video = filteredVideos[
      Math.floor(Math.random() * filteredVideos.length)
    ] as Video;

    logger.debug(
      { searchTerm, video: video, minDurationSeconds, orientation },
      "Found video from Pixabay API",
    );

    return video;
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    retryCounter: number = 0,
  ): Promise<Video> {
    // Shuffle the search terms to randomize the search order
    const shuffledJokerTerms = jokerTerms.sort(() => Math.random() - 0.5);
    const shuffledSearchTerms = searchTerms.sort(() => Math.random() - 0.5);

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
      }
    }
    logger.error(
      { searchTerms },
      "No videos found in Pixabay API for the given terms",
    );
    throw new Error("No videos found in Pixabay API");
  }
} 