import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Users, Check, X, AlertCircle, Trash } from "lucide-react";
import { toast } from "sonner";

interface MeetingTimeSchedulerProps {
  groupId?: number | null;
  studyId?: number | null;
  pollId: number;
  isLeaderOrAdmin: boolean;
  onBack: () => void;
}

export default function MeetingTimeScheduler({
  groupId,
  studyId,
  pollId,
  isLeaderOrAdmin,
  onBack,
}: MeetingTimeSchedulerProps) {
  const utils = trpc.useUtils();
  const { data: pollData, isLoading, error } = trpc.group.getTimePollDetail.useQuery({ pollId });

  // Availability state for local editing
  // Format: Record<string, string[]> (date -> timeStr[])
  const [localAvail, setLocalAvail] = useState<Record<string, string[]>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Drag select states
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragMode, setDragMode] = useState<"select" | "deselect" | null>(null);

  // Mutations
  const submitResponseMutation = trpc.group.submitTimePollResponse.useMutation({
    onSuccess: () => {
      utils.group.getTimePollDetail.invalidate({ pollId });
      toast.success("가용 시간이 저장되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const closePollMutation = trpc.group.closeTimePoll.useMutation({
    onSuccess: () => {
      utils.group.getTimePollDetail.invalidate({ pollId });
      toast.success("투표가 종료되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePollMutation = trpc.group.deleteTimePoll.useMutation({
    onSuccess: () => {
      toast.success("투표가 삭제되었습니다.");
      onBack();
    },
    onError: (err) => toast.error(err.message),
  });

  // Initialize local availability from DB
  if (pollData && !isInitialized) {
    if (pollData.myResponse) {
      setLocalAvail(pollData.myResponse.availability as Record<string, string[]>);
    } else {
      const init: Record<string, string[]> = {};
      pollData.poll.dates.forEach((d) => {
        init[d] = [];
      });
      setLocalAvail(init);
    }
    setIsInitialized(true);
  }

  if (isLoading) {
    return (
      <div className="py-20 text-center text-xs font-bold text-muted-foreground/60 animate-pulse">
        투표 상세 정보 불러오는 중...
      </div>
    );
  }

  if (error || !pollData) {
    return (
      <div className="py-16 text-center text-xs font-bold text-destructive flex flex-col items-center gap-2">
        <AlertCircle className="w-8 h-8 text-destructive/80" />
        <span>투표 데이터를 불러오는데 실패했습니다.</span>
        <Button onClick={onBack} variant="outline" className="mt-4 rounded-xl font-bold">
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  const { poll, responses, recommendations } = pollData;
  const isClosed = poll.status === "closed";

  // Generate 30-min timeslots
  const timeSlots: string[] = [];
  let [sh, sm] = poll.timeRangeStart.split(":").map(Number);
  const [eh, em] = poll.timeRangeEnd.split(":").map(Number);
  while (sh < eh || (sh === eh && sm < em)) {
    timeSlots.push(`${sh.toString().padStart(2, "0")}:${sm.toString().padStart(2, "0")}`);
    sm += 30;
    if (sm >= 60) {
      sh += 1;
      sm = 0;
    }
  }

  // Drag interaction handlers
  const handleCellMouseDown = (date: string, time: string) => {
    if (isClosed) return;
    setIsMouseDown(true);
    const dateAvail = localAvail[date] || [];
    const isCurrentlySelected = dateAvail.includes(time);
    const nextMode = isCurrentlySelected ? "deselect" : "select";
    setDragMode(nextMode);

    toggleTimeSlot(date, time, nextMode);
  };

  const handleCellMouseEnter = (date: string, time: string) => {
    if (!isMouseDown || !dragMode || isClosed) return;
    toggleTimeSlot(date, time, dragMode);
  };

  const handleCellMouseUp = () => {
    setIsMouseDown(false);
    setDragMode(null);
  };

  const toggleTimeSlot = (date: string, time: string, mode: "select" | "deselect") => {
    setLocalAvail((prev) => {
      const current = prev[date] || [];
      let updated = [...current];
      if (mode === "select" && !current.includes(time)) {
        updated.push(time);
      } else if (mode === "deselect") {
        updated = updated.filter((t) => t !== time);
      }
      return { ...prev, [date]: updated };
    });
  };

  // Availability calculation for heatmap cells
  const getCellStats = (date: string, time: string) => {
    const availUsers = responses.filter((r) => {
      const userAvail = (r.availability as Record<string, string[]>)?.[date] || [];
      return userAvail.includes(time);
    });
    return {
      count: availUsers.length,
      names: availUsers.map((u) => u.userName),
    };
  };

  const maxAvailabilityCount = responses.length;

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-muted/30 border-border/20";
    if (maxAvailabilityCount === 0) return "bg-primary/20 border-primary/30";
    const ratio = count / maxAvailabilityCount;
    if (ratio <= 0.25) return "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border-emerald-500/30";
    if (ratio <= 0.5) return "bg-emerald-500/40 text-emerald-950 dark:text-emerald-50 border-emerald-500/40";
    if (ratio <= 0.75) return "bg-emerald-500/70 text-white border-emerald-600/50";
    return "bg-emerald-600 text-white font-bold border-emerald-700/60";
  };

  // Submit local availability
  const handleSubmit = () => {
    submitResponseMutation.mutate({
      pollId,
      availability: localAvail,
    });
  };

  return (
    <div className="space-y-6" onMouseUp={handleCellMouseUp}>
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5 select-none">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>시간 조율 투표</span>
            <span className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-black uppercase tracking-wider ${
              isClosed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            }`}>
              {isClosed ? "마감됨" : "진행중"}
            </span>
          </div>
          <h3 className="text-base font-black text-foreground mt-1.5">{poll.title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {isLeaderOrAdmin && !isClosed && (
            <Button
              onClick={() => closePollMutation.mutate({ pollId })}
              variant="outline"
              size="sm"
              className="rounded-xl font-bold h-8.5 hover:bg-muted/60"
              disabled={closePollMutation.isPending}
            >
              투표 마감하기
            </Button>
          )}
          {isLeaderOrAdmin && (
            <Button
              onClick={() => {
                if (confirm("정말로 이 투표를 삭제하시겠습니까? 투표 현황 데이터가 모두 사라집니다.")) {
                  deletePollMutation.mutate({ pollId });
                }
              }}
              variant="ghost"
              size="sm"
              className="rounded-xl font-bold h-8.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              disabled={deletePollMutation.isPending}
            >
              <Trash className="w-4 h-4 mr-1.5" />
              투표 삭제
            </Button>
          )}
          <Button onClick={onBack} variant="outline" size="sm" className="rounded-xl font-bold h-8.5">
            목록으로
          </Button>
        </div>
      </div>

      {/* Main Availability Grid & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Overall Heatmap Grid */}
        <div className="lg:col-span-7 bg-card border border-border/60 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 select-none">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="font-black text-xs text-foreground">종합 투표 현황 (참여자 {responses.length}명)</h4>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[450px]">
              {/* Header: Dates */}
              <div className="grid grid-flow-col auto-cols-fr border-b border-border/40 pb-2 select-none">
                <div className="text-[10px] font-bold text-muted-foreground flex items-center justify-center">시간</div>
                {poll.dates.map((d) => (
                  <div key={d} className="text-[11px] font-black text-center text-foreground flex flex-col items-center">
                    <span>{new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
                    <span className="text-[9px] font-semibold text-muted-foreground/80 mt-0.5">
                      ({new Date(d).toLocaleDateString("ko-KR", { weekday: "short" })})
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="max-h-[50vh] overflow-y-auto mt-2 space-y-1 pr-1">
                {timeSlots.map((time) => (
                  <div key={time} className="grid grid-flow-col auto-cols-fr gap-1 items-center">
                    <div className="text-[10px] font-mono font-bold text-muted-foreground/80 text-center select-none">
                      {time}
                    </div>
                    {poll.dates.map((date) => {
                      const { count, names } = getCellStats(date, time);
                      const colorClass = getHeatmapColor(count);
                      return (
                        <div
                          key={`${date}-${time}`}
                          className={`h-7 border rounded-md transition-all flex items-center justify-center text-[9px] cursor-help relative group ${colorClass}`}
                          title={`${count}명 가능: ${names.join(", ") || "없음"}`}
                        >
                          {count > 0 && <span className="opacity-90">{count}명</span>}
                          
                          {/* Rich hover tooltip */}
                          {count > 0 && (
                            <div className="absolute z-10 hidden group-hover:block bg-slate-900 text-white p-2.5 rounded-xl text-[10px] font-medium leading-relaxed shadow-xl border border-slate-700/60 -bottom-1 translate-y-full left-1/2 -translate-x-1/2 min-w-44 select-none">
                              <span className="font-black block text-amber-400 border-b border-slate-700 pb-1 mb-1">
                                {count}명 가능 ({Math.round((count / maxAvailabilityCount) * 100)}%)
                              </span>
                              <div className="max-h-24 overflow-y-auto space-y-0.5">
                                {names.map((n, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    <span>{n}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Personal Availability Grid Editor */}
        <div className="lg:col-span-5 bg-card border border-border/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4 select-none">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h4 className="font-black text-xs text-foreground">내 가용 시간 입력</h4>
              </div>
              {!isClosed && (
                <span className="text-[9px] font-semibold text-muted-foreground/80">
                  그리드를 드래그하여 입력하세요
                </span>
              )}
            </div>

            <div className="overflow-x-auto select-none">
              <div className="min-w-[300px]">
                {/* Header: Dates */}
                <div className="grid grid-flow-col auto-cols-fr border-b border-border/40 pb-2">
                  <div className="text-[10px] font-bold text-muted-foreground flex items-center justify-center">시간</div>
                  {poll.dates.map((d) => (
                    <div key={d} className="text-[10px] font-bold text-center text-foreground">
                      {new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </div>
                  ))}
                </div>

                {/* Grid Body */}
                <div className="max-h-[50vh] overflow-y-auto mt-2 space-y-1 pr-1">
                  {timeSlots.map((time) => (
                    <div key={time} className="grid grid-flow-col auto-cols-fr gap-1 items-center">
                      <div className="text-[10px] font-mono font-bold text-muted-foreground/80 text-center">
                        {time}
                      </div>
                      {poll.dates.map((date) => {
                        const dateAvail = localAvail[date] || [];
                        const isSelected = dateAvail.includes(time);
                        return (
                          <div
                            key={`${date}-${time}`}
                            onMouseDown={() => handleCellMouseDown(date, time)}
                            onMouseEnter={() => handleCellMouseEnter(date, time)}
                            className={`h-7 border rounded-md transition-all flex items-center justify-center ${
                              isClosed ? "cursor-not-allowed" : "cursor-pointer"
                            } ${
                              isSelected
                                ? "bg-primary text-white border-primary shadow-xs font-bold"
                                : "bg-muted/10 border-border/60 hover:bg-muted/30"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 mt-6">
            {isClosed ? (
              <div className="p-3 bg-muted/30 border border-border/50 rounded-2xl text-[11px] font-bold text-muted-foreground text-center flex items-center justify-center gap-1.5 select-none">
                <X className="w-4 h-4 text-muted-foreground/80" />
                <span>투표가 종료되어 더 이상 제출/수정할 수 없습니다.</span>
              </div>
            ) : (
              <Button
                onClick={handleSubmit}
                className="w-full rounded-2xl font-black bg-primary text-white py-3 shadow-md transition-transform active:scale-99"
                disabled={submitResponseMutation.isPending}
              >
                가용 시간 저장 완료
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 select-none animate-fadeIn">
        <h4 className="font-black text-xs text-primary mb-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          가장 많이 겹치는 추천 시간대 (Top 5)
        </h4>

        {recommendations.length === 0 ? (
          <p className="text-xs text-muted-foreground/80 font-bold py-2">
            아직 투표한 단원이 없습니다. 가용한 시간을 먼저 남겨보세요!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.map((rec: any, idx: number) => {
              const dateStr = new Date(rec.date).toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              });
              const rankMedals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
              return (
                <div
                  key={idx}
                  className="bg-card border border-border/60 p-3.5 rounded-2xl shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-wider block mb-1">
                      {rankMedals[idx] ?? `${idx + 1}순위`}
                    </span>
                    <span className="text-xs font-black text-foreground block">{dateStr}</span>
                    <span className="text-[11px] font-bold text-muted-foreground mt-1 block">
                      {rec.startTime} ~ {rec.endTime} ({rec.durationMinutes}분 간)
                    </span>
                  </div>
                  <div className="border-t border-border/40 pt-2.5 mt-3 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                    <span>가능한 인원: {rec.count}명</span>
                    <span className="text-primary/90 text-[9px] truncate max-w-28" title={rec.userNames.join(", ")}>
                      {rec.userNames.join(", ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
