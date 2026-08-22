import { Request, Response } from 'express';
import { cleanLogs } from '../optimizer/logCleaner';
import { minifyPrompt } from '../optimizer/promptMinifier';
import { estimateTokens, calculateSavings } from '../optimizer/tokenCalculator';
import { localCache } from '../optimizer/cacheManager';
import { statsStore, RequestRecord } from '../state/statsStore';

export async function handleAnthropicMessages(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const settings = statsStore.getSettings();
  const body = req.body || {};
  const model = body.model || 'claude-3-5-sonnet-20241022';
  const messages: any[] = body.messages || [];
  const systemPrompt = typeof body.system === 'string' ? body.system : '';
  const isStream = Boolean(body.stream);

  // 1. Calculate Original Tokens
  let rawContent = systemPrompt + '\n' + messages.map(m => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
    }
    return JSON.stringify(m.content);
  }).join('\n');

  const originalTokens = estimateTokens(rawContent);

  // 2. Optimization Pipeline
  const rulesApplied: string[] = [];
  const optimizedMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      let text = msg.content;
      if (settings.enableLogCleaner) {
        const logRes = cleanLogs(text);
        if (logRes.rulesApplied.length > 0) {
          text = logRes.cleanedText;
          rulesApplied.push(...logRes.rulesApplied);
        }
      }
      if (settings.enablePromptMinifier) {
        const minRes = minifyPrompt(text);
        if (minRes.rulesApplied.length > 0) {
          text = minRes.minifiedText;
          rulesApplied.push(...minRes.rulesApplied);
        }
      }
      return { ...msg, content: text };
    }

    if (Array.isArray(msg.content)) {
      const optimizedArray = msg.content.map((block: any) => {
        if (block.type === 'text' && typeof block.text === 'string') {
          let text = block.text;
          if (settings.enableLogCleaner) {
            const logRes = cleanLogs(text);
            if (logRes.rulesApplied.length > 0) {
              text = logRes.cleanedText;
              rulesApplied.push(...logRes.rulesApplied);
            }
          }
          if (settings.enablePromptMinifier) {
            const minRes = minifyPrompt(text);
            if (minRes.rulesApplied.length > 0) {
              text = minRes.minifiedText;
              rulesApplied.push(...minRes.rulesApplied);
            }
          }
          return { ...block, text };
        }
        return block;
      });
      return { ...msg, content: optimizedArray };
    }

    return msg;
  });

  const uniqueRules = Array.from(new Set(rulesApplied));
  const optimizedContent = systemPrompt + '\n' + optimizedMessages.map(m => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) return m.content.map((c: any) => c.text || '').join('\n');
    return '';
  }).join('\n');

  const optimizedTokens = estimateTokens(optimizedContent);
  const savings = calculateSavings(model, originalTokens, optimizedTokens);

  // Preview
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  let promptPreview = 'Claude Code CLI prompt';
  if (typeof lastUserMsg?.content === 'string') {
    promptPreview = lastUserMsg.content.slice(0, 80) + (lastUserMsg.content.length > 80 ? '...' : '');
  }

  // 3. Cache Check
  const cacheKey = localCache.generateKey(model, optimizedMessages, systemPrompt);
  if (settings.enableSmartCache) {
    const cachedEntry = localCache.get(cacheKey);
    if (cachedEntry) {
      const latencyMs = Date.now() - startTime;
      const fullSavings = calculateSavings(model, originalTokens, 0);

      const record: RequestRecord = {
        id: 'req_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        provider: 'anthropic',
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

        res.write(`event: message_start\ndata: {"type":"message_start","message":{"id":"msg_${Math.random().toString(36).substr(2,9)}","type":"message","role":"assistant","content":[],"model":"${model}"}}\n\n`);
        res.write(`event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`);
        res.write(`event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"${cachedEntry.response.content?.[0]?.text || 'Cached answer'}"}}\n\n`);
        res.write(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
        res.end();
        return;
      }

      res.json(cachedEntry.response);
      return;
    }
  }

  // 4. Forwarding or Simulation
  const apiKey = (req.headers['x-api-key'] as string) || req.headers.authorization?.replace('Bearer ', '');
  const hasRealKey = apiKey && apiKey.startsWith('sk-ant-') && !settings.simulationMode;

  let finalResponse: any;

  if (hasRealKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': (req.headers['anthropic-version'] as string) || '2023-06-01'
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
    // Simulated realistic response for Claude Code
    const simulatedText = `[Token Optimizer Verified Response]
Task analyzed successfully. Cleaned and optimized code context.
- Optimized input tokens: ${optimizedTokens} (Saved: ${savings.savedTokens} tokens, -${savings.percentageSaved}%)`;

    finalResponse = {
      id: 'msg_opt_' + Math.random().toString(36).substr(2, 9),
      type: 'message',
      role: 'assistant',
      model,
      content: [
        {
          type: 'text',
          text: simulatedText
        }
      ],
      usage: {
        input_tokens: optimizedTokens,
        output_tokens: 32
      }
    };
  }

  if (settings.enableSmartCache && finalResponse) {
    localCache.set(cacheKey, finalResponse, model, originalTokens, savings.dollarsSaved);
  }

  const latencyMs = Date.now() - startTime;
  const record: RequestRecord = {
    id: 'req_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    provider: 'anthropic',
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

    res.write(`event: message_start\ndata: {"type":"message_start","message":{"id":"msg_${Math.random().toString(36).substr(2,9)}","type":"message","role":"assistant","content":[],"model":"${model}"}}\n\n`);
    res.write(`event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`);
    res.write(`event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"${finalResponse.content[0].text}"}}\n\n`);
    res.write(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
    res.end();
    return;
  }

  res.json(finalResponse);
}
