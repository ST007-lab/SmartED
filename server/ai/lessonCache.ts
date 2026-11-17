import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { KnowledgeLevel, LessonGenerationResult } from '../types.ts';

interface CachedLessonEntry {
  key: string;
  result: LessonGenerationResult;
  cachedAt: number;
  lastAccessedAt: number;
  hits: number;
}

interface PersistedCacheFile {
  version: number;
  entries: CachedLessonEntry[];
}

const MAX_CACHE_ENTRIES = 1000;
const CACHE_DIR = path.resolve(process.cwd(), '.smarted-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'lessons.json');
const DISK_FLUSH_DEBOUNCE_MS = 1200;

function normalizeText(value?: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildLessonCacheKey(params: {
  topic: string;
  level: KnowledgeLevel;
  language: string;
  objective?: string;
  providerScope: string;
}): string {
  return JSON.stringify([
    normalizeText(params.topic),
    params.level,
    normalizeText(params.language) || 'english',
    normalizeText(params.objective),
    params.providerScope,
  ]);
}

function cloneLessonResult(
  result: LessonGenerationResult,
  markCached: boolean
): LessonGenerationResult {
  const cloned = structuredClone(result);
  if (markCached) {
    cloned.meta = {
      ...cloned.meta,
      cached: true,
    };
  }
  return cloned;
}

class SharedLessonCache {
  private readonly store = new Map<string, CachedLessonEntry>();
  private readonly inFlight = new Map<string, Promise<LessonGenerationResult>>();
  private flushTimer: NodeJS.Timeout | null = null;
  private writeInProgress = false;
  private writeQueued = false;

  constructor() {
    this.loadFromDiskSync();
  }

  private loadFromDiskSync(): void {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as Partial<PersistedCacheFile>;
      if (!Array.isArray(parsed.entries)) return;

      for (const entry of parsed.entries) {
        if (
          entry &&
          typeof entry.key === 'string' &&
          entry.result &&
          entry.result.lesson &&
          entry.result.meta
        ) {
          this.store.set(entry.key, {
            key: entry.key,
            result: entry.result,
            cachedAt: typeof entry.cachedAt === 'number' ? entry.cachedAt : Date.now(),
            lastAccessedAt:
              typeof entry.lastAccessedAt === 'number'
                ? entry.lastAccessedAt
                : Date.now(),
            hits: typeof entry.hits === 'number' ? entry.hits : 0,
          });
        }
      }

      this.evictIfNeeded();
    } catch (err) {
      console.warn('SmartEd lesson cache could not be loaded from disk:', err);
    }
  }

  private evictIfNeeded(): void {
    while (this.store.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
  }

  private scheduleDiskFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushToDisk();
    }, DISK_FLUSH_DEBOUNCE_MS);
    this.flushTimer.unref?.();
  }

  private async flushToDisk(): Promise<void> {
    if (this.writeInProgress) {
      this.writeQueued = true;
      return;
    }

    this.writeInProgress = true;
    try {
      await fsPromises.mkdir(CACHE_DIR, { recursive: true });
      const payload: PersistedCacheFile = {
        version: 1,
        entries: Array.from(this.store.values()),
      };
      const tmpFile = `${CACHE_FILE}.tmp`;
      await fsPromises.writeFile(tmpFile, JSON.stringify(payload), 'utf8');
      await fsPromises.rename(tmpFile, CACHE_FILE);
    } catch (err) {
      console.warn('SmartEd lesson cache disk persistence warning:', err);
    } finally {
      this.writeInProgress = false;
      if (this.writeQueued) {
        this.writeQueued = false;
        void this.flushToDisk();
      }
    }
  }

  get(key: string): LessonGenerationResult | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Refresh LRU order
    entry.lastAccessedAt = Date.now();
    entry.hits += 1;
    this.store.delete(key);
    this.store.set(key, entry);

    return cloneLessonResult(entry.result, true);
  }

  set(key: string, result: LessonGenerationResult): void {
    const cleanResult = cloneLessonResult(result, false);
    if (cleanResult.meta.cached !== undefined) {
      delete cleanResult.meta.cached;
    }

    const now = Date.now();
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, {
      key,
      result: cleanResult,
      cachedAt: now,
      lastAccessedAt: now,
      hits: 0,
    });

    this.evictIfNeeded();
    this.scheduleDiskFlush();
  }

  async getOrGenerate(
    key: string,
    generator: () => Promise<LessonGenerationResult>
  ): Promise<{ result: LessonGenerationResult; cacheHit: boolean }> {
    const cached = this.get(key);
    if (cached) {
      return { result: cached, cacheHit: true };
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      const sharedResult = await existingPromise;
      return {
        result: cloneLessonResult(sharedResult, true),
        cacheHit: true,
      };
    }

    const generationPromise = (async () => {
      const generated = await generator();
      if (generated?.lesson && generated?.meta) {
        this.set(key, generated);
      }
      return generated;
    })();

    this.inFlight.set(key, generationPromise);
    try {
      const fresh = await generationPromise;
      return {
        result: cloneLessonResult(fresh, false),
        cacheHit: false,
      };
    } finally {
      this.inFlight.delete(key);
    }
  }

  size(): number {
    return this.store.size;
  }
}

export const sharedLessonCache = new SharedLessonCache();
