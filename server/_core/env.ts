/**
 * 환경변수 통합 게이트웨이.
 * 모든 모듈은 process.env 를 직접 읽지 않고 이 파일을 통해 접근한다.
 */

const isProd = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────────────────────
// 기본 값들
// ─────────────────────────────────────────────────────────────────────────────

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: isProd,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? "모집중 <noreply@moji.local>",

  // ─── SMTP ────────────────────────────────────────────────────────────────
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "모집중 <noreply@moji.local>",
  smtpSecure: process.env.SMTP_SECURE === "true",

  // ─── CORS ────────────────────────────────────────────────────────────────
  // 쉼표로 구분된 출처 목록 (예: "https://mojijung.com,https://www.mojijung.com")
  // 비어 있으면: 개발 = 모든 출처 허용 / 운영 = same-origin 만 (외부 출처 거부)
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

// ─────────────────────────────────────────────────────────────────────────────
// JWT — 운영에서는 폴백 금지
// ─────────────────────────────────────────────────────────────────────────────

const DEV_JWT_FALLBACK = "dev_secret_key_change_me_in_prod";

/** 운영에서 JWT_SECRET 이 없으면 즉시 throw — 부트업 검증용 */
export function assertJwtSecretConfigured(): void {
  if (!process.env.JWT_SECRET) {
    if (isProd) {
      throw new Error(
        "[env] JWT_SECRET environment variable is required in production. " +
          "Set a strong random value before starting the server."
      );
    }
    console.warn(
      "[env] JWT_SECRET not set — using insecure dev fallback. " +
        "Do not run this configuration in production."
    );
  }
}

/** jose 가 받는 Uint8Array 형식의 비밀키 */
export function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET || DEV_JWT_FALLBACK;
  return new TextEncoder().encode(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMTP — 설정 상태 / 부트업 안내
// ─────────────────────────────────────────────────────────────────────────────

export const isSmtpConfigured = (): boolean =>
  Boolean(ENV.smtpHost && ENV.smtpUser && ENV.smtpPass);

export const isEmailConfigured = (): boolean =>
  Boolean(ENV.resendApiKey || isSmtpConfigured());

/** 부트업 시 SMTP 상태를 로그로 남긴다. 운영에서 미설정이면 경고. */
export function logSmtpStatus(): void {
  if (isSmtpConfigured()) {
    console.log(
      `[env] SMTP configured — host=${ENV.smtpHost} port=${ENV.smtpPort} secure=${ENV.smtpSecure}`
    );
    return;
  }
  if (isProd) {
    console.warn(
      "[env] SMTP credentials missing in production. " +
        "Email verification codes will fall back to console output and never reach users."
    );
  } else {
    console.log(
      "[env] SMTP not configured — verification codes will be printed to the console (dev mode)."
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Express cors 미들웨어 옵션 빌더
// ─────────────────────────────────────────────────────────────────────────────

import type { CorsOptions } from "cors";

/**
 * 환경에 맞는 CORS 옵션을 반환한다.
 *
 *   개발                                   : 모든 출처 허용 + credentials
 *   운영 + CORS_ALLOWED_ORIGINS 지정        : 해당 출처만 허용 + credentials
 *   운영 + CORS_ALLOWED_ORIGINS 미지정       : same-origin 만 (CORS 헤더 미발급)
 */
export function buildCorsOptions(): CorsOptions {
  if (!isProd) {
    return { origin: true, credentials: true };
  }
  const allow = ENV.corsAllowedOrigins;
  if (allow.length === 0) {
    return { origin: false, credentials: true };
  }
  return {
    origin: (origin, cb) => {
      // origin 이 undefined 인 경우 = same-origin 요청 → 허용
      if (!origin) return cb(null, true);
      if (allow.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  };
}

export function logCorsStatus(): void {
  if (!isProd) {
    console.log("[env] CORS: dev mode — all origins allowed");
    return;
  }
  if (ENV.corsAllowedOrigins.length === 0) {
    console.warn(
      "[env] CORS: production with no CORS_ALLOWED_ORIGINS — only same-origin requests will work."
    );
  } else {
    console.log(
      `[env] CORS: production whitelist — ${ENV.corsAllowedOrigins.join(", ")}`
    );
  }
}
