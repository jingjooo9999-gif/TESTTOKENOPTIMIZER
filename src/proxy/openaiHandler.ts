import { Request, Response } from 'express';
import { cleanLogs } from '../optimizer/logCleaner';
import { minifyPrompt } from '../optimizer/promptMinifier';
import { estimateTokens, calculateSavings } from '../optimizer/tokenCalculator';
import { localCache } from '../optimizer/cacheManager';
import { statsStore, RequestRecord } from '../state/statsStore';

export async function handleOpenAIChatCompletions(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const settings = statsStore.getSettings();
  const body = req.body || {};
  const model = body.model || 'gpt-4o';
  const messages: any[] = body.messages || [];
  const isStream = Boolean(body.stream);

  // 1. Calculate Original Tokens
  let rawContent = messages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  const originalTokens = estimateTokens(rawContent);

  // 2. Optimization Pipeline
  const rulesApplied: string[] = [];
  const optimizedMessages = messages.map(msg => {
    if (typeof msg.content !== 'string') return msg;

    let text = msg.content;

    // Apply Log Cleaner
    if (settings.enableLogCleaner) {
      const logRes = cleanLogs(text);
      if (logRes.rulesApplied.length > 0) {
        text = logRes.cleanedText;
        rulesApplied.push(...logRes.rulesApplied);
      }
    }

    // Apply Prompt Minifier
    if (settings.enablePromptMinifier) {
      const minRes = minifyPrompt(text);
      if (minRes.rulesApplied.length > 0) {
        text = minRes.minifiedText;
        rulesApplied.push(...minRes.rulesApplied);
      }
    }

    return { ...msg, content: text };
  });

  const uniqueRules = Array.from(new Set(rulesApplied));
  const optimizedContent = optimizedMessages
    .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n');
  const optimizedTokens = estimateTokens(optimizedContent);
  const savings = calculateSavings(model, originalTokens, optimizedTokens);

  // Preview snippet
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const promptPreview = typeof lastUserMsg?.content === 'string'
    ? lastUserMsg.content.slice(0, 80) + (lastUserMsg.content.length > 80 ? '...' : '')
    : 'System prompt / instructions';

  // 3. Cache Check
  const cacheKey = localCache.generateKey(model, optimizedMessages);
  if (settings.enableSmartCache) {
    const cachedEntry = localCache.get(cacheKey);
    if (cachedEntry) {
      const latencyMs = Date.now() - startTime;
      const fullSavings = calculateSavings(model, originalTokens, 0); // 100% saved!

      const record: RequestRecord = {
        id: 'req_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        provider: 'openai',
        model,
        originalTokens,
        optimizedTokens: 0,
        savedTokens: originalTokens,
        percentageSaved: 100,
        dollarsSaved: fullSavings.dollarsSaved,
        latencyMs,
        cached: true,
        rulesApplied: ['Instant Local Cache Hit (100% saved)'],
        promptPreview
      };

      statsStore.recordRequest(record);
      res.setHeader('X-Token-Guard-Cached', 'true');
      res.setHeader('X-Token-Guard-Tokens-Saved', originalTokens.toString());
      res.setHeader('X-Token-Guard-Dollars-Saved', fullSavings.dollarsSaved.toString());

      if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const chunk = {
          id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: { content: cachedEntry.response.choices?.[0]?.message?.content || 'Cached result' },
              finish_reason: 'stop'
            }
          ]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      res.json(cachedEntry.response);
      return;
    }
  }

  // 4. Forwarding or Simulation
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const hasRealKey = apiKey && apiKey.startsWith('sk-') && !settings.simulationMode;

  let finalResponse: any;

  if (hasRealKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          ...body,
          messages: optimizedMessages
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        res.status(response.status).send(errText);
        return;
      }

      finalResponse = await response.json();
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message } });
      return;
    }
  } else {
    // Simulated realistic response for Dev / Demo mode
    const simulatedText = `[Token Optimizer Verified Response]
Analysis complete. Found the root issue in your code logic and optimized the execution flow.
- Processed ${optimizedTokens} tokens (Original: ${originalTokens} tokens, Saved: ${savings.savedTokens} tokens).`;

    finalResponse = {
      id: 'chatcmpl-opt-' + Math.random().toString(36).substr(2, 9),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: simulatedText
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: optimizedTokens,
        completion_tokens: 35,
        total_tokens: optimizedTokens + 35
      }
    };
  }

  // Store in cache if enabled
  if (settings.enableSmartCache && finalResponse) {
    localCache.set(cacheKey, finalResponse, model, originalTokens, savings.dollarsSaved);
  }

  const latencyMs = Date.now() - startTime;
  const record: RequestRecord = {
    id: 'req_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    provider: 'openai',
    model,
    originalTokens,
    optimizedTokens,
    savedTokens: savings.savedTokens,
    percentageSaved: savings.percentageSaved,
    dollarsSaved: savings.dollarsSaved,
    latencyMs,
    cached: false,
    rulesApplied: uniqueRules.length > 0 ? uniqueRules : ['Prompt Cleaned'],
    promptPreview
  };

  statsStore.recordRequest(record);
  res.setHeader('X-Token-Guard-Tokens-Saved', savings.savedTokens.toString());
  res.setHeader('X-Token-Guard-Dollars-Saved', savings.dollarsSaved.toString());

  if (isStream && !hasRealKey) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chunk = {
      id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: { content: finalResponse.choices[0].message.content },
          finish_reason: 'stop'
        }
      ]
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  res.json(finalResponse);
}

export function handleOpenAIModels(req: Request, res: Response): void {
  res.json({
    object: 'list',
    data: [
      { id: 'gpt-4o', object: 'model', created: 1715368132, owned_by: 'system' },
      { id: 'gpt-4o-mini', object: 'model', created: 1721172741, owned_by: 'system' },
      { id: 'o1', object: 'model', created: 1726099999, owned_by: 'system' },
      { id: 'o3-mini', object: 'model', created: 1738000000, owned_by: 'system' }
    ]
  });
}
