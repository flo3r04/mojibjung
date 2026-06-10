# `drizzle/_archive/`

이 디렉토리의 SQL 은 **drizzle-kit 의 자동 마이그레이션 흐름에서 제외**된 참고용 파일들입니다.
파일명 패턴이 `NNNN_*.sql` 가 아니므로 `drizzle-kit migrate` 가 인식하지 않습니다.

## `0005_auth_redesign_REFERENCE.sql`

회원가입 / 인증 시스템 재설계의 **첫 시안** (Step 1 작성).
DDL + 학과 시드가 한 파일에 섞여 있었으나, drizzle-kit 자동 생성과 충돌하므로 다음과 같이 분리되었습니다:

| 원래 내용 | 옮겨진 위치 |
|---|---|
| DDL (테이블 생성·컬럼 추가·partial unique index 등) | `drizzle/schema.ts` 의 변경분 → `pnpm drizzle-kit generate` 가 자동으로 `0005_*.sql` 생성 |
| 시드 INSERT (학과 34개) + 기존 사용자 status 백필 | `drizzle/seeds/001_departments.sql` |

이 파일 자체는 **이력 보존용**이며 실행할 일이 없습니다.

## 적용 절차

1. `pnpm drizzle-kit generate` — schema.ts 변경분으로 새 마이그레이션 SQL 자동 생성
2. `pnpm drizzle-kit migrate` (또는 `pnpm db:push`) — DB 에 DDL 적용
3. `pnpm db:seed` — `drizzle/seeds/` 의 SQL 들을 순서대로 적용
