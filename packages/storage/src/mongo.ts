import { MongoClient, Db, Collection } from "mongodb";
import { Storage, InviteRecord, JoinEvent, UserSource } from "@tgjoin/core";

export class MongoStorage implements Storage {
  private client: MongoClient;
  private db!: Db;
  private colInv!: Collection<InviteRecord>;
  private colUsers!: Collection<UserSource>;
  private colJoins!: Collection<JoinEvent>;
  private colEvents!: Collection<any>;

  constructor(private uri: string, private dbName = "tg_join_attr") {
    this.client = new MongoClient(uri);
  }

  async init() {
    this.db = this.client.db(this.dbName);
    this.colInv = this.db.collection<InviteRecord>("invites");
    this.colUsers = this.db.collection<UserSource>("users");
    this.colJoins = this.db.collection<JoinEvent>("joins");
    this.colEvents = this.db.collection<any>("events");

    await this.colInv.createIndex({ invite_link: 1 }, { unique: true });
    await this.colUsers.createIndex({ tg_id: 1 }, { unique: true });
    await this.colJoins.createIndex({ tg_id: 1, at: -1 });
    await this.colEvents.createIndex({ at: -1 });
  }

  async close() {
    await this.client.close();
  }

  // Invites
  async saveInvite(rec: InviteRecord) {
    await this.colInv.updateOne(
      { invite_link: rec.invite_link },
      { $set: rec },
      { upsert: true }
    );
  }
  async getInviteByLink(invite_link: string) {
    return await this.colInv.findOne({ invite_link });
  }
  async markInviteUsed(invite_link: string, tg_id: number) {
    await this.colInv.updateOne(
      { invite_link },
      { $set: { used_by_tg_id: tg_id, used_at: Date.now() } }
    );
  }

  // Attribution
  async recordJoin(ev: JoinEvent) {
    await this.colJoins.insertOne(ev);
    await this.colEvents.insertOne({ type: "join", ...ev });
  }
  async upsertUserSource(src: UserSource) {
    const now = Date.now();
    await this.colUsers.updateOne(
      { tg_id: src.tg_id },
      {
        $setOnInsert: { first_seen_at: now },
        $set: {
          source_clickid: src.source_clickid ?? null,
          source_invite: src.source_invite ?? null,
          last_seen_at: now
        }
      },
      { upsert: true }
    );
  }
  async getUserSource(tg_id: number) {
    return await this.colUsers.findOne({ tg_id });
  }
  async getLastJoinClickId(tg_id: number) {
    const last = await this.colJoins
      .find({ tg_id })
      .sort({ at: -1 })
      .limit(1)
      .toArray();
    return last[0]?.clickid ?? null;
  }

  // Debug
  async recentEvents(limit = 50) {
    return await this.colEvents
      .find({})
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
  }
}
