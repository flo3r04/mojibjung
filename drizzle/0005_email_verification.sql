-- 0005_email_verification.sql
-- 학교 이메일 인증 테이블 생성 및 신규 가입 유저 기본 상태(status) 변경

-- 1. emailVerifications 테이블 생성
CREATE TABLE IF NOT EXISTS "emailVerifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "userId" integer NOT NULL,
    "email" varchar(320) NOT NULL,
    "codeHash" varchar(64) NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp NOT NULL,
    "verifiedAt" timestamp,
    "consumedAt" timestamp,
    "ipAddress" varchar(45),
    "createdAt" timestamp DEFAULT now() NOT NULL
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS "emailVerifications_userId_idx" ON "emailVerifications" ("userId");
CREATE INDEX IF NOT EXISTS "emailVerifications_email_idx" ON "emailVerifications" ("email");

-- 3. users 테이블의 status 기본값을 'pending'으로 설정
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';
