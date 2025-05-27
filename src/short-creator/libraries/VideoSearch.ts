import { OrientationEnum } from "../../types/shorts";
import { VideoProvider, VideoResult, VideoSearchError } from "./VideoProvider";
import { logger } from "../../logger";

// Singleton para compartilhar o cache entre instâncias
class VideoCache {
  private static instance: VideoCache;
  private usedVideoIds: Set<string> = new Set();

  private constructor() {}

  static getInstance(): VideoCache {
    if (!VideoCache.instance) {
      VideoCache.instance = new VideoCache();
    }
    return VideoCache.instance;
  }

  addVideo(id: string) {
    this.usedVideoIds.add(id);
  }

  hasVideo(id: string): boolean {
    return this.usedVideoIds.has(id);
  }

  clear() {
    this.usedVideoIds.clear();
  }
}

export class VideoSearch {
  private readonly fallbackTerms = [
    "technology",
    "future",
    "innovation",
    "digital",
    "modern",
    "business",
    "office",
    "city",
    "nature",
    "abstract"
  ];

  private videoCache: VideoCache;

  constructor(
    private localImageProvider: VideoProvider
  ) {
    this.videoCache = VideoCache.getInstance();
  }

  private async tryProvider(
    provider: VideoProvider,
    searchTerm: string,
    retryCount = 0
  ): Promise<VideoResult | null> {
    try {
      const result = await provider.findVideo(
        [searchTerm],
        10, // Initial duration estimate
        [], // No excluded IDs
        OrientationEnum.portrait // Default orientation
      );
      if (result) {
        return result;
      }
      return null;
    } catch (error: any) {
      // Se for erro de rate limit, aguarda antes de tentar novamente
      if (error.status === 429 || error.message?.includes('throttled')) {
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          logger.warn(
            { provider: provider.constructor.name, retryCount, delay },
            "Rate limit hit, waiting before retry"
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.tryProvider(provider, searchTerm, retryCount + 1);
        }
      }
      logger.error(
        { 
          err: error,
          provider: provider.constructor.name,
          searchTerm 
        },
        "Error finding video in provider"
      );
      return null;
    }
  }

  private getProgressiveTerms(term: string): string[] {
    const words = term.split(" ").filter(w => w.length > 3);
    const terms: string[] = [];
    terms.push(term);
    terms.push(...words);
    let currentWords = [...words];
    while (currentWords.length > 1) {
      currentWords.pop();
      terms.push(currentWords.join(" "));
    }
    const variations = words.map(word => {
      const variations = [];
      if (word.endsWith('ing')) {
        variations.push(word.slice(0, -3));
        variations.push(word.slice(0, -3) + 'ed');
      }
      if (word.endsWith('ed')) {
        variations.push(word.slice(0, -2));
        variations.push(word.slice(0, -2) + 'ing');
      }
      return variations;
    }).flat();
    terms.push(...variations);
    return terms;
  }

  async findVideo(
    searchTerms: string[],
    duration: number,
    excludeIds: string[],
    orientation: OrientationEnum
  ): Promise<VideoResult> {
    logger.info({ searchTerms, duration, excludeIds, orientation }, "🔍 Starting video search");
    for (const term of searchTerms) {
      logger.debug({ term }, "Trying original search term");
      const localResult = await this.tryProvider(
        this.localImageProvider,
        term
      );
      if (localResult) return localResult;
    }
    for (const term of searchTerms) {
      const progressiveTerms = this.getProgressiveTerms(term);
      for (const progressiveTerm of progressiveTerms) {
        logger.debug({ progressiveTerm }, "Trying progressive search term");
        const localResult = await this.tryProvider(
          this.localImageProvider,
          progressiveTerm
        );
        if (localResult) return localResult;
      }
    }
    for (const fallbackTerm of this.fallbackTerms) {
      logger.debug({ fallbackTerm }, "Trying fallback search term");
      const localResult = await this.tryProvider(
        this.localImageProvider,
        fallbackTerm
      );
      if (localResult) return localResult;
    }
    throw new Error("No videos found with any search strategy");
  }
} 