import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  CalendarRange,
  Clock,
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  Bookmark,
  Info,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  School,
  CalendarDays,
  CalendarCheck,
  Tag,
  CheckCircle,
  Key,
  Users,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { DayButton } from "react-day-picker";
import { format, startOfDay, endOfDay, isWithinInterval, parseISO, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

type CalendarCategory = "academic" | "personal" | "holiday" | "recruitment" | "group";

interface CalendarEvent {
  id: string;
  dbId?: number;
  groupId?: number;
  title: string;
  description: string | null;
  startDate: string | Date;
  endDate: string | Date;
  category: CalendarCategory;
  postId?: number;
  isPrivate?: number;
}

const CATEGORY_CONFIG: Record<
  CalendarCategory,
  { label: string; dotClass: string; badgeClass: string; textClass: string }
> = {
  academic: {
    label: "학사일정",
    dotClass: "bg-sky-400 shadow-sky-400/50",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60",
    textClass: "text-sky-700 dark:text-sky-300",
  },
  holiday: {
    label: "공휴일",
    dotClass: "bg-red-400 shadow-red-400/50",
    badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60",
    textClass: "text-red-700 dark:text-red-300",
  },
  recruitment: {
    label: "모집 마감일",
    dotClass: "bg-rose-400 shadow-rose-400/50",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
    textClass: "text-rose-700 dark:text-rose-300",
  },
  personal: {
    label: "개인 일정",
    dotClass: "bg-indigo-400 shadow-indigo-400/50",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60",
    textClass: "text-indigo-700 dark:text-indigo-300",
  },
  group: {
    label: "그룹 일정",
    dotClass: "bg-emerald-400 shadow-emerald-400/50",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-350 dark:border-emerald-900/60",
    textClass: "text-emerald-700 dark:text-emerald-350",
  },
};

export default function CalendarPage() {
  const { user, isAuthenticated } = useAuth();
  
  // 상태 관리
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
  
  // 모달 상태
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // 입력 폼 상태
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  
  // 수정 폼 상태
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // 그룹 일정 관련 추가 상태
  const [newCategory, setNewCategory] = useState<"personal" | "group">("personal");
  const [newGroupId, setNewGroupId] = useState<number | null>(null);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [accessKey, setAccessKey] = useState("");

  // tRPC 쿼리 및 뮤테이션
  const { data: events = [], isLoading, refetch } = trpc.calendar.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.calendar.create.useMutation({
    onSuccess: () => {
      toast.success("개인 일정이 등록되었습니다.");
      setIsAddOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "일정 등록 중 오류가 발생했습니다.");
    },
  });

  const updateMutation = trpc.calendar.update.useMutation({
    onSuccess: () => {
      toast.success("일정이 수정되었습니다.");
      setIsEditing(false);
      setIsDetailOpen(false);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "일정 수정 중 오류가 발생했습니다.");
    },
  });

  const deleteMutation = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      toast.success("일정이 삭제되었습니다.");
      setIsDetailOpen(false);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "일정 삭제 중 오류가 발생했습니다.");
    },
  });

  // 그룹 가입 뮤테이션
  const joinGroupMutation = trpc.group.join.useMutation({
    onSuccess: (res) => {
      if (res.alreadyJoined) {
        toast.info(`이미 연동되어 있는 그룹입니다: ${res.group.name}`);
      } else {
        toast.success(`그룹 '${res.group.name}'의 일정이 성공적으로 연동되었습니다!`);
      }
      setAccessKey("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "연동에 실패했습니다. 키를 확인해주세요.");
    },
  });

  // 연동되어 있는 참여 그룹 목록 조회
  const { data: myJoinedGroups = [] } = trpc.group.myJoinedGroups.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 편집/작성 권한이 있는 그룹 목록 필터링
  const manageableGroups = myJoinedGroups.filter(
    (g) => g.isLeader || g.canManageSchedule || user?.role === "admin"
  );

  // 그룹 일정 생성 뮤테이션
  const createGroupEventMutation = trpc.group.createEvent.useMutation({
    onSuccess: () => {
      toast.success("그룹 일정이 등록되었습니다.");
      setIsAddOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "그룹 일정 등록 중 오류가 발생했습니다.");
    },
  });

  // 그룹 일정 수정 뮤테이션
  const updateGroupEventMutation = trpc.group.updateEvent.useMutation({
    onSuccess: () => {
      toast.success("그룹 일정이 수정되었습니다.");
      setIsEditing(false);
      setIsDetailOpen(false);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "그룹 일정 수정 중 오류가 발생했습니다.");
    },
  });

  // 그룹 일정 삭제 뮤테이션
  const deleteGroupEventMutation = trpc.group.deleteEvent.useMutation({
    onSuccess: () => {
      toast.success("그룹 일정이 삭제되었습니다.");
      setIsDetailOpen(false);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "그룹 일정 삭제 중 오류가 발생했습니다.");
    },
  });

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-lg py-24 px-4 flex items-center justify-center min-h-[70vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-card/65 backdrop-blur-md rounded-3xl border border-border p-8 text-center shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-sky-400 to-rose-400" />
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CalendarRange className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-4">로그인이 필요한 서비스입니다</h1>
            <p className="text-muted-foreground font-medium mb-8 text-sm leading-relaxed">
              마이 캘린더 기능은 한국외대 글로벌캠퍼스 학생을 위한 전용 기능입니다.<br />
              로그인하시면 학사일정 및 개인 일정 관리 서비스를 이용하실 수 있습니다.
            </p>
            <Button
              className="w-full font-bold py-4 rounded-xl shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground"
              onClick={() => (window.location.href = getLoginUrl())}
            >
              로그인하고 시작하기
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewStartDate(format(new Date(), "yyyy-MM-dd"));
    setNewEndDate(format(new Date(), "yyyy-MM-dd"));
    setNewIsPrivate(false);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    // 클릭했을 때 해당 날짜에 있는 이벤트를 Agenda에서 바로 확인할 수 있도록 focus
    // 또한 개인 일정을 쉽게 추가할 수 있도록 폼 초기값 채우기
    const dateStr = format(date, "yyyy-MM-dd");
    setNewStartDate(dateStr);
    setNewEndDate(dateStr);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("일정 제목을 입력해주세요.");
      return;
    }
    
    if (newCategory === "group") {
      if (!newGroupId) {
        toast.error("일정을 등록할 그룹을 선택해주세요.");
        return;
      }
      createGroupEventMutation.mutate({
        groupId: newGroupId,
        title: newTitle,
        description: newDescription || undefined,
        startDate: newStartDate,
        endDate: newEndDate,
        isPrivate: newIsPrivate ? 1 : 0,
      });
    } else {
      createMutation.mutate({
        title: newTitle,
        description: newDescription || undefined,
        startDate: newStartDate,
        endDate: newEndDate,
      });
    }
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedEvent.dbId) return;
    if (!editTitle.trim()) {
      toast.error("일정 일정 제목을 입력해주세요.");
      return;
    }
    if (selectedEvent.category === "group") {
      if (!selectedEvent.groupId) return;
      updateGroupEventMutation.mutate({
        id: selectedEvent.dbId,
        groupId: selectedEvent.groupId,
        title: editTitle,
        description: editDescription || undefined,
        startDate: editStartDate,
        endDate: editEndDate,
        isPrivate: editIsPrivate ? 1 : 0,
      });
    } else {
      updateMutation.mutate({
        id: selectedEvent.dbId,
        title: editTitle,
        description: editDescription || undefined,
        startDate: editStartDate,
        endDate: editEndDate,
      });
    }
  };

  const handleDeleteClick = () => {
    if (!selectedEvent || !selectedEvent.dbId) return;
    if (confirm("정말로 이 일정을 삭제하시겠습니까?")) {
      if (selectedEvent.category === "group") {
        if (!selectedEvent.groupId) return;
        deleteGroupEventMutation.mutate({
          id: selectedEvent.dbId,
          groupId: selectedEvent.groupId,
        });
      } else {
        deleteMutation.mutate({ id: selectedEvent.dbId });
      }
    }
  };

  const startEdit = () => {
    if (!selectedEvent) return;
    setEditTitle(selectedEvent.title);
    setEditDescription(selectedEvent.description || "");
    setEditStartDate(format(new Date(selectedEvent.startDate), "yyyy-MM-dd"));
    setEditEndDate(format(new Date(selectedEvent.endDate), "yyyy-MM-dd"));
    setEditIsPrivate(selectedEvent.isPrivate === 1);
    setIsEditing(true);
  };

  const openAddModal = () => {
    const formatted = format(selectedDate, "yyyy-MM-dd");
    setNewStartDate(formatted);
    setNewEndDate(formatted);
    setIsAddOpen(true);
  };

  // 특정 일자(date)가 이벤트 기간 내에 있는지 판별하는 도우미
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const checkDateStart = startOfDay(date);
    const checkDateEnd = endOfDay(date);
    
    return events.filter((e) => {
      const start = startOfDay(new Date(e.startDate));
      const end = endOfDay(new Date(e.endDate));
      return checkDateStart >= start && checkDateStart <= end;
    });
  };

  // 날짜 필터링 및 Agenda 일정 정렬
  const filteredAgendaEvents = events.filter((e) => {
    // 1. 카테고리 필터링
    if (activeCategoryFilter !== "all" && e.category !== activeCategoryFilter) {
      return false;
    }
    // 2. 이번 달(selectedDate 기준)에 속하거나 걸쳐있는 일정만 Agenda에 보여주기
    const eventStart = new Date(e.startDate);
    const eventEnd = new Date(e.endDate);
    const targetMonth = selectedDate.getMonth();
    const targetYear = selectedDate.getFullYear();
    
    return (
      (eventStart.getMonth() === targetMonth && eventStart.getFullYear() === targetYear) ||
      (eventEnd.getMonth() === targetMonth && eventEnd.getFullYear() === targetYear) ||
      (eventStart <= new Date(targetYear, targetMonth, 1) && eventEnd >= new Date(targetYear, targetMonth + 1, 0))
    );
  }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // 선택한 단일 날짜의 일정들
  const selectedDateEvents = getEventsForDate(selectedDate);

  // 특정 날짜가 속한 주의 모든 이벤트에 대해 고정된 3개 라인(lane) 할당 (중복 방지 및 수평 정렬)
  const getWeekEventLanes = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // 일요일
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 }); // 토요일

    // 이번 주와 겹치는 모든 이벤트 필터링
    const weekEvents = events.filter((e) => {
      const start = startOfDay(new Date(e.startDate));
      const end = endOfDay(new Date(e.endDate));
      return start <= weekEnd && end >= weekStart;
    });

    // 정렬 규칙: 1. 기간이 긴 것 우선, 2. 시작일이 빠른 것 우선, 3. 제목 사전순
    const sorted = [...weekEvents].sort((a, b) => {
      const aStart = new Date(a.startDate).getTime();
      const bStart = new Date(b.startDate).getTime();
      const aEnd = new Date(a.endDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      const aLen = aEnd - aStart;
      const bLen = bEnd - bStart;

      if (aLen !== bLen) return bLen - aLen;
      if (aStart !== bStart) return aStart - bStart;
      return a.title.localeCompare(b.title);
    });

    // 각 라인별 차지하는 일정 기록 (최대 3개 라인)
    const lanes: CalendarEvent[][] = [[], [], []];
    const eventToLane = new Map<string, number>();

    for (const event of sorted) {
      const eventStart = startOfDay(new Date(event.startDate));
      const eventEnd = endOfDay(new Date(event.endDate));

      let assignedLane = -1;
      for (let l = 0; l < 3; l++) {
        const laneEvents = lanes[l];
        const isOccupied = laneEvents.some((le) => {
          const leStart = startOfDay(new Date(le.startDate));
          const leEnd = endOfDay(new Date(le.endDate));
          return eventStart <= leEnd && eventEnd >= leStart;
        });

        if (!isOccupied) {
          assignedLane = l;
          break;
        }
      }

      if (assignedLane !== -1) {
        lanes[assignedLane].push(event);
        eventToLane.set(event.id, assignedLane);
      }
    }

    return { eventToLane, lanes };
  };

  // 커스텀 DayButton 컴포넌트: 달력 셀 내부를 렌더링하고, 주말/공휴일 빨간색 강조 및 일정 바(Bar) 수평 연결 구현
  const CustomDayButton = (dayButtonProps: React.ComponentProps<typeof DayButton>) => {
    const { day, modifiers, className, ...rest } = dayButtonProps;
    
    const dayEvents = getEventsForDate(day.date);
    const isSunday = day.date.getDay() === 0;
    const isHoliday = dayEvents.some((e) => e.category === "holiday");
    const isWeekendOrHoliday = isSunday || isHoliday;
    const isSaturday = day.date.getDay() === 6;

    const isSelected = modifiers.selected;

    const barColors: Record<CalendarCategory, string> = {
      academic: "bg-sky-50 text-sky-700 border-sky-150 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50",
      holiday: "bg-red-50 text-red-750 border-red-150 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50",
      recruitment: "bg-rose-50 text-rose-750 border-rose-150 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50",
      personal: "bg-indigo-50 text-indigo-750 border-indigo-150 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/50",
      group: "bg-emerald-50 text-slate-950 font-bold border-emerald-150 dark:bg-emerald-950/30 dark:text-emerald-50 dark:border-emerald-900/50",
    };

    const { eventToLane, lanes } = getWeekEventLanes(day.date);

    // 이번 주에 등록된 이벤트 중 최대 차지하는 라인 인덱스 구하기
    let maxLaneIndex = -1;
    eventToLane.forEach((laneIdx) => {
      if (laneIdx > maxLaneIndex) maxLaneIndex = laneIdx;
    });

    const renderedLanes: React.ReactNode[] = [];
    if (maxLaneIndex >= 0) {
      for (let l = 0; l <= Math.min(maxLaneIndex, 2); l++) {
        const laneEvent = lanes[l].find((e) => {
          const start = startOfDay(new Date(e.startDate));
          const end = endOfDay(new Date(e.endDate));
          const current = startOfDay(day.date);
          return current >= start && current <= end;
        });

        if (laneEvent) {
          const barClass = barColors[laneEvent.category];
          const eventStart = startOfDay(new Date(laneEvent.startDate));
          const eventEnd = endOfDay(new Date(laneEvent.endDate));

          // 단일일 일정은 continuesNext/Prev 모두 false
          const continuesNext = !isSaturday && eventEnd > endOfDay(day.date);
          const continuesPrev = !isSunday && eventStart < startOfDay(day.date);

          // 캘린더 전체 표시 범위와 이벤트 기간의 교집합을 구해, 교집합의 정중앙 날짜에 딱 1번만 텍스트 노출
          const targetMonth = day.date.getMonth();
          const targetYear = day.date.getFullYear();
          const firstDayOfMonth = new Date(targetYear, targetMonth, 1);
          const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0);
          
          const viewStart = startOfDay(startOfWeek(firstDayOfMonth, { weekStartsOn: 0 }));
          const viewEnd = endOfDay(endOfWeek(lastDayOfMonth, { weekStartsOn: 0 }));

          const visibleStart = new Date(Math.max(eventStart.getTime(), viewStart.getTime()));
          const visibleEnd = new Date(Math.min(eventEnd.getTime(), viewEnd.getTime()));

          const diffTime = visibleEnd.getTime() - visibleStart.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          const midDayOffset = Math.floor(diffDays / 2);
          const textDate = startOfDay(new Date(visibleStart.getTime() + midDayOffset * 24 * 60 * 60 * 1000));

          // 교집합 내 정중앙 날짜에만 텍스트 노출
          const shouldShowText = isSameDay(day.date, textDate);

          renderedLanes.push(
            <div
              key={laneEvent.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEvent(laneEvent);
                setIsEditing(false);
                setIsDetailOpen(true);
              }}
              className={cn(
                "text-[10px] font-bold px-1 py-0.5 border leading-tight transition-all duration-150 hover:brightness-95 min-h-[20px] h-auto flex items-center select-none cursor-pointer text-left justify-start",
                barClass,
                continuesPrev ? "rounded-l-none ml-[-7px] pl-0 border-l-0" : "rounded-l-md",
                continuesNext ? "rounded-r-none mr-[-7px] pr-0 border-r-0" : "rounded-r-md"
              )}
              title={laneEvent.title}
            >
              {shouldShowText ? (
                <span className="w-full text-left flex items-start justify-start flex-wrap gap-0.5 break-all whitespace-normal px-0.5">
                  {laneEvent.category === "group" && laneEvent.isPrivate === 1 && (
                    <Lock className="w-2.5 h-2.5 inline shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <span>{laneEvent.title}</span>
                </span>
              ) : (
                <span className="opacity-0 select-none">&nbsp;</span>
              )}
            </div>
          );
        } else {
          // 이 라인에 일정 없으면 Spacer로 높이 유지
          renderedLanes.push(
            <div key={`empty-lane-${l}`} className="h-5 opacity-0 pointer-events-none select-none">
              &nbsp;
            </div>
          );
        }
      }
    }

    // 렌더링된 이벤트 수와 실제 총 이벤트 수 차이 계산하여 D-Day 더보기 카운트 산정
    const renderedVisibleCount = lanes.slice(0, 3).filter((lane) => {
      return lane.some((e) => {
        const start = startOfDay(new Date(e.startDate));
        const end = endOfDay(new Date(e.endDate));
        const current = startOfDay(day.date);
        return current >= start && current <= end;
      });
    }).length;

    const hiddenCount = dayEvents.length - renderedVisibleCount;

    return (
      <CalendarDayButton
        day={day}
        modifiers={modifiers}
        className={cn(
          className,
          "relative transition-all duration-200 hover:bg-muted/40",
          "h-full w-full aspect-auto flex flex-col justify-start items-stretch p-1 min-h-[90px] md:min-h-[110px]",
          isWeekendOrHoliday && "text-rose-500 font-bold",
          isSaturday && "text-sky-500 font-semibold",
          isSelected && "data-[selected-single=true]:bg-primary/5 data-[selected-single=true]:text-foreground bg-primary/5 ring-1 ring-primary text-foreground font-black shadow-xs"
        )}
        {...rest}
      >
        <div className="flex flex-col items-stretch justify-start h-full w-full py-0.5 text-left select-none gap-1 overflow-visible">
          {/* 일자 헤더 */}
          <div className="flex items-center justify-start px-1">
            <span className={cn(
              "text-xs font-bold flex items-center justify-center w-6 h-6 rounded-full transition-all",
              isSelected ? "text-primary-foreground bg-primary font-black shadow-sm" : ""
            )}>
              {day.date.getDate()}
            </span>
          </div>

          {/* 일정 바 리스트 */}
          <div className="flex flex-col gap-0.5 mt-0.5 px-0.5 overflow-visible">
            {renderedLanes}
            
            {hiddenCount > 0 && (
              <div className="text-[9px] font-black text-muted-foreground px-1 py-0.5">
                + {hiddenCount}개 더보기
              </div>
            )}
          </div>
        </div>
      </CalendarDayButton>
    );
  };

  return (
    <Layout className="bg-background/95">
      <div className="container max-w-7xl py-8 px-4">
        {/* 헤더 섹션 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400/20 to-primary/20 flex items-center justify-center border border-primary/20 shadow-sm">
              <CalendarRange className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <School className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400 tracking-wider">
                  한국외국어대학교 글로벌캠퍼스 2026
                </span>
              </div>
              <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                마이 캘린더
              </h1>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">
                학사일정 및 주말/공휴일, 북마크 마감일과 개인 일정을 직관적이고 아름답게 관리하세요.
              </p>
            </div>
          </div>
          
          <Button
            onClick={openAddModal}
            className="flex items-center gap-2 font-bold px-5 py-6 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground shadow-md shadow-primary/10 self-start md:self-center"
          >
            <Plus className="w-5 h-5" />
            새 일정 추가
          </Button>
        </div>

        {/* 메인 콘텐츠 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 좌측: 전용 캘린더 그리드 */}
          <div className="lg:col-span-8 bg-card/65 backdrop-blur-md rounded-3xl border border-border p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-sky-300 via-primary/30 to-indigo-300" />
            
            <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary/80" />
                  캘린더 뷰
                </h2>
                <p className="text-xs text-muted-foreground font-semibold">
                  날짜를 선택해 상세 일정을 확인하거나 개인 일정을 등록해보세요.
                </p>
              </div>
              <Badge variant="outline" className="font-bold border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-850 px-3 py-1">
                {format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })}
              </Badge>
            </div>

            <div className="w-full flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && handleDayClick(date)}
                onMonthChange={(date) => date && setSelectedDate(date)}
                locale={ko}
                className="w-full max-w-full p-0 flex flex-col justify-center border-0 gap-4"
                classNames={{
                  root: "w-full relative",
                  months: "w-full relative flex flex-col gap-4",
                  month: "w-full gap-4 flex flex-col",
                  table: "w-full border-collapse mt-2 table-fixed",
                  weekdays: "flex w-full mb-1 border-b border-border/40 pb-2 justify-between",
                  weekday: "text-muted-foreground font-bold text-[0.8rem] w-[14.2857%] min-w-[14.2857%] max-w-[14.2857%] text-center py-1 flex-1",
                  week: "flex w-full mt-1.5 min-h-[90px] md:min-h-[110px] border-b border-border/20 last:border-b-0 justify-between",
                  day: "h-full w-[14.2857%] min-w-[14.2857%] max-w-[14.2857%] p-0 group flex-1",
                  month_caption: "flex items-center justify-center h-12 w-full text-lg font-black text-foreground relative z-10",
                  nav: "flex items-center justify-between absolute top-1.5 inset-x-0 w-full z-20 px-2 pointer-events-none",
                  button_previous: "pointer-events-auto hover:bg-muted/80 rounded-xl p-2 transition-all w-9 h-9 flex items-center justify-center border border-border/60 bg-card shadow-xs cursor-pointer",
                  button_next: "pointer-events-auto hover:bg-muted/80 rounded-xl p-2 transition-all w-9 h-9 flex items-center justify-center border border-border/60 bg-card shadow-xs cursor-pointer",
                }}
                components={{
                  DayButton: CustomDayButton,
                }}
              />
            </div>

            {/* 하단 범례 */}
            <div className="flex flex-wrap gap-6 mt-6 pt-4 border-t border-border/60 justify-center text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span>공휴일 / 일요일</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-400" />
                <span>학사일정</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-400" />
                <span>모집 마감일</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-400" />
                <span>개인 일정</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span>그룹 일정</span>
              </div>
            </div>
          </div>

          {/* 우측: 다가오는 주요 학사 및 개인 일정 리스트 (Agenda D-Day) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* 1. 선택일 일정 상세 요약 */}
            <div className="bg-card/65 backdrop-blur-md rounded-3xl border border-border p-6 shadow-md">
              <h2 className="text-md font-black text-foreground mb-3 flex items-center gap-2 border-b border-border/40 pb-2">
                <CalendarCheck className="w-4.5 h-4.5 text-indigo-500" />
                {format(selectedDate, "M월 d일 (E)", { locale: ko })} 일정
              </h2>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {selectedDateEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs font-medium">등록된 일정이 없습니다.</p>
                    <button
                      onClick={openAddModal}
                      className="mt-3 text-xs text-primary font-bold hover:underline"
                    >
                      + 새 개인 일정 추가
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDateEvents.map((event) => {
                      const config = CATEGORY_CONFIG[event.category];
                      return (
                        <div
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setIsEditing(false);
                            setIsDetailOpen(true);
                          }}
                          className={cn(
                            "p-3 rounded-xl border transition-all cursor-pointer hover:translate-x-1 flex flex-col gap-1.5",
                            config.badgeClass
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs">{config.label}</span>
                              {event.category === "group" && (
                                event.isPrivate === 1 ? (
                                  <span className="bg-amber-100/60 border border-amber-250 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 select-none shrink-0 scale-95 origin-left">
                                    <Lock className="w-2.5 h-2.5 shrink-0" /> 비밀
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100/60 border border-emerald-250 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 select-none shrink-0 scale-95 origin-left">
                                    공식
                                  </span>
                                )
                              )}
                            </div>
                            <Clock className="w-3.5 h-3.5 opacity-60" />
                          </div>
                          <h3 className="font-bold text-sm line-clamp-1">{event.title}</h3>
                        </div>
                      );
                    })}
                    <button
                      onClick={openAddModal}
                      className="w-full mt-2 py-2.5 flex items-center justify-center gap-1.5 text-xs text-primary font-bold hover:bg-primary/5 rounded-xl border border-dashed border-primary/25 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      새 일정 추가하기
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. 전체 어젠다 리스트 */}
            <div className="bg-card/65 backdrop-blur-md rounded-3xl border border-border p-6 shadow-md flex-1 flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-3">
                <h2 className="text-md font-black text-foreground flex items-center gap-2">
                  <Tag className="w-4.5 h-4.5 text-sky-500" />
                  이번 달 전체 일정
                </h2>
                <Badge variant="secondary" className="font-bold">
                  {filteredAgendaEvents.length}개
                </Badge>
              </div>

              {/* 카테고리 필터링 칩 */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[
                  { value: "all", label: "전체" },
                  { value: "academic", label: "학사" },
                  { value: "recruitment", label: "모집마감" },
                  { value: "personal", label: "개인" },
                  { value: "group", label: "그룹" },
                  { value: "holiday", label: "공휴일" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setActiveCategoryFilter(item.value)}
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all border cursor-pointer",
                      activeCategoryFilter === item.value
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/75"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 일정 목록 */}
              <div className="space-y-2.5 overflow-y-auto max-h-[350px] pr-1 flex-1">
                {filteredAgendaEvents.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Info className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs font-semibold">조건에 맞는 일정이 없습니다.</p>
                  </div>
                ) : (
                  filteredAgendaEvents.map((event) => {
                    const config = CATEGORY_CONFIG[event.category as CalendarCategory];
                    const sDate = new Date(event.startDate);
                    const eDate = new Date(event.endDate);
                    
                    // D-Day 계산
                    const today = startOfDay(new Date());
                    const target = startOfDay(sDate);
                    const diffTime = target.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let dDayStr = "";
                    if (diffDays === 0) dDayStr = "D-Day";
                    else if (diffDays > 0) dDayStr = `D-${diffDays}`;
                    else dDayStr = `종료`;

                    return (
                      <motion.div
                        layoutId={event.id}
                        key={event.id}
                        onClick={() => {
                          setSelectedEvent(event);
                          setIsEditing(false);
                          setIsDetailOpen(true);
                        }}
                        className={cn(
                          "p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm hover:translate-x-1 flex items-center justify-between gap-4",
                          config.badgeClass
                        )}
                      >
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-85">
                              {config.label}
                            </span>
                            {event.category === "group" && (
                              event.isPrivate === 1 ? (
                                <Badge variant="outline" className="bg-amber-100/40 border-amber-300 text-amber-700 text-[9px] font-black px-1.5 py-0 rounded flex items-center gap-1 select-none shrink-0 scale-95 origin-left">
                                  <Lock className="w-2.5 h-2.5 shrink-0" /> 비밀 일정
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-100/40 border-emerald-300 text-emerald-700 text-[9px] font-black px-1.5 py-0 rounded flex items-center gap-1 select-none shrink-0 scale-95 origin-left">
                                  공식 일정
                                </Badge>
                              )
                            )}
                            <span className="text-[10px] opacity-70">
                              {format(sDate, "MM.dd")}
                              {!isSameDay(sDate, eDate) && ` ~ ${format(eDate, "MM.dd")}`}
                            </span>
                          </div>
                          <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary">
                            {event.title}
                          </h3>
                        </div>

                        <Badge
                          className={cn(
                            "font-black text-xs px-2.5 py-0.5 rounded-full shrink-0 border",
                            event.category === "holiday" ? "bg-red-100 text-red-700 border-red-200" :
                            event.category === "recruitment" ? "bg-rose-100 text-rose-700 border-rose-200" :
                            event.category === "academic" ? "bg-sky-100 text-sky-700 border-sky-200" :
                            "bg-indigo-100 text-indigo-700 border-indigo-200"
                          )}
                        >
                          {dDayStr}
                        </Badge>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. 동아리 및 스터디 일정 연동 카드 */}
            <div className="bg-card/65 backdrop-blur-md rounded-3xl border border-border p-6 shadow-md mt-6">
              <h2 className="text-md font-black text-foreground flex items-center gap-2 mb-3 border-b border-border/40 pb-2">
                <Key className="w-4.5 h-4.5 text-emerald-500" />
                동아리 / 스터디 일정 연동
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed font-semibold mb-4">
                지급받은 고유 키(Access Key)를 등록하면, 해당 단체의 활동 일정이 본인의 캘린더에 자동으로 동기화됩니다.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!accessKey.trim()) {
                    toast.error("고유 키를 입력해주세요.");
                    return;
                  }
                  joinGroupMutation.mutate({ accessKey });
                }}
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <Input
                    placeholder="예: XXXX-XXXX-XXXX"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    className="rounded-xl h-10 text-xs font-mono font-bold tracking-wider uppercase bg-card"
                  />
                  <Button
                    type="submit"
                    className="h-10 px-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white font-sans text-xs flex items-center gap-1 shrink-0"
                    disabled={joinGroupMutation.isPending}
                  >
                    {joinGroupMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "연동"
                    )}
                  </Button>
                </div>
              </form>

              {/* 내가 스케줄을 관리하는 그룹 목록 표시 */}
              {manageableGroups.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border/40 space-y-2">
                  <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    내가 스케줄을 관리하는 그룹
                  </h3>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {manageableGroups.map((g) => (
                      <div 
                        key={g.id} 
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 text-[11px]"
                      >
                        <span className="font-bold text-foreground truncate max-w-[110px]">{g.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(g.accessKey);
                            toast.success(`'${g.name}' 그룹 키가 복사되었습니다!`);
                          }}
                          title="클릭하여 고유 키 복사"
                          className="font-mono text-[9.5px] bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 hover:bg-emerald-500 hover:text-white px-2 py-0.5 rounded font-black border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          {g.accessKey} (복사)
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 font-medium">
                    * 리더는 새 일정을 추가할 때 해당 그룹을 선택하여 스케줄을 대량 관리할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. 일정 추가 모달 */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md rounded-2xl border-border bg-card/90 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                <Plus className="w-5 h-5 text-primary" />
                {newCategory === "group" ? "그룹 일정 등록" : "개인 일정 등록"}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                {newCategory === "group" 
                  ? "선택한 그룹의 모든 멤버에게 실시간 연동되어 표시되는 일정을 생성합니다."
                  : "선택한 날짜에 표시될 나만의 일정을 생성합니다."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
              {manageableGroups.length > 0 && (
                <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl border border-border/60">
                  <label className="text-xs font-black text-foreground">일정 유형 선택</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategory("personal");
                        setNewGroupId(null);
                      }}
                      className={cn(
                        "flex-1 text-xs py-2 rounded-lg font-bold border transition-all cursor-pointer",
                        newCategory === "personal"
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      개인 일정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategory("group");
                        if (manageableGroups.length > 0 && !newGroupId) {
                          setNewGroupId(manageableGroups[0].id);
                        }
                      }}
                      className={cn(
                        "flex-1 text-xs py-2 rounded-lg font-bold border transition-all cursor-pointer",
                        newCategory === "group"
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      그룹 일정
                    </button>
                  </div>

                  {newCategory === "group" && (
                    <div className="mt-2 space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">대상 그룹 선택</label>
                        <select
                          value={newGroupId || ""}
                          onChange={(e) => setNewGroupId(Number(e.target.value))}
                          className="w-full h-9 px-2 rounded-lg border border-input bg-card text-foreground font-semibold text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                        >
                          {manageableGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 비밀 일정 지정 토글 */}
                      {(() => {
                        const selectedNewGroupObj = manageableGroups.find(g => g.id === newGroupId);
                        const canWritePrivateInNewGroup = selectedNewGroupObj?.isLeader || selectedNewGroupObj?.canViewPrivateEvent || user?.role === 'admin';
                        if (!canWritePrivateInNewGroup) return null;
                        return (
                          <div className="flex items-center justify-between p-3 py-2.5 bg-amber-50/20 border border-amber-200/40 rounded-xl mt-3">
                            <div className="flex items-start gap-2.5">
                              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-left">
                                <span className="text-[11px] font-black text-amber-800">이 일정을 비밀 일정으로 지정</span>
                                <p className="text-[9px] font-semibold text-amber-700/70 mt-0.5 leading-snug">운영진과 리더에게만 노출되고 일반 단원들에게는 가려집니다.</p>
                              </div>
                            </div>
                            <Switch checked={newIsPrivate} onCheckedChange={setNewIsPrivate} className="shrink-0" />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">일정 제목 *</label>
                <Input
                  placeholder="예: 종합학술정보관 3층에서 코딩 공부"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-xl border-border"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">시작일</label>
                  <Input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="rounded-xl border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">종료일</label>
                  <Input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="rounded-xl border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">메모 및 설명</label>
                <Textarea
                  placeholder="세부적인 계획 및 내용을 메모해보세요."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="rounded-xl border-border resize-none h-24"
                  maxLength={500}
                />
              </div>

              <DialogFooter className="pt-4 flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl font-bold cursor-pointer"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || createGroupEventMutation.isPending}
                  className="rounded-xl font-bold cursor-pointer bg-primary text-primary-foreground"
                >
                  {createMutation.isPending || createGroupEventMutation.isPending ? "등록 중..." : "등록하기"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 2. 일정 상세 및 수정 모달 */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-md rounded-2xl border-border bg-card/90 backdrop-blur-md">
            <AnimatePresence mode="wait">
              {selectedEvent && (
                <div key={isEditing ? "edit" : "detail"} className="space-y-4">
                  {/* 디테일 보기 상태 */}
                  {!isEditing ? (
                    <>
                      <DialogHeader className="border-b border-border/40 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("font-bold text-xs", CATEGORY_CONFIG[selectedEvent.category].badgeClass)}>
                              {CATEGORY_CONFIG[selectedEvent.category].label}
                            </Badge>
                            {selectedEvent.isPrivate === 1 && (
                              <Badge variant="outline" className="bg-amber-100/50 border-amber-300 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 select-none shrink-0">
                                <Lock className="w-3 h-3 shrink-0" /> 비밀 일정
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(selectedEvent.startDate), "yyyy.MM.dd")}
                            {selectedEvent.startDate !== selectedEvent.endDate &&
                              ` ~ ${format(new Date(selectedEvent.endDate), "yyyy.MM.dd")}`}
                          </span>
                        </div>
                        <DialogTitle className="text-xl font-black text-foreground break-all leading-snug">
                          {selectedEvent.title}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="py-2 space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-muted-foreground">상세 내용</h4>
                          <p className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed break-all bg-muted/30 p-3 rounded-xl border border-border/30">
                            {selectedEvent.description || "등록된 상세 내용이 없습니다."}
                          </p>
                        </div>
                        
                        {selectedEvent.category === "recruitment" && selectedEvent.postId && (
                          <div className="pt-2">
                            <Link href={`/post/${selectedEvent.postId}`}>
                              <Button className="w-full flex items-center gap-2 font-bold rounded-xl cursor-pointer bg-rose-500 text-white hover:bg-rose-600 shadow-sm">
                                <Bookmark className="w-4 h-4" />
                                모집글 상세보기로 이동
                                <ExternalLink className="w-4 h-4 ml-auto" />
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>

                      <DialogFooter className="pt-4 flex justify-between gap-2 border-t border-border/40 mt-6">
                        {selectedEvent.category === "personal" || (selectedEvent.category === "group" && (manageableGroups.some((g) => g.id === selectedEvent.groupId) || user?.role === "admin")) ? (
                          <>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDeleteClick}
                                disabled={deleteMutation.isPending || deleteGroupEventMutation.isPending}
                                className="rounded-xl font-bold cursor-pointer gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                삭제
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={startEdit}
                                className="rounded-xl font-bold cursor-pointer gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                수정
                              </Button>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setIsDetailOpen(false)}
                              className="rounded-xl font-bold cursor-pointer bg-primary text-primary-foreground"
                            >
                              닫기
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => setIsDetailOpen(false)}
                            className="w-full rounded-xl font-bold cursor-pointer bg-primary text-primary-foreground"
                          >
                            닫기
                          </Button>
                        )}
                      </DialogFooter>
                    </>
                  ) : (
                    /* 수정하기 모드 */
                    <form onSubmit={handleUpdateSubmit} className="space-y-4 py-2">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                          <Edit className="w-5 h-5 text-primary" />
                          일정 수정
                        </DialogTitle>
                        <DialogDescription className="text-xs font-semibold text-muted-foreground font-sans">
                          {selectedEvent.category === "group"
                            ? "해당 그룹 일정을 변경합니다. 그룹 멤버 전원에게 실시간 반영됩니다."
                            : "해당 개인 일정을 변경합니다."}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">일정 제목 *</label>
                        <Input
                          placeholder="제목을 입력해주세요"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="rounded-xl border-border"
                          maxLength={100}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-foreground">시작일</label>
                          <Input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="rounded-xl border-border"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-foreground">종료일</label>
                          <Input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="rounded-xl border-border"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">메모 및 설명</label>
                        <Textarea
                          placeholder="계획 및 내용을 입력해주세요"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="rounded-xl border-border resize-none h-24"
                          maxLength={500}
                        />
                      </div>

                      {/* 비밀 일정 토글 */}
                      {selectedEvent.category === "group" && (() => {
                        const selectedEditGroupObj = manageableGroups.find(g => g.id === selectedEvent.groupId);
                        const canEditPrivateInGroup = selectedEditGroupObj?.isLeader || selectedEditGroupObj?.canViewPrivateEvent || user?.role === 'admin';
                        if (!canEditPrivateInGroup) return null;
                        return (
                          <div className="flex items-center justify-between p-3 py-2.5 bg-amber-50/20 border border-amber-200/40 rounded-xl">
                            <div className="flex items-start gap-2.5">
                              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-left">
                                <span className="text-[11px] font-black text-amber-800">이 일정을 비밀 일정으로 지정</span>
                                <p className="text-[9px] font-semibold text-amber-700/70 mt-0.5 leading-snug">운영진과 리더에게만 노출되고 일반 단원들에게는 가려집니다.</p>
                              </div>
                            </div>
                            <Switch checked={editIsPrivate} onCheckedChange={setEditIsPrivate} className="shrink-0" />
                          </div>
                        );
                      })()}

                      <DialogFooter className="pt-4 flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                          className="rounded-xl font-bold cursor-pointer"
                        >
                          이전으로
                        </Button>
                         <Button
                          type="submit"
                          disabled={updateMutation.isPending || updateGroupEventMutation.isPending}
                          className="rounded-xl font-bold cursor-pointer bg-primary text-primary-foreground"
                        >
                          {updateMutation.isPending || updateGroupEventMutation.isPending ? "저장 중..." : "저장하기"}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </div>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
