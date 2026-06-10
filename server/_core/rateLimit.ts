/**
 * 메모리 기반 Sliding Window Rate Limiter
 *
 * 단일 인스턴스 운영 전제(현 Render free-tier 환경). 멀티 인스턴스 또는
 * 무중단 배포로 인스턴스가 교체되면 Redis 기반으로 옮길 필요가 있다.
 *
 * 사용 패턴
 *   라우터 내부에서 input 의 이메일 또는 IP 키로 직접 호출.
 *   tRPC 미들웨어 형태가 필요해지면 trpc.ts 의 t 인스턴스에서 정의해 사용한다.
 *
 *   const r = consume(`email-verify-send:${email}`, 5, 60 * 60_000);
 *   if (!r.ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: ... });
 */

import type { TrpcContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// 내부 저장소 — 키별 요청 타임스탬프 배열
// ─────────────────────────────────────────────────────────────────────────────

const buckets = new Map<string, number[]>();

/**
 * 단일 키에 대해 윈도우 내 요청 1건을 차감 시도한다.
 * @returns ok=false 이면 retryAfterSec 후 재시도 가능
 */
export function consume(
  key: string,
  max: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const arr = buckets.get(key) ?? [];

  // 윈도우 밖의 타임스탬프 제거
  const fresh: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (now - arr[i] < windowMs) fresh.push(arr[i]);
  }

  if (fresh.length >= max) {
    const oldest = fresh[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, fresh); // 정리된 상태는 저장
    return { ok: false, retryAfterSec };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true };
}

/**
 * 여러 윈도우(분/시간/일) 제한을 한 번에 검사한다.
 * 가장 먼저 위반되는 제한의 retryAfterSec 를 반환.
 */
export function consumeMulti(
  baseKey: string,
  rules: Array<{ max: number; windowMs: number; label?: string }>
): { ok: true } | { ok: false; retryAfterSec: number; rule: string } {
  for (const rule of rules) {
    const key = rule.label ? `${baseKey}:${rule.label}` : `${baseKey}:${rule.windowMs}`;
    const r = consume(key, rule.max, rule.windowMs);
    if (!r.ok) {
      return { ok: false, retryAfterSec: r.retryAfterSec, rule: rule.label ?? String(rule.windowMs) };
    }
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 주기적 정리 — 메모리 누수 방지
// (각 키의 가장 최근 요청이 가장 긴 윈도우보다 더 오래됐다면 키 자체 삭제)
// ─────────────────────────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 10 * 60_000; // 10분
const MAX_KEY_AGE_MS = 24 * 60 * 60_000; // 24시간

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    // forEach 로 변환 — Map.entries() 의 iteration 호환성 회피
    buckets.forEach((arr, key) => {
      const newest = arr[arr.length - 1] ?? 0;
      if (now - newest > MAX_KEY_AGE_MS) buckets.delete(key);
    });
  }, CLEANUP_INTERVAL_MS);
  // Node 종료 막지 않도록
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer!) {
    (cleanupTimer as any).unref?.();
  }
}
startCleanup();

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** 요청 IP 주소 추출 (proxy 환경 고려) */
export function getClientIp(req: TrpcContext["req"]): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]!.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0]!.split(",")[0]!.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

/**
 * 테스트 / 관리자 도구용 — 모든 버킷 초기화
 */
export function resetAllRateLimits(): void {
  buckets.clear();
}
