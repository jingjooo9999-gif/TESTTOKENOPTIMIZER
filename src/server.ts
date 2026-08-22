import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { handleOpenAIChatCompletions, handleOpenAIModels } from './proxy/openaiHandler';
import { handleAnthropicMessages } from './proxy/anthropicHandler';
import { statsStore } from './state/statsStore';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve static UI assets (support both src, dist, and electron runtimes)
  const fs = require('fs');
  const candidates = [
    path.join(__dirname, 'public'),
    path.join(__dirname, '../src/public'),
    path.join(__dirname, '../../src/public'),
    path.join(process.cwd(), 'src/public'),
    path.join(process.cwd(), 'dist/public')
  ];

  let publicDir = candidates.find(dir => fs.existsSync(path.join(dir, 'index.html'))) || path.join(process.cwd(), 'src/public');

  app.use('/dashboard', express.static(publicDir));
  app.use(express.static(publicDir));

  // Serve dashboard on root and /dashboard
  app.get(['/', '/dashboard', '/dashboard/'], (req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      settings: statsStore.getSettings()
    });
  });

  // 1. OpenAI Protocol Endpoints
  app.post('/v1/chat/completions', handleOpenAIChatCompletions);
  app.get('/v1/models', handleOpenAIModels);

  // 2. Anthropic Protocol Endpoints (for Claude Code)
  app.post('/v1/messages', handleAnthropicMessages);

  // 3. Management & Dashboard APIs
  app.get('/api/stats', (req: Request, res: Response) => {
    res.json({
      stats: statsStore.getStats(),
      recentRequests: statsStore.getRecentRequests(),
      settings: statsStore.getSettings()
    });
  });

  app.post('/api/settings', (req: Request, res: Response) => {
    const updated = statsStore.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  });

  app.post('/api/reset', (req: Request, res: Response) => {
    statsStore.resetStats();
    res.json({ success: true, message: 'Stats reset successfully' });
  });

  // 4. Server-Sent Events (SSE) for Real-Time Dashboard Updates
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      stats: statsStore.getStats(),
      recentRequests: statsStore.getRecentRequests(),
      settings: statsStore.getSettings()
    })}\n\n`);

    const onRequestRecorded = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'REQUEST', ...payload })}\n\n`);
    };

    const onSettingsUpdated = (settings: any) => {
      res.write(`data: ${JSON.stringify({ type: 'SETTINGS', settings })}\n\n`);
    };

    const onStatsReset = (stats: any) => {
      res.write(`data: ${JSON.stringify({ type: 'RESET', stats })}\n\n`);
    };

    statsStore.on('request_recorded', onRequestRecorded);
    statsStore.on('settings_updated', onSettingsUpdated);
    statsStore.on('stats_reset', onStatsReset);

    req.on('close', () => {
      statsStore.off('request_recorded', onRequestRecorded);
      statsStore.off('settings_updated', onSettingsUpdated);
      statsStore.off('stats_reset', onStatsReset);
    });
  });

  return app;
}
