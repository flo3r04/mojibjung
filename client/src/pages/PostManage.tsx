import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  List,
  Calendar,
  GripVertical,
  Kanban,
} from "lucide-react";
import { DndContext, useDroppable, useDraggable, useSensor, useSensors, PointerSensor, TouchSensor, DragEndEvent } from "@dnd-kit/core";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { FormQuestion } from "./PostForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";


const COLORS = [
  "#0ea5e9",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
];

export default function PostManage() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"list" | "stats">("list");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [rejectAppId, setRejectAppId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [interviewAppId, setInterviewAppId] = useState<number | null>(null);
  const [interviewDetails, setInterviewDetails] = useState("");


  const { data: postData, isLoading: postLoading } = trpc.post.get.useQuery(
    { id: postId },
    { enabled: !!postId }
  );
  const { data: appData, isLoading: appLoading } =
    trpc.application.listByPost.useQuery({ postId }, { enabled: !!postId });

  const utils = trpc.useUtils();
  const updateStatusMutation = trpc.application.updateStatus.useMutation({
    onSuccess: () => {
      utils.application.listByPost.invalidate({ postId });
      setRejectAppId(null);
      setRejectReason("");
      setInterviewAppId(null);
      setInterviewDetails("");
      toast.success("상태가 업데이트되었습니다.");
    },
    onError: err => toast.error(err.message),
  });



  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const appLinkId = parseInt(active.id as string);
    const targetStatus = over.id as "대기중" | "1차합격" | "수락" | "거절";

    const app = appData?.find(a => a.application.id === appLinkId);
    if (!app) return;

    const currentStatus = app.application.status;
    if (currentStatus === targetStatus) return;

    if (targetStatus === "거절") {
      setRejectAppId(appLinkId);
      setRejectReason(app.application.rejectReason || "");
    } else if (targetStatus === "1차합격") {
      if (postData?.post.hasInterview === 1) {
        setInterviewAppId(appLinkId);
        setInterviewDetails("");
      } else {
        updateStatusMutation.mutate({
          applicationId: appLinkId,
          status: "수락",
        });
      }
    } else if (targetStatus === "수락") {
      updateStatusMutation.mutate({
        applicationId: appLinkId,
        status: "수락",
      });
    } else if (targetStatus === "대기중") {
      updateStatusMutation.mutate({
        applicationId: appLinkId,
        status: "대기중",
      });
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectAppId) return;
    updateStatusMutation.mutate({
      applicationId: rejectAppId,
      status: "거절",
      rejectReason,
    });
  };

  const handleInterviewSubmit = () => {
    if (!interviewAppId) return;
    updateStatusMutation.mutate({
      applicationId: interviewAppId,
      status: "1차합격",
      interviewDetails,
    });
  };

  const isAuthor = user?.id === postData?.post.authorId;
  const isAdmin = user?.role === "admin";
  const canManage = isAuthor || isAdmin;

  // 통계 데이터 계산
  const stats = useMemo(() => {
    if (!appData || !postData?.post.formSchema) return null;

    const schema = postData.post.formSchema as FormQuestion[];
    const selectQuestions = schema.filter(q => q.type === "select");

    // 지원 상태 통계
    const statusCount = {
      대기중: appData.filter(a => a.application.status === "대기중").length,
      "1차합격": appData.filter(a => a.application.status === "1차합격").length,
      수락: appData.filter(a => a.application.status === "수락").length,
      거절: appData.filter(a => a.application.status === "거절").length,
    };

    const statusData = [
      { name: "대기중", value: statusCount.대기중, color: "#eab308" },
      { name: "1차합격", value: statusCount["1차합격"], color: "#8b5cf6" },
      { name: "수락", value: statusCount.수락, color: "#22c55e" },
      { name: "거절", value: statusCount.거절, color: "#ef4444" },
    ].filter(d => d.value > 0);

    // 객관식 질문 답변 통계
    const answersStats: Record<
      string,
      { name: string; data: { name: string; count: number }[] }
    > = {};

    selectQuestions.forEach(q => {
      const counts: Record<string, number> = {};
      q.options?.forEach(opt => (counts[opt] = 0));

      appData.forEach(({ application }) => {
        const ans = (application.answers as Record<string, string>)?.[q.id];
        if (ans && counts[ans] !== undefined) {
          counts[ans]++;
        } else if (ans) {
          counts[ans] = 1;
        }
      });

      answersStats[q.id] = {
        name: q.question,
        data: Object.entries(counts).map(([name, count]) => ({ name, count })),
      };
    });

    return { statusData, statusCount, answersStats };
  }, [appData, postData]);

  if (postLoading || appLoading) {
    return (
      <Layout>
        <div className="container py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!canManage || !postData) {
    return (
      <Layout>
        <div className="container py-12 text-center text-muted-foreground">
          접근 권한이 없습니다.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link href={`/post/${postId}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 mb-4 text-muted-foreground hover:text-foreground p-0"
                >
                  <ArrowLeft className="w-4 h-4" /> 모집 글 돌아가기
                </Button>
              </Link>
              <h1 className="text-3xl font-black text-foreground mb-2">
                지원자 관리 대시보드
              </h1>
              <p className="text-muted-foreground font-medium">
                "{postData.post.title}" 모집 현황
              </p>
            </div>

            <div className="flex bg-muted/50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("list")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-4 h-4" /> 지원자 목록
              </button>
              <button
                onClick={() => setActiveTab("stats")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "stats" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BarChart3 className="w-4 h-4" /> 지원 통계
              </button>

            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-muted-foreground">
                <Users className="w-5 h-5 text-blue-500" />{" "}
                <span className="font-bold text-sm">총 지원자</span>
              </div>
              <p className="text-3xl font-black">
                {appData?.length || 0}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  명
                </span>
              </p>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-muted-foreground">
                <Clock className="w-5 h-5 text-amber-500" />{" "}
                <span className="font-bold text-sm">대기중</span>
              </div>
              <p className="text-3xl font-black">
                {stats?.statusCount.대기중 || 0}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  명
                </span>
              </p>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-muted-foreground">
                <Calendar className="w-5 h-5 text-purple-500" />{" "}
                <span className="font-bold text-sm">1차합격</span>
              </div>
              <p className="text-3xl font-black">
                {stats?.statusCount["1차합격"] || 0}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  명
                </span>
              </p>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-green-500" />{" "}
                <span className="font-bold text-sm">수락 (최종)</span>
              </div>
              <p className="text-3xl font-black">
                {stats?.statusCount.수락 || 0}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  명
                </span>
              </p>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-muted-foreground">
                <XCircle className="w-5 h-5 text-red-500" />{" "}
                <span className="font-bold text-sm">거절</span>
              </div>
              <p className="text-3xl font-black">
                {stats?.statusCount.거절 || 0}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  명
                </span>
              </p>
            </div>
          </div>

          {activeTab === "list" && (
            <div className="flex justify-end mb-6 gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="font-bold gap-1.5 rounded-xl px-4"
              >
                <List className="w-4 h-4" /> 리스트 뷰
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="font-bold gap-1.5 rounded-xl px-4"
              >
                <Kanban className="w-4 h-4" /> 칸반 보드
              </Button>
            </div>
          )}

          {activeTab === "list" && viewMode === "list" && (
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-6 py-4 font-bold text-sm text-muted-foreground w-32">
                        이름
                      </th>
                      <th className="px-6 py-4 font-bold text-sm text-muted-foreground w-32">
                        상태
                      </th>
                      <th className="px-6 py-4 font-bold text-sm text-muted-foreground">
                        지원 내용
                      </th>
                      <th className="px-6 py-4 font-bold text-sm text-muted-foreground w-40">
                        지원일
                      </th>
                      <th className="px-6 py-4 font-bold text-sm text-muted-foreground w-48 text-center">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appData?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-muted-foreground"
                        >
                          지원자가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      appData?.map(({ application, applicantName }) => (
                        <tr
                          key={application.id}
                          className="hover:bg-muted/10 transition-colors"
                        >
                          <td className="px-6 py-5 font-bold">
                            {applicantName || "익명"}
                          </td>
                          <td className="px-6 py-5">
                            <Badge
                              className={`font-bold ${
                                application.status === "수락"
                                  ? "bg-green-500 hover:bg-green-600 text-white"
                                  : application.status === "거절"
                                    ? "bg-red-500 hover:bg-red-600 text-white"
                                    : application.status === "1차합격"
                                      ? "bg-purple-500 hover:bg-purple-600 text-white"
                                      : "bg-amber-500 hover:bg-amber-600 text-white"
                              }`}
                            >
                              {application.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-5">
                            {application.answers ? (
                              <div className="space-y-3">
                                {Object.entries(
                                  application.answers as Record<string, string>
                                ).map(([qId, ans]) => {
                                  const q = (
                                    postData.post.formSchema as FormQuestion[]
                                  )?.find(x => x.id === qId);
                                  return (
                                    <div
                                      key={qId}
                                      className="bg-muted/30 p-3 rounded-xl"
                                    >
                                      <p className="text-[11px] text-muted-foreground font-bold mb-1">
                                        Q. {q?.question || "질문"}
                                      </p>
                                      <p className="text-sm font-medium">
                                        {ans}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm font-medium">
                                {application.introduction}
                              </p>
                            )}
                            {application.status === "거절" &&
                              application.rejectReason && (
                                <div className="mt-3 bg-red-50/50 p-3 rounded-xl border border-red-100">
                                  <p className="text-[11px] text-red-600 font-bold mb-1">
                                    작성한 거절 코멘트
                                  </p>
                                  <p className="text-sm text-red-700 font-medium">
                                    {application.rejectReason}
                                  </p>
                                </div>
                              )}
                            {application.status === "1차합격" &&
                              (application as any).interviewDetails && (
                                <div className="mt-3 bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                                  <p className="text-[11px] text-purple-600 font-bold mb-1">
                                    안내된 면접 일정 및 안내 사항
                                  </p>
                                  <p className="text-sm text-purple-700 font-medium whitespace-pre-wrap">
                                    {(application as any).interviewDetails}
                                  </p>
                                </div>
                              )}
                          </td>
                          <td className="px-6 py-5 text-sm text-muted-foreground font-medium">
                            {new Date(application.createdAt).toLocaleDateString(
                              "ko-KR"
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex gap-2 justify-center flex-wrap">
                              {application.status === "대기중" &&
                                postData.post.hasInterview === 1 && (
                                  <Button
                                    size="sm"
                                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold"
                                    onClick={() => {
                                      setInterviewAppId(application.id);
                                      setInterviewDetails("");
                                    }}
                                  >
                                    1차합격
                                  </Button>
                                )}
                              {((application.status === "대기중" &&
                                postData.post.hasInterview === 0) ||
                                application.status === "1차합격") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="font-bold hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      applicationId: application.id,
                                      status: "수락",
                                    })
                                  }
                                >
                                  {application.status === "1차합격"
                                    ? "최종수락"
                                    : "수락"}
                                </Button>
                              )}
                              {application.status !== "거절" &&
                                application.status !== "수락" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                    onClick={() => {
                                      setRejectAppId(application.id);
                                      setRejectReason(
                                        application.rejectReason || ""
                                      );
                                    }}
                                  >
                                    거절
                                  </Button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "list" && viewMode === "kanban" && (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DroppableColumn id="대기중" title="대기중" color="#eab308">
                  {appData?.filter(a => a.application.status === "대기중").map(({ application, applicantName }) => (
                    <DraggableCard
                      key={application.id}
                      id={application.id.toString()}
                      name={applicantName || "익명"}
                      date={new Date(application.createdAt).toLocaleDateString("ko-KR")}
                      status={application.status}
                      answers={application.answers}
                      introduction={application.introduction}
                      postSchema={postData.post.formSchema}
                      onRejectClick={() => {
                        setRejectAppId(application.id);
                        setRejectReason(application.rejectReason || "");
                      }}
                      onAcceptClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "수락",
                        });
                      }}
                      onInterviewClick={() => {
                        setInterviewAppId(application.id);
                        setInterviewDetails("");
                      }}
                      onResetToPendingClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "대기중",
                        });
                      }}
                    />
                  ))}
                </DroppableColumn>

                <DroppableColumn id="1차합격" title="1차합격" color="#8b5cf6">
                  {appData?.filter(a => a.application.status === "1차합격").map(({ application, applicantName }) => (
                    <DraggableCard
                      key={application.id}
                      id={application.id.toString()}
                      name={applicantName || "익명"}
                      date={new Date(application.createdAt).toLocaleDateString("ko-KR")}
                      status={application.status}
                      answers={application.answers}
                      introduction={application.introduction}
                      postSchema={postData.post.formSchema}
                      onRejectClick={() => {
                        setRejectAppId(application.id);
                        setRejectReason(application.rejectReason || "");
                      }}
                      onAcceptClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "수락",
                        });
                      }}
                      onInterviewClick={() => {
                        setInterviewAppId(application.id);
                        setInterviewDetails("");
                      }}
                      onResetToPendingClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "대기중",
                        });
                      }}
                    />
                  ))}
                </DroppableColumn>

                <DroppableColumn id="수락" title="수락 (최종)" color="#22c55e">
                  {appData?.filter(a => a.application.status === "수락").map(({ application, applicantName }) => (
                    <DraggableCard
                      key={application.id}
                      id={application.id.toString()}
                      name={applicantName || "익명"}
                      date={new Date(application.createdAt).toLocaleDateString("ko-KR")}
                      status={application.status}
                      answers={application.answers}
                      introduction={application.introduction}
                      postSchema={postData.post.formSchema}
                      onRejectClick={() => {
                        setRejectAppId(application.id);
                        setRejectReason(application.rejectReason || "");
                      }}
                      onAcceptClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "수락",
                        });
                      }}
                      onInterviewClick={() => {
                        setInterviewAppId(application.id);
                        setInterviewDetails("");
                      }}
                      onResetToPendingClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "대기중",
                        });
                      }}
                    />
                  ))}
                </DroppableColumn>

                <DroppableColumn id="거절" title="거절" color="#ef4444">
                  {appData?.filter(a => a.application.status === "거절").map(({ application, applicantName }) => (
                    <DraggableCard
                      key={application.id}
                      id={application.id.toString()}
                      name={applicantName || "익명"}
                      date={new Date(application.createdAt).toLocaleDateString("ko-KR")}
                      status={application.status}
                      answers={application.answers}
                      introduction={application.introduction}
                      postSchema={postData.post.formSchema}
                      onRejectClick={() => {
                        setRejectAppId(application.id);
                        setRejectReason(application.rejectReason || "");
                      }}
                      onAcceptClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "수락",
                        });
                      }}
                      onInterviewClick={() => {
                        setInterviewAppId(application.id);
                        setInterviewDetails("");
                      }}
                      onResetToPendingClick={() => {
                        updateStatusMutation.mutate({
                          applicationId: application.id,
                          status: "대기중",
                        });
                      }}
                    />
                  ))}
                </DroppableColumn>
              </div>
            </DndContext>
          )}

          {activeTab === "stats" && stats && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 진행 상태 차트 */}
                <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col h-[400px]">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> 지원 진행
                    상태
                  </h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            fontWeight: "bold",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontWeight: "bold",
                            fontSize: "14px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 첫 번째 객관식 질문 (있다면) 차트 */}
                {Object.values(stats.answersStats)
                  .slice(0, 1)
                  .map((stat, i) => (
                    <div
                      key={i}
                      className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col h-[400px]"
                    >
                      <h3
                        className="font-bold text-lg mb-6 line-clamp-1"
                        title={stat.name}
                      >
                        Q. {stat.name}
                      </h3>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={stat.data}
                            layout="vertical"
                            margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              horizontal={false}
                              stroke="#e5e7eb"
                            />
                            <XAxis
                              type="number"
                              allowDecimals={false}
                              stroke="#9ca3af"
                              fontSize={12}
                              fontWeight="bold"
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={100}
                              stroke="#9ca3af"
                              fontSize={12}
                              fontWeight="bold"
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(0,0,0,0.05)" }}
                              contentStyle={{
                                borderRadius: "12px",
                                fontWeight: "bold",
                                border: "none",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              }}
                            />
                            <Bar
                              dataKey="count"
                              name="인원수"
                              fill="#3b82f6"
                              radius={[0, 4, 4, 0]}
                              barSize={32}
                            >
                              {stat.data.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
              </div>

              {/* 나머지 객관식 질문들 차트 */}
              {Object.values(stats.answersStats).slice(1).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {Object.values(stats.answersStats)
                    .slice(1)
                    .map((stat, i) => (
                      <div
                        key={i}
                        className="bg-card rounded-3xl p-6 border border-border shadow-sm h-[350px] flex flex-col"
                      >
                        <h3
                          className="font-bold text-base mb-4 line-clamp-2 leading-snug"
                          title={stat.name}
                        >
                          Q. {stat.name}
                        </h3>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stat.data.filter(d => d.count > 0)}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="count"
                                nameKey="name"
                                labelLine={false}
                              >
                                {stat.data
                                  .filter(d => d.count > 0)
                                  .map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  borderRadius: "12px",
                                  fontWeight: "bold",
                                  border: "none",
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                              />
                              <Legend
                                wrapperStyle={{
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {Object.keys(stats.answersStats).length === 0 && (
                <div className="bg-muted/30 border border-dashed rounded-3xl p-12 text-center text-muted-foreground">
                  객관식 형태의 질문이 없어 답변 통계 그래프를 표시할 수
                  없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!rejectAppId}
        onOpenChange={open => !open && setRejectAppId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지원 거절 사유 작성</DialogTitle>
            <DialogDescription>
              지원자에게 전달될 거절 사유를 작성해주세요. (선택사항)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="거절 사유를 입력하세요..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="mt-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectAppId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={updateStatusMutation.isPending}
            >
              거절 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!interviewAppId}
        onOpenChange={open => !open && setInterviewAppId(null)}
      >
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-xl">
              1차 서류 합격 및 면접 안내
            </DialogTitle>
            <DialogDescription className="font-medium text-sm">
              지원자에게 전달될 면접 일정 및 상세 안내 사항을 작성해 주세요.
              (마이페이지에 실시간으로 표시됩니다)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="예: 
- 면접 일시: 2026년 6월 1일 14:00
- 면접 장소: 학생회관 301호 (또는 Zoom 온라인 링크)
- 준비물: 포트폴리오
- 연락처: 010-XXXX-XXXX"
            value={interviewDetails}
            onChange={e => setInterviewDetails(e.target.value)}
            rows={7}
            className="mt-4 resize-none rounded-xl p-3 border-border"
          />
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setInterviewAppId(null)}
            >
              취소
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-6"
              onClick={handleInterviewSubmit}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "처리 중..." : "1차 합격 처리"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// ============================================================================
// DND 칸반 보드 서브 컴포넌트들
// ============================================================================

interface DroppableColumnProps {
  id: string;
  title: string;
  color: string;
  children: React.ReactNode;
}

function DroppableColumn({ id, title, color, children }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/30 rounded-3xl p-4 border transition-colors flex flex-col min-h-[450px] ${
        isOver ? "border-primary bg-primary/[0.02] ring-1 ring-primary/20" : "border-border/60"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h4 className="font-extrabold text-sm text-foreground">{title}</h4>
      </div>
      <div className="flex flex-col gap-3 flex-1">
        {children}
      </div>
    </div>
  );
}

interface DraggableCardProps {
  id: string;
  name: string;
  date: string;
  status: string;
  answers?: any;
  introduction?: string | null;
  postSchema?: any;
  onRejectClick: () => void;
  onAcceptClick: () => void;
  onInterviewClick: () => void;
  onResetToPendingClick: () => void;
}

function DraggableCard({
  id,
  name,
  date,
  status,
  answers,
  introduction,
  postSchema,
  onRejectClick,
  onAcceptClick,
  onInterviewClick,
  onResetToPendingClick,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border/80 rounded-2xl p-4 shadow-xs select-none transition-shadow ${
        isDragging ? "opacity-50 cursor-grabbing shadow-lg" : "hover:shadow-md cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* Drag Handle Area */}
      <div {...listeners} {...attributes} className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 text-muted-foreground/60 hover:text-muted-foreground">
        <span className="text-[10px] font-bold tracking-wider">{date}</span>
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h5 className="font-black text-sm text-foreground truncate">{name}</h5>
          <Badge className={`text-[9px] px-1.5 py-0.2 font-bold shrink-0 ${
            status === "수락" ? "bg-green-500 hover:bg-green-600 text-white" :
            status === "거절" ? "bg-red-500 hover:bg-red-600 text-white" :
            status === "1차합격" ? "bg-purple-500 hover:bg-purple-600 text-white" :
            "bg-amber-500 hover:bg-amber-600 text-white"
          }`}>
            {status}
          </Badge>
        </div>

        {/* Preview details */}
        {answers ? (
          <div className="space-y-1.5 max-h-[80px] overflow-y-auto pr-1">
            {Object.entries(answers as Record<string, string>).slice(0, 1).map(([qId, ans]) => {
              const q = postSchema?.find((x: any) => x.id === qId);
              return (
                <div key={qId} className="bg-muted/40 p-1.5 rounded-lg text-[10.5px]">
                  <p className="text-[9px] text-muted-foreground font-extrabold truncate">Q. {q?.question || "질문"}</p>
                  <p className="font-medium truncate">{ans}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {introduction}
          </p>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/40">
          {status !== "대기중" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResetToPendingClick();
              }}
              className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-md transition-colors border-0 cursor-pointer"
            >
              대기중으로
            </button>
          )}
          {status !== "수락" && status !== "거절" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRejectClick();
              }}
              className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors border-0 cursor-pointer"
            >
              거절
            </button>
          )}
          {status === "대기중" && postSchema && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInterviewClick();
              }}
              className="text-[10px] font-bold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded-md transition-colors border-0 cursor-pointer"
            >
              1차합격
            </button>
          )}
          {(status === "대기중" || status === "1차합격") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAcceptClick();
              }}
              className="text-[10px] font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded-md transition-colors border-0 cursor-pointer"
            >
              수락
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
