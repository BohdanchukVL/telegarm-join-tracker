export type JoinMode = "limit1" | "join_request";

export interface InviteRecord {
  invite_link: string;
  clickid: string;
  name?: string;
  mode: JoinMode;
  meta?: Record<string, string>;
  expires_at?: number;
  member_limit?: number | null;
  used_by_tg_id?: number | null;
  used_at?: number | null;
  created_at?: number;
}

export interface JoinEvent {
  tg_id: number;
  invite_link: string;
  clickid: string;
  at: number;
  meta?: Record<string, string>;
}

export interface UserSource {
  tg_id: number;
  source_clickid?: string | null;
  source_invite?: string | null;
  first_seen_at?: number;
  last_seen_at?: number;
}

export interface Storage {
  saveInvite(rec: InviteRecord): Promise<void>;
  getInviteByLink(invite_link: string): Promise<InviteRecord | null>;
  markInviteUsed(invite_link: string, tg_id: number): Promise<void>;
  recordJoin(ev: JoinEvent): Promise<void>;
  upsertUserSource(src: UserSource): Promise<void>;
  getUserSource(tg_id: number): Promise<UserSource | null>;
  getLastJoinClickId(tg_id: number): Promise<string | null>;
  recentEvents(limit?: number): Promise<any[]>;
  init?(): Promise<void>;
  close?(): Promise<void>;
}

export interface PostbackProvider {
  sendJoin(clickid: string, extras?: Record<string, any>): Promise<void>;
  sendBotStart(clickid: string, extras?: Record<string, any>): Promise<void>;
}
