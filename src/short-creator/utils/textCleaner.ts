import { logger } from "../../utils/logger";

// Regex para identificar emojis
const emojiRegex = /[\p{Emoji}\u200d\uFE0F]/gu;
// Regex para identificar hashtags
const hashtagRegex = /#[\w\p{L}\p{M}\d_]+/gu;

// Dicionário de substituições para pronúncia
const substitutions: Record<string, string> = {
  "5g": "cinco gê",
  // Adicione outros termos problemáticos aqui
};

/**
 * Formata valores monetários para pronúncia correta
 * Ex: "R$ 100" -> "cem reais"
 */
function formatCurrency(text: string): string {
  // Regex para encontrar valores em reais (R$ seguido de número)
  const reaisRegex = /R\$\s*(\d+(?:[.,]\d{2})?)/g;
  
  return text.replace(reaisRegex, (match, value) => {
    // Remove pontos de milhar e converte vírgula para ponto
    const numValue = parseFloat(value.replace('.', '').replace(',', '.'));
    
    // Formata o número por extenso
    const formattedValue = numValue.toLocaleString('pt-BR', {
      style: 'decimal',
      maximumFractionDigits: 2
    });
    
    // Adiciona "reais" no final
    return `${formattedValue} reais`;
  });
}

export function cleanSceneText(text: string): string {
  try {
    let cleaned = text;

    // Formata valores monetários
    cleaned = formatCurrency(cleaned);

    // Substitui termos problemáticos
    for (const [key, value] of Object.entries(substitutions)) {
      const regex = new RegExp(key, "gi");
      cleaned = cleaned.replace(regex, value);
    }

    // Remove hashtags
    cleaned = cleaned.replace(hashtagRegex, "");

    // Remove emojis
    cleaned = cleaned.replace(emojiRegex, "");

    // Remove números entre colchetes (ex: [4])
    cleaned = cleaned.replace(/\[\d+\]/g, '');
    
    // Remove aspas simples ou duplas extras
    cleaned = cleaned.replace(/["']/g, '');
    
    // Remove espaços múltiplos
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove espaços no início e fim
    cleaned = cleaned.trim();
    
    // Remove caracteres especiais mantendo acentuação e pontuação
    cleaned = cleaned.replace(/[^\p{L}\p{N}\s.,!?:;-]/gu, '');
    
    // Remove ponto final
    cleaned = cleaned.replace(/\.$/, '');
    
    logger.debug("Cleaned scene text", { original: text, cleaned });
    
    return cleaned;
  } catch (error) {
    logger.error("Error cleaning scene text", { error, text });
    return text; // Retorna o texto original em caso de erro
  }
}

/**
 * Divide o texto em frases usando apenas pontuação de final de linha (.!?)
 */
export function splitTextByPunctuation(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)  // Divide apenas após ponto, exclamação ou interrogação seguidos de espaço
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
} 