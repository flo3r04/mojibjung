import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Loader2, Trash2, ShieldAlert, CheckCircle, Ban, Key, Users, Calendar, Plus } from "lucide-react";
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

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "reports" | "groups">("users");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLeaderId, setNewGroupLeaderId] = useState<number>(0);

  // Redirect if not admin
  if (isAuthenticated && user?.role !== "admin") {
    navigate("/");
    return null;
  }

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin" && (activeTab === "users" || activeTab === "groups"),
  });

  const { data: reports, isLoading: reportsLoading } = trpc.admin.listReports.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin" && activeTab === "reports",
  });

  const { data: groupsData, isLoading: groupsLoading } = trpc.group.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin" && activeTab === "groups",
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("사용자가 삭제되었습니다.");
      setDeleteUserId(null);
      utils.admin.listUsers.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "삭제에 실패했습니다.");
      setDeleteUserId(null);
    },
  });

  const updateReportStatusMutation = trpc.admin.updateReportStatus.useMutation({
    onSuccess: () => {
      toast.success("신고 상태가 업데이트되었습니다.");
      utils.admin.listReports.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUserStatusMutation = trpc.admin.updateUserStatus.useMutation({
    onSuccess: () => {
      toast.success("사용자 상태가 업데이트되었습니다.");
      utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createGroupMutation = trpc.group.create.useMutation({
    onSuccess: () => {
      toast.success("그룹이 개설되었고 고유 키가 발급되었습니다!");
      setNewGroupName("");
      setNewGroupLeaderId(0);
      utils.group.listAll.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "그룹 생성에 실패했습니다.");
    },
  });

  const deleteGroupMutation = trpc.group.delete.useMutation({
    onSuccess: () => {
      toast.success("그룹이 삭제되었고 고유 키가 성공적으로 회수되었습니다!");
      utils.group.listAll.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "그룹 삭제 및 키 회수 중 오류가 발생했습니다.");
    },
  });
  return (
    <Layout>
      <div className="container py-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-black mb-8 text-foreground">관리자 대시보드</h1>
        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            className="rounded-xl font-bold font-sans transition-all hover:scale-[1.02]"
          >
            <Users className="w-4 h-4 mr-2" />
            가입 회원 관리
          </Button>
          <Button
            variant={activeTab === "reports" ? "default" : "outline"}
            onClick={() => setActiveTab("reports")}
            className="rounded-xl font-bold font-sans transition-all hover:scale-[1.02]"
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            신고 내역 관리
          </Button>
          <Button
            variant={activeTab === "groups" ? "default" : "outline"}
            onClick={() => setActiveTab("groups")}
            className="rounded-xl font-bold font-sans transition-all hover:scale-[1.02]"
          >
            <Key className="w-4 h-4 mr-2" />
            그룹 및 고유 키 관리
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-6 font-sans">
            {activeTab === "users" ? "가입 회원 관리" : activeTab === "reports" ? "신고 내역 관리" : "그룹 및 고유 키 관리"}
          </h2>
          {activeTab === "users" && (
            isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              가입된 회원이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>로그인 방식</TableHead>
                    <TableHead>권한</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell className="font-medium">{u.name ?? "익명"}</TableCell>
                      <TableCell>{u.email ?? "-"}</TableCell>
                      <TableCell>{u.loginMethod ?? "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            u.role === "admin"
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.id !== user?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setDeleteUserId(u.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            삭제
                          </Button>
                        )}
                        {u.status !== "disabled" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-600 border-amber-600/30 hover:bg-amber-600/10 ml-2"
                            onClick={() => updateUserStatusMutation.mutate({ userId: u.id, status: "disabled" })}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            정지
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600/30 hover:bg-green-600/10 ml-2"
                            onClick={() => updateUserStatusMutation.mutate({ userId: u.id, status: "verified" })}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            해제
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
          {activeTab === "reports" && (
            reportsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !reports || reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                접수된 신고 내역이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>신고 ID</TableHead>
                      <TableHead>신고자</TableHead>
                      <TableHead>타겟 종류</TableHead>
                      <TableHead>타겟 ID</TableHead>
                      <TableHead>신고 사유</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>일시</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.report.id}>
                        <TableCell>{r.report.id}</TableCell>
                        <TableCell className="font-medium">{r.reporterName ?? "익명"}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-md bg-secondary text-xs font-bold">
                            {r.report.targetType}
                          </span>
                        </TableCell>
                        <TableCell>{r.report.targetId}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={r.report.reason}>
                          {r.report.reason}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            r.report.status === "pending" ? "bg-amber-100 text-amber-700" :
                            r.report.status === "resolved" ? "bg-green-100 text-green-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {r.report.status}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(r.report.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {r.report.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-600/30 hover:bg-green-600/10 mr-2"
                                onClick={() => updateReportStatusMutation.mutate({ id: r.report.id, status: "resolved" })}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> 처리완료
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground border-muted hover:bg-muted"
                                onClick={() => updateReportStatusMutation.mutate({ id: r.report.id, status: "dismissed" })}
                              >
                                <ShieldAlert className="w-4 h-4 mr-1" /> 무시
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {activeTab === "groups" && (
            <div className="space-y-8">
              {/* 그룹 생성 폼 */}
              <div className="bg-muted/40 rounded-xl p-5 border border-border/60">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <Plus className="w-5 h-5 mr-2 text-primary" />
                  새로운 그룹 개설 및 고유 키 발급
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGroupName.trim()) {
                      toast.error("그룹명을 입력해주세요.");
                      return;
                    }
                    if (!newGroupLeaderId) {
                      toast.error("그룹 리더를 지정해주세요.");
                      return;
                    }
                    createGroupMutation.mutate({
                      name: newGroupName,
                      leaderId: newGroupLeaderId,
                    });
                  }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                >
                  <div className="space-y-2">
                    <Label htmlFor="group-name-input" className="font-bold">그룹명 (동아리/스터디/프로젝트명)</Label>
                    <Input
                      id="group-name-input"
                      placeholder="예: HUD 컴퓨터학회"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-leader-select" className="font-bold">그룹 리더 지정</Label>
                    <select
                      id="group-leader-select"
                      value={newGroupLeaderId || ""}
                      onChange={(e) => setNewGroupLeaderId(Number(e.target.value))}
                      className="w-full h-11 px-3 rounded-xl border border-input bg-card text-foreground font-semibold text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="">리더를 지정하세요</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email || "이메일 없음"}) [ID: {u.id}]
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground font-sans transition-all flex items-center justify-center"
                    disabled={createGroupMutation.isPending}
                  >
                    {createGroupMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    그룹 생성 및 키 발급
                  </Button>
                </form>
              </div>

              {/* 그룹 목록 조회 */}
              {groupsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !groupsData || groupsData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  등록된 그룹이 없습니다. 새로운 그룹을 개설해보세요.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/80 rounded-xl bg-card">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-bold">ID</TableHead>
                        <TableHead className="font-bold">그룹명</TableHead>
                        <TableHead className="font-bold">리더 (ID)</TableHead>
                        <TableHead className="font-bold">발급 고유 키 (Access Key)</TableHead>
                        <TableHead className="font-bold">생성 일시</TableHead>
                        <TableHead className="font-bold text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupsData.map((g) => (
                        <TableRow key={g.id} className="hover:bg-muted/10">
                          <TableCell className="font-medium text-muted-foreground">{g.id}</TableCell>
                          <TableCell className="font-bold text-foreground">{g.name}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-sm">{g.leaderName}</span>
                            <span className="text-[11px] text-muted-foreground block">ID: {g.leaderId}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-mono font-bold text-xs border border-primary/20">
                                {g.accessKey}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-primary rounded-lg transition-all"
                                onClick={() => {
                                  navigator.clipboard.writeText(g.accessKey);
                                  toast.success("고유 키가 클립보드에 복사되었습니다!");
                                }}
                              >
                                복사
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {new Date(g.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10 transition-all cursor-pointer font-bold"
                              onClick={() => {
                                if (confirm(`정말로 '${g.name}' 그룹을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 멤버 연동 및 그룹 일정이 삭제됩니다.`)) {
                                  deleteGroupMutation.mutate({ id: g.id });
                                }
                              }}
                              disabled={deleteGroupMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              삭제
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={deleteUserId !== null}
        onOpenChange={(open) => !open && setDeleteUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 취소할 수 없습니다. 사용자의 모든 정보가 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteUserId) deleteMutation.mutate({ userId: deleteUserId });
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
