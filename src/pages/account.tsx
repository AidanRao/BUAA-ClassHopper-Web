import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "@/auth/context";
import { api } from "@/lib/api";
import { timeLabel, today } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Failure, LoadingRows } from "@/components/feedback";
import { useAuthorization } from "./schedule";
export function AccountPage() {
  const session = useSession(),
    authorization = useAuthorization(),
    client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const revoke = useMutation({
    mutationFn: () =>
      api("/v1/iclass/authorization", session.manager, { method: "DELETE" }),
    onSuccess: () => {
      setConfirm(false);
      client.removeQueries({ queryKey: ["private"] });
      void authorization.refetch();
    },
    retry: false,
  });
  if (session.phase === "loading") return <LoadingRows />;
  if (session.phase === "error")
    return (
      <Failure
        error={new Error(session.error ?? "登录恢复失败")}
        retry={() => {
          void session.manager.restore();
        }}
      />
    );
  return (
    <div className="account-page">
      <section className="profile">
        <div className="profile-avatar">
          <UserRound size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-lg font-semibold">
            {session.profile?.username || session.profile?.name || "尚未登录"}
          </h1>
          {session.profile?.email && (
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {session.profile.email}
            </p>
          )}
        </div>
      </section>
      {session.phase === "guest" ? (
        <Button className="w-full" asChild>
          <Link to="/login?returnTo=%2Faccount">使用 SSO 登录</Link>
        </Button>
      ) : (
        <>
          <section className="authorization-section">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={18} />
              iClass 授权
            </div>
            {authorization.isPending ? (
              <p className="mt-4 text-sm text-muted-foreground">正在查询…</p>
            ) : authorization.error ? (
              <p className="mt-4 text-sm text-destructive">
                {authorization.error.message}
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm">
                  {authorization.data?.authorized
                    ? "已授权"
                    : "请在 App 内完成授权"}
                </p>
                {authorization.data?.authorizedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    授权时间：{today(new Date(authorization.data.authorizedAt))}{" "}
                    {timeLabel(authorization.data.authorizedAt)}
                  </p>
                )}
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={authorization.isFetching || revoke.isPending}
                onClick={() => {
                  void authorization.refetch();
                }}
              >
                <RefreshCw size={16} />
                刷新状态
              </Button>
              {authorization.data?.authorized && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={revoke.isPending}
                  onClick={() => setConfirm(true)}
                >
                  撤销授权
                </Button>
              )}
            </div>
            {revoke.error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {revoke.error.message}
              </p>
            )}
          </section>
          <Button
            variant="ghost"
            className="mt-6 w-full"
            onClick={() => session.manager.clear()}
          >
            <LogOut size={16} />
            退出登录
          </Button>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="撤销 iClass 授权？"
        description="撤销后无法查询课表和签到，需要在 App 内重新授权。"
        action="撤销授权"
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </div>
  );
}
