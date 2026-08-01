import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUpstream } from "./fetchUpstream";

const resp = (status: number) => new Response(status === 204 ? null : "body", { status });

afterEach(() => vi.restoreAllMocks());

describe("fetchUpstream", () => {
  it("returns a 2xx response without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchUpstream("https://x.test");
    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries once on a transient 5xx, then succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resp(503)).mockResolvedValueOnce(resp(200));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchUpstream("https://x.test");
    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 429 — returns it immediately for the caller to propagate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(429));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchUpstream("https://x.test");
    expect(res?.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns null after exhausting retries on network errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchUpstream("https://x.test", {}, { retries: 1 });
    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("honours retries: 0 (single attempt)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(500));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchUpstream("https://x.test", {}, { retries: 0 });
    expect(res?.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
