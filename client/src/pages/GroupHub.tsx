import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Users,
  MessageSquare,
  Megaphone,
  Calendar,
  Settings,
  Shield,
  Plus,
  Trash2,
  Send,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Copy,
  Check,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Menu,
  X,
  FolderOpen,
  File,
  Download,
  UploadCloud,
  Archive,
  ListTodo,
  Notebook,
  Edit
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function GroupHub() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "calendar" | "members" | "files" | "studies">("chat");
  const [copiedKeyGroupId, setCopiedKeyGroupId] = useState<number | null>(null);

  // Group join access key
  const [joinAccessKey, setJoinAccessKey] = useState("");

  // Create group custom role state
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSchedule, setNewRoleSchedule] = useState(false);
  const [newRoleNotice, setNewRoleNotice] = useState(false);
  const [newRolePrivate, setNewRolePrivate] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  // New calendar event state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventIsPrivate, setEventIsPrivate] = useState(false);
  const [eventHasRsvp, setEventHasRsvp] = useState(false);

  // New notice/announcement state
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");

  // Group archiving state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [archiveSummary, setArchiveSummary] = useState("");
  const [archiveContent, setArchiveContent] = useState("");
  const [archivePeriod, setArchivePeriod] = useState("");
  const [archiveImageUrl, setArchiveImageUrl] = useState("");

  // Chat input state
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Responsive mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // TRPC Queries
  const { data: groups = [], isLoading: groupsLoading } = trpc.group.myJoinedGroups.useQuery();
  
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const { data: permissions } = trpc.group.checkPermissions.useQuery(
    { groupId: selectedGroupId ?? 0 },
    { enabled: !!selectedGroupId }
  );

  const { data: members = [] } = trpc.group.listMembers.useQuery(
    { groupId: selectedGroupId ?? 0 },
    { enabled: !!selectedGroupId && (permissions?.isLeader || user?.role === "admin") }
  );

  const { data: roles = [] } = trpc.group.listRoles.useQuery(
    { groupId: selectedGroupId ?? 0 },
    { enabled: !!selectedGroupId }
  );

  const { data: announcements = [] } = trpc.group.listAnnouncements.useQuery(
    { groupId: selectedGroupId ?? 0 },
    { enabled: !!selectedGroupId, refetchInterval: 10000 }
  );

  const { data: chatMessages = [] } = trpc.group.listChatMessages.useQuery(
    { groupId: selectedGroupId ?? 0 },
    { enabled: !!selectedGroupId, refetchInterval: 4000 } // Short-poll every 4s for chat feel
  );

  const { data: groupEvents = [] } = trpc.group.listEvents.useQuery(
    { groupId: selectedGroupId ?? 0 },
    { enabled: !!selectedGroupId }
  );

  // Scroll to chat bottom when messages arrive
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Mutations
  const joinGroupMutation = trpc.group.join.useMutation({
    onSuccess: (res) => {
      utils.group.myJoinedGroups.invalidate();
      setJoinAccessKey("");
      toast.success(`그룹 '${res.group.name}'에 연동되었습니다!`);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMemberMutation = trpc.group.removeMember.useMutation({
    onSuccess: () => {
      utils.group.listMembers.invalidate({ groupId: selectedGroupId ?? 0 });
      toast.success("멤버 연동이 해제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const createRoleMutation = trpc.group.createRole.useMutation({
    onSuccess: () => {
      utils.group.listRoles.invalidate({ groupId: selectedGroupId ?? 0 });
      setNewRoleName("");
      setNewRoleSchedule(false);
      setNewRoleNotice(false);
      setNewRolePrivate(false);
      setRoleModalOpen(false);
      toast.success("새 지위가 성공적으로 등록되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRoleMutation = trpc.group.deleteRole.useMutation({
    onSuccess: () => {
      utils.group.listRoles.invalidate({ groupId: selectedGroupId ?? 0 });
      utils.group.listMembers.invalidate({ groupId: selectedGroupId ?? 0 });
      toast.success("지위가 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignRoleMutation = trpc.group.assignRole.useMutation({
    onSuccess: () => {
      utils.group.listMembers.invalidate({ groupId: selectedGroupId ?? 0 });
      toast.success("지위가 정상적으로 부여되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const createEventMutation = trpc.group.createEvent.useMutation({
    onSuccess: () => {
      utils.group.listEvents.invalidate({ groupId: selectedGroupId ?? 0 });
      utils.calendar.list.invalidate(); // Invalidate main calendar cache too
      setEventTitle("");
      setEventDesc("");
      setEventStart("");
      setEventEnd("");
      setEventIsPrivate(false);
      setEventHasRsvp(false);
      setEventModalOpen(false);
      toast.success("그룹 일정이 성공적으로 등록되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteEventMutation = trpc.group.deleteEvent.useMutation({
    onSuccess: () => {
      utils.group.listEvents.invalidate({ groupId: selectedGroupId ?? 0 });
      utils.calendar.list.invalidate();
      toast.success("일정이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveGroupMutation = trpc.group.archive.useMutation({
    onSuccess: () => {
      utils.group.myJoinedGroups.invalidate();
      setArchiveModalOpen(false);
      toast.success("그룹 활동이 종료되고 아카이브 포트폴리오가 발행되었습니다!");
    },
    onError: (err) => toast.error(err.message),
  });

  const createAnnouncementMutation = trpc.group.createAnnouncement.useMutation({
    onSuccess: () => {
      utils.group.listAnnouncements.invalidate({ groupId: selectedGroupId ?? 0 });
      setNoticeTitle("");
      setNoticeContent("");
      setNoticeModalOpen(false);
      toast.success("새로운 공지사항이 등록되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAnnouncementMutation = trpc.group.deleteAnnouncement.useMutation({
    onSuccess: () => {
      utils.group.listAnnouncements.invalidate({ groupId: selectedGroupId ?? 0 });
      toast.success("공지사항이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendChatMessageMutation = trpc.group.sendChatMessage.useMutation({
    onSuccess: () => {
      setChatInput("");
      utils.group.listChatMessages.invalidate({ groupId: selectedGroupId ?? 0 });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinAccessKey.trim()) return;
    joinGroupMutation.mutate({ accessKey: joinAccessKey });
  };

  const handleCreateRoleSubmit = () => {
    if (!newRoleName.trim() || !selectedGroupId) return;
    const gid = selectedGroupId;
    createRoleMutation.mutate({
      groupId: gid,
      name: newRoleName.trim(),
      canManageSchedule: newRoleSchedule ? 1 : 0,
      canManageNotice: newRoleNotice ? 1 : 0,
      canViewPrivateEvent: newRolePrivate ? 1 : 0,
    });
  };

  const handleCreateEventSubmit = () => {
    if (!eventTitle.trim() || !eventStart || !eventEnd || !selectedGroupId) {
      toast.error("제목과 시작일, 종료일을 모두 입력해주세요.");
      return;
    }
    const gid = selectedGroupId;
    createEventMutation.mutate({
      groupId: gid,
      title: eventTitle.trim(),
      description: eventDesc.trim() || undefined,
      startDate: new Date(eventStart).toISOString(),
      endDate: new Date(eventEnd).toISOString(),
      isPrivate: eventIsPrivate ? 1 : 0,
      hasRsvp: eventHasRsvp ? 1 : 0,
    });
  };

  const handleCreateNoticeSubmit = () => {
    if (!noticeTitle.trim() || !noticeContent.trim() || !selectedGroupId) {
      toast.error("제목과 내용을 모두 입력해주세요.");
      return;
    }
    const gid = selectedGroupId;
    createAnnouncementMutation.mutate({
      groupId: gid,
      title: noticeTitle.trim(),
      content: noticeContent.trim(),
    });
  };

  const handleSendChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedGroupId) return;
    const gid = selectedGroupId;
    sendChatMessageMutation.mutate({
      groupId: gid,
      content: chatInput.trim(),
    });
  };

  const copyAccessKey = (gId: number, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyGroupId(gId);
    toast.success("그룹 고유 키가 클립보드에 복사되었습니다.");
    setTimeout(() => setCopiedKeyGroupId(null), 2000);
  };

  return (
    <Layout>
      <div className="container py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Users className="w-8 h-8 text-primary shrink-0" />
              그룹 소통 & 일정 허브
            </h1>
            <p className="text-muted-foreground font-medium text-sm mt-1">
              동아리, 학회, 스터디 등 소속 집단의 스케줄을 연동하고 실시간 단톡방에서 소통하세요.
            </p>
          </div>
          <button 
            className="md:hidden p-2 rounded-xl bg-muted/60 text-foreground border border-border"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[680px]">
          {/* Mobile Sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
              <div className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-card p-6 border-r border-border flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-black text-lg">내 연동 그룹</span>
                  <button 
                    className="p-1.5 rounded-lg bg-muted text-muted-foreground"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Mobile sidebar content */}
                <GroupSidebarSection
                  groups={groups}
                  selectedGroupId={selectedGroupId}
                  groupsLoading={groupsLoading}
                  onSelect={(id) => {
                    setSelectedGroupId(id);
                    setSidebarOpen(false);
                  }}
                  joinAccessKey={joinAccessKey}
                  setJoinAccessKey={setJoinAccessKey}
                  onJoin={handleJoinSubmit}
                  isJoining={joinGroupMutation.isPending}
                  copyAccessKey={copyAccessKey}
                  copiedKeyGroupId={copiedKeyGroupId}
                />
              </div>
            </div>
          )}

          {/* Desktop Sidebar (Left column) */}
          <div className="hidden md:flex flex-col gap-6 bg-card border border-border rounded-3xl p-5 shadow-sm h-[680px]">
            <h2 className="font-black text-lg text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              내 연동 그룹
            </h2>
            <div className="flex-1 overflow-y-auto pr-1">
              <GroupSidebarSection
                groups={groups}
                selectedGroupId={selectedGroupId}
                groupsLoading={groupsLoading}
                onSelect={setSelectedGroupId}
                joinAccessKey={joinAccessKey}
                setJoinAccessKey={setJoinAccessKey}
                onJoin={handleJoinSubmit}
                isJoining={joinGroupMutation.isPending}
                copyAccessKey={copyAccessKey}
                copiedKeyGroupId={copiedKeyGroupId}
              />
            </div>
          </div>

          {/* Main Dashboard (Right columns) */}
          <div className="md:col-span-3 flex flex-col bg-card border border-border rounded-3xl overflow-hidden shadow-sm h-[680px]">
            {selectedGroupId ? (
              selectedGroup ? (
                <>
                  {/* Selected Group Header */}
                  <div className="bg-muted/30 border-b border-border px-6 py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-black text-foreground">{selectedGroup.name}</h2>
                        {selectedGroup.isLeader ? (
                          <Badge variant="default" className="bg-primary hover:bg-primary text-white font-bold text-[10px] px-2 py-0.5 rounded-md">
                            리더
                          </Badge>
                        ) : selectedGroup.userRole ? (
                          <Badge variant="outline" className="border-primary/30 text-primary font-bold text-[10px] px-2 py-0.5 rounded-md bg-primary/5">
                            {selectedGroup.userRole}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-bold text-[10px] px-2 py-0.5 rounded-md">
                            일반 멤버
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span>그룹 리더: {selectedGroup.leaderName}</span>
                        <span>•</span>
                        <span>총 멤버: {selectedGroup.memberCount}명</span>
                      </p>
                    </div>

                    {/* Group Access key copy inside header (only visible to leader/admin) */}
                    {(selectedGroup.isLeader || user?.role === "admin") && (
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <div className="bg-muted/80 border border-border text-[11px] font-mono px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <span className="font-bold text-muted-foreground select-none">KEY:</span>
                          <span className="font-black text-foreground">{selectedGroup.accessKey}</span>
                        </div>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="w-8.5 h-8.5 rounded-lg text-muted-foreground"
                          onClick={() => copyAccessKey(selectedGroup.id, selectedGroup.accessKey)}
                        >
                          {copiedKeyGroupId === selectedGroup.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Dashboard Tab Buttons */}
                  <div className="flex border-b border-border bg-muted/10 px-4">
                    <button
                      onClick={() => setActiveTab("chat")}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${activeTab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <MessageSquare className="w-4.5 h-4.5" />
                      소통 창구 (대화/공지)
                    </button>
                    <button
                      onClick={() => setActiveTab("calendar")}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${activeTab === "calendar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <Calendar className="w-4.5 h-4.5" />
                      그룹 일정 관리
                    </button>
                    <button
                      onClick={() => setActiveTab("files")}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${activeTab === "files" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <FolderOpen className="w-4.5 h-4.5" />
                      자료실 (파일 공유)
                    </button>
                    <button
                      onClick={() => setActiveTab("studies")}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${activeTab === "studies" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <ListTodo className="w-4.5 h-4.5" />
                      소모임 / 스터디
                    </button>
                    {(selectedGroup.isLeader || user?.role === "admin") && (
                      <button
                        onClick={() => setActiveTab("members")}
                        className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${activeTab === "members" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        <Settings className="w-4.5 h-4.5" />
                        지위 및 멤버 관리
                      </button>
                    )}
                  </div>

                  {/* Tab Body */}
                  <div className="flex-1 min-h-0 bg-card overflow-hidden flex flex-col">
                    {activeTab === "chat" && (
                      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border min-h-0">
                        {/* 1. KakaoTalk-styled Chatroom */}
                        <div className="flex-1 flex flex-col min-h-0 bg-muted/5 relative">
                          <div className="absolute top-0 inset-x-0 bg-primary/5 px-4 py-2 border-b border-primary/10 text-xs font-bold text-primary flex items-center gap-1.5 z-10">
                            <Sparkles className="w-3.5 h-3.5" />
                            실시간 채팅 대화방
                          </div>
                          
                          {/* Chat history list */}
                          <div className="flex-1 overflow-y-auto px-5 pt-10 pb-5 space-y-4">
                            {chatMessages.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-center text-muted-foreground text-sm font-medium flex-col gap-2">
                                <MessageSquare className="w-8 h-8 opacity-30" />
                                아직 대화 내역이 없습니다.<br />첫 메시지를 보내 소통을 시작해보세요!
                              </div>
                            ) : (
                              chatMessages.map((msg) => {
                                const isSelf = msg.senderId === user?.id;
                                return (
                                  <div 
                                    key={msg.id} 
                                    className={`flex items-start gap-2.5 max-w-[85%] ${isSelf ? "ml-auto flex-row-reverse" : ""}`}
                                  >
                                    {!isSelf && (
                                      <Avatar className="w-8 h-8 shrink-0">
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                          {msg.senderRealName?.charAt(0) ?? msg.senderName?.charAt(0) ?? "U"}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    <div>
                                      {!isSelf && (
                                        <span className="text-[11px] font-bold text-muted-foreground ml-1.5">
                                          {msg.senderRealName ?? msg.senderName ?? "익명"}
                                        </span>
                                      )}
                                      <div className={`flex items-end gap-1.5 mt-0.5 ${isSelf ? "flex-row-reverse" : ""}`}>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${isSelf ? "bg-primary text-white rounded-tr-none" : "bg-card border border-border text-foreground rounded-tl-none shadow-sm"}`}>
                                          {msg.content}
                                        </div>
                                        <span className="text-[9px] font-bold text-muted-foreground shrink-0 select-none">
                                          {new Date(msg.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <div ref={chatBottomRef} />
                          </div>

                          {/* Chat Input form */}
                          <form onSubmit={handleSendChatSubmit} className="bg-card border-t border-border p-3 flex gap-2">
                            <Input
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="메시지를 입력하세요..."
                              className="rounded-xl flex-1 bg-muted/30 focus-visible:ring-primary font-medium"
                              maxLength={1000}
                              disabled={sendChatMessageMutation.isPending}
                            />
                            <Button 
                              type="submit" 
                              size="icon" 
                              className="rounded-xl px-3"
                              disabled={!chatInput.trim() || sendChatMessageMutation.isPending}
                            >
                              <Send className="w-4.5 h-4.5" />
                            </Button>
                          </form>
                        </div>

                        {/* 2. Announcement board */}
                        <div className="w-full md:w-80 flex flex-col min-h-0 bg-card">
                          <div className="px-4.5 py-3 bg-muted/10 border-b border-border flex items-center justify-between shrink-0">
                            <h3 className="font-black text-sm text-foreground flex items-center gap-1.5">
                              <Megaphone className="w-4 h-4 text-rose-500" />
                              공지사항
                            </h3>
                            {(permissions?.isLeader || permissions?.canManageNotice || user?.role === "admin") && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7.5 px-2 rounded-lg font-bold text-[11px] gap-1 text-primary hover:bg-primary/5"
                                onClick={() => setNoticeModalOpen(true)}
                              >
                                <Plus className="w-3.5 h-3.5" /> 공지 등록
                              </Button>
                            )}
                          </div>

                          <div className="flex-1 overflow-y-auto p-4.5 space-y-3.5">
                            {announcements.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-center text-muted-foreground text-xs font-bold py-12">
                                등록된 공지사항이 없습니다.
                              </div>
                            ) : (
                              announcements.map((notice) => (
                                <div key={notice.id} className="bg-muted/30 border border-border/80 rounded-2xl p-4.5 relative group/notice shadow-sm hover:border-primary/20 transition-all">
                                  <div className="flex justify-between items-start gap-2 mb-2">
                                    <h4 className="font-black text-sm text-foreground leading-snug line-clamp-2">
                                      {notice.title}
                                    </h4>
                                    {(permissions?.isLeader || permissions?.canManageNotice || user?.role === "admin") && (
                                      <button 
                                        className="p-1 rounded bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0 transition-colors opacity-0 group-hover/notice:opacity-100"
                                        onClick={() => deleteAnnouncementMutation.mutate({ groupId: selectedGroupId ?? 0, id: notice.id })}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground font-medium whitespace-pre-wrap leading-relaxed line-clamp-3 mb-3">
                                    {notice.content}
                                  </p>
                                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                      작성자: {notice.authorRealName ?? notice.authorName ?? "익명"}
                                    </span>
                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 select-none">
                                      <Clock className="w-3 h-3 text-muted-foreground" />
                                      {new Date(notice.createdAt).toLocaleDateString("ko-KR")}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === "calendar" && (
                      <div className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-primary shrink-0" />
                              스케줄 연동 리스트
                            </h3>
                            <p className="text-xs font-semibold text-muted-foreground mt-1">
                              해당 그룹에 등록된 일정을 모아봅니다. 모든 일정은 멤버 전원의 캘린더에 동기화됩니다.
                            </p>
                          </div>
                          {(permissions?.isLeader || permissions?.canManageSchedule || user?.role === "admin") && (
                            <Button 
                              size="sm" 
                              className="font-bold gap-1 rounded-xl shadow-md"
                              onClick={() => setEventOpenAndReset()}
                            >
                              <Plus className="w-4 h-4" /> 일정 등록
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {groupEvents.length === 0 ? (
                            <div className="col-span-full border border-dashed rounded-3xl p-12 text-center text-muted-foreground font-bold text-sm">
                              등록된 그룹 일정이 없습니다.
                            </div>
                          ) : (
                            groupEvents.map((evt) => (
                              <GroupEventCard
                                key={evt.id}
                                evt={evt}
                                permissions={permissions}
                                user={user}
                                onDelete={() => deleteEventMutation.mutate({ id: evt.id, groupId: selectedGroupId ?? 0 })}
                                selectedGroupId={selectedGroupId ?? 0}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === "members" && (selectedGroup?.isLeader || user?.role === "admin") && (
                      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border min-h-0 overflow-y-auto md:overflow-y-hidden">
                        
                        {/* Left half: Custom Roles Settings */}
                        <div className="flex-1 p-6 flex flex-col min-h-0 bg-card overflow-y-auto">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shrink-0">
                            <div className="max-w-[70%]">
                              <h3 className="font-black text-base text-foreground flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary shrink-0" />
                                커스텀 지위 정의
                              </h3>
                              <p className="text-xs font-semibold text-muted-foreground mt-1 break-keep" style={{ wordBreak: "keep-all" }}>
                                우리 집단만의 지위(역할)를 생성하고 그에 알맞은 권한들을 직접 분배합니다.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="font-bold border-primary text-primary hover:bg-primary/5 rounded-xl h-9.5 gap-1 shrink-0"
                                onClick={() => {
                                  setNewRoleName("");
                                  setNewRoleSchedule(false);
                                  setNewRoleNotice(false);
                                  setNewRolePrivate(false);
                                  setRoleModalOpen(true);
                                }}
                              >
                                <Plus className="w-4 h-4" /> 지위 생성
                              </Button>
                              {selectedGroup?.isArchived === 0 ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="font-bold rounded-xl h-9.5 gap-1 shrink-0 bg-rose-600 hover:bg-rose-700 text-white"
                                  onClick={() => {
                                    setArchiveTitle(selectedGroup?.name ? `${selectedGroup.name} 활동 아카이브` : "");
                                    setArchiveSummary("");
                                    setArchiveContent("");
                                    setArchivePeriod("2026.03 ~ 2026.06");
                                    setArchiveImageUrl("");
                                    setArchiveModalOpen(true);
                                  }}
                                >
                                  <Archive className="w-4 h-4" /> 그룹 종료 & 아카이브
                                </Button>
                              ) : (
                                <Badge variant="secondary" className="font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 bg-muted text-muted-foreground select-none">
                                  ✓ 아카이브 완료됨
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
                            {roles.length === 0 ? (
                              <div className="border border-dashed rounded-3xl p-12 text-center text-muted-foreground font-bold text-xs">
                                등록된 커스텀 지위가 없습니다.
                              </div>
                            ) : (
                              roles.map((role) => (
                                <div key={role.id} className="bg-muted/10 border border-border rounded-2xl p-4.5 shadow-sm relative group/role hover:border-primary/20 transition-all flex flex-col justify-between gap-3">
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-black text-sm text-foreground">{role.name}</h4>
                                    </div>
                                    <button 
                                      className="p-1 rounded bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0 transition-colors opacity-0 group-hover/role:opacity-100"
                                      onClick={() => deleteRoleMutation.mutate({ groupId: selectedGroupId ?? 0, roleId: role.id })}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  
                                  {/* Permissions Toggles inside Role Card */}
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant={role.canManageSchedule === 1 ? "default" : "secondary"} className="text-[10px] font-bold py-0.5 rounded flex items-center gap-1 select-none">
                                      {role.canManageSchedule === 1 ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3 opacity-40" />}
                                      일정작성 {role.canManageSchedule === 1 ? "허용" : "차단"}
                                    </Badge>
                                    <Badge variant={role.canManageNotice === 1 ? "default" : "secondary"} className="text-[10px] font-bold py-0.5 rounded flex items-center gap-1 select-none">
                                      {role.canManageNotice === 1 ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3 opacity-40" />}
                                      공지작성 {role.canManageNotice === 1 ? "허용" : "차단"}
                                    </Badge>
                                    <Badge variant={role.canViewPrivateEvent === 1 ? "default" : "secondary"} className="text-[10px] font-bold py-0.5 rounded flex items-center gap-1 select-none">
                                      {role.canViewPrivateEvent === 1 ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 opacity-40" />}
                                      비밀일정열람 {role.canViewPrivateEvent === 1 ? "허용" : "차단"}
                                    </Badge>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Right half: Member Management and role assignment */}
                        <div className="flex-1 p-6 flex flex-col min-h-0 bg-card overflow-y-auto">
                          <div className="mb-5 shrink-0">
                            <h3 className="font-black text-base text-foreground flex items-center gap-2">
                              <UserCheck className="w-5 h-5 text-primary shrink-0" />
                              지위 부여 및 연동 멤버 관리
                            </h3>
                            <p className="text-xs font-semibold text-muted-foreground mt-1 break-keep" style={{ wordBreak: "keep-all" }}>
                              연동 인원들의 지위를 커스텀 변경하거나, 원치 않는 인원의 연동 일정을 강제 해제합니다.
                            </p>
                          </div>

                          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                            {members.length === 0 ? (
                              <div className="border border-dashed rounded-3xl p-12 text-center text-muted-foreground font-bold text-xs">
                                연동된 멤버가 없습니다.
                              </div>
                            ) : (
                              // Filter out leader from assignments to avoid self modification
                              members.map((mb) => {
                                const isSelfLeader = mb.userId === selectedGroup.leaderId;
                                return (
                                  <div key={mb.membershipId} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 shrink-0">
                                      <Avatar className="w-9 h-9">
                                        <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                                          {mb.realName?.charAt(0) ?? mb.name?.charAt(0) ?? "M"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-black text-sm text-foreground">{mb.realName ?? mb.name ?? "익명"}</span>
                                          {isSelfLeader && (
                                            <Badge className="bg-primary text-white font-bold text-[9px] px-1 py-0.2 shrink-0">리더</Badge>
                                          )}
                                        </div>
                                        <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                          {mb.studentId ? `${mb.studentId.substring(2, 4)}학번` : "일반"} • {mb.roleName ?? "일반 멤버"}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Position Assign Select Box */}
                                      <select
                                        value={mb.roleId ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          assignRoleMutation.mutate({
                                            groupId: selectedGroupId ?? 0,
                                            userId: mb.userId,
                                            roleId: val ? parseInt(val) : null,
                                          });
                                        }}
                                        className="text-xs bg-muted/60 border border-border rounded-xl font-bold px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-28 shrink-0"
                                      >
                                        <option value="">일반 멤버</option>
                                        {roles.map((r) => (
                                          <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                      </select>

                                      {/* Kick/Unlink Button */}
                                      {!isSelfLeader && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8.5 w-8.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl shrink-0"
                                          onClick={() => removeMemberMutation.mutate({ groupId: selectedGroupId ?? 0, userId: mb.userId })}
                                          title="일정 연동 해제 (그룹 퇴출)"
                                        >
                                          <UserX className="w-4.5 h-4.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                    {activeTab === "files" && (
                      <div className="flex-1 p-6 overflow-y-auto bg-card">
                        <GroupFilesSection
                          groupId={selectedGroupId ?? 0}
                          isLeader={selectedGroup?.isLeader ?? false}
                          user={user}
                        />
                      </div>
                    )}

                    {activeTab === "studies" && (
                      <div className="flex-1 p-6 overflow-y-auto bg-card">
                        <GroupStudiesSection
                          groupId={selectedGroupId ?? 0}
                          isLeader={selectedGroup?.isLeader ?? false}
                          user={user}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8 text-muted-foreground text-sm font-semibold">
                  그룹 정보를 읽어올 수 없습니다.
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-muted/5 relative">
                <div className="max-w-md space-y-6">
                  <Logo size={80} variant="card" className="mx-auto" />
                  <div>
                    <h3 className="text-xl font-black text-foreground mb-2">선택된 그룹이 없습니다</h3>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                      좌측 메뉴에서 연동하고 싶은 그룹을 선택하거나,<br />
                      신규 그룹 코드를 입력하여 일정을 실시간 연동하세요!
                    </p>
                  </div>
                  
                  {/* Join Group Access Key Form for quick access inside main content when no group is selected */}
                  <form onSubmit={handleJoinSubmit} className="bg-card border border-border rounded-2xl p-5 shadow-sm max-w-sm mx-auto space-y-3.5">
                    <div className="text-left">
                      <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">
                        그룹 고유 입장 키 (KEY)
                      </label>
                      <Input
                        value={joinAccessKey}
                        onChange={(e) => setJoinAccessKey(e.target.value)}
                        placeholder="예: ABCD-EFGH-IJKL"
                        className="rounded-xl border-border bg-muted/20 font-black h-11 focus-visible:ring-primary text-center tracking-widest font-mono"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full font-black text-sm py-5 rounded-xl shadow-md"
                      disabled={!joinAccessKey.trim() || joinGroupMutation.isPending}
                    >
                      {joinGroupMutation.isPending ? "연동 처리 중..." : "그룹 신규 연동하기"}
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal 1: Create Custom Role */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Shield className="w-5.5 h-5.5 text-primary" />
              새로운 지위 생성
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              그룹에서 관리할 맞춤형 직위 명칭을 정하고 권한을 분배합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5.5 my-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground">지위 명칭 (역할 이름)</label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="예: 기획부, 홍보팀, 운영진"
                className="rounded-xl font-bold h-11 border-border bg-muted/20 focus-visible:ring-primary"
                maxLength={50}
              />
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="text-xs font-black text-muted-foreground mb-3">지위별 부여 권한</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-foreground">그룹 일정 등록/수정 권한</span>
                  <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">그룹 내 캘린더 일정을 대량 작성 관리할 수 있습니다.</p>
                </div>
                <Switch checked={newRoleSchedule} onCheckedChange={setNewRoleSchedule} className="shrink-0" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-foreground">그룹 공지사항 작성/삭제 권한</span>
                  <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">소통 보드에 주요 단체 공지를 올리고 지울 수 있습니다.</p>
                </div>
                <Switch checked={newRoleNotice} onCheckedChange={setNewRoleNotice} className="shrink-0" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-foreground">비밀 일정 열람/작성 권한</span>
                  <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">대외비용 비밀 개인 일정을 함께 관리하고 확인할 수 있습니다.</p>
                </div>
                <Switch checked={newRolePrivate} onCheckedChange={setNewRolePrivate} className="shrink-0" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setRoleModalOpen(false)}>
              취소
            </Button>
            <Button 
              className="rounded-xl font-black shadow-md" 
              onClick={handleCreateRoleSubmit}
              disabled={!newRoleName.trim() || createRoleMutation.isPending}
            >
              지위 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Create Group Calendar Event */}
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Calendar className="w-5.5 h-5.5 text-primary" />
              그룹 전용 일정 추가
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              소속 멤버 전원에게 동시 연동되는 스케줄을 기입합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-muted-foreground">일정 제목</label>
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="예: 정기 기획 회의"
                className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-muted-foreground">일정 내용/메모</label>
              <Textarea
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                placeholder="회의 장소나 세부 준비물을 적어주세요."
                className="rounded-xl font-medium border-border bg-muted/20 focus-visible:ring-primary h-20 resize-none"
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-muted-foreground">시작일시</label>
                <Input
                  type="datetime-local"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  className="rounded-xl font-bold border-border bg-muted/20 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-muted-foreground">종료일시</label>
                <Input
                  type="datetime-local"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                  className="rounded-xl font-bold border-border bg-muted/20 cursor-pointer"
                />
              </div>
            </div>

            {/* Secret schedule checkbox - only shown to users with canViewPrivateEvent permission */}
            {(permissions?.isLeader || permissions?.canViewPrivateEvent || user?.role === "admin") && (
              <div className="flex items-center justify-between p-3.5 bg-amber-50/20 border border-amber-200/40 rounded-2xl mt-2.5">
                <div className="flex items-start gap-2.5 max-w-[80%]">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-amber-800">이 일정을 비밀 일정으로 지정</span>
                    <p className="text-xs font-semibold text-amber-700/70 mt-0.5">체크 시 일반 부원들에게는 노출되지 않고, 운영진과 리더에게만 실시간 노출됩니다.</p>
                  </div>
                </div>
                <Switch checked={eventIsPrivate} onCheckedChange={setEventIsPrivate} className="shrink-0" />
              </div>
            )}

            {/* RSVP switch */}
            <div className="flex items-center justify-between p-3.5 bg-emerald-50/20 border border-emerald-200/40 rounded-2xl mt-2.5">
              <div className="flex items-start gap-2.5 max-w-[80%]">
                <Users className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold text-emerald-800">참석 여부 조사 활성화</span>
                  <p className="text-xs font-semibold text-emerald-700/70 mt-0.5">단원들이 일정 카드에서 참석 / 불참 / 보류를 투표할 수 있습니다.</p>
                </div>
              </div>
              <Switch checked={eventHasRsvp} onCheckedChange={setEventHasRsvp} className="shrink-0" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setEventModalOpen(false)}>
              취소
            </Button>
            <Button 
              className="rounded-xl font-black shadow-md" 
              onClick={handleCreateEventSubmit}
              disabled={createEventMutation.isPending}
            >
              등록 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Create Announcement */}
      <Dialog open={noticeModalOpen} onOpenChange={setNoticeModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Megaphone className="w-5.5 h-5.5 text-primary" />
              공지사항 올리기
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              소속 단원 전체 소통창구에 노출할 핵심 공지를 배포합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground">공지 제목</label>
              <Input
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="공지 핵심 타이틀"
                className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground">공지 본문 내용</label>
              <Textarea
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                placeholder="전체 공지할 세부 내용을 기입하세요..."
                className="rounded-xl font-medium border-border bg-muted/20 focus-visible:ring-primary h-40 resize-none leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setNoticeModalOpen(false)}>
              취소
            </Button>
            <Button 
              className="rounded-xl font-black shadow-md" 
              onClick={handleCreateNoticeSubmit}
              disabled={createAnnouncementMutation.isPending}
            >
              배포하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Group Archiving Portfolio */}
      <Dialog open={archiveModalOpen} onOpenChange={setArchiveModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Archive className="w-5.5 h-5.5 text-rose-600" />
              그룹 활동 종료 및 아카이브 발행
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              공식 활동을 종료하며 그동안의 결과보고서 및 포트폴리오를 발행합니다. 발행된 아카이브는 커뮤니티 전시관에 박제됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3 text-xs">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">아카이브 제목</label>
              <Input
                value={archiveTitle}
                onChange={(e) => setArchiveTitle(e.target.value)}
                placeholder="예: HUFS 알고리즘 학회 2026 1학기 활동 아카이브"
                className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                maxLength={200}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-muted-foreground">활동 기간</label>
                <Input
                  value={archivePeriod}
                  onChange={(e) => setArchivePeriod(e.target.value)}
                  placeholder="예: 2026.03 ~ 2026.06"
                  className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-muted-foreground">대표 이미지 URL (선택)</label>
                <Input
                  value={archiveImageUrl}
                  onChange={(e) => setArchiveImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">활동 요약 (한 줄 소개)</label>
              <Input
                value={archiveSummary}
                onChange={(e) => setArchiveSummary(e.target.value)}
                placeholder="간략한 활동 핵심 소개 (500자 이내)"
                className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                maxLength={500}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">활동 상세 회고 및 포트폴리오 성과</label>
              <Textarea
                value={archiveContent}
                onChange={(e) => setArchiveContent(e.target.value)}
                placeholder="회의록 모음, 스터디를 통해 이룬 결과물, 프로젝트 링크, 활동 후기 등을 풍성하게 기록하세요."
                className="rounded-xl font-medium border-border bg-muted/20 focus-visible:ring-primary h-36 resize-none leading-relaxed"
                required
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setArchiveModalOpen(false)}>
              취소
            </Button>
            <Button 
              type="button"
              className="rounded-xl font-black shadow-md bg-rose-600 hover:bg-rose-700 text-white" 
              onClick={() => {
                if (!archiveTitle.trim() || !archiveSummary.trim() || !archiveContent.trim() || !archivePeriod.trim()) {
                  toast.error("필수 입력 값을 모두 채워주세요.");
                  return;
                }
                archiveGroupMutation.mutate({
                  groupId: selectedGroupId ?? 0,
                  title: archiveTitle,
                  summary: archiveSummary,
                  content: archiveContent,
                  period: archivePeriod,
                  imageUrl: archiveImageUrl || undefined,
                });
              }}
              disabled={archiveGroupMutation.isPending}
            >
              활동 종료 & 발행하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );

  function setEventOpenAndReset() {
    setEventTitle("");
    setEventDesc("");
    setEventStart("");
    setEventEnd("");
    setEventIsPrivate(false);
    setEventHasRsvp(false);
    setEventModalOpen(true);
  }
}

function GroupEventCard({
  evt,
  permissions,
  user,
  onDelete,
  selectedGroupId,
}: {
  evt: any;
  permissions: any;
  user: any;
  onDelete: () => void;
  selectedGroupId: number;
}) {
  const isSecret = evt.isPrivate === 1;
  const hasRsvp = evt.hasRsvp === 1;
  const utils = trpc.useUtils();
  const [showRsvpDetails, setShowRsvpDetails] = useState(false);

  // RSVP Query
  const { data: rsvps = [] } = trpc.group.getEventRsvps.useQuery(
    { eventId: evt.id },
    { enabled: hasRsvp }
  );

  // RSVP Mutation
  const submitRsvpMutation = trpc.group.submitRsvp.useMutation({
    onSuccess: () => {
      utils.group.getEventRsvps.invalidate({ eventId: evt.id });
      utils.calendar.list.invalidate(); // also update calendar
      toast.success("참석 여부가 반영되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const myRsvp = rsvps.find((r: any) => r.userId === user?.id);
  const isLeaderOrAdmin = permissions?.isLeader || user?.role === "admin";

  const attendingCount = rsvps.filter((r: any) => r.status === "attending").length;
  const absentCount = rsvps.filter((r: any) => r.status === "absent").length;
  const maybeCount = rsvps.filter((r: any) => r.status === "maybe").length;

  return (
    <div className={`border rounded-2xl p-4.5 relative group shadow-sm transition-all flex flex-col justify-between ${isSecret ? "bg-amber-50/20 border-amber-200/50 hover:border-amber-300" : "bg-card border-border hover:border-primary/20"}`}>
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-foreground line-clamp-1">{evt.title}</h4>
            {isSecret && (
              <Badge variant="outline" className="bg-amber-100/50 border-amber-300 text-amber-700 text-[9px] font-extrabold px-1.5 py-0 rounded flex items-center gap-1 select-none shrink-0">
                <Lock className="w-2.5 h-2.5 shrink-0" /> 비밀 일정
              </Badge>
            )}
          </div>
          {(permissions?.isLeader || permissions?.canManageSchedule || user?.role === "admin") && (
            <button 
              className="p-1 rounded bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0 transition-colors opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-semibold leading-relaxed mb-4">
          {evt.description || "설명 없음"}
        </p>

        {hasRsvp && (
          <div className="mb-4 bg-muted/30 border border-border/30 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-black text-muted-foreground">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Users className="w-3 h-3" /> 참석 여부 투표
              </span>
              <span>{rsvps.length}명 참여</span>
            </div>

            <div className="flex gap-1.5">
              {[
                { status: "attending", label: "참석", color: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500", inactive: "bg-background hover:bg-emerald-55 text-muted-foreground border-border hover:text-emerald-600 hover:border-emerald-250 dark:hover:bg-emerald-950/20" },
                { status: "absent", label: "불참", color: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500", inactive: "bg-background hover:bg-rose-55 text-muted-foreground border-border hover:text-rose-600 hover:border-rose-250 dark:hover:bg-rose-950/20" },
                { status: "maybe", label: "보류", color: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500", inactive: "bg-background hover:bg-amber-55 text-muted-foreground border-border hover:text-amber-600 hover:border-amber-250 dark:hover:bg-amber-950/20" },
              ].map((btn) => {
                const isSelected = myRsvp?.status === btn.status;
                return (
                  <Button
                    key={btn.status}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => submitRsvpMutation.mutate({
                      eventId: evt.id,
                      status: btn.status as "attending" | "absent" | "maybe"
                    })}
                    className={cn(
                      "flex-1 rounded-lg font-bold text-[11px] h-7 px-1 transition-all cursor-pointer border",
                      isSelected ? btn.color : btn.inactive
                    )}
                    disabled={submitRsvpMutation.isPending}
                  >
                    {btn.label}
                  </Button>
                );
              })}
            </div>

            {/* RSVP Counts */}
            <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground border-t border-border/30 pt-2 px-0.5">
              <span className="text-emerald-600 dark:text-emerald-400">참석 {attendingCount}</span>
              <span className="text-rose-600 dark:text-rose-400">불참 {absentCount}</span>
              <span className="text-amber-600 dark:text-amber-400">보류 {maybeCount}</span>
            </div>

            {/* Leader-only detailed members view */}
            {isLeaderOrAdmin && rsvps.length > 0 && (
              <div className="border-t border-border/30 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRsvpDetails(!showRsvpDetails)}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  {showRsvpDetails ? "상세 명단 접기 ▲" : "리더 권한: 상세 명단 보기 ▼"}
                </button>
                
                {showRsvpDetails && (
                  <div className="mt-2 space-y-1.5 text-[10px] text-muted-foreground bg-background/50 rounded-lg p-2 max-h-24 overflow-y-auto font-medium">
                    {rsvps.map((r: any) => (
                      <div key={r.id} className="flex justify-between items-center">
                        <span className="font-bold text-foreground">{r.userRealName ?? r.userName}</span>
                        <span className={cn(
                          "px-1 py-0.2 rounded text-[9px] font-black",
                          r.status === "attending" ? "bg-emerald-500/10 text-emerald-600" :
                          r.status === "absent" ? "bg-rose-500/10 text-rose-600" :
                          "bg-amber-500/10 text-amber-600"
                        )}>
                          {r.status === "attending" ? "참석" : r.status === "absent" ? "불참" : "보류"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-3 text-[10px] font-bold text-muted-foreground select-none mt-2">
        <span>
          {new Date(evt.startDate).toLocaleDateString("ko-KR")} ~ {new Date(evt.endDate).toLocaleDateString("ko-KR")}
        </span>
        <span>
          {isSecret ? "운영진 열람" : "전체 연동"}
        </span>
      </div>
    </div>
  );
}

// Sidebar list component to reuse
interface SidebarProps {
  groups: any[];
  selectedGroupId: number | null;
  groupsLoading: boolean;
  onSelect: (id: number) => void;
  joinAccessKey: string;
  setJoinAccessKey: (val: string) => void;
  onJoin: (e: React.FormEvent) => void;
  isJoining: boolean;
  copyAccessKey: (gId: number, key: string) => void;
  copiedKeyGroupId: number | null;
}

function GroupSidebarSection({
  groups,
  selectedGroupId,
  groupsLoading,
  onSelect,
  joinAccessKey,
  setJoinAccessKey,
  onJoin,
  isJoining,
  copyAccessKey,
  copiedKeyGroupId,
}: SidebarProps) {
  if (groupsLoading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-muted/50 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Join Group access key form */}
      <form onSubmit={onJoin} className="bg-muted/50 border border-border/80 rounded-2xl p-4 space-y-3 shadow-sm shrink-0">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
          신규 그룹 연동 (입장 키)
        </label>
        <div className="flex gap-2">
          <Input
            value={joinAccessKey}
            onChange={(e) => setJoinAccessKey(e.target.value)}
            placeholder="XXXX-XXXX"
            className="rounded-xl border-border bg-card font-black focus-visible:ring-primary font-mono text-center tracking-wide text-xs h-9"
          />
          <Button 
            type="submit" 
            size="sm" 
            className="rounded-xl font-bold h-9 bg-primary"
            disabled={!joinAccessKey.trim() || isJoining}
          >
            {isJoining ? "..." : "연동"}
          </Button>
        </div>
      </form>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[420px] md:max-h-none">
        {groups.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-muted-foreground leading-relaxed">
            연동된 그룹이 없습니다.<br />위 코드를 통해 연동을 마쳐보세요!
          </div>
        ) : (
          groups.map((g) => {
            const isSelected = g.id === selectedGroupId;
            return (
              <div 
                key={g.id}
                onClick={() => onSelect(g.id)}
                className={`w-full text-left rounded-2xl px-4.5 py-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between gap-2.5 ${isSelected ? "bg-primary border-primary text-white shadow-md shadow-primary/10" : "bg-card border-border text-foreground hover:bg-muted/30"}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-black text-sm tracking-tight line-clamp-1 flex-1">{g.name}</span>
                  {g.isLeader ? (
                    <Badge variant="default" className={`font-bold text-[9px] px-1.5 py-0 rounded shrink-0 select-none ${isSelected ? "bg-white text-primary hover:bg-white" : "bg-primary hover:bg-primary text-white"}`}>
                      리더
                    </Badge>
                  ) : g.userRole ? (
                    <Badge variant="outline" className={`font-bold text-[9px] px-1.5 py-0 rounded shrink-0 select-none ${isSelected ? "border-white/50 text-white bg-white/10" : "border-primary/20 text-primary bg-primary/5"}`}>
                      {g.userRole}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className={`font-bold text-[9px] px-1.5 py-0 rounded shrink-0 select-none ${isSelected ? "bg-white/20 text-white" : ""}`}>
                      멤버
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between border-t pt-2.5 border-current border-opacity-10 text-[10px] font-bold opacity-80 select-none">
                  <span>멤버 {g.memberCount}명</span>
                  <span className="flex items-center gap-1.5">
                    리더: {g.leaderName}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// [신규] 자료실 탭 컨텐츠 렌더링 컴포넌트
// ============================================================================
function GroupFilesSection({
  groupId,
  isLeader,
  user,
}: {
  groupId: number;
  isLeader: boolean;
  user: any;
}) {
  const utils = trpc.useUtils();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSizeStr, setFileSizeStr] = useState("0");
  const [fileType, setFileType] = useState("application/pdf");
  const [fileUrl, setFileUrl] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: files = [], isLoading } = trpc.group.listFiles.useQuery({ groupId });

  const uploadFileMutation = trpc.upload.file.useMutation();

  const uploadMutation = trpc.group.uploadFile.useMutation({
    onSuccess: () => {
      utils.group.listFiles.invalidate({ groupId });
      handleOpenChange(false);
      toast.success("파일이 자료실에 성공적으로 등록되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.group.deleteFile.useMutation({
    onSuccess: () => {
      utils.group.listFiles.invalidate({ groupId });
      toast.success("파일이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setFileName("");
    setFileSizeStr("0");
    setFileType("application/pdf");
    setFileUrl("");
    setSelectedFile(null);
    setFileBase64(null);
  };

  const handleOpenChange = (open: boolean) => {
    setUploadModalOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("최대 10MB 크기의 파일만 업로드할 수 있습니다.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setFileSizeStr(Math.ceil(file.size / 1024).toString());
    setFileType(file.type || "application/octet-stream");

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) {
      toast.error("파일명은 필수입니다.");
      return;
    }
    if (!fileBase64 || !selectedFile) {
      toast.error("업로드할 파일을 선택해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      const uploadRes = await uploadFileMutation.mutateAsync({
        data: fileBase64,
        name: selectedFile.name,
        type: selectedFile.type || "application/octet-stream",
      });

      uploadMutation.mutate({
        groupId,
        fileName,
        fileSize: selectedFile.size,
        fileType: selectedFile.type || "application/octet-stream",
        fileUrl: uploadRes.url,
      });
    } catch (err: any) {
      toast.error(err.message || "파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center select-none">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            📂 그룹 자료실
          </h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">강의안, 과제제출물 등 부원들이 함께 공유할 파일을 관리합니다.</p>
        </div>
        <Button
          type="button"
          onClick={() => setUploadModalOpen(true)}
          className="rounded-xl font-bold gap-1.5 h-9 bg-primary"
        >
          <UploadCloud className="w-4 h-4" />
          자료 등록
        </Button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
          자료실 로딩 중...
        </div>
      ) : files.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-xs font-black text-muted-foreground">자료실이 비어 있습니다.</p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">우측 상단 자료 등록 버튼으로 그룹 자료를 공유해 보세요!</p>
        </div>
      ) : (
        <div className="border border-border/60 bg-card rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs font-medium border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50 text-muted-foreground select-none text-[10px] font-black uppercase">
                <th className="py-3 px-4">파일명</th>
                <th className="py-3 px-4 hidden sm:table-cell">파일 정보</th>
                <th className="py-3 px-4 hidden md:table-cell">업로더</th>
                <th className="py-3 px-4 hidden lg:table-cell">등록일</th>
                <th className="py-3 px-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f: any) => {
                const isUploader = f.uploaderId === user?.id;
                const canDelete = isUploader || isLeader || user?.role === "admin";
                return (
                  <tr key={f.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-xs">{f.fileName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell font-semibold text-muted-foreground/80">
                      {formatBytes(f.fileSize)} ({f.fileType.split("/")[1] || "파일"})
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell font-bold text-foreground/80">
                      {f.uploaderName}
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell font-medium text-muted-foreground/75">
                      {new Date(f.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-border/50 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer"
                          title="다운로드"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (confirm("이 파일을 자료실에서 삭제하시겠습니까?")) {
                                deleteMutation.mutate({ id: f.id, groupId });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all cursor-pointer"
                            title="삭제"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 파일 업로드 모달창 */}
      <Dialog open={uploadModalOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <UploadCloud className="w-5.5 h-5.5 text-primary" />
              자료 업로드 등록
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              컴퓨터 저장소에서 학습자료나 발표자료를 직접 선택하여 업로드합니다. (최대 10MB)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 my-3 text-xs">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">파일 선택</label>
              <Input
                type="file"
                onChange={handleFileChange}
                className="rounded-xl font-bold h-10 border-border bg-muted/20 focus-visible:ring-primary cursor-pointer pt-2 px-3 file:mr-2 file:py-0 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                required
              />
            </div>

            {selectedFile && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-muted-foreground">공유 파일명 (수정 가능)</label>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="공유할 파일 이름을 입력해주세요."
                    className="rounded-xl font-bold h-10 border-border bg-muted/20 focus-visible:ring-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 bg-muted/10 p-3 rounded-2xl border border-border/30">
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground block">파일 크기</span>
                    <span className="text-xs font-bold text-foreground mt-0.5 block">
                      {formatBytes(selectedFile.size)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground block">파일 유형</span>
                    <span className="text-xs font-bold text-foreground mt-0.5 block truncate">
                      {selectedFile.type || "알 수 없음"}
                    </span>
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="pt-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl font-bold" 
                onClick={() => handleOpenChange(false)}
                disabled={isUploading}
              >
                취소
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl font-black shadow-md bg-primary" 
                disabled={isUploading || !selectedFile}
              >
                {isUploading ? "업로드 중..." : "업로드 완료"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// [신규] 하위 스터디 및 소모임 관리 섹션 컴포넌트
// ============================================================================
function GroupStudiesSection({
  groupId,
  isLeader,
  user,
}: {
  groupId: number;
  isLeader: boolean;
  user: any;
}) {
  const utils = trpc.useUtils();
  
  const { data: studies = [], isLoading: studiesLoading } = trpc.group.listSubStudies.useQuery({ groupId });
  const { data: parentMembers = [] } = trpc.group.listMembers.useQuery({ groupId });

  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newStudyName, setNewStudyName] = useState("");
  const [newStudyDesc, setNewStudyDesc] = useState("");
  const [newStudyLeaderId, setNewStudyLeaderId] = useState<number | null>(null);
  const [leaderSearchQuery, setLeaderSearchQuery] = useState("");

  const currentStudy = studies.find((s) => s.id === selectedStudyId);
  const isStudyLeader = currentStudy?.leaderId === user?.id;
  const isLeaderOrAdmin = isLeader || isStudyLeader || user?.role === "admin";

  const createStudyMutation = trpc.group.createSubStudy.useMutation({
    onSuccess: () => {
      utils.group.listSubStudies.invalidate({ groupId });
      setCreateModalOpen(false);
      setNewStudyName("");
      setNewStudyDesc("");
      setNewStudyLeaderId(null);
      setLeaderSearchQuery("");
      toast.success("소모임 스터디가 개설되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateStudySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudyLeaderId) {
      toast.error("스터디장을 지정해주세요.");
      return;
    }
    createStudyMutation.mutate({
      groupId,
      leaderId: newStudyLeaderId,
      name: newStudyName,
      description: newStudyDesc,
    });
  };

  if (selectedStudyId && currentStudy) {
    return (
      <SubStudyWorkspace
        groupId={groupId}
        studyId={selectedStudyId}
        study={currentStudy}
        isLeader={isLeader}
        isStudyLeader={isStudyLeader}
        isLeaderOrAdmin={isLeaderOrAdmin}
        user={user}
        parentMembers={parentMembers}
        onBack={() => {
          setSelectedStudyId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center select-none">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            🚀 소모임 및 하위 스터디
          </h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">동아리 내 개설된 연구회, 스터디 그룹을 모니터링하고 가입할 수 있습니다.</p>
        </div>
        {(isLeader || user?.role === "admin") && (
          <Button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-xl font-bold gap-1.5 h-9 bg-primary"
          >
            <Plus className="w-4 h-4" />
            스터디 개설
          </Button>
        )}
      </div>

      {studiesLoading ? (
        <div className="py-24 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
          스터디 목록 로딩 중...
        </div>
      ) : studies.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
          <ListTodo className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-xs font-black text-muted-foreground">개설된 스터디가 없습니다.</p>
          {(isLeader || user?.role === "admin") ? (
            <p className="text-[10px] text-muted-foreground/80 mt-1">상단의 스터디 개설 버튼을 통해 스터디 그룹을 신설해보세요!</p>
          ) : (
            <p className="text-[10px] text-muted-foreground/80 mt-1">그룹 리더에게 하위 소모임 개설을 건의해보세요.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {studies.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedStudyId(s.id)}
              className="group border border-border/60 hover:border-primary/20 bg-card rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono">
                    스터디
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    방장: {s.leaderName}
                  </span>
                </div>
                <h4 className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                  {s.name}
                </h4>
                <p className="text-[11px] leading-relaxed text-muted-foreground font-semibold line-clamp-3 mt-2 break-all">
                  {s.description || "등록된 스터디 한 줄 소개가 없습니다."}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-5 text-[10px] font-bold text-muted-foreground">
                <span className="text-primary group-hover:underline">워크스페이스 입장 →</span>
                <span>{new Date(s.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 스터디 개설 모달창 */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Plus className="w-5.5 h-5.5 text-primary" />
              신규 스터디/소모임 개설
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              학회 내 소그룹을 만들고 역할을 전담할 스터디장을 임명합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStudySubmit} className="space-y-4 my-3 text-xs">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">스터디 이름</label>
              <Input
                value={newStudyName}
                onChange={(e) => setNewStudyName(e.target.value)}
                placeholder="예: 리액트 딥다이브 스터디"
                className="rounded-xl font-bold h-10 border-border bg-muted/20 focus-visible:ring-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">스터디 한 줄 소개</label>
              <Input
                value={newStudyDesc}
                onChange={(e) => setNewStudyDesc(e.target.value)}
                placeholder="어떤 주제로 스터디를 운영하나요?"
                className="rounded-xl font-bold h-10 border-border bg-muted/20 focus-visible:ring-primary"
                required
              />
            </div>

            <div className="space-y-1.5 flex flex-col">
              <label className="text-[11px] font-black text-muted-foreground">스터디장 임명</label>
              <Input
                value={leaderSearchQuery}
                onChange={(e) => setLeaderSearchQuery(e.target.value)}
                placeholder="이름 또는 학번으로 스터디장 검색..."
                className="rounded-xl font-bold h-9 border-border bg-muted/20 focus-visible:ring-primary mb-1.5 text-xs animate-fadeIn"
              />
              <select
                value={newStudyLeaderId ?? ""}
                onChange={(e) => setNewStudyLeaderId(Number(e.target.value))}
                className="w-full rounded-xl font-bold h-10 px-3 border border-border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                required
              >
                <option value="">-- 스터디장 선택 --</option>
                {parentMembers
                  .filter((m: any) => {
                    if (m.userId === newStudyLeaderId) return true;
                    const name = m.realName ?? m.name ?? "";
                    const studentId = m.studentId ?? "";
                    return name.toLowerCase().includes(leaderSearchQuery.toLowerCase()) ||
                           studentId.toLowerCase().includes(leaderSearchQuery.toLowerCase());
                  })
                  .map((m: any) => (
                    <option key={m.userId} value={m.userId}>
                      {m.realName ?? m.name} ({m.studentId ? `${m.studentId.substring(2,4)}학번` : "일반"})
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setCreateModalOpen(false)}>
                취소
              </Button>
              <Button type="submit" className="rounded-xl font-black shadow-md bg-primary" disabled={createStudyMutation.isPending}>
                개설 완료
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// 하위 스터디 개별 워크스페이스 컴포넌트
// ============================================================================
function SubStudyWorkspace({
  groupId,
  studyId,
  study,
  isLeader,
  isStudyLeader,
  isLeaderOrAdmin,
  user,
  parentMembers,
  onBack,
}: {
  groupId: number;
  studyId: number;
  study: any;
  isLeader: boolean;
  isStudyLeader: boolean;
  isLeaderOrAdmin: boolean;
  user: any;
  parentMembers: any[];
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [activeSubTab, setActiveSubTab] = useState<"minutes" | "members">("minutes");

  // 스터디 멤버 조회
  const { data: studyMembers = [], isLoading: membersLoading } = trpc.group.listSubStudyMembers.useQuery({ studyId, groupId });
  // 회의록 조회
  const { data: minutes = [], isLoading: minutesLoading } = trpc.group.listSubStudyMinutes.useQuery({ studyId, groupId });

  const [selectedMinuteId, setSelectedMinuteId] = useState<number | null>(null);
  const [minuteModalOpen, setMinuteModalOpen] = useState(false);
  const [editingMinuteId, setEditingMinuteId] = useState<number | null>(null);
  
  // 회의록 에디터 폼
  const [minuteTitle, setMinuteTitle] = useState("");
  const [minuteContent, setMinuteContent] = useState("");
  const [minuteDateStr, setMinuteDateStr] = useState(new Date().toISOString().split("T")[0]);

  // 스터디 멤버 편집 모달
  const [manageMembersModalOpen, setManageMembersModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // 회의록 상세 정보 조회
  const { data: minuteDetail } = trpc.group.getSubStudyMinuteDetail.useQuery(
    { id: selectedMinuteId ?? 0, groupId, studyId },
    { enabled: !!selectedMinuteId }
  );

  // 스터디 멤버 수정 Mutation
  const updateMembersMutation = trpc.group.updateSubStudyMembers.useMutation({
    onSuccess: () => {
      utils.group.listSubStudyMembers.invalidate({ studyId, groupId });
      setManageMembersModalOpen(false);
      toast.success("스터디원 구성원 변경이 반영되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  // 회의록 작성 Mutation
  const createMinuteMutation = trpc.group.createSubStudyMinute.useMutation({
    onSuccess: () => {
      utils.group.listSubStudyMinutes.invalidate({ studyId, groupId });
      setMinuteModalOpen(false);
      toast.success("회의록이 등록되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  // 회의록 수정 Mutation
  const updateMinuteMutation = trpc.group.updateSubStudyMinute.useMutation({
    onSuccess: () => {
      utils.group.listSubStudyMinutes.invalidate({ studyId, groupId });
      if (selectedMinuteId === editingMinuteId) {
        utils.group.getSubStudyMinuteDetail.invalidate({ id: selectedMinuteId, groupId, studyId });
      }
      setMinuteModalOpen(false);
      toast.success("회의록이 수정되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  // 회의록 삭제 Mutation
  const deleteMinuteMutation = trpc.group.deleteSubStudyMinute.useMutation({
    onSuccess: () => {
      utils.group.listSubStudyMinutes.invalidate({ studyId, groupId });
      setSelectedMinuteId(null);
      toast.success("회의록이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleMinuteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!minuteTitle.trim() || !minuteContent.trim()) {
      toast.error("모든 내용을 기입해 주세요.");
      return;
    }
    const meetingDate = new Date(minuteDateStr);

    if (editingMinuteId) {
      updateMinuteMutation.mutate({
        id: editingMinuteId,
        studyId,
        groupId,
        title: minuteTitle,
        content: minuteContent,
        meetingDate,
      });
    } else {
      createMinuteMutation.mutate({
        studyId,
        groupId,
        title: minuteTitle,
        content: minuteContent,
        meetingDate,
      });
    }
  };

  const handleOpenNewMinute = () => {
    setEditingMinuteId(null);
    setMinuteTitle("");
    setMinuteContent("");
    setMinuteDateStr(new Date().toISOString().split("T")[0]);
    setMinuteModalOpen(true);
  };

  const handleOpenEditMinute = (min: any) => {
    setEditingMinuteId(min.id);
    setMinuteTitle(min.title);
    setMinuteContent(min.content || "");
    setMinuteDateStr(new Date(min.meetingDate).toISOString().split("T")[0]);
    setMinuteModalOpen(true);
  };

  const handleOpenManageMembers = () => {
    setSelectedMemberIds(studyMembers.map((m) => m.userId));
    setMemberSearchQuery("");
    setManageMembersModalOpen(true);
  };

  const handleSaveMembers = () => {
    updateMembersMutation.mutate({
      studyId,
      groupId,
      userIds: selectedMemberIds,
    });
  };

  const toggleMemberSelection = (userId: number) => {
    if (userId === study.leaderId) return;

    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border pb-4 select-none">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl font-bold shrink-0">
            ← 목록
          </Button>
          <div>
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Notebook className="w-5 h-5 text-primary shrink-0" />
              {study.name}
            </h3>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5 line-clamp-1">{study.description}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab("minutes")}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all ${activeSubTab === "minutes" ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground"}`}
          >
            회의록 & 문서
          </button>
          <button
            onClick={() => setActiveSubTab("members")}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all ${activeSubTab === "members" ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground"}`}
          >
            팀원 구성 ({studyMembers.length}명)
          </button>
        </div>
      </div>

      {activeSubTab === "minutes" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center select-none">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">주차별 회의록 리스트</span>
            {isLeaderOrAdmin && (
              <Button onClick={handleOpenNewMinute} className="rounded-xl font-bold h-8.5 bg-primary gap-1">
                <Plus className="w-3.5 h-3.5" />
                회의록 작성
              </Button>
            )}
          </div>

          {minutesLoading ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
              회의록을 불러오는 중...
            </div>
          ) : minutes.length === 0 ? (
            <div className="py-16 text-center border border-dashed rounded-2xl bg-muted/5">
              <Notebook className="w-8 h-8 mx-auto mb-2 text-muted-foreground/25" />
              <p className="text-xs font-bold text-muted-foreground/85">작성된 회의록이 없습니다.</p>
              {isLeaderOrAdmin && <p className="text-[10px] text-muted-foreground/75 mt-1">상단 버튼을 눌러 스터디의 첫 회의 기록을 시작해보세요!</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {minutes.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMinuteId(m.id)}
                  className="p-4 rounded-xl border border-border/50 hover:border-primary/20 bg-card/60 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      회의일자: {new Date(m.meetingDate).toLocaleDateString("ko-KR")}
                    </span>
                    <span className="text-[10px] font-bold text-foreground/80">
                      작성자: {m.authorName}
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-foreground mb-1 line-clamp-1">
                    {m.title}
                  </h4>
                  <div className="border-t border-border/30 pt-3 mt-4 flex items-center justify-between text-[10px] text-muted-foreground/75">
                    <span>수정일: {new Date(m.updatedAt).toLocaleDateString("ko-KR")}</span>
                    <span className="text-primary font-bold">열람하기 →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "members" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center select-none">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">스터디 구성원</span>
            {isLeaderOrAdmin && (
              <Button onClick={handleOpenManageMembers} variant="outline" className="rounded-xl font-bold h-8.5 gap-1">
                <Edit className="w-3.5 h-3.5" />
                팀원 구성 변경
              </Button>
            )}
          </div>

          {membersLoading ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
              스터디원 조회 중...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {studyMembers.map((m) => {
                const isStudyLeaderSelf = m.userId === study.leaderId;
                return (
                  <div key={m.id} className="p-3.5 rounded-xl border border-border bg-muted/5 flex items-center gap-3">
                    <Avatar className="w-8.5 h-8.5">
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                        {m.realName?.charAt(0) ?? m.name?.charAt(0) ?? "M"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-foreground">{m.realName ?? m.name}</span>
                        {isStudyLeaderSelf && (
                          <Badge className="bg-amber-500 text-white font-bold text-[8px] px-1 py-0.2 shrink-0">스터디장</Badge>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-muted-foreground/80 mt-0.5">
                        {m.studentId ? `${m.studentId.substring(2, 4)}학번` : "일반"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 회의록 상세 모달 */}
      <Dialog open={!!selectedMinuteId} onOpenChange={(open) => { if (!open) setSelectedMinuteId(null); }}>
        <DialogContent className="rounded-3xl border border-border max-w-lg shadow-2xl overflow-y-auto max-h-[85vh]">
          {minuteDetail ? (
            <>
              <DialogHeader className="pr-6">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mb-1 select-none pr-6">
                  <span>회의일자: {new Date(minuteDetail.meetingDate).toLocaleDateString("ko-KR")}</span>
                  <span>작성자: {minuteDetail.authorName}</span>
                </div>
                <DialogTitle className="text-base font-black text-foreground leading-snug">
                  {minuteDetail.title}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-semibold text-[10px] mt-1 select-none">
                  등록일: {new Date(minuteDetail.createdAt).toLocaleDateString("ko-KR")} · 최종수정: {new Date(minuteDetail.updatedAt).toLocaleDateString("ko-KR")}
                </DialogDescription>
              </DialogHeader>

              <div className="my-3 space-y-1.5 text-xs">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider select-none">회의록 내용</span>
                <div className="p-4 bg-muted/5 border border-border/40 rounded-2xl leading-relaxed text-foreground font-medium whitespace-pre-wrap break-all min-h-40">
                  {minuteDetail.content}
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 flex flex-col sm:flex-row">
                <div className="flex gap-2 w-full">
                  {(minuteDetail.authorId === user?.id || isLeaderOrAdmin) && (
                    <>
                      <Button 
                        type="button"
                        variant="destructive"
                        className="rounded-xl font-bold" 
                        onClick={() => {
                          if (confirm("이 회의록을 삭제하시겠습니까?")) {
                            deleteMinuteMutation.mutate({ id: minuteDetail.id, studyId, groupId });
                          }
                        }}
                        disabled={deleteMinuteMutation.isPending}
                      >
                        삭제
                      </Button>
                      <Button 
                        type="button"
                        variant="outline"
                        className="rounded-xl font-bold flex-1" 
                        onClick={() => handleOpenEditMinute(minuteDetail)}
                      >
                        수정
                      </Button>
                    </>
                  )}
                  <Button 
                    type="button"
                    className="rounded-xl font-bold bg-primary flex-1" 
                    onClick={() => setSelectedMinuteId(null)}
                  >
                    닫기
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <div className="py-20 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
              회의록 상세 내용 로드 중...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 회의록 작성 및 수정 모달 */}
      <Dialog open={minuteModalOpen} onOpenChange={setMinuteModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Notebook className="w-5.5 h-5.5 text-primary" />
              {editingMinuteId ? "회의록 수정" : "신규 회의록 작성"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              스터디 진행 일자, 안건, 스터디 결과 요약 등을 상세히 기입합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMinuteSubmit} className="space-y-4 my-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[11px] font-black text-muted-foreground">회의 제목</label>
                <Input
                  value={minuteTitle}
                  onChange={(e) => setMinuteTitle(e.target.value)}
                  placeholder="예: 1주차 웹 기초 회의록"
                  className="rounded-xl font-bold h-10 border-border bg-muted/20 focus-visible:ring-primary"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-muted-foreground">회의 일시</label>
                <Input
                  type="date"
                  value={minuteDateStr}
                  onChange={(e) => setMinuteDateStr(e.target.value)}
                  className="rounded-xl font-bold h-10 border-border bg-muted/20 focus-visible:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-muted-foreground">회의 내용 및 결과 회고</label>
              <Textarea
                value={minuteContent}
                onChange={(e) => setMinuteContent(e.target.value)}
                placeholder="어떤 논의가 오갔고 스터디 내용이 무엇인지 상세히 기입해주세요."
                className="rounded-xl font-medium border-border bg-muted/20 focus-visible:ring-primary h-44 resize-none leading-relaxed"
                required
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl font-bold" 
                onClick={() => setMinuteModalOpen(false)}
              >
                취소
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl font-black shadow-md bg-primary" 
                disabled={createMinuteMutation.isPending || updateMinuteMutation.isPending}
              >
                {editingMinuteId ? "수정 완료" : "등록 완료"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 스터디 팀원 구성 모달 */}
      <Dialog open={manageMembersModalOpen} onOpenChange={setManageMembersModalOpen}>
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Edit className="w-5.5 h-5.5 text-primary" />
              스터디 팀원 지정 및 관리
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-xs">
              상위 그룹 단원 목록 중 이 스터디에 참여할 팀원들을 선택합니다. 스터디장은 강제 포함됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 mb-1.5 mt-2 select-none">
            <Input
              value={memberSearchQuery}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
              placeholder="이름 또는 학번으로 팀원 검색..."
              className="rounded-xl font-bold h-9 border-border bg-muted/20 focus-visible:ring-primary text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 my-3 pr-1 text-xs">
            {parentMembers
              .filter((m: any) => {
                const name = m.realName ?? m.name ?? "";
                const studentId = m.studentId ?? "";
                return name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                       studentId.toLowerCase().includes(memberSearchQuery.toLowerCase());
              })
              .map((m: any) => {
                const isStudyLeaderSelf = m.userId === study.leaderId;
                const isChecked = selectedMemberIds.includes(m.userId);
                return (
                  <div
                    key={m.userId}
                    onClick={() => toggleMemberSelection(m.userId)}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isChecked ? "border-primary bg-primary/5 font-bold" : "border-border hover:bg-muted/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                          {m.realName?.charAt(0) ?? m.name?.charAt(0) ?? "M"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-foreground">{m.realName ?? m.name}</span>
                          {isStudyLeaderSelf && (
                            <Badge className="bg-amber-500 text-white font-bold text-[8px] px-1 py-0.2 shrink-0">스터디장</Badge>
                          )}
                        </div>
                        <span className="text-[9px] font-semibold text-muted-foreground/80 block mt-0.5">
                          {m.studentId ? `${m.studentId.substring(2, 4)}학번` : "일반"}
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      disabled={isStudyLeaderSelf}
                      className="w-4 h-4 rounded accent-primary border-border cursor-pointer"
                    />
                  </div>
                );
              })}
          </div>

          <DialogFooter className="pt-2 gap-2 shrink-0 border-t border-border/30 mt-3 pt-3">
            <Button 
              type="button" 
              variant="outline" 
              className="rounded-xl font-bold" 
              onClick={() => setManageMembersModalOpen(false)}
            >
              취소
            </Button>
            <Button 
              type="button" 
              className="rounded-xl font-black shadow-md bg-primary" 
              onClick={handleSaveMembers}
              disabled={updateMembersMutation.isPending}
            >
              저장 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
