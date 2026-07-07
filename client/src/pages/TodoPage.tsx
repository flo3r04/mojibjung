import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  CheckCircle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Info,
  CalendarDays,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function TodoPage() {
  const { isAuthenticated } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todoContent, setTodoContent] = useState("");

  // 일주일 날짜 계산용 기준일 (주 단위 이동용)
  const [weekPivotDate, setWeekPivotDate] = useState<Date>(new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // tRPC 쿼리 및 뮤테이션
  const { data: todos = [], refetch } = trpc.calendar.listTodos.useQuery(
    { date: dateStr },
    { enabled: isAuthenticated }
  );

  const createTodoMutation = trpc.calendar.createTodo.useMutation({
    onSuccess: () => {
      setTodoContent("");
      refetch();
      toast.success("할 일이 추가되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "할 일 등록 실패");
    },
  });

  const toggleTodoMutation = trpc.calendar.toggleTodo.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "상태 변경 실패");
    },
  });

  const deleteTodoMutation = trpc.calendar.deleteTodo.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("할 일이 삭제되었습니다.");
    },
    onError: (err) => {
      toast.error(err.message || "할 일 삭제 실패");
    },
  });

  // 해당 주의 7일 구하기
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekPivotDate, { weekStartsOn: 0 }); // 일요일 시작
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [weekPivotDate]);

  // 완료 진행률 계산
  const progressPercent = useMemo(() => {
    if (todos.length === 0) return 0;
    const completedCount = todos.filter((t) => t.isCompleted === 1).length;
    return Math.round((completedCount / todos.length) * 100);
  }, [todos]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoContent.trim()) {
      toast.error("할 일 내용을 입력해주세요.");
      return;
    }
    createTodoMutation.mutate({
      date: dateStr,
      content: todoContent.trim(),
    });
  };

  const handlePrevWeek = () => {
    setWeekPivotDate((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setWeekPivotDate((prev) => addDays(prev, 7));
  };

  const handleGoToday = () => {
    const today = new Date();
    setWeekPivotDate(today);
    setSelectedDate(today);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-lg py-24 px-4 flex items-center justify-center min-h-[70vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-card/65 backdrop-blur-md rounded-3xl border border-border p-8 text-center shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-indigo-400" />
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ListTodo className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-4">로그인이 필요한 서비스입니다</h1>
            <p className="text-muted-foreground font-medium mb-8 text-sm leading-relaxed">
              마이 투두 서비스는 한국외대 학생 전용 기능입니다.<br />
              로그인하시면 날짜별 투두리스트를 영속적으로 관리하실 수 있습니다.
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

  return (
    <Layout className="bg-background/95">
      <div className="container max-w-4xl py-12 px-4 font-sans">
        
        {/* 헤더 섹션 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400/20 to-primary/20 flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
              <ListTodo className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-2">
                마이 투두
              </h1>
              <p className="text-base text-muted-foreground font-medium mt-1">
                날짜별로 할 일을 기록하고 목표 달성률을 직관적으로 확인하세요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-4 rounded-2xl border border-border/60 hover:bg-muted/40 font-bold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  날짜 선택
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border border-border bg-card shadow-lg" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setWeekPivotDate(date);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToday}
              className="h-11 px-5 rounded-2xl border border-border/60 hover:bg-muted/40 font-bold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              오늘로 이동
            </Button>
          </div>
        </div>

        {/* 메인 투두 카드 */}
        <div className="bg-card/65 backdrop-blur-md rounded-[32px] border border-border p-8 md:p-10 shadow-md relative overflow-hidden space-y-8">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-emerald-400 via-primary/30 to-indigo-400" />

          {/* 주간 날짜 선택 바 */}
          <div className="flex items-center justify-between gap-6 border-b border-border/40 pb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevWeek}
              className="h-10 w-10 rounded-xl p-0 hover:bg-muted text-muted-foreground transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex-1 grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const dayLabel = format(day, "E", { locale: ko });
                const dayNum = day.getDate();

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "flex flex-col items-center justify-center py-4 rounded-2xl border transition-all cursor-pointer select-none",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                        : "bg-muted/20 border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                      isToday && !isSelected && "border-primary/30 text-primary font-black bg-primary/5"
                    )}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider mb-1 opacity-85">
                      {dayLabel}
                    </span>
                    <span className="text-base md:text-lg font-black tracking-tight">{dayNum}</span>
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextWeek}
              className="h-10 w-10 rounded-xl p-0 hover:bg-muted text-muted-foreground transition-all cursor-pointer shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* 현재 선택 날짜 요약 & 진행률 바 */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xl font-black text-foreground flex items-center gap-2.5">
                <CalendarDays className="w-6 h-6 text-primary" />
                {format(selectedDate, "yyyy년 M월 d일 (E요일)", { locale: ko })} 할 일 목록
              </h2>
              <Badge variant="outline" className="font-bold text-sm px-3 py-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 self-start sm:self-center">
                달성률 {progressPercent}%
              </Badge>
            </div>

            {/* 진행률 바 */}
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/40">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-400 to-primary"
              />
            </div>
          </div>

          {/* 투두 등록 폼 */}
          <form onSubmit={handleAddSubmit} className="flex gap-3">
            <Input
              placeholder="여기에 새로운 할 일을 등록해보세요..."
              value={todoContent}
              onChange={(e) => setTodoContent(e.target.value)}
              className="h-14 rounded-2xl bg-card border-border px-5 font-bold text-base shadow-inner focus-visible:ring-primary"
              maxLength={200}
            />
            <Button
              type="submit"
              className="h-14 w-14 rounded-2xl font-bold bg-primary text-primary-foreground shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0 flex items-center justify-center"
              disabled={createTodoMutation.isPending}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </form>

          {/* 투두 항목 리스트 */}
          <div className="pt-2">
            <AnimatePresence mode="popLayout">
              {todos.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-20 text-muted-foreground/60 border border-dashed border-border/60 rounded-3xl bg-muted/10"
                >
                  <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground/35" />
                  <p className="text-base font-bold">등록된 할 일이 없습니다.</p>
                  <p className="text-sm font-medium text-muted-foreground/80 mt-2.5">오늘 계획한 일을 등록하고 하루를 체계적으로 시작해보세요!</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {todos.map((todo) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={todo.id}
                      className="group flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-all text-base"
                    >
                      <div className="flex items-center gap-4.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleTodoMutation.mutate({ id: todo.id })}
                          className="text-muted-foreground hover:text-primary transition-all shrink-0 cursor-pointer"
                        >
                          {todo.isCompleted === 1 ? (
                            <CheckCircle className="w-6 h-6 text-emerald-500 fill-emerald-500/10" />
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/50 hover:border-primary shrink-0" />
                          )}
                        </button>
                        <span
                          className={cn(
                            "truncate font-semibold select-none cursor-pointer text-left",
                            todo.isCompleted === 1
                              ? "line-through text-muted-foreground/50 font-medium"
                              : "text-foreground"
                          )}
                          onClick={() => toggleTodoMutation.mutate({ id: todo.id })}
                        >
                          {todo.content}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("이 할 일을 정말로 삭제하시겠습니까?")) {
                            deleteTodoMutation.mutate({ id: todo.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground p-1.5 rounded-lg hover:bg-destructive/10 transition-all shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </Layout>
  );
}
