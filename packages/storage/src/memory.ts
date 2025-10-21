import { Storage, InviteRecord, JoinEvent, UserSource } from "@tgjoin/core";

export class MemoryStorage implements Storage {
  invites = new Map<string, InviteRecord>();
  users = new Map<number, UserSource>();
  joins: JoinEvent[] = [];
  events: any[] = [];

  async init() {}
  async close() {}

  async saveInvite(rec: InviteRecord) {
    this.invites.set(rec.invite_link, rec);
  }
  async markInviteUsed(invite_link: string, tg_id: number) {
    const r = this.invites.get(invite_link);
    if (r) {
      r.used_by_tg_id = tg_id;
      r.used_at = Date.now();
    }
  }
  async recordJoin(ev: JoinEvent) {
    this.joins.push(ev);
    this.events.push({ type: "join", ...ev });
  }
  async upsertUserSource(src: UserSource) {
    const prev = this.users.get(src.tg_id) || {
      tg_id: src.tg_id,
      first_seen_at: Date.now()
    };
    this.users.set(src.tg_id, { ...prev, ...src, last_seen_at: Date.now() });
  }
  async getUserSource(tg_id: number) {
    return this.users.get(tg_id) ?? null;
  }
  async getInviteByLink(invite_link: string) {
    return this.invites.get(invite_link) ?? null;
  }
  async getLastJoinClickId(tg_id: number) {
    for (let i = this.joins.length - 1; i >= 0; i--)
      if (this.joins[i].tg_id === tg_id) return this.joins[i].clickid;
    return null;
  }
  async recentEvents(limit = 50) {
    return this.events.slice(-limit);
  }
}
