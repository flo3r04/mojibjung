# [기술 명세서] 한국외대 실명 기반 모집 커뮤니티 — 모집중 (Mojibjung)

> **문서 버전**: v1.0.0  
> **최종 갱신일**: 2026-11-04  
> **문서 대상**: 신규 개발자, 기획자, 운영자 및 본 프로젝트를 처음 접하는 모든 이해관계자

---

## 1. 프로젝트 개요 (Overview)

### 1.1 서비스 소개
**'모집중'**은 한국외국어대학교(HUFS) 글로벌캠퍼스 학생들을 위한 **실명 기반 동아리 · 학회 · 프로젝트 · 스터디 모집 및 협업 커뮤니티**입니다. 
익명 커뮤니티의 신뢰도 저하 및 노쇼 문제를 방지하기 위해 실명과 학번, 학과, 학교 이메일(`@hufs.ac.kr`) 인증을 결합한 폐쇄형 실명 네트워크를 구축하고, 지원서 접수·면접·선발부터 그룹(소통/일정/채팅/공지) 관리까지 원스톱으로 지원합니다.

### 1.2 서비스 해결 과제
1. **신뢰성 보장**: 카카오 간편인증 + 교내 학적/이메일 검증을 통해 신원 불명 사용자 및 분란 조장 차단
2. **모집 프로세스 자동화**: 구글 폼 대체용 동적 질문지 생성, 다단계 전형(서류 대기 → 1차 합격 → 최종 수락/거절) 및 통계 대시보드 제공
3. **선발 후 활동 연계**: 모집이 끝나면 모집글이 단절되지 않고 자치 **'그룹(Group Hub)'**으로 자동 승격되어 공지, 일정, 실시간 채팅 지원
4. **학사 일정 통합**: 학사 일정 + 공휴일 + 개인 일정 + 지원 마감일을 한눈에 보여주는 캘린더 및 레인 배치 알고리즘 내장

---

## 2. 전체 시스템 아키텍처 (System Architecture)

```
+-----------------------------------------------------------------------------------------+
|                                    Client (Browser)                                     |
|  - React 19.2 + Vite 7 (SPA)                                                            |
|  - Styling: Tailwind CSS 4 + shadcn/ui (Radix Primitives) + Framer Motion              |
|  - Routing: wouter (가벼운 해시/히스토리 라우팅)                                       |
|  - Data Fetching & Cache: tRPC React Client + @tanstack/react-query                    |
+-----------------------------------------------------------------------------------------+
                                           │
                                           │ HTTP/JSON-RPC (Cookie 포함)
                                           ▼
+-----------------------------------------------------------------------------------------+
|                                  Server (Node.js/Express)                               |
|  - Monolithic Architecture: Single Process Serving Frontend Assets + API                |
|  - Core: Express 4 + tRPC 11 (End-to-End Type Safety)                                   |
|  - Authentication: Kakao OAuth 2.0 Callback + Jose (JWT) + HttpOnly/Secure Cookies       |
|  - Security & Guard: Rate Limiting (Sliding Window), Timing Attack Prevention (Crypto) |
+-----------------------------------------------------------------------------------------+
            │                               │                               │
            ▼                               ▼                               ▼
+-----------------------+       +-----------------------+       +-----------------------+
|  PostgreSQL Database  |       |     External Mail     |       |    Storage / Media    |
| - Drizzle ORM (21 tbl)|       | - Resend API (우선)   |       | - Cloudinary SDK      |
| - JSONB dynamic form  |       | - Nodemailer (폴백)   |       |   (프로필/배너/본문)  |
| - Partial Indexing    |       |                       |       |                       |
+-----------------------+       +-----------------------+       +-----------------------+
```

### 2.1 기술 스택 상세표
| 계층 (Layer) | 사용 기술 | 선정 사유 및 역할 |
|---|---|---|
| **프론트엔드** | React 19.2, Vite 7 | 최신 리액트 아키텍처 기반 빠른 번들링과 HMR 지원 |
| **라우팅 / UI** | wouter, Tailwind CSS 4, shadcn/ui | React Router 대비 경량화(wouter), 디자인 통일성과 접근성 보장 |
| **인터랙션 / 차트** | Framer Motion, Recharts | 부드러운 트랜지션 및 지원자 통계 시각화(합격률/성별/문항별) |
| **상태 관리 & API** | tRPC v11, TanStack React Query v5 | 클라이언트-서버 간 DTO 타입 100% 동기화, 컴파일 타임 에러 검출 |
| **백엔드 프레임워크** | Node.js, Express 4 | 신뢰성 높은 모놀리식 정적 서빙 및 API 미들웨어 체인 구성 |
| **데이터베이스 / ORM** | PostgreSQL, Drizzle ORM | 타입 안전한 쿼리 빌더 및 빠른 속도, JSONB 네이티브 처리 |
| **인증 & 보안** | Kakao OAuth 2.0, Jose (JWT), crypto | 패스워드리스 카카오 소셜 로그인 + SHA-256 OTP 및 timingSafeEqual |
| **인프라 & 서드파티** | Cloudinary (이미지), Resend / SMTP | 이미지 CDN 최적화 및 메일 발송 이중화(Failover) 무장애 체계 |

---

## 3. 핵심 도메인 개념 및 데이터 모델링

### 3.1 사용자 상태 머신 (FSM: Finite State Machine)
모든 사용자는 가입 및 활동 주기에 따라 엄격한 3가지 상태(`status`)를 가집니다.

```
       [ 카카오 로그인 완료 ]
                 │
                 ▼
          +--------------+   실명 / 학번 / 학과 입력 완료
          |   PENDING    | ───────────────────────────────► +--------------+
          | (가입 대기)  |                                  |   VERIFIED   |
          +--------------+                                  |   (정회원)   |
                 │                                          +--------------+
                 │ 운영 원칙 위반                                   │ 운영 원칙 위반
                 ▼                                                  ▼
          +----------------------------------------------------------------+
          |                            DISABLED                            |
          |                   (계정 제재 / 서비스 이용 차단)               |
          +----------------------------------------------------------------+
```

* **`pending` (가입 대기)**: 최초 카카오 로그인 시 부여되는 상태입니다. 플랫폼 내 콘텐츠 조회가 제한되거나, 글쓰기/신청/쪽지 등의 쓰기 권한이 차단되며 프로필/인증 입력 페이지로 유도됩니다.
* **`verified` (정회원)**: 학번, 실명, 학과 및 학교 인증 절차를 통과한 상태입니다. 모든 게시글 작성, 신청, 그룹 활동, 1:1 쪽지 권한이 활성화됩니다.
* **`disabled` (계정 제재)**: 관리자에 의해 강제 제재된 계정입니다. 세션 쿠키가 즉시 파기되며, 로그인 시도 시 `OnboardingGuard` 컴포넌트가 감지하여 차단 안내 화면으로 격리합니다.

### 3.2 핵심 데이터베이스 테이블 (Drizzle ORM)

| 테이블 명 | 설명 | 주요 컬럼 및 특징 |
|---|---|---|
| **`users`** | 회원 정체성 및 인증 상태 | `openId`(카카오 고유키), `role`(`user`\|`admin`), `status`(`pending`\|`verified`\|`disabled`), `realName`, `studentId`, `admissionYear`, `departmentId`, `verifiedEmail` |
| **`departments`** | 외대 학과 마스터 데이터 | 한국외대 글로벌캠퍼스 34개 학과 고유 ID 및 명칭 |
| **`profiles`** | 사용자 공개 프로필 | `userId`(1:1), `bio`(자기소개 200자), `grade`(학년), `keywords`(관심 키워드 JSON 배열, 최대 10개) |
| **`posts`** | 모집 게시글 | `title`, `content`, `category`(`동아리`\|`학회`\|`프로젝트`\|`스터디`\|`기타`), `status`(`모집중`\|`모집완료`), `formSchema`(동적 폼 JSONB), `hasInterview`(면접 여부), `groupId`(연동 그룹 FK) |
| **`applications`** | 모집 지원서 | `postId`, `applicantId` (복합 Unique로 중복 신청 차단), `status`(`대기중`\|`1차합격`\|`수락`\|`거절`), `answers`(응답 데이터 JSONB), `rejectReason` |
| **`groups`** | 자치 동아리/스터디 허브 | `groupKey`(`XXXX-XXXX-XXXX` 난수 키), `name`, `description`, `category`, `leaderId` |
| **`groupRoles`** | 그룹 내 커스텀 직책 | `groupId`, `name`(예: 회장, 총무, 팀원), `permissions`(권한 비트) |
| **`groupMembers`** | 그룹 소속 회원 | `groupId`, `userId`, `roleId` |
| **`groupAnnouncements`** | 그룹 공지사항 | `groupId`, `authorId`, `title`, `content`, `isPinned` |
| **`groupChatMessages`** | 그룹 실시간 대화 | `groupId`, `senderId`, `message` |
| **`messages`** | 1:1 쪽지 | `senderId`, `receiverId`, `postId`(연계 모집글), `content`, `isRead` |
| **`reports`** | 신고 내역 | `reporterId`, `targetType`(`post`\|`comment`\|`user`\|`message`), `targetId`, `reason`, `status`(`pending`\|`resolved`\|`dismissed`) |
| **`blocks`** | 사용자 차단 목록 | `blockerId`, `blockedId` (양방향 검색/추천/쪽지 배제 필터링 적용) |
| **`calendarEvents`** | 마이 캘린더 일정 | `userId`(공개 학사일정은 NULL, 개인일정은 FK), `groupId`(그룹 일정), `startDate`, `endDate`, `category`(`academic`\|`personal`\|`holiday`\|`recruitment`) |
| **`emailVerifications`** | 이메일 OTP 기록 | `userId`, `email`, `codeHash`(SHA-256), `attempts`(최대 5회), `expiresAt` |
| **`auditLog`** | 보안 및 관리자 감사 로그 | `userId`, `action`, `ipAddress`, `userAgent`, `metadata` |

---

## 4. 프론트엔드 라우팅 및 화면별 기능 명세

총 14개의 핵심 페이지와 시스템 가드로 구성되어 있습니다.

```
/ (Home) ───────────┬─► /board (모집글 탐색) ────► /post/:id (상세/지원/댓글)
                    ├─► /post/new (새 모집글 작성)
                    ├─► /post/:id/manage (지원자 통계 & 전형 관리)
                    ├─► /calendar (학사/개인 통합 일정)
                    ├─► /groups (자치 그룹 허브 & 실시간 채팅)
                    ├─► /messages (1:1 쪽지함)
                    ├─► /mypage (내 작성글 / 지원 내역)
                    ├─► /profile (내 프로필 및 관심 키워드)
                    ├─► /user/:id (타인 프로필 보기)
                    ├─► /blocks (차단 관리)
                    └─► /admin (관리자 대시보드)
```

### 4.1 메인 홈 (`/`)
* **상단 비주얼 캐러셀**: 4개의 슬라이드가 부드럽게 자동 롤링되며 외대 공지사항, 추천 활동, 모집 가이드를 시각적으로 노출합니다.
* **관심사 기반 개인화 추천**: 로그인한 사용자가 프로필에 등록한 관심 키워드(`keywords`)를 기반으로 가중치를 매겨 최적의 모집글을 매칭해 추천합니다.
* **카테고리별 실시간 탭**: 동아리, 학회, 프로젝트, 스터디별 최신 등록글 카드 피드를 제공합니다.

### 4.2 모집 게시판 (`/board`)
* **필터링 & 검색 시스템**:
  * 카테고리 필터 (전체, 동아리, 학회, 프로젝트, 스터디, 기타)
  * 모집 상태 필터 (전체, 모집중, 마감)
  * 검색어 실시간 디바운스 검색 (제목, 본문 내용 매칭)
  * 정렬 옵션 (최신순, 인기순/조회순, 마감임박순)
* **페이지네이션**: 페이지당 24개 카드 그리드로 렌더링되며, 마감일 디데이(D-Day) 배지가 동적으로 계산되어 표시됩니다.

### 4.3 게시글 작성 및 수정 (`/post/new`, `/post/:id/edit`)
* **접근 제어**: `verified` 상태의 정회원만 작성이 허용됩니다.
* **동적 질문지 폼 빌더 (Form Builder)**:
  * 작성자가 지원자로부터 받고 싶은 질문을 자유롭게 커스텀할 수 있습니다.
  * 단답형 텍스트, 장문형 텍스트, 단일 선택(라디오), 다중 선택(체크박스), 필수 여부 설정을 지원하며 JSONB 형태로 저장됩니다.
* **면접 전형 토글 (`hasInterview`)**: 서류 전형만 진행할지, 1차 서류 합격 후 면접을 거칠지 프로세스를 선택합니다.
* **그룹 연동 옵션**: 모집 종료 시 지원자들을 합류시킬 자치 그룹을 사전 지정할 수 있습니다.

### 4.4 게시글 상세 및 지원하기 (`/post/:id`)
* **상세 정보 표시**: 모집 요강, 모집 인원, 마감 기한, 주최자 프로필, 면접 전형 유무 안내.
* **신청 모달 (Application Modal)**:
  * 모집글에 정의된 동적 질문지(`formSchema`)를 클라이언트 폼으로 즉시 렌더링하여 지원자의 입력을 검증합니다.
  * 중복 지원 시도시 백엔드 복합 고유 제약조건에 의해 차단 안내가 출력됩니다.
* **소통 컴포넌트**:
  * 댓글 및 대댓글(1단계 계층) 기능
  * 주최자에게 바로 1:1 쪽지 보내기 버튼
  * 신고하기(`ReportDialog`) 및 주최자 차단 기능

### 4.5 지원자 관리 및 통계 (`/post/:id/manage`)
* **Recharts 기반 데이터 시각화**:
  * 지원자 전형 상태 분포 (대기중 / 1차 합격 / 최종 수락 / 거절) 도넛/파이 차트
  * 설문 문항 응답 집계 분석
* **전형 상태 처리**:
  * 면접 전형이 활성화된 경우: `대기중` → `1차 합격(서류통과)` → `수락(최종합격)` 단계적 전이
  * 일반 전형: `대기중` → `수락` 또는 `거절`
  * 지원자 거절 시 정중한 거절 사유(`rejectReason`) 작성 및 피드백 전송 지원

### 4.6 마이 캘린더 (`/calendar`)
* **4대 일정 통합 렌더링**:
  1. 학교 공식 학사일정 (수강신청, 시험기간, 방학 등)
  2. 대한민국 법정 공휴일
  3. 개인이 직접 등록한 일정 (마이 메모)
  4. 본인이 북마크하거나 지원한 모집글의 마감일 (자동 동기화)
  5. 소속 그룹의 공식 활동 일정
* **그리디 레인(Lane) 충돌 방지 알고리즘**: 하루에 일정이 여러 개 겹칠 때 높이가 깨지지 않도록 최대 3개 레인으로 일정을 수평 정렬하고 초과분은 "+N개 더보기"로 그룹화합니다.

### 4.7 그룹 허브 (`/groups`)
* **고유 키 초대 시스템**: `XXXX-XXXX-XXXX` 난수 키를 생성하여 타 학생이 키를 입력하면 바로 그룹에 참여할 수 있습니다.
* **직책 및 권한 부여**: 그룹장은 총무, 매니저 등 역할을 신설하고 권한을 위임할 수 있습니다.
* **그룹 공지사항**: 상단 고정(Pin) 기능이 포함된 그룹 내부 공지 게시판.
* **실시간 그룹 채팅**: 그룹 멤버 간의 빠른 의사결정 및 대화창 지원.

### 4.8 1:1 쪽지함 (`/messages`)
* **대화방 스레드 목록**: 대화 상대별 최신 메시지와 읽지 않은 메시지 수(뱃지) 표기.
* **차단 관계 양방향 검사**: 송신자 또는 수신자 중 한 명이라도 차단한 관계인 경우 메시지 전송이 차단되며 개인정보를 보호합니다.

### 4.9 마이페이지 (`/mypage`) & 프로필 (`/profile`, `/user/:id`)
* **학교 인증 정보 배지**: 실명, 학번(앞 2자리 또는 마스킹), 학과를 신뢰성 있게 증명.
* **활동 탭**: 내가 작성한 모집글, 내가 지원한 현황(전형 상태 실시간 조회), 북마크한 글 모음.
* **키워드 태깅**: 관심 태그 최대 10개를 칩(Chip) 형태로 등록하여 홈 피드 추천 알고리즘과 연동.

### 4.10 관리자 대시보드 (`/admin`)
* **관리자 전용 접근 통제**: `user.role === 'admin'`인 계정만 접근 가능.
* **신고 센터**: 접수된 게시글, 댓글, 사용자, 쪽지 신고 내역을 열람하고 `resolved`(조치완료) 또는 `dismissed`(기각) 처리.
* **사용자 제재/복구**: 비매너 또는 허위 유저를 `disabled` 상태로 변경하여 서비스 접근 영구 격리.

---

## 5. 백엔드 API 명세 (tRPC v11 Router)

REST 엔드포인트 대신 타입 안정성을 제공하는 **tRPC 프로시저**로 구성되어 있습니다.

### 5.1 미들웨어 인가 체계
1. `publicProcedure`: 로그인 없이 누구나 조회 가능한 엔드포인트
2. `protectedProcedure`: 세션 쿠키가 유효한 사용자만 허용
3. `protectedVerifiedProcedure`: `status === 'verified'`인 정회원만 허용 (글쓰기, 신청, 쪽지 등)
4. `adminProcedure`: `role === 'admin'`인 관리자만 실행 가능

### 5.2 13개 라우터 요약표

| 라우터 모듈 | 프로시저 명 | 타입 | 권한 | 주요 기능 및 인자 설명 |
|---|---|---|---|---|
| **`auth`** | `me` | Query | Public | 현재 로그인 유저 정보 및 세션 상태 반환 |
| | `logout` | Mutation | Public | 세션 쿠키 파기 및 로그아웃 감사 로그 기록 |
| | `withdraw` | Mutation | Protected | 회원 탈퇴 (10개 관계 테이블 수동 연쇄 삭제 트랜잭션) |
| | `completeRegistration`| Mutation | Protected | 실명/학번/학과 등록으로 PENDING → VERIFIED 승격 |
| **`department`** | `list` | Query | Public | 외대 34개 학과 마스터 목록 조회 |
| **`profile`** | `get` | Query | Protected | 내 프로필(소개, 학년, 키워드) 조회 |
| | `upsert` | Mutation | Protected | 프로필 등록 및 갱신 |
| | `getUserProfile` | Query | Protected | 특정 유저 ID의 공개 프로필 및 활동 내역 조회 |
| **`post`** | `list` | Query | Public | 모집글 필터링, 검색, 정렬 및 페이지네이션 목록 |
| | `getById` | Query | Public | 게시글 단건 상세 조회 (조회수 1 증가) |
| | `create` / `update` | Mutation | Verified | 게시글 작성 및 수정 (동적 formSchema 저장) |
| | `delete` | Mutation | Verified | 게시글 삭제 (작성자 검증) |
| | `toggleLike` / `Bookmark`| Mutation | Verified | 좋아요 및 북마크 토글 |
| | `recommended` | Query | Protected | 사용자 관심 키워드 기반 개인화 추천글 조회 |
| **`comment`** | `listByPostId` | Query | Public | 특정 모집글의 댓글 및 대댓글 목록 조회 |
| | `create` / `delete` | Mutation | Verified | 댓글 작성 및 삭제 |
| **`application`**| `submit` | Mutation | Verified | 모집글 지원서 제출 (answers JSONB 저장, 중복 방지) |
| | `listByPostId` | Query | Verified | 작성자 전용: 지원자 목록 및 설문 응답 조회 |
| | `updateStatus` | Mutation | Verified | 지원자 상태 변경 (`대기중` → `1차합격` → `수락`/`거절`) |
| | `myApplications` | Query | Protected | 내가 지원한 모집글 및 합격 여부 내역 조회 |
| **`calendar`** | `getUnifiedEvents`| Query | Public/User| 학사일정 + 공휴일 + 개인일정 + 지원 마감일 병합 추출 |
| | `createEvent` / `delete`| Mutation | Protected | 개인 일정 추가 및 삭제 |
| **`group`** | `myGroups` | Query | Protected | 내가 속한 자치 그룹 목록 |
| | `create` / `join` | Mutation | Verified | 그룹 생성 및 고유 난수 키(`groupKey`)로 가입 |
| | `getGroupDetail` | Query | Verified | 그룹 대시보드 (멤버, 공지, 일정) 조회 |
| | `addAnnouncement` | Mutation | Verified | 그룹 공지사항 작성 (핀 고정 여부 지원) |
| | `sendChatMessage` | Mutation | Verified | 그룹 실시간 대화 전송 |
| **`message`** | `getThreads` | Query | Verified | 대화 상대별 1:1 쪽지 목록 요약 |
| | `getThreadMessages` | Query | Verified | 특정 상대와의 메시지 히스토리 조회 및 읽음 처리 |
| | `send` | Mutation | Verified | 1:1 쪽지 발송 (상호 차단 여부 검증) |
| **`block`** | `list` / `toggle` | Mutation | Protected | 차단한 유저 목록 조회 및 차단/해제 처리 |
| **`report`** | `create` | Mutation | Protected | 게시글/댓글/사용자/메시지 신고 접수 |
| **`upload`** | `image` | Mutation | Protected | Cloudinary에 Base64 이미지 전송 및 CDN URL 반환 |
| **`admin`** | `getUsers` / `getReports` | Query | Admin | 전체 유저 목록 및 미해결 신고 목록 열람 |
| | `updateUserStatus` | Mutation | Admin | 유저 강제 정지(`disabled`) 또는 정상화(`verified`) |
| | `updateReportStatus` | Mutation | Admin | 신고 상태 업데이트 (`resolved` / `dismissed`) |

---

## 6. 보안, 안정성 및 핵심 알고리즘 설계

### 6.1 이메일 OTP 검증 및 타이밍 공격 방어
* **SHA-256 단방향 암호화**: 6자리 OTP 인증 코드는 데이터베이스에 평문으로 남지 않고 SHA-256 해시값으로만 보관됩니다.
* **상수 시간 비교 (`timingSafeEqual`)**: 자바스크립트 기본 문자열 비교(`===`)는 첫 글자가 다를 경우 연산을 조기 종료하므로, 공격자가 미세한 응답 시간 차이로 해시를 유추하는 타이밍 공격(Timing Attack)이 가능합니다. 이를 방어하기 위해 `crypto.timingSafeEqual`을 적용하여 일치 여부와 관계없이 항상 고정된 연산 시간을 소모하도록 보장했습니다.
* **전송 인프라 자동 폴백(Failover)**: 클라우드 환경에서 발생할 수 있는 SMTP 해외 IP 포트 차단 및 네트워크 지연에 대비하여 **Resend API를 1순위로 호출하고 실패 시 Nodemailer SMTP로 즉시 자동 우회**합니다.

### 6.2 NULL 값 UNIQUE 충돌 극복 (PostgreSQL 부분 인덱스)
* **문제점**: 1인 1계정 원칙에 따라 `studentId`(학번)와 `verifiedEmail`(인증메일)은 중복될 수 없습니다. 그러나 카카오 로그인 직후 가입을 완료하기 전인 `pending` 유저는 해당 컬럼이 `NULL`입니다. 표준 UNIQUE 인덱스는 다수의 `NULL` 또한 중복으로 취급하여 신규 유저 생성을 막는 오류를 발생시킵니다.
* **해결책**: PostgreSQL 조건부 부분 인덱스(Conditional Partial Index)를 선언하여 컬럼 값이 존재하는 경우(`WHERE "studentId" IS NOT NULL`)에만 UNIQUE 인덱스가 작동하도록 설계했습니다.

### 6.3 캘린더 그리디 레인(Greedy Lane) 배치 알고리즘
* **목적**: 한 주 동안 다수의 일정이 겹칠 때 일정 막대가 서로 겹치거나 가려지지 않고 깔끔하게 층(Layer)을 이루어 렌더링되도록 보장합니다.
* **알고리즘 절차**:
  1. 현재 화면에 표시되는 주간(일~토) 범위 내에 존재하는 $N$개의 일정을 추출합니다.
  2. **정렬 우선순위**: `기간이 긴 일정(1순위) > 시작일이 빠른 일정(2순위) > 일정 제목(3순위)` 순으로 내림차순 정렬합니다. ($\mathcal{O}(N \log N)$)
  3. **레인 배정**: 최대 3개의 수평 레인을 순회하며 직전 일정과 날짜가 겹치지 않는 가장 낮은 인덱스의 레인에 일정을 밀어 넣습니다. ($\mathcal{O}(3N)$)
  4. 3개 레인을 초과하는 일정은 화면에 바를 그리지 않고 "+K개" 텍스트로 합산 처리합니다.
  5. **총 시간 복잡도**: $\mathcal{O}(N \log N)$으로 수백 개의 일정도 16ms(60fps) 이내에 렌더링합니다.

### 6.4 비정형 질문지 데이터 (JSONB 하이브리드 모델링)
모집 단위(동아리, 학회 등)마다 요구하는 질문 문항(예: "포트폴리오 링크", "면접 가능 시간대", "지원 동기")이 완전히 다릅니다.
* RDB 전통 방식으로 이를 테이블로 분리하면 모집글마다 수십 번의 `JOIN`과 DDL 스키마 변경이 유발됩니다.
* 이를 해결하기 위해 PostgreSQL의 고속 이진 JSON 타입인 **JSONB**를 채택했습니다:
  * `posts.formSchema`: 문항 리스트, 타입, 선택지 직렬화 저장
  * `applications.answers`: 지원자의 문항 ID별 답변 Key-Value 저장
  * 이를 통해 테이블 구조 변경 없이 무제한으로 동적 질문지를 확장하며 단일 쿼리로 초고속 조회를 달성했습니다.

---

## 7. 환경 변수 및 설정 가이드

서버 및 클라이언트 구동을 위해 다음 환경 변수가 `.env` 파일에 정의되어야 합니다.

| 환경 변수 명 | 필수 여부 | 설명 |
|---|:---:|---|
| `DATABASE_URL` | **필수** | PostgreSQL 데이터베이스 접속 연결 문자열 (`postgresql://...`) |
| `JWT_SECRET` | **필수** | 사용자 세션 토큰 서명에 사용되는 32자 이상의 비밀키 |
| `VITE_KAKAO_CLIENT_ID` | **필수** | 카카오 개발자 센터 REST API 키 |
| `RESEND_API_KEY` | 권장 | 클라우드 이메일 발송용 Resend API 키 |
| `SMTP_HOST`, `SMTP_PORT` | 선택 | 이메일 발송 백업용 SMTP 서버 주소 및 포트 |
| `SMTP_USER`, `SMTP_PASS` | 선택 | SMTP 인증 계정 및 비밀번호 |
| `CLOUDINARY_CLOUD_NAME` | 선택 | 이미지 저장을 위한 Cloudinary 클라우드 명 |
| `CLOUDINARY_API_KEY` | 선택 | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | 선택 | Cloudinary API Secret |
| `PORT` | 선택 | 서버 실행 포트 (기본값: `3000`) |
| `NODE_ENV` | 선택 | `development` 또는 `production` |

---

## 8. 실행 및 운영 가이드 (Quick Start)

### 8.1 개발 환경 실행
```bash
# 1. 의존성 패키지 설치
pnpm install

# 2. 데이터베이스 스키마 반영 및 마스터 데이터 시딩
pnpm db:push
pnpm db:seed

# 3. 로컬 풀스택 개발 서버 동시 구동 (Client: 5173, Server: 3000)
pnpm dev
```

### 8.2 프로덕션 빌드 및 배포
```bash
# 1. 클라이언트(Vite) 빌드 + 서버(esbuild) 단일 번들링
pnpm build

# 2. 프로덕션 단일 서버 가동
pnpm start
```

---

## 9. 기술 명세 요약 및 유지보수 체크리스트

1. **타입 무결성 검사**: 백엔드 라우터 수정 시 프론트엔드 빌드(`pnpm check`)를 실행하여 타입 불일치가 없는지 점검합니다.
2. **트랜잭션 격리**: 사용자 탈퇴 또는 그룹 해체 시 관계 데이터가 누락되어 고아 레코드(Orphan row)가 발생하지 않도록 `db.transaction()` 블록을 유지해야 합니다.
3. **보안 감사**: 관리자 권한 작업 및 로그인 시도는 `auditLog` 테이블에 IP와 브라우저 환경이 올바르게 기록되는지 모니터링합니다.
