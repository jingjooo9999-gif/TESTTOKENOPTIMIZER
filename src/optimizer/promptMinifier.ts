/**
 * Minifies prompts, code context, and markdown to remove token bloat
 * without changing semantics or syntax logic.
 */

export interface PromptMinifierOptions {
  normalizeBlankLines?: boolean;
  trimTrailingSpaces?: boolean;
  compactMarkdownCodeBlocks?: boolean;
}

export function minifyPrompt(text: string, options: PromptMinifierOptions = {}): {
  minifiedText: string;
  originalLength: number;
  minifiedLength: number;
  rulesApplied: string[];
} {
  const {
    normalizeBlankLines = true,
    trimTrailingSpaces = true,
    compactMarkdownCodeBlocks = true
  } = options;

  const originalLength = text.length;
  const rulesApplied: string[] = [];
  let result = text;

  // 1. Trim trailing whitespace on each line
  if (trimTrailingSpaces) {
    const trimmed = result.split('\n').map(line => line.trimEnd()).join('\n');
    if (trimmed !== result) {
      result = trimmed;
      rulesApplied.push('Trimmed trailing whitespace');
    }
  }

  // 2. Normalize multiple blank lines to at most 1 empty line
  if (normalizeBlankLines) {
    const normalized = result.replace(/\n{3,}/g, '\n\n');
    if (normalized !== result) {
      result = normalized;
      rulesApplied.push('Collapsed multiple empty lines');
    }
  }

  // 3. Compact unnecessary whitespace around markdown code blocks
  if (compactMarkdownCodeBlocks) {
    const compacted = result
      .replace(/```(\w+)?\s*\n\s*\n/g, '```$1\n') // empty line right after ```
      .replace(/\n\s*\n```/g, '\n```');           // empty line right before ```
    
    if (compacted !== result) {
      result = compacted;
      rulesApplied.push('Compacted code block whitespace');
    }
  }

  return {
    minifiedText: result,
    originalLength,
    minifiedLength: result.length,
    rulesApplied
  };
}
