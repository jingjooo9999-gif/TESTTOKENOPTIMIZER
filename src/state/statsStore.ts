import { EventEmitter } from 'events';

export interface RequestRecord {
  id: string;
  timestamp: string;
  provider: 'openai' | 'anthropic';
  model: string;
  originalTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  percentageSaved: number;
  dollarsSaved: number;
  latencyMs: number;
  cached: boolean;
  rulesApplied: string[];
  promptPreview: string;
}

export interface OptimizerSettings {
  enableLogCleaner: boolean;
  enablePromptMinifier: boolean;
  enableSmartCache: boolean;
  simulationMode: boolean; // Allows testing without live OpenAI/Anthropic API keys
  port: number;
}

export interface OverallStats {
  totalRequests: number;
  totalOriginalTokens: number;
  totalOptimizedTokens: number;
  totalSavedTokens: number;
  totalDollarsSaved: number;
  totalCacheHits: number;
  averagePercentageSaved: number;
}

class StatsStore extends EventEmitter {
  private stats: OverallStats = {
    totalRequests: 0,
    totalOriginalTokens: 0,
    totalOptimizedTokens: 0,
    totalSavedTokens: 0,
    totalDollarsSaved: 0,
    totalCacheHits: 0,
    averagePercentageSaved: 0
  };

  private recentRequests: RequestRecord[] = [];
  private settings: OptimizerSettings = {
    enableLogCleaner: true,
    enablePromptMinifier: true,
    enableSmartCache: true,
    simulationMode: true,
    port: 8080
  };

  public getStats(): OverallStats {
    return { ...this.stats };
  }

  public getRecentRequests(): RequestRecord[] {
    return [...this.recentRequests];
  }

  public getSettings(): OptimizerSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<OptimizerSettings>): OptimizerSettings {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settings_updated', this.settings);
    return this.settings;
  }

  public recordRequest(record: RequestRecord): void {
    this.stats.totalRequests += 1;
    this.stats.totalOriginalTokens += record.originalTokens;
    this.stats.totalOptimizedTokens += record.optimizedTokens;
    this.stats.totalSavedTokens += record.savedTokens;
    this.stats.totalDollarsSaved += record.dollarsSaved;
    this.stats.totalDollarsSaved = Number(this.stats.totalDollarsSaved.toFixed(5));

    if (record.cached) {
      this.stats.totalCacheHits += 1;
    }

    if (this.stats.totalOriginalTokens > 0) {
      this.stats.averagePercentageSaved = Math.round(
        (this.stats.totalSavedTokens / this.stats.totalOriginalTokens) * 100
      );
    }

    // Keep last 50 requests
    this.recentRequests.unshift(record);
    if (this.recentRequests.length > 50) {
      this.recentRequests.pop();
    }

    // Broadcast to SSE clients
    this.emit('request_recorded', {
      stats: this.getStats(),
      newRecord: record
    });
  }

  public resetStats(): void {
    this.stats = {
      totalRequests: 0,
      totalOriginalTokens: 0,
      totalOptimizedTokens: 0,
      totalSavedTokens: 0,
      totalDollarsSaved: 0,
      totalCacheHits: 0,
      averagePercentageSaved: 0
    };
    this.recentRequests = [];
    this.emit('stats_reset', this.getStats());
  }
}

export const statsStore = new StatsStore();
