import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "post" | "user" | "comment" | "message";
  targetId: number;
}

const TYPE_LABELS: Record<string, string> = {
  post: "게시글",
  user: "사용자",
  comment: "댓글",
  message: "쪽지",
};

export default function ReportDialog({
  isOpen,
  onClose,
  targetType,
  targetId,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");

  const reportMutation = trpc.report.create.useMutation({
    onSuccess: () => {
      toast.success("신고가 정상적으로 접수되었습니다. 관리자 검토 후 조치됩니다.");
      setReason("");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "신고 접수에 실패했습니다.");
    },
  });

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error("신고 사유를 입력해주세요.");
      return;
    }
    reportMutation.mutate({ targetType, targetId, reason });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TYPE_LABELS[targetType]} 신고하기</DialogTitle>
          <DialogDescription>
            부적절한 내용이 있다면 상세히 적어주세요. 허위 신고 시 불이익을 받을 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="신고 사유를 구체적으로 작성해주세요 (최대 500자)"
            className="h-32 resize-none"
            maxLength={500}
          />
          <div className="text-right text-xs text-muted-foreground mt-2">
            {reason.length} / 500
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={reportMutation.isPending}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={reportMutation.isPending || !reason.trim()}
          >
            {reportMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            신고 접수
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
