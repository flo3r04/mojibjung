import {
  ACCOUNT_DISABLED_ERR_MSG,
  NOT_ADMIN_ERR_MSG,
  UNAUTHED_ERR_MSG,
  VERIFICATION_REQUIRED_ERR_MSG,
} from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

// ─────────────────────────────────────────────────────────────────────────────
// 권한 4단계
//   1) publicProcedure              — 누구나 (비로그인 포함)
//   2) protectedProcedure           — 로그인 필수 (status 무관)
//                                     본인 정보 조회·로그아웃·이메일 인증 흐름 등에 사용
//   3) protectedVerifiedProcedure   — 로그인 + status === 'verified'
//                                     글쓰기·신청·쪽지 등 콘텐츠/타인 접촉 액션
//   4) adminProcedure               — role === 'admin' (비활성 계정 제외)
// ─────────────────────────────────────────────────────────────────────────────

export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.status === "disabled") {
    throw new TRPCError({ code: "FORBIDDEN", message: ACCOUNT_DISABLED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const requireVerified = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.status === "disabled") {
    throw new TRPCError({ code: "FORBIDDEN", message: ACCOUNT_DISABLED_ERR_MSG });
  }
  if (ctx.user.status !== "verified") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: VERIFICATION_REQUIRED_ERR_MSG,
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);
export const protectedVerifiedProcedure = t.procedure.use(requireVerified);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (ctx.user.status === "disabled") {
      throw new TRPCError({ code: "FORBIDDEN", message: ACCOUNT_DISABLED_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
