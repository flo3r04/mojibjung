import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Search, Send, User, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export default function Messages() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedChat, setSelectedChat] = useState<{ id: number; name: string } | null>(null);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // 대화 목록 조회
  const { data: conversations, isLoading: isListLoading } = trpc.message.listConversations.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 10000 }
  );

  // 선택된 대화 내역 조회
  const { data: messages, isLoading: isChatLoading } = trpc.message.list.useQuery(
    { otherUserId: selectedChat?.id ?? 0 },
    { enabled: !!selectedChat, refetchInterval: 5000 }
  );

  // 메시지 전송
  const sendMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      setContent("");
      utils.message.list.invalidate({ otherUserId: selectedChat?.id ?? 0 });
      utils.message.listConversations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "메시지 전송에 실패했습니다.");
    },
  });

  const deleteMutation = trpc.message.delete.useMutation({
    onSuccess: () => {
      utils.message.list.invalidate({ otherUserId: selectedChat?.id ?? 0 });
      toast.success("메시지가 삭제되었습니다.");
    },
  });

  const updateMutation = trpc.message.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      utils.message.list.invalidate({ otherUserId: selectedChat?.id ?? 0 });
      toast.success("메시지가 수정되었습니다.");
    },
  });

  const handleSend = () => {
    if (!content.trim() || !selectedChat) return;
    sendMutation.mutate({
      receiverId: selectedChat.id,
      content: content.trim(),
    });
  };

  const handleUpdate = (id: number) => {
    if (!editContent.trim()) return;
    updateMutation.mutate({ id, content: editContent.trim() });
  };

  // 자동 스크롤을 위한 Ref
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <Layout>
      <div className="container py-8 md:py-12 h-[calc(100vh-140px)] min-h-[600px]">
        <div className="max-w-6xl mx-auto h-full flex flex-col md:flex-row border border-border rounded-3xl overflow-hidden bg-card shadow-sm">
          
          {/* 왼쪽: 대화 목록 */}
          <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col ${selectedChat ? "hidden md:flex" : "flex"}`}>
            <div className="p-6 border-b border-border">
              <h1 className="text-2xl font-black mb-4">메시지</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10 rounded-xl bg-muted/50 border-none" placeholder="대화 상대 검색..." />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isListLoading ? (
                  <div className="p-8 text-center text-muted-foreground animate-pulse">불러오는 중...</div>
                ) : conversations?.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">참여 중인 대화가 없습니다.</p>
                  </div>
                ) : (
                  conversations?.map((conv) => (
                    <button
                      key={conv.otherUser.id}
                      onClick={() => setSelectedChat({ id: conv.otherUser.id, name: conv.otherUser.name ?? "익명" })}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                        selectedChat?.id === conv.otherUser.id 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold flex-shrink-0">
                        {conv.otherUser.name?.[0] ?? "U"}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold truncate">{conv.otherUser.name ?? "익명"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {conv.lastMessage && formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate leading-relaxed">
                          {conv.lastMessage?.content}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                          {conv.unreadCount}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 오른쪽: 채팅창 */}
          <div className={`flex-1 flex flex-col min-h-0 bg-slate-50/30 dark:bg-slate-900/10 ${!selectedChat ? "hidden md:flex" : "flex"}`}>
            {selectedChat ? (
              <>
                {/* 헤더 */}
                <div className="p-4 md:p-6 border-b border-border bg-card flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedChat(null)}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center font-bold text-primary">
                    {selectedChat.name[0]}
                  </div>
                  <div>
                    <h2 className="font-bold leading-none">{selectedChat.name}</h2>
                    <p className="text-[10px] text-muted-foreground mt-1">대화 중</p>
                  </div>
                </div>

                {/* 메시지 영역 */}
                <ScrollArea ref={scrollRef} className="flex-1 min-h-0 p-6">
                  <div className="space-y-6">
                    {isChatLoading ? (
                      <div className="py-10 text-center text-muted-foreground">메시지를 불러오는 중...</div>
                    ) : (
                      messages?.map((msg) => {
                        const isMine = msg.senderId === user?.id;
                        const isEditing = editingId === msg.id;

                        return (
                          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} group`}>
                            <div className={`flex flex-col gap-1 max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                              <div className="flex items-center gap-2">
                                {isMine && !isEditing && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button 
                                      onClick={() => {
                                        setEditingId(msg.id);
                                        setEditContent(msg.content);
                                      }}
                                      className="p-1 hover:text-primary text-muted-foreground transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (confirm("정말 이 메시지를 삭제하시겠습니까?")) {
                                          deleteMutation.mutate({ id: msg.id });
                                        }
                                      }}
                                      className="p-1 hover:text-destructive text-muted-foreground transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                                
                                {isEditing ? (
                                  <div className="flex flex-col gap-2 w-full min-w-[200px]">
                                    <Textarea
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      className="text-sm min-h-[60px] rounded-xl"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                                      <Button size="sm" onClick={() => handleUpdate(msg.id)}>저장</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm leading-relaxed ${
                                    isMine 
                                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                                      : "bg-card text-foreground border border-border rounded-tl-none"
                                  }`}>
                                    {msg.content}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground px-1">
                                {new Date(msg.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* 입력창 */}
                <div className="p-4 md:p-6 bg-card border-t border-border">
                  <div className="flex gap-3">
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="메시지를 입력하세요..."
                      className="resize-none min-h-[48px] h-[48px] rounded-2xl border-none bg-muted/50 focus-visible:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button 
                      className="w-12 h-12 rounded-2xl flex-shrink-0" 
                      onClick={handleSend}
                      disabled={!content.trim() || sendMutation.isPending}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 opacity-20" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">선택된 대화가 없습니다</h3>
                <p className="text-sm">왼쪽 목록에서 대화를 선택해 소통을 시작하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
