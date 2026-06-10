import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  LayoutDashboard,
  PenSquare,
  ClipboardList,
  ArrowRight,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Tag,
  ShieldCheck,
  Bookmark,
  Heart,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  대기중: {
    label: "대기중",
    icon: Clock,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  "1차합격": {
    label: "1차 서류 합격",
    icon: Calendar,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  수락: {
    label: "수락됨",
    icon: CheckCircle,
    color: "text-green-600 bg-green-50 border-green-200",
  },
  거절: {
    label: "거절됨",
    icon: XCircle,
    color: "text-red-500 bg-red-50 border-red-200",
  },
};

const CATEGORY_STYLES: Record<string, string> = {
  동아리: "bg-blue-100 text-blue-700",
  학회: "bg-teal-100 text-teal-700",
  스터디: "bg-pink-100 text-pink-700",
};

type Tab = "posts" | "applications" | "bookmarks";

export default function MyPage() {
  const { user, isAuthenticated, isVerified } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  // 학과명 표시용 (departments 마스터 1회 조회)
  const { data: departments } = trpc.department.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const departmentName =
    user?.departmentId && departments
      ? (departments.find(d => d.id === user.departmentId)?.name ?? null)
      : null;

  const { data: myPosts, isLoading: postsLoading } = trpc.post.myPosts.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    }
  );

  const { data: myApplications, isLoading: appsLoading } =
    trpc.application.listByUser.useQuery(undefined, {
      enabled: isAuthenticated,
      refetchInterval: 30000,
    });

  const { data: myBookmarks, isLoading: bookmarksLoading } =
    trpc.post.myBookmarks.useQuery(undefined, {
      enabled: isAuthenticated,
    });

  const utils = trpc.useUtils();



  const toggleBookmarkMutation = trpc.post.toggleBookmark.useMutation({
    onMutate: () => {
      const toastId = toast.loading("처리 중...");
      return { toastId };
    },
    onSuccess: (data, variables, context) => {
      toast.dismiss(context?.toastId);
      utils.post.myBookmarks.invalidate();
      utils.post.get.invalidate({ id: variables.postId });
      utils.post.list.invalidate();
      if (data.bookmarked) {
        toast.success("북마크에 추가되었습니다.");
      } else {
        toast.success("북마크가 해제되었습니다.");
      }
    },
    onError: (err, variables, context) => {
      toast.dismiss(context?.toastId);
      toast.error(err.message || "오류가 발생했습니다.");
    },
  });

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>
            로그인하기
          </Button>
        </div>
      </Layout>
    );
  }

  const validApplications = myApplications?.filter(a => a.post) ?? [];
  const pendingCount = validApplications.filter(
    a => a.application.status === "대기중"
  ).length;

  const renderPostCard = (data: any, showStats = false) => {
    // 중첩된 구조(data.post)와 평면 구조(data) 모두 대응 가능하도록 처리
    const post = data.post || data;
    const authorName = data.authorName || "익명";
    const likeCount = Number(data.likeCount || 0);
    const commentCount = Number(data.commentCount || 0);
    const viewCount = Number(post.viewCount || 0);

    const deadlineDate = post.deadline ? new Date(post.deadline) : null;
    const isExpired = deadlineDate ? deadlineDate < new Date() : false;
    const displayStatus = isExpired ? "마감" : post.status;

    return (
      <div key={post.id} className="relative group">
        {/* 북마크 해제 버튼 (저장한 글 탭에서만 표시) */}
        {activeTab === "bookmarks" && (
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              toggleBookmarkMutation.mutate({ postId: post.id });
            }}
            className="absolute top-3 right-12 w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center border-2 border-white shadow-sm hover:bg-amber-200 hover:scale-110 transition-all z-[100] cursor-pointer"
            title="북마크 해제"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        )}

        <Link href={`/post/${post.id}`} className="block no-underline">
          <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all">
            <div className="flex gap-4">
              {post.imageUrl && (
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-border">
                  <img
                    src={post.imageUrl}
                    className="w-full h-full object-cover"
                    alt={post.title}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CATEGORY_STYLES[post.category] || "bg-gray-100 text-gray-600"}`}
                  >
                    {post.category}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${displayStatus === "모집중" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}
                  >
                    {displayStatus}
                  </span>
                </div>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                  {post.title}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                      {data.authorAvatarUrl ? (
                        <img
                          src={data.authorAvatarUrl}
                          className="w-full h-full object-cover"
                          alt={authorName}
                        />
                      ) : (
                        <Users className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <span>{authorName}</span>
                  </div>
                  <span className="mx-1 opacity-20">|</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                      {likeCount}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors self-center">
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <LayoutDashboard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">
                마이페이지
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-muted-foreground font-medium text-sm">
                  {user?.realName ?? user?.name}님의 커뮤니티 활동
                </p>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" />
                    학교 인증 완료
                  </span>
                )}
              </div>
              {(user?.studentId || departmentName || user?.admissionYear) && (
                <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                  {departmentName && <span>{departmentName}</span>}
                  {departmentName &&
                    (user?.studentId || user?.admissionYear) && (
                      <span className="mx-1 opacity-40">·</span>
                    )}
                  {user?.studentId && <span>{user.studentId}</span>}
                  {user?.studentId && user?.admissionYear && (
                    <span className="mx-1 opacity-40">·</span>
                  )}
                  {user?.admissionYear && <span>{user.admissionYear}학번</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/blocks">
              <Button
                variant="outline"
                size="sm"
                className="font-bold rounded-xl px-4 h-11 border-border"
              >
                차단 관리
              </Button>
            </Link>
            <Link href="/profile">
              <Button
                variant="outline"
                size="sm"
                className="font-bold rounded-xl px-4 h-11 border-border"
              >
                프로필 설정
              </Button>
            </Link>
            <Link href="/post/new">
              <Button
                size="sm"
                className="gap-2 font-black rounded-xl px-6 h-11 shadow-lg shadow-primary/10"
              >
                <PenSquare className="w-4 h-4" /> 모집 글 작성
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-wider mb-1 opacity-60">
              작성한 글
            </p>
            <p className="text-3xl font-black text-foreground">
              {myPosts?.length ?? 0}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-wider mb-1 opacity-60">
              신청한 모집
            </p>
            <p className="text-3xl font-black text-foreground">
              {validApplications.length}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-wider mb-1 opacity-60">
              저장한 글
            </p>
            <p className="text-3xl font-black text-foreground">
              {myBookmarks?.length ?? 0}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-wider mb-1 opacity-60">
              대기 중
            </p>
            <p className="text-3xl font-black text-primary">{pendingCount}</p>
          </div>
        </div>

        <div className="flex gap-1 bg-muted/50 rounded-2xl p-1.5 mb-8 w-fit border border-border/50">
          {[
            {
              id: "posts",
              label: "내 모집 글",
              icon: PenSquare,
              count: myPosts?.length,
            },
            {
              id: "applications",
              label: "신청 현황",
              icon: ClipboardList,
              count: pendingCount,
              highlight: true,
            },
            {
              id: "bookmarks",
              label: "저장한 글",
              icon: Bookmark,
              count: myBookmarks?.length,
            },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-md ring-1 ring-black/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${tab.highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="min-h-[400px]">
          {activeTab === "posts" && (
            <div className="space-y-4">
              {postsLoading ? (
                [...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-28 bg-muted/50 rounded-2xl animate-pulse"
                  />
                ))
              ) : myPosts && myPosts.length > 0 ? (
                myPosts.map(p => renderPostCard(p, true))
              ) : (
                <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
                  <PenSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-muted-foreground">
                    작성한 모집 글이 없습니다
                  </p>
                  <Link href="/post/new">
                    <Button className="mt-4 rounded-xl font-bold" size="sm">
                      첫 글 작성하기
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === "applications" && (
            <div className="space-y-4">
              {appsLoading ? (
                [...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-28 bg-muted/50 rounded-2xl animate-pulse"
                  />
                ))
              ) : validApplications.length > 0 ? (
                validApplications.map(({ application, post }) => {
                  if (!post) return null; // validApplications 필터로 이미 truthy 지만 TS 추론을 위해
                  const statusConfig = STATUS_CONFIG[application.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <Link
                      key={application.id}
                      href={`/post/${post.id}`}
                      className="block no-underline group"
                    >
                      <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-all">
                        <div className="flex gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_STYLES[post.category]}`}
                              >
                                {post.category}
                              </span>
                              <span
                                className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${statusConfig.color}`}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>


                            </div>
                            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {post.title}
                            </h3>
                            {application.status === "거절" &&
                              application.rejectReason && (
                                <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                                  사유: {application.rejectReason}
                                </p>
                              )}
                            {application.status === "1차합격" && (
                              <div className="mt-3 bg-purple-50 p-4 rounded-xl border border-purple-100 text-left">
                                <p className="text-[11px] text-purple-700 font-black mb-1.5 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" /> 면접 안내
                                  사항
                                </p>
                                <p className="text-xs text-purple-900 font-semibold whitespace-pre-wrap leading-relaxed">
                                  {(application as any).interviewDetails ||
                                    "면접 상세 일정을 곧 안내해 드립니다."}
                                </p>
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                              {new Date(
                                application.createdAt
                              ).toLocaleDateString("ko-KR")}{" "}
                              신청
                            </p>

                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors mt-1" />
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-muted-foreground">
                    신청한 모집이 없습니다
                  </p>
                  <Link href="/board">
                    <Button className="mt-4 rounded-xl font-bold" size="sm">
                      모집 보러가기
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === "bookmarks" && (
            <div className="space-y-4">
              {bookmarksLoading ? (
                [...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-28 bg-muted/50 rounded-2xl animate-pulse"
                  />
                ))
              ) : myBookmarks && myBookmarks.length > 0 ? (
                myBookmarks.map(p => renderPostCard(p, true))
              ) : (
                <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
                  <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-muted-foreground">
                    저장한 글이 없습니다
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    관심 있는 게시글의 북마크 아이콘을 눌러보세요!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
