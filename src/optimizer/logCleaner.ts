/**
 * Cleans noisy developer logs, stack traces, and build outputs
 * to save massive amounts of tokens before sending to LLM.
 */

export interface LogCleanerOptions {
  stripAnsi?: boolean;
  truncateNodeModules?: boolean;
  removeProgressBars?: boolean;
  collapseDuplicateLines?: boolean;
  truncateLongHexBase64?: boolean;
}

export function cleanLogs(text: string, options: LogCleanerOptions = {}): {
  cleanedText: string;
  originalLength: number;
  cleanedLength: number;
  rulesApplied: string[];
} {
  const {
    stripAnsi = true,
    truncateNodeModules = true,
    removeProgressBars = true,
    collapseDuplicateLines = true,
    truncateLongHexBase64 = true
  } = options;

  const originalLength = text.length;
  const rulesApplied: string[] = [];
  let result = text;

  // 1. Strip ANSI escape codes (color codes from terminal)
  if (stripAnsi) {
    const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    if (ansiRegex.test(result)) {
      result = result.replace(ansiRegex, '');
      rulesApplied.push('Stripped ANSI escape codes');
    }
  }

  // 2. Remove progress bars / spinner frames (e.g. [===>    ] 45%)
  if (removeProgressBars) {
    const progressBarRegex = /(?:\[[#=\-█\s]{5,}\]|\b\d{1,3}%\s+\[[#=\-█\s]+\])\s*[\r\n]*/g;
    if (progressBarRegex.test(result)) {
      result = result.replace(progressBarRegex, '');
      rulesApplied.push('Removed terminal progress bars');
    }
  }

  // 3. Truncate long internal node_modules / vendor stack traces
  if (truncateNodeModules) {
    const lines = result.split('\n');
    const cleanedLines: string[] = [];
    let consecutiveInternalFrames = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isInternalStackFrame = 
        /^\s*at\s+.*(?:node_modules|internal\/process\/|node:internal|\.pnpm)/i.test(line) ||
        /^\s*at\s+.*(?:\/webpack\/|\/vite\/|\/next\/dist\/)/i.test(line);

      if (isInternalStackFrame) {
        consecutiveInternalFrames++;
        if (consecutiveInternalFrames === 1) {
          // Keep the first frame for context
          cleanedLines.push(line);
        } else if (consecutiveInternalFrames === 2) {
          cleanedLines.push('    at [... internal node_modules/framework frames omitted ...]');
        }
      } else {
        consecutiveInternalFrames = 0;
        cleanedLines.push(line);
      }
    }

    if (cleanedLines.length < lines.length) {
      result = cleanedLines.join('\n');
      rulesApplied.push('Collapsed internal node_modules stack frames');
    }
  }

  // 4. Collapse duplicate consecutive error lines or blocks
  if (collapseDuplicateLines) {
    const lines = result.split('\n');
    const dedupedLines: string[] = [];
    let i = 0;

    while (i < lines.length) {
      let matchedBlockSize = 0;
      let repeatCount = 0;

      // Try block sizes from 1 to 4 lines
      for (let blockSize = 1; blockSize <= 4; blockSize++) {
        if (i + blockSize * 2 <= lines.length) {
          const currentBlock = lines.slice(i, i + blockSize).join('\n');
          if (currentBlock.trim().length > 5) {
            let tempI = i + blockSize;
            let tempRepeats = 0;

            while (tempI + blockSize <= lines.length) {
              const nextBlock = lines.slice(tempI, tempI + blockSize).join('\n');
              if (nextBlock === currentBlock) {
                tempRepeats++;
                tempI += blockSize;
              } else {
                break;
              }
            }

            if (tempRepeats >= 2) {
              matchedBlockSize = blockSize;
              repeatCount = tempRepeats;
              break;
            }
          }
        }
      }

      if (matchedBlockSize > 0 && repeatCount >= 2) {
        for (let k = 0; k < matchedBlockSize; k++) {
          dedupedLines.push(lines[i + k]);
        }
        dedupedLines.push(`    [... repeated above error block ${repeatCount} times omitted ...]`);
        i += matchedBlockSize * (repeatCount + 1);
      } else {
        dedupedLines.push(lines[i]);
        i++;
      }
    }

    if (dedupedLines.length < lines.length) {
      result = dedupedLines.join('\n');
      rulesApplied.push('Collapsed consecutive duplicate error logs');
    }
  }

  // 5. Truncate long Base64 / Hex / Dump blobs
  if (truncateLongHexBase64) {
    const blobRegex = /([A-Za-z0-9+/=]{120,}|(?:[0-9a-fA-F]{2}\s+){40,})/g;
    if (blobRegex.test(result)) {
      result = result.replace(blobRegex, (match) => {
        return `${match.slice(0, 30)}...[Truncated long data blob (${match.length} chars)]...${match.slice(-20)}`;
      });
      rulesApplied.push('Truncated raw binary/Base64/Hex dumps');
    }
  }

  return {
    cleanedText: result,
    originalLength,
    cleanedLength: result.length,
    rulesApplied
  };
}
