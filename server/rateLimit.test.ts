import { describe, it, expect, beforeEach } from "vitest";
import { consume, consumeMulti, resetAllRateLimits } from "./_core/rateLimit";

describe("rateLimit.ts — consume (sliding window)", () => {
  beforeEach(() => resetAllRateLimits());

  it("max 3 / 1000ms 윈도우에서 4번째 요청부터 거부", () => {
    const key = "test-key-1";
    expect(consume(key, 3, 1000).ok).toBe(true);
    expect(consume(key, 3, 1000).ok).toBe(true);
    expect(consume(key, 3, 1000).ok).toBe(true);
    const r = consume(key, 3, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("키가 다르면 카운터가 독립", () => {
    expect(consume("alice", 1, 1000).ok).toBe(true);
    expect(consume("alice", 1, 1000).ok).toBe(false);
    expect(consume("bob", 1, 1000).ok).toBe(true);
  });

  it("윈도우가 지나면 다시 통과 (대기 후 재시도)", async () => {
    const key = "test-key-2";
    expect(consume(key, 1, 50).ok).toBe(true);
    expect(consume(key, 1, 50).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    expect(consume(key, 1, 50).ok).toBe(true);
  });
});

describe("rateLimit.ts — consumeMulti (다중 윈도우)", () => {
  beforeEach(() => resetAllRateLimits());

  it("두 윈도우 모두 통과하면 ok", () => {
    const r = consumeMulti("multi-1", [
      { max: 10, windowMs: 60_000, label: "hour" },
      { max: 100, windowMs: 24 * 60 * 60_000, label: "day" },
    ]);
    expect(r.ok).toBe(true);
  });

  it("하나라도 한도 초과면 fail + 위반 rule 라벨 반환", () => {
    // hour 한도 1 로 빡빡하게
    consume("multi-2:hour", 1, 60_000);
    const r = consumeMulti("multi-2", [
      { max: 1, windowMs: 60_000, label: "hour" },
      { max: 100, windowMs: 24 * 60 * 60_000, label: "day" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.rule).toBe("hour");
      expect(r.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
