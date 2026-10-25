import { NextResponse } from "next/server";

export const DUMMY_HASH = "$2b$10$wT4n4N64vX9y3F5G7H8I9OeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export interface RateLimitRecord {
  timestamps: number[];
  lastAccessed: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  currentCount: number;
}

export interface LockoutResult {
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

export interface RateLimiterOptions {
  maxKeys?: number;
  sweepIntervalMs?: number;
}

export class MemoryRateLimiter {
  private store: Map<string, RateLimitRecord>;
  private maxKeys: number;
  private sweepIntervalMs: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.store = new Map();
    this.maxKeys = options.maxKeys ?? 10_000;
    this.sweepIntervalMs = options.sweepIntervalMs ?? 300_000;
    this.startSweepTimer();
  }

  private startSweepTimer(): void {
    this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
    if (this.sweepTimer && typeof this.sweepTimer.unref === "function") {
      this.sweepTimer.unref();
    }
  }

  public stopSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  public get size(): number {
    return this.store.size;
  }

  private enforceCapacity(): void {
    while (this.store.size > this.maxKeys) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
  }

  public sweep(maxRetentionMs: number = 900_000): void {
    const cutoff = Date.now() - maxRetentionMs;
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  public checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const cutoff = now - windowMs;
    let record = this.store.get(key);

    if (!record) {
      record = { timestamps: [], lastAccessed: now };
    } else {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
    }
    record.lastAccessed = now;

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0];
      const retryAfterMs = Math.max(0, oldest + windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      this.store.delete(key);
      this.store.set(key, record);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        currentCount: record.timestamps.length,
      };
    }

    record.timestamps.push(now);
    this.store.delete(key);
    this.store.set(key, record);
    this.enforceCapacity();

    return {
      allowed: true,
      remaining: Math.max(0, limit - record.timestamps.length),
      retryAfterSeconds: 0,
      currentCount: record.timestamps.length,
    };
  }

  public isLocked(key: string, limit: number, lockoutMs: number): LockoutResult {
    const now = Date.now();
    const cutoff = now - lockoutMs;
    const record = this.store.get(key);

    if (!record) {
      return { locked: false, retryAfterSeconds: 0, remainingAttempts: limit };
    }

    record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
    record.lastAccessed = now;
    this.store.delete(key);
    this.store.set(key, record);

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0];
      const retryAfterMs = Math.max(0, oldest + lockoutMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return {
        locked: true,
        retryAfterSeconds,
        remainingAttempts: 0,
      };
    }

    return {
      locked: false,
      retryAfterSeconds: 0,
      remainingAttempts: Math.max(0, limit - record.timestamps.length),
    };
  }

  public recordFailure(key: string, windowMs: number, limit: number = 5): RateLimitResult {
    const now = Date.now();
    const cutoff = now - windowMs;
    let record = this.store.get(key);

    if (!record) {
      record = { timestamps: [], lastAccessed: now };
    } else {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
    }

    record.timestamps.push(now);
    record.lastAccessed = now;
    this.store.delete(key);
    this.store.set(key, record);
    this.enforceCapacity();

    const isLocked = record.timestamps.length >= limit;
    let retryAfterSeconds = 0;
    if (isLocked) {
      const oldest = record.timestamps[0];
      const retryAfterMs = Math.max(0, oldest + windowMs - now);
      retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    }

    return {
      allowed: !isLocked,
      remaining: Math.max(0, limit - record.timestamps.length),
      retryAfterSeconds,
      currentCount: record.timestamps.length,
    };
  }

  public reset(key: string): void {
    this.store.delete(key);
  }

  public clearRateLimit(key: string): void {
    this.reset(key);
  }

  public formatResponse(message: string, retryAfter: number): NextResponse {
    return rateLimitResponse(retryAfter, message);
  }
}

// Global Singleton
export const rateLimiter = new MemoryRateLimiter();

// Exported Helper Functions
/**
 * Clave del bloqueo por PIN fallido. Va acotada por sucursal: sin eso, una
 * terminal de otra sucursal podía bloquear a cualquier empleado por su id.
 */
export function clavePinEmpleado(sucursalId: string, empleadoId: string): string {
  return `emp:pin:${sucursalId}:${empleadoId}`;
}

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) {
    const trimmed = xRealIp.trim();
    if (trimmed) return trimmed;
  }
  return "127.0.0.1";
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return rateLimiter.checkRateLimit(key, limit, windowMs);
}

export function isLocked(key: string, limit: number, lockoutMs: number): LockoutResult {
  return rateLimiter.isLocked(key, limit, lockoutMs);
}

export function recordFailure(key: string, windowMs: number, limit: number = 5): RateLimitResult {
  return rateLimiter.recordFailure(key, windowMs, limit);
}

export function clearRateLimit(key: string): void {
  rateLimiter.reset(key);
}

export function reset(key: string): void {
  rateLimiter.reset(key);
}

export function rateLimitResponse(retryAfter: number, message: string): NextResponse {
  const retryAfterSeconds =
    retryAfter > 1000 ? Math.ceil(retryAfter / 1000) : Math.max(1, Math.ceil(retryAfter));

  return NextResponse.json(
    { message, error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
