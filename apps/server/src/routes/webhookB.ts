import { Elysia } from "elysia";
import { Storage } from "@tgjoin/core";
import { PostbackProvider } from "@tgjoin/core";

export function mountWebhookB(
  app: Elysia,
  deps: {
    store: Storage;
    cfg: any;
    pb: PostbackProvider;
  }
) {
  const { store, cfg, pb } = deps;
  if (cfg.mode !== "dual-bot") return;

  app.post(cfg.bots.b.webhook_path, async ({ request, body, set }) => {
    if (cfg.security.require_secret_header) {
      const sig = request.headers.get("x-telegram-bot-api-secret-token");
      if (sig !== cfg.bots.b.secret) {
        set.status = 401;
        return { error: "bad secret" };
      }
    }
    const u: any = body;
    if (u.message?.text?.startsWith("/start")) {
      const tgId = u.message.from.id;
      const payload = u.message.text.split(" ")[1];
      let clickid: string | null = null;
      if (payload) {
        try {
          clickid = Buffer.from(payload, "base64url").toString("utf8");
        } catch {}
      }
      if (!clickid) {
        const src = await store.getUserSource(tgId);
        clickid = src?.source_clickid ?? (await store.getLastJoinClickId(tgId));
      }
      if (clickid) await pb.sendBotStart(clickid, { tg_id: tgId });
      return { ok: true };
    }

    return { ok: true };
  });
}
