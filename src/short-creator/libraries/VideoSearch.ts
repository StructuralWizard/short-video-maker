import { OrientationEnum, Video } from "../../types/shorts";
import { VideoProvider, VideoSearchError } from "./VideoProvider";
import { logger } from "../../logger";
import { LocalImageAPI } from "./LocalImageAPI";

export class VideoSearch {
  constructor(
    private localImageApi: LocalImageAPI
  ) {}

  public async findVideo(
    searchTerms: string,
    duration: number,
    excludeVideoIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait
  ): Promise<Video> {
    logger.info({ searchTerms, duration, excludeVideoIds, orientation }, "🔍 Starting video search");

    return await this.localImageApi.findVideo(
      [searchTerms],
      duration,
      excludeVideoIds,
      orientation
    );
  }

  public async findVideos(
    searchTerms: string,
    duration: number,
    excludeVideoIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    count: number = 1
  ): Promise<Video[]> {
    logger.info({ searchTerms, duration, excludeVideoIds, orientation, count }, "🔍 Starting video search for multiple videos");

    return await this.localImageApi.findVideos(
        [searchTerms],
        duration,
        excludeVideoIds,
        orientation,
        count
      );
  }

  public async findRandomVideo(
    excludeVideoIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait
  ): Promise<Video> {
    logger.info("Delegating random video search to LocalImageAPI");
    return await this.localImageApi.findRandomVideo(excludeVideoIds, orientation);
  }

  public async getVideoByUrl(url: string): Promise<Video> {
    logger.info({ url }, "🔍 Getting video by URL");
    return await this.localImageApi.getVideoByUrl(url);
  }
} 