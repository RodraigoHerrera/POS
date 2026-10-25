import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  jitter?: number;
  jitterRangeMs?: number;
  timeoutMs?: number;
  prismaClient?: any;
  sleepFn?: (ms: number) => Promise<void>;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Checks whether an error is caused by an InnoDB deadlock or lock wait timeout.
 * Returns false if the error represents business-rule stock insufficiency.
 */
export function isDeadlockError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Record<string, any>;
  const message = typeof err.message === 'string' ? err.message : '';

  // Stock shortfalls must fail fast and not be treated as deadlocks
  if (
    message.startsWith('Stock insuficiente') ||
    message.startsWith('No hay suficiente stock')
  ) {
    return false;
  }

  // Prisma write conflict or deadlock error code
  if (err.code === 'P2034') {
    return true;
  }

  // MySQL deadlock and lock wait timeout error codes
  // 1213 = ER_LOCK_DEADLOCK, 1205 = ER_LOCK_WAIT_TIMEOUT
  const candidates = [
    err.code,
    err.errno,
    err.cause?.code,
    err.cause?.errno,
    err.meta?.code,
    err.meta?.errno,
  ];

  for (const code of candidates) {
    if (
      code === 1213 ||
      code === '1213' ||
      code === 1205 ||
      code === '1205' ||
      code === 'ER_LOCK_DEADLOCK' ||
      code === 'ER_LOCK_WAIT_TIMEOUT'
    ) {
      return true;
    }
  }

  // String match on error message
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('deadlock') ||
    lowerMsg.includes('lock wait timeout') ||
    lowerMsg.includes('try restarting transaction') ||
    lowerMsg.includes('1213') ||
    lowerMsg.includes('1205')
  ) {
    return true;
  }

  return false;
}

/**
 * Computes an exponential delay with randomized jitter:
 * Math.max(0, Math.round(baseDelayMs * Math.pow(factor, attempt) + jitter))
 */
export function calculateJitteredBackoff(
  attempt: number,
  options?: RetryOptions
): number {
  const baseDelayMs = options?.baseDelayMs ?? 50;
  const factor = options?.factor ?? 2;
  const maxDelayMs = options?.maxDelayMs;

  let jitter: number;
  if (options?.jitter !== undefined) {
    jitter = options.jitter;
  } else {
    const range = options?.jitterRangeMs ?? baseDelayMs * 0.5;
    jitter = (Math.random() * 2 - 1) * range;
  }

  const raw = Math.round(baseDelayMs * Math.pow(factor, attempt) + jitter);
  const result = Math.max(0, raw);
  return maxDelayMs !== undefined ? Math.min(maxDelayMs, result) : result;
}

/**
 * Executes a transaction with automatic retry on InnoDB deadlocks (code 1213 / P2034)
 * and lock wait timeouts (code 1205) using exponential backoff with jitter.
 */
export async function runWithRetry<T>(
  txFn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 15000;
  const client = options?.prismaClient ?? prisma;
  const sleep = options?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let attempt = 0;
  while (true) {
    try {
      return await client.$transaction(txFn, { timeout: timeoutMs });
    } catch (error: any) {
      if (attempt >= maxRetries || !isDeadlockError(error)) {
        throw error;
      }

      const delayMs = calculateJitteredBackoff(attempt, options);
      if (options?.onRetry) {
        options.onRetry(error, attempt, delayMs);
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }

      attempt++;
    }
  }
}
