import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export interface DailyUsageSnapshot {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  resetAtIso: string;
  dateUtc: string;
}

interface DailyUserRecord {
  dateUtc: string;
  lessonKeys: string[];
  updatedAt: number;
}

interface PersistedUsageFile {
  version: number;
  users: Record<string, DailyUserRecord>;
}

const DEFAULT_DAILY_LESSON_LIMIT = 5;
const CACHE_DIR = path.resolve(process.cwd(), '.smarted-cache');
const USAGE_FILE = path.join(CACHE_DIR, 'usage.json');
const DISK_FLUSH_DEBOUNCE_MS = 1000;

export function getConfiguredDailyLessonLimit(): number {
  const raw = process.env.DAILY_FREE_LESSON_LIMIT;
  if (!raw) return DEFAULT_DAILY_LESSON_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_DAILY_LESSON_LIMIT;
  return Math.min(1000, parsed);
}

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getNextUtcMidnightIso(date = new Date()): string {
  const next = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return next.toISOString();
}

export class UsageAndRateLimiter {
  private readonly dailyUsers = new Map<string, DailyUserRecord>();
  private readonly rateHits = new Map<string, number[]>();
  private readonly persistToDisk: boolean;
  private readonly storageFile: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private writeInProgress = false;
  private writeQueued = false;

  constructor(options?: { persistToDisk?: boolean; storageFile?: string }) {
    this.persistToDisk = options?.persistToDisk ?? true;
    this.storageFile = options?.storageFile ?? USAGE_FILE;
    if (this.persistToDisk) {
      this.loadFromDiskSync();
    }
  }

  private loadFromDiskSync(): void {
    try {
      if (!fs.existsSync(this.storageFile)) return;
      const raw = fs.readFileSync(this.storageFile, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as Partial<PersistedUsageFile>;
      if (!parsed.users || typeof parsed.users !== 'object') return;

      const today = getUtcDateKey();
      for (const [uid, rec] of Object.entries(parsed.users)) {
        if (
          rec &&
          typeof rec.dateUtc === 'string' &&
          rec.dateUtc === today &&
          Array.isArray(rec.lessonKeys)
        ) {
          this.dailyUsers.set(uid, {
            dateUtc: rec.dateUtc,
            lessonKeys: rec.lessonKeys.filter((k): k is string => typeof k === 'string'),
            updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now(),
          });
        }
      }
    } catch (err) {
      console.warn('SmartEd usage limiter disk load warning:', err);
    }
  }

  private scheduleDiskFlush(): void {
    if (!this.persistToDisk) return;
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
    if (!this.persistToDisk) return;
    if (this.writeInProgress) {
      this.writeQueued = true;
      return;
    }

    this.writeInProgress = true;
    try {
      const today = getUtcDateKey();
      const activeUsers: Record<string, DailyUserRecord> = {};
      for (const [uid, rec] of this.dailyUsers.entries()) {
        if (rec.dateUtc === today) {
          activeUsers[uid] = rec;
        }
      }

      await fsPromises.mkdir(path.dirname(this.storageFile), { recursive: true });
      const payload: PersistedUsageFile = {
        version: 1,
        users: activeUsers,
      };
      const tmpFile = `${this.storageFile}.tmp`;
      await fsPromises.writeFile(tmpFile, JSON.stringify(payload), 'utf8');
      await fsPromises.rename(tmpFile, this.storageFile);
    } catch (err) {
      console.warn('SmartEd usage limiter disk persistence warning:', err);
    } finally {
      this.writeInProgress = false;
      if (this.writeQueued) {
        this.writeQueued = false;
        void this.flushToDisk();
      }
    }
  }

  private getOrResetRecord(uid: string, now = new Date()): DailyUserRecord {
    const today = getUtcDateKey(now);
    const existing = this.dailyUsers.get(uid);
    if (existing && existing.dateUtc === today) {
      return existing;
    }
    const fresh: DailyUserRecord = {
      dateUtc: today,
      lessonKeys: [],
      updatedAt: now.getTime(),
    };
    this.dailyUsers.set(uid, fresh);
    return fresh;
  }

  getDailyUsage(uid: string, dailyLimit = getConfiguredDailyLessonLimit()): DailyUsageSnapshot {
    const now = new Date();
    const record = this.getOrResetRecord(uid, now);
    const usedToday = record.lessonKeys.length;
    return {
      dailyLimit,
      usedToday,
      remainingToday: Math.max(0, dailyLimit - usedToday),
      resetAtIso: getNextUtcMidnightIso(now),
      dateUtc: record.dateUtc,
    };
  }

  /**
   * Reserves a slot in the learner's daily lesson allowance.
   * Re-opening the same normalized lesson key on the same UTC day does not double-charge.
   */
  reserveDailyLessonSlot(
    uid: string,
    lessonKey: string,
    dailyLimit = getConfiguredDailyLessonLimit()
  ): {
    allowed: boolean;
    alreadyCountedToday: boolean;
    snapshot: DailyUsageSnapshot;
  } {
    const now = new Date();
    const record = this.getOrResetRecord(uid, now);

    if (record.lessonKeys.includes(lessonKey)) {
      return {
        allowed: true,
        alreadyCountedToday: true,
        snapshot: this.getDailyUsage(uid, dailyLimit),
      };
    }

    if (record.lessonKeys.length >= dailyLimit) {
      return {
        allowed: false,
        alreadyCountedToday: false,
        snapshot: this.getDailyUsage(uid, dailyLimit),
      };
    }

    record.lessonKeys.push(lessonKey);
    record.updatedAt = now.getTime();
    this.scheduleDiskFlush();

    return {
      allowed: true,
      alreadyCountedToday: false,
      snapshot: this.getDailyUsage(uid, dailyLimit),
    };
  }

  /**
   * Rolls back a newly reserved lesson slot if live AI generation fails with a server error.
   */
  releaseDailyLessonSlot(uid: string, lessonKey: string): void {
    const today = getUtcDateKey();
    const record = this.dailyUsers.get(uid);
    if (!record || record.dateUtc !== today) return;
    const idx = record.lessonKeys.lastIndexOf(lessonKey);
    if (idx !== -1) {
      record.lessonKeys.splice(idx, 1);
      record.updatedAt = Date.now();
      this.scheduleDiskFlush();
    }
  }

  /**
   * Endpoint-specific sliding-window rate limiter keyed by scope + uid/ip.
   */
  checkRateLimit(
    scope: string,
    actorKey: string,
    maxRequests: number,
    windowMs = 60_000
  ): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
    const now = Date.now();
    const cutoff = now - windowMs;
    const compositeKey = `${scope}:${actorKey}`;
    const existing = (this.rateHits.get(compositeKey) ?? []).filter((ts) => ts > cutoff);

    if (existing.length >= maxRequests) {
      this.rateHits.set(compositeKey, existing);
      const oldestTs = existing[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));
      return {
        allowed: false,
        retryAfterSeconds,
        remaining: 0,
      };
    }

    existing.push(now);
    this.rateHits.set(compositeKey, existing);

    if (this.rateHits.size > 10_000) {
      const oldestKey = this.rateHits.keys().next().value;
      if (oldestKey) this.rateHits.delete(oldestKey);
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, maxRequests - existing.length),
    };
  }
}

export const usageAndRateLimiter = new UsageAndRateLimiter();
