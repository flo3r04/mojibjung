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
  X
} from "lucide-react";
import { toast } from "sonner";

export default function GroupHub() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "calendar" | "members">("chat");
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

  // New notice/announcement state
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");

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
    createRoleMutation.mutate({
      groupId: selectedGroupId,
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
    createEventMutation.mutate({
      groupId: selectedGroupId,
      title: eventTitle.trim(),
      description: eventDesc.trim() || undefined,
      startDate: new Date(eventStart).toISOString(),
      endDate: new Date(eventEnd).toISOString(),
      isPrivate: eventIsPrivate ? 1 : 0,
    });
  };

  const handleCreateNoticeSubmit = () => {
    if (!noticeTitle.trim() || !noticeContent.trim() || !selectedGroupId) {
      toast.error("제목과 내용을 모두 입력해주세요.");
      return;
    }
    createAnnouncementMutation.mutate({
      groupId: selectedGroupId,
      title: noticeTitle.trim(),
      content: noticeContent.trim(),
    });
  };

  const handleSendChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedGroupId) return;
    sendChatMessageMutation.mutate({
      groupId: selectedGroupId,
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
                                        onClick={() => deleteAnnouncementMutation.mutate({ groupId: selectedGroupId, id: notice.id })}
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
                            groupEvents.map((evt) => {
                              const isSecret = evt.isPrivate === 1;
                              return (
                                <div 
                                  key={evt.id} 
                                  className={`border rounded-2xl p-4.5 relative group shadow-sm transition-all ${isSecret ? "bg-amber-50/20 border-amber-200/50 hover:border-amber-300" : "bg-card border-border hover:border-primary/20"}`}
                                >
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
                                        className="p-1 rounded bg-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={() => deleteEventMutation.mutate({ id: evt.id, groupId: selectedGroupId })}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground font-semibold leading-relaxed line-clamp-2 mb-4.5">
                                    {evt.description || "설명 없음"}
                                  </p>
                                  <div className="flex items-center justify-between border-t border-border/50 pt-3 text-[10px] font-bold text-muted-foreground select-none">
                                    <span>
                                      {new Date(evt.startDate).toLocaleDateString("ko-KR")} ~ {new Date(evt.endDate).toLocaleDateString("ko-KR")}
                                    </span>
                                    <span>
                                      {isSecret ? "운영진 열람" : "전체 연동"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
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
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="font-bold border-primary text-primary hover:bg-primary/5 rounded-xl h-9.5 gap-1 shrink-0 self-start sm:self-center"
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
                                      onClick={() => deleteRoleMutation.mutate({ groupId: selectedGroupId, roleId: role.id })}
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

                                    {!isSelfLeader && (
                                      <div className="flex items-center gap-2 shrink-0">
                                        {/* Position Assign Select Box */}
                                        <select
                                          value={mb.roleId ?? ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            assignRoleMutation.mutate({
                                              groupId: selectedGroupId,
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
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8.5 w-8.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl shrink-0"
                                          onClick={() => removeMemberMutation.mutate({ groupId: selectedGroupId, userId: mb.userId })}
                                          title="일정 연동 해제 (그룹 퇴출)"
                                        >
                                          <UserX className="w-4.5 h-4.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

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
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl">
          <DialogHeader>
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
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl">
          <DialogHeader>
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
              <label className="text-xs font-black text-muted-foreground">일정 제목</label>
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="예: 정기 기획 회의"
                className="rounded-xl font-bold border-border bg-muted/20 focus-visible:ring-primary"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground">일정 내용/메모</label>
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
                <label className="text-xs font-black text-muted-foreground">시작일시</label>
                <Input
                  type="datetime-local"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  className="rounded-xl font-bold border-border bg-muted/20 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-muted-foreground">종료일시</label>
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
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-black text-amber-800">이 일정을 비밀 일정으로 지정</span>
                    <p className="text-[10px] font-semibold text-amber-700/70 mt-0.5">체크 시 일반 부원들에게는 노출되지 않고, 운영진과 리더에게만 실시간 노출됩니다.</p>
                  </div>
                </div>
                <Switch checked={eventIsPrivate} onCheckedChange={setEventIsPrivate} className="shrink-0" />
              </div>
            )}
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
        <DialogContent className="rounded-3xl border border-border max-w-md shadow-2xl">
          <DialogHeader>
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
    </Layout>
  );

  function setEventOpenAndReset() {
    setEventTitle("");
    setEventDesc("");
    setEventStart("");
    setEventEnd("");
    setEventIsPrivate(false);
    setEventModalOpen(true);
  }
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
