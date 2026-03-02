import { Injectable } from '@nestjs/common';

interface RateLimitBucket {
  windowStartMs: number;
  count: number;
  lastSeenMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAtMs: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastPruneAtMs = 0;

  consume(key: string, limit: number, windowMs = 60_000): RateLimitDecision {
    const now = Date.now();
    const boundedLimit = Math.max(1, Math.floor(limit));
    const boundedWindow = Math.max(1_000, Math.floor(windowMs));
    let bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStartMs >= boundedWindow) {
      bucket = {
        windowStartMs: now,
        count: 0,
        lastSeenMs: now
      };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    bucket.lastSeenMs = now;

    this.pruneIfNeeded(now, boundedWindow);

    const allowed = bucket.count <= boundedLimit;
    return {
      allowed,
      remaining: Math.max(0, boundedLimit - bucket.count),
      limit: boundedLimit,
      resetAtMs: bucket.windowStartMs + boundedWindow
    };
  }

  private pruneIfNeeded(now: number, windowMs: number): void {
    if (this.buckets.size < 10_000) return;
    if (now - this.lastPruneAtMs < windowMs) return;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastSeenMs > windowMs * 2) {
        this.buckets.delete(key);
      }
    }
    this.lastPruneAtMs = now;
  }
}

