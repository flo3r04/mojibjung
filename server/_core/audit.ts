/**
 * AuditLog 적재 헬퍼.
 *
 * 두 컨텍스트 모두에서 호출 가능:
 *   - tRPC procedure 안 :  logAuditFromCtx(ctx, action, metadata?)
 *   - Express 핸들러 안  :  logAuditFromReq(req, { userId, action, metadata? })
 *
 * 정책
 *   - fire-and-forget — 호출 시 await 불필요. DB 실패는 console.error 로만 흔적.
 *   - 비즈니스 로직 흐름과 절대 분리.
 */

import type { Request } from "express";
import type { TrpcContext } from "./context";
import { insertAuditLog } from "../db";
import { getClientIp } from "./rateLimit";

/** 감사 액션 상수 — 카탈로그로 관리해 오타 방지 */
export const AuditAction = {
  // 인증
  LOGIN_KAKAO: "LOGIN_KAKAO",
  LOGIN_KAKAO_FAILED: "LOGIN_KAKAO_FAILED",
  LOGOUT: "LOGOUT",

  // 학교 이메일 인증
  EMAIL_VERIFY_REQUEST: "EMAIL_VERIFY_REQUEST",
  EMAIL_VERIFY_SUCCESS: "EMAIL_VERIFY_SUCCESS",
  EMAIL_VERIFY_FAIL: "EMAIL_VERIFY_FAIL",

  // 회원가입 완료
  REGISTER_COMPLETE: "REGISTER_COMPLETE",
  REGISTER_FAILED: "REGISTER_FAILED",

  // 관리자
  ADMIN_DELETE_USER: "ADMIN_DELETE_USER",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

function extractUserAgent(req: Request | TrpcContext["req"]): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

/** tRPC procedure 안에서 호출 — fire-and-forget */
export function logAuditFromCtx(
  ctx: TrpcContext,
  action: AuditActionType,
  metadata?: Record<string, unknown>
): void {
  void insertAuditLog({
    userId: ctx.user?.id ?? null,
    action,
    ipAddress: getClientIp(ctx.req),
    userAgent: extractUserAgent(ctx.req),
    metadata,
  });
}

/** Express 핸들러(OAuth 콜백 등)에서 호출 — fire-and-forget */
export function logAuditFromReq(
  req: Request,
  input: {
    userId?: number | null;
    action: AuditActionType;
    metadata?: Record<string, unknown>;
  }
): void {
  // Express Request 의 IP 추출 — getClientIp 가 TrpcContext["req"] 타입을
  // 기대하지만 헤더/socket 구조는 동일하므로 안전하게 캐스팅 가능
  void insertAuditLog({
    userId: input.userId ?? null,
    action: input.action,
    ipAddress: getClientIp(req as unknown as TrpcContext["req"]),
    userAgent: extractUserAgent(req),
    metadata: input.metadata,
  });
}
