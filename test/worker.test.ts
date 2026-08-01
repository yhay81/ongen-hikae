import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  buildCreditText,
  buildCsv,
  buildJson,
  maxRecords,
  mergeRecords,
  normalizeRecord,
  parseImport,
  recordStatus,
  summarize,
  validateRecord,
} from "../public/app-core.js";
import {
  app,
  canonicalOrigin,
  eventNames,
  scheduled,
  sourceGuides,
  type Bindings,
} from "../src/worker";

const pathOf = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const session = "f72e17de-0d95-4bba-84e9-a6638e0308df";
let miniflare: Miniflare;
let bindings: Bindings;

const eventRequest = (
  name: string,
  options: { body?: string; origin?: string; qa?: boolean; session?: string; type?: string } = {},
) => ({
  body: options.body ?? JSON.stringify({ detail: "", name }),
  headers: {
    "content-type": options.type ?? "application/json",
    origin: options.origin ?? "http://localhost",
    "x-ongen-hikae-qa": options.qa ? "1" : "0",
    "x-ongen-hikae-session": options.session ?? session,
  },
  method: "POST",
});

const sampleRecord = (overrides: Record<string, unknown> = {}) =>
  normalizeRecord(
    {
      author: "配布者",
      checkedOn: "2026-08-01",
      commercial: "allowed",
      contentId: "clear",
      credit: "required",
      creditLine: "BGM：朝の支度 / 配布者",
      memo: "公開前に再確認",
      project: "商品紹介動画",
      sourceName: "配布サイト",
      sourceUrl: "https://example.com/music/morning",
      title: "朝の支度",
      ...overrides,
    },
    () => "11111111-1111-4111-8111-111111111111",
  );

beforeAll(async () => {
  miniflare = new Miniflare({
    d1Databases: { DB: "ongen-hikae-test" },
    modules: true,
    script: "export default { fetch() { return new Response('test') } }",
  });
  const database = await miniflare.getD1Database("DB");
  const migration = await readFile(pathOf("../migrations/0001_product.sql"), "utf8");
  for (const statement of migration
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean))
    await database.prepare(statement).run();
  bindings = {
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    DB: database as unknown as D1Database,
  };
});

beforeEach(async () => {
  await bindings.DB.prepare("DELETE FROM product_events").run();
});

afterAll(async () => miniflare.dispose());

describe("public product", () => {
  it.each([
    ["/", "使った音に、根拠を添える。", canonicalOrigin + "/"],
    ["/guide", "配布元から、公開欄までつなぐ。", canonicalOrigin + "/guide"],
    ["/sources", "配布元ごとの確認口。", canonicalOrigin + "/sources"],
    ["/privacy", "控えの中身は、この端末だけに。", canonicalOrigin + "/privacy"],
  ])("renders %s with a canonical URL", async (path, marker, canonical) => {
    const response = await app.request(path, undefined, bindings);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain(marker);
    expect(body).toContain('href="' + canonical + '" rel="canonical"');
    expect(body).not.toMatch(/成功条件|市場スコア|公開実験|収益性|仮説/);
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
    expect(response.headers.get("permissions-policy")).toContain("geolocation=()");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("communicates the product as a connected work desk", async () => {
    const body = await (await app.request("/", undefined, bindings)).text();
    for (const marker of [
      'class="patch-diagram"',
      "PROJECT RACK",
      "TRACK INPUT",
      "PATCHED TRACKS",
      "OUTPUT DECK",
      "音源を控える",
      "クレジット欄",
    ])
      expect(body).toContain(marker);
    expect(body).toContain('id="import-json"');
    expect(body).toContain('id="export-csv"');
    expect(body).toContain("0 / 200");
  });

  it.each(sourceGuides)("publishes the $name official-source guide", async (guide) => {
    const response = await app.request("/sources/" + guide.slug, undefined, bindings);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain(guide.source);
    expect(body).toContain(guide.checkedOn);
    expect(body).toContain("元ページが判断の基準です");
    expect(guide.source).toMatch(/^https:\/\//);
  });

  it("exposes a stable health and seven-URL sitemap baseline", async () => {
    expect(await (await app.request("/healthz", undefined, bindings)).json()).toEqual({
      ok: true,
      sources: 3,
    });
    const sitemap = await (await app.request("/sitemap.xml", undefined, bindings)).text();
    expect([...sitemap.matchAll(/<loc>/g)]).toHaveLength(7);
    for (const guide of sourceGuides)
      expect(sitemap).toContain(canonicalOrigin + "/sources/" + guide.slug);
  });

  it("returns branded noindex 404 pages", async () => {
    const response = await app.request("/missing", undefined, bindings);
    const body = await response.text();
    expect(response.status).toBe(404);
    expect(body).toContain("その差込口は見つかりません");
    expect(body).toContain('content="noindex,nofollow"');
    expect((await app.request("/sources/not-real", undefined, bindings)).status).toBe(404);
    expect(await (await app.request("/api/not-real", undefined, bindings)).json()).toEqual({
      error: "not_found",
    });
  });
});

describe("local record engine", () => {
  it("normalizes URLs, choices, and lengths", () => {
    const record = normalizeRecord(
      {
        checkedOn: "2026-02-29",
        commercial: "maybe",
        project: "a".repeat(140),
        sourceUrl: "http://example.com/file",
      },
      () => "11111111-1111-4111-8111-111111111111",
    );
    expect(record.project).toHaveLength(100);
    expect(record.sourceUrl).toBe("");
    expect(record.checkedOn).toBe("");
    expect(record.commercial).toBe("unknown");
  });

  it("requires the five source fields and a credit line when required", () => {
    const errors = validateRecord(
      sampleRecord({
        checkedOn: "",
        creditLine: "",
        project: "",
        sourceName: "",
        sourceUrl: "",
        title: "",
      }),
    );
    expect(errors).toEqual({
      checkedOn: "確認日を入力してください。",
      creditLine: "必要なクレジット表記を入力してください。",
      project: "案件名を入力してください。",
      sourceName: "配布元を入力してください。",
      sourceUrl: "https:// から始まる配布元URLを入力してください。",
      title: "曲名・音名を入力してください。",
    });
  });

  it("separates ready, review, stale, and blocked records", () => {
    const records = [
      sampleRecord(),
      sampleRecord({ commercial: "unknown" }),
      sampleRecord({ checkedOn: "2026-01-01" }),
      sampleRecord({ commercial: "blocked" }),
    ];
    expect(records.map((record) => recordStatus(record, "2026-08-01").key)).toEqual([
      "ready",
      "review",
      "stale",
      "blocked",
    ]);
    expect(summarize(records, "2026-08-01")).toEqual({
      blocked: 1,
      ready: 1,
      review: 1,
      stale: 1,
      total: 4,
    });
  });

  it("builds readable credit text and spreadsheet-safe CSV", () => {
    const record = sampleRecord({ project: "=危険な式", title: "+cmd" });
    const credit = buildCreditText([record], record.project);
    expect(credit).toContain("BGM：朝の支度 / 配布者");
    expect(credit).toContain("https://example.com/music/morning");
    const csv = buildCsv([record]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=危険な式"');
    expect(csv).toContain('"\' +cmd"'.replace(" ", ""));
  });

  it("round-trips only its own bounded JSON backups", () => {
    const record = sampleRecord();
    const restored = parseImport(buildJson([record]), () => "22222222-2222-4222-8222-222222222222");
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: record.id, project: record.project });
    expect(() => parseImport('{"app":"other","schemaVersion":1,"records":[]}')).toThrow(
      "音源控えから書き出したJSONではありません。",
    );
    expect(() =>
      parseImport(
        JSON.stringify({
          app: "音源控え",
          records: Array.from({ length: maxRecords + 1 }, () => record),
          schemaVersion: 1,
        }),
      ),
    ).toThrow("記録数は200件以内にしてください。");
  });

  it("merges imported records by id", () => {
    const original = sampleRecord();
    const changed = sampleRecord({ title: "更新後" });
    const extra = normalizeRecord(
      { ...sampleRecord(), id: "22222222-2222-4222-8222-222222222222", title: "別の音" },
      () => "22222222-2222-4222-8222-222222222222",
    );
    expect(mergeRecords([original], [changed, extra]).map((record) => record.title)).toEqual([
      "更新後",
      "別の音",
    ]);
  });
});

describe("anonymous metrics", () => {
  it("accepts all twelve events without accepting content", async () => {
    expect(eventNames).toHaveProperty("size", 12);
    for (const name of eventNames) {
      const response = await app.request("/api/events", eventRequest(name), bindings);
      expect(response.status).toBe(202);
    }
    const rows = await bindings.DB.prepare(
      "SELECT name,session_hash,detail,is_qa FROM product_events ORDER BY id",
    ).all<{ detail: string | null; is_qa: number; name: string; session_hash: string }>();
    expect(rows.results).toHaveLength(12);
    expect(rows.results?.every((row) => row.session_hash.length === 64)).toBe(true);
    expect(rows.results?.every((row) => row.detail === null)).toBe(true);
  });

  it("separates automated QA from real use", async () => {
    await app.request("/api/events", eventRequest("visited", { qa: true }), bindings);
    await app.request("/api/events", eventRequest("visited"), bindings);
    const counts = await bindings.DB.prepare(
      "SELECT SUM(CASE WHEN is_qa=0 THEN 1 ELSE 0 END) AS real,SUM(CASE WHEN is_qa=1 THEN 1 ELSE 0 END) AS qa FROM product_events",
    ).first<{ qa: number; real: number }>();
    expect(counts).toEqual({ qa: 1, real: 1 });
  });

  it.each([
    ["unknown event", eventRequest("unknown"), 400, "invalid_event"],
    [
      "content detail",
      {
        ...eventRequest("record_added"),
        body: JSON.stringify({ detail: "案件名", name: "record_added" }),
      },
      400,
      "invalid_event",
    ],
    ["bad session", eventRequest("visited", { session: "bad" }), 400, "invalid_session"],
    [
      "cross-site",
      eventRequest("visited", { origin: "https://evil.example" }),
      403,
      "invalid_origin",
    ],
    ["plain text", eventRequest("visited", { type: "text/plain" }), 415, "unsupported_media_type"],
    ["broken JSON", eventRequest("visited", { body: "{" }), 400, "invalid_json"],
    [
      "extra field",
      eventRequest("visited", {
        body: JSON.stringify({ detail: "", name: "visited", project: "secret" }),
      }),
      400,
      "invalid_shape",
    ],
    [
      "large body",
      eventRequest("visited", {
        body: JSON.stringify({ detail: "", name: "visited", pad: "x".repeat(300) }),
      }),
      413,
      "payload_too_large",
    ],
  ])("rejects %s", async (_label, request, status, error) => {
    const response = await app.request("/api/events", request, bindings);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("removes anonymous events after forty-five days", async () => {
    await bindings.DB.prepare(
      "INSERT INTO product_events(name,session_hash,detail,day,is_qa,created_at) VALUES('visited',?,NULL,'2026-01-01',0,unixepoch()-46*86400)",
    )
      .bind("a".repeat(64))
      .run();
    await scheduled({} as ScheduledController, bindings, {} as ExecutionContext);
    const count = await bindings.DB.prepare("SELECT COUNT(*) AS total FROM product_events").first<{
      total: number;
    }>();
    expect(count?.total).toBe(0);
  });
});

describe("static release contract", () => {
  it("keeps content, privacy, and visual constraints in code", async () => {
    const [worker, styles, common, application, core, privacy] = await Promise.all([
      readFile(pathOf("../src/worker.tsx"), "utf8"),
      readFile(pathOf("../public/styles.css"), "utf8"),
      readFile(pathOf("../public/common.js"), "utf8"),
      readFile(pathOf("../public/app.js"), "utf8"),
      readFile(pathOf("../public/app-core.js"), "utf8"),
      readFile(pathOf("../docs/privacy-boundary.md"), "utf8"),
    ]);
    expect(styles).toContain("clamp(1.7rem, 3.4vw, 2.2rem)");
    expect(styles).not.toMatch(/gradient/i);
    expect(styles).toContain("@media print");
    expect(worker).not.toMatch(/成功条件|市場スコア|公開実験|収益性|仮説/);
    expect(application).not.toContain("innerHTML");
    expect(application).toContain("textContent");
    expect(core).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon/);
    expect(common).not.toContain("record-form");
    expect(common).not.toContain("sourceUrl");
    expect(privacy).toContain("案件名、曲名・音名、作者、配布元、URL");
    expect(privacy).toContain("45日");
  });

  it("publishes the required static assets", async () => {
    for (const path of [
      "../public/og.png",
      "../public/styles.css",
      "../public/common.js",
      "../public/app-core.js",
      "../public/app.js",
      "../public/sw.js",
      "../public/manifest.webmanifest",
      "../public/robots.txt",
      "../public/favicon.svg",
      "../public/16a103f18dc448aeb04dc8c01f241e62.txt",
    ])
      expect((await readFile(pathOf(path))).byteLength).toBeGreaterThan(0);
  });
});
