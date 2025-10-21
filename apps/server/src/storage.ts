import { MemoryStorage } from "@tgjoin/storage/src/memory";
import { MongoStorage } from "@tgjoin/storage/src/mongo";
import { RedisStorage } from "@tgjoin/storage/src/redis";
import type { Storage } from "@tgjoin/core";

export async function createStorage(conf: any): Promise<Storage> {
  const driver = (
    Bun.env.STORAGE_DRIVER ??
    conf.storage?.driver ??
    "memory"
  ).toLowerCase();
  const dsn = Bun.env.STORAGE_DSN ?? conf.storage?.dsn ?? "";

  let store: Storage;
  if (driver === "mongo") {
    if (!dsn) throw new Error("storage.dsn (Mongo URI) is required");
    const s = new MongoStorage(dsn);
    await s.init();
    store = s;
  } else if (driver === "redis") {
    if (!dsn) throw new Error("storage.dsn (Redis URL) is required");
    const s = new RedisStorage(dsn);
    await s.init?.();
    store = s;
  } else {
    const s = new MemoryStorage();
    await s.init?.();
    store = s;
  }
  return store;
}
