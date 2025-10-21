type Method = "GET" | "POST";
type Mode = "query" | "json";

export function makeHttpProvider(cfg: any) {
  const url = cfg?.postback?.http?.url || Bun.env.POSTBACK_URL;
  if (!url) {
    return {
      sendJoin: async () => {},
      sendBotStart: async () => {}
    };
  }
  const method: Method = (
    (cfg?.postback?.http?.method || Bun.env.POSTBACK_METHOD || "GET") as Method
  ).toUpperCase() as Method;
  const mode: Mode = (cfg?.postback?.http?.mode ||
    Bun.env.POSTBACK_MODE ||
    (method === "GET" ? "query" : "json")) as Mode;

  const headers = (() => {
    const raw = cfg?.postback?.http?.headers || Bun.env.POSTBACK_HEADERS;
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  })();

  const fire = async (
    event: "join_group" | "bot_start",
    clickid: string,
    extras?: Record<string, any>
  ) => {
    const payload = { event, clickid, ...extras };
    if (method === "GET" || mode === "query") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(payload)) {
        if (v == null) continue;
        qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
      await fetch(`${url}?${qs.toString()}`).catch(() => {});
    } else {
      await fetch(url, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  };

  return {
    sendJoin: (clickid: string, extras?: Record<string, any>) =>
      fire("join_group", clickid, extras),
    sendBotStart: (clickid: string, extras?: Record<string, any>) =>
      fire("bot_start", clickid, extras)
  };
}
