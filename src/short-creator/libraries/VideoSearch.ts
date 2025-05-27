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
    private pixabayProvider: VideoProvider,
    private pexelsProvider: VideoProvider
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

      // Log do erro mas não propaga para evitar reinicialização
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
    
    // Add the full term
    terms.push(term);
    
    // Add individual words
    terms.push(...words);
    
    // Add progressive combinations (removing last word each time)
    let currentWords = [...words];
    while (currentWords.length > 1) {
      currentWords.pop();
      terms.push(currentWords.join(" "));
    }

    // Add variations with common prefixes/suffixes
    const variations = words.map(word => {
      const variations = [];
      if (word.endsWith('ing')) {
        variations.push(word.slice(0, -3)); // remove 'ing'
        variations.push(word.slice(0, -3) + 'ed'); // change to past tense
      }
      if (word.endsWith('ed')) {
        variations.push(word.slice(0, -2)); // remove 'ed'
        variations.push(word.slice(0, -2) + 'ing'); // change to present tense
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

    // Estratégia 1: Buscar com os termos originais
    for (const term of searchTerms) {
      logger.debug({ term }, "Trying original search term");
      
      // Tentar Pixabay primeiro
      const pixabayResult = await this.tryProvider(
        this.pixabayProvider,
        term
      );
      if (pixabayResult) return pixabayResult;

      // Tentar Pexels
      const pexelsResult = await this.tryProvider(
        this.pexelsProvider,
        term
      );
      if (pexelsResult) return pexelsResult;
    }

    // Estratégia 2: Buscar com termos progressivos
    for (const term of searchTerms) {
      const progressiveTerms = this.getProgressiveTerms(term);
      
      for (const progressiveTerm of progressiveTerms) {
        logger.debug({ progressiveTerm }, "Trying progressive search term");
        
        // Tentar Pixabay
        const pixabayResult = await this.tryProvider(
          this.pixabayProvider,
          progressiveTerm
        );
        if (pixabayResult) return pixabayResult;

        // Tentar Pexels
        const pexelsResult = await this.tryProvider(
          this.pexelsProvider,
          progressiveTerm
        );
        if (pexelsResult) return pexelsResult;
      }
    }

    // Estratégia 3: Usar termos de fallback
    for (const fallbackTerm of this.fallbackTerms) {
      logger.debug({ fallbackTerm }, "Trying fallback search term");
      
      // Tentar Pixabay
      const pixabayResult = await this.tryProvider(
        this.pixabayProvider,
        fallbackTerm
      );
      if (pixabayResult) return pixabayResult;

      // Tentar Pexels
      const pexelsResult = await this.tryProvider(
        this.pexelsProvider,
        fallbackTerm
      );
      if (pexelsResult) return pexelsResult;
    }

    throw new Error("No videos found with any search strategy");
  }
} 