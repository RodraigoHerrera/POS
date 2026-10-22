import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryRateLimiter,
  getClientIp,
  rateLimitResponse,
  DUMMY_HASH,
} from "./rate-limit";

test("MemoryRateLimiter - sliding window checkRateLimit", () => {
  const limiter = new MemoryRateLimiter({ maxKeys: 100, sweepIntervalMs: 60_000 });
  const key = "test:ip:1";

  // Limit: 3 requests per 1000ms
  const r1 = limiter.checkRateLimit(key, 3, 1000);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);
  assert.equal(r1.currentCount, 1);
  assert.equal(r1.retryAfterSeconds, 0);

  const r2 = limiter.checkRateLimit(key, 3, 1000);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);
  assert.equal(r2.currentCount, 2);

  const r3 = limiter.checkRateLimit(key, 3, 1000);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);
  assert.equal(r3.currentCount, 3);

  // 4th request exceeds limit
  const r4 = limiter.checkRateLimit(key, 3, 1000);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.equal(r4.currentCount, 3);
  assert.ok(r4.retryAfterSeconds >= 1);

  limiter.stopSweep();
});

test("MemoryRateLimiter - isLocked and recordFailure", () => {
  const limiter = new MemoryRateLimiter({ maxKeys: 100, sweepIntervalMs: 60_000 });
  const key = "user:lock:1";

  // Initially not locked
  const initial = limiter.isLocked(key, 3, 5000);
  assert.equal(initial.locked, false);
  assert.equal(initial.remainingAttempts, 3);
  assert.equal(initial.retryAfterSeconds, 0);

  // Record 2 failures
  const f1 = limiter.recordFailure(key, 5000, 3);
  assert.equal(f1.allowed, true);
  assert.equal(f1.remaining, 2);

  const f2 = limiter.recordFailure(key, 5000, 3);
  assert.equal(f2.allowed, true);
  assert.equal(f2.remaining, 1);

  // Still not locked
  const mid = limiter.isLocked(key, 3, 5000);
  assert.equal(mid.locked, false);
  assert.equal(mid.remainingAttempts, 1);

  // 3rd failure locks out
  const f3 = limiter.recordFailure(key, 5000, 3);
  assert.equal(f3.allowed, false);
  assert.equal(f3.remaining, 0);
  assert.ok(f3.retryAfterSeconds >= 1);

  // isLocked now returns true
  const locked = limiter.isLocked(key, 3, 5000);
  assert.equal(locked.locked, true);
  assert.equal(locked.remainingAttempts, 0);
  assert.ok(locked.retryAfterSeconds >= 1);

  // Reset clears lockout
  limiter.reset(key);
  const afterReset = limiter.isLocked(key, 3, 5000);
  assert.equal(afterReset.locked, false);
  assert.equal(afterReset.remainingAttempts, 3);

  limiter.stopSweep();
});

test("MemoryRateLimiter - LRU capacity enforcement", () => {
  const limiter = new MemoryRateLimiter({ maxKeys: 3, sweepIntervalMs: 60_000 });

  limiter.checkRateLimit("k1", 10, 10000);
  limiter.checkRateLimit("k2", 10, 10000);
  limiter.checkRateLimit("k3", 10, 10000);
  assert.equal(limiter.size, 3);

  // Refresh k1 so k2 becomes the oldest
  limiter.checkRateLimit("k1", 10, 10000);

  // Insert k4, should evict k2
  limiter.checkRateLimit("k4", 10, 10000);
  assert.equal(limiter.size, 3);

  // k2 should be gone (fresh check will have currentCount 1)
  const k2Check = limiter.checkRateLimit("k2", 10, 10000);
  assert.equal(k2Check.currentCount, 1);

  limiter.stopSweep();
});

test("MemoryRateLimiter - sweep purges expired timestamps", () => {
  const limiter = new MemoryRateLimiter({ maxKeys: 100, sweepIntervalMs: 60_000 });

  limiter.checkRateLimit("sweepKey", 10, 10000);
  assert.equal(limiter.size, 1);

  // Sweep with maxRetentionMs = 0 to simulate expiration
  limiter.sweep(0);
  assert.equal(limiter.size, 0);

  limiter.stopSweep();
});

test("getClientIp - extracts client IP accurately", () => {
  // Test x-forwarded-for with multiple IPs
  const req1 = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
  });
  assert.equal(getClientIp(req1), "203.0.113.195");

  // Test x-real-ip
  const req2 = new Request("http://localhost/api/test", {
    headers: { "x-real-ip": " 198.51.100.42 " },
  });
  assert.equal(getClientIp(req2), "198.51.100.42");

  // Fallback to 127.0.0.1
  const req3 = new Request("http://localhost/api/test");
  assert.equal(getClientIp(req3), "127.0.0.1");
});

test("rateLimitResponse - formats 429 response correctly", async () => {
  const res = rateLimitResponse(15, "Demasiados intentos");
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "15");

  const body = await res.json();
  assert.equal(body.message, "Demasiados intentos");
  assert.equal(body.error, "Demasiados intentos");
});

test("DUMMY_HASH - valid bcrypt cost 10 hash", async () => {
  const bcrypt = await import("bcrypt");
  assert.ok(DUMMY_HASH.startsWith("$2b$10$"));
  const match = await bcrypt.compare("random_password_attempt", DUMMY_HASH);
  assert.equal(match, false);
});
