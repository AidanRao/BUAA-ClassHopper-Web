import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/lib/api";
import type { BrowserSession } from "../src/auth/session";
afterEach(() => vi.unstubAllGlobals());
describe("browser business transport", () => {
  it("sends no credentials for public data", async () => {
    const send = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ code: 1, data: [] }),
    );
    vi.stubGlobal("fetch", send);
    await api("/announcement");
    expect(
      new Headers(send.mock.calls[0]?.[1]?.headers).has("Authorization"),
    ).toBe(false);
  });
  it("classifies a malformed response as an API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(null)),
    );
    await expect(api("/announcement")).rejects.toThrow("服务返回无效数据");
  });
  it("never replays sign-ins and preserves machine-readable confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            code: 0,
            msg: "时段外",
            data: { reason: "SIGN_WINDOW_CONFIRMATION_REQUIRED" },
          },
          { status: 409 },
        ),
      ),
    );
    const manager = {
      token: vi.fn(async () => "token"),
      clear: vi.fn(),
    } as unknown as BrowserSession;
    await expect(
      api("/v1/iclass/sign-ins", manager, { method: "POST", body: "{}" }),
    ).rejects.toMatchObject({
      reason: "SIGN_WINDOW_CONFIRMATION_REQUIRED",
    } satisfies Partial<ApiError>);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
