# 모집중 — 한국외대 글로벌 커뮤니티

한국외국어대학교 재학생을 대상으로 하는 **실명 기반 모집 커뮤니티** 웹 서비스입니다.
동아리 · 학회 · 스터디 모집글을 올리고, 관심 키워드 기반으로 추천받고, 신청 · 쪽지를 통해 연결될 수 있습니다.

---

## 목차

- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [백엔드 API](#백엔드-api)
- [핵심 기술 설계 및 구현 원리](#핵심-기술-설계-및-구현-원리)
- [주요 트러블슈팅 사례](#주요-트러블슈팅-사례)
- [프론트엔드 페이지](#프론트엔드-페이지)
- [주요 기능 및 구현 원리](#주요-기능-및-구현-원리)
- [시작하기](#시작하기)
- [👨‍💻 팀원 개발 가이드](#-팀원-개발-가이드-quick-start)
- [환경 변수](#환경-변수)
- [테스트](#테스트)
- [배포](#배포)
- [프로덕션 배포 전 체크리스트](#프로덕션-배포-전-체크리스트)

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| **프론트엔드** | React 19.2, Vite 7, wouter (라우팅), Tailwind CSS 4 + shadcn/ui (40+ Radix 컴포넌트), Framer Motion, React Hook Form + Zod, Recharts (지원자 통계) |
| **상태 관리** | tRPC + React Query (서버 상태), React Context (테마) |
| **백엔드** | Express 4, tRPC 11, Drizzle ORM, **Resend API (우선) + Nodemailer (SMTP 폴백)**, jose (JWT) |
| **인증** | Kakao OAuth 2.0 + HttpOnly 쿠키 + JWT (1년 단일; Access/Refresh 분리 예정) + 학교 이메일 인증 (6자리 코드, SHA-256 해시) |
| **데이터베이스** | PostgreSQL (21개 테이블) |
| **이미지 저장소** | Cloudinary |
| **테스트** | Vitest (22 케이스 — 권한 회귀·검증 토큰·rate limit 등) |
| **패키지 매니저** | pnpm 10.4.1 |
| **빌드 도구** | esbuild (서버), Vite (클라이언트), cross-env (Windows 호환) |
| **배포** | Render.com |

---

## 프로젝트 구조

```
hufs-global-community/
├── client/                  # React 프론트엔드
│   ├── src/
│   │   ├── App.tsx              # 라우터 정의 + OnboardingGuard + Disabled 차단
│   │   ├── pages/               # 14개 페이지 (아래 "프론트엔드 페이지" 표 참조)
│   │   ├── pages/onboarding/    # Email / Verify / Profile (3단계 가입)
│   │   ├── components/          # Logo, Navbar, PostCard, MessageModal, ReportDialog 등
│   │   ├── components/ui/       # shadcn/ui 컴포넌트 (40+)
│   │   ├── lib/                 # tRPC 클라이언트, 유틸
│   │   ├── contexts/            # ThemeContext (다크모드)
│   │   ├── _core/hooks/useAuth.ts
│   │   └── const.ts             # 카카오 로그인 URL 동적 생성
│   └── public/logo.svg          # 모집중 부엉이 로고
│
├── server/                  # Express + tRPC 백엔드
│   ├── _core/
│   │   ├── index.ts                # 서버 진입점 + 부트업 검증 (JWT/SMTP/CORS)
│   │   ├── trpc.ts                 # 4단계 미들웨어 (public / protected / protectedVerified / admin)
│   │   ├── context.ts              # JWT 검증 + 사용자 조회
│   │   ├── oauth.ts                # Kakao OAuth 콜백 + 가입 상태 기반 리다이렉트
│   │   ├── cookies.ts              # 쿠키 설정
│   │   ├── env.ts                  # 환경변수 게이트웨이 + JWT/SMTP/CORS 헬퍼
│   │   ├── audit.ts                # AuditLog 헬퍼 (logAuditFromCtx / logAuditFromReq)
│   │   ├── rateLimit.ts            # 메모리 기반 sliding window
│   │   └── verificationToken.ts    # 검증 토큰 JWT 발급/검증
│   ├── routers.ts           # tRPC 13개 라우터 모듈
│   ├── db.ts                # DB 접근 함수
│   ├── email.ts             # Resend (우선) + Nodemailer SMTP (폴백) + 도메인 검증·해시
│   ├── storage.ts           # Cloudinary 이미지 업로드
│   ├── community.test.ts    # 통합 테스트 (16 케이스)
│   ├── email.test.ts        # 도메인·해시 검증 (9)
│   ├── rateLimit.test.ts    # sliding window (5)
│   ├── verificationToken.test.ts   # JWT 발급/위조 거부 (6)
│   └── auth.logout.test.ts  # 로그아웃 (1)
│
├── shared/                  # 프론트/백엔드 공용 (COOKIE_NAME 등)
│
├── drizzle/                 # ORM 스키마 & 마이그레이션
│   ├── schema.ts            # 21개 테이블 정의 (인증·콘텐츠·상호작용·그룹 시스템)
│   ├── 0000_*.sql ~ 0004_*.sql
│   ├── seeds/               # 데이터 시드 (학과 마스터 등) — pnpm db:seed
│   ├── _archive/            # drizzle-kit 흐름에서 제외된 참고용 SQL
│   └── meta/
├── scripts/applySeeds.ts    # pnpm db:seed 진입점
│
├── patches/                 # wouter@3.7.1 패치
├── package.json             # dev:server 는 cross-env 로 Windows 호환
├── drizzle.config.ts
├── vite.config.ts
├── vitest.config.ts
└── render.yaml              # Render 배포 설정
```

---

## 데이터베이스 스키마

`drizzle/schema.ts`에 정의:

### users — 정체성 + 가입 상태 머신
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | serial PK | |
| openId | varchar UNIQUE | Kakao OAuth ID |
| name, email, loginMethod | varchar | Kakao 닉네임·이메일 (참고용) |
| role | enum | `user` \| `admin` |
| **status** | enum | `pending` \| `verified` \| `disabled` — 권한 미들웨어가 분기 |
| **realName** | varchar(50) | 실명 (가입 단계 입력) |
| **studentId** | varchar(10) UNIQUE† | 학번 |
| **admissionYear** | smallint | 입학년도 |
| **departmentId** | int FK → departments | 학과 (정식 소유자) |
| **verifiedEmail** | varchar(320) UNIQUE† | 인증 통과한 `@hufs.ac.kr` 이메일 |
| avatarUrl | text | 프로필 이미지 |
| createdAt, updatedAt, lastSignedIn | timestamp | |

† partial unique — NULL 은 충돌 무관, 채워지면 1인 1계정 보장

### departments — 학과 마스터 (시드)
- 한국외대 글로벌캠 학과 34개 (`pnpm db:seed` 로 적용)

### profiles (users 1:1) — 자유 변경 영역
- bio (200자), grade, keywords (JSON 배열, 최대 10개)
- `department` 자유문자열 컬럼은 deprecated — `users.departmentId` 사용

### emailVerifications — 학교 이메일 인증 코드
- userId, email, codeHash (SHA-256), attempts ≤ 5, expiresAt (+5분), verifiedAt, consumedAt, ipAddress

### verificationTokens — 검증 토큰 1회용 보장
- jti PK (JWT 의 jti), userId, purpose, verificationId, expiresAt, consumedAt

### refreshTokens — Access/Refresh 회전·블랙리스트 (Step 6-b 에서 사용)
- tokenHash UNIQUE, revokedAt, revokedReason, replacedBy

### auditLog — 감사 로그
- userId, action, ipAddress, userAgent, metadata

### posts / comments / likes / bookmarks
- 게시글·댓글·반응 테이블
- `posts` 신규 컬럼: `formSchema` (JSONB, 커스텀 폼), `hasInterview` (면접 단계), `groupId` (그룹 연동)

### applications — 모집 신청
- `(postId, applicantId)` UNIQUE 로 중복 신청 차단
- status: `대기중` / `1차합격` / `수락` / `거절` (4단계)
- `answers` (JSONB, 폼 응답), `rejectReason` (text, 거절 사유)

### messages — 1:1 쪽지
- senderId, receiverId, postId(optional), content, isRead

### reports — 신고 (post / user / comment / message 4종)
- reporterId, targetType, targetId, reason, status (`pending`/`resolved`/`dismissed`)

### blocks — 사용자 차단
- `(blockerId, blockedId)` UNIQUE — 양방향 메시지·추천 알고리즘에서 차단 관계 반영

### calendarEvents — 마이 캘린더 일정
- `userId NULL = 공개 학사일정/공휴일, 값 있으면 개인 일정`
- category: `academic` / `personal` / `holiday`

### groups · groupRoles · groupMembers · groupAnnouncements · groupChatMessages
- **그룹 시스템** (동아리·스터디·프로젝트 그룹 단위 운영)
- `groups`: 고유 키(XXXX-XXXX-XXXX 형식), 카테고리, 설명
- `groupRoles`: 커스텀 지위/권한 (관리자가 정의)
- `groupMembers`: 가입자·역할
- `groupAnnouncements`: 그룹 공지
- `groupChatMessages`: 그룹 채팅 (소통 허브)

### 관계도

```
departments ─ 1:N → users (departmentId)
users ─┬─ 1:1 → profiles
       ├─ 1:N → posts, comments, likes, bookmarks, applications, messages
       ├─ 1:N → emailVerifications, verificationTokens, refreshTokens, auditLog
       ├─ 1:N → reports (reporterId), blocks (blockerId / blockedId)
       ├─ 1:N → calendarEvents
       └─ N:M → groups (via groupMembers + groupRoles)

posts ─┬─ 1:N → comments, likes, bookmarks, applications, messages
       └─ N:1 → groups (groupId, 모집 완료 시 자동 연동)

groups ─┬─ 1:N → groupRoles, groupMembers, groupAnnouncements, groupChatMessages
        └─ 1:N → calendarEvents (그룹 일정)
```

---

## 백엔드 API

`server/routers.ts`에 정의된 tRPC 라우터 — **13개 모듈**:

* **`auth`**: 회원 정보 조회, 로그아웃, 탈퇴, 이메일 인증 코드 발송/검증, 온보딩 가입 완료
* **`department`**: 전체 학과 마스터 리스트 조회
* **`profile`**: 프로필 정보 관리 및 상세 조회
* **`post`**: 모집글 CRUD, 추천, 키워드 자동완성, 좋아요/북마크 토글
* **`comment`**: 모집글 댓글 및 대댓글 관리
* **`application`**: 모집글 지원서 제출, 합격/거절 처리
* **`calendar`**: 개인일정 관리 및 마이 캘린더 통합 데이터 추출
* **`block`**: 유저 차단 및 차단 해제
* **`report`**: 모집글/댓글/사용자/쪽지 신고 접수
* **`group`**: 동아리/스터디 자치 그룹 내 지위, 일정, 공지, 채팅 기능 통합 제어
* **`admin`**: 유저 정지/복구, 신고 내역 처리, 전체 회원 목록 관리
* **`message`**: 1:1 쪽지 및 실시간 알림
* **`upload`**: Cloudinary를 경유한 이미지 업로드

---

## 핵심 기술 설계 및 구현 원리

### 1. 풀스택 모놀리식 서빙(Serving) 및 빌드 파이프라인
모집중은 단일 Node.js 프로세스가 프론트엔드 정적 파일 서빙과 백엔드 tRPC API 처리를 동시에 수행하는 **풀스택 모놀리스 아키텍처**를 적용했습니다.
* **이중 빌드 파이프라인**: `Vite`를 사용해 React 19 소스코드를 경량화 빌드하여 `client/dist` 디렉터리에 출력하고, 백엔드는 `esbuild` 컴파일러를 가동해 TypeScript Express 코드를 단일 실행 파일(`dist/index.js`)로 압축 번들링합니다.
* **통합 정적 서빙**: Express 서버 진입점에서 `express.static`을 사용하여 `client/dist` 폴더 내 정적 자산을 서빙하고, SPA 구조에 맞춘 History API Fallback 처리를 위해 알 수 없는 모든 와일드카드 경로(`*`) 요청을 `index.html`로 우회(Fallback)시킵니다. 이로써 **도메인 포트가 완전히 일치하여 CORS 문제를 원천 차단**합니다.

### 2. 개발 및 프로덕션 환경의 CORS 및 포트 프록싱
* **물리적 차이 통제**: 로컬 개발 시에는 빠른 HMR을 위해 Vite 개발 서버(`Port 5173`)와 Express 백엔드 서버(`Port 3000`)를 분리해 구동합니다.
* **CORS 및 자격증명 통제**: 개발 단계에서 이종 포트 간에 HttpOnly 세션 쿠키가 온전히 교환되도록 Express 서버 단에서 `CORS_ALLOWED_ORIGINS` 파싱 및 `credentials: true` CORS 헤더 설정을 강제합니다. 클라이언트는 개발 및 배포 환경에 따라 API 엔드포인트 URL을 동적으로 분기 해석하는 로직을 가동합니다.

### 3. 가입 상태 머신 (FSM) 및 OAuth 온보딩 분기
사용자의 온보딩 라이프사이클을 통제하기 위해 데이터베이스의 유저 상태에 **유한 상태 머신(FSM) 모델**을 적용했습니다.
* **Pending (가입 대기)**: 소셜 가입 성공 직후의 상태로, 읽기 전용 권한만 가지며 온보딩 가드 컴포넌트(`<OnboardingGuard>`)를 통해 메일 인증 화면으로만 강제 리다이렉트합니다.
* **Verified (정회원)**: 이메일 검증 및 학적 기입을 통과하여 학적 무결성이 검증된 상태로, 플랫폼 내 모든 쓰기 동작과 커뮤니티 기능을 인가받습니다.
* **Disabled (계정 제재)**: 신고 누적 등으로 관리자가 정지시킨 상태로, 쿠키가 자동 파기되고 로그인 시 사유 안내 화면으로 격리됩니다.
* **보안 쿠키 세션**: 세션 정보 누출을 방지하기 위해 jose 라이브러리로 암호화 서명한 JWT를 `HttpOnly`, `Secure`, `SameSite` 쿠키에 탑재해 1년간 유지하며 XSS 공격을 무력화합니다.

### 4. tRPC 기반 단일 레포지토리 타입 안정성 (Type Safety)
* **REST의 한계 극복**: REST API처럼 스키마가 일치하지 않아 런타임에 에러가 발생할 위험을 방지하고, GraphQL 수준의 복잡한 런타임 쿼리 파서 오버헤드를 배제하기 위해 **tRPC**를 전면 설계하였습니다.
* **동작 원리**: 백엔드 라우터 객체의 TypeScript 타입 정의(`export type AppRouter = typeof appRouter`)를 프론트엔드가 참조(Import)하여, API 파이프라인의 입출력 인자 타입을 컴파일 타임에 100% 동기화하고 에러를 빌드 시점에 잡아냅니다.

### 5. PostgreSQL JSONB 기반 비정형 데이터 모델링
모집 단위별로 유동적인 **'동적 질문 폼'**을 다루기 위해 하이브리드 데이터베이스 설계를 사용했습니다.
* **JSONB의 강점**: 질문지 스펙(`posts.formSchema`)을 직렬화하여 JSONB 필드에 직접 저장함으로써, DDL 마이그레이션 변경 없이 기민하게 변경 요구사항에 대처합니다.
* **조인 없는 쿼리**: 지원서 응답(`applications.answers`)을 문항 ID-답변 Value 해시 맵 구조의 JSONB 단일 필드로 기록하여 복잡한 `JOIN` 연산 및 자식 테이블 락(Lock) 경합 없이 단일 쿼리로 고속 조회를 보장합니다.

### 6. 일정 겹침 방지 배치 알고리즘 (시간 복잡도 분석)
학사일정, 개인일정, 그룹일정 등 다중 일정이 달력 한 날에 집중될 때 캘린더 화면 레이아웃 붕괴를 막기 위한 그리디 배치 알고리즘을 프론트엔드에 주입했습니다.
* **작동 원리**:
  1. **주간 필터링**: 현재 캘린더가 렌더링 중인 주차(토~일)에 겹치는 일정만 $N$개 선별합니다.
  2. **우선순위 정렬**: '일정 기간이 긴 순(1순위) > 시작일이 빠른 순(2순위) > 제목 사전순(3순위)'으로 내림차순 정렬하여 수평적 연속성을 확보합니다 ($\mathcal{O}(N \log N)$).
  3. **그리디 레인 배치**: 최대 3개의 수평 레인(`lanes`)을 정의하고, 정렬된 순서대로 일정을 돌려 겹치지 않는 가장 위쪽 레인을 탐색해 배치하고($\mathcal{O}(3N)$), 초과한 일정은 화면에서 가리고 카운트만 집계합니다.
  4. **최종 시간 복잡도**: $\mathcal{O}(N \log N + 3N) \approx \mathcal{O}(N \log N)$으로 프론트엔드 스레드를 가로막지 않고 고속 연산됩니다.

### 7. DB 물리적 FK 배제와 수동 연쇄 삭제(Cascade Delete) 트랜잭션
* **이유**: 트래픽 폭주 시 인서트/업데이트 연산마다 DB 엔진 레벨의 FK 검사 락(Lock) 경합으로 인한 성능 저하를 방지하기 위해 물리적 외래키 제약조건을 배제하고 애플리케이션 레벨(Drizzle ORM)에서 관계를 직접 제어했습니다.
* **참조 무결성 보완**: 참조 무결성 붕괴로 인한 고아 데이터를 막기 위해, 회원 탈퇴(`deleteUser`) 시 단일 데이터베이스 트랜잭션(`db.transaction`) 내에서 연관된 10여 개의 관계 테이블의 해당 유저 소유 데이터를 수동 연쇄 삭제(Cascade Delete)하는 원자적 가입 롤백 메커니즘을 수동 설계하여 무결성을 확보했습니다.

---

## 주요 트러블슈팅 사례

### 1. NULL 값 UNIQUE 제약조건 충돌 극복 (조건부 부분 인덱스)
* **문제 상황**: 1인 1계정 원칙을 위해 학번(`studentId`)과 이메일(`verifiedEmail`)에 UNIQUE 제약조건이 필요했으나, 카카오 로그인 직후 가입을 완료하기 전인 가입 대기(`pending`) 중인 유저들은 이 필드들이 임시 `NULL` 상태를 가집니다. 표준 UNIQUE 인덱스는 다수의 NULL 또한 중복으로 간주하여 충돌로 신규 가입을 마비시키는 장애가 있었습니다.
* **해결 방법**: PostgreSQL의 **조건부 부분 인덱스(Conditional Partial Index)**를 활용해 오직 학번 및 이메일 값이 존재하는 경우(`IS NOT NULL`)에만 고유 제약조건 인덱스가 빌드되고 작동하도록 Drizzle schema에 아래와 같이 명세하여 무결성을 극복했습니다.
  ```typescript
  uniqueIndex("users_studentId_unique")
    .on(table.studentId)
    .where(sql`"studentId" IS NOT NULL`)
  ```

### 2. 이메일 전송 인프라 이중화 (SMTP 폴백 + Resend API)
* **문제 상황**: 클라우드 Render 배포 환경에서 SMTP 인증 코드 발송 시 IPv6 주소 해석 오류나 해외 포트 대량 차단으로 이메일 발송이 잦은 타임아웃 실패를 겪었습니다.
* **해결 방법**: SMTP 설정에 IPv4 우선 접속 설정을 추가하는 한편, 메일 발송이 에러로 실패하면 즉시 클라우드 전용 이메일 발송 인프라인 **Resend API**로 요청 경로를 자동 우회시키는 **이메일 발송 이중화(Failover) 시스템**을 구축하여 서비스 장애 내결함성을 극대화하였습니다.

### 3. 타이밍 공격(Timing Attack) 방어 및 OTP 단방향 해시화
* **문제 상황**: 이메일 OTP 코드가 DB에 평문으로 보관되면 보안 리스크가 크며, 코드 비교 검증 시 사용되는 Javascript 일반 문자열 비교(`==`)의 Short-circuit 특징 때문에 응답 소요 시간 차이를 해커가 측정하여 해시를 유추하는 타이밍 공격 위협이 존재했습니다.
* **해결 방법**: 평문 코드는 메일로 쏘고 휘발시키며, DB에는 SHA-256으로 해시화한 값만 보관합니다. 검증 시에는 문자 불일치가 조기에 발견되어도 항상 일정한 상수 시간 비교 연산이 끝나도록 강제하는 Node.js의 `crypto.timingSafeEqual` 함수를 도입해 부채널 보안 취약점을 해결했습니다.
  ```typescript
  export function verifyCodeHash(plain: string, stored: string): boolean {
    const a = Buffer.from(hashCode(plain), "hex");
    const b = Buffer.from(stored, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  ```

---

## 프론트엔드 페이지

`client/src/App.tsx`에 정의:

| 경로 | 페이지 | 핵심 기능 |
|---|---|---|
| `/` | Home | 4슬라이드 자동 캐러셀 배너(외대 정보 중심) + 카테고리별 최신글 + 개인화 추천 |
| `/board` | Board | 24개/페이지, 카테고리 · 검색 · 정렬 · 상태 필터 |
| `/post/new` | PostForm | 게시글 작성 — 커스텀 폼 빌더, verified 필요 |
| `/post/:id` | PostDetail | 신청, 댓글, 쪽지, 차단·신고, 연동 그룹 일정 |
| `/post/:id/edit` | PostForm | 게시글 수정 |
| `/post/:id/manage` | **PostManage** | 지원자 통계(Recharts) + 1차합격·수락·거절 |
| `/profile` | Profile | 학과 · 학년 · 소개 · 키워드, 가입 정보 읽기 전용 카드 |
| `/user/:id` | **UserProfile** | 타 사용자 프로필 + 메시지 보내기 |
| `/mypage` | MyPage | 내 글 / 신청 / 북마크 탭, 학교 인증 배지, 학과·학번 표시 |
| `/calendar` | **CalendarPage** | 마이 캘린더 — 학사일정 + 공휴일 + 개인일정 + 모집 마감 통합 시각화 |
| `/groups` | **GroupHub** | 그룹 운영 허브 — 일정·공지·채팅·고유 키 관리 |
| `/messages` | Messages | 대화 목록 + 1:1 스레드 (차단 양방향 검증) |
| `/blocks` | **BlockManage** | 차단 사용자 목록·해제 |
| `/admin` | Admin | 관리자 — 사용자·신고 처리·계정 정지 |
| `/onboarding/email` | OnboardingEmail | 카카오 가입 직후 — 학교 이메일 입력 |
| `/onboarding/verify` | OnboardingVerify | 6자리 OTP 입력 (input-otp) |
| `/onboarding/profile` | OnboardingProfile | 실명·학번·학과·입학년도 → 가입 완료 |

---

## 주요 기능 및 구현 원리

### 1. Kakao OAuth 로그인
* **구현원리**: Kakao 인가 코드를 백엔드로 받아 토큰 API로 전달하고 사용자 프로필 정보(OpenID)를 조회합니다. 이를 `users` 테이블에 `upsertUser` 처리하고 가입 상태에 따라 온보딩 단계 리다이렉트 흐름을 분기하며, 비밀키로 서명한 JWT를 `HttpOnly` 쿠키에 설정해 1년간 유지하여 세션을 보장합니다.

### 2. 학교 이메일 인증
* **구현원리**: `@hufs.ac.kr` 도메인 검증 후 난수 OTP 코드를 생성, 평문 코드는 메일로 쏘고 DB에는 SHA-256 해시값으로 보관합니다. 비교 시 타이밍 공격 방어를 위해 `crypto.timingSafeEqual` 상수 시간 비교를 사용하며, SMTP 전송 차단을 피하기 위해 Nodemailer 실패 시 Resend API로 자동 Failover 이중화를 적용했습니다.

### 3. 회원 탈퇴
* **구현원리**: 데이터 정합성을 유지하기 위해 단일 DB 트랜잭션 내에서 `profiles`, `comments`, `likes`, `bookmarks`, `applications`, `messages`, `calendarEvents`, `groupMembers` 등의 종속 유저 데이터를 수동 연쇄 삭제(Cascade Delete)하고, 최종적으로 `users`의 마스터 레코드를 지운 후 브라우저 내 세션 쿠키를 즉시 만료시킵니다.

### 4. 프로필 및 관심사 관리
* **구현원리**: 학과 정규화를 위해 DB 마스터 학과(34개) 시드를 시드 적용(`pnpm db:seed`)하고 `users.departmentId` 외래키로 매핑합니다. 학년, 소개글 및 관심 키워드를 문자열 JSON 배열로 profiles에 `upsert`하여 실시간 관리합니다.

### 5. 모집글 CRUD + 커스텀 폼 빌더
* **구현원리**: 가변 질문 형식의 문항 구조를 JSON 객체 배열로 직렬화하여 PostgreSQL `JSONB` 컬럼(`posts.formSchema`)에 통째로 저장합니다. 렌더링 시 React 상에서 Zod 유효성 검사를 거친 다이내믹 컴포넌트 매핑을 가동해 주관식 또는 객관식 입력창으로 자동 렌더링합니다.

### 6. 신청 시스템 (면접 단계 포함)
* **구현원리**: 중복 지원을 막기 위해 `applications` 테이블에 `(postId, applicantId)` 복합 UNIQUE 제약조건을 강제했습니다. 전형 단계를 `대기중` -> `1차합격` -> `수락` -> `거절`로 관리하고, 1차 서류 합격자 처리 시 면접 시간/장소를 `interviewDetails`에 보관하여 지원자 본인에게만 1:1로 공개합니다.

### 7. 그룹 시스템 (소통 허브)
* **구현원리**: 최종 합격 시 `autoJoinGroupMember` 트랜잭션을 실행해 단체 멤버로 자동 가입시킵니다. 초대 키(`accessKey`)를 통한 단체 가입이 가능하며, `groupRoles` 테이블에 세부 권한 스위치를 정의해 등급별 일정/공지/채팅 권한을 tRPC API 단에서 격리 및 제어합니다.

### 8. 마이 캘린더
* **구현원리**: `calendar.list`에서 개인일정, 공개일정, 그룹일정, 지원한 글 마감일을 병합해 하나의 Unified 배열로 반환합니다. 다중 일정이 한 주에 몰릴 때 화면 깨짐을 막고자 프론트엔드에 **3단계 그리디 구간 분할 알고리즘**을 탑재하여 수평 바 형태로 늘리고 레인을 분배합니다.

### 9. 개인화 추천
* **구현원리**: 유저 프로필 키워드와 모집글 태그 키워드 간의 **교집합 원소 개수**를 계산하여 정렬 피드로 추천 처리하고, 차단한 저자의 글은 조건문(`notInArray`)을 통해 데이터베이스 스크리닝 단계에서 원천 제외시킵니다.

### 10. 쪽지(1:1 메시지)
* **구현원리**: 쪽지 목록 조회 및 전송 시 양방향 차단 목록(`blocks`)을 참조해 관계가 감지되면 API 레벨에서 전송을 차단합니다. 쪽지방 진입 시 해당방 내 상대방이 보낸 미독 메시지들의 읽음 상태(`isRead = true`)를 데이터베이스에 즉시 동기화합니다.

### 11. 신고·차단·관리자 처리
* **구현원리**: 부적절 콘텐츠 신고 내역을 통합 `reports` 테이블에 기록하고 관리자 대시보드(`adminProcedure`)에서 반려 또는 제재 처리합니다. 유저 정지 시 JWT 세션을 즉시 무효화하고 차단한 사용자의 데이터는 쿼리 조건절에 `notInArray`를 강제해 영구적으로 노출을 차단합니다.

### 12. 지원자 통계 대시보드
* **구현원리**: 제출된 `applications.answers` JSONB 필드를 읽어와 문항별 응답 분포율을 추출하는 백엔드 집계 파이프라인을 구동하고, 프론트엔드에서 **Recharts** 라이브러리의 원형 차트(`PieChart`) 및 막대 차트(`BarChart`) 컴포넌트에 매핑해 그래프로 시각화합니다.

### 13. 관리자 기능
* **구현원리**: `adminProcedure` 미들웨어를 거쳐 검증된 관리자 계정에 한해서만 회원 강퇴, 정지/복구, 신고 내역 처리 및 메일 발송 장치 자격 진단 쿼리(`getSmtpStatus`)를 실행할 수 있도록 라우터를 통제합니다.

### 14. 검증 (3중 방어)
* **구현원리**: 1차로 브라우저에서 `React Hook Form`과 `Zod` 스키마 결합을 통해 폼 유효성 오류를 차단하고, 2차로 tRPC 백엔드 라우터 진입점에 `Zod` 파라미터 유효성 검사 미들웨어를 두었으며, 3차로 데이터베이스의 `UNIQUE`, `NOT NULL`, `CHECK` 제약조건으로 최종 정합성을 강제하는 다계층 검증을 수행합니다.

---

## 🧑‍💻 기여 부분 변수 및 사용법 정의 (subin 개발 영역)

본 섹션은 팀원 `subin`이 단독/주도적으로 개발 및 수정한 기능(마이 캘린더, 그룹 시스템, 면접 및 자동 가입 전형, 로고 개선 등)에 관련된 데이터베이스 변수(스키마 컬럼), 시스템 상수 및 API 입출력 매개변수 정의의 **사용처**와 **사용법**을 구체적으로 다룹니다.

### 1. 데이터베이스 스키마 변수 (drizzle/schema.ts)

#### ① 캘린더 일정 테이블 (`calendarEvents`)
개인 일정 및 학교 학사일정, 공휴일, 연동 그룹 일정을 관리하기 위해 사용되는 변수입니다.
- **`userId`** (Integer, Nullable)
  - **사용처**: `server/db.ts` (일정 필터 쿼리), `client/src/pages/CalendarPage.tsx` (개인/공식 일정 분기 렌더링)
  - **사용법**: 개인 일정을 추가할 때는 로그인한 유저의 고유 `id`를 지정해 저장하고, 전체 유저에게 보여야 하는 학사일정 및 법정 공휴일 등록 시에는 `null` 값으로 입력하여 전역 조회가 가능하도록 합니다.
- **`groupId`** (Integer, Nullable)
  - **사용처**: `server/db.ts` (그룹 일정 조회), `client/src/pages/CalendarPage.tsx` (캘린더 내 그룹별 식별 색상 매핑)
  - **사용법**: 특정 동아리, 학회, 스터디 그룹의 캘린더와 연동된 일정일 경우 해당 그룹의 고유 식별자 ID(`groups.id`)를 매핑하여 저장합니다.
- **`title`** (Varchar, Not Null)
  - **사용처**: `client/src/pages/CalendarPage.tsx` (캘린더 일정 바(Bar) 텍스트 및 상세 모달 헤더)
  - **사용법**: 사용자가 일정을 등록할 때 입력한 한글/영문 제목 문자열(최대 200자)을 그대로 저장합니다.
- **`description`** (Text, Nullable)
  - **사용처**: `client/src/pages/CalendarPage.tsx` (일정 클릭 시 나타나는 우측 패널/팝업 상세 정보 본문)
  - **사용법**: 일정의 구체적인 내용, 링크, 참고사항 등을 문자열 텍스트로 자유롭게 기록합니다.
- **`startDate`** / **`endDate`** (Timestamp, Not Null)
  - **사용처**: `server/db.ts` (특정 월/주별 일정 범위 조회 쿼리), `client/src/pages/CalendarPage.tsx` (달력 그리드 상에 일정 바를 가로로 이어 그리는 수평 그리드 렌더링 알고리즘)
  - **사용법**: 일정의 시작 일시와 종료 일시를 설정합니다. 다중 날짜에 걸쳐 있는 일정(Multi-day)인 경우 수평 바 형태로 늘어나 시각화됩니다.
- **`category`** (Enum, Not Null)
  - **사용처**: `client/src/pages/CalendarPage.tsx` (일정 종류별 범례 표시 및 색상 테마 분류)
  - **사용법**: 일정이 어느 범주에 속하는지 나타내며, `academic`(학사일정), `personal`(개인 일정), `holiday`(공휴일), `group`(그룹 일정) 중 하나의 값을 지정합니다.
- **`isPrivate`** (Integer, Not Null, Default `0`)
  - **사용처**: `server/db.ts` (비밀일정 인가 권한 체크), `client/src/pages/CalendarPage.tsx` (자물쇠 아이콘 시각화)
  - **사용법**: 그룹 일정 등록 시 `1`로 설정하면 일반 멤버에게 노출되지 않고, 비밀 일정 조회 권한(`canViewPrivateEvent`)이 부여된 운영진에게만 보이도록 차단 제어합니다.

#### ② 그룹 시스템 및 소통 허브 관련 테이블
- **`groups` (그룹 마스터 테이블)**
  - **`name`** (Varchar, Not Null)
    - **사용처**: `client/src/pages/GroupHub.tsx` (그룹 메인 화면 타이틀), `client/src/pages/MyPage.tsx` (가입 단체 목록)
    - **사용법**: 생성할 그룹(동아리/학회/스터디)의 공식 명칭을 문자열로 저장합니다.
  - **`leaderId`** (Integer, Not Null)
    - **사용처**: `server/db.ts` (그룹 양도/해체 권한 검증), `client/src/pages/GroupHub.tsx` (그룹 설정 및 멤버 강퇴 UI 노출 기준)
    - **사용법**: 그룹을 처음 개설한 리더의 고유 ID(`users.id`)를 저장하여 모든 관리 권한의 최상위 검증 키로 활용합니다.
  - **`accessKey`** (Varchar, Unique)
    - **사용처**: `server/routers.ts` (그룹 입장 코드 가입 검증), `client/src/pages/GroupHub.tsx` (초대용 입장 코드 표시)
    - **사용법**: 외부 사용자가 그룹에 직접 가입할 때 필요한 비밀 입장 키입니다. 보안을 위해 `XXXX-XXXX-XXXX` 포맷의 UUID 혹은 난수 문자열로 생성 및 저장합니다.

- **`groupRoles` (지위 및 세부 권한 설정)**
  - **`groupId`** (Integer, Not Null)
    - **사용처**: `server/db.ts` (해당 그룹에 정의된 역할들만 로드)
    - **사용법**: 생성하려는 권한 등급(지위)이 귀속되는 대상 그룹 ID(`groups.id`)를 참조합니다.
  - **`name`** (Varchar, Not Null)
    - **사용처**: `client/src/pages/GroupHub.tsx` (멤버 관리 화면의 지위 목록 및 멤버 카드 내 태그)
    - **사용법**: "회장", "운영진", "기획팀장" 등 해당 그룹의 특성에 맞게 커스텀 정의된 직책명을 저장합니다.
  - **`canManageSchedule`** / **`canManageNotice`** / **`canViewPrivateEvent`** (Integer, Default `0`)
    - **사용처**: `server/routers.ts` (그룹 일정 추가, 그룹 공지 게재, 비밀일정 조회 시 API 접근 인가 절차)
    - **사용법**: `0`(불가능) 또는 `1`(가능) 값으로 세부 권한을 키고 끕니다. API 요청 시 사용자가 가진 지위(`roleId`)의 권한 값과 대조하여 인가 처리를 제어합니다.

- **`groupMembers` (소속 멤버 매핑 테이블)**
  - **`userId`** (Integer, Not Null) / **`groupId`** (Integer, Not Null)
    - **사용처**: `server/db.ts` (특정 사용자가 그룹원인지 여부 및 가입 목록 파악)
    - **사용법**: 사용자 ID와 가입한 그룹 ID를 한 쌍으로 묶어 가입 관계를 맺습니다.
  - **`roleId`** (Integer, Nullable)
    - **사용처**: `server/routers.ts` (사용자의 권한 제어 시 `group_roles` 테이블과 조인)
    - **사용법**: 멤버에게 할당할 특정 지위 ID(`group_roles.id`)를 연결합니다. 값이 비어있으면(NULL) 권한이 없는 일반 멤버로 취급됩니다.

- **`groupAnnouncements` (그룹 내 공지사항)**
  - **`groupId`** (Integer, Not Null) / **`authorId`** (Integer, Not Null)
    - **사용처**: `client/src/pages/GroupHub.tsx` (그룹 공지사항 탭 피드 및 작성자 정보 출력)
    - **사용법**: 공지사항이 게재될 그룹 ID와 작성 주체인 운영진의 고유 회원 ID를 각각 매핑합니다.
  - **`title`** / **`content`** (Varchar / Text)
    - **사용처**: `client/src/pages/GroupHub.tsx` (공지 리스트 개별 아코디언 컴포넌트 렌더링)
    - **사용법**: 공지사항 글의 제목과 본문 내용을 마크다운 혹은 문자열로 입력받아 그대로 저장합니다.

- **`groupChatMessages` (그룹 소통방 메시지)**
  - **`groupId`** (Integer, Not Null) / **`senderId`** (Integer, Not Null)
    - **사용처**: `client/src/pages/GroupHub.tsx` (그룹 대화방 탭의 메시지 스레딩 및 아바타 출력)
    - **사용법**: 메시지가 발송된 단톡방이 소속된 그룹 ID와 보낸 이의 회원 ID를 연결합니다.
  - **`content`** (Text, Not Null)
    - **사용처**: `client/src/pages/GroupHub.tsx` (대화창 말풍선)
    - **사용법**: 사용자가 입력하여 보낸 채팅 텍스트 본문 문자열을 그대로 저장합니다.

#### ③ 모집 게시글 및 신청서 추가 컬럼
- **`posts.groupId`** (Integer, Nullable)
  - **사용처**: `server/db.ts` (최종 합격 수락 완료 시 자동 가입 연동 로직), `client/src/pages/PostDetail.tsx` (합격 시 그룹 허브 바로가기 버튼 제공)
  - **사용법**: 게시글 작성자가 모집글을 올릴 때, 모집이 성공적으로 끝나면 생성/가입될 자신의 그룹 ID를 미리 연동해 둡니다.
- **`posts.hasInterview`** (Integer, Default `0`)
  - **사용처**: `client/src/pages/PostForm.tsx` (면접 여부 스위치 버튼), `client/src/pages/PostDetail.tsx` (전형 안내 헤더 배지)
  - **사용법**: 해당 모집 절차에 오프라인/온라인 면접이 포함되어 있는지 여부를 구분합니다. `1`로 설정되면 지원서 양식과 관리 페이지에 면접 관련 UI 기능이 활성화됩니다.
- **`applications.interviewDetails`** (Text, Nullable)
  - **사용처**: `client/src/pages/PostManage.tsx` (지원자 관리 보드에서 면접 대상자 배정), `client/src/pages/MyPage.tsx` (지원한 유저가 본인의 면접 시간 및 장소 확인)
  - **사용법**: 작성자가 서류 합격자 상태를 `1차합격`으로 변경할 때 작성하는 시간 약속, 면접 장소, 준비물 등의 상세 정보를 텍스트로 보관하여 지원자에게 1:1로만 보여줍니다.

---

### 2. tRPC API 라우터 변수 (server/routers.ts)

`subin`이 단독으로 신규 작성하거나 수정한 API 엔드포인트의 입력 값 및 사용처, 사용법 정보입니다.

#### ① `calendar` 라우터 (달력 시스템)
* **`list`**
  * **사용처**: `client/src/pages/CalendarPage.tsx` (마이 캘린더 페이지 첫 진입 시 데이터 로딩)
  * **사용법**: 별도의 입력(Input) 변수가 필요하지 않으며, 현재 세션의 사용자 고유 ID에 기반하여 개인 일정, 소속 그룹 일정, 공식 학사일정 및 북마크 해놓은 모집 글의 마감기한(Deadline)을 자동으로 취합한 종합 배열 목록을 반환합니다.
* **`create`**
  * **사용처**: `client/src/pages/CalendarPage.tsx` (캘린더 날짜 클릭 후 우측 사이드바 '새 일정 추가' 폼 제출)
  * **사용법**: 생성할 일정의 제목(`title`), 상세내용(`description`), 시작시각(`startDate`), 종료시각(`endDate`), 범류(`category`), 비밀일정 여부(`isPrivate`) 변수를 Zod 객체 형태로 전달받아 DB에 삽입합니다.
* **`update`** / **`delete`**
  * **사용처**: `client/src/pages/CalendarPage.tsx` (등록되어 있는 기존 일정을 클릭한 후 수정/삭제 액션 실행)
  * **사용법**: 수정 시에는 대상 일정 ID(`id`)와 변경할 필드 정보가 담긴 `data` 객체를, 삭제 시에는 대상 일정 ID(`id`) 변수를 입력받아 본인 소유의 일정인지를 검증 후 데이터베이스에 반영합니다.

#### ② `group` 라우터 (그룹/단체 관리 시스템)
* **`create`**
  * **사용처**: `client/src/pages/Admin.tsx` 또는 `client/src/pages/GroupHub.tsx` (새로운 그룹/동아리 생성 폼)
  * **사용법**: 단체의 이름(`name`)과 입장 시 필요한 비밀 코드(`accessKey`) 변수를 입력받아 groups 테이블에 레코드를 삽입하고 생성자를 리더로 자동 가입시킵니다.
* **`joinGroupWithKey`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (입장 코드를 통한 신규 그룹 가입 팝업)
  * **사용법**: 사용자가 입력한 입장 키(`accessKey`)를 인풋으로 받아 DB의 `groups.accessKey`와 비교한 뒤, 일치하면 해당 그룹의 일반 멤버 레코드(`groupMembers`)를 자동으로 생성하여 가입 완료 처리합니다.
* **`getGroupMembers`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (그룹원 명부 탭 및 지위 변경 다이얼로그)
  * **사용법**: 조회 대상 그룹 ID(`groupId`)를 입력받아, 그룹에 속한 멤버의 정보(`users.name`, `users.avatarUrl`) 및 세부 지위 권한을 조인하여 목록으로 반환합니다.
* **`removeGroupMember`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (멤버 리스트의 '강퇴' 또는 본인의 '그룹 탈퇴' 버튼 클릭 시)
  * **사용법**: 대상 그룹 ID(`groupId`)와 방출할 유저 ID(`userId`)를 입력받아 리더 권한 검증 절차를 거친 뒤 멤버 매핑 행을 완전히 삭제합니다.
* **`assignMemberRole`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (멤버 상세 프로필의 '지위 설정' 드롭다운 메뉴 변경 시)
  * **사용법**: 그룹 ID(`groupId`), 권한을 변경할 대상 유저 ID(`userId`), 새로 부여할 직책 ID(`roleId`) 변수를 전달받아 해당 멤버의 권한 외래키를 업데이트합니다.

#### ③ `groupRole` 라우터 (역할 및 지위 권한 관리)
* **`createGroupRole`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (그룹 설정 탭 -> '새 지위 등급 생성' 다이얼로그)
  * **사용법**: 직책을 등록할 그룹 ID(`groupId`), 직책명(`name`), 일정 관리 권한 스위치(`canManageSchedule`), 공지 관리 권한 스위치(`canManageNotice`), 비밀 일정 열람 권한 스위치(`canViewPrivateEvent`) 변수를 받아 새로운 역할 등급을 개설합니다.

#### ④ `groupAnnouncement` 라우터 (공지사항 시스템)
* **`create`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (그룹 공지사항 탭 -> '새 공지 작성' 폼 제출)
  * **사용법**: 공지를 등록할 그룹 ID(`groupId`), 제목(`title`), 본문 내용(`content`) 변수를 인풋으로 받아, 작성 권한을 체크한 뒤 공지사항 데이터베이스 행을 삽입합니다.

#### ⑤ `groupChatMessage` 라우터 (그룹 실시간 소통망)
* **`create`**
  * **사용처**: `client/src/pages/GroupHub.tsx` (그룹 채팅창 탭 -> 메시지 입력란 엔터/전송 버튼 클릭)
  * **사용법**: 메시지를 보낼 소속 그룹 ID(`groupId`)와 메시지 본문(`content`) 문자열을 입력받아 채팅 스레드에 추가 저장하고 반환합니다.

---

## 시작하기

### 사전 요구사항
- Node.js 20+
- pnpm 10.4.1+
- PostgreSQL 데이터베이스

### 설치 및 실행
```bash
pnpm install          # 의존성 설치
pnpm run db:push      # DB 동기화
pnpm run dev          # 개발 서버(프론트+백) 실행
```

---

## 👨‍💻 팀원 개발 가이드 (Quick Start)

팀원들이 기능을 추가할 때 참고할 기본적인 흐름입니다.

### 1. 데이터베이스 스키마 수정
1. `drizzle/schema.ts`에서 테이블 또는 필드를 수정합니다.
2. 터미널에서 `pnpm run db:push`를 실행하여 실제 DB에 반영합니다.

### 2. 백엔드 API (tRPC) 추가
1. `server/routers/` 내의 파일에서 로직을 작성합니다.
2. `server/_core/routers.ts`에 해당 라우터를 등록합니다.

### 3. 프론트엔드 연결
1. `client/src/pages/`에 새로운 페이지를 만들거나 기존 페이지를 수정합니다.
2. tRPC 클라이언트를 사용하여 데이터를 호출합니다:
   ```typescript
   const { data } = trpc.post.get.useQuery({ id: 1 });
   ```

---

## 환경 변수

| 변수 | 필수 시점 | 설명 |
|---|---|---|
| `DATABASE_URL` | 항상 | PostgreSQL 연결 문자열 |
| `JWT_SECRET` | **운영 필수** | JWT 서명 비밀키. 미설정 시 운영 부트업 단계에서 서버 종료. 권장: `openssl rand -base64 48` |
| `VITE_KAKAO_CLIENT_ID` | 항상 | Kakao Developers REST API 키 |
| `RESEND_API_KEY` / `RESEND_FROM` | **운영 권장** | Resend 이메일 발송 (SMTP 차단 회피). 설정 시 SMTP 보다 우선 사용 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SECURE` | **운영 필수** | 학교 이메일 인증 코드 발송 (Resend 폴백). 미설정 시 공식 발송 헬퍼 작동 |
| `CORS_ALLOWED_ORIGINS` | 외부 도메인 호출 시 | 쉼표 구분. 비어 있으면 same-origin 만 허용 |
| `VITE_CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | 이미지 업로드 사용 시 | Cloudinary 자격증명 |
| `OWNER_OPEN_ID` | 선택 | 이 카카오 openId 사용자는 자동 admin 권한 부여 |

자세한 예시는 [.env.example](.env.example) 참조.

---

## 데이터베이스 마이그레이션 / 시드 적용

### 마이그레이션 (DDL)
`drizzle/schema.ts` 변경분으로 SQL 자동 생성 + 적용:

```bash
pnpm run db:push       # = drizzle-kit generate && drizzle-kit migrate
```

> 수동 SQL 참고: 마이그레이션은 **0004 에서 동결**되어 있어, 이후 스키마 변경은 `_archive/*_REFERENCE.sql` 로 수동 적용합니다 (drizzle-kit generate 사용 시 메타 불일치로 깨짐). 인증 재설계 시안 [`0005_auth_redesign_REFERENCE.sql`](drizzle/_archive/0005_auth_redesign_REFERENCE.sql) 참조.

### 시드 (데이터)
학과 마스터 같은 정적 데이터 적용:

```bash
pnpm run db:seed       # drizzle/seeds/*.sql 을 알파벳 순서로 적용 (idempotent)
```

---

## 테스트

```bash
pnpm run test       # Vitest 기반 통합 테스트 실행
```

---

## 배포

- **Render.com**을 통해 자동 배포됩니다.
- 상세 설정은 `render.yaml` 파일을 참조하세요.

---

## 프로덕션 배포 전 체크리스트

### 환경변수 (P0 — 누락 시 부트업 실패 또는 기능 마비)
- [ ] `DATABASE_URL` — PostgreSQL 연결
- [ ] `JWT_SECRET` — 운영 미설정 시 서버 부트업이 throw. `openssl rand -base64 48` 권장
- [ ] `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` — 인증 코드 실제 발송
- [ ] `CORS_ALLOWED_ORIGINS` — 외부 도메인에서 호출하는 경우. same-origin 배포면 생략 가능

### 데이터베이스
- [ ] `pnpm run db:push` 실행 — `drizzle/schema.ts` 기반 DDL 동기화
- [ ] `pnpm run db:seed` 실행 — 학과 마스터 시드 (회원가입 시 학과 선택에 필수)

### 코드 상태 (완료)
- [x] `@hufs.ac.kr` 이메일 도메인 강제 검증
- [x] 6자리 코드 SHA-256 해시 저장 + attempts ≤ 10 (현재 정책)
- [x] Rate limit — 이메일/IP 윈도우
- [x] 검증 토큰 1회용 (JWT 30분 + DB consumedAt + userId 일치 검증)
- [x] 가입 상태 머신 (`pending → verified → disabled`) + 권한 미들웨어 4단계
- [x] OAuth 콜백 → onboarding 자동 리다이렉트 + DISABLED 차단 UI
- [x] CORS 화이트리스트 빌더 + 부트업 검증 로그
- [x] AuditLog 적재 (LOGIN / EMAIL_VERIFY / REGISTER / ADMIN_DELETE 등)
- [x] `admin.*` 라우터 `adminProcedure` 로 일관화
- [x] Resend API 통합 — SMTP 차단 환경 회피
- [x] 그룹 시스템 (소통 허브 · 일정 연동 · 고유 키)
- [x] 신고·차단·관리자 처리 흐름
- [x] 회원 탈퇴

### 후속 권장 (P1)
- [ ] **Access(30분) / Refresh(14일) 토큰 분리 + 회전** — 현재 단일 1년 JWT (refreshTokens 테이블 존재, 미사용)
- [ ] **MAX_ATTEMPTS 정책 재검토** — 5 → 10 으로 완화된 상태 (UX vs 보안 trade-off)
- [ ] **운영 환경 환경변수 점검** — JWT_SECRET / SMTP / Resend / CORS / DB
- [ ] **카카오 collaborator·콜백 도메인** — 운영 도메인 등록 확인
- [ ] AuditLog 조회 UI — 데이터는 쌓이지만 관리자 페이지에 미표시
