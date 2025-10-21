import { Elysia } from "elysia";
import crypto from "crypto";
import { Storage } from "@tgjoin/core";

export function mountRedirect(
  app: Elysia,
  deps: { tgA: (m: string, b: any) => Promise<any>; cfg: any; store: Storage }
) {
  const { tgA, cfg, store } = deps;

  app.get(cfg.redirect.path, async ({ query, set }) => {
    const q = query as Record<string, any>;

    const rawClick = q.clickid ?? q.clickId ?? null;
    const clickid = rawClick ? String(rawClick) : crypto.randomUUID();

    const name = q.name ? String(q.name) : undefined;

    const reserved = new Set(["clickid", "clickId", "name"]);
    const meta: Record<string, string> = {};
    for (const [k, v] of Object.entries(q)) {
      if (!reserved.has(k)) meta[k] = String(v);
    }

    const expire =
      Math.floor(Date.now() / 1000) + (cfg.join.expire_seconds || 86400);
    const args: any = {
      chat_id: cfg.group_id,
      expire_date: expire
    };
    if (name) args.name = name;
    if (cfg.join.mode === "limit1")
      args.member_limit = cfg.join.member_limit ?? 1;
    else args.creates_join_request = true;

    const res = await tgA("createChatInviteLink", args);
    const invite = res.invite_link as string;

    await store.saveInvite({
      invite_link: invite,
      clickid,
      name,
      mode: cfg.join.mode,
      meta,
      expires_at: expire,
      member_limit: args.member_limit ?? null,
      created_at: Date.now()
    });

    set.status = 302;
    set.headers["Location"] = invite;
    return "";
  });
}
