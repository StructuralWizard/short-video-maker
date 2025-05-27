/* eslint-disable @remotion/deterministic-randomness */
import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";
import { VideoSearchError } from "./VideoProvider";
import { createClient, Videos } from 'pexels';

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

export class PexelsAPI {
  private client: ReturnType<typeof createClient>;

  constructor(private API_KEY: string) {
    this.client = createClient(API_KEY);
  }

  private async _findVideo(
    terms: string[],
    duration: number,
    excludeIds: string[],
    orientation: OrientationEnum
  ): Promise<Video | null> {
    try {
      const response = await this.client.videos.search({
        query: terms.join(" "),
        per_page: 20,
        orientation: orientation === OrientationEnum.portrait ? "portrait" : "landscape",
      });

      if ('error' in response) {
        logger.error(
          { error: response.error },
          "Error from Pexels API"
        );
        return null;
      }

      if (!response.videos?.length) {
        return null;
      }

      // Filtra vídeos já usados e ordena por duração mais próxima
      const availableVideos = response.videos
        .filter(video => !excludeIds.includes(video.id.toString()))
        .sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));

      if (!availableVideos.length) {
        return null;
      }

      const video = availableVideos[0];
      return {
        id: video.id.toString(),
        url: video.video_files[0].link,
        duration: video.duration,
        width: video.width,
        height: video.height,
      };
    } catch (error) {
      logger.error(
        { err: error, terms },
        "Error finding video in Pexels API for term"
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
    // shuffle the search terms to randomize the search order
    const shuffledJokerTerms = jokerTerms.sort(() => Math.random() - 0.5);
    const shuffledSearchTerms = searchTerms.sort(() => Math.random() - 0.5);

    for (const searchTerm of [...shuffledSearchTerms, ...shuffledJokerTerms]) {
      try {
        const result = await this._findVideo(
          [searchTerm],
          minDurationSeconds,
          excludeIds,
          orientation,
        );
        if (result) {
          return result;
        }
      } catch (error: unknown) {
        if (error instanceof VideoSearchError) {
          logger.debug(
            { searchTerm },
            "No videos found in Pexels API for term",
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

        logger.error(error, "Error finding video in Pexels API for term");
        throw error;
      }
    }
    logger.debug(
      { searchTerms },
      "No videos found in Pexels API for the given terms",
    );
    throw new VideoSearchError("No videos found in Pexels API");
  }
}
