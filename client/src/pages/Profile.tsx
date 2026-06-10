import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Plus, X, User, Sparkles, Camera, Loader2, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";

type Grade = "1" | "2" | "3" | "4" | "대학원";

const GRADES: Grade[] = ["1", "2", "3", "4", "대학원"];

const KEYWORD_SUGGESTIONS = [
  "프로그래밍", "AI", "머신러닝", "데이터분석", "웹개발", "앱개발",
  "디자인", "UX/UI", "영어", "일본어", "중국어", "스페인어",
  "취업", "스타트업", "창업", "봉사", "음악", "스포츠",
  "독서", "토론", "연구", "마케팅", "경제", "법학",
  "의학", "공학", "사진", "영상", "글쓰기",
];

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  // 학과는 users.departmentId 가 정식 (6-a 마이그레이션 이후)
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [grade, setGrade] = useState<Grade | "">("");
  const [bio, setBio] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [deptInput, setDeptInput] = useState("");
  const [showDeptSuggestions, setShowDeptSuggestions] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDeptIndex, setSelectedDeptIndex] = useState(-1);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: departments, isLoading: deptLoading } = trpc.department.list.useQuery();

  // 학과 id → 이름 룩업
  const departmentMap = useMemo(() => {
    const m = new Map<number, string>();
    (departments ?? []).forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  const selectedDepartmentName =
    departmentId !== null ? departmentMap.get(departmentId) ?? "" : "";

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
      }
      setHasInitialized(true);
    }
  }, [profile, user, hasInitialized]);

  const upsertMutation = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      toast.success("프로필이 저장되었습니다!");
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (err) => toast.error(err.message || "저장에 실패했습니다."),
  });

  const uploadMutation = trpc.upload.image.useMutation({
    onSuccess: (data) => {
      setAvatarUrl(data.url);
      setIsUploading(false);
      toast.success("이미지가 업로드되었습니다.");
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error(err.message || "이미지 업로드에 실패했습니다.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
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

  const filteredDepts = (departments ?? []).filter((d) =>
    d.name.toLowerCase().includes(deptInput.toLowerCase())
  );

  const isLoading = profileLoading || deptLoading;
  const isSetupMode = new URLSearchParams(window.location.search).get("setup") === "true";
  // 6-a: department 자유문자열 → departmentId 로 검증
  const isFormValid = departmentId && grade && keywords.length > 0;

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
        // filteredDepts 는 객체 배열 → .id 로 setDepartmentId
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

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      const target = e.target as HTMLElement;
      if (target.id !== "keyword-input" && target.id !== "dept-input") {
        e.preventDefault();
      }
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group mb-4">
              <div className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} className="w-full h-full object-cover" alt="프로필 사진" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors">
                <Camera className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={isUploading} />
              </label>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black text-foreground">
                {isSetupMode ? "반가워요! 👋" : "프로필 설정"}
              </h1>
              <p className="text-muted-foreground font-light text-sm mt-1">
                {isSetupMode 
                  ? `${user?.name}님, 활동을 시작하기 전에 프로필을 완성해볼까요?`
                  : `${user?.name}님의 프로필을 작성하면 맞춤 추천을 받을 수 있어요`}
              </p>
            </div>
          </div>

          {/* 가입 시 입력한 정보 — 읽기 전용 */}
          {(user?.realName || user?.studentId || user?.admissionYear) && (
            <div className="bg-card border border-border rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-foreground">학교 인증 정보</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  검증 완료
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground mb-1">실명</dt>
                  <dd className="font-semibold text-foreground">{user?.realName ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">학번</dt>
                  <dd className="font-semibold text-foreground">{user?.studentId ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">입학년도</dt>
                  <dd className="font-semibold text-foreground">{user?.admissionYear ?? "-"}년</dd>
                </div>
              </dl>
              <p className="text-[10px] text-muted-foreground mt-3">
                실명·학번·입학년도는 학교 이메일 인증 시 등록되며 변경할 수 없습니다.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-xl" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
              {/* Name (readonly) */}
              <div className="space-y-2">
                <Label className="font-semibold">이름 (카카오)</Label>
                <Input value={user?.name ?? ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">카카오 닉네임은 로그인 계정에서 관리됩니다</p>
              </div>

              {/* Department — departments 마스터에서 선택 */}
              <div className="space-y-2 relative">
                <Label htmlFor="department" className="font-semibold">학과/전공</Label>
                <div
                  className={`flex items-center justify-between w-full h-12 px-4 rounded-xl border border-input bg-card text-sm cursor-pointer hover:border-primary/50 transition-all ${
                    !selectedDepartmentName ? "text-muted-foreground" : "text-foreground"
                  }`}
                  onClick={() => setShowDeptSuggestions(!showDeptSuggestions)}
                >
                  {selectedDepartmentName || "학과를 선택하세요"}
                  <div className={`transition-transform duration-200 ${showDeptSuggestions ? "rotate-180" : ""}`}>
                    <Plus className="w-4 h-4" />
                  </div>
                </div>

                {showDeptSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-border bg-muted/30">
                      <Input
                        id="dept-input"
                        placeholder="학과 검색..."
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
                    <div className="max-h-60 overflow-y-auto">
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
                          검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground px-1">한국외대 글로벌캠퍼스 학과만 선택 가능합니다</p>
              </div>

              {/* Grade */}
              <div className="space-y-2">
                <Label className="font-semibold">학년</Label>
                <div className="flex gap-2 flex-wrap">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(grade === g ? "" : g)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        grade === g
                          ? "bg-primary text-primary-foreground border-primary"
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
                <Label htmlFor="bio" className="font-semibold">
                  자기소개 <span className="text-muted-foreground font-normal">(선택)</span>
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) setBio(e.target.value);
                  }}
                  placeholder="간단한 자기소개를 작성해주세요 (최대 200자)"
                  maxLength={200}
                  rows={4}
                  className="resize-none rounded-xl focus:ring-primary/20"
                />
                <div className="flex justify-between items-center px-1">
                  <p className="text-[10px] text-muted-foreground">나를 잘 나타내는 소개를 적어주세요</p>
                  <p className={`text-xs font-medium ${bio.length >= 200 ? "text-destructive" : "text-muted-foreground"}`}>
                    {bio.length}/200
                  </p>
                </div>
              </div>

              {/* Keywords */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">관심 키워드</Label>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    추천에 활용됩니다
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  관심 분야 키워드를 등록하면 맞춤 모집 글을 추천해드립니다 (최대 10개)
                </p>

                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <span
                        key={kw}
                        className="flex items-center gap-1 bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-medium"
                      >
                        {kw}
                        <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Input
                    id="keyword-input"
                    placeholder="관심 키워드 입력 (엔터로 추가)"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    maxLength={30}
                    className="h-12 rounded-xl bg-muted/30 border-muted focus-visible:ring-primary/20 pr-12"
                    disabled={keywords.length >= 10}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-lg"
                    onClick={() => addKeyword(keywordInput)}
                    disabled={keywords.length >= 10}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {KEYWORD_SUGGESTIONS.filter((kw) => !keywords.includes(kw))
                    .slice(0, 15)
                    .map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => addKeyword(kw)}
                        disabled={keywords.length >= 10}
                        className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-40"
                      >
                        + {kw}
                      </button>
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <Button type="submit" disabled={upsertMutation.isPending || !isFormValid} className="w-full font-bold" size="lg">
                  {upsertMutation.isPending ? "저장 중..." : (isSetupMode ? "시작하기" : "프로필 저장")}
                </Button>
                {isSetupMode && (
                  <div className="text-center">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      나중에 할게요
                    </Link>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
