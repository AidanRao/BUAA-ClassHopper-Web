import { Suspense, lazy, useEffect } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import { ArrowLeft, CalendarDays, Megaphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/feedback";
import { SchedulePage } from "@/pages/schedule";
import { CourseDetailPage } from "@/pages/course-detail";
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
function Layout() {
  const location = useLocation(),
    params = useParams();
  const detail = /^\/schedule\/[^/]+\/[^/]+$/.test(location.pathname),
    announcement = /^\/announcements\/.+/.test(location.pathname);
  const title = detail
    ? "课程详情"
    : announcement
      ? "公告详情"
      : location.pathname.startsWith("/account")
        ? "我的"
        : location.pathname.startsWith("/announcements")
          ? "公告"
          : location.pathname.startsWith("/login") ||
              location.pathname.startsWith("/oauth")
            ? "登录"
            : "课表";
  const back = detail ? `/schedule/${params.date}` : "/announcements";
  useEffect(() => {
    document.title = `${title} | ClassHopper`;
    window.scrollTo(0, 0);
  }, [location.pathname, title]);
  return (
    <div className="app-shell">
      <header className="page-header">
        {detail || announcement ? (
          <>
            <Button variant="ghost" size="icon" asChild>
              <Link to={back} aria-label="返回">
                <ArrowLeft size={20} />
              </Link>
            </Button>
            <span className="text-sm font-medium">{title}</span>
          </>
        ) : (
          <span className="text-lg font-semibold">{title}</span>
        )}
        <img
          className="brand"
          src="/icons/buaa-classhopper.jpeg"
          alt="ClassHopper"
          width={32}
          height={32}
        />
      </header>
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
          { to: "/schedule", name: "课表", Icon: CalendarDays },
          { to: "/announcements", name: "公告", Icon: Megaphone },
          { to: "/account", name: "我的", Icon: UserRound },
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
      <Route element={<Layout />}>
        <Route index element={<Navigate replace to="/schedule" />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="schedule/:date" element={<SchedulePage />} />
        <Route
          path="schedule/:date/:courseScheduleId"
          element={<CourseDetailPage />}
        />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="oauth/callback" element={<CallbackPage />} />
        <Route
          path="*"
          element={
            <Message title="页面不存在">
              <Button asChild>
                <Link to="/schedule">返回课表</Link>
              </Button>
            </Message>
          }
        />
      </Route>
    </Routes>
  );
}
