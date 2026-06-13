import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, PenSquare } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

type Category = "동아리" | "학회" | "스터디";
type SortType = "latest" | "deadline";
type StatusType = "모집중" | "마감";

const CATEGORIES: { key: Category | "전체"; label: string }[] = [
  { key: "전체", label: "전체" },
  { key: "동아리", label: "동아리" },
  { key: "학회", label: "학회" },
  { key: "스터디", label: "프로젝트" },
];

export default function Board() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  // URL 파라미터에서 초기 카테고리 추출
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialCategory = (urlParams.get("category") as Category) || "전체";

  const getCategoryFromUrl = () => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const cat = params.get("category") as Category;
    return (cat && ["동아리", "학회", "스터디"].includes(cat)) ? cat : "전체";
  };

  const [selectedCategory, setSelectedCategory] = useState<Category | "전체">(getCategoryFromUrl());
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<SortType>("latest");
  const [statusFilter, setStatusFilter] = useState<StatusType | "전체">("모집중");

  useEffect(() => {
    const handleLocationChange = () => {
      setSelectedCategory(getCategoryFromUrl());
    };

    window.addEventListener("locationchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);

    // Initial check
    handleLocationChange();

    return () => {
      window.removeEventListener("locationchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, [location]);

  const handleCategoryClick = (category: Category | "전체") => {
    if (category === "전체") {
      setLocation("/board");
    } else {
      setLocation(`/board?category=${encodeURIComponent(category)}`);
    }
  };

  const { data: posts, isLoading } = trpc.post.list.useQuery({
    category: selectedCategory === "전체" ? undefined : selectedCategory,
    search: keyword || undefined,
    status: statusFilter === "전체" ? undefined : statusFilter,
    sort,
    limit: 24,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput);
  };

  return (
    <Layout>
      <div className="container py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground">모집 게시판</h1>
            <p className="text-muted-foreground font-light mt-1">
              동아리, 학회, 프로젝트 모집 정보를 한눈에 확인하세요
            </p>
          </div>
          {isAuthenticated && (
            <Link href="/post/new">
              <Button className="gap-2 font-semibold">
                <PenSquare className="w-4 h-4" />
                모집 글 작성
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6 flex flex-col gap-4">
          {/* Category Tabs */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleCategoryClick(cat.key)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors ${
                  selectedCategory === cat.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="키워드, 제목으로 검색..."
                  className="pl-9 bg-background"
                />
              </div>
              <Button type="submit" variant="outline" size="icon">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            <div className="flex gap-2">
              {/* Status Filter */}
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {(["모집중", "전체", "마감"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      statusFilter === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setSort("latest")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    sort === "latest"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSort("deadline")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    sort === "deadline"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  마감임박
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-5 h-44 animate-pulse">
                <div className="h-4 bg-muted rounded w-16 mb-3" />
                <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              총 <span className="font-semibold text-foreground">{posts.length}</span>개의 모집 글
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((item) => (
                <PostCard
                  key={item.post.id}
                  id={item.post.id}
                  category={item.post.category}
                  title={item.post.title}
                  authorName={item.authorName}
                  authorAvatarUrl={item.authorAvatarUrl}
                  authorId={item.post.authorId}
                  capacity={item.post.capacity}
                  deadline={item.post.deadline}
                  keywords={item.post.keywords}
                  status={item.post.status}
                  createdAt={item.post.createdAt}
                  likeCount={(item as any).likeCount}
                  commentCount={(item as any).commentCount}
                  viewCount={item.post.viewCount}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <SlidersHorizontal className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-base">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 키워드나 카테고리로 검색해보세요</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
