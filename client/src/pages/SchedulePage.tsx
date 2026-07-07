import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  CalendarDays,
  Plus,
  Trash2,
  Download,
  Check,
  Settings,
  Sparkles,
  Info,
  Layers,
  Copy,
  PlusCircle,
  HelpCircle,
  FileText,
  Bookmark,
  Calendar,
  ListTodo
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

// ─── 한국외대(HUFS) 교시 정보 정의 ──────────────────────────────────────────────
const HUFS_PERIODS = {
  A: [
    { period: 1, startTime: "09:00", endTime: "10:00", label: "1교시 (09:00 ~ 10:00)" },
    { period: 2, startTime: "10:00", endTime: "11:00", label: "2교시 (10:00 ~ 11:00)" },
    { period: 3, startTime: "11:00", endTime: "12:00", label: "3교시 (11:00 ~ 12:00)" },
    { period: 4, startTime: "12:00", endTime: "13:00", label: "4교시 (12:00 ~ 13:00)" },
    { period: 5, startTime: "13:00", endTime: "14:00", label: "5교시 (13:00 ~ 14:00)" },
    { period: 6, startTime: "14:00", endTime: "15:00", label: "6교시 (14:00 ~ 15:00)" },
    { period: 7, startTime: "15:00", endTime: "16:00", label: "7교시 (15:00 ~ 16:00)" },
    { period: 8, startTime: "16:00", endTime: "17:00", label: "8교시 (16:00 ~ 17:00)" },
    { period: 9, startTime: "17:00", endTime: "18:00", label: "9교시 (17:00 ~ 18:00)" },
  ],
  B: [
    { period: 1, startTime: "09:00", endTime: "10:15", label: "1교시 (09:00 ~ 10:15)" },
    { period: 2, startTime: "10:30", endTime: "11:45", label: "2교시 (10:30 ~ 11:45)" },
    { period: 3, startTime: "12:00", endTime: "13:15", label: "3교시 (12:00 ~ 13:15)" },
    { period: 4, startTime: "13:30", endTime: "14:45", label: "4교시 (13:30 ~ 14:45)" },
    { period: 5, startTime: "15:00", endTime: "16:15", label: "5교시 (15:00 ~ 16:15)" },
    { period: 6, startTime: "16:30", endTime: "17:45", label: "6교시 (16:30 ~ 17:45)" },
  ]
};

// ─── 시간표 파스텔 색상 칩 정의 ──────────────────────────────────────────────────
const PASTEL_COLORS = [
  { value: "#FFE3E3", name: "소프트 로즈" },
  { value: "#FFECE0", name: "소프트 피치" },
  { value: "#FFF5C6", name: "소프트 레몬" },
  { value: "#E2F6CA", name: "소프트 라이트그린" },
  { value: "#D7F3E3", name: "소프트 민트" },
  { value: "#DDF3F5", name: "소프트 아쿠아" },
  { value: "#E2EBFC", name: "소프트 라벤더블루" },
  { value: "#EAE4FC", name: "소프트 라벤더" },
  { value: "#FCE4EC", name: "소프트 베이비핑크" }
];

// 요일 매핑
const DAYS_OF_WEEK = [
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" }
];

// 학기 목록
const SEMESTERS = [
  { value: "2026-1", label: "2026년 1학기" },
  { value: "2026-여름", label: "2026년 여름학기" },
  { value: "2026-2", label: "2026년 2학기" },
  { value: "2026-겨울", label: "2026년 겨울학기" }
];

// 시간 형식(HH:MM)을 하루 시작 기준 분(minute)으로 변환
function timeToMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.split(":").map(Number);
  return hh * 60 + mm;
}

export default function SchedulePage() {
  const { isAuthenticated } = useAuth();
  const timetableRef = useRef<HTMLDivElement>(null);

  // tRPC 쿼리 & 뮤테이션
  const { data: timetablesList = [], refetch: refetchList } = trpc.schedule.listTimetables.useQuery(undefined, {
    enabled: isAuthenticated
  });

  // 현재 선택된 시간표 ID (없으면 기본 메인 시간표를 자동 선택하도록 구성)
  const [selectedTimetableId, setSelectedTimetableId] = useState<number | null>(null);

  // 메인 시간표 구하기
  const mainTimetable = useMemo(() => {
    return timetablesList.find(t => t.isMain === 1) || timetablesList[0] || null;
  }, [timetablesList]);

  // 최종 활성 시간표 ID
  const activeTimetableId = selectedTimetableId || mainTimetable?.id || null;

  // 특정 시간표 상세 데이터 조회
  const { data: timetableDetail, refetch: refetchDetail } = trpc.schedule.getTimetableDetail.useQuery(
    { timetableId: activeTimetableId || 0 },
    { enabled: !!activeTimetableId }
  );

  const timetableItemsList = timetableDetail?.items || [];
  const activeTimetableMeta = timetableDetail?.timetable || null;

  // 뮤테이션 목록
  const createTimetableMutation = trpc.schedule.createTimetable.useMutation({
    onSuccess: (data) => {
      refetchList();
      setSelectedTimetableId(data.id);
      setIsCreateTimetableOpen(false);
      toast.success("새 시간표가 생성되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "시간표 생성 실패");
    }
  });

  const deleteTimetableMutation = trpc.schedule.deleteTimetable.useMutation({
    onSuccess: () => {
      setSelectedTimetableId(null);
      refetchList();
      toast.success("시간표가 삭제되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "시간표 삭제 실패");
    }
  });

  const setMainTimetableMutation = trpc.schedule.setMainTimetable.useMutation({
    onSuccess: () => {
      refetchList();
      toast.success("대표 시간표로 설정되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "대표 시간표 설정 실패");
    }
  });

  const addTimetableItemMutation = trpc.schedule.addTimetableItem.useMutation({
    onSuccess: () => {
      refetchDetail();
      setIsItemFormOpen(false);
      resetItemForm();
      toast.success("과목이 추가되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "과목 추가 실패");
    }
  });

  const updateTimetableItemMutation = trpc.schedule.updateTimetableItem.useMutation({
    onSuccess: () => {
      refetchDetail();
      setIsItemFormOpen(false);
      resetItemForm();
      toast.success("과목이 수정되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "과목 수정 실패");
    }
  });

  const deleteTimetableItemMutation = trpc.schedule.deleteTimetableItem.useMutation({
    onSuccess: () => {
      refetchDetail();
      setIsDetailModalOpen(false);
      toast.success("과목이 삭제되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "과목 삭제 실패");
    }
  });

  // 캘린더 및 투두 연동 뮤테이션
  const createCalendarEventMutation = trpc.calendar.create.useMutation({
    onSuccess: () => {
      setIsCalendarSyncOpen(false);
      toast.success("마이캘린더에 일정이 정상 추가되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "캘린더 등록 실패");
    }
  });

  const createTodoMutation = trpc.calendar.createTodo.useMutation({
    onSuccess: () => {
      setIsTodoSyncOpen(false);
      toast.success("마이투두에 할 일이 정상 추가되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "투두 등록 실패");
    }
  });

  // ─── UI 모달 상태 제어 ───────────────────────────────────────────────────────
  const [isCreateTimetableOpen, setIsCreateTimetableOpen] = useState(false);
  const [newTimetableName, setNewTimetableName] = useState("");
  const [newTimetableSemester, setNewTimetableSemester] = useState("2026-2");

  // 과목 추가/수정용 폼 상태
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [professor, setProfessor] = useState("");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState(PASTEL_COLORS[0].value);
  const [dayOfWeek, setDayOfWeek] = useState(1); // 1(월)
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [memo, setMemo] = useState("");

  // 외대 교시 세팅용 선택 상태
  const [periodType, setPeriodType] = useState<"custom" | "A" | "B">("custom");
  const [selectedPeriod, setSelectedPeriod] = useState<number | "">("");

  // 과목 상세 조회용 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // 연동(브릿지)용 모달 상태
  const [isCalendarSyncOpen, setIsCalendarSyncOpen] = useState(false);
  const [syncCalendarTitle, setSyncCalendarTitle] = useState("");
  const [syncCalendarDate, setSyncCalendarDate] = useState("2026-07-07");
  const [syncCalendarDesc, setSyncCalendarDesc] = useState("");

  const [isTodoSyncOpen, setIsTodoSyncOpen] = useState(false);
  const [syncTodoContent, setSyncTodoContent] = useState("");
  const [syncTodoDate, setSyncTodoDate] = useState("2026-07-07");

  // 이미지 캡처 상태
  const [isCapturing, setIsCapturing] = useState(false);

  // ─── 지능형 중복(Collision) 검사 ──────────────────────────────────────────────
  const collisionWarning = useMemo(() => {
    if (!subjectName.trim()) return null;

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (startMin >= endMin) {
      return "⚠️ 종료 시간은 시작 시간보다 늦어야 합니다.";
    }

    // 현재 저장된 타 과목들과 비교
    for (const item of timetableItemsList) {
      if (editingItemId && item.id === editingItemId) continue; // 수정 중인 자기 자신 제외

      if (item.dayOfWeek === dayOfWeek) {
        const existingStart = timeToMinutes(item.startTime);
        const existingEnd = timeToMinutes(item.endTime);

        // 겹침 조건: !(새과목종료 <= 기존시작 || 새과목시작 >= 기존종료)
        const isOverlap = !(endMin <= existingStart || startMin >= existingEnd);

        if (isOverlap) {
          return `⚠️ [${item.subjectName}] 과목과 겹칩니다 (${item.startTime} ~ ${item.endTime})`;
        }
      }
    }

    return null;
  }, [subjectName, startTime, endTime, dayOfWeek, timetableItemsList, editingItemId]);

  // ─── 폼 핸들러 & 헬퍼 함수 ───────────────────────────────────────────────────
  const resetItemForm = () => {
    setEditingItemId(null);
    setSubjectName("");
    setProfessor("");
    setRoom("");
    setColor(PASTEL_COLORS[0].value);
    setDayOfWeek(1);
    setStartTime("09:00");
    setEndTime("10:00");
    setMemo("");
    setPeriodType("custom");
    setSelectedPeriod("");
  };

  const handleOpenAddForm = () => {
    resetItemForm();
    setIsItemFormOpen(true);
  };

  const handleOpenEditForm = (item: any) => {
    setEditingItemId(item.id);
    setSubjectName(item.subjectName);
    setProfessor(item.professor || "");
    setRoom(item.room || "");
    setColor(item.color);
    setDayOfWeek(item.dayOfWeek);
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setMemo(item.memo || "");
    setPeriodType("custom");
    setSelectedPeriod("");
    setIsDetailModalOpen(false);
    setIsItemFormOpen(true);
  };

  // 교시 선택 시 시간 계산
  const handlePeriodChange = (val: string) => {
    if (!val) {
      setSelectedPeriod("");
      return;
    }
    const idx = Number(val);
    setSelectedPeriod(idx);

    if (periodType === "A") {
      const p = HUFS_PERIODS.A.find(item => item.period === idx);
      if (p) {
        setStartTime(p.startTime);
        setEndTime(p.endTime);
      }
    } else if (periodType === "B") {
      const p = HUFS_PERIODS.B.find(item => item.period === idx);
      if (p) {
        setStartTime(p.startTime);
        setEndTime(p.endTime);
      }
    }
  };

  const handlePeriodTypeChange = (type: "custom" | "A" | "B") => {
    setPeriodType(type);
    setSelectedPeriod("");
    if (type === "A") {
      const p = HUFS_PERIODS.A[0];
      setStartTime(p.startTime);
      setEndTime(p.endTime);
    } else if (type === "B") {
      const p = HUFS_PERIODS.B[0];
      setStartTime(p.startTime);
      setEndTime(p.endTime);
    }
  };

  // 과목 등록/수정 전송
  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      toast.error("과목명을 입력해 주세요.");
      return;
    }
    if (collisionWarning) {
      toast.error("시간 겹침 오류가 있습니다. 스케줄을 다시 확인해주세요.");
      return;
    }

    if (editingItemId) {
      updateTimetableItemMutation.mutate({
        itemId: editingItemId,
        subjectName: subjectName.trim(),
        professor: professor.trim() || undefined,
        room: room.trim() || undefined,
        color,
        dayOfWeek,
        startTime,
        endTime,
        memo: memo.trim() || undefined
      });
    } else {
      if (!activeTimetableId) return;
      addTimetableItemMutation.mutate({
        timetableId: activeTimetableId,
        subjectName: subjectName.trim(),
        professor: professor.trim() || undefined,
        room: room.trim() || undefined,
        color,
        dayOfWeek,
        startTime,
        endTime,
        memo: memo.trim() || undefined
      });
    }
  };

  // 캘린더 연동 폼 오픈
  const handleOpenCalendarSync = () => {
    if (!selectedItem) return;
    setSyncCalendarTitle(`[${selectedItem.subjectName}] 시험/일정`);
    setSyncCalendarDate(new Date().toISOString().split("T")[0]);
    setSyncCalendarDesc(`${selectedItem.professor ? `교수: ${selectedItem.professor}` : ""} ${selectedItem.room ? `강의실: ${selectedItem.room}` : ""} \n시간표 정보 기반 연동 일정입니다.`);
    setIsDetailModalOpen(false);
    setIsCalendarSyncOpen(true);
  };

  // 투두 연동 폼 오픈
  const handleOpenTodoSync = () => {
    if (!selectedItem) return;
    setSyncTodoContent(`[${selectedItem.subjectName}] 과제 제출`);
    setSyncTodoDate(new Date().toISOString().split("T")[0]);
    setIsDetailModalOpen(false);
    setIsTodoSyncOpen(true);
  };

  const handleCalendarSyncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncCalendarTitle.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    // 수업 시작/종료 시간에 근거하여 시간 세팅
    const startIso = `${syncCalendarDate}T${selectedItem?.startTime || "09:00"}:00`;
    const endIso = `${syncCalendarDate}T${selectedItem?.endTime || "10:00"}:00`;

    createCalendarEventMutation.mutate({
      title: syncCalendarTitle.trim(),
      description: syncCalendarDesc.trim() || undefined,
      startDate: startIso,
      endDate: endIso
    });
  };

  const handleTodoSyncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncTodoContent.trim()) {
      toast.error("할 일 내용을 입력해주세요.");
      return;
    }
    createTodoMutation.mutate({
      date: syncTodoDate,
      content: syncTodoContent.trim()
    });
  };

  // ─── 이미지 캡처 (Export) 기능 ───
  const handleExportAsImage = async () => {
    if (!timetableRef.current) return;
    setIsCapturing(true);
    toast.info("시간표 이미지를 빌드하고 있습니다...");

    try {
      // 런타임에 cdn으로 html2canvas 동적 로드 (로컬 의존성 최소화 및 호환 극대화)
      const html2canvas = await new Promise<any>((resolve, reject) => {
        if ((window as any).html2canvas) {
          resolve((window as any).html2canvas);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve((window as any).html2canvas);
        script.onerror = () => reject(new Error("html2canvas 로드 실패"));
        document.body.appendChild(script);
      });

      const canvas = await html2canvas(timetableRef.current, {
        useCORS: true,
        scale: 2, // 고해상도로 캡처
        backgroundColor: document.documentElement.classList.contains("dark") ? "#1e293b" : "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `${activeTimetableMeta?.name || "timetable"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("이미지가 성공적으로 다운로드되었습니다.");
    } catch (err) {
      console.error(err);
      toast.error("이미지 내보내기에 실패했습니다.");
    } finally {
      setIsCapturing(false);
    }
  };

  // 비인증 처리
  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-lg py-24 px-4 flex items-center justify-center min-h-[70vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-card/65 backdrop-blur-md rounded-3xl border border-border p-8 text-center shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-indigo-400 to-emerald-400" />
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CalendarDays className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-4">로그인이 필요한 service입니다</h1>
            <p className="text-muted-foreground font-medium mb-8 text-sm leading-relaxed">
              마이 스케줄 서비스는 한국외대 학생 전용 기능입니다.<br />
              로그인하시면 과목 스케줄 구성, 충돌 방지 및 캘린더/투두와 즉시 연동을 활용할 수 있습니다.
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

  // ─── 그리드 위치 계산 헬퍼 ───
  // 그리드는 09:00 (540분) 부터 18:00 (1080분)까지 (총 540분)를 렌더링
  const START_MIN = 540; // 09:00
  const TOTAL_MIN = 540; // 9시간 (18:00 마감)

  return (
    <Layout className="bg-background/95">
      <div className="container py-12 px-4 font-sans max-w-6xl">
        
        {/* 헤더 섹션 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 select-none">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 to-indigo-400/20 flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
              <CalendarDays className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-2">
                마이 스케줄
              </h1>
              <p className="text-base text-muted-foreground font-medium mt-1">
                학교 시간표를 간편하게 조립하고 캘린더/할 일 스레드와 연합하여 빈틈없이 계획하세요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 이미지 내보내기 */}
            {activeTimetableId && timetableItemsList.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAsImage}
                disabled={isCapturing}
                className="h-11 px-4.5 rounded-2xl border border-border/60 hover:bg-muted/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
              >
                <Download className="w-4 h-4 text-primary" />
                이미지 저장
              </Button>
            )}

            {/* 과목 추가 */}
            {activeTimetableId && (
              <Button
                onClick={handleOpenAddForm}
                className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                과목 추가
              </Button>
            )}
          </div>
        </div>

        {/* 제어 바 (시간표 선택, 관리) */}
        <div className="bg-card border border-border p-4.5 rounded-3xl shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* 시간표 선택 드롭다운 */}
            {timetablesList.length > 0 ? (
              <select
                value={activeTimetableId || ""}
                onChange={(e) => setSelectedTimetableId(Number(e.target.value))}
                className="h-11 px-4 rounded-xl border border-border bg-background font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[200px]"
              >
                {timetablesList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.semester}) {t.isMain === 1 ? "★" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">개설된 시간표가 없습니다.</span>
            )}

            {/* 대표 설정 버튼 */}
            {activeTimetableMeta && activeTimetableMeta.isMain === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMainTimetableMutation.mutate({ timetableId: activeTimetableMeta.id })}
                className="h-11 px-3.5 rounded-xl border border-border/40 hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                대표로 설정
              </Button>
            )}

            {/* 시간표 삭제 버튼 */}
            {activeTimetableMeta && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("정말로 이 시간표를 삭제하시겠습니까? 안에 담긴 모든 교과 스케줄도 소멸합니다.")) {
                    deleteTimetableMutation.mutate({ timetableId: activeTimetableMeta.id });
                  }
                }}
                className="h-11 px-3.5 rounded-xl border border-border/40 hover:bg-destructive/5 text-xs font-bold text-destructive cursor-pointer"
              >
                삭제
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewTimetableName("");
              setNewTimetableSemester("2026-2");
              setIsCreateTimetableOpen(true);
            }}
            className="h-11 px-4.5 rounded-xl border-dashed border-2 border-primary/40 hover:border-primary text-primary bg-primary/5 hover:bg-primary/10 font-bold text-xs flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
          >
            <PlusCircle className="w-4 h-4" />
            새 시간표 초안 만들기
          </Button>
        </div>

        {/* 메인 시간표 영역 */}
        {activeTimetableId ? (
          <div
            ref={timetableRef}
            className="bg-card border border-border rounded-[32px] p-6 shadow-md overflow-hidden relative"
          >
            {/* 시간표 워터마크 및 메타 정보 */}
            <div className="flex items-center justify-between border-b border-border/60 pb-5 mb-6 select-none">
              <div>
                <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                  {activeTimetableMeta?.name}
                  {activeTimetableMeta?.isMain === 1 && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-black text-[10px]">
                      기본 대표 시간표
                    </Badge>
                  )}
                </h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  학기: {SEMESTERS.find(s => s.value === activeTimetableMeta?.semester)?.label || activeTimetableMeta?.semester}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest block">HUFS GLOBAL Timetable</span>
                <span className="text-xs font-bold text-primary">{timetableItemsList.length}개 과목 배정됨</span>
              </div>
            </div>

            {/* 시간표 그리드 컨테이너 */}
            <div className="min-w-[650px] relative font-sans select-none border border-border/60 rounded-2xl overflow-hidden bg-background/35">
              
              {/* 요일 헤더 행 */}
              <div className="grid grid-cols-6 border-b border-border/60 bg-muted/30 text-center font-bold text-xs h-11 items-center">
                <div className="border-r border-border/60 text-muted-foreground font-black text-[11px] h-full flex items-center justify-center">시간</div>
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className={cn("h-full flex items-center justify-center", day.value < 5 && "border-r border-border/60")}>
                    {day.label}
                  </div>
                ))}
              </div>

              {/* 시간 그리드 바디 */}
              <div className="grid grid-cols-6 relative h-[630px]">
                {/* 1열: 시간 축 (09:00 ~ 18:00) */}
                <div className="border-r border-border/60 relative h-full bg-muted/10">
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const hour = idx + 9;
                    const topPercent = (idx / 9) * 100;
                    return (
                      <div
                        key={hour}
                        style={{ top: `${topPercent}%` }}
                        className="absolute w-full text-center border-b border-dashed border-border/40 h-[70px] flex flex-col justify-start pt-1.5 text-[10.5px] font-black text-muted-foreground/80"
                      >
                        <span>{String(hour).padStart(2, "0")}:00</span>
                      </div>
                    );
                  })}
                </div>

                {/* 2 ~ 6열: 요일별 컬럼 */}
                {Array.from({ length: 5 }).map((_, colIdx) => {
                  const dayVal = colIdx + 1;
                  // 해당 요일의 과목들
                  const dayItems = timetableItemsList.filter(item => item.dayOfWeek === dayVal);

                  return (
                    <div
                      key={dayVal}
                      className={cn("relative h-full", dayVal < 5 && "border-r border-border/60")}
                    >
                      {/* 가로 점선들 (시간별 구분) */}
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <div
                          key={idx}
                          style={{ top: `${(idx / 9) * 100}%` }}
                          className="absolute w-full border-b border-dashed border-border/30 h-[70px] pointer-events-none"
                        />
                      ))}

                      {/* 과목 카드 렌더링 */}
                      {dayItems.map((item) => {
                        const startMin = timeToMinutes(item.startTime);
                        const endMin = timeToMinutes(item.endTime);
                        
                        // y축 좌표 계산
                        const topPct = ((startMin - START_MIN) / TOTAL_MIN) * 100;
                        const heightPct = ((endMin - startMin) / TOTAL_MIN) * 100;

                        return (
                          <motion.div
                            whileHover={{ scale: 0.985 }}
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDetailModalOpen(true);
                            }}
                            key={item.id}
                            style={{
                              top: `${topPct}%`,
                              height: `${heightPct}%`,
                              backgroundColor: item.color,
                              color: "#1e293b" // 다크 계열 글씨로 통일하여 파스텔 대비 가시성 확보
                            }}
                            className="absolute inset-x-1.5 rounded-xl border border-black/5 p-2.5 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col justify-between overflow-hidden select-none active:scale-[0.98]"
                          >
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-[11.5px] leading-tight truncate">
                                {item.subjectName}
                              </h3>
                              {item.professor && (
                                <p className="text-[9.5px] font-semibold opacity-75 truncate mt-0.5">
                                  {item.professor}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between mt-1 text-[9px] font-black opacity-80 border-t border-black/5 pt-1 truncate">
                              <span className="truncate">{item.room || "강의실 미지정"}</span>
                              <span className="shrink-0">{item.startTime}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 사용 설명 팁 */}
            <div className="mt-6 p-4 rounded-2xl bg-muted/40 border border-border/60 flex items-start gap-3 select-none">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs font-semibold text-muted-foreground leading-relaxed">
                <span className="font-black text-foreground block mb-0.5">💡 알아두기</span>
                - 시간표의 임의의 과목 카드를 클릭하시면 상세 정보를 열람하고 수정하거나, **마이캘린더/마이투두로 시험 및 과제 일정을 즉시 캡처 연동**하실 수 있습니다.<br />
                - 시간표 초안은 제한 없이 여러 개를 만드실 수 있으며, '대표로 설정' 시 그것이 사용자의 기본 메인 시간표가 됩니다.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 border border-dashed border-border/80 rounded-[32px] bg-card/45 backdrop-blur-md select-none">
            <Layers className="w-16 h-16 mx-auto mb-6 text-muted-foreground/35" />
            <h2 className="text-2xl font-black text-foreground">개설된 시간표가 없습니다</h2>
            <p className="text-sm font-medium text-muted-foreground mt-3 max-w-sm mx-auto leading-relaxed">
              학기별 시간표를 개설하여 수강 신청 초안을 작성하고 일정을 한 눈에 조율해보세요.
            </p>
            <Button
              onClick={() => {
                setNewTimetableName("");
                setNewTimetableSemester("2026-2");
                setIsCreateTimetableOpen(true);
              }}
              className="mt-6 font-bold py-3.5 px-6 rounded-xl bg-primary text-primary-foreground shadow-md cursor-pointer"
            >
              첫 시간표 개설하기
            </Button>
          </div>
        )}

      </div>

      {/* ─── 모달 다이얼로그 1: 시간표 신규 생성 ─── */}
      <Dialog open={isCreateTimetableOpen} onOpenChange={setIsCreateTimetableOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card/95 backdrop-blur-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary" />
              새 시간표 초안 생성
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              구상하시는 수강신청 버전이나 학기를 입력해 새 시간표 바구니를 개설합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 select-none">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">대상 학기 선택</label>
              <select
                value={newTimetableSemester}
                onChange={(e) => setNewTimetableSemester(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background font-bold text-xs focus:outline-none cursor-pointer"
              >
                {SEMESTERS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">시간표 식별명</label>
              <Input
                placeholder="예: 수강신청 최종안, A학부 2학년 2학기"
                value={newTimetableName}
                onChange={(e) => setNewTimetableName(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                maxLength={60}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsCreateTimetableOpen(false)}
              className="rounded-xl font-bold h-11 text-xs cursor-pointer border border-border/40"
            >
              취소
            </Button>
            <Button
              disabled={createTimetableMutation.isPending || !newTimetableName.trim()}
              onClick={() => createTimetableMutation.mutate({ name: newTimetableName.trim(), semester: newTimetableSemester })}
              className="bg-primary text-primary-foreground rounded-xl font-black h-11 text-xs px-5 cursor-pointer shadow-md"
            >
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ─── 모달 다이얼로그 2: 과목 추가/수정 ─── */}
      <Dialog open={isItemFormOpen} onOpenChange={setIsItemFormOpen}>
        <DialogContent className="max-w-lg rounded-[24px] border-border bg-card/95 backdrop-blur-md max-h-[90vh] overflow-y-auto font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              {editingItemId ? "과목 상세 설정 수정" : "시간표에 새 과목 등록"}
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              강의 요일과 시간대를 지정하여 시간표 블록을 형성합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleItemSubmit} className="space-y-4 py-3 select-none">
            
            {/* 과목명 */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-foreground">과목명 *</label>
              <Input
                placeholder="예: 알고리즘 설계분석, 전공영어"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                maxLength={50}
                required
              />
            </div>

            {/* 교수명 & 강의실 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-foreground">담당 교수</label>
                <Input
                  placeholder="예: 홍길동 교수"
                  value={professor}
                  onChange={(e) => setProfessor(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                  maxLength={30}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-foreground">배정 강의실</label>
                <Input
                  placeholder="예: 인문관 301호"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                  maxLength={30}
                />
              </div>
            </div>

            {/* 요일 선택 */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-foreground">수업 요일</label>
              <div className="grid grid-cols-5 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setDayOfWeek(day.value)}
                    className={cn(
                      "h-10 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      dayOfWeek === day.value
                        ? "bg-primary border-primary text-primary-foreground shadow-xs"
                        : "bg-background border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {day.label.substring(0, 1)}
                  </button>
                ))}
              </div>
            </div>

            {/* HUFS 교시 템플릿 입력 (핵심 편의 기능) */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  HUFS 빠른 교시 완성
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePeriodTypeChange("custom")}
                    className={cn("text-[10px] font-black px-2 py-1 rounded-md border transition-all cursor-pointer", periodType === "custom" ? "bg-card border-border text-foreground" : "text-muted-foreground/60 border-transparent")}
                  >
                    직접 입력
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodTypeChange("A")}
                    className={cn("text-[10px] font-black px-2 py-1 rounded-md border transition-all cursor-pointer", periodType === "A" ? "bg-card border-border text-foreground" : "text-muted-foreground/60 border-transparent")}
                  >
                    A형 (60분)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodTypeChange("B")}
                    className={cn("text-[10px] font-black px-2 py-1 rounded-md border transition-all cursor-pointer", periodType === "B" ? "bg-card border-border text-foreground" : "text-muted-foreground/60 border-transparent")}
                  >
                    B형 (75분)
                  </button>
                </div>
              </div>

              {periodType !== "custom" && (
                <select
                  value={selectedPeriod}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="">교시를 선택하세요</option>
                  {(periodType === "A" ? HUFS_PERIODS.A : HUFS_PERIODS.B).map((p) => (
                    <option key={p.period} value={p.period}>{p.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 수동 시간 세팅 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-foreground">시작 시간</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setPeriodType("custom");
                  }}
                  className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-foreground">종료 시간</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setPeriodType("custom");
                  }}
                  className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                />
              </div>
            </div>

            {/* 중복 감지 경고 안내 */}
            {collisionWarning && (
              <div className="p-3 bg-destructive/5 rounded-xl border border-destructive/10 text-destructive text-xs font-bold leading-relaxed">
                {collisionWarning}
              </div>
            )}

            {/* 테마 색상 칩 */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-foreground">시간표 테마 컬러</label>
              <div className="flex flex-wrap gap-2">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={cn(
                      "w-8 h-8 rounded-full border border-black/5 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95",
                      color === c.value && "ring-2 ring-primary border-transparent scale-105"
                    )}
                  >
                    {color === c.value && <Check className="w-4 h-4 text-slate-800" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 개별 메모 */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-foreground">개인 메모 (교수 메일, 줌 주소 등)</label>
              <textarea
                placeholder="과목과 관련된 유용한 정보나 참고 링크를 입력해주세요."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                maxLength={300}
                className="w-full rounded-xl bg-background border border-border p-3 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsItemFormOpen(false)}
                className="rounded-xl font-bold h-11 text-xs cursor-pointer border border-border/40"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={addTimetableItemMutation.isPending || updateTimetableItemMutation.isPending || !!collisionWarning}
                className="bg-primary text-primary-foreground rounded-xl font-black h-11 text-xs px-5 cursor-pointer shadow-md"
              >
                {editingItemId ? "수정 완료" : "과목 등록"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* ─── 모달 다이얼로그 3: 과목 상세 모달 (여기서 캘린더/투두 등록 지원) ─── */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border-border bg-card/95 backdrop-blur-md font-sans select-none">
          {selectedItem && (
            <>
              <DialogHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    style={{ backgroundColor: selectedItem.color }}
                    className="w-3.5 h-3.5 rounded-full border border-black/5"
                  />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {DAYS_OF_WEEK.find(d => d.value === selectedItem.dayOfWeek)?.label} {selectedItem.startTime} ~ {selectedItem.endTime}
                  </span>
                </div>
                <DialogTitle className="text-xl font-black text-foreground leading-snug break-all">
                  {selectedItem.subjectName}
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {/* 강의실, 교수 정보 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/30 rounded-2xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground block">담당 교수</span>
                    <span className="text-xs font-extrabold text-foreground mt-0.5 block truncate">
                      {selectedItem.professor || "미지정"}
                    </span>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-2xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground block">강의실</span>
                    <span className="text-xs font-extrabold text-foreground mt-0.5 block truncate">
                      {selectedItem.room || "미지정"}
                    </span>
                  </div>
                </div>

                {/* 메모 */}
                {selectedItem.memo && (
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground block mb-1">메모</span>
                    <p className="text-xs font-semibold text-foreground/90 whitespace-pre-wrap leading-relaxed break-all">
                      {selectedItem.memo}
                    </p>
                  </div>
                )}

                {/* 🌟 캘린더 / 투두 연계 단축 기능 섹션 (핵심 편의성) 🌟 */}
                <div className="border-t border-border/60 pt-4 space-y-2.5">
                  <span className="text-[10.5px] font-black text-primary uppercase tracking-widest block">스케줄 연합 브릿지</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleOpenCalendarSync}
                      className="h-12 rounded-xl text-[11px] font-black border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Calendar className="w-4 h-4 text-primary" />
                      캘린더에 시험 등록
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleOpenTodoSync}
                      className="h-12 rounded-xl text-[11px] font-black border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <ListTodo className="w-4 h-4 text-emerald-500" />
                      투두에 과제 등록
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-border/50 pt-4 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("정말로 이 과목을 시간표에서 제거하시겠습니까?")) {
                      deleteTimetableItemMutation.mutate({ itemId: selectedItem.id });
                    }
                  }}
                  className="rounded-xl h-11 text-xs font-bold text-destructive hover:bg-destructive/5 cursor-pointer"
                >
                  과목 삭제
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="rounded-xl h-11 px-4 text-xs font-bold border border-border/40 cursor-pointer"
                  >
                    닫기
                  </Button>
                  <Button
                    onClick={() => handleOpenEditForm(selectedItem)}
                    className="bg-primary text-primary-foreground rounded-xl h-11 px-4 text-xs font-black cursor-pointer shadow-md"
                  >
                    스케줄 수정
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>


      {/* ─── 모달 다이얼로그 4: 캘린더 연동 ─── */}
      <Dialog open={isCalendarSyncOpen} onOpenChange={setIsCalendarSyncOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card/95 backdrop-blur-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              캘린더에 시험 일정 등록
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              선택한 과목의 수업 시간대에 마이캘린더 시험 일정을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCalendarSyncSubmit} className="space-y-4 py-3 select-none">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">일정 날짜 지정</label>
              <Input
                type="date"
                value={syncCalendarDate}
                onChange={(e) => setSyncCalendarDate(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">일정 타이틀</label>
              <Input
                placeholder="예: [과목명] 중간고사 시험"
                value={syncCalendarTitle}
                onChange={(e) => setSyncCalendarTitle(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">설명 및 참고사항</label>
              <textarea
                value={syncCalendarDesc}
                onChange={(e) => setSyncCalendarDesc(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-background border border-border p-3 font-semibold text-xs focus:outline-none resize-none"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCalendarSyncOpen(false)}
                className="rounded-xl font-bold h-11 text-xs cursor-pointer border border-border/40"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={createCalendarEventMutation.isPending}
                className="bg-primary text-primary-foreground rounded-xl font-black h-11 text-xs px-5 cursor-pointer shadow-md"
              >
                캘린더 추가
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* ─── 모달 다이얼로그 5: 투두 연동 ─── */}
      <Dialog open={isTodoSyncOpen} onOpenChange={setIsTodoSyncOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card/95 backdrop-blur-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-emerald-500" />
              투두에 과제 등록
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              선택한 과목의 과제 마감일에 맞춰 투두리스트 항목을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTodoSyncSubmit} className="space-y-4 py-3 select-none">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">마감 기한 지정</label>
              <Input
                type="date"
                value={syncTodoDate}
                onChange={(e) => setSyncTodoDate(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">할 일 내용</label>
              <Input
                placeholder="예: [과목명] 레포트 제출"
                value={syncTodoContent}
                onChange={(e) => setSyncTodoContent(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs"
                required
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTodoSyncOpen(false)}
                className="rounded-xl font-bold h-11 text-xs cursor-pointer border border-border/40"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={createTodoMutation.isPending}
                className="bg-primary text-primary-foreground rounded-xl font-black h-11 text-xs px-5 cursor-pointer shadow-md"
              >
                투두 추가
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
