import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getProfileByUserId: vi.fn(),
  upsertProfile: vi.fn(),
  listPosts: vi.fn(),
  getPostById: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  incrementViewCount: vi.fn(),
  getPostsByAuthor: vi.fn(),
  getApplicationByPostAndUser: vi.fn(),
  createApplication: vi.fn(),
  getApplicationsByPost: vi.fn(),
  getApplicationsByUser: vi.fn(),
  updateApplicationStatus: vi.fn(),
  getRecommendedPosts: vi.fn(),
  getDb: vi.fn(),
  // Step 1 이후 신규 함수들 — verified 가입 흐름과 관련된 호출에 모킹 필요
  getDepartmentById: vi.fn().mockResolvedValue({ id: 1, name: "컴퓨터공학부", college: "공과대학" }),
  listDepartments: vi.fn().mockResolvedValue([]),
  createEmailVerification: vi.fn(),
  getLatestPendingVerification: vi.fn(),
  getUserByVerifiedEmail: vi.fn(),
  incrementVerificationAttempts: vi.fn(),
  markVerificationSucceeded: vi.fn(),
  createVerificationTokenRow: vi.fn(),
  getVerificationTokenByJti: vi.fn(),
  completeRegistrationTx: vi.fn(),
  insertAuditLog: vi.fn(),
  // 콘텐츠 보조
  getCommentsByPost: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  toggleLike: vi.fn(),
  toggleBookmark: vi.fn(),
  getBookmarkedPosts: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
  getConversations: vi.fn(),
  markMessagesAsRead: vi.fn(),
  deleteMessage: vi.fn(),
  updateMessage: vi.fn(),
  getTotalUnreadCount: vi.fn(),
  getAllUsers: vi.fn(),
  deleteUser: vi.fn(),
}));

import * as db from "./db";

// ─── Test Helpers ─────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/** 기본은 정회원(verified) — 콘텐츠 액션 테스트가 권한 통과되도록 */
function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "user-1",
    name: "테스트 유저",
    email: "test@hufs.ac.kr",
    loginMethod: "manus",
    role: "user",
    avatarUrl: null,
    status: "verified",
    realName: "테스트",
    studentId: "202012345",
    admissionYear: 2020,
    departmentId: 1,
    verifiedEmail: "test@hufs.ac.kr",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: makeUser(),
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

const MOCK_POST = {
  post: {
    id: 10,
    authorId: 99, // 다른 사용자
    category: "스터디" as const,
    title: "알고리즘 스터디 모집",
    content: "함께 알고리즘을 공부해요",
    capacity: 5,
    deadline: null,
    keywords: '["알고리즘","코딩"]',
    imageUrl: null,
    meetingType: "미정" as const,
    status: "모집중" as const,
    viewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  authorName: "다른 유저",
  authorOpenId: "user-99",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("application.submit - 신청 기능", () => {
  beforeEach(() => vi.clearAllMocks());

  it("정상 신청: 새 신청이 성공적으로 생성된다", async () => {
    vi.mocked(db.getPostById).mockResolvedValue(MOCK_POST as never);
    vi.mocked(db.getApplicationByPostAndUser).mockResolvedValue(undefined as never);
    const mockApp = {
      id: 1, postId: 10, applicantId: 1,
      introduction: "안녕하세요", status: "대기중" as const,
      createdAt: new Date(), updatedAt: new Date(),
    };
    vi.mocked(db.createApplication).mockResolvedValue(mockApp);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.application.submit({ postId: 10, introduction: "안녕하세요" });

    expect(result).toMatchObject({ postId: 10, applicantId: 1, status: "대기중" });
    expect(db.createApplication).toHaveBeenCalledOnce();
  });

  it("중복 신청 방지: 이미 신청한 경우 CONFLICT 에러를 반환한다", async () => {
    vi.mocked(db.getPostById).mockResolvedValue(MOCK_POST as never);
    vi.mocked(db.getApplicationByPostAndUser).mockResolvedValue({
      id: 1, postId: 10, applicantId: 1,
      introduction: null, status: "대기중" as const,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.application.submit({ postId: 10 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "이미 신청한 모집 글입니다.",
    });
    expect(db.createApplication).not.toHaveBeenCalled();
  });

  it("마감된 모집에는 신청할 수 없다", async () => {
    vi.mocked(db.getPostById).mockResolvedValue({
      ...MOCK_POST,
      post: { ...MOCK_POST.post, status: "마감" as const },
    } as never);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.application.submit({ postId: 10 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "마감된 모집입니다.",
    });
  });

  it("본인 게시글에는 신청할 수 없다", async () => {
    vi.mocked(db.getPostById).mockResolvedValue({
      ...MOCK_POST,
      post: { ...MOCK_POST.post, authorId: 1 }, // 본인 게시글
    } as never);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.application.submit({ postId: 10 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "본인이 작성한 모집 글에는 신청할 수 없습니다.",
    });
  });

  it("로그인하지 않은 사용자는 신청할 수 없다", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.application.submit({ postId: 10 })).rejects.toThrow();
  });

  // Step 2 회귀 — PENDING 사용자는 콘텐츠 액션이 차단되어야 한다
  it("PENDING 사용자는 신청할 수 없다 (protectedVerifiedProcedure)", async () => {
    const ctx = makeCtx({ user: makeUser({ status: "pending" }) });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.application.submit({ postId: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.createApplication).not.toHaveBeenCalled();
  });

  // Step 2 회귀 — DISABLED 사용자는 모든 요청이 차단되어야 한다
  it("DISABLED 사용자는 신청할 수 없다", async () => {
    const ctx = makeCtx({ user: makeUser({ status: "disabled" }) });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.application.submit({ postId: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("profile.upsert - 프로필 저장 (6-a 마이그레이션 반영)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("departmentId 입력 시 학과 FK 검증 + upsertProfile 호출", async () => {
    const mockProfile = {
      id: 1, userId: 1,
      department: null,
      grade: "3" as const,
      bio: "안녕하세요",
      keywords: '["프로그래밍","AI"]',
      createdAt: new Date(), updatedAt: new Date(),
    };
    vi.mocked(db.upsertProfile).mockResolvedValue(mockProfile);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profile.upsert({
      departmentId: 1,
      grade: "3",
      bio: "안녕하세요",
      keywords: ["프로그래밍", "AI"],
    });

    expect(db.getDepartmentById).toHaveBeenCalledWith(1);
    expect(db.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        departmentId: 1,
        department: null, // @deprecated — 항상 NULL
        keywords: '["프로그래밍","AI"]',
      })
    );
    expect(result?.keywords).toBe('["프로그래밍","AI"]');
  });

  it("존재하지 않는 departmentId 는 BAD_REQUEST", async () => {
    vi.mocked(db.getDepartmentById).mockResolvedValueOnce(null);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.profile.upsert({ departmentId: 99999 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "존재하지 않는 학과입니다.",
    });
    expect(db.upsertProfile).not.toHaveBeenCalled();
  });

  it("PENDING 사용자의 프로필 수정은 차단된다", async () => {
    const ctx = makeCtx({ user: makeUser({ status: "pending" }) });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.profile.upsert({ grade: "3" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("post.create - 게시글 작성", () => {
  beforeEach(() => vi.clearAllMocks());

  it("정회원이 게시글을 작성할 수 있다", async () => {
    const mockPost = {
      post: {
        id: 1, authorId: 1,
        category: "스터디" as const,
        title: "파이썬 스터디",
        content: "파이썬을 함께 공부하는 스터디입니다.",
        capacity: 5,
        deadline: null,
        keywords: '["파이썬"]',
        imageUrl: null,
        meetingType: "미정" as const,
        status: "모집중" as const,
        viewCount: 0,
        createdAt: new Date(), updatedAt: new Date(),
      },
      authorName: "테스트 유저",
      authorOpenId: "user-1",
    };
    vi.mocked(db.createPost).mockResolvedValue(mockPost as never);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.post.create({
      category: "스터디",
      title: "파이썬 스터디",
      content: "파이썬을 함께 공부하는 스터디입니다.",
      capacity: 5,
      keywords: ["파이썬"],
    });

    expect(result?.post.title).toBe("파이썬 스터디");
    expect(db.createPost).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 1, category: "스터디" })
    );
  });

  it("PENDING 사용자는 게시글을 작성할 수 없다", async () => {
    const ctx = makeCtx({ user: makeUser({ status: "pending" }) });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.post.create({
        category: "스터디",
        title: "파이썬 스터디",
        content: "파이썬을 함께 공부하는 스터디입니다.",
        capacity: 5,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin.* - 관리자 라우터 (adminProcedure)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("일반 정회원은 사용자 목록을 조회할 수 없다", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.listUsers()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("관리자는 사용자 목록을 조회할 수 있다", async () => {
    vi.mocked(db.getAllUsers).mockResolvedValue([]);

    const ctx = makeCtx({ user: makeUser({ role: "admin" }) });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.listUsers();
    expect(result).toEqual([]);
    expect(db.getAllUsers).toHaveBeenCalledOnce();
  });

  it("관리자는 자기 자신을 삭제할 수 없다", async () => {
    const ctx = makeCtx({ user: makeUser({ role: "admin" }) });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.deleteUser({ userId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.deleteUser).not.toHaveBeenCalled();
  });

  it("관리자는 다른 사용자를 삭제할 수 있고 AuditLog 가 적재된다", async () => {
    vi.mocked(db.deleteUser).mockResolvedValue(undefined as never);

    const ctx = makeCtx({ user: makeUser({ role: "admin" }) });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.deleteUser({ userId: 42 });
    expect(result).toEqual({ success: true });
    expect(db.deleteUser).toHaveBeenCalledWith(42);
    expect(db.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_DELETE_USER",
        userId: 1,
        metadata: { targetUserId: 42 },
      })
    );
  });
});
