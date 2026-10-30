import { Suspense, lazy, useEffect } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { ArrowLeft, CalendarDays, Megaphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/feedback";
import { SchedulePage } from "@/pages/schedule";
const AnnouncementsPage = lazy(() =>
  import("@/pages/announcements").then((module) => ({
    default: module.AnnouncementsPage,
  })),
);
const AnnouncementDetailPage = lazy(() =>
  import("@/pages/announcements").then((module) => ({
    default: module.AnnouncementDetailPage,
  })),
);
import { AccountPage } from "@/pages/account";
import { LoginPage, CallbackPage } from "@/pages/login";
import { HomePage } from "@/pages/home";
import { PrivacyAndTermsPage } from "@/pages/privacy-and-terms";
function Layout() {
  const location = useLocation();
  const announcement = /^\/app\/announcements\/.+/.test(location.pathname);
  const title = announcement
    ? "公告详情"
    : location.pathname.startsWith("/app/account")
      ? "我的"
      : location.pathname.startsWith("/app/announcements")
        ? "公告"
        : location.pathname.startsWith("/app/login")
          ? "登录"
          : "课表";
  useEffect(() => {
    document.title = `${title} | ClassHopper`;
    window.scrollTo(0, 0);
  }, [location.pathname, title]);
  return (
    <div className="app-shell">
      {announcement && (
        <div className="detail-navigation">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/announcements" aria-label="返回">
              <ArrowLeft size={20} />
            </Link>
          </Button>
        </div>
      )}
      <main id="main">
        <Suspense
          fallback={
            <p className="p-6 text-sm text-muted-foreground" role="status">
              加载中…
            </p>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {[
          { to: "/app/schedule", name: "课表", Icon: CalendarDays },
          { to: "/app/announcements", name: "公告", Icon: Megaphone },
          { to: "/app/account", name: "我的", Icon: UserRound },
        ].map(({ to, name, Icon }) => (
          <NavLink key={to} to={to}>
            <Icon size={21} strokeWidth={1.6} />
            <span>{name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/privacy-and-terms" element={<PrivacyAndTermsPage />} />
      <Route path="/oauth/callback" element={<CallbackPage />} />
      <Route path="/app" element={<Layout />}>
        <Route index element={<Navigate replace to="/app/schedule" />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="schedule/:date" element={<SchedulePage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <Message title="页面不存在">
              <Button asChild>
                <Link to="/app/schedule">返回课表</Link>
              </Button>
            </Message>
          }
        />
      </Route>
      <Route
        path="*"
        element={
          <Message title="页面不存在">
            <Button asChild>
              <Link to="/app">进入网页版</Link>
            </Button>
          </Message>
        }
      />
    </Routes>
  );
}
