import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createApplication,
  createPost,
  deletePost,
  getApplicationByPostAndUser,
  getApplicationsByPost,
  getApplicationsByUser,
  getApplicationById,
  getPostById,
  getPostsByAuthor,
  getProfileByUserId,
  getRecommendedPosts,
  incrementViewCount,
  listPosts,
  updateApplicationStatus,
  updatePost,
  upsertProfile,
  getAllUsers,
  deleteUser,
  sendMessage,
  getMessages,
  getConversations,
  markMessagesAsRead,
  deleteMessage,
  updateMessage,
  getTotalUnreadCount,
  getCommentsByPost,
  createComment,
  deleteComment,
  toggleLike,
  toggleBookmark,
  getBookmarkedPosts,
  createReport,
  listReports,
  updateReportStatus,
  createBlock,
  deleteBlock,
  getBlockedUserIds,
  updateUserStatus,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getGroupsByLeader,
  getGroupByAccessKey,
  getGroupById,
  createGroup,
  joinGroupWithKey,
  autoJoinGroupMember,
  getGroupMembers,
  getUserGroupIds,
  getGroupEvents,
  createGroupCalendarEvent,
  updateGroupCalendarEvent,
  deleteGroupCalendarEvent,
  listUserGroupCalendarEvents,
  getAllGroups,
  deleteGroup,
  checkGroupPermissions,
  removeGroupMember,
  assignMemberRole,
  getGroupRoles,
  createGroupRole,
  deleteGroupRole,
  updateGroupRole,
  getUserJoinedAndLedGroups,
  getGroupAnnouncements,
  createGroupAnnouncement,
  deleteGroupAnnouncement,
  getGroupChatMessages,
  createGroupChatMessage,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getGroupFiles,
  createGroupFile,
  deleteGroupFile,
  archiveGroup,
  getGroupArchives,
  getGroupArchiveDetail,
  createGroupStudy,
  getGroupStudies,
  getGroupStudyMembers,
  setGroupStudyMembers,
  getGroupStudyMinutes,
  getGroupStudyMinuteDetail,
  createGroupStudyMinute,
  updateGroupStudyMinute,
  deleteGroupStudyMinute,
  deleteGroupStudy,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  adminProcedure,
  protectedProcedure,
  protectedVerifiedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { AuditAction, logAuditFromCtx } from "./_core/audit";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";
import {
  completeRegistrationSimplified,
  getDepartmentById,
  listDepartments,
  getDb,
} from "./db";
import { and, eq, desc, isNull, isNotNull, gte } from "drizzle-orm";
import { emailVerificationService } from "./emailService";
import { emailVerifications, users } from "../drizzle/schema";

// ─── Zod 스키마 (데이터 검증 도구) ───────────────────────────────────────────────────

// 카테고리 종류 정의
const categoryEnum = z.enum(["동아리", "학회", "스터디"]);
// 게시판 필터용 — post.list 전용
const categoryFilterEnum = z.enum(["동아리", "학회", "스터디"]);
// 학년 종류 정의
const gradeEnum = z.enum(["1", "2", "3", "4", "대학원"]);

// 프로필 수정 시 입력 데이터 검증
//   department(자유문자열)는 6-a 에서 제거됨 — users.departmentId 가 정식.
const profileInput = z.object({
  departmentId: z.number().int().positive().optional(),
  grade: gradeEnum.optional(),
  bio: z.string().max(200).optional(),
  keywords: z.array(z.string().max(30)).max(10).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")).or(z.null()),
});

// 게시글 생성 시 입력 데이터 검증
const formSchemaInput = z
  .array(
    z.object({
      id: z.string(),
      type: z.enum(["text", "select"]),
      question: z.string(),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
    })
  )
  .optional();

const postCreateInput = z.object({
  category: categoryEnum,
  title: z.string().min(2).max(200),
  content: z.string().min(1, "내용을 최소 1자 이상 입력해주세요."),
  capacity: z.number().int().min(1).max(999),
  deadline: z.string().optional(), // ISO 문자열 형태의 마감기한
  keywords: z.array(z.string().max(30)).max(10).optional(),
  meetingType: z.enum(["온라인", "오프라인", "온오프라인", "미정"]).optional(),
  imageUrl: z.string().optional(),
  hasInterview: z.number().int().min(0).max(1).optional().default(0),
  formSchema: formSchemaInput,
  groupId: z.number().optional(), // 연동할 그룹 ID
});

// 게시글 수정 시 입력 데이터 검증 (생성 스키마 재활용)
const postUpdateInput = postCreateInput.partial().extend({
  status: z.enum(["모집중", "마감"]).optional(),
});

// ─── 앱 라우터 (API 엔드포인트 정의) ────────────────────────────────────────────────

export const appRouter = router({
  // [인증 관련 API]
  auth: router({
    // 내 정보 조회
    me: publicProcedure.query(opts => opts.ctx.user),

    // 로그아웃 (쿠키 삭제)
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (ctx.user) {
        logAuditFromCtx(ctx, AuditAction.LOGOUT);
      }
      return { success: true } as const;
    }),

    // 회원 탈퇴 (본인 계정 삭제)
    withdraw: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteUser(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // 학교 이메일 인증코드 발송
    sendEmailVerification: protectedProcedure
      .input(z.object({ email: z.string().trim() }))
      .mutation(async ({ ctx, input }) => {
        const cleanEmail = emailVerificationService.sanitizeAndVerifyDomain(input.email);
        if (!cleanEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "올바른 한국외대 이메일 주소(@hufs.ac.kr)를 입력해주세요.",
          });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "데이터베이스 서버에 연결할 수 없습니다.",
          });
        }

        // 1인 1계정 중복 검사
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.verifiedEmail, cleanEmail),
              eq(users.status, "verified")
            )
          )
          .limit(1);

        if (existing.length > 0 && existing[0].id !== ctx.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "이미 다른 계정에서 인증 완료된 이메일입니다.",
          });
        }

        // OTP 생성 및 발송
        const otp = emailVerificationService.generateSecureOtp();
        const encryptedOtp = emailVerificationService.encryptOtp(otp);

        await db.insert(emailVerifications).values({
          userId: ctx.user.id,
          email: cleanEmail,
          codeHash: encryptedOtp,
          expiresAt: new Date(Date.now() + 5 * 60_000), // 5분 유효
        });

        const sent = await emailVerificationService.dispatchOtp(cleanEmail, otp);
        if (!sent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "인증 이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          });
        }

        return { success: true };
      }),

    // 학교 이메일 인증코드 검증
    verifyEmailCode: protectedProcedure
      .input(z.object({ email: z.string().trim(), code: z.string().length(6) }))
      .mutation(async ({ ctx, input }) => {
        const cleanEmail = emailVerificationService.sanitizeAndVerifyDomain(input.email);
        if (!cleanEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "올바른 한국외대 이메일 주소(@hufs.ac.kr)입니다.",
          });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "데이터베이스 서버에 연결할 수 없습니다.",
          });
        }

        const now = new Date();
        const verifications = await db
          .select()
          .from(emailVerifications)
          .where(
            and(
              eq(emailVerifications.userId, ctx.user.id),
              eq(emailVerifications.email, cleanEmail),
              isNull(emailVerifications.consumedAt),
              gte(emailVerifications.expiresAt, now)
            )
          )
          .orderBy(desc(emailVerifications.createdAt))
          .limit(1);

        if (verifications.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "유효한 이메일 인증 요청이 존재하지 않거나 시간(5분)이 초과되었습니다.",
          });
        }

        const verification = verifications[0];

        // 시도 횟수 제한 (최대 10회)
        if (verification.attempts >= 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "인증 시도 횟수(10회)를 초과했습니다. 인증 코드를 다시 발송해주세요.",
          });
        }

        // 시도 횟수 증가
        await db
          .update(emailVerifications)
          .set({ attempts: verification.attempts + 1 })
          .where(eq(emailVerifications.id, verification.id));

        // OTP 일치 대조
        const isMatch = emailVerificationService.verifyOtpToken(input.code, verification.codeHash);
        if (!isMatch) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "인증 보안 코드가 일치하지 않습니다. 다시 입력해주세요.",
          });
        }

        // 인증 성공 마킹
        await db
          .update(emailVerifications)
          .set({ verifiedAt: new Date() })
          .where(eq(emailVerifications.id, verification.id));

        return { success: true };
      }),

    // 테스트 및 복구용: 로그인된 본인 계정을 가입 대기(pending) 상태로 강제 초기화
    resetSelfToPending: protectedProcedure.mutation(async ({ ctx }) => {
      const dbInstance = await getDb();
      if (!dbInstance) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "데이터베이스 서버에 연결할 수 없습니다.",
        });
      }

      await dbInstance
        .update(users)
        .set({
          status: "pending",
          realName: null,
          studentId: null,
          admissionYear: null,
          verifiedEmail: null,
        })
        .where(eq(users.id, ctx.user.id));

      await dbInstance
        .delete(emailVerifications)
        .where(eq(emailVerifications.userId, ctx.user.id));

      return { success: true };
    }),

    // ───────────────────────────────────────────────────────────────────────
    // 회원가입 완료 — 실명/학번/학과/입학년도로 PENDING → VERIFIED 전환
    // ───────────────────────────────────────────────────────────────────────
    completeRegistration: protectedProcedure
      .input(
        z.object({
          realName: z.string().trim().min(1, "실명을 입력해주세요.").max(50),
          studentId: z
            .string()
            .regex(/^\d{9,10}$/, "학번은 9~10자리 숫자입니다."),
          admissionYear: z
            .number()
            .int()
            .min(1990)
            .max(new Date().getFullYear() + 1),
          departmentId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 0) 이미 정회원이면 거부
        if (ctx.user.status === "verified") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 가입이 완료된 계정입니다.",
          });
        }

        // 1) 학과 FK 사전 검증 (DB 무결성 에러를 친절한 메시지로 변환)
        const dept = await getDepartmentById(input.departmentId);
        if (!dept) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "존재하지 않는 학과입니다.",
          });
        }

        // 2) 트랜잭션 — 모든 mutation 을 하나로 묶기
        try {
          const result = await completeRegistrationSimplified({
            userId: ctx.user.id,
            realName: input.realName.trim(),
            studentId: input.studentId,
            admissionYear: input.admissionYear,
            departmentId: input.departmentId,
          });
          logAuditFromCtx(ctx, AuditAction.REGISTER_COMPLETE, {
            departmentId: input.departmentId,
          });
          return { success: true as const, user: result.user };
        } catch (e) {
          const msg = (e as Error).message;
          logAuditFromCtx(ctx, AuditAction.REGISTER_FAILED, {
            reason: msg,
          });
          switch (msg) {
            case "STUDENT_ID_TAKEN":
              throw new TRPCError({
                code: "CONFLICT",
                message: "이미 등록된 학번입니다.",
              });
            case "USER_NOT_FOUND":
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "사용자를 찾을 수 없습니다.",
              });
            case "DB_UNAVAILABLE":
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "데이터베이스에 연결할 수 없습니다.",
              });
            default:
              if (msg.includes("users_studentId_unique")) {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: "이미 등록된 학번입니다.",
                });
              }
              console.error("[completeRegistration] 예상치 못한 에러:", e);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "회원가입 처리 중 오류가 발생했습니다.",
              });
          }
        }
      }),
  }),

  // [학과 데이터 API]
  department: router({
    // 학과 목록 조회 — 회원가입 폼/프로필 폼에서 사용 (비로그인도 접근 가능)
    list: publicProcedure.query(async () => {
      return listDepartments();
    }),
  }),

  // [댓글 관련 API]
  comment: router({
    // 특정 게시글의 댓글 목록 조회
    list: publicProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getCommentsByPost(input.postId, ctx.user?.id);
      }),

    // 댓글 작성 — 정회원만
    create: protectedVerifiedProcedure
      .input(
        z.object({
          postId: z.number(),
          content: z.string().min(1).max(500),
          parentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const commentResult = await createComment({
          postId: input.postId,
          authorId: ctx.user.id,
          content: input.content,
          parentId: input.parentId ?? null,
        });

        // 비동기 알림 생성 (실패해도 댓글 생성은 정상 진행되도록 예외 처리)
        try {
          const post = await getPostById(input.postId);
          if (post) {
            const postAuthorId = post.post.authorId;
            const link = `/post/${input.postId}`;
            const commenterName = ctx.user.realName || ctx.user.name || "누군가";

            // 1. 게시글 작성자에게 알림 (작성자가 본인이 아닐 때만)
            if (postAuthorId !== ctx.user.id) {
              await createNotification({
                userId: postAuthorId,
                type: "comment",
                title: "새 댓글이 등록되었습니다.",
                content: `${commenterName}님이 회원님의 글 '${post.post.title}'에 댓글을 남겼습니다: "${input.content.substring(0, 30)}"`,
                link,
              });
            }

            // 2. 대댓글인 경우 부모 댓글 작성자에게 알림
            if (input.parentId) {
              const db = await getDb();
              if (db) {
                const { comments } = await import("../drizzle/schema");
                const parentRows = await db.select().from(comments).where(eq(comments.id, input.parentId)).limit(1);
                if (parentRows[0]) {
                  const parentAuthorId = parentRows[0].authorId;
                  if (parentAuthorId !== ctx.user.id && parentAuthorId !== postAuthorId) {
                    await createNotification({
                      userId: parentAuthorId,
                      type: "comment",
                      title: "새 답글이 등록되었습니다.",
                      content: `${commenterName}님이 회원님의 댓글에 답글을 남겼습니다: "${input.content.substring(0, 30)}"`,
                      link,
                    });
                  }
                }
              }
            }
          }
        } catch (notifErr) {
          console.error("[CommentNotifError] 알림 생성 실패:", notifErr);
        }

        return commentResult;
      }),

    // 댓글 삭제 — 정회원만
    delete: protectedVerifiedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteComment(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // [프로필 관련 API]
  profile: router({
    // 내 프로필 조회
    get: protectedProcedure.query(async ({ ctx }) => {
      return getProfileByUserId(ctx.user.id);
    }),

    // 타인 프로필 조회
    getByUserId: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getProfileByUserId(input.userId);
      }),

    // 프로필 생성 또는 수정 — 가입 대기자(pending) 및 정회원 모두
    upsert: protectedProcedure
      .input(profileInput)
      .mutation(async ({ ctx, input }) => {
        // departmentId 변경 시 학과 존재 확인 (FK 위반 친절하게 변환)
        if (input.departmentId !== undefined) {
          const dept = await getDepartmentById(input.departmentId);
          if (!dept) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "존재하지 않는 학과입니다.",
            });
          }
        }
        return upsertProfile({
          userId: ctx.user.id,
          department: null, // @deprecated — users.departmentId 사용
          grade: input.grade ?? null,
          bio: input.bio ?? null,
          keywords: input.keywords ? JSON.stringify(input.keywords) : null,
          avatarUrl: input.avatarUrl,
          departmentId: input.departmentId,
        });
      }),
  }),

  // [게시글 관련 API]
  post: router({
    // 게시글 목록 조회 (필터링, 검색 포함)
    list: publicProcedure
      .input(
        z.object({
          category: categoryFilterEnum.optional(),
          keyword: z.string().optional(),
          search: z.string().optional(),
          status: z.enum(["모집중", "마감"]).optional(),
          sort: z.enum(["latest", "deadline"]).optional(),
          limit: z.number().int().min(1).max(50).optional(),
          offset: z.number().int().min(0).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          department: z.string().optional(),
          sortBy: z.enum(["views", "recommended"]).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return listPosts({ ...input, userId: ctx.user?.id });
      }),

    // 특정 게시글 상세 조회
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const result = await getPostById(input.id, ctx.user?.id);
        if (!result)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "게시글을 찾을 수 없습니다.",
          });
        return result;
      }),

    // 조회수 증가 (상세 페이지 진입 시에만 별도 호출)
    incrementView: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await incrementViewCount(input.id);
        return { success: true };
      }),

    // 게시글 작성 — 정회원만
    create: protectedVerifiedProcedure
      .input(postCreateInput)
      .mutation(async ({ ctx, input }) => {
        return createPost({
          authorId: ctx.user.id,
          category: input.category,
          title: input.title,
          content: input.content,
          capacity: input.capacity,
          deadline: input.deadline ? new Date(input.deadline) : null,
          keywords: input.keywords ? JSON.stringify(input.keywords) : null,
          meetingType: input.meetingType,
          imageUrl: input.imageUrl,
          hasInterview: input.hasInterview,
          formSchema: input.formSchema,
          groupId: input.groupId,
        });
      }),

    // 게시글 수정 (작성자 또는 관리자만 가능) — 정회원 전제
    update: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), data: postUpdateInput }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getPostById(input.id);
        if (!existing)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "게시글을 찾을 수 없습니다.",
          });
        if (
          existing.post.authorId !== ctx.user.id &&
          ctx.user.role !== "admin"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "수정 권한이 없습니다.",
          });
        }
        const updated = await updatePost(input.id, {
          ...input.data,
          deadline: input.data.deadline
            ? new Date(input.data.deadline)
            : undefined,
          keywords: input.data.keywords
            ? JSON.stringify(input.data.keywords)
            : undefined,
          imageUrl: input.data.imageUrl,
          hasInterview: input.data.hasInterview,
          formSchema: input.data.formSchema,
          groupId: input.data.groupId,
        });

        return updated;
      }),

    // 게시글 삭제 (작성자 또는 관리자만 가능) — 정회원 전제
    delete: protectedVerifiedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getPostById(input.id);
        if (!existing)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "게시글을 찾을 수 없습니다.",
          });
        if (
          existing.post.authorId !== ctx.user.id &&
          ctx.user.role !== "admin"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "삭제 권한이 없습니다.",
          });
        }
        await deletePost(input.id);
        return { success: true };
      }),

    // 내가 쓴 글 조회
    myPosts: protectedProcedure.query(async ({ ctx }) => {
      return getPostsByAuthor(ctx.user.id);
    }),

    // 개인화된 추천 — 정회원만 (키워드 매칭은 프로필 완성 후 의미)
    recommended: protectedVerifiedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }))
      .query(async ({ ctx, input }) => {
        return getRecommendedPosts(ctx.user.id, input.limit ?? 6);
      }),

    // 좋아요 토글 — 정회원만
    toggleLike: protectedVerifiedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return toggleLike(ctx.user.id, input.postId);
      }),

    // 북마크 토글 — 정회원만
    toggleBookmark: protectedVerifiedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return toggleBookmark(ctx.user.id, input.postId);
      }),

    // 내가 북마크한 글 목록 조회
    myBookmarks: protectedProcedure.query(async ({ ctx }) => {
      return getBookmarkedPosts(ctx.user.id);
    }),

    // 특정 작성자의 글 목록 조회
    getByAuthorId: publicProcedure
      .input(z.object({ authorId: z.number() }))
      .query(async ({ input }) => {
        return getPostsByAuthor(input.authorId);
      }),

    // 전체 고유 키워드 조회 (자동완성용)
    getAllKeywords: publicProcedure
      .input(z.object({ query: z.string().optional() }))
      .query(async ({ input }) => {
        const { getAllKeywords } = await import("./db");
        return getAllKeywords(input.query);
      }),
  }),

  // [신청 관련 API]
  application: router({
    // 모집 신청서 제출 — 정회원만
    submit: protectedVerifiedProcedure
      .input(
        z.object({
          postId: z.number(),
          introduction: z.string().max(300).optional(),
          answers: z.any().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await getPostById(input.postId);
        if (!post)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "게시글을 찾을 수 없습니다.",
          });
        if (post.post.status === "마감") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "마감된 모집입니다.",
          });
        }
        // 본인 글에는 신청 불가
        if (post.post.authorId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "본인이 작성한 모집 글에는 신청할 수 없습니다.",
          });
        }
        // 중복 신청 확인
        const existing = await getApplicationByPostAndUser(
          input.postId,
          ctx.user.id
        );
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "이미 신청한 모집 글입니다.",
          });
        }
        return createApplication({
          postId: input.postId,
          applicantId: ctx.user.id,
          introduction: input.introduction ?? null,
          answers: input.answers,
        });
      }),



    // 특정 글에 대한 나의 신청 여부 확인
    checkMyApplication: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getApplicationByPostAndUser(input.postId, ctx.user.id);
      }),

    // 특정 게시물의 신청자 목록 조회 (작성자 전용) — 정회원 전제
    listByPost: protectedVerifiedProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ ctx, input }) => {
        const post = await getPostById(input.postId);
        if (!post)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "게시글을 찾을 수 없습니다.",
          });
        if (post.post.authorId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "조회 권한이 없습니다.",
          });
        }
        return getApplicationsByPost(input.postId);
      }),

    // 내가 신청한 내역 전체 조회
    listByUser: protectedProcedure.query(async ({ ctx }) => {
      return getApplicationsByUser(ctx.user.id);
    }),



    // 신청 상태 업데이트 (수락/거절/1차합격) — 정회원 전제
    updateStatus: protectedVerifiedProcedure
      .input(
        z.object({
          applicationId: z.number(),
          status: z.enum(["1차합격", "수락", "거절"]),
          rejectReason: z.string().optional(),
          interviewDetails: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 동적 임포트를 통한 의존성 로드
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { applications } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const rows = await db
          .select()
          .from(applications)
          .where(eq(applications.id, input.applicationId))
          .limit(1);
        if (!rows[0])
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "신청을 찾을 수 없습니다.",
          });

        const app = rows[0];
        const post = await getPostById(app.postId);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });

        // 작성자 본인인지 확인
        if (post.post.authorId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "처리 권한이 없습니다.",
          });
        }

        const result = await updateApplicationStatus(
          input.applicationId,
          input.status,
          input.rejectReason,
          input.interviewDetails
        );

        // 최종 수락(합격)인 경우 자동으로 그룹 멤버로 등록하여 집단 활동을 활성화함.
        if (input.status === "수락" && post.post.groupId) {
          try {
            await autoJoinGroupMember(app.applicantId, post.post.groupId);
          } catch (err) {
            console.error(
              "[application.updateStatus] 그룹 자동 멤버 가입 실패:",
              err
            );
          }
        }

        // 비동기 알림 전송
        try {
          const statusMessages = {
            "1차합격": `축하합니다! 모집글 '${post.post.title}'의 1차 서류에 합격하셨습니다. 면접 일정을 확인해 주세요.`,
            수락: `축하합니다! 모집글 '${post.post.title}'에 최종 합격하셨습니다.`,
            거절: `아쉽게도 모집글 '${post.post.title}'에 미선발되셨습니다. 다음 기회에 함께할 수 있기를 바랍니다.`,
          };

          const link = "/mypage";
          await createNotification({
            userId: app.applicantId,
            type: "application_status",
            title: `신청서 결과 안내 [${input.status}]`,
            content: statusMessages[input.status],
            link,
          });
        } catch (notifErr) {
          console.error("[ApplicationNotifError] 알림 생성 실패:", notifErr);
        }

        return result;
      }),


  }),

  // [캘린더 관련 API]
  calendar: router({
    // 일정 목록 조회 (학사일정 + 공휴일 + 내 개인일정 + 북마크/신청 글 마감일)
    list: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id ?? null;

      // 1. DB에서 학사일정 + 공휴일 + 개인 일정 조회
      const events = await listCalendarEvents(userId);

      const unifiedEvents: any[] = events.map(e => ({
        id: `db-${e.id}`,
        dbId: e.id,
        groupId: e.groupId ?? undefined,
        title: e.title,
        description: e.description,
        startDate: e.startDate,
        endDate: e.endDate,
        category: e.category,
        isPrivate: e.isPrivate,
        hasRsvp: e.hasRsvp,
      }));

      // 2. 로그인된 경우 북마크 및 신청한 모집글 마감일 자동 연동
      if (userId !== null) {
        // 북마크 모집글
        const bookmarksList = await getBookmarkedPosts(userId);
        bookmarksList.forEach(b => {
          if (b.post.deadline) {
            unifiedEvents.push({
              id: `bookmark-${b.post.id}`,
              title: `[마감] ${b.post.title}`,
              description: `${b.post.category} 모집 마감일`,
              startDate: new Date(b.post.deadline),
              endDate: new Date(b.post.deadline),
              category: "recruitment", // "recruitment" 카테고리를 활용하여 핑크색으로 매핑
              postId: b.post.id,
            });
          }
        });

        // 신청한 모집글
        const appsList = await getApplicationsByUser(userId);
        appsList.forEach(a => {
          if (a.post && a.post.deadline) {
            // 중복 회피 (북마크도 하고 신청도 한 경우 하나만 노출)
            const exists = unifiedEvents.some(
              e =>
                e.id === `bookmark-${a.post!.id}` ||
                e.id === `app-${a.post!.id}`
            );
            if (!exists) {
              unifiedEvents.push({
                id: `app-${a.post.id}`,
                title: `[신청 마감] ${a.post.title}`,
                description: `${a.post.category} 지원 완료 글의 마감일`,
                startDate: new Date(a.post.deadline),
                endDate: new Date(a.post.deadline),
                category: "recruitment", // 동일하게 핑크색으로 매핑
                postId: a.post.id,
              });
            }
          }
        });

        // 3. 내가 참여하고 있거나 리더인 그룹의 모든 일정 자동 연동
        try {
          const groupEvents = await listUserGroupCalendarEvents(userId);
          groupEvents.forEach(ge => {
            unifiedEvents.push({
              id: `group-${ge.event.id}`,
              dbId: ge.event.id,
              groupId: ge.event.groupId,
              title: `[${ge.groupName}] ${ge.event.title}`,
              description: ge.event.description,
              startDate: ge.event.startDate,
              endDate: ge.event.endDate,
              category: ge.event.category, // "group" 카테고리 또는 개별 카테고리 사용 가능
              isPrivate: ge.event.isPrivate,
              hasRsvp: ge.event.hasRsvp,
            });
          });
        } catch (err) {
          console.error("[calendar.list] 그룹 일정 로드 실패:", err);
        }
      }

      return unifiedEvents;
    }),

    // 개인 일정 생성
    create: protectedVerifiedProcedure
      .input(
        z.object({
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          description: z.string().max(1000).optional(),
          startDate: z.string(), // ISO date
          endDate: z.string(), // ISO date
        })
      )
      .mutation(async ({ ctx, input }) => {
        return createCalendarEvent({
          userId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          category: "personal",
          groupId: null,
        });
      }),

    // 개인 일정 수정
    update: protectedVerifiedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          description: z.string().max(1000).optional(),
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return updateCalendarEvent(input.id, ctx.user.id, {
          title: input.title,
          description: input.description ?? null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        });
      }),

    // 개인 일정 삭제
    delete: protectedVerifiedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteCalendarEvent(input.id, ctx.user.id);
      }),

    // 카테고리별 테마 변경
    updateTheme: protectedVerifiedProcedure
      .input(
        z.object({
          category: z.string(),
          color: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { updateUserCalendarTheme } = await import("./db");
        return updateUserCalendarTheme(ctx.user.id, input.category, input.color);
      }),

    // 테마 조회
    getThemes: protectedVerifiedProcedure.query(async ({ ctx }) => {
      const { getUserCalendarThemes } = await import("./db");
      return getUserCalendarThemes(ctx.user.id);
    }),

    // 투두 목록 조회
    listTodos: protectedVerifiedProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ ctx, input }) => {
        const { listCalendarTodos } = await import("./db");
        return listCalendarTodos(ctx.user.id, input.date);
      }),

    // 투두 생성
    createTodo: protectedVerifiedProcedure
      .input(
        z.object({
          date: z.string(),
          content: z.string().min(1, "내용을 입력해주세요.").max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { createCalendarTodo } = await import("./db");
        return createCalendarTodo(ctx.user.id, input.date, input.content);
      }),

    // 투두 상태 토글
    toggleTodo: protectedVerifiedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { toggleCalendarTodo } = await import("./db");
        return toggleCalendarTodo(input.id, ctx.user.id);
      }),

    // 투두 삭제
    deleteTodo: protectedVerifiedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteCalendarTodo } = await import("./db");
        return deleteCalendarTodo(input.id, ctx.user.id);
      }),
  }),

  // [차단 관련 API]
  block: router({
    list: protectedVerifiedProcedure.query(async ({ ctx }) => {
      const { listBlockedUsers } = await import("./db");
      return listBlockedUsers(ctx.user.id);
    }),
    block: protectedVerifiedProcedure
      .input(z.object({ blockedId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.blockedId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "자기 자신을 차단할 수 없습니다.",
          });
        }
        const { createBlock } = await import("./db");
        return createBlock(ctx.user.id, input.blockedId);
      }),
    unblock: protectedVerifiedProcedure
      .input(z.object({ blockedId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteBlock } = await import("./db");
        await deleteBlock(ctx.user.id, input.blockedId);
        return { success: true };
      }),
    check: protectedVerifiedProcedure
      .input(z.object({ blockedId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getBlockedUserIds } = await import("./db");
        const blockedIds = await getBlockedUserIds(ctx.user.id);
        return blockedIds.includes(input.blockedId);
      }),
  }),

  // [관리자 전용 API] — adminProcedure 가 role/disabled 를 일괄 검사
  admin: router({
    // 전체 사용자 목록 조회
    listUsers: adminProcedure.query(async () => {
      return getAllUsers();
    }),

    // 사용자 계정 삭제
    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "본인은 삭제할 수 없습니다.",
          });
        }
        await deleteUser(input.userId);
        logAuditFromCtx(ctx, AuditAction.ADMIN_DELETE_USER, {
          targetUserId: input.userId,
        });
        return { success: true };
      }),

    // 신고 내역 목록 조회
    listReports: adminProcedure.query(async () => {
      return listReports();
    }),

    // 신고 상태 업데이트
    updateReportStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "resolved", "dismissed"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateReportStatus(input.id, input.status);
        return { success: true };
      }),

    // 유저 상태(정지 등) 업데이트
    updateUserStatus: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          status: z.enum(["pending", "verified", "disabled"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateUserStatus(input.userId, input.status);
        return { success: true };
      }),
  }),

  // [신고 관련 API]
  report: router({
    create: protectedVerifiedProcedure
      .input(
        z.object({
          targetType: z.enum(["post", "user", "comment", "message"]),
          targetId: z.number(),
          reason: z.string().min(1).max(500),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 본인 신고 방지
        if (input.targetType === "user" && input.targetId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "본인을 신고할 수 없습니다.",
          });
        }
        return createReport({
          reporterId: ctx.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
        });
      }),
  }),

  // [메시지 관련 API] — 모두 정회원만
  message: router({
    send: protectedVerifiedProcedure
      .input(
        z.object({
          receiverId: z.number(),
          postId: z.number().optional(),
          content: z.string().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.receiverId === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "본인에게는 메시지를 보낼 수 없습니다.",
          });
        }
        const { getBlockRelationUserIds } = await import("./db");
        const blockRelationIds = await getBlockRelationUserIds(ctx.user.id);
        if (blockRelationIds.includes(input.receiverId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "차단 관계로 인해 메시지를 보낼 수 없습니다.",
          });
        }
        const msgResult = await sendMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          postId: input.postId ?? null,
          content: input.content,
        });

        try {
          const senderName = ctx.user.realName || ctx.user.name || "누군가";
          await createNotification({
            userId: input.receiverId,
            type: "message",
            title: "새로운 쪽지가 도착했습니다.",
            content: `${senderName}님으로부터 쪽지가 왔습니다: "${input.content.substring(0, 30)}"`,
            link: "/messages",
          });
        } catch (notifErr) {
          console.error("[MessageNotifError] 알림 생성 실패:", notifErr);
        }

        return msgResult;
      }),

    list: protectedVerifiedProcedure
      .input(z.object({ otherUserId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getBlockRelationUserIds } = await import("./db");
        const blockRelationIds = await getBlockRelationUserIds(ctx.user.id);
        if (blockRelationIds.includes(input.otherUserId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "차단된 상대방과는 메시지를 주고받을 수 없습니다.",
          });
        }
        await markMessagesAsRead(ctx.user.id, input.otherUserId);
        return getMessages(ctx.user.id, input.otherUserId);
      }),

    listConversations: protectedVerifiedProcedure.query(async ({ ctx }) => {
      return getConversations(ctx.user.id);
    }),

    markAsRead: protectedVerifiedProcedure
      .input(z.object({ otherUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markMessagesAsRead(ctx.user.id, input.otherUserId);
        return { success: true };
      }),

    totalUnreadCount: protectedVerifiedProcedure.query(async ({ ctx }) => {
      return getTotalUnreadCount(ctx.user.id);
    }),

    delete: protectedVerifiedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMessage(input.id, ctx.user.id);
        return { success: true };
      }),

    update: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), content: z.string().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        await updateMessage(input.id, ctx.user.id, input.content);
        return { success: true };
      }),
  }),

  // [파일 업로드] — 정회원만
  upload: router({
    image: protectedVerifiedProcedure
      .input(
        z.object({
          data: z.string(), // Base64 데이터
          name: z.string(),
          type: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Base64 데이터를 Buffer로 변환
        const base64Data = input.data.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // 스토리지에 저장 (경로 형식: uploads/userId/timestamp_filename)
        const path = `uploads/${ctx.user.id}/${Date.now()}_${input.name}`;
        const result = await storagePut(path, buffer, input.type);

        return { url: result.url };
      }),

    file: protectedVerifiedProcedure
      .input(
        z.object({
          data: z.string(), // Base64 데이터
          name: z.string(),
          type: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Base64 데이터를 Buffer로 변환 (모든 파일 형식 지원)
        const base64Data = input.data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const path = `uploads/${ctx.user.id}/${Date.now()}_${input.name}`;
        const result = await storagePut(path, buffer, input.type);

        return { url: result.url };
      }),
  }),

  // [그룹 관련 API]
  group: router({
    // 내가 리더인 그룹 조회
    myGroups: protectedVerifiedProcedure.query(async ({ ctx }) => {
      return getGroupsByLeader(ctx.user.id);
    }),

    // 고유 키로 그룹 참여하기
    join: protectedVerifiedProcedure
      .input(
        z.object({
          accessKey: z.string().trim().min(1, "고유 키를 입력해주세요."),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return joinGroupWithKey(ctx.user.id, input.accessKey);
      }),

    // 특정 그룹의 멤버 조회 (리더 또는 관리자 전용)
    listMembers: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });
        if (group.leaderId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 조회 가능합니다.",
          });
        }
        return getGroupMembers(input.groupId);
      }),

    // 특정 그룹의 일정 조회 (연동 게시글 조회용)
    listEvents: publicProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user) {
          const { checkGroupPermissions, getGroupEventsWithPrivate } =
            await import("./db");
          const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
          const canViewPrivate =
            perm.isLeader ||
            perm.canViewPrivateEvent ||
            ctx.user.role === "admin";
          if (canViewPrivate) {
            return getGroupEventsWithPrivate(input.groupId);
          }
        }
        return getGroupEvents(input.groupId);
      }),

    // 모든 그룹 조회 (관리자 전용)
    listAll: adminProcedure.query(async () => {
      return getAllGroups();
    }),

    // 그룹 삭제 및 키 회수 (관리자 전용)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteGroup(input.id);
      }),

    // 그룹 생성 (관리자 전용)
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1, "그룹명을 입력해주세요.").max(100),
          leaderId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        // 영문 대문자 + 숫자로 구성된 XXXX-XXXX-XXXX 형식의 고유 키 생성
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const rand4 = () => {
          let s = "";
          for (let i = 0; i < 4; i++) {
            s += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return s;
        };
        const accessKey = `${rand4()}-${rand4()}-${rand4()}`;
        return createGroup({
          name: input.name,
          leaderId: input.leaderId,
          accessKey,
        });
      }),

    // 그룹 일정 생성 (리더 또는 스케줄 권한자 전용)
    createEvent: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          description: z.string().max(1000).optional(),
          startDate: z.string(),
          endDate: z.string(),
          isPrivate: z.number().default(0),
          hasRsvp: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });

        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const canManage =
          perm.isLeader || perm.canManageSchedule || ctx.user.role === "admin";
        if (!canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "그룹 리더 또는 일정 관리 권한자만 일정을 생성할 수 있습니다.",
          });
        }

        const eventResult = await createGroupCalendarEvent({
          userId: null,
          groupId: input.groupId,
          title: input.title,
          description: input.description ?? null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          category: "group",
          isPrivate: input.isPrivate,
          hasRsvp: input.hasRsvp,
        });

        try {
          const members = await getGroupMembers(input.groupId);
          const groupDetail = await getGroupById(input.groupId);
          const groupName = groupDetail?.name || "소속 그룹";
          const link = "/groups";

          for (const member of members) {
            if (member.userId === ctx.user.id) continue;

            if (input.isPrivate === 1) {
              const perm = await checkGroupPermissions(member.userId, input.groupId);
              if (!perm.isLeader && !perm.canViewPrivateEvent) {
                continue;
              }
            }

            await createNotification({
              userId: member.userId,
              type: "group_event",
              title: `'${groupName}' 새로운 일정 등록`,
              content: `새로운 일정 '${input.title}'이 등록되었습니다.`,
              link,
            });
          }
        } catch (notifErr) {
          console.error("[GroupEventNotifError] 알림 생성 실패:", notifErr);
        }

        return eventResult;
      }),

    // 그룹 일정 수정 (리더 또는 스케줄 권한자 전용)
    updateEvent: protectedVerifiedProcedure
      .input(
        z.object({
          id: z.number(),
          groupId: z.number(),
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          description: z.string().max(1000).optional(),
          startDate: z.string(),
          endDate: z.string(),
          isPrivate: z.number().default(0),
          hasRsvp: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });

        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const canManage =
          perm.isLeader || perm.canManageSchedule || ctx.user.role === "admin";
        if (!canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "그룹 리더 또는 일정 관리 권한자만 일정을 수정할 수 있습니다.",
          });
        }

        return updateGroupCalendarEvent(input.id, input.groupId, {
          title: input.title,
          description: input.description ?? null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          isPrivate: input.isPrivate,
          hasRsvp: input.hasRsvp,
        });
      }),

    // 그룹 일정 삭제 (리더 또는 스케줄 권한자 전용)
    deleteEvent: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });

        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const canManage =
          perm.isLeader || perm.canManageSchedule || ctx.user.role === "admin";
        if (!canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "그룹 리더 또는 일정 관리 권한자만 일정을 삭제할 수 있습니다.",
          });
        }
        return deleteGroupCalendarEvent(input.id, input.groupId);
      }),

    // 그룹 일정 RSVP 제출
    submitRsvp: protectedVerifiedProcedure
      .input(
        z.object({
          eventId: z.number(),
          status: z.enum(["attending", "absent", "maybe"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { submitEventRsvp } = await import("./db");
        return submitEventRsvp(ctx.user.id, input.eventId, input.status);
      }),

    // 그룹 일정 RSVP 현황 조회
    getEventRsvps: protectedVerifiedProcedure
      .input(z.object({ eventId: z.number() }))
      .query(async ({ input }) => {
        const { getEventRsvps } = await import("./db");
        return getEventRsvps(input.eventId);
      }),

    // 내가 가입해 있거나 리더인 모든 그룹 조회 (멤버 수, 지위 명칭 포함)
    myJoinedGroups: protectedVerifiedProcedure.query(async ({ ctx }) => {
      return getUserJoinedAndLedGroups(ctx.user.id);
    }),

    // 특정 그룹에서 멤버 연동 해제 (리더 전용)
    removeMember: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number(), userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });
        if (group.leaderId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 멤버 일정을 강제 연동 해제할 수 있습니다.",
          });
        }
        await removeGroupMember(input.groupId, input.userId);
        return { success: true };
      }),

    // 특정 그룹의 지위(역할) 목록 조회
    listRoles: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 멤버만 지위 목록을 조회할 수 있습니다.",
          });
        }
        return getGroupRoles(input.groupId);
      }),

    // 특정 그룹에 신규 지위(역할) 생성 (리더 전용)
    createRole: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          name: z.string().min(1, "지위 이름을 입력해주세요.").max(50),
          canManageSchedule: z.number().default(0),
          canManageNotice: z.number().default(0),
          canViewPrivateEvent: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });
        if (group.leaderId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 새로운 지위를 생성할 수 있습니다.",
          });
        }
        return createGroupRole(input);
      }),

    // 특정 그룹의 지위 권한 정보 수정 (리더 전용)
    updateRole: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          roleId: z.number(),
          data: z.object({
            name: z.string().min(1).max(50).optional(),
            canManageSchedule: z.number().optional(),
            canManageNotice: z.number().optional(),
            canViewPrivateEvent: z.number().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });
        if (group.leaderId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 지위를 수정할 수 있습니다.",
          });
        }
        return updateGroupRole(input.roleId, input.data);
      }),

    // 특정 그룹의 지위 제거 (리더 전용)
    deleteRole: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number(), roleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });
        if (group.leaderId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 지위를 삭제할 수 있습니다.",
          });
        }
        await deleteGroupRole(input.roleId);
        return { success: true };
      }),

    // 멤버에게 특정 지위(역할) 부여 (리더 전용)
    assignRole: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          userId: z.number(),
          roleId: z.number().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });
        if (group.leaderId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 지위를 부여할 수 있습니다.",
          });
        }
        await assignMemberRole(input.groupId, input.userId, input.roleId);
        return { success: true };
      }),

    // 현재 사용자의 특정 그룹 권한 정보 확인
    checkPermissions: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        return checkGroupPermissions(ctx.user.id, input.groupId);
      }),

    // 그룹 내 공지사항 목록 조회
    listAnnouncements: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 소속 인원만 공지사항을 열람할 수 있습니다.",
          });
        }
        return getGroupAnnouncements(input.groupId);
      }),

    // 그룹 내 신규 공지사항 작성 (리더 또는 공지권한자 전용)
    createAnnouncement: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          content: z.string().min(1, "내용을 입력해주세요."),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });

        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const canNotice =
          perm.isLeader || perm.canManageNotice || ctx.user.role === "admin";
        if (!canNotice) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "공지사항 작성 권한이 없습니다.",
          });
        }

        const announceResult = await createGroupAnnouncement({
          groupId: input.groupId,
          authorId: ctx.user.id,
          title: input.title,
          content: input.content,
        });

        try {
          const members = await getGroupMembers(input.groupId);
          const link = "/groups";

          for (const member of members) {
            if (member.userId === ctx.user.id) continue;

            await createNotification({
              userId: member.userId,
              type: "group_notice",
              title: `'${group.name}' 새로운 공지사항 등록`,
              content: `새로운 공지 '${input.title}'가 등록되었습니다.`,
              link,
            });
          }
        } catch (notifErr) {
          console.error("[GroupNoticeNotifError] 알림 생성 실패:", notifErr);
        }

        return announceResult;
      }),

    // 공지사항 삭제 (리더 또는 공지권한자 전용)
    deleteAnnouncement: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number(), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const group = await getGroupById(input.groupId);
        if (!group)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "그룹을 찾을 수 없습니다.",
          });

        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const canNotice =
          perm.isLeader || perm.canManageNotice || ctx.user.role === "admin";
        if (!canNotice) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "공지사항 삭제 권한이 없습니다.",
          });
        }

        await deleteGroupAnnouncement(input.id);
        return { success: true };
      }),

    // 그룹 대화방 메시지 목록 조회
    listChatMessages: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          limit: z.number().int().min(1).max(200).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 소속 인원만 대화방에 참여할 수 있습니다.",
          });
        }
        return getGroupChatMessages(input.groupId, input.limit ?? 100);
      }),

    // 그룹 대화방 메시지 전송
    sendChatMessage: protectedVerifiedProcedure
      .input(
        z.object({ groupId: z.number(), content: z.string().min(1).max(2000) })
      )
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 소속 인원만 대화를 나눌 수 있습니다.",
          });
        }
        return createGroupChatMessage({
          groupId: input.groupId,
          senderId: ctx.user.id,
          content: input.content,
        });
      }),

    // 그룹 자료실 목록 조회
    listFiles: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 멤버만 자료실을 조회할 수 있습니다.",
          });
        }
        return getGroupFiles(input.groupId);
      }),

    // 그룹 자료실 파일 가상 업로드
    uploadFile: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          fileName: z.string().min(1).max(255),
          fileSize: z.number().int().positive(),
          fileType: z.string().max(100),
          fileUrl: z.string().url(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 멤버만 파일을 업로드할 수 있습니다.",
          });
        }
        return createGroupFile({
          groupId: input.groupId,
          uploaderId: ctx.user.id,
          fileName: input.fileName,
          fileSize: input.fileSize,
          fileType: input.fileType,
          fileUrl: input.fileUrl,
        });
      }),

    // 그룹 자료실 파일 삭제
    deleteFile: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { groupFiles } = await import("../drizzle/schema");
        const rows = await db.select().from(groupFiles).where(eq(groupFiles.id, input.id)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "파일을 찾을 수 없습니다." });
        
        const file = rows[0];
        const isUploader = file.uploaderId === ctx.user.id;
        const isLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isUploader && !isLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "파일을 삭제할 권한이 없습니다.",
          });
        }

        await deleteGroupFile(input.id);
        return { success: true };
      }),

    // 그룹 아카이브 처리
    archive: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          title: z.string().min(1).max(200),
          summary: z.string().min(1).max(500),
          content: z.string().min(1),
          period: z.string().min(1).max(100),
          imageUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await archiveGroup(input.groupId, ctx.user.id, {
            title: input.title,
            summary: input.summary,
            content: input.content,
            period: input.period,
            imageUrl: input.imageUrl,
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message || "아카이브 처리에 실패했습니다.",
          });
        }
      }),

    // 아카이브 리스트 조회
    listArchives: publicProcedure.query(async () => {
      return getGroupArchives();
    }),

    // 아카이브 상세 조회
    getArchive: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const archive = await getGroupArchiveDetail(input.id);
        if (!archive) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "아카이브 정보를 찾을 수 없습니다.",
          });
        }
        return archive;
      }),

    // 하위 스터디 생성
    createSubStudy: protectedVerifiedProcedure
      .input(
        z.object({
          groupId: z.number(),
          leaderId: z.number(),
          name: z.string().min(1, "스터디 이름을 입력해주세요.").max(100),
          description: z.string().max(500),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 하위 스터디를 생성할 수 있습니다.",
          });
        }

        const study = await createGroupStudy({
          groupId: input.groupId,
          leaderId: input.leaderId,
          name: input.name,
          description: input.description,
        });

        // 스터디장을 스터디 멤버에 자동 포함
        await setGroupStudyMembers(study.id, [input.leaderId]);

        // 알림 전송
        try {
          const group = await getGroupById(input.groupId);
          const groupName = group?.name || "소속 그룹";
          await createNotification({
            userId: input.leaderId,
            type: "group_event",
            title: `'${groupName}' 하위 스터디장 임명`,
            content: `'${input.name}' 스터디의 스터디장으로 지정되었습니다.`,
            link: "/groups",
          });
        } catch (notifErr) {
          console.error("[SubStudyNotifError] 알림 전송 실패:", notifErr);
        }

        return study;
      }),

    // 하위 스터디 삭제
    deleteSubStudy: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 리더만 하위 스터디를 삭제할 수 있습니다.",
          });
        }
        await deleteGroupStudy(input.id);
        return { success: true };
      }),

    // 하위 스터디 목록 조회
    listSubStudies: protectedVerifiedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 멤버만 소그룹 목록을 조회할 수 있습니다.",
          });
        }
        return getGroupStudies(input.groupId);
      }),

    // 하위 스터디 멤버 조회
    listSubStudyMembers: protectedVerifiedProcedure
      .input(z.object({ studyId: z.number(), groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        if (!perm.isLeader && !perm.roleName && ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "그룹 멤버만 스터디원 목록을 조회할 수 있습니다.",
          });
        }
        return getGroupStudyMembers(input.studyId);
      }),

    // 하위 스터디 멤버 수정
    updateSubStudyMembers: protectedVerifiedProcedure
      .input(
        z.object({
          studyId: z.number(),
          groupId: z.number(),
          userIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { groupStudies } = await import("../drizzle/schema");
        const rows = await db.select().from(groupStudies).where(eq(groupStudies.id, input.studyId)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "스터디를 찾을 수 없습니다." });

        const study = rows[0];
        const isStudyLeader = study.leaderId === ctx.user.id;
        const isParentLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isStudyLeader && !isParentLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "스터디장 또는 그룹 리더만 스터디원을 지정할 수 있습니다.",
          });
        }

        // 스터디장은 자동 포함되도록 구성
        const targetUserIds = Array.from(new Set([study.leaderId, ...input.userIds]));
        await setGroupStudyMembers(input.studyId, targetUserIds);
        return { success: true };
      }),

    // 회의록 목록 조회
    listSubStudyMinutes: protectedVerifiedProcedure
      .input(z.object({ studyId: z.number(), groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const studyMembers = await getGroupStudyMembers(input.studyId);
        const isMember = studyMembers.some((m) => m.userId === ctx.user.id);
        const isParentLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isMember && !isParentLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "해당 스터디의 구성원만 회의록 목록을 조회할 수 있습니다.",
          });
        }

        return getGroupStudyMinutes(input.studyId);
      }),

    // 회의록 상세 조회
    getSubStudyMinuteDetail: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), groupId: z.number(), studyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const studyMembers = await getGroupStudyMembers(input.studyId);
        const isMember = studyMembers.some((m) => m.userId === ctx.user.id);
        const isParentLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isMember && !isParentLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "해당 스터디의 구성원만 회의록 내용을 열람할 수 있습니다.",
          });
        }

        const minute = await getGroupStudyMinuteDetail(input.id);
        if (!minute) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "회의록을 찾을 수 없습니다.",
          });
        }
        return minute;
      }),

    // 회의록 작성
    createSubStudyMinute: protectedVerifiedProcedure
      .input(
        z.object({
          studyId: z.number(),
          groupId: z.number(),
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          content: z.string().min(1, "내용을 입력해주세요."),
          meetingDate: z.coerce.date(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const studyMembers = await getGroupStudyMembers(input.studyId);
        const isMember = studyMembers.some((m) => m.userId === ctx.user.id);
        const isParentLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isMember && !isParentLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "스터디 구성원만 회의록을 작성할 수 있습니다.",
          });
        }

        return createGroupStudyMinute({
          studyId: input.studyId,
          authorId: ctx.user.id,
          title: input.title,
          content: input.content,
          meetingDate: input.meetingDate,
        });
      }),

    // 회의록 수정
    updateSubStudyMinute: protectedVerifiedProcedure
      .input(
        z.object({
          id: z.number(),
          studyId: z.number(),
          groupId: z.number(),
          title: z.string().min(1, "제목을 입력해주세요.").max(200),
          content: z.string().min(1, "내용을 입력해주세요."),
          meetingDate: z.coerce.date(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { groupStudyMinutes, groupStudies } = await import("../drizzle/schema");
        
        const rows = await db.select().from(groupStudyMinutes).where(eq(groupStudyMinutes.id, input.id)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "회의록을 찾을 수 없습니다." });

        const minute = rows[0];
        const studyRows = await db.select().from(groupStudies).where(eq(groupStudies.id, input.studyId)).limit(1);
        const study = studyRows[0];

        const isAuthor = minute.authorId === ctx.user.id;
        const isStudyLeader = study && study.leaderId === ctx.user.id;
        const isParentLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isAuthor && !isStudyLeader && !isParentLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "작성자 또는 스터디장만 회의록을 수정할 수 있습니다.",
          });
        }

        return updateGroupStudyMinute(input.id, {
          title: input.title,
          content: input.content,
          meetingDate: input.meetingDate,
        });
      }),

    // 회의록 삭제
    deleteSubStudyMinute: protectedVerifiedProcedure
      .input(z.object({ id: z.number(), studyId: z.number(), groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const perm = await checkGroupPermissions(ctx.user.id, input.groupId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { groupStudyMinutes, groupStudies } = await import("../drizzle/schema");
        
        const rows = await db.select().from(groupStudyMinutes).where(eq(groupStudyMinutes.id, input.id)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "회의록을 찾을 수 없습니다." });

        const minute = rows[0];
        const studyRows = await db.select().from(groupStudies).where(eq(groupStudies.id, input.studyId)).limit(1);
        const study = studyRows[0];

        const isAuthor = minute.authorId === ctx.user.id;
        const isStudyLeader = study && study.leaderId === ctx.user.id;
        const isParentLeader = perm.isLeader || ctx.user.role === "admin";

        if (!isAuthor && !isStudyLeader && !isParentLeader) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "작성자 또는 스터디장만 회의록을 삭제할 수 있습니다.",
          });
        }

        await deleteGroupStudyMinute(input.id);
        return { success: true };
      }),
  }),

  // [알림 관련 API]
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserNotifications(ctx.user.id);
    }),
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return markNotificationAsRead(input.id, ctx.user.id);
      }),
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      return markAllNotificationsAsRead(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
