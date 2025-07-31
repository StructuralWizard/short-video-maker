/* eslint-disable @remotion/deterministic-randomness */
import { getOrientationConfig } from "../../shared/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 3;
const defaultTimeoutMs = 5000;
const retryTimes = 3;

export class PexelsAPI {
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
      "Searching for video in Pexels API",
    );
    const headers = new Headers();
    headers.append("Authorization", this.API_KEY);
    const response = await fetch(
      `https://api.pexels.com/videos/search?orientation=${orientation}&size=medium&per_page=80&query=${encodeURIComponent(searchTerm)}`,
      {
        method: "GET",
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeout),
      },
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              "Invalid Pexels API key - please make sure you get a valid key from https://www.pexels.com/api and set it in the environment variable PEXELS_API_KEY",
            );
          }
          throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .catch((error: unknown) => {
        logger.error(error, "Error fetching videos from Pexels API");
        throw error;
      });
    const videos = response.videos as {
      id: string;
      duration: number;
      image: string; // Add thumbnail image
      video_files: {
        fps: number;
        quality: string;
        width: number;
        height: number;
        id: string;
        link: string;
      }[];
      video_pictures: {
        id: number;
        picture: string;
        nr: number;
      }[];
    }[];

    const { width: requiredVideoWidth, height: requiredVideoHeight } =
      getOrientationConfig(orientation);

    if (!videos || videos.length === 0) {
      logger.error(
        { searchTerm, orientation },
        "No videos found in Pexels API",
      );
      throw new Error("No videos found");
    }

    // find all the videos that fits the criteria, then select one randomly
    const filteredVideos = videos
      .map((video) => {
        if (excludeIds.includes(video.id)) {
          return;
        }
        if (!video.video_files.length) {
          return;
        }

        // calculate the real duration of the video by converting the FPS to 25
        const fps = video.video_files[0].fps;
        const duration =
          fps < 25 ? video.duration * (fps / 25) : video.duration;

        // Try to find the best quality video file that matches orientation
        for (const file of video.video_files) {
          // Check if the video meets orientation requirements
          const isCorrectOrientation = 
            (orientation === OrientationEnum.portrait && file.height > file.width) ||
            (orientation === OrientationEnum.landscape && file.width > file.height);
          
          if (isCorrectOrientation) {
            // Prefer HD quality but accept other qualities if HD not available
            const isGoodQuality = file.quality === "hd" || file.quality === "sd";
            
            if (isGoodQuality && duration >= minDurationSeconds - 2) { // More flexible duration check
              // Get thumbnail from video_pictures or fallback to image
              const thumbnail = video.video_pictures && video.video_pictures.length > 0 
                ? video.video_pictures[0].picture 
                : video.image;
              
              return {
                id: video.id,
                url: file.link,
                width: file.width,
                height: file.height,
                duration: duration,
                thumbnail: thumbnail,
              };
            }
          }
        }

        // If no HD/SD found, try any quality that matches orientation
        for (const file of video.video_files) {
          const isCorrectOrientation = 
            (orientation === OrientationEnum.portrait && file.height > file.width) ||
            (orientation === OrientationEnum.landscape && file.width > file.height);
          
          if (isCorrectOrientation && duration >= minDurationSeconds - 5) { // Even more flexible
            // Get thumbnail from video_pictures or fallback to image
            const thumbnail = video.video_pictures && video.video_pictures.length > 0 
              ? video.video_pictures[0].picture 
              : video.image;
            
            return {
              id: video.id,
              url: file.link,
              width: file.width,
              height: file.height,
              duration: duration,
              thumbnail: thumbnail,
            };
          }
        }
      })
      .filter(Boolean);
      
    if (!filteredVideos.length) {
      logger.warn({ searchTerm, minDurationSeconds, orientation }, "No videos found with strict criteria, trying with any available videos");
      
      // Last resort: try any video that has files
      const anyVideos = videos
        .filter(video => video.video_files && video.video_files.length > 0)
        .map(video => {
          const file = video.video_files[0]; // Take first available file
          const fps = file.fps;
          const duration = fps < 25 ? video.duration * (fps / 25) : video.duration;
          
          // Get thumbnail from video_pictures or fallback to image
          const thumbnail = video.video_pictures && video.video_pictures.length > 0 
            ? video.video_pictures[0].picture 
            : video.image;
          
          return {
            id: video.id,
            url: file.link,
            width: file.width,
            height: file.height,
            duration: duration,
            thumbnail: thumbnail,
          };
        });
        
      if (anyVideos.length > 0) {
        const video = anyVideos[Math.floor(Math.random() * anyVideos.length)] as Video;
        logger.info({ searchTerm, video }, "Found fallback video from Pexels API");
        return video;
      }
      
      logger.error({ searchTerm }, "No videos found in Pexels API");
      throw new Error("No videos found");
    }

    const video = filteredVideos[
      Math.floor(Math.random() * filteredVideos.length)
    ] as Video;

    logger.debug(
      { searchTerm, video: video, minDurationSeconds, orientation },
      "Found video from Pexels API",
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
    // shuffle the search terms to randomize the search order
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

        logger.error(error, "Error finding video in Pexels API for term");
      }
    }
    logger.error(
      { searchTerms },
      "No videos found in Pexels API for the given terms",
    );
    throw new Error("No videos found in Pexels API");
  }
}
