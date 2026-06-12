import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Plus,
  X,
  User,
  Sparkles,
  Camera,
  Loader2,
  ShieldCheck,
  Mail,
  Key,
  BookOpen,
  UserCheck,
  Timer,
  CheckCircle2,
  ChevronRight,
  School,
  FileText,
  Lock
} from "lucide-react";
import { Link, useLocation } from "wouter";

type Grade = "1" | "2" | "3" | "4" | "대학원";
const GRADES: Grade[] = ["1", "2", "3", "4", "대학원"];

const KEYWORD_SUGGESTIONS = [
  "프로그래밍", "AI", "머신러닝", "데이터분석", "웹개발", "앱개발",
  "디자인", "UX/UI", "영어", "일본어", "중국어", "스페인어",
  "취업", "스타트업", "창업", "봉사", "음악", "스포츠",
  "독서", "토론", "연구", "마케팅", "경제", "법학",
  "의학", "공학", "사진", "영상", "글쓰기"
];

const currentYear = new Date().getFullYear();
const ADMISSION_YEARS = Array.from({ length: 15 }, (_, i) => currentYear - i);

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const isSetupMode = new URLSearchParams(window.location.search).get("setup") === "true";

  // 단계 제어
  const [step, setStep] = useState<"email" | "academic" | "profile">("email");

  // 이메일 인증 관련 상태
  const [emailId, setEmailId] = useState(""); // 오직 아이디 부분만 입력받음
  const [codeInput, setCodeInput] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [timer, setTimer] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Hidden input ref for OTP typing
  const otpInputRef = useRef<HTMLInputElement>(null);

  // 학적 정보 관련 상태
  const [realName, setRealName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [admissionYear, setAdmissionYear] = useState<number>(currentYear);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [deptInput, setDeptInput] = useState("");
  const [showDeptSuggestions, setShowDeptSuggestions] = useState(false);
  const [selectedDeptIndex, setSelectedDeptIndex] = useState(-1);

  // 프로필 정보 관련 상태
  const [grade, setGrade] = useState<Grade | "">("");
  const [bio, setBio] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [hasInitialized, setHasInitialized] = useState(false);

  // API 호출
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: departments, isLoading: deptLoading } = trpc.department.list.useQuery();

  const departmentMap = useMemo(() => {
    const m = new Map<number, string>();
    (departments ?? []).forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  const selectedDepartmentName =
    departmentId !== null ? departmentMap.get(departmentId) ?? "" : "";

  // 이메일 인증 요청
  const sendEmailMutation = trpc.auth.sendEmailVerification.useMutation({
    onSuccess: () => {
      setIsEmailSent(true);
      setTimer(300);
      setIsTimerActive(true);
      toast.success("인증번호가 발송되었습니다. 학교 메일을 확인해 주세요.");
      // OTP 입력창 포커스
      setTimeout(() => otpInputRef.current?.focus(), 100);
    },
    onError: (err) => {
      toast.error(err.message || "인증 메일 전송에 실패했습니다.");
    },
  });

  // 이메일 인증 검증
  const verifyCodeMutation = trpc.auth.verifyEmailCode.useMutation({
    onSuccess: () => {
      setIsEmailVerified(true);
      setIsTimerActive(false);
      toast.success("학교 인증이 정상 완료되었습니다!");
      setStep("academic");
    },
    onError: (err) => {
      toast.error(err.message || "보안코드가 일치하지 않습니다.");
    },
  });

  // 회원 등록 승인
  const completeRegMutation = trpc.auth.completeRegistration.useMutation({
    onSuccess: () => {
      toast.success("학적 정보가 승인되었습니다.");
      utils.auth.me.invalidate();
      setStep("profile");
    },
    onError: (err) => {
      toast.error(err.message || "등록 처리에 실패했습니다.");
    },
  });

  // 프로필 저장
  const upsertMutation = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      toast.success("가입을 진심으로 환영합니다!");
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (err) => toast.error(err.message || "프로필 저장 실패"),
  });

  // 테스트 및 디버깅용 계정 리셋 뮤테이션
  const resetMutation = trpc.auth.resetSelfToPending.useMutation({
    onSuccess: () => {
      toast.success("계정 인증 상태가 초기화되었습니다. 이메일 인증을 다시 시작합니다.");
      utils.auth.me.invalidate();
      setStep("email");
      setIsEmailSent(false);
      setIsEmailVerified(false);
      setCodeInput("");
      setEmailId("");
      setRealName("");
      setStudentId("");
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message || "계정 초기화에 실패했습니다.");
    },
  });

  // 이미지 업로드
  const uploadMutation = trpc.upload.image.useMutation({
    onSuccess: (data) => {
      setAvatarUrl(data.url);
      setIsUploading(false);
      toast.success("프로필 사진이 적용되었습니다.");
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error(err.message || "업로드 실패");
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Effect 및 타이머
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && user.status === "verified" && user.realName && user.verifiedEmail) {
      setStep("profile");
    } else {
      setStep("email");
    }
  }, [user]);

  useEffect(() => {
    if ((profile || user) && !hasInitialized) {
      if (profile) {
        const p = profile.profile;
        setGrade((p?.grade as Grade) ?? "");
        setBio(p?.bio ?? "");
        try {
          setKeywords(JSON.parse(p?.keywords ?? "[]"));
        } catch {
          /* ignore */
        }
      }
      if (user) {
        setAvatarUrl(user.avatarUrl ?? null);
        setDepartmentId(user.departmentId ?? null);
        if (user.realName) setRealName(user.realName);
        if (user.studentId) setStudentId(user.studentId);
        if (user.admissionYear) setAdmissionYear(user.admissionYear);
      }
      setHasInitialized(true);
    }
  }, [profile, user, hasInitialized]);

  useEffect(() => {
    let intervalId: any;
    if (isTimerActive && timer > 0) {
      intervalId = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(intervalId);
  }, [isTimerActive, timer]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 폼 및 이벤트 헬퍼
  // ─────────────────────────────────────────────────────────────────────────────
  const fullEmail = useMemo(() => {
    if (!emailId.trim()) return "";
    return `${emailId.trim()}@hufs.ac.kr`;
  }, [emailId]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timer]);

  const handleSendEmail = () => {
    if (!emailId.trim()) {
      toast.error("이메일 아이디를 기입해주세요.");
      return;
    }
    sendEmailMutation.mutate({ email: fullEmail });
  };

  const handleVerifyCode = () => {
    if (codeInput.length !== 6) {
      toast.error("6자리 인증번호를 마저 채워주세요.");
      return;
    }
    verifyCodeMutation.mutate({ email: fullEmail, code: codeInput });
  };

  const handleAcademicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim()) return toast.error("실명을 기입해 주세요.");
    if (!/^\d{9,10}$/.test(studentId)) return toast.error("학번은 9~10자리여야 합니다.");
    if (!departmentId) return toast.error("학과를 선택해주세요.");

    completeRegMutation.mutate({
      realName: realName.trim(),
      studentId: studentId.trim(),
      admissionYear,
      departmentId,
    });
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({
      departmentId: departmentId ?? undefined,
      grade: grade || undefined,
      bio: bio || undefined,
      keywords,
      avatarUrl,
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("이미지 크기는 5MB 이하여야 합니다.");
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      uploadMutation.mutate({ data: base64, name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed || keywords.includes(trimmed) || keywords.length >= 10) return;
    setKeywords([...keywords, trimmed]);
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => setKeywords(keywords.filter((k) => k !== kw));

  const filteredDepts = (departments ?? []).filter((d) =>
    d.name.toLowerCase().includes(deptInput.toLowerCase())
  );

  const handleDeptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDeptSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedDeptIndex((prev) => (prev < filteredDepts.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedDeptIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedDeptIndex >= 0 && filteredDepts[selectedDeptIndex]) {
        setDepartmentId(filteredDepts[selectedDeptIndex].id);
        setDeptInput("");
        setShowDeptSuggestions(false);
        setSelectedDeptIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowDeptSuggestions(false);
      setSelectedDeptIndex(-1);
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>로그인하기</Button>
        </div>
      </Layout>
    );
  }

  const isLoading = profileLoading || deptLoading;

  return (
    <Layout>
      <div className="container py-8 max-w-3xl mx-auto">
        
        {/* Onboarding Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          {step === "profile" && (
            <div className="relative group mb-4">
              <div className="w-24 h-24 rounded-full bg-card border-2 border-primary/20 overflow-hidden flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} className="w-full h-full object-cover" alt="프로필 사진" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/95 transition-all">
                <Camera className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={isUploading} />
              </label>
            </div>
          )}

          <h1 className="text-3xl font-black text-foreground tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            {isSetupMode ? "반가워요! 👋" : "내 프로필 설정"}
          </h1>
          <p className="text-muted-foreground font-light text-sm mt-1.5">
            {isSetupMode 
              ? `${user?.name}님, 한국외대 학우들을 위한 실명 안전 커뮤니티입니다.`
              : "내 프로필을 작성하고 어울리는 스터디/동아리 제안을 받아보세요."}
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
         * Glow Step Indicator (차별화된 네온 스타일)
         * ───────────────────────────────────────────────────────────────────────────── */}
        {isSetupMode && user?.status !== "verified" && (
          <div className="relative mb-8 bg-card border border-border rounded-2xl p-4 shadow-sm overflow-hidden">
            {/* 배경 그라디언트 효과 라인 */}
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-muted -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-8 h-0.5 bg-gradient-to-r from-primary to-blue-500 -translate-y-1/2 transition-all duration-500 z-0"
              style={{
                width: step === "email" ? "0%" : step === "academic" ? "50%" : "90%"
              }}
            />
            
            <div className="relative flex items-center justify-between z-10">
              {/* Step 1 */}
              <div className="flex flex-col items-center gap-1 bg-card px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === "email" 
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                    : isEmailVerified 
                      ? "bg-emerald-500 text-white" 
                      : "bg-muted text-muted-foreground"
                }`}>
                  {isEmailVerified ? <CheckCircle2 className="w-4 h-4" /> : "1"}
                </div>
                <span className={`text-[10px] font-bold ${step === "email" ? "text-primary" : "text-muted-foreground"}`}>이메일 인증</span>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center gap-1 bg-card px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === "academic" 
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                    : user?.status === "verified" 
                      ? "bg-emerald-500 text-white" 
                      : "bg-muted text-muted-foreground"
                }`}>
                  {user?.status === "verified" ? <CheckCircle2 className="w-4 h-4" /> : "2"}
                </div>
                <span className={`text-[10px] font-bold ${step === "academic" ? "text-primary" : "text-muted-foreground"}`}>학적 승인</span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center gap-1 bg-card px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === "profile" 
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  3
                </div>
                <span className={`text-[10px] font-bold ${step === "profile" ? "text-primary" : "text-muted-foreground"}`}>상세 정보</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl p-6 shadow-md relative overflow-hidden backdrop-blur-md">
            
            {/* ─────────────────────────────────────────────────────────────────────────────
             * [Step 1] 이메일 인증 단계 (차별화된 입력 잠금 및 OTP Box UI)
             * ───────────────────────────────────────────────────────────────────────────── */}
            {step === "email" && (
              <div className="space-y-8">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">학교 메일로만 가입이 가능합니다</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  '모집중' 서비스는 안전한 교내 네트워크를 보장하기 위해 한국외대 글로벌캠퍼스 재학생 공식 웹메일(<b>@hufs.ac.kr</b>) 도메인 외의 이메일(네이버, Gmail 등) 가입을 완전히 제한하고 있습니다.
                </p>

                <div className="space-y-3">
                  <Label htmlFor="email-id" className="font-semibold text-sm text-muted-foreground">학교 이메일 아이디</Label>
                  <div className="flex gap-3">
                    <div className="relative flex-1 flex items-center rounded-xl border border-input bg-card focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden h-14">
                      <Input
                        id="email-id"
                        placeholder="이메일 아이디 입력"
                        value={emailId}
                        onChange={(e) => {
                          // @ 기호 입력을 강제로 필터링하여 우회 방지
                          const val = e.target.value.replace(/@.*/g, "").trim();
                          setEmailId(val);
                        }}
                        disabled={isEmailSent && isTimerActive}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-full font-semibold flex-1 px-4 bg-transparent text-base"
                      />
                      
                      {/* 차별화된 도메인 잠금(Locked Suffix) 배지 */}
                      <div className="flex items-center gap-1.5 px-4 py-2 mr-2 bg-muted rounded-lg text-sm font-bold text-muted-foreground select-none border border-border">
                        <Lock className="w-3.5 h-3.5 text-primary" />
                        <span>@hufs.ac.kr</span>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={sendEmailMutation.isPending || (isEmailSent && isTimerActive && timer > 280)}
                      className="h-14 px-6 font-extrabold text-base rounded-xl bg-primary hover:bg-primary/95 text-white transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
                    >
                      {sendEmailMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isEmailSent ? (
                        "코드 재전송"
                      ) : (
                        "인증요청"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground px-1">
                    골뱅이(@) 기호는 자동으로 처리됩니다. 이메일 아이디 부분만 적어주세요.
                  </p>
                </div>

                {isEmailSent && (
                  <div className="space-y-5 p-6 bg-muted/40 rounded-2xl border border-border/80 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-primary" />
                        보안 코드 6자리 입력
                      </Label>
                      {isTimerActive && (
                        <span className="text-xs font-bold text-destructive flex items-center gap-1 bg-destructive/10 px-2.5 py-1 rounded-full">
                          <Timer className="w-3.5 h-3.5 animate-pulse" />
                          {formattedTime}
                        </span>
                      )}
                    </div>
                    
                    {/* ───────────────────────────────────────────────────────────────────────
                     * 차별화된 6자리 개별 OTP 박스 UI
                     * ─────────────────────────────────────────────────────────────────────── */}
                    <div className="relative py-3 flex justify-center">
                      {/* 실제 입력을 받는 숨겨진 input */}
                      <input
                        ref={otpInputRef}
                        type="text"
                        maxLength={6}
                        value={codeInput}
                        onChange={(e) => {
                          const cleanVal = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setCodeInput(cleanVal);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                        disabled={!isTimerActive || verifyCodeMutation.isPending}
                      />
                      
                      {/* 비주얼 6진수 박스 */}
                      <div className="flex gap-3" onClick={() => otpInputRef.current?.focus()}>
                        {Array.from({ length: 6 }).map((_, index) => {
                          const char = codeInput[index] || "";
                          const isFocused = isTimerActive && (codeInput.length === index || (codeInput.length === 6 && index === 5));
                          return (
                            <div
                              key={index}
                              className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-3xl font-black transition-all ${
                                isFocused 
                                  ? "border-primary bg-card text-primary shadow-[0_0_10px_rgba(59,130,246,0.3)] scale-105" 
                                  : char 
                                    ? "border-border bg-card text-foreground" 
                                    : "border-border bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              {char}
                              {isFocused && !char && (
                                <span className="w-0.5 h-7 bg-primary animate-pulse" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verifyCodeMutation.isPending || !isTimerActive || codeInput.length !== 6}
                      className="w-full h-14 font-extrabold text-base bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.2)] transition-all"
                    >
                      {verifyCodeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        "보안 코드 인증 확인"
                      )}
                    </Button>

                    {!isTimerActive && (
                      <p className="text-xs text-destructive text-center font-bold">
                        인증 대기 시간이 끝났습니다. 우측 상단 '코드 재전송'을 눌러주세요.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────────
             * [Step 2] 학적 정보 입력 단계
             * ───────────────────────────────────────────────────────────────────────────── */}
            {step === "academic" && (
              <form onSubmit={handleAcademicSubmit} className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <School className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">학적 정보를 매칭합니다</h2>
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed">
                  허위 정보 기입 시 서비스 이용 제한을 받을 수 있습니다. 실명과 학번은 1인 1계정 보안 매칭용도로만 사용됩니다.
                </p>

                {/* RealName */}
                <div className="space-y-2">
                  <Label htmlFor="realName" className="font-semibold text-xs text-muted-foreground">실명 (한글 본명)</Label>
                  <Input
                    id="realName"
                    placeholder="본인의 한글 이름 입력"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value.replace(/[^ㄱ-ㅎ가-힣]/g, ""))}
                    className="h-12 rounded-xl focus:ring-primary/20 font-semibold"
                    required
                  />
                </div>

                {/* Student ID */}
                <div className="space-y-2">
                  <Label htmlFor="studentId" className="font-semibold text-xs text-muted-foreground">학번 (9~10자리)</Label>
                  <Input
                    id="studentId"
                    placeholder="학번 입력 (예: 202612345)"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                    maxLength={10}
                    className="h-12 rounded-xl focus:ring-primary/20 font-semibold"
                    required
                  />
                </div>

                {/* Admission Year */}
                <div className="space-y-2">
                  <Label htmlFor="admissionYear" className="font-semibold text-xs text-muted-foreground">입학년도</Label>
                  <select
                    id="admissionYear"
                    value={admissionYear}
                    onChange={(e) => setAdmissionYear(Number(e.target.value))}
                    className="w-full h-12 px-4 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                  >
                    {ADMISSION_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}학년도 입학
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div className="space-y-2 relative">
                  <Label htmlFor="department" className="font-semibold text-xs text-muted-foreground">학과 / 학부</Label>
                  <div
                    className={`flex items-center justify-between w-full h-12 px-4 rounded-xl border border-input bg-card text-sm cursor-pointer hover:border-primary/50 transition-all font-semibold ${
                      !selectedDepartmentName ? "text-muted-foreground" : "text-foreground"
                    }`}
                    onClick={() => setShowDeptSuggestions(!showDeptSuggestions)}
                  >
                    {selectedDepartmentName || "학과 검색 후 선택"}
                    <div className={`transition-transform duration-200 ${showDeptSuggestions ? "rotate-180" : ""}`}>
                      <Plus className="w-4 h-4 text-primary" />
                    </div>
                  </div>

                  {showDeptSuggestions && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-2 border-b border-border bg-muted/30">
                        <Input
                          id="dept-input"
                          placeholder="학과 명칭 검색..."
                          value={deptInput}
                          onChange={(e) => {
                            setDeptInput(e.target.value);
                            setSelectedDeptIndex(-1);
                          }}
                          onKeyDown={handleDeptKeyDown}
                          className="h-9 text-xs"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredDepts.map((d, index) => (
                          <button
                            key={d.id}
                            type="button"
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors ${
                              index === selectedDeptIndex || departmentId === d.id
                                ? "bg-primary/10 text-primary font-bold"
                                : "text-foreground"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDepartmentId(d.id);
                              setShowDeptSuggestions(false);
                              setDeptInput("");
                            }}
                          >
                            {d.name}
                          </button>
                        ))}
                        {filteredDepts.length === 0 && (
                          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                            학과명을 다시 확인해 주세요.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={completeRegMutation.isPending || !realName.trim() || !/^\d{9,10}$/.test(studentId) || !departmentId}
                  className="w-full h-12 font-bold rounded-xl mt-4 bg-primary hover:bg-primary/95 text-white transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
                >
                  {completeRegMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    "학적 및 인증 정보 최종 등록"
                  )}
                </Button>
              </form>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────────
             * [Step 3] 상세 프로필 등록 단계
             * ───────────────────────────────────────────────────────────────────────────── */}
            {step === "profile" && (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                
                {user?.status === "verified" && user?.realName && user?.studentId && (
                  <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 mb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-bounce" />
                      <span className="text-xs font-bold text-foreground">학교 공식 인증 완료 계정</span>
                    </div>
                    <dl className="grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                      <div>
                        <dt className="mb-0.5">실명</dt>
                        <dd className="font-bold text-foreground">{user.realName}</dd>
                      </div>
                      <div>
                        <dt className="mb-0.5">학번</dt>
                        <dd className="font-bold text-foreground">{user.studentId}</dd>
                      </div>
                      <div>
                        <dt className="mb-0.5">인증 계정</dt>
                        <dd className="font-bold text-foreground truncate">{user.verifiedEmail}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">
                    {isSetupMode ? "3단계: 프로필 상세 채우기" : "프로필 수정"}
                  </h2>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-muted-foreground">학교 인증 실명</Label>
                  <Input value={user?.realName ?? "미인증"} disabled className="bg-muted h-12 rounded-xl text-muted-foreground font-semibold" />
                  <p className="text-[10px] text-muted-foreground px-1">
                    실명은 학교 이메일 인증(학적 등록) 시 기입한 이름을 사용하며 변경할 수 없습니다.
                  </p>
                </div>

                {user?.status === "verified" && (
                  <div className="space-y-2 relative">
                    <Label htmlFor="department" className="font-semibold text-xs text-muted-foreground">학과 변경 (선택)</Label>
                    <div
                      className={`flex items-center justify-between w-full h-12 px-4 rounded-xl border border-input bg-card text-sm cursor-pointer hover:border-primary/50 transition-all font-semibold ${
                        !selectedDepartmentName ? "text-muted-foreground" : "text-foreground"
                      }`}
                      onClick={() => setShowDeptSuggestions(!showDeptSuggestions)}
                    >
                      {selectedDepartmentName || "학과 검색"}
                      <div className={`transition-transform duration-200 ${showDeptSuggestions ? "rotate-180" : ""}`}>
                        <Plus className="w-4 h-4 text-primary" />
                      </div>
                    </div>

                    {showDeptSuggestions && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-border bg-muted/30">
                          <Input
                            id="dept-input"
                            placeholder="학과 이름 검색..."
                            value={deptInput}
                            onChange={(e) => {
                              setDeptInput(e.target.value);
                              setSelectedDeptIndex(-1);
                            }}
                            onKeyDown={handleDeptKeyDown}
                            className="h-9 text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {filteredDepts.map((d, index) => (
                            <button
                              key={d.id}
                              type="button"
                              className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors ${
                                index === selectedDeptIndex || departmentId === d.id
                                  ? "bg-primary/10 text-primary font-bold"
                                  : "text-foreground"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDepartmentId(d.id);
                                setShowDeptSuggestions(false);
                                setDeptInput("");
                              }}
                            >
                              {d.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grade */}
                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-muted-foreground">학년</Label>
                  <div className="flex gap-2 flex-wrap">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(grade === g ? "" : g)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          grade === g
                            ? "bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
                            : "bg-card text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {g === "대학원" ? "대학원" : `${g}학년`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio" className="font-semibold text-xs text-muted-foreground">자기소개</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => {
                      if (e.target.value.length <= 200) setBio(e.target.value);
                    }}
                    placeholder="활동 지원 및 승인 시 보여질 자기소개를 적어보세요 (최대 200자)"
                    maxLength={200}
                    rows={4}
                    className="resize-none rounded-xl focus:ring-primary/20 text-sm font-medium"
                  />
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
                    <span>나를 어필할 수 있는 소개글을 작성해 주세요.</span>
                    <span className={bio.length >= 200 ? "text-destructive font-bold" : ""}>
                      {bio.length}/200
                    </span>
                  </div>
                </div>

                {/* Keywords */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="font-semibold text-xs text-muted-foreground">관심 키워드</Label>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      추천 매칭 우선순위 반영
                    </span>
                  </div>
                  
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((kw) => (
                        <span
                          key={kw}
                          className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-bold border border-primary/20"
                        >
                          {kw}
                          <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-destructive transition-colors ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      id="keyword-input"
                      placeholder="관심 키워드 기재 후 엔터 또는 + 클릭 (최대 10개)"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKeyword(keywordInput);
                        }
                      }}
                      maxLength={30}
                      className="h-12 rounded-xl focus:ring-primary/20 pr-12 text-sm font-semibold"
                      disabled={keywords.length >= 10}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-lg hover:bg-muted"
                      onClick={() => addKeyword(keywordInput)}
                      disabled={keywords.length >= 10}
                    >
                      <Plus className="w-4 h-4 text-primary" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {KEYWORD_SUGGESTIONS.filter((kw) => !keywords.includes(kw))
                      .slice(0, 8)
                      .map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => addKeyword(kw)}
                          disabled={keywords.length >= 10}
                          className="text-[11px] bg-muted/70 text-muted-foreground px-2.5 py-1 rounded-full hover:bg-primary/15 hover:text-primary transition-colors disabled:opacity-40 font-bold"
                        >
                          + {kw}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    disabled={upsertMutation.isPending || !departmentId || !grade || keywords.length === 0}
                    className="w-full h-12 font-bold rounded-xl bg-primary hover:bg-primary/95 text-white transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
                  >
                    {upsertMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : isSetupMode ? (
                      "모집중 메인 홈 시작하기"
                    ) : (
                      "수정 완료 및 프로필 저장"
                    )}
                  </Button>
                </div>
              </form>
            )}

          </div>
        )}

      </div>
    </Layout>
  );
}
