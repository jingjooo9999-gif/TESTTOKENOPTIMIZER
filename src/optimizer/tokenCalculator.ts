export interface ModelPricing {
  inputPerMillion: number;  // in USD
  outputPerMillion: number; // in USD
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude models
  "claude-3-5-sonnet-20241022": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-3-5-sonnet": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-3-5-haiku-20241022": { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  "claude-3-5-haiku": { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  "claude-3-opus-20240229": { inputPerMillion: 15.0, outputPerMillion: 75.0 },

  // OpenAI models
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "o1": { inputPerMillion: 15.0, outputPerMillion: 60.0 },
  "o3-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  "gpt-4-turbo": { inputPerMillion: 10.0, outputPerMillion: 30.0 },

  // Fallback
  "default": { inputPerMillion: 3.0, outputPerMillion: 15.0 }
};

/**
 * Accurately estimates token count for code and natural language text.
 * Rule of thumb: ~3.8 characters per token for English text/code.
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // Approximate standard BPE tokenizer behavior
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Split by whitespace and common code delimiters
  const words = trimmed.split(/[\s,.\-_:;(){}[\]<>+=*&|!?"'`/\\~^%]+/);
  let tokenCount = 0;

  for (const word of words) {
    if (word.length === 0) continue;
    if (word.length <= 4) {
      tokenCount += 1;
    } else {
      tokenCount += Math.ceil(word.length / 3.6);
    }
  }

  // Add tokens for special symbols and formatting
  const symbols = (text.match(/[\s(){}[\]<>:;,.\-_+=*&|!?"'`/\\~^%]/g) || []).length;
  tokenCount += Math.ceil(symbols * 0.35);

  return Math.max(1, tokenCount);
}

/**
 * Calculates estimated cost savings based on model and token differences
 */
export function calculateSavings(
  model: string,
  originalTokens: number,
  optimizedTokens: number
): {
  savedTokens: number;
  percentageSaved: number;
  dollarsSaved: number;
} {
  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  const percentageSaved = originalTokens > 0 
    ? Math.min(100, Math.round((savedTokens / originalTokens) * 100))
    : 0;

  // Find matching pricing or fallback
  const normalizedModel = model.toLowerCase();
  let pricing = MODEL_PRICING["default"];
  for (const [key, value] of Object.entries(MODEL_PRICING)) {
    if (normalizedModel.includes(key)) {
      pricing = value;
      break;
    }
  }

  const dollarsSaved = (savedTokens / 1_000_000) * pricing.inputPerMillion;

  return {
    savedTokens,
    percentageSaved,
    dollarsSaved: Number(dollarsSaved.toFixed(5))
  };
}
