import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";
import { PexelsAPI } from "./Pexels";
import { PixabayAPI } from "./Pixabay";

const defaultTimeoutMs = 5000;
const retryTimes = 3;

// Words to remove from search terms
const stopWords = new Set([
  "of", "an", "or", "and", "in", "the", "as", "a", "to", "for", "with", "on", "at", "from", "by", "about", "like", "through", "over", "before", "between", "after", "since", "without", "under", "within", "along", "following", "across", "behind", "beyond", "plus", "except", "but", "up", "out", "around", "down", "off", "above", "near"
]);

export class VideoSearch {
  private pixabayApi: PixabayAPI;
  private pexelsApi: PexelsAPI;

  constructor(pixabayApiKey: string, pexelsApiKey: string) {
    this.pixabayApi = new PixabayAPI(pixabayApiKey);
    this.pexelsApi = new PexelsAPI(pexelsApiKey);
  }

  private cleanSearchTerms(phrase: string): string[] {
    return phrase
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length >= 4 && !stopWords.has(word));
  }

  private async searchPixabay(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video | null> {
    try {
      return await this.pixabayApi.findVideo(
        searchTerms,
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
      );
    } catch (error) {
      logger.debug({ searchTerms }, "No results found in Pixabay");
      return null;
    }
  }

  private async searchPexels(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video | null> {
    try {
      return await this.pexelsApi.findVideo(
        searchTerms,
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
      );
    } catch (error) {
      logger.debug({ searchTerms }, "No results found in Pexels");
      return null;
    }
  }

  async findVideo(
    searchPhrases: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
  ): Promise<Video> {
    // Try each phrase as is in Pixabay
    for (const phrase of searchPhrases) {
      logger.debug({ phrase }, "Searching Pixabay with exact phrase");
      const result = await this.searchPixabay(
        [phrase],
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
      );
      if (result) return result;
    }

    // Try each phrase as is in Pexels
    for (const phrase of searchPhrases) {
      logger.debug({ phrase }, "Searching Pexels with exact phrase");
      const result = await this.searchPexels(
        [phrase],
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
      );
      if (result) return result;
    }

    // Convert phrases to cleaned words and try Pixabay again
    const cleanedWords = searchPhrases
      .map(phrase => this.cleanSearchTerms(phrase))
      .flat()
      .filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates

    if (cleanedWords.length > 0) {
      logger.debug({ cleanedWords }, "Searching Pixabay with cleaned words");
      const result = await this.searchPixabay(
        cleanedWords,
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
      );
      if (result) return result;
    }

    // Finally, try Pexels with cleaned words
    if (cleanedWords.length > 0) {
      logger.debug({ cleanedWords }, "Searching Pexels with cleaned words");
      const result = await this.searchPexels(
        cleanedWords,
        minDurationSeconds,
        excludeIds,
        orientation,
        timeout,
      );
      if (result) return result;
    }

    throw new Error("No videos found in any source");
  }
} 