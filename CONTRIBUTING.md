# 🤝 모집중 개발 및 협업 가이드

모집중 프로젝트에 참여하시는 팀원분들을 위한 상세 개발 가이드와 협업 규칙입니다.

---

## 👨‍💻 팀원 개발 가이드 (Quick Start)

기능을 추가하거나 수정할 때 참고할 기본적인 개발 흐름입니다.

### 1. 데이터베이스 스키마 수정
1. `drizzle/schema.ts`에서 테이블 또는 필드를 수정합니다.
2. 터미널에서 `pnpm run db:push`를 실행하여 실제 DB에 반영합니다.

### 2. 백엔드 API (tRPC) 추가
1. `server/routers/` 내의 파일에서 비즈니스 로직을 작성합니다.
2. `server/_core/routers.ts`에 해당 라우터를 등록하여 외부에서 접근 가능하게 합니다.
3. 입력값 검증에는 반드시 **Zod** 스키마를 활용합니다.

### 3. 프론트엔드 연결
1. `client/src/pages/`에 새로운 페이지를 만들거나 기존 페이지를 수정합니다.
2. tRPC 클라이언트를 사용하여 데이터를 호출합니다:
   ```typescript
   // 예시: 게시글 상세 조회
   const { data } = trpc.post.get.useQuery({ id: 1 });
   
   // 예시: 새로운 게시글 생성
   const mutation = trpc.post.create.useMutation();
   mutation.mutate({ title: '제목', content: '내용' });
   ```

---

## 🤝 협업 컨벤션

원활한 팀 협업을 위해 아래의 규칙을 준수합니다.

### 1. 커밋 메시지 규칙 (Conventional Commits)
커밋 메시지는 **`타입: 상세 설명`**의 형식을 따르며, 설명은 한글로 작성합니다.
- **`feat`**: 새로운 기능 추가
- **`fix`**: 버그 수정
- **`docs`**: 문서 수정 (README, 가이드 등)
- **`style`**: 코드 포맷팅, 세미콜론 누락 등 (코드 로직 변경 없음)
- **`refactor`**: 코드 리팩토링
- **`test`**: 테스트 코드 추가 및 수정
- **`chore`**: 빌드 업무, 패키지 매니저 설정 등 (기타 작업)

*예시: `feat: 쪽지 알림 기능 추가`*

### 2. 브랜치 전략 (Feature Branch Workflow)
- **`main`**: 제품 배포 및 가장 안정적인 상태를 유지하는 브랜치입니다.
- **`feat/기능명`**: 새로운 기능 개발 시 생성합니다. (예: `feat/login`, `feat/chat`)
- **`fix/이슈명`**: 버그 수정 시 생성합니다.

### 3. 작업 프로세스
1. 작업을 시작하기 전 `main` 브랜치에서 최신 코드를 가져온 후 새로운 브랜치를 생성합니다.
2. 기능을 구현하고 의미 있는 단위로 커밋을 작성합니다.
3. 작업이 완료되면 `main` 브랜치로 **Pull Request(PR)**를 생성합니다.
4. 팀원의 리뷰를 거친 후 머지(Merge)를 진행합니다.

---

## 🛠 코드 스타일 및 도구
- **Formatter**: `Prettier` (작업 후 `pnpm run format` 실행 권장)
- **Linter**: `ESLint`
- **Type Check**: `pnpm run check` (푸시 전 타입 오류 확인 필수)
