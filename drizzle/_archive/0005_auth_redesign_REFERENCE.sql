-- ============================================================================
-- 0005_auth_redesign.sql
-- 회원가입 / 인증 시스템 재설계 (A안: Kakao OAuth + 학교 이메일 인증 강제)
--
-- 변경 요약
--   1) departments 테이블 신설 + 외대 글로벌캠 학과 시드
--   2) users 보강: status, realName, studentId, admissionYear, departmentId,
--                  verifiedEmail (UNIQUE)
--   3) emailVerifications 재도입 (0004에서 DROP된 것을 보안 강화판으로 부활)
--   4) verificationTokens 신설 (검증 토큰 1회용 보장)
--   5) refreshTokens 신설 (회전 + 블랙리스트)
--   6) auditLog 신설
--
-- 호환성
--   - 기존 사용자는 status='verified'로 백필하여 글쓰기/신청이 끊기지 않게 함
--   - 신규 가입자만 'pending'에서 시작
--   - studentId/verifiedEmail은 NULL 허용 + UNIQUE → 기존 데이터 손상 없음
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) departments — 학과 마스터 테이블
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "departments" (
  "id"        serial PRIMARY KEY NOT NULL,
  "name"      varchar(100) NOT NULL,
  "college"   varchar(100),
  "campus"    varchar(20) DEFAULT '글로벌' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_unique" ON "departments" ("name");

-- 시드: 한국외국어대학교 글로벌캠퍼스 학과 (Profile.tsx 의 DEPARTMENTS 와 동기화)
INSERT INTO "departments" ("name", "college") VALUES
  ('철학과',                              '인문대학'),
  ('사학과',                              '인문대학'),
  ('언어인지과학과',                      '인문대학'),
  ('폴란드학과',                          '국제지역대학'),
  ('루마니아학과',                        '국제지역대학'),
  ('체코·슬로바키아학과',                 '국제지역대학'),
  ('헝가리학과',                          '국제지역대학'),
  ('세르비아·크로아티아학과',             '국제지역대학'),
  ('그리스·불가리아학과',                 '국제지역대학'),
  ('중앙아시아학과',                      '국제지역대학'),
  ('아프리카학부',                        '국제지역대학'),
  ('우크라이나학과',                      '국제지역대학'),
  ('한국학과',                            '국제지역대학'),
  ('Global Business & Technology학부',    '국제금융대학'),
  ('국제금융학과',                        '국제금융대학'),
  ('수학과',                              '자연과학대학'),
  ('통계학과',                            '자연과학대학'),
  ('전자물리학과',                        '자연과학대학'),
  ('환경학과',                            '자연과학대학'),
  ('생명공학과',                          '자연과학대학'),
  ('화학과',                              '자연과학대학'),
  ('컴퓨터공학부',                        '공과대학'),
  ('정보통신공학과',                      '공과대학'),
  ('반도체전자공학부',                    '공과대학'),
  ('산업경영공학과',                      '공과대학'),
  ('바이오메디컬공학부',                  '공과대학'),
  ('융합인재학부',                        '융합인재대학'),
  ('디지털콘텐츠학부',                    '바이오메디컬공학·디지털콘텐츠대학'),
  ('투어리즘 & 웰니스학부',               '글로벌스포츠·문화산업대학'),
  ('글로벌스포츠산업학부',                '글로벌스포츠·문화산업대학'),
  ('AI데이터융합학부',                    'AI융합대학'),
  ('Finance & AI융합학부',                'AI융합대학'),
  ('기후변화융합학부',                    '기후변화융합대학'),
  ('자유전공학부(글로벌)',                '자유전공학부')
ON CONFLICT ("name") DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2) users 보강
-- ----------------------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "status"         varchar(20) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "realName"       varchar(50),
  ADD COLUMN IF NOT EXISTS "studentId"      varchar(10),
  ADD COLUMN IF NOT EXISTS "admissionYear"  smallint,
  ADD COLUMN IF NOT EXISTS "departmentId"   integer,
  ADD COLUMN IF NOT EXISTS "verifiedEmail"  varchar(320);

-- 기존 사용자(테스트 계정 등)는 verified로 백필하여 서비스 단절 방지.
-- 신규 가입자만 pending에서 시작하게 됨.
UPDATE "users" SET "status" = 'verified' WHERE "createdAt" < now();

-- 학번/검증이메일 UNIQUE — NULL은 UNIQUE 제약과 무관하므로 안전
CREATE UNIQUE INDEX IF NOT EXISTS "users_studentId_unique"
  ON "users" ("studentId")
  WHERE "studentId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_verifiedEmail_unique"
  ON "users" ("verifiedEmail")
  WHERE "verifiedEmail" IS NOT NULL;

-- departmentId 는 ON DELETE RESTRICT (학과 실수 삭제 차단)
DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_departmentId_fk"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- status 빠른 분기를 위한 인덱스
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" ("status");


-- ----------------------------------------------------------------------------
-- 3) emailVerifications — 학교 이메일 6자리 인증 코드
--    (0004 에서 삭제된 email_verifications 를 보안 강화판으로 재도입)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "emailVerifications" (
  "id"          serial PRIMARY KEY NOT NULL,
  "userId"      integer NOT NULL,
  "email"       varchar(320) NOT NULL,
  "codeHash"    varchar(128) NOT NULL,         -- SHA-256(6자리 코드)
  "attempts"    smallint DEFAULT 0 NOT NULL,    -- 최대 5
  "expiresAt"   timestamp NOT NULL,             -- 발송 시점 + 5분
  "verifiedAt"  timestamp,                      -- 검증 성공 시각
  "consumedAt"  timestamp,                      -- 회원가입 완료 시 마킹 (1회용)
  "ipAddress"   varchar(45),                    -- IPv4/IPv6
  "userAgent"   text,
  "createdAt"   timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "emailVerifications_email_createdAt_idx"
  ON "emailVerifications" ("email", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "emailVerifications_userId_idx"
  ON "emailVerifications" ("userId");

DO $$ BEGIN
  ALTER TABLE "emailVerifications"
    ADD CONSTRAINT "emailVerifications_userId_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- 4) verificationTokens — 검증 토큰 1회용 보장
--    (JWT 만으로도 동작 가능하나, jti 기반 consume 마킹으로 재사용 방지)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "verificationTokens" (
  "jti"             varchar(64)  PRIMARY KEY NOT NULL,  -- JWT jti claim
  "userId"          integer NOT NULL,
  "purpose"         varchar(40) NOT NULL,                -- 'school_email' 등
  "verificationId"  integer NOT NULL,                    -- emailVerifications.id
  "expiresAt"       timestamp NOT NULL,
  "consumedAt"      timestamp,
  "createdAt"       timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "verificationTokens_userId_idx"
  ON "verificationTokens" ("userId");

DO $$ BEGIN
  ALTER TABLE "verificationTokens"
    ADD CONSTRAINT "verificationTokens_userId_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- 5) refreshTokens — Access/Refresh 분리 + 회전 + 블랙리스트
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "refreshTokens" (
  "id"          serial PRIMARY KEY NOT NULL,
  "userId"      integer NOT NULL,
  "tokenHash"   varchar(128) NOT NULL,         -- SHA-256(refresh token)
  "expiresAt"   timestamp NOT NULL,             -- 발급 시점 + 14일
  "revokedAt"   timestamp,                      -- 회전 또는 로그아웃 시 마킹
  "revokedReason" varchar(40),                  -- 'rotation' | 'logout' | 'reuse_detected' | 'admin'
  "replacedBy"  integer,                        -- 회전 시 새 row id (감사용)
  "ipAddress"   varchar(45),
  "userAgent"   text,
  "createdAt"   timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "refreshTokens_tokenHash_unique"
  ON "refreshTokens" ("tokenHash");

CREATE INDEX IF NOT EXISTS "refreshTokens_userId_idx"
  ON "refreshTokens" ("userId");

DO $$ BEGIN
  ALTER TABLE "refreshTokens"
    ADD CONSTRAINT "refreshTokens_userId_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- 6) auditLog — 감사 로그
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "auditLog" (
  "id"          serial PRIMARY KEY NOT NULL,
  "userId"      integer,                        -- 익명 액션도 가능하므로 NULL 허용
  "action"      varchar(60) NOT NULL,           -- LOGIN_KAKAO, EMAIL_VERIFY_REQUEST 등
  "ipAddress"   varchar(45),
  "userAgent"   text,
  "metadata"    text,                           -- JSON 직렬화 (작은 페이로드)
  "createdAt"   timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "auditLog_userId_createdAt_idx"
  ON "auditLog" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "auditLog_action_createdAt_idx"
  ON "auditLog" ("action", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "auditLog"
    ADD CONSTRAINT "auditLog_userId_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
