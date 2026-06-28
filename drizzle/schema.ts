import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  serial,
  smallint,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// ============================================================================
// 학과 마스터 (drizzle/seeds/001_departments.sql 로 시드)
// ============================================================================
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  college: varchar("college", { length: 100 }),
  campus: varchar("campus", { length: 20 }).default("글로벌").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ============================================================================
// 사용자 — 가입 상태 머신
//   status = 'pending'  : Kakao 가입 직후. 읽기만 가능.
//   status = 'verified' : 학교 이메일 인증 + 실명/학번/학과 입력 완료.
//   status = 'disabled' : 관리자 제재. 로그인 불가.
// ============================================================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: varchar("role", { length: 20 })
      .$type<"user" | "admin">()
      .default("user")
      .notNull(),
    avatarUrl: text("avatarUrl"),

    // --- 인증 재설계 신규 컬럼 ---
    status: varchar("status", { length: 20 })
      .$type<"pending" | "verified" | "disabled">()
      .default("pending")
      .notNull(),
    realName: varchar("realName", { length: 50 }),
    studentId: varchar("studentId", { length: 10 }),
    admissionYear: smallint("admissionYear"),
    departmentId: integer("departmentId"),
    verifiedEmail: varchar("verifiedEmail", { length: 320 }),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("users_studentId_unique")
      .on(table.studentId)
      .where(sql`"studentId" IS NOT NULL`),
    uniqueIndex("users_verifiedEmail_unique")
      .on(table.verifiedEmail)
      .where(sql`"verifiedEmail" IS NOT NULL`),
    index("users_status_idx").on(table.status),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// 사용자 프로필 (users 1:1)
// users.departmentId 가 정식. profiles.department(자유문자열)는 @deprecated.
// ============================================================================
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  department: varchar("department", { length: 100 }), // @deprecated — users.departmentId 사용
  grade: varchar("grade", { length: 20 }).$type<
    "1" | "2" | "3" | "4" | "대학원"
  >(),
  bio: text("bio"),
  keywords: text("keywords"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// ============================================================================
// 학교 이메일 인증 — 6자리 코드, 해시 저장, attempts ≤ 10, 5분 만료
// ============================================================================
export const emailVerifications = pgTable(
  "emailVerifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    verifiedAt: timestamp("verifiedAt"),
    consumedAt: timestamp("consumedAt"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("emailVerifications_userId_idx").on(table.userId),
    index("emailVerifications_email_idx").on(table.email),
  ]
);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = typeof emailVerifications.$inferInsert;


// ============================================================================
// Refresh Token — Access/Refresh 분리 + 회전 + 블랙리스트 (Step 6-b 에서 사용)
// ============================================================================
export const refreshTokens = pgTable(
  "refreshTokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    revokedReason: varchar("revokedReason", { length: 40 }).$type<
      "rotation" | "logout" | "reuse_detected" | "admin"
    >(),
    replacedBy: integer("replacedBy"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("refreshTokens_userId_idx").on(table.userId)]
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

// ============================================================================
// 감사 로그
// ============================================================================
export const auditLog = pgTable(
  "auditLog",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    action: varchar("action", { length: 60 }).notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("auditLog_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("auditLog_action_createdAt_idx").on(table.action, table.createdAt),
  ]
);

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ============================================================================
// 모집 게시글
// ============================================================================

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("authorId").notNull(),
  groupId: integer("groupId"), // 연동된 그룹 ID (동아리, 학회, 스터디용)
  category: varchar("category", { length: 50 })
    .$type<"동아리" | "학회" | "스터디">()
    .notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  capacity: integer("capacity").notNull().default(10),
  deadline: timestamp("deadline"),
  keywords: text("keywords"),
  formSchema: jsonb("formSchema"),
  imageUrl: text("imageUrl"),
  hasInterview: integer("hasInterview").default(0).notNull(),
  meetingType: varchar("meetingType", { length: 50 })
    .$type<"온라인" | "오프라인" | "온오프라인" | "미정">()
    .default("미정")
    .notNull(),
  status: varchar("status", { length: 20 })
    .$type<"모집중" | "마감">()
    .default("모집중")
    .notNull(),
  viewCount: integer("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// ============================================================================
// 댓글
// ============================================================================
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull(),
  authorId: integer("authorId").notNull(),
  parentId: integer("parentId"),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// ============================================================================
// 좋아요 / 북마크
// ============================================================================
export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  postId: integer("postId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  postId: integer("postId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// 신청
// ============================================================================
export const applications = pgTable(
  "applications",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId").notNull(),
    applicantId: integer("applicantId").notNull(),
    introduction: text("introduction"),
    answers: jsonb("answers"),
    status: varchar("status", { length: 20 })
      .$type<"대기중" | "1차합격" | "수락" | "거절">()
      .default("대기중")
      .notNull(),
    rejectReason: text("rejectReason"),
    interviewDetails: text("interviewDetails"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("unique_application").on(table.postId, table.applicantId),
  ]
);

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

// ============================================================================
// 쪽지
// ============================================================================
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  postId: integer("postId"),
  content: text("content").notNull(),
  isRead: integer("isRead").$type<0 | 1>().default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
// ============================================================================
// 신고 (Reports)
// ============================================================================
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporterId").notNull(),
  targetType: varchar("targetType", { length: 20 })
    .$type<"post" | "user" | "comment" | "message">()
    .notNull(),
  targetId: integer("targetId").notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 })
    .$type<"pending" | "resolved" | "dismissed">()
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ============================================================================
// 사용자 차단 (Blocks)
// ============================================================================
export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blockerId").notNull(),
    blockedId: integer("blockedId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("unique_block").on(table.blockerId, table.blockedId)]
);

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = typeof blocks.$inferInsert;

// ============================================================================
// 캘린더 일정 (Calendar Events)
// ============================================================================
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("userId"), // null 이면 전체 공개 학사일정/공휴일, 값이 있으면 개인 일정
  groupId: integer("groupId"), // 그룹 일정일 경우 그룹 ID 매핑
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  category: varchar("category", { length: 50 })
    .$type<"academic" | "personal" | "holiday" | "group" | "recruitment">()
    .notNull(),
  isPrivate: integer("isPrivate").default(0).notNull(), // 0: 공개일정, 1: 비밀일정 (운영진 열람 권한 필수)
  hasRsvp: integer("hasRsvp").default(0).notNull(), // 0: 비활성, 1: 활성
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// 그룹 일정 참석 여부 (RSVP)
export const eventRsvps = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull(),
  userId: integer("userId").notNull(),
  status: varchar("status", { length: 20 }).$type<"attending" | "absent" | "maybe">().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("unique_event_rsvp").on(table.eventId, table.userId)
]);

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = typeof eventRsvps.$inferInsert;

// 일정 카테고리별 테마 커스텀 색상
export const userCalendarThemes = pgTable("user_calendar_themes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
}, (table) => [
  uniqueIndex("unique_user_calendar_theme").on(table.userId, table.category)
]);

export type UserCalendarTheme = typeof userCalendarThemes.$inferSelect;
export type InsertUserCalendarTheme = typeof userCalendarThemes.$inferInsert;

// 캘린더 날짜별 투두(Todo)
export const calendarTodos = pgTable("calendar_todos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // "YYYY-MM-DD" 포맷
  content: text("content").notNull(),
  isCompleted: integer("isCompleted").default(0).notNull(), // 0: 미완료, 1: 완료
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CalendarTodo = typeof calendarTodos.$inferSelect;
export type InsertCalendarTodo = typeof calendarTodos.$inferInsert;

// ============================================================================
// 그룹 마스터 (동아리, 스터디, 프로젝트 등)
// ============================================================================
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  leaderId: integer("leaderId").notNull(), // 리더 사용자의 ID
  accessKey: varchar("accessKey", { length: 64 }).notNull().unique(), // 그룹 전용 입장 고유 키
  isArchived: integer("isArchived").default(0).notNull(), // 0: 활성, 1: 아카이브 완료
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;

// ============================================================================
// 그룹 지위/역할 권한 관리
// ============================================================================
export const groupRoles = pgTable("group_roles", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  canManageSchedule: integer("canManageSchedule").default(0).notNull(), // 0: 불가능, 1: 가능
  canManageNotice: integer("canManageNotice").default(0).notNull(), // 0: 불가능, 1: 가능
  canViewPrivateEvent: integer("canViewPrivateEvent").default(0).notNull(), // 0: 불가능, 1: 가능
  canManageTimeVote: integer("canManageTimeVote").default(0).notNull(), // 0: 불가능, 1: 가능
  canCreateStudy: integer("canCreateStudy").default(0).notNull(), // 0: 불가능, 1: 가능
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GroupRole = typeof groupRoles.$inferSelect;
export type InsertGroupRole = typeof groupRoles.$inferInsert;

// ============================================================================
// 그룹 멤버십 (그룹 가입 매핑)
// ============================================================================
export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  groupId: integer("groupId").notNull(),
  roleId: integer("roleId"), // group_roles.id 외래키 (Null 이면 일반 멤버)
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = typeof groupMembers.$inferInsert;

// ============================================================================
// 그룹 공지사항 (Announcements)
// ============================================================================
export const groupAnnouncements = pgTable("group_announcements", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull(),
  authorId: integer("authorId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GroupAnnouncement = typeof groupAnnouncements.$inferSelect;
export type InsertGroupAnnouncement = typeof groupAnnouncements.$inferInsert;

// ============================================================================
// 그룹 단톡 대화방 메시지 (Group Chat Messages)
// ============================================================================
export const groupChatMessages = pgTable("group_chat_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull(),
  senderId: integer("senderId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GroupChatMessage = typeof groupChatMessages.$inferSelect;
export type InsertGroupChatMessage = typeof groupChatMessages.$inferInsert;

// ============================================================================
// 알림 (Notifications)
// ============================================================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  link: varchar("link", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notifications_userId_idx").on(table.userId)
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// 그룹 자료실 파일 (Group Files)
// ============================================================================
export const groupFiles = pgTable("group_files", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull(),
  uploaderId: integer("uploaderId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  fileType: varchar("fileType", { length: 100 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("group_files_groupId_idx").on(table.groupId)
]);

export type GroupFile = typeof groupFiles.$inferSelect;
export type InsertGroupFile = typeof groupFiles.$inferInsert;

// ============================================================================
// 그룹 아카이브/포트폴리오 (Group Archives)
// ============================================================================
export const groupArchives = pgTable("group_archives", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  content: text("content").notNull(),
  memberCount: integer("memberCount").notNull(),
  period: varchar("period", { length: 100 }).notNull(),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GroupArchive = typeof groupArchives.$inferSelect;
export type InsertGroupArchive = typeof groupArchives.$inferInsert;

// ============================================================================
// 그룹 내 하위 스터디/소모임 (Group Sub-Studies)
// ============================================================================
export const groupStudies = pgTable("group_studies", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull(),
  leaderId: integer("leaderId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("group_studies_groupId_idx").on(table.groupId)
]);

export type GroupStudy = typeof groupStudies.$inferSelect;
export type InsertGroupStudy = typeof groupStudies.$inferInsert;

// ============================================================================
// 하위 스터디 멤버 (Sub-Study Members)
// ============================================================================
export const groupStudyMembers = pgTable("group_study_members", {
  id: serial("id").primaryKey(),
  studyId: integer("studyId").notNull(),
  userId: integer("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (table) => [
  index("group_study_members_studyId_idx").on(table.studyId)
]);

export type GroupStudyMember = typeof groupStudyMembers.$inferSelect;
export type InsertGroupStudyMember = typeof groupStudyMembers.$inferInsert;

// ============================================================================
// 하위 스터디 회의록 (Sub-Study Meeting Minutes)
// ============================================================================
export const groupStudyMinutes = pgTable("group_study_minutes", {
  id: serial("id").primaryKey(),
  studyId: integer("studyId").notNull(),
  authorId: integer("authorId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  meetingDate: timestamp("meetingDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("group_study_minutes_studyId_idx").on(table.studyId)
]);

export type GroupStudyMinute = typeof groupStudyMinutes.$inferSelect;
export type InsertGroupStudyMinute = typeof groupStudyMinutes.$inferInsert;

// ============================================================================
// 모임 시간 조율 투표 (Meeting Time Polls)
// ============================================================================
export const meetingTimePolls = pgTable("meeting_time_polls", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId"), // 상위 그룹 ID (optional)
  studyId: integer("studyId"), // 하위 스터디 ID (optional)
  title: varchar("title", { length: 200 }).notNull(),
  dates: jsonb("dates").$type<string[]>().notNull(), // 선택할 날짜 목록 (e.g. ["2026-06-15", "2026-06-16"])
  timeRangeStart: varchar("timeRangeStart", { length: 5 }).default("09:00").notNull(),
  timeRangeEnd: varchar("timeRangeEnd", { length: 5 }).default("22:00").notNull(),
  status: varchar("status", { length: 20 }).$type<"open" | "closed">().default("open").notNull(),
  creatorId: integer("creatorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("meeting_time_polls_groupId_idx").on(table.groupId),
  index("meeting_time_polls_studyId_idx").on(table.studyId)
]);

export type MeetingTimePoll = typeof meetingTimePolls.$inferSelect;
export type InsertMeetingTimePoll = typeof meetingTimePolls.$inferInsert;

// ============================================================================
// 모임 시간 조율 응답 (Meeting Time Responses)
// ============================================================================
export const meetingTimeResponses = pgTable("meeting_time_responses", {
  id: serial("id").primaryKey(),
  pollId: integer("pollId").notNull(),
  userId: integer("userId").notNull(),
  userName: varchar("userName", { length: 50 }).notNull(),
  availability: jsonb("availability").$type<Record<string, string[]>>().notNull(), // 날짜별 가용 시간 배열 (e.g. {"2026-06-15": ["09:00", "09:30"]})
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("meeting_time_responses_pollId_idx").on(table.pollId),
  index("meeting_time_responses_userId_idx").on(table.userId)
]);

export type MeetingTimeResponse = typeof meetingTimeResponses.$inferSelect;
export type InsertMeetingTimeResponse = typeof meetingTimeResponses.$inferInsert;

