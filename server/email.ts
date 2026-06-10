/**
 * 학교 이메일 인증 — 코드 생성 / 해시 저장 / 발송 / 검증
 *
 * 보안 정책 (0005_auth_redesign 기준)
 *   - 도메인 강제: @hufs.ac.kr (대소문자 무시)
 *   - 6자리 숫자 코드, SHA-256 해시로 DB 저장 (평문 미저장)
 *   - 만료: 5분
 *   - attempts: 최대 5회 (초과 시 VERIFICATION_ATTEMPTS_EXCEEDED)
 *   - 1회용: consumedAt 마킹 후 같은 row 재사용 불가
 */

import crypto from "node:crypto";
import dns from "node:dns";
import nodemailer, { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { Resend } from "resend";
import { ENV, isEmailConfigured, isSmtpConfigured } from "./_core/env";

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────

export const HUFS_DOMAIN = "@hufs.ac.kr";
export const CODE_TTL_MS = 5 * 60_000; // 5분
export const MAX_ATTEMPTS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeSchoolEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  if (!trimmed.endsWith(HUFS_DOMAIN)) return null;
  return trimmed;
}

export function generateCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function verifyCodeHash(plain: string, stored: string): boolean {
  const a = Buffer.from(hashCode(plain), "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients — Lazy Loading
// ─────────────────────────────────────────────────────────────────────────────

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!ENV.resendApiKey) return null;
  if (!_resend) _resend = new Resend(ENV.resendApiKey);
  return _resend;
}

let _transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  if (!isSmtpConfigured()) return null;

  // SMTPTransport.Options 타입에는 lookup 이 노출되지 않지만 nodemailer 는 net.Socket 옵션을
  // 그대로 전달하므로 동작은 정상. 타입만 우회한다.
  const options: SMTPTransport.Options = {
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpSecure,
    auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
  // IPv4 우선 lookup — nodemailer 가 내부적으로 net.connect 에 넘긴다.
  (options as any).lookup = (hostname: string, _opts: unknown, callback: any) => {
    dns.lookup(hostname, { family: 4 }, callback);
  };
  _transporter = nodemailer.createTransport(options);
  return _transporter;
}

/** 이메일 발송 상태 조회 — 관리자 디버깅용 (routers.ts 에서 사용) */
export async function getSmtpStatus(): Promise<{
  configured: boolean;
  ready: boolean;
  error?: string;
  method?: string;
}> {
  const resend = getResend();
  if (resend) {
    return { configured: true, ready: true, method: "resend" };
  }
  if (!isSmtpConfigured()) {
    return { configured: false, ready: false };
  }
  const t = getTransporter();
  if (!t) return { configured: true, ready: false };
  try {
    await t.verify();
    return { configured: true, ready: true, method: "smtp" };
  } catch (e) {
    return { configured: true, ready: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 발송
// ─────────────────────────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<void> {
  const ttlMinutes = Math.floor(CODE_TTL_MS / 60_000);
  const subject = "[모집중] 학교 이메일 인증 코드";
  const text = [
    "안녕하세요, 모집중 입니다.",
    "",
    "회원가입 인증 코드는 아래와 같습니다.",
    "",
    `    인증 코드: ${code}`,
    "",
    `이 코드는 ${ttlMinutes}분 동안 유효합니다.`,
    "본인이 요청하지 않았다면 이 메일을 무시하세요.",
    "",
    "— 모집중 운영팀",
  ].join("\n");

  // 1. Resend API 우선 (Render 호환성 최고)
  const resend = getResend();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: ENV.resendFrom,
        to,
        subject,
        text,
      });
      if (error) throw error;
      console.log(`[email] Resend 발송 성공: to=${to}`);
      return;
    } catch (e) {
      console.error("[email] Resend 발송 실패:", e);
      // 실패 시 SMTP 로 폴백 시도
    }
  }

  // 2. SMTP 폴백 (로컬 환경 등)
  const transporter = getTransporter();
  if (transporter) {
    await transporter.sendMail({
      from: ENV.smtpFrom,
      to,
      subject,
      text,
    });
    console.log(`[email] SMTP 발송 성공: to=${to}`);
    return;
  }

  // 3. 둘 다 없으면 콘솔 출력 (개발용)
  console.warn(`[email] 발송 수단 없음 — 콘솔 출력. to=${to}, code=${code}`);
}
