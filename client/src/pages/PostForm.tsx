import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
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
  ArrowLeft,
  Plus,
  X,
  Image as ImageIcon,
  Loader2,
  Trash2,
  GripVertical,
  Settings2,
} from "lucide-react";
import { Link } from "wouter";
import { nanoid } from "nanoid";


// 폼 빌더 타입 정의
export type FormQuestionType = "text" | "select";
export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  question: string;
  required: boolean;
  options?: string[]; // select 타입일 때 사용
}

// 타입 정의
type Category = "동아리" | "학회" | "스터디";
type MeetingType = "온라인" | "오프라인" | "온오프라인" | "미정";

// 옵션 목록
const CATEGORY_OPTIONS: Category[] = ["동아리", "학회", "스터디"];
const MEETING_OPTIONS: MeetingType[] = [
  "온라인",
  "오프라인",
  "온오프라인",
  "미정",
];

const SUGGESTED_KEYWORDS = [
  "프로그래밍",
  "AI",
  "데이터분석",
  "디자인",
  "영어",
  "일본어",
  "중국어",
  "취업",
  "스타트업",
  "봉사",
  "음악",
  "스포츠",
  "독서",
  "토론",
  "연구",
  "마케팅",
  "경제",
  "법학",
  "의학",
  "공학",
];

export default function PostForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const postId = id ? parseInt(id) : undefined;
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 폼 상태 관리 ---
  const [category, setCategory] = useState<Category>("동아리");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [capacity, setCapacity] = useState<number | string>(10);
  const [deadline, setDeadline] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("미정");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formSchema, setFormSchema] = useState<FormQuestion[]>([]);
  const [isTemplateApplied, setIsTemplateApplied] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [hasInterview, setHasInterview] = useState<number>(0);


  // 내가 리더인 그룹 조회
  const { data: myGroups = [] } = trpc.group.myGroups.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // [수정 모드] 데이터 조회
  const { data: existingPost } = trpc.post.get.useQuery(
    { id: postId! },
    { enabled: isEdit && !!postId }
  );

  const isInitialized = useRef(false);

  // Draft Auto-Save: Automatically save to localStorage every 1 second when form inputs change
  useEffect(() => {
    if (isEdit) return;
    const timer = setTimeout(() => {
      const draft = { category, title, content };
      localStorage.setItem("mojibjung_draft_form", JSON.stringify(draft));
    }, 1000);
    return () => clearTimeout(timer);
  }, [category, title, content, isEdit]);

  // Draft Restore: Check for saved drafts on component mount and prompt user to restore
  useEffect(() => {
    if (isEdit) return;
    const saved = localStorage.getItem("mojibjung_draft_form");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.title || parsed.content) {
          if (confirm("이전에 작성 중이던 임시 저장 글이 있습니다. 불러오시겠습니까?")) {
            setCategory(parsed.category || "동아리");
            setTitle(parsed.title || "");
            setContent(parsed.content || "");
          } else {
            localStorage.removeItem("mojibjung_draft_form");
          }
        }
      } catch (e) {
        console.error("Failed to restore draft:", e);
      }
    }
  }, [isEdit]);

  useEffect(() => {
    if (existingPost && !isInitialized.current) {
      const { post } = existingPost;
      setCategory(post.category);
      setTitle(post.title);
      setContent(post.content);
      setCapacity(post.capacity);
      setMeetingType((post as any).meetingType ?? "미정");
      setImageUrl(post.imageUrl);
      setGroupId((post as any).groupId || null); // 연동된 그룹 ID 로드
      setHasInterview((post as any).hasInterview ?? 0); // 면접 여부 로드

      if (post.deadline) {
        const d = new Date(post.deadline);
        // datetime-local format: YYYY-MM-DDTHH:mm
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const day = d.getDate().toString().padStart(2, "0");
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        setDeadline(`${year}-${month}-${day}T${hours}:${minutes}`);
      }
      try {
        setKeywords(JSON.parse(post.keywords ?? "[]"));
      } catch {
        /* ignore */
      }
      if (post.formSchema) {
        setFormSchema(post.formSchema as FormQuestion[]);
        setIsTemplateApplied(true);
      }
      isInitialized.current = true;
    }
  }, [existingPost]);

  // --- 카테고리별 기본 템플릿 적용 ---
  useEffect(() => {
    if (!isEdit && !isTemplateApplied) {
      const defaultTemplates: Record<Category, FormQuestion[]> = {
        동아리: [
          {
            id: nanoid(),
            type: "text",
            question: "동아리 지원 동기를 작성해주세요.",
            required: true,
          },
          {
            id: nanoid(),
            type: "select",
            question: "희망하는 부서를 선택해주세요.",
            required: true,
            options: ["기획부", "홍보부", "인사부", "운영부", "기타"],
          },
          {
            id: nanoid(),
            type: "text",
            question: "동아리 활동을 통해 기대하는 점은 무엇인가요?",
            required: false,
          },
        ],
        학회: [
          {
            id: nanoid(),
            type: "text",
            question: "관심 있는 연구/학술 분야를 작성해주세요.",
            required: true,
          },
          {
            id: nanoid(),
            type: "select",
            question: "관련 전공 과목 수강 여부",
            required: true,
            options: ["수강함", "수강하지 않음"],
          },
          {
            id: nanoid(),
            type: "text",
            question: "학회에서 어떤 역할을 맡고 싶으신가요?",
            required: false,
          },
        ],
        스터디: [
          {
            id: nanoid(),
            type: "select",
            question: "희망하는 역할을 선택해주세요.",
            required: true,
            options: ["프론트엔드", "백엔드", "디자이너", "기획자", "기타"],
          },
          {
            id: nanoid(),
            type: "text",
            question: "사용 가능한 기술 스택이나 경험을 적어주세요.",
            required: true,
          },
          {
            id: nanoid(),
            type: "select",
            question:
              "일주일에 스터디/프로젝트에 할애할 수 있는 시간은 어느 정도인가요?",
            required: true,
            options: ["10시간 미만", "10-20시간", "20시간 이상"],
          },
        ],
      };
      setFormSchema(defaultTemplates[category]);
    }
  }, [category, isEdit, isTemplateApplied]);

  // 템플릿 변경 버튼을 눌렀을 때 수동 덮어쓰기
  const applyTemplate = (cat: Category) => {
    if (
      confirm(
        "기존에 작성된 폼 내용이 초기화되고 해당 카테고리 템플릿으로 덮어씌워집니다. 진행하시겠습니까?"
      )
    ) {
      setIsTemplateApplied(false);
      setCategory(cat);
    }
  };

  // 폼 문항 추가
  const addQuestion = (type: FormQuestionType) => {
    setFormSchema([
      ...formSchema,
      {
        id: nanoid(),
        type,
        question: "",
        required: true,
        options: type === "select" ? ["옵션 1", "옵션 2"] : undefined,
      },
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
    setFormSchema(
      formSchema.map(q => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const deleteQuestion = (id: string) => {
    setFormSchema(formSchema.filter(q => q.id !== id));
  };

  // --- 이미지 업로드 ---
  const uploadMutation = trpc.upload.image.useMutation();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("이미지 크기는 5MB 이하여야 합니다.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      setIsUploading(true);
      try {
        const base64 = reader.result as string;
        const res = await uploadMutation.mutateAsync({
          data: base64,
          name: file.name,
          type: file.type,
        });

        if (res?.url) {
          setImageUrl(res.url);
          toast.success("이미지가 업로드되었습니다.");
        } else {
          throw new Error("서버로부터 이미지 URL을 받지 못했습니다.");
        }
      } catch (err: any) {
        console.error("이미지 업로드 에러:", err);
        toast.error(err.message || "이미지 업로드에 실패했습니다.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- 뮤테이션 ---
  const createMutation = trpc.post.create.useMutation({
    onSuccess: data => {
      localStorage.removeItem("mojibjung_draft_form");
      toast.success("모집 글이 등록되었습니다!");
      navigate(`/post/${data?.post.id}`);
    },
    onError: err => toast.error(err.message),
  });

  const updateMutation = trpc.post.update.useMutation({
    onSuccess: data => {
      toast.success("수정되었습니다!");
      navigate(`/post/${data?.post.id}`);
    },
    onError: err => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요.");
      return;
    }


    const payload = {
      category,
      title: title.trim(),
      content: content.trim(),
      capacity:
        typeof capacity === "string" ? parseInt(capacity) || 1 : capacity,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      meetingType,
      keywords,
      imageUrl: imageUrl || undefined,
      hasInterview,
      formSchema,

      groupId: groupId || undefined,
    };

    if (isEdit && postId) {
      updateMutation.mutate({ id: postId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed || keywords.includes(trimmed) || keywords.length >= 10) return;
    setKeywords([...keywords, trimmed]);
    setKeywordInput("");
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>
            로그인하기
          </Button>
        </div>
      </Layout>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/board">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 mb-6 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" /> 게시판으로
            </Button>
          </Link>

          <h1 className="text-3xl font-black mb-2">
            {isEdit ? "모집 글 수정" : "모집 글 작성"}
          </h1>
          <p className="text-muted-foreground font-light mb-8">
            대표 이미지를 설정하고 자세한 모집 정보를 입력하세요
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 대표 이미지 섹션 */}
            <div className="space-y-3">
              <Label className="font-bold text-base">대표 이미지</Label>
              <div className="flex flex-col gap-4">
                {imageUrl ? (
                  <div className="relative group rounded-3xl overflow-hidden border border-border bg-muted/20">
                    <img
                      src={imageUrl}
                      alt="미리보기"
                      className="w-full h-auto max-h-[400px] object-contain mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-lg text-destructive hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-48 border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/[0.02] transition-all disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">
                          이미지 업로드 (선택)
                        </p>
                      </>
                    )}
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">카테고리 *</Label>
              <div className="flex gap-2">
                {CATEGORY_OPTIONS.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-6 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                      category === cat
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {cat === "스터디" ? "프로젝트" : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 일정 연동 그룹 선택 (동아리, 학회, 스터디 카테고리에 해당하고, 리더인 그룹이 있을 때만 활성화) */}
            {myGroups.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="group-select" className="font-bold">
                  일정 연동할 그룹 (선택)
                </Label>
                <div className="relative">
                  <select
                    id="group-select"
                    value={groupId || ""}
                    onChange={e =>
                      setGroupId(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground font-semibold text-sm appearance-none outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">일정을 연동하지 않음</option>
                    {myGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">
                  그룹을 연동하면 지원자들이 모집 상세 페이지에서 일정을 확인할
                  수 있고, 최종 합격 시 멤버로 자동 가입되어 해당 스케줄이 본인
                  캘린더에 연동됩니다.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-bold">진행 방식 *</Label>
              <div className="flex gap-2 flex-wrap">
                {MEETING_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setMeetingType(opt)}
                    className={`px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                      meetingType === opt
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">가입 전형 방식 *</Label>
              <div className="flex gap-2 flex-wrap">
                <button
                  key="no-interview"
                  type="button"
                  onClick={() => setHasInterview(0)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                    hasInterview === 0
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  서류 (즉시 최종 합격)
                </button>
                <button
                  key="yes-interview"
                  type="button"
                  onClick={() => setHasInterview(1)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                    hasInterview === 1
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  서류 + 면접 (1차 합격 후 면접 진행)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold text-base">
                제목 *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="모집 글 제목을 입력하세요"
                maxLength={200}
                className="h-12 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="font-bold text-base">
                내용 *
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="모집 내용, 활동 소개, 지원 방법 등을 자세히 작성해주세요"
                rows={12}
                className="resize-none rounded-2xl p-4"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="capacity" className="font-bold">
                  모집 인원 *
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  min={1}
                  max={999}
                  className="h-12 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline" className="font-bold">
                  마감 일시 (선택)
                </Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-bold">키워드 태그 (최대 10개)</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {keywords.map(kw => (
                  <span
                    key={kw}
                    className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-xl font-bold border border-primary/10"
                  >
                    {kw}{" "}
                    <button
                      type="button"
                      onClick={() =>
                        setKeywords(keywords.filter(k => k !== kw))
                      }
                      className="hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword(keywordInput);
                    }
                  }}
                  placeholder="키워드 입력"
                  maxLength={30}
                  className="h-12 rounded-xl"
                />
                <Button
                  type="button"
                  onClick={() => addKeyword(keywordInput)}
                  disabled={keywords.length >= 10}
                  className="h-12 w-12 rounded-xl"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_KEYWORDS.filter(kw => !keywords.includes(kw))
                  .slice(0, 10)
                  .map(kw => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => addKeyword(kw)}
                      className="text-[11px] font-bold bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      +{kw}
                    </button>
                  ))}
              </div>
            </div>

            {/* 자체 폼 빌더 섹션 */}
            <div className="space-y-4 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-bold text-lg flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-primary" />
                    지원서 폼 설정
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    지원자들이 작성할 자체 지원서 폼을 구성하세요.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addQuestion("text")}
                    className="gap-1.5 h-9 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5" /> 주관식 추가
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addQuestion("select")}
                    className="gap-1.5 h-9 rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5" /> 객관식 추가
                  </Button>
                </div>
              </div>

              {formSchema.length === 0 ? (
                <div className="bg-muted/30 border border-dashed rounded-2xl p-8 text-center text-muted-foreground">
                  <p>등록된 질문이 없습니다.</p>
                  <p className="text-sm mt-1">
                    버튼을 눌러 질문을 추가하거나 카테고리 템플릿을 불러오세요.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => applyTemplate(category)}
                    className="mt-2 h-auto p-0"
                  >
                    {category === "스터디" ? "프로젝트" : category} 기본 템플릿 불러오기
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {formSchema.map((q, index) => (
                    <div
                      key={q.id}
                      className="relative bg-card border border-border p-5 rounded-2xl shadow-sm group"
                    >
                      <button
                        type="button"
                        onClick={() => deleteQuestion(q.id)}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-start gap-3">
                        <div className="mt-2.5 cursor-move text-muted-foreground opacity-50">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="bg-primary/10 text-primary text-[11px] px-2 py-1 rounded-md font-bold shrink-0">
                              {q.type === "text" ? "주관식" : "객관식"}
                            </span>
                            <Input
                              value={q.question}
                              onChange={e =>
                                updateQuestion(q.id, {
                                  question: e.target.value,
                                })
                              }
                              placeholder="질문을 입력하세요"
                              className="font-semibold border-none bg-transparent hover:bg-muted focus-visible:bg-background focus-visible:ring-1 text-base px-2 -ml-2"
                            />
                          </div>

                          {q.type === "select" && (
                            <div className="pl-2 space-y-2">
                              {q.options?.map((opt, optIndex) => (
                                <div
                                  key={optIndex}
                                  className="flex items-center gap-2"
                                >
                                  <div className="w-4 h-4 rounded-full border border-primary/50 shrink-0" />
                                  <Input
                                    value={opt}
                                    onChange={e => {
                                      const newOptions = [...(q.options || [])];
                                      newOptions[optIndex] = e.target.value;
                                      updateQuestion(q.id, {
                                        options: newOptions,
                                      });
                                    }}
                                    className="h-8 w-48 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOptions = q.options?.filter(
                                        (_, idx) => idx !== optIndex
                                      );
                                      updateQuestion(q.id, {
                                        options: newOptions,
                                      });
                                    }}
                                    className="text-muted-foreground hover:text-destructive p-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 ml-6 text-primary"
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    options: [
                                      ...(q.options || []),
                                      `옵션 ${(q.options?.length || 0) + 1}`,
                                    ],
                                  })
                                }
                              >
                                <Plus className="w-3 h-3" /> 옵션 추가
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={e =>
                                  updateQuestion(q.id, {
                                    required: e.target.checked,
                                  })
                                }
                                className="rounded border-muted-foreground/30 text-primary focus:ring-primary"
                              />
                              필수 응답
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>



            <div className="flex gap-4 pt-6 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => history.back()}
                className="flex-1 h-14 rounded-2xl font-bold"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isPending || isUploading}
                className="flex-[2] h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20"
              >
                {isPending
                  ? "처리 중..."
                  : isEdit
                    ? "수정 완료"
                    : "모집 글 등록"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
