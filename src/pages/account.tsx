import { useState } from "react";
import { Link } from "react-router";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "@/auth/context";
import { Button } from "@/components/ui/button";
import { Failure, LoadingRows } from "@/components/feedback";
import { useAuthorization } from "./schedule";
function ProfileAvatar({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="profile-avatar">
      {src && !failed ? (
        <img
          src={src}
          alt="用户头像"
          width={48}
          height={48}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound size={24} aria-hidden="true" />
      )}
    </div>
  );
}
export function AccountPage() {
  const session = useSession(),
    authorization = useAuthorization();
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
        <ProfileAvatar
          key={`${session.profile?.id ?? "guest"}:${session.profile?.avatar_url ?? ""}`}
          src={session.profile?.avatar_url}
        />
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
            {authorization.isPending ? (
              <p className="text-sm text-muted-foreground">正在查询 iClass 授权…</p>
            ) : authorization.error ? (
              <p className="text-sm text-destructive">
                {authorization.error.message}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck size={18} aria-hidden="true" />
                {authorization.data?.authorized
                  ? "iClass 已授权"
                  : "请在 App 内完成 iClass 授权"}
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
    </div>
  );
}
