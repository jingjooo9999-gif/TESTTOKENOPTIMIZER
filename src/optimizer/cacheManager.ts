import crypto from 'crypto';

export interface CacheEntry {
  response: any;
  createdAt: number;
  model: string;
  originalTokens: number;
  dollarsSaved: number;
  hitCount: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTTLMs: number;

  constructor(maxEntries = 1000, defaultTTLHours = 24) {
    this.maxEntries = maxEntries;
    this.defaultTTLMs = defaultTTLHours * 60 * 60 * 1000;
  }

  /**
   * Generates a deterministic hash for a given prompt payload
   */
  public generateKey(model: string, messages: any[], system?: string): string {
    const payload = JSON.stringify({
      model: model.toLowerCase(),
      system: system || '',
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Retrieves a cached response if valid
   */
  public get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.createdAt > this.defaultTTLMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount += 1;
    return entry;
  }

  /**
   * Stores a response in the cache
   */
  public set(
    key: string,
    response: any,
    model: string,
    originalTokens: number,
    dollarsSaved: number
  ): void {
    // Evict oldest if full
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      response,
      createdAt: Date.now(),
      model,
      originalTokens,
      dollarsSaved,
      hitCount: 0
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const localCache = new CacheManager();
