import { OrientationEnum } from "../../types/shorts";
import { VideoProvider, VideoResult, VideoSearchError } from "./VideoProvider";
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
  ): Promise<VideoResult> {
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
  ): Promise<VideoResult[]> {
    logger.info({ searchTerms, duration, excludeVideoIds, orientation, count }, "🔍 Starting video search for multiple videos");

    return await this.localImageApi.findVideos(
      [searchTerms],
      duration,
      excludeVideoIds,
      orientation,
      count
    );
  }
} 