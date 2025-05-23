import { logger } from "../../utils/logger";

export function cleanSceneText(text: string): string {
  try {
    // Remove números entre colchetes (ex: [4])
    let cleaned = text.replace(/\[\d+\]/g, '');
    
    // Remove aspas simples ou duplas extras
    cleaned = cleaned.replace(/["']/g, '');
    
    // Remove espaços múltiplos
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove pontuações duplicadas
    cleaned = cleaned.replace(/\.{2,}/g, '.');
    cleaned = cleaned.replace(/!{2,}/g, '!');
    cleaned = cleaned.replace(/\?{2,}/g, '?');
    
    // Remove espaços antes de pontuação
    cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
    
    // Remove espaços no início e fim
    cleaned = cleaned.trim();
    
    // Remove caracteres especiais mantendo acentuação
    cleaned = cleaned.replace(/[^\p{L}\p{N}\s.,!?-]/gu, '');
    
    // Garante que a frase termina com pontuação
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }

    logger.debug("Cleaned scene text", { original: text, cleaned });
    
    return cleaned;
  } catch (error) {
    logger.error("Error cleaning scene text", { error, text });
    return text; // Retorna o texto original em caso de erro
  }
} 