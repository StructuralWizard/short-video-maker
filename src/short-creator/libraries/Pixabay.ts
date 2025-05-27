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
    terms: string[],
    duration: number,
    excludeIds: string[],
    orientation: OrientationEnum
  ): Promise<Video | null> {
    try {
      const response = await fetch(
        `https://pixabay.com/api/videos/?key=${this.API_KEY}&q=${encodeURIComponent(terms.join(" "))}&pretty=true&per_page=20&orientation=${orientation === OrientationEnum.PORTRAIT ? "vertical" : "horizontal"}`,
        {
          method: "GET",
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

      // Filtra vídeos já usados e ordena por duração mais próxima
      const availableVideos = videos
        .filter(video => !excludeIds.includes(video.id.toString()))
        .sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));

      if (!availableVideos.length) {
        return null;
      }

      const video = availableVideos[0];
      return {
        id: video.id.toString(),
        url: video.videos.medium.url,
        duration: video.duration,
        width: video.videos.medium.width,
        height: video.videos.medium.height,
        provider: "pixabay",
      };
    } catch (error: any) {
      // Se for erro de rate limit, propaga para tratamento no VideoSearch
      if (error.status === 429 || error.message?.includes('throttled')) {
        throw error;
      }

      logger.error(
        { err: error, terms },
        "Error finding video in Pixabay API for term"
      );
      return null;
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
        const video = await this._findVideo(
          [searchTerm],
          minDurationSeconds,
          excludeIds,
          orientation,
        );
        if (video) {
          return video;
        }
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