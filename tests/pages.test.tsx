import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  classBeginTime: "2026-10-27 09:50:00",
  classEndTime: "2026-10-27 10:35:00",
};
let authorized: boolean, signed: boolean;
const posts: Record<string, unknown>[] = [];
beforeEach(() => {
  sessionStorage.clear();
  authorized = true;
  signed = false;
  posts.length = 0;
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
              { ...course, signStatus: signed ? 1 : 0 },
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
          </React.StrictMode>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
}
describe("mobile routes and course interactions", () => {
  it("uses the SSO avatar_url field and falls back when an image cannot load", () => {
    mount("/account", "ready", {
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
    mount("/account", "ready", { id: "user-2", avatar_url: null });
    expect(screen.queryByRole("img", { name: "用户头像" })).toBeNull();
    expect(document.querySelector(".profile-avatar svg")).toBeTruthy();
  });
  it("renders upstream rows independently with sign states instead of period numbers", async () => {
    mount("/schedule/2026-10-27");
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
    mount("/schedule/2026-10-27");
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 120));
  });
  it("opens a direct detail route and only retries sign-in after confirmation", async () => {
    mount("/schedule/2026-10-27/one");
    fireEvent.click(await screen.findByRole("button", { name: "立即签到" }));
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
    expect(
      screen.getByRole("link", { name: "返回" }).getAttribute("href"),
    ).toBe("/schedule/2026-10-27");
  });
  it("shows login and App authorization prompts without a loginName input", async () => {
    mount("/schedule/2026-10-27", "guest");
    expect(
      screen.getByRole("link", { name: "使用 SSO 登录" }).getAttribute("href"),
    ).toContain("returnTo=");
    cleanup();
    authorized = false;
    mount("/schedule/2026-10-27");
    expect(await screen.findByText("请在 App 内完成授权")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("handles invalid dates and missing courses on direct navigation", async () => {
    mount("/schedule/2026-02-30");
    expect(screen.getByText("日期无效")).toBeTruthy();
    cleanup();
    mount("/schedule/2026-10-27/missing");
    expect(await screen.findByText("课程不存在")).toBeTruthy();
  });
});
