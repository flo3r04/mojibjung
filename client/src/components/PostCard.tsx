import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Eye } from "lucide-react";

interface PostCardProps {
  id: number;
  category: "동아리" | "학회" | "스터디";
  title: string;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  authorId?: number | null;
  capacity: number;
  deadline?: Date | string | null;
  keywords?: string | null;
  status: "모집중" | "마감";
  createdAt?: Date | string;
  score?: number;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  imageUrl?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  모집중: "bg-green-100 text-green-700",
  마감임박: "bg-amber-100 text-amber-700",
  마감: "bg-gray-100 text-gray-500",
};

const SIX_HOURS = 6 * 60 * 60 * 1000;

export default function PostCard({
  id,
  category,
  title,
  authorName,
  authorAvatarUrl,
  authorId,
  capacity,
  deadline,
  keywords,
  status,
  score,
  likeCount = 0,
  commentCount = 0,
  viewCount = 0,
  imageUrl,
}: PostCardProps) {
  let parsedKeywords: string[] = [];
  try { parsedKeywords = JSON.parse(keywords ?? "[]"); } catch { /* ignore */ }

  const now = new Date();
  const deadlineDate = deadline ? new Date(deadline) : null;
  const isExpired = deadlineDate ? deadlineDate < now : false;
  
  // displayStatus 는 UI 표시용이라 schema enum 보다 넓은 범위를 가질 수 있다
  let displayStatus: "모집중" | "마감" | "마감임박" = isExpired ? "마감" : status;

  // 마감 임박 체크 (6시간 이내)
  if (displayStatus === "모집중" && deadlineDate) {
    const diff = deadlineDate.getTime() - now.getTime();
    if (diff > 0 && diff <= SIX_HOURS) {
      displayStatus = "마감임박";
    }
  }

  return (
    <Link href={`/post/${id}`} className="block no-underline group">
      <div className="bg-card rounded-3xl border border-border/80 p-6 h-full flex flex-col gap-4 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
        
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border w-fit ${
              category === "동아리" ? "bg-sky-50 text-sky-600 border-sky-100" :
              category === "학회" ? "bg-violet-50 text-violet-600 border-violet-100" :
              "bg-rose-50 text-rose-600 border-rose-100"
            }`}>
              {category === "스터디" ? "프로젝트" : category}
            </span>
            {deadlineDate && (
              <span className="text-[10px] text-muted-foreground font-medium mt-1">
                {deadlineDate.getMonth() + 1}월 {deadlineDate.getDate()}일 {deadlineDate.getHours().toString().padStart(2, '0')}:{deadlineDate.getMinutes().toString().padStart(2, '0')} 마감
              </span>
            )}
          </div>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${STATUS_STYLES[displayStatus]}`}>
            {displayStatus}
          </span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-foreground text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {parsedKeywords.slice(0, 3).map((kw) => (
                <span key={kw} className="text-[10px] font-bold bg-secondary/50 text-secondary-foreground px-2 py-1 rounded-lg border border-border/50">
                  #{kw}
                </span>
              ))}
            </div>
          </div>
          {imageUrl && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-border shadow-sm">
              <img src={imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Bottom row */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <Link href={authorId ? `/user/${authorId}` : "#"}>
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                if (authorId) {
                  e.stopPropagation(); // Prevents navigating to the post detail
                } else {
                  e.preventDefault();
                }
              }}
            >
              <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                {authorAvatarUrl ? (
                  <img src={authorAvatarUrl} className="w-full h-full object-cover" alt={authorName ?? "U"} />
                ) : (
                  <span className="text-primary font-bold text-[10px]">
                    {authorName?.[0] ?? "U"}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-foreground opacity-80">
                {authorName ?? "익명"}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              {viewCount}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-pink-500">
              <Heart className={`w-3.5 h-3.5 ${likeCount > 0 ? "fill-current" : ""}`} />
              {likeCount}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              {commentCount}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
