-- 0006: 모집 글 조직도(org-chart) 컬럼 추가 (수동 적용용 REFERENCE)
--
-- drizzle-kit 마이그레이션 메타(_journal/snapshot)는 0004 에서 멈춰 있고,
-- 인증 재설계 이후의 스키마 변경은 수동 SQL 로 적용해 왔다
-- (drizzle/_archive/0005_auth_redesign_REFERENCE.sql 참조).
-- 이 파일도 동일하게 운영 DB 에 수동 적용한다. 로컬 dev DB 에는 이미 적용됨.
--
-- 관련 스키마: drizzle/schema.ts
--   posts.orgChart, applications.hopedPositionId/assignedPositionId,
--   applications.publicContactConsent/publicContact (v2: 동의형 연락처 공개)

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "orgChart" jsonb;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "hopedPositionId" varchar(30);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "assignedPositionId" varchar(30);

-- v2: 공개 조직도 동의형 연락처 (A 기본 공개 + 본인 동의 시 연락처까지 공개)
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "publicContactConsent" integer NOT NULL DEFAULT 0;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "publicContact" varchar(100);

-- v3: 조직도 커스터마이징 설정 (레이아웃·간격). 노드 색/x/y 는 orgChart jsonb 내부.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "orgChartSettings" jsonb;
