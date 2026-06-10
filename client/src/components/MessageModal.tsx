import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface MessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: number;
  receiverName: string;
  postId?: number;
}

export default function MessageModal({
  open,
  onOpenChange,
  receiverId,
  receiverName,
  postId,
}: MessageModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // 대화 내역 조회
  const { data: messages, isLoading } = trpc.message.list.useQuery(
    { otherUserId: receiverId },
    { enabled: open && !!receiverId, refetchInterval: 5000 } // 5초마다 갱신 (폴링)
  );

  // 메시지 전송 뮤테이션
  const sendMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      setContent("");
      utils.message.list.invalidate({ otherUserId: receiverId });
      utils.message.listConversations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "메시지 전송에 실패했습니다.");
    },
  });

  const handleSend = () => {
    if (!content.trim()) return;
    sendMutation.mutate({
      receiverId,
      postId,
      content: content.trim(),
    });
  };

  // 메시지 로드 시 스크롤 하단으로 이동
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden flex flex-col h-[600px]">
        <DialogHeader className="p-4 border-b border-border bg-card">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-4 h-4" />
            </div>
            <span className="font-bold">{receiverName}님과의 대화</span>
          </DialogTitle>
        </DialogHeader>

        {/* 메시지 목록 구역 */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : messages?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                대화 내역이 없습니다. 메시지를 보내보세요!
              </div>
            ) : (
              messages?.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isMine
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-card text-foreground border border-border rounded-tl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-1 opacity-70 ${
                          isMine ? "text-right" : "text-left"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* 입력 구역 */}
        <div className="p-4 bg-card border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="resize-none min-h-[44px] h-[44px] py-3 rounded-xl border-border focus-visible:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className="h-[44px] w-[44px] rounded-xl flex-shrink-0"
              disabled={!content.trim() || sendMutation.isPending}
              onClick={handleSend}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Shift + Enter로 줄바꿈이 가능합니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
