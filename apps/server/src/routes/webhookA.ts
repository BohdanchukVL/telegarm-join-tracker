import { Elysia } from "elysia";
import { Storage } from "@tgjoin/core";
import { PostbackProvider } from "@tgjoin/core";

export function mountWebhookA(
  app: Elysia,
  deps: {
    tgA: (m: string, b: any) => Promise<any>;
    store: Storage;
    cfg: any;
    pb: PostbackProvider;
  }
) {
  const { tgA, store, cfg, pb } = deps;
  app.post(cfg.bots.a.webhook_path, async ({ request, body, set }) => {
    if (cfg.security.require_secret_header) {
      const sig = request.headers.get("x-telegram-bot-api-secret-token");
      if (sig !== cfg.bots.a.secret) {
        set.status = 401;
        return { error: "bad secret" };
      }
    }
    const u: any = body;

    if (u.chat_join_request) {
      const tgId = u.chat_join_request.from.id;
      const inv = u.chat_join_request.invite_link?.invite_link;
      if (inv) {
        const invRec = await store.getInviteByLink(inv);
        const clickid = invRec?.clickid;
        await tgA("approveChatJoinRequest", {
          chat_id: u.chat_join_request.chat.id,
          user_id: tgId
        }).catch(() => {});
        if (clickid) {
          await store.recordJoin({
            tg_id: tgId,
            invite_link: inv,
            clickid,
            at: Date.now()
          });
          await store.upsertUserSource({
            tg_id: tgId,
            source_clickid: clickid,
            source_invite: inv
          });
          console.log("sendJoin", clickid, { tg_id: tgId });
          await pb.sendJoin(clickid, { tg_id: tgId });
          if (cfg.mode === "dual-bot" && cfg.bots?.b?.username) {
            const token = Buffer.from(clickid).toString("base64url");
            const link = `https://t.me/${cfg.bots.b.username}?start=${token}`;
            await tgA("sendMessage", {
              chat_id: cfg.group_id,
              text: `🎯 <a href="tg://user?id=${tgId}">Вітаємо!</a> Натисни 👉 <a href="${link}">Start</a>`,
              parse_mode: "HTML",
              disable_web_page_preview: true
            }).catch(() => {});
          }
        }
      }
      return { ok: true };
    }

    if (u.chat_member) {
      const cm = u.chat_member;
      const tgId = cm.new_chat_member?.user?.id;
      const inv = cm.invite_link?.invite_link;
      const became = ["member", "administrator"].includes(
        cm.new_chat_member?.status
      );
      if (tgId && inv && became) {
        const invRec = await store.getInviteByLink(inv);
        const clickid = invRec?.clickid;
        if (clickid) {
          await store.markInviteUsed(inv, tgId);
          await store.recordJoin({
            tg_id: tgId,
            invite_link: inv,
            clickid,
            at: Date.now()
          });
          await store.upsertUserSource({
            tg_id: tgId,
            source_clickid: clickid,
            source_invite: inv
          });
          console.log("sendJoin", clickid, { tg_id: tgId });
          await pb.sendJoin(clickid, { tg_id: tgId });
          if (cfg.mode === "dual-bot" && cfg.bots?.b?.username) {
            const token = Buffer.from(clickid).toString("base64url");
            const link = `https://t.me/${cfg.bots.b.username}?start=${token}`;
            await tgA("sendMessage", {
              chat_id: cfg.group_id,
              text: `👋 <a href="tg://user?id=${tgId}">Привіт!</a> Тицяй 👉 <a href="${link}">Start</a>`,
              parse_mode: "HTML",
              disable_web_page_preview: true
            }).catch(() => {});
          }
        }
      }
      return { ok: true };
    }
    return { ok: true };
  });
}
