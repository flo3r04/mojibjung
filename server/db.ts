import {
  and,
  desc,
  eq,
  like,
  or,
  sql,
  inArray,
  gte,
  lt,
  isNotNull,
  notInArray,
  isNull,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  Application,
  InsertApplication,
  InsertPost,
  InsertProfile,
  InsertUser,
  User,
  Post,
  applications,
  posts,
  profiles,
  users,
  messages,
  Message,
  InsertMessage,
  comments,
  likes,
  bookmarks,
  Comment,
  InsertComment,
  departments,
  Department,
  auditLog,
  reports,
  Report,
  InsertReport,
  blocks,
  Block,
  InsertBlock,
  calendarEvents,
  CalendarEvent,
  InsertCalendarEvent,
  groups,
  Group,
  InsertGroup,
  groupMembers,
  GroupMember,
  InsertGroupMember,
  groupRoles,
  GroupRole,
  InsertGroupRole,
  groupAnnouncements,
  GroupAnnouncement,
  InsertGroupAnnouncement,
  groupChatMessages,
  GroupChatMessage,
  InsertGroupChatMessage,
  emailVerifications,
  EmailVerification,
  InsertEmailVerification,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// * 데이터베이스 연결 관리를 위한 변수
let _db: ReturnType<typeof drizzle> | null = null;

// * 데이터베이스 인스턴스를 가져오는 함수 (싱글톤 패턴)
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const queryClient = postgres(process.env.DATABASE_URL);
      _db = drizzle(queryClient);
    } catch (error) {
      console.warn("[Database] 연결 실패:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── 사용자(Users) 관련 함수 ───────────────────────────────────────────────────

// * 사용자 정보를 생성하거나 이미 있다면 업데이트(Upsert)하는 함수
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("사용자 openId가 필요합니다.");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] DB 사용 불가능");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "avatarUrl"] as const;
  type TextField = (typeof textFields)[number];

  // 변경된 필드만 추출하여 업데이트 세트 구성
  const assignNullable = (field: TextField) => {
    const value = (user as any)[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    (values as any)[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  // 관리자 여부 확인 (환경변수의 OWNER_OPEN_ID와 일치하면 admin 부여)
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  // openId가 충돌(중복)될 경우 정보를 업데이트
  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}

// * Kakao OpenID로 사용자 정보를 조회하는 함수
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// * 모든 사용자 목록을 최신순으로 가져오는 함수 (관리자용)
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// * 특정 ID의 사용자를 삭제하는 함수 (연관 데이터 포함)
export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  // 1. 프로필 삭제
  await db.delete(profiles).where(eq(profiles.userId, id));

  // 2. 게시글 삭제 (게시글에 달린 댓글, 좋아요 등은 별도 처리가 필요할 수 있으나,
  // 여기서는 사용자가 작성한 게시글만 삭제함. 게시글 삭제 시 게시글 ID를 참조하는 다른 테이블들도 정리)
  const userPosts = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.authorId, id));
  for (const post of userPosts) {
    await deletePost(post.id);
  }

  // 3. 사용자가 작성한 댓글 삭제
  await db.delete(comments).where(eq(comments.authorId, id));

  // 4. 좋아요 및 북마크 삭제
  await db.delete(likes).where(eq(likes.userId, id));
  await db.delete(bookmarks).where(eq(bookmarks.userId, id));

  // 5. 모집 신청 내역 삭제
  await db.delete(applications).where(eq(applications.applicantId, id));

  // 6. 주고받은 메시지 삭제
  await db
    .delete(messages)
    .where(or(eq(messages.senderId, id), eq(messages.receiverId, id)));

  // 7. 최종적으로 사용자 계정 삭제
  await db.delete(users).where(eq(users.id, id));
}

// ─── 프로필(Profiles) 관련 함수 ───────────────────────────────────────────────

// * 특정 사용자의 프로필 정보를 조회하는 함수 (유저 정보 포함)
export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      profile: profiles,
      name: users.name,
      avatarUrl: users.avatarUrl,
      email: users.email,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// * 프로필 정보를 생성하거나 업데이트하는 함수
/**
 * 프로필 upsert.
 *
 * 정책 (Step 6-a):
 *   - 학과 정보의 정식 소유자는 `users.departmentId` (departments FK).
 *   - `profiles.department` 자유문자열은 @deprecated — 더 이상 입력 받지 않으며
 *     호환을 위해 NULL 로 정리한다.
 *   - departmentId, avatarUrl 은 users 테이블로 이관되어 업데이트된다.
 */
export async function upsertProfile(
  data: InsertProfile & {
    avatarUrl?: string | null;
    departmentId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  const { avatarUrl, departmentId, ...profileData } = data;

  // 1. 프로필 정보 업데이트 — department 자유문자열은 항상 NULL 로 정리
  const profileValues = {
    ...profileData,
    department: null,
  };
  await db
    .insert(profiles)
    .values(profileValues)
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        department: null,
        grade: profileData.grade,
        bio: profileData.bio,
        keywords: profileData.keywords,
      },
    });

  // 2. users 테이블에 avatarUrl / departmentId 반영 (제공된 경우에만)
  const userUpdate: Partial<typeof users.$inferInsert> = {};
  if (avatarUrl !== undefined) userUpdate.avatarUrl = avatarUrl;
  if (departmentId !== undefined) userUpdate.departmentId = departmentId;
  if (Object.keys(userUpdate).length > 0) {
    await db.update(users).set(userUpdate).where(eq(users.id, data.userId));
  }

  return getProfileByUserId(data.userId);
}

// ─── 게시글(Posts) 관련 함수 ────────────────────────────────────────────────────

// * 게시글 목록을 조회하는 함수 (좋아요/댓글 수 포함)
// * 게시글 목록을 조회하는 함수 (좋아요/댓글 수 포함)
export async function listPosts(opts: {
  category?: "동아리" | "학회" | "스터디";
  keyword?: string;
  search?: string;
  status?: "모집중" | "마감";
  sort?: "latest" | "deadline";
  limit?: number;
  offset?: number;

  startDate?: string;
  endDate?: string;
  department?: string;
  sortBy?: "views" | "recommended";
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  try {
    if (opts.userId) {
      const blockedIds = await getBlockedUserIds(opts.userId);
      if (blockedIds.length > 0) {
        conditions.push(notInArray(posts.authorId, blockedIds));
      }
    }

    if (opts.category) {
      conditions.push(eq(posts.category, opts.category));
    }

    // 마감된 글 제외 필터 (일반 목록 조회 시 기본 적용)
    // 명시적으로 '마감'을 요청하지 않은 경우, 마감된 글은 제외함
    if (opts.status === "마감") {
      conditions.push(eq(posts.status, "마감"));
    } else {
      // '모집중' 이거나 상태 필터가 없는 경우
      conditions.push(
        and(
          eq(posts.status, "모집중"),
          or(sql`${posts.deadline} IS NULL`, sql`${posts.deadline} > NOW()`)
        )
      );
    }

    if (opts.keyword) {
      conditions.push(like(posts.keywords, `%${opts.keyword}%`));
    }

    if (opts.search) {
      conditions.push(
        or(
          like(posts.title, `%${opts.search}%`),
          like(posts.keywords, `%${opts.search}%`)
        )
      );
    }

    // 작성 날짜 필터
    if (opts.startDate) {
      const startDate = new Date(opts.startDate);
      conditions.push(gte(posts.createdAt, startDate));
    }
    if (opts.endDate) {
      const endDate = new Date(opts.endDate);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lt(posts.createdAt, endDate));
    }

    // 학과 필터
    if (opts.department) {
      conditions.push(
        inArray(
          posts.authorId,
          db
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.department, opts.department))
        )
      );
    }

    // 마감임박 정렬 시 진짜 마감이 임박한 글(24시간 이내)만 보기
    if (opts.sort === "deadline") {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      conditions.push(
        and(
          isNotNull(posts.deadline),
          gte(posts.deadline, now),
          lt(posts.deadline, tomorrow)
        )
      );
    }

    const orderByExpr =
      opts.sortBy === "views"
        ? desc(posts.viewCount)
        : opts.sortBy === "recommended"
          ? desc(
              sql<number>`(SELECT count(*)::int FROM likes WHERE likes."postId" = posts.id)`
            )
          : opts.sort === "deadline"
            ? sql`CASE WHEN ${posts.deadline} IS NULL THEN 1 ELSE 0 END, ${posts.deadline} ASC`
            : desc(posts.createdAt);

    const query = db
      .select({
        post: posts,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
        likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes."postId" = posts.id)`,
        commentCount: sql<number>`(SELECT count(*)::int FROM comments WHERE comments."postId" = posts.id)`,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByExpr)
      .limit(opts.limit ?? 20)
      .offset(opts.offset ?? 0);

    const result = await query;
    return result.map(r => ({
      ...r,
      likeCount: Number(r.likeCount || 0),
      commentCount: Number(r.commentCount || 0),
    }));
  } catch (error) {
    console.warn("[Database] listPosts 쿼리 실패 (테이블 부재 가능성):", error);
    try {
      // fallback 도 메인 select 와 동일한 컬럼 셋을 가져야 union 타입이 좁아지지 않음
      const fallbackQuery = db
        .select({
          post: posts,
          authorName: users.name,
          authorAvatarUrl: users.avatarUrl,
        })
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(opts.limit ?? 20);
      const res = await fallbackQuery;
      return res.map(r => ({ ...r, likeCount: 0, commentCount: 0 }));
    } catch (e) {
      return [];
    }
  }
}

// * 게시글 상세 정보(작성자 정보 포함)를 조회하는 함수
export async function getPostById(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    // 1. 기본 게시글 정보 조회
    const result = await db
      .select({
        post: posts,
        authorName: users.name,
        authorOpenId: users.openId,
        authorAvatarUrl: users.avatarUrl,
        authorKeywords: profiles.keywords,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(posts.id, id))
      .limit(1);

    if (result.length === 0) return undefined;
    const postData = result[0];

    // 2. 좋아요 및 북마크 카운트 조회 (개별 에러 처리)
    let likeCount = 0;
    let bookmarkCount = 0;
    let isLiked = false;
    let isBookmarked = false;

    try {
      const lRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(likes)
        .where(eq(likes.postId, id));
      likeCount = Number(lRes[0]?.count || 0);
      if (userId) {
        const uLike = await db
          .select()
          .from(likes)
          .where(and(eq(likes.userId, userId), eq(likes.postId, id)))
          .limit(1);
        isLiked = uLike.length > 0;
      }
    } catch {
      /* ignore */
    }

    try {
      const bRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookmarks)
        .where(eq(bookmarks.postId, id));
      bookmarkCount = Number(bRes[0]?.count || 0);
      if (userId) {
        const uBookmark = await db
          .select()
          .from(bookmarks)
          .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, id)))
          .limit(1);
        isBookmarked = uBookmark.length > 0;
      }
    } catch {
      /* ignore */
    }

    return {
      ...postData,
      likeCount,
      bookmarkCount,
      isLiked,
      isBookmarked,
    };
  } catch (error) {
    console.error("[Database] getPostById 에러:", error);
    return undefined;
  }
}

// * 새로운 게시글을 작성하는 함수
export async function createPost(data: InsertPost) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db
    .insert(posts)
    .values(data)
    .returning({ id: posts.id });
  return getPostById(result[0].id);
}

// * 게시글을 수정하는 함수
export async function updatePost(id: number, data: Partial<InsertPost>) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db.update(posts).set(data).where(eq(posts.id, id));
  return getPostById(id);
}

// * 게시글을 삭제하는 함수
export async function deletePost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db.delete(posts).where(eq(posts.id, id));
}

// * 조회수를 1 증가시키는 함수
export async function incrementViewCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(posts)
    .set({ viewCount: sql`COALESCE(${posts.viewCount}, 0) + 1` })
    .where(eq(posts.id, id));
}

// * 특정 작성자가 쓴 게시글 목록을 조회하는 함수
export async function getPostsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        post: posts,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
        likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes."postId" = posts.id)`,
        commentCount: sql<number>`(SELECT count(*)::int FROM comments WHERE comments."postId" = posts.id)`,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.authorId, authorId))
      .orderBy(desc(posts.createdAt));

    return result.map(r => ({
      ...r,
      likeCount: Number(r.likeCount || 0),
      commentCount: Number(r.commentCount || 0),
    }));
  } catch (error) {
    console.warn("[Database] getPostsByAuthor 쿼리 실패:", error);
    const fallback = await db
      .select()
      .from(posts)
      .where(eq(posts.authorId, authorId))
      .orderBy(desc(posts.createdAt));
    return fallback.map(p => ({
      post: p,
      authorName: null,
      likeCount: 0,
      commentCount: 0,
    }));
  }
}

// ─── 댓글(Comments) 관련 함수 ───────────────────────────────────────────────────

// * 특정 게시글의 모든 댓글을 최신순으로 조회하는 함수
export async function getCommentsByPost(postId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(comments.postId, postId)];

  if (userId) {
    const blockedIds = await getBlockedUserIds(userId);
    if (blockedIds.length > 0) {
      conditions.push(notInArray(comments.authorId, blockedIds));
    }
  }

  return db
    .select({
      comment: comments,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(...conditions))
    .orderBy(comments.createdAt);
}

// * 새로운 댓글을 작성하는 함수
export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(comments).values(data).returning();
  return result[0];
}

// * 댓글을 삭제하는 함수
export async function deleteComment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, userId)));
}

// ─── 좋아요 및 북마크(Likes & Bookmarks) 관련 함수 ───────────────────────────────

// * 좋아요 토글 함수
export async function toggleLike(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  const existing = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    return { liked: false };
  } else {
    await db.insert(likes).values({ userId, postId });
    return { liked: true };
  }
}

// * 북마크 토글 함수
export async function toggleBookmark(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  const existing = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)));
    return { bookmarked: false };
  } else {
    await db.insert(bookmarks).values({ userId, postId });
    return { bookmarked: true };
  }
}

// * 사용자가 북마크한 게시글 목록을 조회하는 함수
export async function getBookmarkedPosts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        post: posts,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
        likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes."postId" = posts.id)`,
        commentCount: sql<number>`(SELECT count(*)::int FROM comments WHERE comments."postId" = posts.id)`,
      })
      .from(bookmarks)
      .innerJoin(posts, eq(bookmarks.postId, posts.id))
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));

    return result.map(r => ({
      ...r,
      likeCount: Number(r.likeCount || 0),
      commentCount: Number(r.commentCount || 0),
    }));
  } catch (error) {
    console.warn("[Database] getBookmarkedPosts 쿼리 실패:", error);
    try {
      const fallback = await db
        .select({ post: posts, authorName: users.name })
        .from(bookmarks)
        .innerJoin(posts, eq(bookmarks.postId, posts.id))
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(eq(bookmarks.userId, userId));
      return fallback.map(r => ({ ...r, likeCount: 0, commentCount: 0 }));
    } catch (e) {
      return [];
    }
  }
}

// ─── 모집 신청(Applications) 관련 함수 ──────────────────────────────────────────

// * 특정 유저가 해당 게시글에 이미 신청했는지 확인하는 함수
export async function getApplicationByPostAndUser(
  postId: number,
  applicantId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.postId, postId),
        eq(applications.applicantId, applicantId)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// * 모집 신청서를 생성하는 함수
export async function createApplication(data: InsertApplication) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(applications).values(data).returning();
  return result[0];
}

export async function getApplicationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}



// * 특정 게시물에 달린 모든 신청서 목록을 조회하는 함수 (작성자용)
export async function getApplicationsByPost(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      application: applications,
      applicantName: users.name,
      applicantOpenId: users.openId,
      applicantId: users.id,
    })
    .from(applications)
    .leftJoin(users, eq(applications.applicantId, users.id))
    .where(eq(applications.postId, postId))
    .orderBy(desc(applications.createdAt));
}



// * 특정 사용자가 신청한 내역들을 조회하는 함수 (내 신청 현황용)
export async function getApplicationsByUser(applicantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      application: applications,
      post: posts,
    })
    .from(applications)
    .leftJoin(posts, eq(applications.postId, posts.id))
    .where(eq(applications.applicantId, applicantId))
    .orderBy(desc(applications.createdAt));
}

// * 신청서의 상태(수락/거절/1차합격)를 업데이트하는 함수
export async function updateApplicationStatus(
  id: number,
  status: Application["status"],
  rejectReason?: string | null,
  interviewDetails?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .update(applications)
    .set({
      status,
      rejectReason: rejectReason || null,
      interviewDetails: interviewDetails || null,
    })
    .where(eq(applications.id, id));
  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);
  return rows[0];
}

// ─── 추천 시스템(Recommendation) 관련 함수 ───────────────────────────────────────

// * 사용자의 관심 키워드와 매칭되는 추천 게시글을 가져오는 함수
export async function getRecommendedPosts(userId: number, limit = 6) {
  const db = await getDb();
  if (!db) return [];

  try {
    // 차단한 사용자 목록 조회
    const blockedIds = await getBlockedUserIds(userId);

    // 사용자 프로필 키워드 조회
    const profile = await getProfileByUserId(userId);

    // 기본 쿼리 조건들
    const baseConditions = [
      eq(posts.status, "모집중"),
      or(sql`${posts.deadline} IS NULL`, sql`${posts.deadline} > NOW()`),
    ];

    if (blockedIds.length > 0) {
      baseConditions.push(notInArray(posts.authorId, blockedIds));
    }

    // 기본 쿼리 베이스 (좋아요/댓글 수 포함)
    const baseQuery = db
      .select({
        post: posts,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
        likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes."postId" = posts.id)`,
        commentCount: sql<number>`(SELECT count(*)::int FROM comments WHERE comments."postId" = posts.id)`,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(and(...baseConditions));

    // main 의 새 반환 구조: { profile: { keywords, ... } | null, name, avatarUrl, email }
    const profileKeywords = profile?.profile?.keywords;
    if (!profileKeywords) {
      const result = await baseQuery
        .orderBy(desc(posts.createdAt))
        .limit(limit);
      return result.map(r => ({
        ...r,
        likeCount: Number(r.likeCount || 0),
        commentCount: Number(r.commentCount || 0),
      }));
    }

    let userKeywords: string[] = [];
    try {
      userKeywords = JSON.parse(profileKeywords);
    } catch {
      userKeywords = [];
    }

    if (userKeywords.length === 0) {
      const result = await baseQuery
        .orderBy(desc(posts.createdAt))
        .limit(limit);
      return result.map(r => ({
        ...r,
        likeCount: Number(r.likeCount || 0),
        commentCount: Number(r.commentCount || 0),
      }));
    }

    // 키워드 매칭 — drizzle 은 같은 쿼리에 .where 를 두 번 못 붙이므로
    // 새 쿼리를 처음부터 키워드 조건 포함해 만든다.
    const keywordConditions = userKeywords.map(kw =>
      like(posts.keywords, `%${kw}%`)
    );

    const allPostsConditions = [
      eq(posts.status, "모집중"),
      or(sql`${posts.deadline} IS NULL`, sql`${posts.deadline} > NOW()`),
      or(...keywordConditions),
    ];

    if (blockedIds.length > 0) {
      allPostsConditions.push(notInArray(posts.authorId, blockedIds));
    }

    const allPosts = await db
      .select({
        post: posts,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
        likeCount: sql<number>`(SELECT count(*)::int FROM likes WHERE likes."postId" = posts.id)`,
        commentCount: sql<number>`(SELECT count(*)::int FROM comments WHERE comments."postId" = posts.id)`,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(and(...allPostsConditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit * 3);

    // 매칭 점수 계산
    const scored = allPosts.map(row => {
      let score = 0;
      try {
        const postKws: string[] = JSON.parse(row.post.keywords ?? "[]");
        for (const uk of userKeywords) {
          if (postKws.some(pk => pk.toLowerCase().includes(uk.toLowerCase())))
            score++;
        }
      } catch {
        /* ignore */
      }
      return {
        ...row,
        likeCount: Number(row.likeCount || 0),
        commentCount: Number(row.commentCount || 0),
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch (error) {
    console.error("추천 게시글 조회 중 오류 발생:", error);
    return [];
  }
}

// * 모든 게시글에서 고유한 키워드 목록을 가져오는 함수 (자동완성용)
export async function getAllKeywords(query?: string) {
  const db = await getDb();
  if (!db) return [];

  try {
    const allPosts = await db.select({ keywords: posts.keywords }).from(posts);
    const keywordSet = new Set<string>();

    allPosts.forEach(p => {
      if (p.keywords) {
        try {
          const kws: string[] = JSON.parse(p.keywords);
          kws.forEach(kw => {
            if (!query || kw.toLowerCase().includes(query.toLowerCase())) {
              keywordSet.add(kw);
            }
          });
        } catch {
          /* ignore */
        }
      }
    });

    return Array.from(keywordSet).slice(0, 10); // 최대 10개 제안
  } catch (error) {
    console.warn("[Database] getAllKeywords 실패:", error);
    return [];
  }
}

// ─── 메시지(Messages) 관련 함수 ────────────────────────────────────────────────

// * 메시지를 전송하는 함수
export async function sendMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  // 차단 관계가 있는지 확인
  const blockRelationIds = await getBlockRelationUserIds(data.senderId);
  if (blockRelationIds.includes(data.receiverId)) {
    throw new Error("차단 관계로 인해 메시지를 전송할 수 없습니다.");
  }

  const result = await db.insert(messages).values(data).returning();
  return result[0];
}

// * 두 사용자 간의 메시지 내역을 조회하는 함수
export async function getMessages(userId: number, otherUserId: number) {
  const db = await getDb();
  if (!db) return [];

  // 차단 관계 확인
  const blockRelationIds = await getBlockRelationUserIds(userId);
  if (blockRelationIds.includes(otherUserId)) {
    return [];
  }

  return db
    .select()
    .from(messages)
    .where(
      or(
        and(
          eq(messages.senderId, userId),
          eq(messages.receiverId, otherUserId)
        ),
        and(eq(messages.senderId, otherUserId), eq(messages.receiverId, userId))
      )
    )
    .orderBy(messages.createdAt);
}

// * 나의 대화 목록을 조회하는 함수 (최근 메시지 포함)
export async function getConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // 1. 내가 참여한 모든 메시지의 상대방 ID 목록 가져오기
  const userMessages = await db
    .select({
      senderId: messages.senderId,
      receiverId: messages.receiverId,
    })
    .from(messages)
    .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)));

  // 차단된 대상들과의 대화 목록 필터링
  const blockRelationIds = await getBlockRelationUserIds(userId);

  const otherUserIds = Array.from(
    new Set(
      userMessages.map(m => (m.senderId === userId ? m.receiverId : m.senderId))
    )
  ).filter(otherId => !blockRelationIds.includes(otherId));

  if (otherUserIds.length === 0) return [];

  // 2. 상대방 정보 및 최근 메시지 가져오기
  const conversations = await Promise.all(
    otherUserIds.map(async otherId => {
      const otherUser = await db
        .select()
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1);
      const lastMsg = await db
        .select()
        .from(messages)
        .where(
          or(
            and(
              eq(messages.senderId, userId),
              eq(messages.receiverId, otherId)
            ),
            and(eq(messages.senderId, otherId), eq(messages.receiverId, userId))
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const unreadCount = await db
        .select({ count: sql`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.senderId, otherId),
            eq(messages.receiverId, userId),
            eq(messages.isRead, 0)
          )
        );

      return {
        otherUser: otherUser[0],
        lastMessage: lastMsg[0],
        unreadCount: Number((unreadCount[0] as any).count || 0),
      };
    })
  );

  // 최근 메시지 순으로 정렬
  return conversations.sort(
    (a, b) =>
      (b.lastMessage?.createdAt.getTime() || 0) -
      (a.lastMessage?.createdAt.getTime() || 0)
  );
}

// * 메시지를 읽음 처리하는 함수
export async function markMessagesAsRead(userId: number, otherUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(messages)
    .set({ isRead: 1 })
    .where(
      and(
        eq(messages.senderId, otherUserId),
        eq(messages.receiverId, userId),
        eq(messages.isRead, 0)
      )
    );
}

// * 메시지를 삭제하는 함수
export async function deleteMessage(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .delete(messages)
    .where(and(eq(messages.id, id), eq(messages.senderId, userId)));
}

// * 메시지를 수정하는 함수
export async function updateMessage(
  id: number,
  userId: number,
  content: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .update(messages)
    .set({ content })
    .where(and(eq(messages.id, id), eq(messages.senderId, userId)));
}

// * 총 읽지 않은 메시지 수를 조회하는 함수
export async function getTotalUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.receiverId, userId), eq(messages.isRead, 0)));
  return Number(result[0]?.count || 0);
}



// ─── 감사 로그(AuditLog) ──────────────────────────────────────────────────────

/**
 * 감사 로그 INSERT. 실패해도 비즈니스 로직에 영향 주지 않도록 호출자에서
 * Promise 를 await 하지 말고 fire-and-forget 으로 쓸 수 있게 설계되어 있다.
 * 단 console.error 로 흔적은 남긴다.
 */
export async function insertAuditLog(input: {
  userId?: number | null;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLog).values({
      userId: input.userId ?? null,
      action: input.action,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
  } catch (e) {
    console.error(`[auditLog] insert failed for action=${input.action}:`, e);
  }
}

// ─── 학과(Departments) 관련 함수 ───────────────────────────────────────────────

/** 학과 전체 목록 — 회원가입 폼/프로필 폼에서 사용. */
export async function listDepartments(): Promise<Department[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(departments);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
}

/** 학과 단건 조회 (FK 검증용). */
export async function getDepartmentById(
  id: number
): Promise<Department | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── 회원가입 완료 — 모든 작업을 한 트랜잭션으로 ──────────────────────────────

export async function completeRegistrationSimplified(input: {
  userId: number;
  realName: string;
  studentId: string;
  admissionYear: number;
  departmentId: number;
}): Promise<{ user: User }> {
  const db = await getDb();
  if (!db) throw new Error("DB_UNAVAILABLE");

  return db.transaction(async tx => {
    // 0) 이메일 인증 통과 여부 교차 검증 (최근 15분 이내 성공하고 소모되지 않은 건 조회)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000);
    const verifications = await tx
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, input.userId),
          isNotNull(emailVerifications.verifiedAt),
          isNull(emailVerifications.consumedAt),
          gte(emailVerifications.verifiedAt, fifteenMinutesAgo)
        )
      )
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (verifications.length === 0) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }
    const verifiedEmailAddr = verifications[0].email;

    // 1) 학번 중복 확인 (partial unique 가 있지만 명시 에러 메시지를 위해 사전 체크)
    const sidRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.studentId, input.studentId))
      .limit(1);
    if (sidRows[0] && sidRows[0].id !== input.userId) {
      throw new Error("STUDENT_ID_TAKEN");
    }

    // 2) users 업데이트 → status='verified' 및 verifiedEmail 등록
    const updated = await tx
      .update(users)
      .set({
        realName: input.realName,
        studentId: input.studentId,
        admissionYear: input.admissionYear,
        departmentId: input.departmentId,
        verifiedEmail: verifiedEmailAddr,
        status: "verified",
      })
      .where(eq(users.id, input.userId))
      .returning();

    if (!updated[0]) throw new Error("USER_NOT_FOUND");

    // 2.5) 이메일 인증 기록 소모(consumedAt) 처리
    await tx
      .update(emailVerifications)
      .set({ consumedAt: new Date() })
      .where(eq(emailVerifications.id, verifications[0].id));

    // 3) profiles 레코드 생성 (없을 경우에만)
    const existingProfile = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.userId, input.userId))
      .limit(1);

    if (existingProfile.length === 0) {
      await tx.insert(profiles).values({
        userId: input.userId,
        department: null, // deprecated
      });
    }

    return { user: updated[0] };
  });
}

// ─── 사용자 제재(Admin) 관련 함수 ───────────────────────────────────────────────

export async function updateUserStatus(userId: number, status: User["status"]) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db.update(users).set({ status }).where(eq(users.id, userId));
}

// ─── 차단(Blocks) 관련 함수 ───────────────────────────────────────────────────

export async function createBlock(blockerId: number, blockedId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db
    .insert(blocks)
    .values({ blockerId, blockedId })
    .returning();
  return result[0];
}

export async function deleteBlock(blockerId: number, blockedId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .delete(blocks)
    .where(
      and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))
    );
}

export async function getBlockedUserIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ blockedId: blocks.blockedId })
    .from(blocks)
    .where(eq(blocks.blockerId, userId));
  return rows.map(r => r.blockedId);
}

export async function listBlockedUsers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      email: users.email,
    })
    .from(blocks)
    .innerJoin(users, eq(blocks.blockedId, users.id))
    .where(eq(blocks.blockerId, userId))
    .orderBy(desc(blocks.createdAt));
}

export async function getBlockRelationUserIds(
  userId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. 내가 차단한 사용자 목록
  const rows1 = await db
    .select({ blockedId: blocks.blockedId })
    .from(blocks)
    .where(eq(blocks.blockerId, userId));

  // 2. 나를 차단한 사용자 목록
  const rows2 = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(eq(blocks.blockedId, userId));

  const ids = new Set<number>([
    ...rows1.map(r => r.blockedId),
    ...rows2.map(r => r.blockerId),
  ]);

  return Array.from(ids);
}

// ─── 신고(Reports) 관련 함수 ───────────────────────────────────────────────────

export async function createReport(data: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(reports).values(data).returning();
  return result[0];
}

export async function listReports() {
  const db = await getDb();
  if (!db) return [];
  // 신고 내역과 신고자 정보를 함께 가져옵니다.
  return db
    .select({
      report: reports,
      reporterName: users.name,
      reporterEmail: users.email,
    })
    .from(reports)
    .leftJoin(users, eq(reports.reporterId, users.id))
    .orderBy(desc(reports.createdAt));
}

export async function updateReportStatus(id: number, status: Report["status"]) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db.update(reports).set({ status }).where(eq(reports.id, id));
}

// ─── 캘린더(Calendar) 관련 함수 ───────────────────────────────────────────────────

// * 특정 사용자의 개인 일정 및 전체 공개 학사일정/공휴일을 조회하는 함수
export async function listCalendarEvents(userId: number | null) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (userId !== null) {
    conditions.push(
      or(sql`"userId" IS NULL`, eq(calendarEvents.userId, userId))
    );
  } else {
    conditions.push(sql`"userId" IS NULL`);
  }
  conditions.push(isNull(calendarEvents.groupId));

  return db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(calendarEvents.startDate);
}

// * 개인 일정을 생성하는 함수
export async function createCalendarEvent(data: InsertCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(calendarEvents).values(data).returning();
  return result[0];
}

// * 개인 일정을 수정하는 함수
export async function updateCalendarEvent(
  id: number,
  userId: number,
  data: Partial<InsertCalendarEvent>
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db
    .update(calendarEvents)
    .set({
      ...data,
    })
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
    .returning();
  return result[0];
}

// * 개인 일정을 삭제하는 함수
export async function deleteCalendarEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)));
  return { success: true };
}

// ─── 그룹(Groups) 관련 함수 ───────────────────────────────────────────────────────

// * 특정 사용자가 리더인 그룹 목록을 조회하는 함수
export async function getGroupsByLeader(leaderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groups).where(eq(groups.leaderId, leaderId));
}

// * 고유 키를 기반으로 단건 그룹 정보를 조회하는 함수
export async function getGroupByAccessKey(accessKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(groups)
    .where(eq(groups.accessKey, accessKey))
    .limit(1);
  return result[0];
}

// * 단건 그룹 ID 기반으로 정보 조회
export async function getGroupById(groupId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  return result[0];
}

// * 그룹을 생성하는 함수 (관리자 전용)
export async function createGroup(data: InsertGroup) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(groups).values(data).returning();
  return result[0];
}

// * 키를 입력하여 수동으로 그룹에 가입(참여)하는 함수
export async function joinGroupWithKey(userId: number, accessKey: string) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  // 1. 키에 해당하는 그룹 존재 확인
  const group = await getGroupByAccessKey(accessKey);
  if (!group) throw new Error("유효하지 않은 그룹 고유 키입니다.");

  // 2. 이미 가입되어 있는지 확인
  const existing = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.userId, userId), eq(groupMembers.groupId, group.id))
    )
    .limit(1);
  if (existing.length > 0) return { success: true, alreadyJoined: true, group };

  // 3. 신규 가입 처리
  await db.insert(groupMembers).values({ userId, groupId: group.id });
  return { success: true, alreadyJoined: false, group };
}

// * 특정 신청자를 동아리/스터디 합격 시 자동으로 그룹 멤버에 추가하는 함수
export async function autoJoinGroupMember(userId: number, groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  const existing = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.userId, userId), eq(groupMembers.groupId, groupId))
    )
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(groupMembers).values({ userId, groupId });
}

// * 특정 그룹에 소속된 멤버 목록을 조회하는 함수 (리더용)
export async function getGroupMembers(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      membershipId: groupMembers.id,
      joinedAt: groupMembers.joinedAt,
      userId: users.id,
      name: users.name,
      realName: users.realName,
      studentId: users.studentId,
      avatarUrl: users.avatarUrl,
      roleId: groupMembers.roleId,
      roleName: groupRoles.name,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .leftJoin(groupRoles, eq(groupMembers.roleId, groupRoles.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(desc(groupMembers.joinedAt));
}

// * 특정 사용자가 리더이거나 가입되어 속해있는 모든 그룹 ID 목록을 가져오는 함수
export async function getUserGroupIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. 내가 리더인 그룹
  const ledGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.leaderId, userId));
  // 2. 내가 가입한 그룹
  const memberGroups = await db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const set = new Set<number>([
    ...ledGroups.map(g => g.id),
    ...memberGroups.map(m => m.id),
  ]);

  return Array.from(set);
}

// * 특정 그룹의 스케줄 목록을 가져오는 함수 (모집글 연동용 - 비밀 일정은 제외)
export async function getGroupEvents(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.groupId, groupId), eq(calendarEvents.isPrivate, 0))
    )
    .orderBy(calendarEvents.startDate);
}

// * 특정 그룹의 모든 스케줄 목록을 가져오는 함수 (비밀 일정 포함)
export async function getGroupEventsWithPrivate(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.groupId, groupId))
    .orderBy(calendarEvents.startDate);
}

// * 그룹 전용 일정을 생성하는 함수
export async function createGroupCalendarEvent(data: InsertCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(calendarEvents).values(data).returning();
  return result[0];
}

// * 그룹 전용 일정을 수정하는 함수
export async function updateGroupCalendarEvent(
  id: number,
  groupId: number,
  data: Partial<InsertCalendarEvent>
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db
    .update(calendarEvents)
    .set({
      ...data,
    })
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.groupId, groupId)))
    .returning();
  return result[0];
}

// * 그룹 전용 일정을 삭제하는 함수
export async function deleteGroupCalendarEvent(id: number, groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.groupId, groupId)));
  return { success: true };
}

// * 특정 사용자의 그룹 권한을 확인하는 함수
export async function checkGroupPermissions(userId: number, groupId: number) {
  const db = await getDb();
  const permissions = {
    isLeader: false,
    canManageSchedule: false,
    canManageNotice: false,
    canViewPrivateEvent: false,
    roleName: null as string | null,
  };

  if (!db) return permissions;

  // 1. 그룹 마스터 정보 조회
  const group = await getGroupById(groupId);
  if (!group) return permissions;

  // 2. 리더 여부 확인
  if (group.leaderId === userId) {
    permissions.isLeader = true;
    permissions.canManageSchedule = true;
    permissions.canManageNotice = true;
    permissions.canViewPrivateEvent = true;
    permissions.roleName = "리더";
    return permissions;
  }

  // 3. 멤버십 및 지위 확인
  const member = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .limit(1);

  if (member.length === 0) return permissions; // 멤버 아님

  const roleId = member[0].roleId;
  if (!roleId) return permissions; // 일반 멤버 (특별 지위 없음)

  // 4. 지위 권한 조회
  const role = await db
    .select()
    .from(groupRoles)
    .where(eq(groupRoles.id, roleId))
    .limit(1);

  if (role.length > 0) {
    permissions.roleName = role[0].name;
    permissions.canManageSchedule = role[0].canManageSchedule === 1;
    permissions.canManageNotice = role[0].canManageNotice === 1;
    permissions.canViewPrivateEvent = role[0].canViewPrivateEvent === 1;
  }

  return permissions;
}

// * 사용자가 참여하고 있거나 리더인 그룹들의 모든 일정을 조회하는 함수 (비밀 일정 권한에 따라 필터링)
export async function listUserGroupCalendarEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const groupIds = await getUserGroupIds(userId);
  if (groupIds.length === 0) return [];

  const allEvents: any[] = [];

  for (const groupId of groupIds) {
    const perm = await checkGroupPermissions(userId, groupId);
    const hasPrivateAccess = perm.isLeader || perm.canViewPrivateEvent;

    const conditions = [eq(calendarEvents.groupId, groupId)];
    if (!hasPrivateAccess) {
      conditions.push(eq(calendarEvents.isPrivate, 0));
    }

    const events = await db
      .select({
        event: calendarEvents,
        groupName: groups.name,
      })
      .from(calendarEvents)
      .innerJoin(groups, eq(calendarEvents.groupId, groups.id))
      .where(and(...conditions))
      .orderBy(calendarEvents.startDate);

    allEvents.push(...events);
  }

  return allEvents;
}

// * 모든 그룹 목록을 조회하는 함수 (관리자용)
export async function getAllGroups() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: groups.id,
      name: groups.name,
      leaderId: groups.leaderId,
      leaderName: users.name,
      accessKey: groups.accessKey,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(users, eq(groups.leaderId, users.id))
    .orderBy(desc(groups.createdAt));
}

// * 그룹을 삭제하고 고유 키를 회수하는 함수 (관리자용)
export async function deleteGroup(groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");

  // 1. posts 테이블에서 해당 groupId 연동 해제
  await db
    .update(posts)
    .set({ groupId: null })
    .where(eq(posts.groupId, groupId));

  // 2. group_members 테이블에서 멤버 매핑 제거
  await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));

  // 3. group_roles 테이블에서 지위 정보 제거
  await db.delete(groupRoles).where(eq(groupRoles.groupId, groupId));

  // 4. group_announcements 테이블에서 공지사항 제거
  await db
    .delete(groupAnnouncements)
    .where(eq(groupAnnouncements.groupId, groupId));

  // 5. group_chat_messages 테이블에서 채팅 내역 제거
  await db
    .delete(groupChatMessages)
    .where(eq(groupChatMessages.groupId, groupId));

  // 6. calendar_events 테이블에서 해당 그룹 일정 삭제
  await db.delete(calendarEvents).where(eq(calendarEvents.groupId, groupId));

  // 7. groups 테이블에서 그룹 삭제
  await db.delete(groups).where(eq(groups.id, groupId));

  return { success: true };
}

// ─── 그룹 추가 기능 (커스텀 지위/권한, 대화, 공지) ───────────────────────────────────

// * 그룹 멤버 강제 연동 해제 (탈퇴/추방)
export async function removeGroupMember(groupId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
}

// * 그룹 멤버에게 지위(Role) 지정
export async function assignMemberRole(
  groupId: number,
  userId: number,
  roleId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db
    .update(groupMembers)
    .set({ roleId })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
}

// * 특정 그룹에 정의된 모든 커스텀 지위 목록 조회
export async function getGroupRoles(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(groupRoles)
    .where(eq(groupRoles.groupId, groupId))
    .orderBy(groupRoles.createdAt);
}

// * 새로운 그룹 지위(Role) 생성
export async function createGroupRole(data: InsertGroupRole) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(groupRoles).values(data).returning();
  return result[0];
}

// * 그룹 지위(Role) 삭제 및 관련 멤버 초기화
export async function deleteGroupRole(roleId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  // 1. 해당 지위가 부여된 멤버들을 지위 없음(일반멤버) 상태로 리셋
  await db
    .update(groupMembers)
    .set({ roleId: null })
    .where(eq(groupMembers.roleId, roleId));
  // 2. 지위 마스터에서 제거
  await db.delete(groupRoles).where(eq(groupRoles.id, roleId));
}

// * 그룹 지위(Role) 권한 정보 수정
export async function updateGroupRole(
  roleId: number,
  data: Partial<InsertGroupRole>
) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db
    .update(groupRoles)
    .set(data)
    .where(eq(groupRoles.id, roleId))
    .returning();
  return result[0];
}

// * 사용자가 연동되어 있는(리더 혹은 멤버로 가입된) 모든 그룹 상세 정보 목록 조회 (지위 정보 포함)
export async function getUserJoinedAndLedGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // 1. 연동된 그룹 ID 목록
  const groupIds = await getUserGroupIds(userId);
  if (groupIds.length === 0) return [];

  // 2. 그룹 및 리더 상세 정보 조회
  const result = await db
    .select({
      id: groups.id,
      name: groups.name,
      leaderId: groups.leaderId,
      leaderName: users.name,
      accessKey: groups.accessKey,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .leftJoin(users, eq(groups.leaderId, users.id))
    .where(inArray(groups.id, groupIds))
    .orderBy(desc(groups.createdAt));

  // 각 그룹별 멤버 수 계산 및 병합
  const groupsWithDetails = await Promise.all(
    result.map(async g => {
      const mCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, g.id));

      const userRoleObj = await checkGroupPermissions(userId, g.id);

      return {
        ...g,
        memberCount: Number(mCount[0]?.count || 0),
        userRole: userRoleObj.roleName,
        isLeader: userRoleObj.isLeader,
        canManageSchedule: userRoleObj.canManageSchedule,
        canManageNotice: userRoleObj.canManageNotice,
        canViewPrivateEvent: userRoleObj.canViewPrivateEvent,
      };
    })
  );

  return groupsWithDetails;
}

// * 그룹의 모든 공지사항 조회
export async function getGroupAnnouncements(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: groupAnnouncements.id,
      groupId: groupAnnouncements.groupId,
      title: groupAnnouncements.title,
      content: groupAnnouncements.content,
      createdAt: groupAnnouncements.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorRealName: users.realName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(groupAnnouncements)
    .innerJoin(users, eq(groupAnnouncements.authorId, users.id))
    .where(eq(groupAnnouncements.groupId, groupId))
    .orderBy(desc(groupAnnouncements.createdAt));
}

// * 새로운 공지사항 생성
export async function createGroupAnnouncement(data: InsertGroupAnnouncement) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(groupAnnouncements).values(data).returning();
  return result[0];
}

// * 공지사항 삭제
export async function deleteGroupAnnouncement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  await db.delete(groupAnnouncements).where(eq(groupAnnouncements.id, id));
}

// * 그룹 채팅방 최근 메시지 목록 조회
export async function getGroupChatMessages(groupId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const msgs = await db
    .select({
      id: groupChatMessages.id,
      groupId: groupChatMessages.groupId,
      content: groupChatMessages.content,
      createdAt: groupChatMessages.createdAt,
      senderId: users.id,
      senderName: users.name,
      senderRealName: users.realName,
      senderAvatarUrl: users.avatarUrl,
    })
    .from(groupChatMessages)
    .innerJoin(users, eq(groupChatMessages.senderId, users.id))
    .where(eq(groupChatMessages.groupId, groupId))
    .orderBy(desc(groupChatMessages.createdAt))
    .limit(limit);

  return msgs.reverse(); // 오름차순(시간 흐름 순)으로 정합성 정렬
}

// * 그룹 채팅방 메시지 전송
export async function createGroupChatMessage(data: InsertGroupChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB 사용 불가능");
  const result = await db.insert(groupChatMessages).values(data).returning();
  return result[0];
}
