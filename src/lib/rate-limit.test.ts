import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryRateLimiter,
  getClientIp,
  rateLimitResponse,
  DUMMY_HASH,
  clavePinEmpleado,
  limitesRelajados,
  checkRateLimit,
  isLocked,
  recordFailure,
  reset,
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

test("getClientIp - without a trusted proxy ignores client-supplied IP headers", () => {
  const spoofed = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "203.0.113.195", "x-real-ip": "198.51.100.42" },
  });
  assert.equal(getClientIp(spoofed, false), "127.0.0.1");

  const plain = new Request("http://localhost/api/test");
  assert.equal(getClientIp(plain, false), "127.0.0.1");
});

test("getClientIp - behind a trusted proxy uses the last x-forwarded-for entry", () => {
  // The proxy appends the address it saw; earlier entries come from the client
  const req = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.195" },
  });
  assert.equal(getClientIp(req, true), "203.0.113.195");

  const single = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": " 150.172.238.178 " },
  });
  assert.equal(getClientIp(single, true), "150.172.238.178");
});

test("getClientIp - behind a trusted proxy falls back to x-real-ip, then 127.0.0.1", () => {
  const realIp = new Request("http://localhost/api/test", {
    headers: { "x-real-ip": " 198.51.100.42 " },
  });
  assert.equal(getClientIp(realIp, true), "198.51.100.42");

  const plain = new Request("http://localhost/api/test");
  assert.equal(getClientIp(plain, true), "127.0.0.1");
});

test("getClientIp - trust defaults to the TRUST_PROXY env var", () => {
  const req = new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": "203.0.113.195" },
  });
  const previo = process.env.TRUST_PROXY;
  try {
    delete process.env.TRUST_PROXY;
    assert.equal(getClientIp(req), "127.0.0.1");
    process.env.TRUST_PROXY = "true";
    assert.equal(getClientIp(req), "203.0.113.195");
  } finally {
    if (previo === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previo;
  }
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

test("clavePinEmpleado - scopes the PIN lockout key by branch", () => {
  assert.notEqual(clavePinEmpleado("1", "42"), clavePinEmpleado("2", "42"));
  assert.equal(clavePinEmpleado("1", "42"), clavePinEmpleado("1", "42"));
  // Ambiguous concatenations must not collide ("1"+"12" vs "11"+"2")
  assert.notEqual(clavePinEmpleado("1", "12"), clavePinEmpleado("11", "2"));
});

test("clavePinEmpleado - failures from another branch do not lock the employee out", () => {
  const limiter = new MemoryRateLimiter({ maxKeys: 100, sweepIntervalMs: 60_000 });
  const desdeOtraSucursal = clavePinEmpleado("1", "42");
  for (let i = 0; i < 5; i++) limiter.recordFailure(desdeOtraSucursal, 15 * 60 * 1000, 5);

  assert.equal(limiter.isLocked(desdeOtraSucursal, 5, 15 * 60 * 1000).locked, true);
  assert.equal(limiter.isLocked(clavePinEmpleado("2", "42"), 5, 15 * 60 * 1000).locked, false);
});

const URL_TEST = "mysql://u:p@localhost:3306/smash_test";

test("limitesRelajados - solo con la bandera Y una BD _test", () => {
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: URL_TEST }), true);
  assert.equal(
    limitesRelajados({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: "mysql://u:p@localhost:3306/smash_test?connect_timeout=30" }),
    true
  );
});

test("limitesRelajados - la bandera sin BD _test no relaja (produccion/dev)", () => {
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: "mysql://u:p@localhost:3306/smash" }), false);
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: "mysql://u:p@localhost:3306/_test" }), false);
});

test("limitesRelajados - una BD _test sin la bandera exacta no relaja", () => {
  assert.equal(limitesRelajados({ DATABASE_URL: URL_TEST }), false);
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "1", DATABASE_URL: URL_TEST }), false);
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "false", DATABASE_URL: URL_TEST }), false);
});

test("limitesRelajados - URL ausente o malformada no relaja y no lanza", () => {
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "true" }), false);
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: "no es una url" }), false);
  assert.equal(limitesRelajados({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: "" }), false);
});

function conEntorno(valores: Record<string, string | undefined>, fn: () => void) {
  const previo = { RATE_LIMIT_RELAXED: process.env.RATE_LIMIT_RELAXED, DATABASE_URL: process.env.DATABASE_URL };
  try {
    for (const [k, v] of Object.entries(valores)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(previo)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("helpers - con limites relajados una clave supera el limite base", () => {
  conEntorno({ RATE_LIMIT_RELAXED: "true", DATABASE_URL: URL_TEST }, () => {
    const clave = "relajado:ip:1";
    for (let i = 0; i < 50; i++) assert.equal(checkRateLimit(clave, 15, 60_000).allowed, true);
    reset(clave);

    const email = "relajado:email:1";
    for (let i = 0; i < 20; i++) recordFailure(email, 60_000, 5);
    assert.equal(isLocked(email, 5, 60_000).locked, false);
    reset(email);
  });
});

test("helpers - sin relajar el limite base sigue bloqueando", () => {
  conEntorno({ RATE_LIMIT_RELAXED: undefined, DATABASE_URL: URL_TEST }, () => {
    const clave = "base:ip:1";
    for (let i = 0; i < 15; i++) assert.equal(checkRateLimit(clave, 15, 60_000).allowed, true);
    assert.equal(checkRateLimit(clave, 15, 60_000).allowed, false);
    reset(clave);

    const email = "base:email:1";
    for (let i = 0; i < 5; i++) recordFailure(email, 60_000, 5);
    assert.equal(isLocked(email, 5, 60_000).locked, true);
    reset(email);
  });
});
