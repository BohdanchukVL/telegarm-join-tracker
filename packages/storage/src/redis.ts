import Redis from "ioredis";
import { Storage, InviteRecord, JoinEvent, UserSource } from "@tgjoin/core";

export class RedisStorage implements Storage {
  private r: Redis;

  constructor(url: string) {
    this.r = new Redis(url);
  }
  async init() {}
  async close() {
    await this.r.quit();
  }

  private kInvite(link: string) {
    return `invite|${link}`;
  }
  private kUser(tg: number) {
    return `user|${tg}`;
  }
  private kJoins(tg: number) {
    return `joins|${tg}`;
  }
  private kEvents() {
    return `events`;
  }

  // Invites
  async saveInvite(rec: InviteRecord) {
    const key = this.kInvite(rec.invite_link);
    const ttl = rec.expires_at
      ? Math.max(rec.expires_at - Math.floor(Date.now() / 1000), 0)
      : 0;
    const payload = JSON.stringify(rec);
    if (ttl > 0) await this.r.set(key, payload, "EX", ttl);
    else await this.r.set(key, payload);
  }
  async getInviteByLink(invite_link: string) {
    const raw = await this.r.get(this.kInvite(invite_link));
    return raw ? (JSON.parse(raw) as InviteRecord) : null;
  }
  async markInviteUsed(invite_link: string, tg_id: number) {
    const key = this.kInvite(invite_link);
    const raw = await this.r.get(key);
    if (!raw) return;
    const rec = JSON.parse(raw) as InviteRecord;
    rec.used_by_tg_id = tg_id;
    rec.used_at = Date.now();
    const ttl = rec.expires_at
      ? Math.max(rec.expires_at - Math.floor(Date.now() / 1000), 0)
      : 0;
    const payload = JSON.stringify(rec);
    if (ttl > 0) await this.r.set(key, payload, "EX", ttl);
    else await this.r.set(key, payload);
  }

  // Attribution
  async recordJoin(ev: JoinEvent) {
    await this.r.lpush(this.kEvents(), JSON.stringify({ type: "join", ...ev }));
    await this.r.ltrim(this.kEvents(), 0, 999);

    await this.r.lpush(this.kJoins(ev.tg_id), JSON.stringify(ev));
    await this.r.ltrim(this.kJoins(ev.tg_id), 0, 99);
  }
  async upsertUserSource(src: UserSource) {
    const key = this.kUser(src.tg_id);
    const now = Date.now();
    const raw = await this.r.get(key);
    const prev: UserSource = raw
      ? JSON.parse(raw)
      : { tg_id: src.tg_id, first_seen_at: now };
    const next: UserSource = {
      ...prev,
      ...src,
      last_seen_at: now,
      first_seen_at: prev.first_seen_at ?? now
    };
    await this.r.set(key, JSON.stringify(next));
  }
  async getUserSource(tg_id: number) {
    const raw = await this.r.get(this.kUser(tg_id));
    return raw ? (JSON.parse(raw) as UserSource) : null;
  }
  async getLastJoinClickId(tg_id: number) {
    const raw = await this.r.lindex(this.kJoins(tg_id), 0);
    if (!raw) return null;
    const ev = JSON.parse(raw) as JoinEvent;
    return ev.clickid ?? null;
  }

  // Debug
  async recentEvents(limit = 50) {
    const arr = await this.r.lrange(this.kEvents(), 0, limit - 1);
    return arr.map((x) => JSON.parse(x));
  }
}
