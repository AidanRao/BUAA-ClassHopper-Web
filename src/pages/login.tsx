import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useSession } from "@/auth/context";
import { safeReturnTo } from "@/lib/dates";
import { Message } from "@/components/feedback";
import { Button } from "@/components/ui/button";
export function LoginPage() {
  const session = useSession(),
    [params] = useSearchParams(),
    navigate = useNavigate();
  const [error, setError] = useState<string | null>(null),
    started = useRef(false);
  const returnTo = safeReturnTo(params.get("returnTo"));
  const begin = useCallback(() => {
    setError(null);
    void session.manager.begin(returnTo).catch((error: unknown) => {
      setError(error instanceof Error ? error.message : "无法打开登录页面");
    });
  }, [session.manager, returnTo]);
  useEffect(() => {
    if (session.phase === "loading") return;
    if (session.phase === "ready") {
      navigate(returnTo, { replace: true });
      return;
    }
    if (started.current) return;
    started.current = true;
    begin();
  }, [session.phase, navigate, returnTo, begin]);
  return (
    <Message title={error ? "登录未完成" : "正在前往 统一身份认证…"}>
      {error && (
        <>
          <p className="w-full text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button onClick={begin} data-analytics-id="retry-login">重试</Button>
        </>
      )}
    </Message>
  );
}
export function CallbackPage() {
  const { manager } = useSession(),
    navigate = useNavigate();
  const [error, setError] = useState<string | null>(null),
    started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const search = location.search;
    history.replaceState(history.state, "", "/oauth/callback");
    void manager
      .complete(search)
      .then((path) => navigate(path, { replace: true }))
      .catch((error: unknown) =>
        setError(error instanceof Error ? error.message : "登录失败"),
      );
  }, [manager, navigate]);
  return (
    <Message
      title={error ? "登录未完成" : "正在完成登录…"}
      description={error ?? undefined}
    >
      {error && (
        <Button asChild>
          <Link to="/app/login">重新登录</Link>
        </Button>
      )}
    </Message>
  );
}
