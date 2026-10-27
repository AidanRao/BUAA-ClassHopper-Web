import { useEffect, useRef, useState } from "react";
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
    [pending, setPending] = useState(false);
  const returnTo = safeReturnTo(params.get("returnTo"));
  useEffect(() => {
    if (session.phase === "ready") navigate(returnTo, { replace: true });
  }, [session.phase, navigate, returnTo]);
  return (
    <Message title="登录 ClassHopper" description="使用你的 SSO 账号继续。">
      {error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          setPending(true);
          void session.manager.begin(returnTo).catch((error: unknown) => {
            setError(
              error instanceof Error ? error.message : "无法打开登录页面",
            );
            setPending(false);
          });
        }}
      >
        {pending ? "正在前往 SSO…" : "使用 SSO 登录"}
      </Button>
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
          <Link to="/login">重新登录</Link>
        </Button>
      )}
    </Message>
  );
}
