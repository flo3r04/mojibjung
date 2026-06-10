import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import MessageModal from "@/components/MessageModal";
import { Button } from "@/components/ui/button";
import { useLocation, Link, useParams } from "wouter";
import {
  User,
  MapPin,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Heart,
  Eye,
  MessageSquare,
  ChevronLeft,
  UserX,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const CATEGORY_STYLES: Record<string, string> = {
  동아리: "bg-blue-100 text-blue-700",
  학회: "bg-teal-100 text-teal-700",
  스터디: "bg-pink-100 text-pink-700",
};

export default function UserProfile() {
  const params = useParams();
  const userId = parseInt(params.id || "0");
  const [_, setLocation] = useLocation();

  const { data: profileData, isLoading: profileLoading } = trpc.profile.getByUserId.useQuery(
    { userId },
    { enabled: !!userId }
  );

  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [messageModalOpen, setMessageModalOpen] = useState(false);

  const { data: isBlocked } = trpc.block.check.useQuery(
    { blockedId: userId },
    { enabled: !!userId && isAuthenticated && user?.id !== userId }
  );

  const blockMutation = trpc.block.block.useMutation({
    onSuccess: () => {
      toast.success("해당 사용자를 차단했습니다.");
      utils.block.check.invalidate({ blockedId: userId });
      utils.post.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const unblockMutation = trpc.block.unblock.useMutation({
    onSuccess: () => {
      toast.success("해당 사용자의 차단이 해제되었습니다.");
      utils.block.check.invalidate({ blockedId: userId });
      utils.post.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleBlockToggle = () => {
    if (isBlocked) {
      unblockMutation.mutate({ blockedId: userId });
    } else {
      if (confirm("이 사용자를 차단하시겠습니까? 차단 시 목록에서 서로의 글이 보이지 않습니다.")) {
        blockMutation.mutate({ blockedId: userId });
      }
    }
  };

  const { data: userPosts, isLoading: postsLoading } = trpc.post.getByAuthorId.useQuery(
    { authorId: userId },
    { enabled: !!userId }
  );

  if (profileLoading) {
    return (
      <Layout>
        <div className="container py-12 animate-pulse">
          <div className="flex flex-col items-center mb-12">
            <div className="w-24 h-24 rounded-full bg-muted mb-4" />
            <div className="h-8 bg-muted rounded w-32 mb-2" />
            <div className="h-4 bg-muted rounded w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-4">
              <div className="h-40 bg-muted rounded-2xl" />
            </div>
            <div className="md:col-span-2 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profileData) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">사용자를 찾을 수 없습니다.</p>
          <Button variant="link" onClick={() => setLocation("/board")}>
            게시판으로 돌아가기
          </Button>
        </div>
      </Layout>
    );
  }

  const { profile, name, avatarUrl } = profileData;
  const keywords = JSON.parse(profile?.keywords || "[]");

  return (
    <Layout>
      <div className="container py-8">
        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors mb-6 font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          뒤로가기
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm sticky top-24">
              {/* Profile Header Background */}
              <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5" />
              
              <div className="px-6 pb-8 -mt-12">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full border-4 border-card bg-muted overflow-hidden shadow-md mb-4">
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" alt={name || "사용자"} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <h1 className="text-2xl font-black text-foreground mb-1">{name}</h1>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-6">
                    <MapPin className="w-3.5 h-3.5" />
                    {profile?.department || "학과 미설정"}
                    <span className="mx-1 opacity-20">|</span>
                    <GraduationCap className="w-3.5 h-3.5" />
                    {profile?.grade ? (profile.grade === "대학원" ? "대학원" : `${profile.grade}학년`) : "학년 미설정"}
                  </div>

                  <div className="w-full space-y-6">
                    {/* Bio */}
                    <div>
                      <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-2 px-1">자기소개</h2>
                      <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                        <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                          {profile?.bio || "자기소개가 아직 없습니다."}
                        </p>
                      </div>
                    </div>

                    {/* Keywords */}
                    {keywords.length > 0 && (
                      <div>
                        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3 px-1">관심 키워드</h2>
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((kw: string) => (
                            <span
                              key={kw}
                              className="flex items-center gap-1 bg-primary/10 text-primary text-[11px] px-3 py-1 rounded-full font-bold"
                            >
                              <Sparkles className="w-3 h-3" />
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action */}
                    <div className="pt-4 space-y-2">
                      <Button 
                        className="w-full gap-2 font-bold rounded-2xl h-12 shadow-lg shadow-primary/10"
                        onClick={() => setMessageModalOpen(true)}
                        disabled={!isAuthenticated || user?.id === userId || isBlocked}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {isBlocked ? "차단된 사용자" : "메시지 보내기"}
                      </Button>
                      
                      {isAuthenticated && user?.id !== userId && (
                        <Button
                          variant={isBlocked ? "outline" : "destructive"}
                          className="w-full gap-2 font-bold rounded-2xl h-12 shadow-sm"
                          onClick={handleBlockToggle}
                          disabled={blockMutation.isPending || unblockMutation.isPending}
                        >
                          {isBlocked ? (
                            <>
                              <UserCheck className="w-4 h-4" />
                              차단 해제
                            </>
                          ) : (
                            <>
                              <UserX className="w-4 h-4" />
                              사용자 차단
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: User's Posts */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-black text-foreground">작성한 모집 글</h2>
              <span className="text-xs font-bold bg-muted text-muted-foreground px-3 py-1 rounded-full">
                총 {userPosts?.length || 0}개
              </span>
            </div>

            <div className="space-y-4">
              {postsLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
                ))
              ) : userPosts && userPosts.length > 0 ? (
                userPosts.map((data: any) => {
                  const post = data.post;
                  const displayStatus = post.status;
                  
                  return (
                    <Link key={post.id} href={`/post/${post.id}`} className="block no-underline group">
                      <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all">
                        <div className="flex gap-4">
                          {post.imageUrl && (
                            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-border">
                              <img src={post.imageUrl} className="w-full h-full object-cover" alt={post.title} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CATEGORY_STYLES[post.category] || "bg-gray-100 text-gray-600"}`}>
                                {post.category}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${displayStatus === "모집중" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                                {displayStatus}
                              </span>
                            </div>
                            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2">
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-semibold">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {post.viewCount || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                                {data.likeCount || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {data.commentCount || 0}
                              </span>
                              <span className="mx-1 opacity-20">|</span>
                              <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")} 작성</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors self-center">
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
                  <p className="font-bold text-muted-foreground">작성한 모집 글이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {messageModalOpen && (
        <MessageModal
          open={messageModalOpen}
          onOpenChange={setMessageModalOpen}
          receiverId={userId}
          receiverName={name || "사용자"}
        />
      )}
    </Layout>
  );
}
