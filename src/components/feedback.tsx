import { Link, useLocation } from "react-router";
import { CalendarDays, LockKeyhole, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { useSession } from "@/auth/context";
export function Message({
  title,
  description,
  children,
  icon,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="message" aria-live="polite">
      {icon && <div className="message-icon">{icon}</div>}
      <h2 className="text-lg font-medium">{title}</h2>
      {description && (
        <p className="mt-2 max-w-full break-words text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      {children && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}
    </section>
  );
}
export function LoadingRows() {
  return (
    <div className="py-2" role="status" aria-label="加载中">
      {[0, 1, 2].map((i) => (
        <div className="skeleton-row" key={i}>
          <div className="h-4 w-11 rounded bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Message
      title="暂时无法加载"
      description={error instanceof Error ? error.message : "请稍后重试"}
    >
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RefreshCw size={16} />
          重试
        </Button>
      )}
    </Message>
  );
}
export function LoginPrompt() {
  const location = useLocation();
  return (
    <Message title="登录后查看课表" icon={<CalendarDays size={24} />}>
      <Button asChild>
        <Link
          to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        >
          使用 SSO 登录
        </Link>
      </Button>
    </Message>
  );
}
export function AuthorizationPrompt({
  refresh,
  busy,
}: {
  refresh: () => void;
  busy?: boolean;
}) {
  return (
    <Message
      title="请在 App 内完成授权"
      description="授权后即可在这里查看课表和签到。"
      icon={<LockKeyhole size={24} />}
    >
      <Button variant="outline" onClick={refresh} disabled={busy}>
        <RefreshCw size={16} />
        刷新状态
      </Button>
    </Message>
  );
}
export function SessionGate({ children }: { children: ReactNode }) {
  const session = useSession();
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
  if (session.phase === "guest") return <LoginPrompt />;
  return children;
}
