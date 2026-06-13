import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import MessageModal from "@/components/MessageModal";
import ReportDialog from "@/components/ReportDialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  Tag,
  Eye,
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  ClipboardList,
  MessageSquare,
  Heart,
  Bookmark,
  Reply,
  MoreVertical,
} from "lucide-react";
import { Link } from "wouter";

const formatDateRange = (startStr: string | Date, endStr: string | Date) => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];

  const startFormat = `${start.getMonth() + 1}월 ${start.getDate()}일 (${days[start.getDay()]}) ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;

  const isSameDay = start.toDateString() === end.toDateString();
  const endFormat = isSameDay
    ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
    : `${end.getMonth() + 1}월 ${end.getDate()}일 (${days[end.getDay()]}) ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

  return `${startFormat} ~ ${endFormat}`;
};

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();


  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [introduction, setIntroduction] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(
    null
  );
  const [reportTarget, setReportTarget] = useState<{
    type: "post" | "user" | "comment" | "message";
    id: number;
  } | null>(null);

  // Queries
  const { data, isLoading, error } = trpc.post.get.useQuery(
    { id: postId },
    { enabled: !!postId }
  );

  // 연동된 그룹 일정 조회
  const { data: groupEvents = [] } = trpc.group.listEvents.useQuery(
    { groupId: data?.post?.groupId as number },
    { enabled: !!data?.post?.groupId }
  );

  // 조회수 증가 (마운트 시 1회 호출)
  const incrementViewMutation = trpc.post.incrementView.useMutation();
  const incrementedRef = useRef(false);

  useEffect(() => {
    if (postId && !incrementedRef.current) {
      incrementViewMutation.mutate(
        { id: postId },
        {
          onSuccess: () => {
            utils.post.get.invalidate({ id: postId });
          },
        }
      );
      incrementedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const { data: myApplication } = trpc.application.checkMyApplication.useQuery(
    { postId },
    { enabled: isAuthenticated && !!postId, refetchInterval: 30000 }
  );

  const { data: applicationList } = trpc.application.listByPost.useQuery(
    { postId },
    {
      enabled:
        isAuthenticated &&
        (data?.post.authorId === user?.id || user?.role === "admin"),
    }
  );

  const { data: commentList, isLoading: commentsLoading } =
    trpc.comment.list.useQuery({ postId });



  // Mutations
  const applyMutation = trpc.application.submit.useMutation({
    onSuccess: () => {
      toast.success("신청이 완료되었습니다!");
      setApplyDialogOpen(false);
      setIntroduction("");
      setAnswers({});

      utils.application.checkMyApplication.invalidate({ postId });
    },
    onError: err => {
      toast.error(err.message || "신청에 실패했습니다.");
      setApplyDialogOpen(false);
    },
  });

  const handleApply = () => {
    if (data?.post.formSchema) {
      const schema = data.post.formSchema as any[];
      const missing = schema.find(q => q.required && !answers[q.id]?.trim());
      if (missing) {
        toast.error(`"${missing.question}" 항목은 필수입니다.`);
        return;
      }
      applyMutation.mutate({
        postId,
        introduction: "자체 폼 지원서 제출",
        answers,
      });
    } else {
      applyMutation.mutate({
        postId,
        introduction: introduction || undefined,
      });
    }
  };

  const deleteMutation = trpc.post.delete.useMutation({
    onSuccess: () => {
      toast.success("게시글이 삭제되었습니다.");
      navigate("/board");
    },
    onError: () => toast.error("삭제에 실패했습니다."),
  });

  const updateStatusMutation = trpc.application.updateStatus.useMutation({
    onSuccess: updated => {
      toast.success(`신청을 ${updated?.status}했습니다.`);
      utils.application.listByPost.invalidate({ postId });
    },
    onError: () => toast.error("처리에 실패했습니다."),
  });

  const toggleLikeMutation = trpc.post.toggleLike.useMutation({
    onSuccess: () => utils.post.get.invalidate({ id: postId }),
    onError: err => toast.error(err.message),
  });

  const toggleBookmarkMutation = trpc.post.toggleBookmark.useMutation({
    onSuccess: () => {
      utils.post.get.invalidate({ id: postId });
      utils.calendar.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const createCommentMutation = trpc.comment.create.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ postId });
      setCommentContent("");
      setReplyTo(null);
      toast.success("댓글이 등록되었습니다.");
    },
  });

  const deleteCommentMutation = trpc.comment.delete.useMutation({
    onSuccess: () => utils.comment.list.invalidate({ postId }),
  });

  const blockMutation = trpc.block.block.useMutation({
    onSuccess: () => {
      toast.success("사용자가 차단되었습니다.");
      utils.post.list.invalidate();
      utils.comment.list.invalidate({ postId });
      navigate("/board");
    },
    onError: err => toast.error(err.message),
  });

  const handleBlockUser = (userId: number) => {
    if (
      confirm(
        "이 사용자를 차단하시겠습니까? 차단하면 이 사용자의 글과 댓글이 더 이상 보이지 않습니다."
      )
    ) {
      blockMutation.mutate({ blockedId: userId });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-12">
          <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded w-3/4" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">게시글을 찾을 수 없습니다.</p>
          <Link href="/board">
            <Button className="mt-4">게시판으로 돌아가기</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const {
    post,
    authorName,
    authorKeywords,
    authorAvatarUrl,
    likeCount,
    bookmarkCount,
    isLiked,
    isBookmarked,
  } = data;
  const isAuthor = user?.id === post.authorId;
  const isAdmin = user?.role === "admin";
  const canManage = isAuthor || isAdmin;

  const handleAddToCalendar = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    toggleBookmarkMutation.mutate(
      { postId },
      {
        onSuccess: () => {
          if (isBookmarked) {
            toast.success("캘린더에서 마감 일정이 제거되었습니다.");
          } else {
            toast.success("내 캘린더에 마감 일정이 성공적으로 추가되었습니다!");
          }
        },
      }
    );
  };

  const now = new Date();
  const deadlineDate = post.deadline ? new Date(post.deadline) : null;
  const isExpired = deadlineDate ? deadlineDate < now : false;

  let displayStatus: "모집중" | "마감" | "마감임박" = isExpired
    ? "마감"
    : post.status;
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  if (displayStatus === "모집중" && deadlineDate) {
    const diff = deadlineDate.getTime() - now.getTime();
    if (diff > 0 && diff <= SIX_HOURS) {
      displayStatus = "마감임박";
    }
  }

  const statusColors: Record<string, string> = {
    모집중: "bg-green-100 text-green-700 border-green-200",
    마감임박: "bg-amber-100 text-amber-700 border-amber-200",
    마감: "bg-gray-100 text-gray-500 border-gray-200",
  };

  let parsedKeywords: string[] = [];
  try {
    parsedKeywords = JSON.parse(post.keywords ?? "[]");
  } catch {
    /* ignore */
  }

  let parsedAuthorKeywords: string[] = [];
  try {
    parsedAuthorKeywords = JSON.parse((authorKeywords as string) ?? "[]");
  } catch {
    /* ignore */
  }

  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-6xl mx-auto">
          {/* 1. 상단 내비게이션 */}
          <Link href="/board">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 mb-8 text-muted-foreground hover:text-foreground p-0"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-base font-medium">전체 목록으로</span>
            </Button>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* 2. 좌측 메인 섹션 */}
            <div className="lg:col-span-2 space-y-10">
              {/* 제목 및 헤더 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full border ${statusColors[displayStatus]}`}
                    >
                      {displayStatus}
                    </span>
                  </div>
                  {isAuthenticated && !isAuthor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setReportTarget({ type: "post", id: post.id })
                      }
                    >
                      게시글 신고
                    </Button>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-foreground mb-6 leading-tight">
                  {post.title}
                </h1>

                <div className="flex items-center justify-between py-4 border-b border-border">
                  <Link href={`/user/${post.authorId}`}>
                    <div className="flex items-center gap-3 cursor-pointer group/author hover:opacity-80 transition-opacity">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary overflow-hidden border border-primary/20">
                        {authorAvatarUrl ? (
                          <img
                            src={authorAvatarUrl}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (authorName?.[0] ?? "U")
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-foreground leading-none mb-1 group-hover/author:text-primary transition-colors">
                          {authorName ?? "익명"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4 text-muted-foreground">
                    {isAuthenticated && !isAuthor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleBlockUser(post.authorId)}
                      >
                        차단하기
                      </Button>
                    )}
                    <button
                      onClick={() =>
                        isAuthenticated
                          ? toggleLikeMutation.mutate({ postId })
                          : (window.location.href = getLoginUrl())
                      }
                      className={`flex items-center gap-1.5 text-sm transition-all hover:scale-110 active:scale-95 ${isLiked ? "text-pink-500" : "hover:text-pink-500"}`}
                    >
                      <Heart
                        className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`}
                      />
                      <span className="font-bold">{likeCount}</span>
                    </button>
                    <button
                      onClick={() =>
                        isAuthenticated
                          ? toggleBookmarkMutation.mutate({ postId })
                          : (window.location.href = getLoginUrl())
                      }
                      className={`flex items-center gap-1.5 text-sm transition-all hover:scale-110 active:scale-95 ${isBookmarked ? "text-amber-500" : "hover:text-amber-500"}`}
                    >
                      <Bookmark
                        className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`}
                      />
                      <span className="font-bold">{bookmarkCount}</span>
                    </button>
                    <span className="flex items-center gap-1 text-sm">
                      <Eye className="w-4 h-4" />
                      {post.viewCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* 게시글 대표 이미지 */}
              {post.imageUrl && (
                <div className="rounded-3xl overflow-hidden border border-border shadow-sm bg-muted/20">
                  <img
                    src={post.imageUrl}
                    alt="대표 이미지"
                    className="w-full h-auto max-h-[600px] object-contain mx-auto"
                  />
                </div>
              )}

              {/* 본문 내용 */}
              <div>
                <h2 className="text-xl font-bold text-foreground mb-6">
                  프로젝트/스터디 소개
                </h2>
                <div className="prose prose-slate max-w-none text-foreground whitespace-pre-wrap leading-relaxed text-lg">
                  {post.content}
                </div>
              </div>

              {/* 연동된 그룹의 일정 표시 */}
              {post.groupId && (
                <div className="mt-8 pt-8 border-t border-border/60">
                  <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 rounded-3xl p-6 border border-emerald-500/10 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-lg text-foreground font-sans">
                            활동 예정 스케줄
                          </h3>
                          <p className="text-xs text-muted-foreground font-medium">
                            본 그룹의 리더가 일괄 등록한 활동 계획입니다.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold font-mono tracking-wider uppercase border border-emerald-500/20 shadow-sm animate-pulse">
                        LIVE SYNCED
                      </span>
                    </div>

                    {groupEvents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm font-medium bg-card/50 rounded-2xl border border-dashed">
                        등록된 활동 일정이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3 mt-4">
                        {groupEvents.map(evt => (
                          <div
                            key={evt.id}
                            className="bg-card hover:bg-card/80 transition-all border border-border/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm hover:shadow-md hover:scale-[1.005]"
                          >
                            <div className="space-y-1">
                              <h4 className="font-bold text-foreground text-base font-sans">
                                {evt.title}
                              </h4>
                              {evt.description && (
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-medium">
                                  {evt.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 text-muted-foreground text-xs font-semibold whitespace-nowrap self-start md:self-auto border border-border/40">
                              <Clock className="w-3.5 h-3.5 text-primary/70" />
                              <span>
                                {formatDateRange(evt.startDate, evt.endDate)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground/80 font-semibold mt-4 text-center">
                      💡 최종 합격 시 본 일정이 본인의 &apos;마이 캘린더&apos;로
                      자동 연동됩니다.
                    </p>
                  </div>
                </div>
              )}

              {/* 수정/삭제 버튼 */}
              {canManage && (
                <div className="flex gap-3 pt-6 border-t border-border/50">
                  <Link href={`/post/${post.id}/edit`} className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full gap-2 font-semibold h-12 rounded-xl border-primary/20 hover:bg-primary/5"
                    >
                      <Pencil className="w-4 h-4" /> 수정하기
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 text-destructive border-destructive/20 hover:bg-destructive/5 font-semibold h-12 rounded-xl"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" /> 삭제하기
                  </Button>
                </div>
              )}

              {/* 지원자 관리 대시보드 링크 (작성자 전용) */}
              {canManage && (
                <div className="mt-12 pt-12 border-t border-border">
                  <div className="bg-primary/5 rounded-3xl p-8 border border-primary/20 text-center flex flex-col items-center">
                    <ClipboardList className="w-12 h-12 text-primary mb-4" />
                    <h2 className="font-black text-2xl mb-2 text-foreground">
                      지원자 관리 대시보드
                    </h2>
                    <p className="text-muted-foreground font-medium mb-6">
                      지원자 통계를 확인하고 신청 내역을 관리할 수 있습니다.
                      (현재 지원자: {applicationList?.length || 0}명)
                    </p>
                    <Link href={`/post/${post.id}/manage`}>
                      <Button className="font-black text-base h-12 px-8 rounded-xl shadow-lg shadow-primary/20">
                        지원자 관리 및 통계 보기
                      </Button>
                    </Link>
                  </div>
                </div>
              )}



              {/* 댓글 섹션 */}
              <div className="mt-16 pt-12 border-t border-border">
                <h2 className="text-xl font-black mb-8 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-primary" />
                  댓글
                  <span className="text-sm bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-bold">
                    {commentList?.length ?? 0}
                  </span>
                </h2>

                {/* 댓글 작성 */}
                {isAuthenticated ? (
                  <div className="mb-10 space-y-3">
                    {replyTo && (
                      <div className="flex items-center justify-between bg-primary/5 px-4 py-2 rounded-xl border border-primary/20">
                        <span className="text-xs text-primary font-bold flex items-center gap-1.5">
                          <Reply className="w-3.5 h-3.5" /> {replyTo.name}님에게
                          답글 작성 중
                        </span>
                        <button
                          onClick={() => setReplyTo(null)}
                          className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-2"
                        >
                          취소
                        </button>
                      </div>
                    )}
                    <div className="relative group">
                      <Textarea
                        placeholder={
                          replyTo
                            ? "답글을 입력하세요..."
                            : "궁금한 점을 댓글로 남겨보세요!"
                        }
                        value={commentContent}
                        onChange={e => setCommentContent(e.target.value)}
                        className="min-h-[120px] rounded-2xl resize-none p-4 pr-16 border-border focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
                      />
                      <Button
                        size="sm"
                        className="absolute bottom-3 right-3 rounded-xl font-bold shadow-md"
                        disabled={
                          !commentContent.trim() ||
                          createCommentMutation.isPending
                        }
                        onClick={() =>
                          createCommentMutation.mutate({
                            postId,
                            content: commentContent,
                            parentId: replyTo?.id,
                          })
                        }
                      >
                        {createCommentMutation.isPending
                          ? "등록 중..."
                          : "등록"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-3xl p-10 text-center mb-10 border border-dashed border-border flex flex-col items-center">
                    <p className="text-sm text-muted-foreground mb-4 font-medium">
                      로그인 후 댓글을 남길 수 있습니다.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-bold rounded-xl px-6"
                      onClick={() => (window.location.href = getLoginUrl())}
                    >
                      로그인하기
                    </Button>
                  </div>
                )}

                {/* 댓글 리스트 */}
                <div className="space-y-8">
                  {commentsLoading ? (
                    <div className="animate-pulse space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-muted/50 rounded-2xl" />
                      ))}
                    </div>
                  ) : commentList && commentList.length > 0 ? (
                    commentList
                      .filter(c => !c.comment.parentId)
                      .map(
                        ({
                          comment,
                          authorName: cName,
                          authorAvatarUrl: cAvatar,
                        }) => (
                          <div key={comment.id} className="group">
                            <div className="flex gap-4">
                              <Link href={`/user/${comment.authorId}`}>
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 font-bold text-primary overflow-hidden border border-primary/5 cursor-pointer hover:opacity-80 transition-opacity">
                                  {cAvatar ? (
                                    <img
                                      src={cAvatar}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    (cName?.[0] ?? "U")
                                  )}
                                </div>
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <Link href={`/user/${comment.authorId}`}>
                                      <span className="font-bold text-[15px] text-foreground hover:text-primary transition-colors">
                                        {cName ?? "익명"}
                                      </span>
                                    </Link>
                                    <span className="text-[10px] text-muted-foreground font-medium opacity-70">
                                      {new Date(
                                        comment.createdAt
                                      ).toLocaleString("ko-KR")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-8 h-8 rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-primary"
                                      onClick={() =>
                                        setReplyTo({
                                          id: comment.id,
                                          name: cName ?? "익명",
                                        })
                                      }
                                    >
                                      <Reply className="w-4 h-4" />
                                    </Button>
                                    {(comment.authorId === user?.id ||
                                      isAdmin) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="w-8 h-8 rounded-lg hover:bg-destructive/5 text-muted-foreground hover:text-destructive"
                                        onClick={() =>
                                          deleteCommentMutation.mutate({
                                            id: comment.id,
                                          })
                                        }
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {isAuthenticated &&
                                      comment.authorId !== user?.id && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="w-8 h-8 rounded-lg hover:bg-destructive/5 text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            setReportTarget({
                                              type: "comment",
                                              id: comment.id,
                                            })
                                          }
                                          title="신고하기"
                                        >
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      )}
                                  </div>
                                </div>
                                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                                  {comment.content}
                                </p>

                                {/* 답글 리스트 */}
                                {commentList
                                  .filter(
                                    r => r.comment.parentId === comment.id
                                  )
                                  .map(
                                    ({
                                      comment: reply,
                                      authorName: rName,
                                      authorAvatarUrl: rAvatar,
                                    }) => (
                                      <div
                                        key={reply.id}
                                        className="mt-5 pl-5 border-l-2 border-primary/10 bg-primary/[0.01] py-2 rounded-r-xl"
                                      >
                                        <Link href={`/user/${reply.authorId}`}>
                                          <div className="flex gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 font-bold text-primary text-[10px] overflow-hidden">
                                              {rAvatar ? (
                                                <img
                                                  src={rAvatar}
                                                  className="w-full h-full object-cover"
                                                />
                                              ) : (
                                                (rName?.[0] ?? "U")
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-xs text-foreground/80 hover:text-primary transition-colors">
                                                    {rName ?? "익명"}
                                                  </span>
                                                  <span className="text-[10px] text-muted-foreground font-medium opacity-60">
                                                    {new Date(
                                                      reply.createdAt
                                                    ).toLocaleString("ko-KR")}
                                                  </span>
                                                </div>
                                                {(reply.authorId === user?.id ||
                                                  isAdmin) && (
                                                  <button
                                                    className="text-destructive text-[10px] font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                                                    onClick={e => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      deleteCommentMutation.mutate(
                                                        { id: reply.id }
                                                      );
                                                    }}
                                                  >
                                                    삭제
                                                  </button>
                                                )}
                                                {isAuthenticated &&
                                                  reply.authorId !==
                                                    user?.id && (
                                                    <button
                                                      className="text-destructive text-[10px] font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                                                      onClick={e => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setReportTarget({
                                                          type: "comment",
                                                          id: reply.id,
                                                        });
                                                      }}
                                                    >
                                                      신고
                                                    </button>
                                                  )}
                                              </div>
                                              <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                                                {reply.content}
                                              </p>
                                            </div>
                                          </div>
                                        </Link>
                                      </div>
                                    )
                                  )}
                              </div>
                            </div>
                          </div>
                        )
                      )
                  ) : (
                    <div className="text-center py-20 text-muted-foreground border border-dashed rounded-3xl bg-muted/[0.02]">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p className="text-sm font-medium">
                        아직 댓글이 없습니다. 첫 의견을 나눠보세요!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. 우측 사이드바 섹션 */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 space-y-6">
                <div className="bg-card rounded-3xl border border-border p-8 shadow-sm ring-1 ring-black/5 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />

                  <div className="grid grid-cols-2 gap-y-8 gap-x-4 mb-10 text-sm relative z-10">
                    <div>
                      <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 opacity-60">
                        모집 구분
                      </p>
                      <p className="font-black text-foreground text-base">
                        {post.category === "스터디" ? "프로젝트" : post.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 opacity-60">
                        진행 방식
                      </p>
                      <p className="font-black text-foreground text-base">
                        {(post as any).meetingType ?? "미정"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 opacity-60">
                        모집 인원
                      </p>
                      <p className="font-black text-foreground text-base">
                        {post.capacity}명
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 opacity-60">
                        마감 일정
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <p className="font-black text-foreground text-base">
                          {deadlineDate
                            ? `${deadlineDate.toLocaleDateString("ko-KR")} ${deadlineDate.getHours().toString().padStart(2, "0")}:${deadlineDate.getMinutes().toString().padStart(2, "0")}`
                            : "상시모집"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider mb-1.5 opacity-60">
                        가입 전형
                      </p>
                      <p className="font-black text-foreground text-base">
                        {(post as any).hasInterview === 1
                          ? "서류 + 면접"
                          : "서류"}
                      </p>
                    </div>
                  </div>

                  {/* 마이 캘린더 추가 버튼 — 마감일이 있을 때만 표시 */}
                  {deadlineDate && (
                    <div className="relative z-10 mb-6">
                      <button
                        onClick={() => {
                          handleAddToCalendar();
                          utils.calendar.list.invalidate();
                        }}
                        disabled={toggleBookmarkMutation.isPending}
                        className={`w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 px-5 font-bold text-sm border-2 transition-all duration-200 cursor-pointer select-none ${
                          isBookmarked
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                            : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>
                          {isBookmarked
                            ? "✓ 마이 캘린더 연동 완료 — 클릭 시 해제"
                            : "내 캘린더에 마감일 추가"}
                        </span>
                      </button>
                      {!isBookmarked && (
                        <p className="text-[10px] text-muted-foreground font-semibold text-center mt-1.5">
                          추가 시 마이 캘린더에 '모집 마감일'로 자동 등록됩니다.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mb-10 relative z-10">
                    <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-3 opacity-60">
                      관심 키워드
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedKeywords.map(kw => (
                        <span
                          key={kw}
                          className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-xl text-[11px] font-black border border-border/50 shadow-sm"
                        >
                          #{kw}
                        </span>
                      ))}
                      {parsedKeywords.length === 0 && (
                        <span className="text-xs text-muted-foreground italic font-medium">
                          키워드가 없습니다.
                        </span>
                      )}
                    </div>
                  </div>

                  {!isAuthor && (
                    <div className="space-y-4 relative z-10">
                      {myApplication ? (
                        <div
                          className={`w-full py-5 px-4 rounded-2xl border-2 text-center group ${
                            myApplication.status === "수락"
                              ? "bg-emerald-50/30 border-emerald-500/20 text-emerald-700"
                              : myApplication.status === "거절"
                                ? "bg-red-50/30 border-red-500/20 text-red-700"
                                : myApplication.status === "1차합격"
                                  ? "bg-purple-50/30 border-purple-500/20 text-purple-700"
                                  : "bg-amber-50/30 border-amber-500/20 text-amber-700"
                          }`}
                        >
                          {myApplication.status === "수락" ? (
                            <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2 animate-bounce" />
                          ) : myApplication.status === "거절" ? (
                            <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                          ) : myApplication.status === "1차합격" ? (
                            <Calendar className="w-6 h-6 text-purple-500 mx-auto mb-2 animate-pulse" />
                          ) : (
                            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2 animate-pulse" />
                          )}
                          <p className="font-black text-base">
                            {myApplication.status === "수락"
                              ? "신청이 수락되었습니다!"
                              : myApplication.status === "거절"
                                ? "신청이 거절되었습니다"
                                : myApplication.status === "1차합격"
                                  ? "1차 서류 합격!"
                                  : "신청 완료!"}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1 font-bold">
                            현재 상태: {myApplication.status}
                          </p>



                          {myApplication.status === "거절" &&
                            myApplication.rejectReason && (
                              <div className="mt-3 bg-red-50/80 p-3 rounded-xl border border-red-100 text-left">
                                <p className="text-[10px] text-red-600 font-black mb-1">
                                  거절 사유
                                </p>
                                <p className="text-xs text-red-700 font-medium whitespace-pre-wrap">
                                  {myApplication.rejectReason}
                                </p>
                              </div>
                            )}
                          {myApplication.status === "1차합격" && (
                            <div className="mt-3 bg-purple-50/80 p-3 rounded-xl border border-purple-100 text-left">
                              <p className="text-[10px] text-purple-600 font-black mb-1">
                                면접 일정 및 안내 사항
                              </p>
                              <p className="text-xs text-purple-700 font-medium whitespace-pre-wrap">
                                {(myApplication as any).interviewDetails ||
                                  "면접 상세 일정을 곧 안내해 드립니다."}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : displayStatus === "마감" ? (
                        <Button
                          disabled
                          className="w-full h-16 rounded-2xl text-lg font-black opacity-50 cursor-not-allowed"
                        >
                          모집 마감
                        </Button>
                      ) : (
                        <Button
                          className="w-full h-16 rounded-2xl text-lg font-black shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] bg-primary hover:bg-primary/90"
                          onClick={() =>
                            isAuthenticated
                              ? setApplyDialogOpen(true)
                              : (window.location.href = getLoginUrl())
                          }
                        >
                          지금 신청하기
                        </Button>
                      )}
                      {isAuthenticated && (
                        <Button
                          variant="outline"
                          className="w-full h-14 rounded-2xl font-black border-2 border-primary/10 text-primary hover:bg-primary/5 transition-all"
                          onClick={() => setMessageModalOpen(true)}
                        >
                          작성자에게 1:1 문의
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* 작성자 정보 카드 */}
                <Link href={`/user/${post.authorId}`}>
                  <div className="bg-card rounded-3xl p-6 flex items-center gap-4 border border-border shadow-sm group hover:border-primary/30 transition-all cursor-pointer">
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center font-black text-primary text-2xl flex-shrink-0 overflow-hidden border border-primary/10 shadow-inner">
                      {authorAvatarUrl ? (
                        <img
                          src={authorAvatarUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (authorName?.[0] ?? "U")
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter mb-0.5 opacity-60">
                        글쓴이
                      </p>
                      <p className="font-black text-foreground text-lg truncate mb-1 group-hover:text-primary transition-colors">
                        {authorName ?? "익명"}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {parsedAuthorKeywords.map(kw => (
                          <span
                            key={kw}
                            className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-lg border border-border/50 transition-colors group-hover:border-primary/20 group-hover:text-primary/70"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 섹션 */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              지원서 작성
            </DialogTitle>
            <DialogDescription className="font-medium">
              준비되셨나요?{" "}
              <span className="font-black text-primary">"{post.title}"</span>
              팀이 당신을 기다립니다!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">

            {post.formSchema ? (
              (post.formSchema as any[]).map((q, idx) => (
                <div key={q.id}>
                  <label className="text-sm font-black mb-3 block text-foreground/90 px-1">
                    <span className="text-primary mr-1">Q{idx + 1}.</span>{" "}
                    {q.question}{" "}
                    {q.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </label>
                  {q.type === "text" ? (
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={e =>
                        setAnswers({ ...answers, [q.id]: e.target.value })
                      }
                      placeholder="답변을 입력해주세요"
                      className="resize-none rounded-2xl border-border focus-visible:ring-primary/20 p-4 font-medium min-h-[100px]"
                      required={q.required}
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {q.options?.map((opt: string) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 text-sm font-medium cursor-pointer p-3 rounded-2xl border transition-colors ${answers[q.id] === opt ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"}`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={e =>
                              setAnswers({ ...answers, [q.id]: e.target.value })
                            }
                            className="w-4 h-4 text-primary focus:ring-primary accent-primary"
                            required={q.required}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div>
                <label className="text-sm font-black mb-3 block text-foreground/70 px-1">
                  자기소개 및 지원 동기
                </label>
                <Textarea
                  value={introduction}
                  onChange={e => setIntroduction(e.target.value)}
                  placeholder="간단한 인사와 함께 본인의 강점을 어필해보세요! (최대 300자)"
                  maxLength={300}
                  rows={5}
                  className="resize-none rounded-2xl border-border focus-visible:ring-primary/20 p-4 font-medium"
                />
                <p className="text-[11px] text-muted-foreground mt-2 text-right font-bold px-1">
                  {introduction.length}/300자
                </p>
              </div>
            )}

          </div>
          <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 pt-4 bg-background border-t border-border mt-4 pb-2">
            <Button
              variant="ghost"
              className="rounded-xl font-bold"
              onClick={() => setApplyDialogOpen(false)}
            >
              다음에 할게요
            </Button>
            <Button
              onClick={handleApply}
              disabled={applyMutation.isPending}
              className="font-black rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">
              정말 삭제하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-base">
              삭제된 글과 모든 신청 내역은 다시 되돌릴 수 없습니다. 신중하게
              선택해주세요!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: post.id })}
              className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-8"
            >
              삭제하겠습니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {messageModalOpen && (
        <MessageModal
          open={messageModalOpen}
          onOpenChange={open => {
            setMessageModalOpen(open);
            if (!open) setSelectedReceiver(null);
          }}
          receiverId={selectedReceiver?.id ?? post.authorId}
          receiverName={selectedReceiver?.name ?? authorName ?? "익명"}
          postId={post.id}
        />
      )}

      {reportTarget && (
        <ReportDialog
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
        />
      )}
    </Layout>
  );
}
