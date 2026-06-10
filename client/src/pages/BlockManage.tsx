import { Link } from "wouter";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";

export default function BlockManage() {
  const utils = trpc.useUtils();

  const { data: blockedUsers, isLoading } = trpc.block.list.useQuery();

  const unblockMutation = trpc.block.unblock.useMutation({
    onSuccess: () => {
      toast.success("해당 사용자의 차단이 해제되었습니다.");
      utils.block.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/mypage">
              <Button variant="ghost" size="icon" className="md:hidden">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">차단 관리</h1>
              <p className="text-sm text-muted-foreground mt-1">
                내가 차단한 사용자 목록입니다.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center space-x-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </CardContent>
              </Card>
            ))
          ) : blockedUsers?.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
                <UserCircle2 className="w-12 h-12 mb-4 text-muted-foreground/50" />
                <p>차단한 사용자가 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            blockedUsers?.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <Link href={`/user/${user.id}`} className="flex items-center space-x-4 group cursor-pointer">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {user.name?.slice(0, 2) || "알수없음"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium group-hover:underline">
                        {user.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.email ? user.email.split("@")[0] + "@..." : ""}
                      </p>
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => unblockMutation.mutate({ blockedId: user.id })}
                    disabled={unblockMutation.isPending}
                  >
                    차단 해제
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
