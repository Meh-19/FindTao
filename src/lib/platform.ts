export type StorePlatform = "yupoo" | "taobao" | "weidian" | "other";

export interface StorePlatformInfo {
  platform: StorePlatform;
  label: string;
  /** Yupoo subdomain (e.g. "unionkingdom") when platform is yupoo. */
  yupooHost?: string;
  /** Weidian shop id when the URL carries ?userid= (enables the live preview). */
  weidianUserId?: string;
}

/**
 * Classify a store URL so the UI can offer the right experience:
 * Yupoo stores get the live album browser, Taobao/Weidian stores get a
 * direct "visit store" hand-off.
 */
export function detectStorePlatform(rawUrl: string): StorePlatformInfo {
  const input = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { platform: "other", label: "Web" };
  }
  const host = url.hostname.toLowerCase();

  const yupoo = host.match(/^([a-z0-9][a-z0-9-]*)\.x\.yupoo\.com$/);
  if (yupoo) return { platform: "yupoo", label: "Yupoo", yupooHost: yupoo[1] };

  if (host.endsWith("taobao.com") || host.endsWith("tmall.com")) {
    return { platform: "taobao", label: host.endsWith("tmall.com") ? "Tmall" : "Taobao" };
  }

  if (host.endsWith("weidian.com")) {
    const userId =
      url.searchParams.get("userid") ??
      url.searchParams.get("userId") ??
      host.match(/^shop(\d+)\.v\.weidian\.com$/)?.[1] ??
      undefined;
    return {
      platform: "weidian",
      label: "Weidian",
      weidianUserId: userId && /^\d+$/.test(userId) ? userId : undefined,
    };
  }

  return { platform: "other", label: "Web" };
}
