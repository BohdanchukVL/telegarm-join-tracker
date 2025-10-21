import * as YAML from "yaml";
import { z } from "zod";
import { Elysia } from "elysia";
import { makeTG } from "./telegram";
import { mountRedirect } from "./routes/redirect";
import { mountWebhookA } from "./routes/webhookA";
import { mountWebhookB } from "./routes/webhookB";
import { createStorage } from "./storage";
import { makeHttpProvider } from "./postback/http";

function getConfigPath() {
  if (Bun.env.CONFIG) return Bun.env.CONFIG;
  return `${import.meta.dir}/config.yaml`;
}

function expandEnv(val: any): any {
  if (typeof val === "string") {
    return val.replace(/\$\{(\w+)\}/g, (_, k) => Bun.env[k] ?? "");
  }
  return val;
}
function expandDeep(o: any): any {
  if (Array.isArray(o)) return o.map(expandDeep);
  if (o && typeof o === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(o)) out[k] = expandDeep(v);
    return out;
  }
  return expandEnv(o);
}

const cfgText = await Bun.file(getConfigPath()).text();
let raw: any;
try {
  raw = YAML.parse(cfgText);
} catch {
  raw = JSON.parse(cfgText);
}
const cfg = expandDeep(raw);

// validate & fill defaults
const Cfg = z.object({
  mode: z.enum(["single-bot", "dual-bot"]).default("single-bot"),
  group_id: z.union([z.string(), z.number()]),
  bots: z.object({
    a: z.object({
      token: z.string(),
      webhook_path: z.string().default("/tg-a/webhook"),
      secret: z.string()
    }),
    b: z
      .object({
        token: z.string().optional(),
        webhook_path: z.string().optional(),
        secret: z.string().optional(),
        username: z.string().optional()
      })
      .optional()
  }),
  join: z
    .object({
      mode: z.enum(["limit1", "join_request"]).default("limit1"),
      expire_seconds: z.number().int().positive().default(86400),
      member_limit: z.number().int().positive().optional()
    })
    .default({ mode: "limit1", expire_seconds: 86400 }),
  redirect: z
    .object({
      path: z.string().default("/tg-join"),
      allow_params: z
        .array(z.string())
        .default(["clickid", "utm_source", "utm_medium", "utm_campaign"])
    })
    .default({
      path: "/tg-join",
      allow_params: ["clickid", "utm_source", "utm_medium", "utm_campaign"]
    }),
  storage: z
    .object({
      driver: z.enum(["memory", "mongo", "redis"]).default("memory"),
      dsn: z.string().default("")
    })
    .default({ driver: "memory", dsn: "" }),
  postback: z
    .object({
      http: z
        .object({
          url: z.string().default(""),

          method: z.preprocess((v) => {
            if (typeof v !== "string") return undefined;
            const s = v.trim().toUpperCase();
            return s === "" ? undefined : s;
          }, z.enum(["GET", "POST"]).default("GET")),

          mode: z.preprocess((v) => {
            if (typeof v !== "string") return undefined;
            const s = v.trim().toLowerCase();
            return s === "" ? undefined : s;
          }, z.enum(["query", "json"]).optional()),

          headers: z
            .union([z.string(), z.record(z.string(), z.string())])
            .optional()
        })
        .default({
          url: "",
          method: "GET",
          mode: "query",
          headers: {} as Record<string, string>
        })
    })
    .default({
      http: {
        url: "",
        method: "GET",
        mode: "query",
        headers: {} as Record<string, string>
      }
    }),
  security: z
    .object({
      require_secret_header: z.boolean().default(true),
      webhook_ip_allowlist: z.array(z.string()).default([])
    })
    .default({ require_secret_header: true, webhook_ip_allowlist: [] }),
  logging: z
    .object({ level: z.string().default("info") })
    .default({ level: "info" })
});
const conf = Cfg.parse(cfg);

// sanity checks
if (!conf.bots.a.token) throw new Error("bots.a.token is required");
if (conf.mode === "dual-bot" && !conf.bots?.b?.token)
  throw new Error("bots.b.token is required in dual-bot mode");

// TG clients
const tgA = makeTG(`https://api.telegram.org/bot${conf.bots.a.token}`);
const tgB = conf.bots?.b?.token
  ? makeTG(`https://api.telegram.org/bot${conf.bots.b!.token}`)
  : null;

const store = await createStorage(conf);
const pb = makeHttpProvider(conf);

const app = new Elysia();

// health/admin
app.get("/health", () => ({ ok: true }));
app.get("/admin/state", async () => ({
  events: await store.recentEvents(),
  // dev only sugar:
  users: (store as any).users
    ? Array.from((store as any).users.entries()).slice(-50)
    : [],
  invites: (store as any).invites
    ? Array.from((store as any).invites.entries()).slice(-50)
    : []
}));

// routes
mountRedirect(app, { tgA, cfg: conf, store });
mountWebhookA(app, { tgA, store, cfg: conf, pb });
mountWebhookB(app, { store, cfg: conf, pb });

app.listen(3000, () => console.log("Join Attribution on :3000"));
