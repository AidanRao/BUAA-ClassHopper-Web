import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../src/App";
import { SessionContext } from "../src/auth/context";
import type { BrowserSession, SessionState } from "../src/auth/session";
const course = {
  courseScheduleId: "one",
  courseId: "100",
  courseName: "矩阵理论与应用",
  courseType: "",
  weekDay: "2",
  courseNum: "MATH",
  teacherName: ["王福祥", "另一位教师"],
  classroomName: ["(三)311"],
  signStatus: 0,
  isReserved: false,
  classBeginTime: "2026-10-27 09:50:00",
  classEndTime: "2026-10-27 10:35:00",
};
let authorized: boolean, signed: boolean, reserved: boolean;
const beginLogin = vi.fn<BrowserSession["begin"]>();
const logout = vi.fn<BrowserSession["logout"]>();
const posts: Record<string, unknown>[] = [];
beforeEach(() => {
  sessionStorage.clear();
  authorized = true;
  signed = false;
  reserved = false;
  posts.length = 0;
  beginLogin.mockReset().mockResolvedValue(undefined);
  logout.mockReset();
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith("/authorization"))
        return Response.json({
          code: 1,
          data: { authorized, authorizedAt: "2026-10-27T00:00:00Z" },
        });
      if (path.includes("course-schedules"))
        return Response.json({
          code: 1,
          data: {
            date: "2026-10-27",
            serverTime: "2026-10-27T00:00:00Z",
            items: [
              { ...course, signStatus: signed ? 1 : 0, isReserved: reserved },
              { ...course, courseScheduleId: "two" },
            ],
          },
        });
      if (path.includes("sign-ins")) {
        const body = JSON.parse(String(init?.body));
        posts.push(body);
        if (!body.allowOutsideWindow)
          return Response.json(
            {
              code: 0,
              msg: "时段外",
              data: { reason: "SIGN_WINDOW_CONFIRMATION_REQUIRED" },
            },
            { status: 409 },
          );
        signed = true;
        return Response.json({ code: 1, data: { alreadySigned: false } });
      }
      return Response.json({ code: 0, msg: "不存在" }, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
async function openCourse() {
  const rows = await screen.findAllByRole("button", { name: /矩阵理论与应用/ });
  fireEvent.click(rows[0]);
  return screen.findByRole("dialog", { name: "矩阵理论与应用" });
}
function mount(
  path: string,
  phase: SessionState["phase"] = "ready",
  profile: SessionState["profile"] = { id: "user-1" },
) {
  const state: SessionState = {
    phase,
    profile: phase === "ready" ? profile : null,
    error: null,
  };
  const session = {
    subscribe: () => () => {},
    snapshot: () => state,
    token: async () => "user-token",
    clear: vi.fn(),
    logout,
    begin: beginLogin,
  } as unknown as BrowserSession;
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={query}>
      <SessionContext.Provider value={session}>
        <MemoryRouter initialEntries={[path]}>
          <React.StrictMode>
            <App />
            <LocationProbe />
          </React.StrictMode>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
}
describe("mobile routes and course interactions", () => {
  describe.each([
    [false, false, "未签到", "circle", "unsigned"],
    [false, true, "已预约", "calendar-check", "reserved"],
    [true, false, "已签到", "check", "signed"],
    [true, true, "已签到", "check", "signed"],
  ] as const)("signed=%s reserved=%s", (isSigned, isReserved, label, icon, state) => {
    it.each(["list", "detail"] as const)("renders the %s status and decorative icon", async (variant) => {
      signed = isSigned;
      reserved = isReserved;
      mount("/app/schedule/2026-10-27");
      if (variant === "detail") await openCourse();
      await screen.findAllByText("矩阵理论与应用");
      const status = document.querySelector(variant === "list" ? ".course-status" : ".detail-status");
      expect(status?.textContent).toBe(label);
      expect(status?.classList.contains(state)).toBe(true);
      const svg = status?.querySelector("svg");
      expect(svg?.classList.contains(`lucide-${icon}`)).toBe(true);
      expect(svg?.getAttribute("width")).toBe("16");
      expect(svg?.getAttribute("height")).toBe("16");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      if (variant === "detail" && !isSigned)
        await waitFor(() => expect(screen.getByRole("button", { name: "立即签到" }).hasAttribute("disabled")).toBe(false));
    });
  });

  it("refreshes a reserved course after manual sign-in and when returning to the schedule", async () => {
    reserved = true;
    mount("/app/schedule/2026-10-27");
    const status = await screen.findByText("已预约");
    fireEvent.click(status.closest("button")!);
    const sign = await screen.findByRole("button", { name: "立即签到" });
    await waitFor(() => expect(sign.hasAttribute("disabled")).toBe(false));
    fireEvent.click(sign);
    fireEvent.click(await screen.findByRole("button", { name: "仍要签到" }));
    await waitFor(() => expect(document.querySelector(".detail-status")?.textContent).toBe("已签到"));
    expect(screen.queryByText("已预约")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭课程详情" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findAllByText("矩阵理论与应用");
    expect(document.querySelector(".course-status")?.textContent).toBe("已签到");
    expect(screen.queryByText("已预约")).toBeNull();
    expect(posts.map((value) => value.allowOutsideWindow)).toEqual([false, true]);
  });

  it("opens details over the mounted schedule without resetting scroll and restores focus on close", async () => {
    sessionStorage.setItem("schedule-scroll:2026-10-27", "120");
    mount("/app/schedule/2026-10-27");
    const row = (await screen.findAllByRole("button", { name: /未签到 矩阵理论与应用/ }))[0];
    const list = document.querySelector(".course-list");
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 120));
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(row);
    const sheet = await screen.findByRole("dialog", { name: "矩阵理论与应用" });
    expect(screen.getByTestId("location").textContent).toBe("/app/schedule/2026-10-27");
    expect(within(sheet).getByText("课程编号")).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: "刷新状态" })).toBeNull();
    expect(document.querySelector(".course-list")).toBe(list);
    expect(list?.isConnected).toBe(true);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "关闭课程详情" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
    expect(screen.getByTestId("location").textContent).toBe("/app/schedule/2026-10-27");
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("closes a course sheet with Escape and stays on the same schedule URL", async () => {
    mount("/app/schedule/2026-10-27");
    await openCourse();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("region", { name: "当日课程" })).toBeTruthy();
    expect(document.querySelector(".detail-navigation")).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("/app/schedule/2026-10-27");
  });

  it("cancels the outside-window confirmation without closing the course sheet or retrying sign-in", async () => {
    mount("/app/schedule/2026-10-27");
    await openCourse();
    const sign = await screen.findByRole("button", { name: "立即签到" });
    await waitFor(() => expect(sign.hasAttribute("disabled")).toBe(false));
    fireEvent.click(sign);
    const confirm = await screen.findByRole("alertdialog");
    expect(posts).toHaveLength(1);
    fireEvent.click(within(confirm).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("dialog", { name: "矩阵理论与应用" })).toBeTruthy();
    expect(posts).toHaveLength(1);
  });

  it("refreshes the schedule when a pending sign-in finishes after the sheet closes", async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let finish: (() => void) | undefined;
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (!String(input).includes("sign-ins")) return original(input, init);
      return new Promise<Response>((resolve) => {
        finish = () => {
          signed = true;
          resolve(Response.json({ code: 1, data: { alreadySigned: false } }));
        };
      });
    });
    mount("/app/schedule/2026-10-27");
    await openCourse();
    const sign = await screen.findByRole("button", { name: "立即签到" });
    await waitFor(() => expect(sign.hasAttribute("disabled")).toBe(false));
    fireEvent.click(sign);
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "关闭课程详情" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    finish!();
    await waitFor(() => expect(document.querySelector(".course-status")?.textContent).toBe("已签到"));
  });

  it("uses SSO logout from the account page", () => {
    mount("/app/account");
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
  it("reserves the root for the public page without the application navigation", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "ClassHopper" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "进入网页版" }).getAttribute("href"))
      .toBe("/app");
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
  });
  it("opens the application at /app and keeps all navigation under that prefix", () => {
    mount("/app", "guest");
    expect(screen.getByRole("link", { name: "课表" }).getAttribute("href"))
      .toBe("/app/schedule");
    expect(screen.getByRole("link", { name: "公告" }).getAttribute("href"))
      .toBe("/app/announcements");
    expect(screen.getByRole("link", { name: "我的" }).getAttribute("href"))
      .toBe("/app/account");
    expect(screen.getByRole("link", { name: "去登录" }).getAttribute("href"))
      .toMatch(/^\/app\/login\?returnTo=%2Fapp%2Fschedule%2F/);
  });
  it("keeps announcement details and the back link under /app", async () => {
    const announcement = { id: "notice", title: "测试公告", content: "公告正文" };
    vi.mocked(fetch).mockImplementation(async (input) => Response.json({
      code: 1,
      data: String(input).includes("/announcement/notice")
        ? announcement
        : { items: [announcement], page: 1, pageSize: 10, total: 1 },
    }));
    mount("/app/announcements", "guest");
    const link = await screen.findByRole("link", { name: "测试公告" });
    expect(link.getAttribute("href")).toBe("/app/announcements/notice");
    fireEvent.click(link);
    expect(await screen.findByText("公告正文")).toBeTruthy();
    expect(screen.getByRole("link", { name: "返回" }).getAttribute("href"))
      .toBe("/app/announcements");
  });
  it("starts SSO once after clicking account login and preserves the return path", async () => {
    mount("/app/account", "guest");
    fireEvent.click(screen.getByRole("link", { name: "去登录" }));
    await waitFor(() =>
      expect(beginLogin).toHaveBeenCalledExactlyOnceWith("/app/account"),
    );
    expect(screen.getByText("正在前往 统一身份认证…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "去登录" })).toBeNull();
  });
  it("starts SSO automatically for direct login links under Strict Mode", async () => {
    mount("/app/login?returnTo=%2Fapp%2Fschedule%2F2026-10-27%2Fone", "guest");
    await waitFor(() =>
      expect(beginLogin).toHaveBeenCalledExactlyOnceWith(
        "/app/schedule/2026-10-27/one",
      ),
    );
  });
  it("waits for session restoration instead of starting a second login", () => {
    mount("/app/login?returnTo=%2Fapp%2Faccount", "loading");
    expect(beginLogin).not.toHaveBeenCalled();
    cleanup();
    mount("/app/login?returnTo=%2Fapp%2Faccount", "ready");
    expect(screen.getByText("退出登录")).toBeTruthy();
    expect(beginLogin).not.toHaveBeenCalled();
  });
  it("offers a retry only when automatic SSO navigation fails", async () => {
    beginLogin.mockRejectedValueOnce(new Error("无法打开登录页面"));
    mount("/app/login?returnTo=%2Fapp%2Faccount", "guest");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "无法打开登录页面",
    );
    expect(beginLogin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(beginLogin).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
  });
  it("uses the SSO avatar_url field and falls back when an image cannot load", () => {
    mount("/app/account", "ready", {
      id: "user-1",
      username: "同学",
      avatar_url: "https://images.example.com/avatar.jpg",
    });
    const avatar = screen.getByRole("img", { name: "用户头像" });
    expect(avatar.getAttribute("src")).toBe(
      "https://images.example.com/avatar.jpg",
    );
    fireEvent.error(avatar);
    expect(screen.queryByRole("img", { name: "用户头像" })).toBeNull();
    expect(document.querySelector(".profile-avatar svg")).toBeTruthy();
    cleanup();
    mount("/app/account", "ready", { id: "user-2", avatar_url: null });
    expect(screen.queryByRole("img", { name: "用户头像" })).toBeNull();
    expect(document.querySelector(".profile-avatar svg")).toBeTruthy();
  });
  it("renders upstream rows independently with sign states instead of period numbers", async () => {
    mount("/app/schedule/2026-10-27");
    await waitFor(() =>
      expect(screen.getAllByText("矩阵理论与应用")).toHaveLength(2),
    );
    expect(screen.getAllByText("未签到")).toHaveLength(2);
    expect(screen.getAllByText(/王福祥、另一位教师/)).toHaveLength(2);
    expect(
      screen
        .getByRole("button", { name: /2026-10-27 星期二/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "下一周" }));
    expect(
      screen
        .getByRole("button", { name: /2026-11-03 星期二/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("restores the saved schedule scroll position under Strict Mode", async () => {
    sessionStorage.setItem("schedule-scroll:2026-10-27", "120");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) =>
      window.clearTimeout(id),
    );
    mount("/app/schedule/2026-10-27");
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 120));
  });
  it("opens a course sheet without navigation and only retries sign-in after confirmation", async () => {
    mount("/app/schedule/2026-10-27");
    await openCourse();
    const sign = await screen.findByRole("button", { name: "立即签到" });
    await waitFor(() => expect(sign.hasAttribute("disabled")).toBe(false));
    fireEvent.click(sign);
    const confirm = await screen.findByRole("button", { name: "仍要签到" });
    expect(posts).toHaveLength(1);
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "已签到" }).hasAttribute("disabled"),
      ).toBe(true),
    );
    expect(posts.map((value) => value.allowOutsideWindow)).toEqual([
      false,
      true,
    ]);
    fireEvent.click(screen.getByRole("button", { name: "关闭课程详情" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("region", { name: "当日课程" })).toBeTruthy();
  });
  it("shows login and App authorization prompts without a loginName input", async () => {
    mount("/app/schedule/2026-10-27", "guest");
    expect(
      screen.getByRole("link", { name: "去登录" }).getAttribute("href"),
    ).toContain("returnTo=");
    cleanup();
    authorized = false;
    mount("/app/schedule/2026-10-27");
    expect(await screen.findByText("请在 App 内完成授权")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("handles invalid dates and no longer exposes a course detail route", async () => {
    mount("/app/schedule/2026-02-30");
    expect(screen.getByText("日期无效")).toBeTruthy();
    cleanup();
    mount("/app/schedule/2026-10-27/missing");
    expect(await screen.findByText("页面不存在")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
