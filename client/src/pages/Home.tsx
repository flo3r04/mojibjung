import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import Logo from "@/components/Logo";
import PostCard from "@/components/PostCard";
import { Link, useLocation } from "wouter";
import { 
  ArrowRight, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Heart, 
  MessageSquare, 
  Clock, 
  Megaphone 
} from "lucide-react";
import { cn } from "@/lib/utils";

const POPULAR_KEYWORDS = [
  "프론트엔드", "백엔드", "모바일", "기획/디자인", "알고리즘", "어학", "취업/면접", "기타"
];

const getDDay = (deadline: string | null | Date) => {
  if (!deadline) return "상시 모집";
  const target = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "D-Day";
  if (diffDays > 0) return `D-${diffDays}`;
  return "모집 종료";
};

const getAcademicDDay = (
  events: any[],
  keyword: string,
  fallbackLabel: string
) => {
  const event = events.find(
    (e) => e.category === "academic" && e.title.includes(keyword)
  );
  if (!event) return { title: fallbackLabel, dday: "대기", badgeBg: "bg-slate-500" };

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const today = new Date();
  
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  
  const title = event.title.replace(/^\[학사\]\s*/, "");

  if (todayStart >= startMs && todayStart <= endMs) {
    return { title, dday: "진행중", badgeBg: "bg-emerald-500" };
  }
  if (todayStart < startMs) {
    const diffTime = startMs - todayStart;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      title,
      dday: diffDays === 0 ? "D-Day" : `D-${diffDays}`,
      badgeBg: keyword === "기말시험" ? "bg-rose-500" : "bg-indigo-500",
    };
  }
  return { title, dday: "종료", badgeBg: "bg-slate-400" };
};

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialCategory = (urlParams.get("category") as any) || "전체";
  const [selectedCategory, setSelectedCategory] = useState<"전체" | "동아리" | "학회" | "스터디">(initialCategory);
  const [selectedKeyword, setSelectedKeyword] = useState<string | undefined>(undefined);
  const [kwQuery, setKwQuery] = useState("");

  // 캐러셀 상태 및 타이머 설정 (학교 관련 4개 배너 제공)
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const totalSlides = 4;

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(timer);
  }, [totalSlides, isHovered]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const cat = params.get("category") as any;
    if (cat && ["동아리", "학회", "스터디"].includes(cat)) {
      setSelectedCategory(cat);
    } else {
      setSelectedCategory("전체");
    }
  }, [location]);

  const { data: latestPosts } = trpc.post.list.useQuery({
    category: selectedCategory === "전체" ? undefined : selectedCategory,
    status: "모집중",
    limit: 12,
    sort: "latest",
  });

  const { data: keywordPosts } = trpc.post.list.useQuery({
    keyword: selectedKeyword,
    status: "모집중",
    limit: 6,
    sort: "latest",
  }, {
    enabled: !!selectedKeyword,
  });

  const { data: recommendedPosts } = trpc.post.recommended.useQuery({ limit: 12 }, {
    enabled: isAuthenticated && !selectedKeyword,
  });

  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: suggestions } = trpc.post.getAllKeywords.useQuery(
    { query: kwQuery },
    { enabled: kwQuery.length > 0 }
  );

  // 학사일정 조회 (비로그인 사용자도 학사 D-Day 확인이 가능하도록)
  const { data: calendarEvents = [] } = trpc.calendar.list.useQuery();

  let displayKeywords = isAuthenticated ? [] : POPULAR_KEYWORDS;
  if (isAuthenticated && profile?.profile?.keywords) {
    try {
      const parsed = JSON.parse(profile.profile.keywords);
      if (Array.isArray(parsed)) {
        displayKeywords = parsed;
      }
    } catch { /* ignore */ }
  }

  const keywordSectionPosts = selectedKeyword ? keywordPosts : recommendedPosts;

  return (
    <Layout>
      {/* Hero Banner Carousel Section */}
      <section className="container pt-6 pb-10">
        <div 
          className="relative rounded-3xl w-full overflow-hidden shadow-lg h-[460px] md:h-[350px] group/carousel select-none bg-slate-900"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Slider Container */}
          <div 
            className="flex h-full w-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* Slide 1: 기존 동아리 학회 프로젝트 매칭 배너 */}
            <div className="w-full h-full flex-shrink-0 bg-slate-900 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 relative p-8 md:p-14 flex flex-col md:flex-row items-center justify-between overflow-hidden">
              {/* Decorative gradients */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />
              
              <div className="relative z-10 max-w-xl text-left">
                <div className="mb-4">
                  <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider select-none shadow-xs">
                    SERVICE MATCHING
                  </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4 break-keep">
                  외대생을 위한<br />
                  <span className="text-primary">동아리·학회·프로젝트</span> 매칭
                </h1>
                <p className="text-slate-300 text-sm md:text-lg mb-8 font-medium break-keep">
                  나와 목표가 같은 팀원들을 '모집중'에서 빠르게 찾아보세요.
                </p>
                <div className="flex flex-wrap gap-3">
                  {isAuthenticated ? (
                    <>
                      <Link href="/post/new">
                        <Button size="lg" className="font-bold rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-md">
                          모집 글 작성하기
                        </Button>
                      </Link>
                      <Link href="/board">
                        <Button size="lg" variant="outline" className="font-bold rounded-full px-8 bg-white/10 text-white border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                          모집 게시판 이동
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        className="font-bold rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-md"
                        onClick={() => (window.location.href = getLoginUrl())}
                      >
                        지금 바로 시작하기
                      </Button>
                      <Link href="/board">
                        <Button size="lg" variant="outline" className="font-bold rounded-full px-8 bg-white/10 text-white border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                          모집 게시판 이동
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
              
              <div className="hidden md:flex relative z-10 w-48 h-48 items-center justify-center">
                <Logo size={144} variant="card" />
              </div>
            </div>

            {/* Slide 2: 한국외대 공식 홈페이지 및 포털 배너 */}
            <div className="w-full h-full flex-shrink-0 bg-gradient-to-r from-teal-950 via-slate-900 to-teal-950 relative p-8 md:p-14 flex flex-col md:flex-row items-center justify-between overflow-hidden">
              <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-teal-300/30 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-xl text-left">
                <div className="mb-4">
                  <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider select-none shadow-xs">
                    HUFS PORTAL
                  </span>
                </div>
                <h1 className="text-2xl md:text-4xl font-black text-white leading-tight mb-4 break-keep">
                  한국외국어대학교<br />공식 홈페이지 & 포털 🏫
                </h1>
                <p className="text-slate-300 text-xs md:text-base mb-8 font-medium leading-relaxed break-keep">
                  학교의 실시간 종합 공지사항 및 포털 종합정보시스템, 
                  <br />
                  전자도서관 등 학교 생활에 유용한 공식 채널을 간편하게 방문하세요.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a href="https://hufs.ac.kr" target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="font-bold rounded-full px-6 bg-teal-500 hover:bg-teal-600 text-white shadow-md flex items-center gap-1.5 cursor-pointer">
                      학교 홈페이지 방문
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                  <a href="https://wis.hufs.ac.kr" target="_blank" rel="noopener noreferrer">
                    <Button size="lg" variant="outline" className="font-bold rounded-full px-6 bg-white/10 text-white border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                      종합정보시스템 바로가기
                    </Button>
                  </a>
                </div>
              </div>

              {/* Right Side: University building mockup */}
              <div className="hidden md:flex relative z-10 items-center justify-center w-[280px]">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 w-full shadow-2xl flex flex-col gap-3 text-left">
                  <div className="text-xs font-black text-white flex items-center gap-1.5 border-b border-white/10 pb-2">
                    <GraduationCap className="w-4 h-4 text-teal-400" />
                    한국외대 공식 사이트 목록
                  </div>
                  <ul className="text-xs text-slate-200 space-y-2.5 font-bold">
                    <li className="flex items-center justify-between hover:text-teal-300 transition-colors">
                      <a href="https://hufs.ac.kr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white/95 hover:underline">
                        <span>•</span> 공식 홈페이지
                      </a>
                      <span className="text-[10px] text-teal-300 bg-teal-400/10 px-1.5 py-0.5 rounded font-black">hufs.ac.kr</span>
                    </li>
                    <li className="flex items-center justify-between hover:text-teal-300 transition-colors">
                      <a href="https://wis.hufs.ac.kr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white/95 hover:underline">
                        <span>•</span> 종합정보시스템 (포털)
                      </a>
                      <span className="text-[10px] text-teal-300 bg-teal-400/10 px-1.5 py-0.5 rounded font-black">wis.hufs.ac.kr</span>
                    </li>
                    <li className="flex items-center justify-between hover:text-teal-300 transition-colors">
                      <a href="https://builder.hufs.ac.kr/user/indexSub.action?framePath=unknownboard&siteId=hufs&boardId=64259&page=1&command=list" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white/95 hover:underline">
                        <span>•</span> 학사 공지사항
                      </a>
                      <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-black">공지사항</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Slide 3: 한국외대 학사일정 및 일정 관리 배너 */}
            <div className="w-full h-full flex-shrink-0 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 relative p-8 md:p-14 flex flex-col md:flex-row items-center justify-between overflow-hidden">
              <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-xl text-left">
                <div className="mb-4">
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider select-none shadow-xs">
                    ACADEMIC SCHEDULE
                  </span>
                </div>
                <h1 className="text-2xl md:text-4xl font-black text-white leading-tight mb-4 break-keep">
                  2026학년도 한국외대<br />학사일정 & 마이 캘린더 🗓️
                </h1>
                <p className="text-slate-300 text-xs md:text-base mb-8 font-medium leading-relaxed break-keep">
                  수강신청, 휴/복학, 시험기간, 축제 등 다양한 핵심 일정을 한눈에 모아보세요.
                  <br />
                  직접 개인 일정이나 동아리/학회 일정도 함께 연동해 편리하게 등록·관리할 수 있습니다.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/calendar">
                    <Button size="lg" className="font-bold rounded-full px-6 bg-indigo-500 hover:bg-indigo-600 text-white shadow-md flex items-center gap-1.5 cursor-pointer">
                      마이 캘린더 이동
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/board">
                    <Button size="lg" variant="outline" className="font-bold rounded-full px-6 bg-white/10 text-white border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                      게시판 둘러보기
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right Side: Mockup Calendar Card */}
              <div className="hidden md:flex relative z-10 items-center justify-center w-[280px]">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 w-full shadow-2xl flex flex-col gap-3 text-left">
                  <div className="text-xs font-black text-white flex items-center gap-1.5 border-b border-white/10 pb-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    한국외대 주요 학사일정 D-Day
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const examInfo = getAcademicDDay(calendarEvents, "기말시험", "1학기 기말시험 기간");
                      const vacationInfo = getAcademicDDay(calendarEvents, "계절학기", "여름방학 및 계절학기 개강");
                      const gradeInfo = getAcademicDDay(calendarEvents, "성적 열람", "1학기 성적 열람 및 정정");

                      return (
                        <>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                            <div className="text-[11px] font-bold text-white">{examInfo.title}</div>
                            <span className={cn("text-[9px] font-black text-white px-2 py-0.5 rounded", examInfo.badgeBg)}>
                              {examInfo.dday}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                            <div className="text-[11px] font-bold text-white">{vacationInfo.title}</div>
                            <span className={cn("text-[9px] font-black text-white px-2 py-0.5 rounded", vacationInfo.badgeBg)}>
                              {vacationInfo.dday}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                            <div className="text-[11px] font-bold text-white">{gradeInfo.title}</div>
                            <span className={cn("text-[9px] font-black text-white px-2 py-0.5 rounded", gradeInfo.badgeBg)}>
                              {gradeInfo.dday}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 4: Custom Notice Banner (3번 사진 스타일 - 오픈채팅방 공지) */}
            <div className="w-full h-full flex-shrink-0 bg-[#FEDF6F] relative p-8 md:p-14 flex flex-col md:flex-row items-center justify-between overflow-hidden">
              {/* Decorative backgrounds */}
              <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-amber-300/30 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-xl text-left">
                <div className="mb-4">
                  <span className="bg-[#F35F64] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider select-none shadow-xs">
                    NOTICE
                  </span>
                </div>
                <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight mb-4 break-keep">
                  '모집중' 오픈채팅방 OPEN 💭
                </h1>
                <p className="text-slate-800 text-xs md:text-base mb-8 font-bold leading-normal break-keep">
                  모집 정보를 가장 빠르게 받아볼 얼리어답터를 구해요! 
                  <br />
                  외대 학우들과 소통하고 실시간 모집 알림을 편리하게 받아보세요.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a href="https://open.kakao.com" target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="font-bold rounded-full px-6 bg-slate-900 text-white hover:bg-slate-800 shadow-md flex items-center gap-1.5 cursor-pointer">
                      오픈채팅 참여하기
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                  <Link href="/board">
                    <Button size="lg" variant="outline" className="font-bold rounded-full px-6 bg-white/40 text-slate-900 border-slate-400 hover:bg-white/60 transition-all cursor-pointer">
                      모집 게시판 이동
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right Side: Chat Application CSS Mockup */}
              <div className="hidden md:flex relative z-10 items-end justify-center h-full w-[280px] pb-4">
                <div className="absolute top-[15%] left-[10%] animate-bounce duration-1000 z-20">
                  <div className="bg-amber-400 text-amber-950 p-2.5 rounded-full shadow-lg border border-amber-300">
                    <Megaphone className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                {/* Smartphone window */}
                <div className="bg-slate-50/90 dark:bg-slate-900/90 rounded-t-3xl border-t-[8px] border-x-[8px] border-slate-300 dark:border-slate-850 w-[240px] h-[190px] p-3 flex flex-col justify-end gap-2 shadow-2xl relative overflow-hidden">
                  <div className="text-[9px] text-muted-foreground font-black text-center mb-1 border-b border-border/20 pb-1">
                    '모집중' 공식 오픈채팅
                  </div>
                  {/* Chat bubble 1 */}
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-800 dark:text-slate-250 p-2 py-1.5 rounded-2xl rounded-tl-none max-w-[85%] shadow-xs leading-normal self-start text-left">
                    '모집중' 오픈채팅에 오신 것을 환영합니다 👋
                  </div>
                  {/* Chat bubble 2 */}
                  <div className="bg-[#22C55E] text-white text-[10px] font-bold p-2 py-1.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-xs leading-normal self-end text-left">
                    하루 세 번, 새로 등록된 인기 모집글 소식을 보내드려요! 💌
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Control Pill (3번 사진 스타일) */}
          <div className="bg-white text-slate-900 border border-slate-200/80 px-4 py-1.5 rounded-full flex items-center gap-3 font-bold text-xs select-none shadow-md z-20 absolute bottom-4 right-4 md:bottom-6 md:right-6">
            <button 
              onClick={handlePrev}
              className="hover:text-primary transition-colors cursor-pointer p-0.5 flex items-center justify-center active:scale-90"
              title="이전 슬라이드"
            >
              <ChevronLeft className="w-4 h-4 text-slate-800 font-black" />
            </button>
            <div className="flex items-center gap-1 select-none font-black text-slate-800">
              <span>{currentSlide + 1}</span>
              <span className="opacity-30">|</span>
              <span>{totalSlides}</span>
            </div>
            <button 
              onClick={handleNext}
              className="hover:text-primary transition-colors cursor-pointer p-0.5 flex items-center justify-center active:scale-90"
              title="다음 슬라이드"
            >
              <ChevronRight className="w-4 h-4 text-slate-800 font-black" />
            </button>
          </div>
        </div>
      </section>

      {/* Category Section */}
      <section className="container pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide flex-1">
            {(["전체", "동아리", "학회", "스터디"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedKeyword(undefined);
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <Link href="/board">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5 font-bold text-muted-foreground hover:text-primary transition-all">
              모집게시판 전체보기 <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Unified Posts Grid */}
      <section className="container pb-10">
        {latestPosts && latestPosts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {latestPosts.map((item) => (
              <PostCard
                key={item.post.id}
                id={item.post.id}
                category={item.post.category}
                title={item.post.title}
                authorName={item.authorName}
                authorAvatarUrl={item.authorAvatarUrl}
                capacity={item.post.capacity}
                deadline={item.post.deadline}
                keywords={item.post.keywords}
                status={item.post.status}
                likeCount={(item as any).likeCount}
                commentCount={(item as any).commentCount}
                viewCount={item.post.viewCount}
                imageUrl={item.post.imageUrl}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">해당 카테고리에 모집 글이 없습니다</p>
            {isAuthenticated && (
              <Link href="/post/new">
                <Button className="mt-4" size="sm">
                  모집 글 작성하기
                </Button>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Keywords Section */}
      <section className="container pb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-start gap-6 mb-6">
          <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
            관심 키워드
          </h3>
          
          {/* Keyword Search & Autocomplete */}
          <div className="relative w-full md:w-64 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="키워드 검색..."
                value={kwQuery}
                onChange={(e) => setKwQuery(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary/50 transition-all"
              />
              {suggestions && suggestions.length > 0 && (
                <div className="absolute z-50 top-10 left-0 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setSelectedKeyword(suggestion);
                        setKwQuery("");
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-bold hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                    >
                      # {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedKeyword && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 rounded-xl text-[10px] font-black bg-primary/5 text-primary hover:bg-primary/10"
                onClick={() => setSelectedKeyword(undefined)}
              >
                필터 해제
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {displayKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => setSelectedKeyword(selectedKeyword === kw ? undefined : kw)}
              className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold ${
                selectedKeyword === kw
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >
              # {kw}
            </button>
          ))}
          {isAuthenticated && displayKeywords.length === 0 && !selectedKeyword && (
            <p className="text-xs text-muted-foreground font-medium italic">
              설정된 관심 키워드가 없습니다. 프로필에서 키워드를 설정해보세요!
            </p>
          )}
        </div>

        {/* Keyword Filtered / Recommended Posts Grid */}
        {keywordSectionPosts && keywordSectionPosts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* keywordPosts(post.list)와 recommendedPosts(post.recommended)의 union 타입 추론이
                실패해 any 로 떨어지는 영역 — 명시적 캐스팅으로 우회. PostCard 가 안전한 옵셔널 접근 사용 */}
            {keywordSectionPosts.map((item: typeof keywordSectionPosts[number]) => (
              <PostCard
                key={item.post.id}
                id={item.post.id}
                category={item.post.category}
                title={item.post.title}
                authorName={item.authorName}
                authorAvatarUrl={item.authorAvatarUrl}
                capacity={item.post.capacity}
                deadline={item.post.deadline}
                keywords={item.post.keywords}
                status={item.post.status}
                likeCount={(item as any).likeCount}
                commentCount={(item as any).commentCount}
                viewCount={item.post.viewCount}
                imageUrl={item.post.imageUrl}
              />
            ))}
          </div>
        ) : (
          selectedKeyword && (
            <div className="text-center py-10 text-muted-foreground border border-dashed rounded-2xl">
              <p className="text-sm">'{selectedKeyword}' 키워드에 해당하는 모집 글이 없습니다</p>
            </div>
          )
        )}
      </section>
    </Layout>
  );
}
