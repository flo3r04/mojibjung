import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// AuditLog DB INSERT 가 fire-and-forget 으로 호출되므로
// DB 없는 테스트 환경에서도 unhandled rejection 이 안 나도록 모킹
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    insertAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  // Step 1 이후로 User 가 status / realName / studentId / admissionYear /
  // departmentId / verifiedEmail / avatarUrl 필드를 가진다.
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    avatarUrl: null,
    status: "verified",
    realName: "샘플",
    studentId: "202012345",
    admissionYear: 2020,
    departmentId: 1,
    verifiedEmail: "sample@hufs.ac.kr",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    // sameSite 는 NODE_ENV 에 따라 'none'(prod) 또는 'lax'(dev) — 테스트 환경 무관하게 검증
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      httpOnly: true,
      path: "/",
    });
    expect(clearedCookies[0]?.options.sameSite).toMatch(/^(none|lax)$/);
  });
});
