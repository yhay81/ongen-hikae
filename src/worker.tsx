import { Hono } from "hono";
import type { Child } from "hono/jsx";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type SourceGuide = {
  checkedOn: string;
  name: string;
  points: string[];
  slug: string;
  source: string;
  summary: string;
};

export const canonicalOrigin = "https://ongen-hikae.yhay81.com";
export const eventNames = new Set([
  "visited",
  "record_added",
  "record_updated",
  "record_removed",
  "sample_loaded",
  "project_filtered",
  "credits_copied",
  "csv_exported",
  "json_exported",
  "json_imported",
  "source_opened",
  "returned",
]);
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const sourceGuides: SourceGuide[] = [
  {
    checkedOn: "2026-08-01",
    name: "DOVA-SYNDROME",
    points: [
      "利用前に、音源ライセンスと各作曲者の追加条件を確認する",
      "YouTubeの収益化と、第三者からの権利申立は別々に記録する",
      "ダウンロードした音源をContent IDへ登録しない",
    ],
    slug: "dova-syndrome",
    source: "https://dova-s.jp/help/articles/youtube/",
    summary: "YouTube利用、収益化、Content IDの注意点を公式ヘルプで確認する。",
  },
  {
    checkedOn: "2026-08-01",
    name: "BGMer",
    points: [
      "商用利用とクレジット表記の扱いを利用規約で確認する",
      "音源を作品の主目的にした再配布・販売を避ける",
      "音源を自分の著作物として権利登録しない",
    ],
    slug: "bgmer",
    source: "https://bgmer.net/terms",
    summary: "商用利用、クレジット、禁止事項を公式の利用規約で確認する。",
  },
  {
    checkedOn: "2026-08-01",
    name: "効果音ラボ",
    points: [
      "商用利用、報告、クレジット表記の扱いをFAQで確認する",
      "素材そのものの再配布・販売に当たらないか確認する",
      "テンプレートや制作代行など、成果物の渡し方に注意する",
    ],
    slug: "sound-effect-lab",
    source: "https://soundeffect-lab.info/faq/",
    summary: "商用案件や制作物への組み込み方を公式FAQで確認する。",
  },
];

const app = new Hono<{ Bindings: Bindings }>();

function Layout(props: {
  canonical: string;
  children: Child;
  description: string;
  noindex?: boolean;
  title: string;
}) {
  const canonical = canonicalOrigin + props.canonical;
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width,initial-scale=1" name="viewport" />
        <title>{props.title}</title>
        <meta content={props.description} name="description" />
        {props.noindex ? <meta content="noindex,nofollow" name="robots" /> : null}
        <meta content="#244d4c" name="theme-color" />
        <meta content="website" property="og:type" />
        <meta content="音源控え" property="og:site_name" />
        <meta content={props.title} property="og:title" />
        <meta content={props.description} property="og:description" />
        <meta content={canonicalOrigin + "/og.png"} property="og:image" />
        <meta content={canonical} property="og:url" />
        <meta content="summary_large_image" name="twitter:card" />
        <link href={canonical} rel="canonical" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/manifest.webmanifest" rel="manifest" />
        <link href="/styles.css" rel="stylesheet" />
        <script src="/common.js" type="module" />
      </head>
      <body>
        <a class="skip-link" href="#main">
          本文へ移動
        </a>
        <header class="site-header">
          <a class="brand" href="/">
            <span aria-hidden="true" class="brand-mark">
              <i />
              <i />
              <i />
            </span>
            音源控え
          </a>
          <nav aria-label="主要" class="site-nav">
            <a href="/">控え台</a>
            <a href="/sources">配布元の確認</a>
            <a href="/guide">使い方</a>
            <a href="/privacy">データ</a>
          </nav>
        </header>
        <main id="main">{props.children}</main>
        <footer class="site-footer">
          <span>控えはこの端末に保存</span>
          <span>利用判断は配布元の最新条件で確認</span>
        </footer>
      </body>
    </html>
  );
}

function PatchDiagram() {
  return (
    <div aria-label="案件から音源、利用条件、書き出しへつながる図" class="patch-diagram" role="img">
      <div class="patch-module module-project">
        <span class="module-led" />
        <b>案件</b>
        <i />
        <i />
      </div>
      <span class="patch-cable cable-one" />
      <div class="patch-module module-track">
        <span class="module-led" />
        <b>音源</b>
        <div class="level-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <span class="patch-cable cable-two" />
      <div class="patch-module module-license">
        <span class="module-led amber" />
        <b>条件</b>
        <i />
        <i />
        <i />
      </div>
      <span class="patch-cable cable-three" />
      <div class="patch-module module-output">
        <span class="module-led blue" />
        <b>表記</b>
        <span class="paper-slot" />
      </div>
    </div>
  );
}

function SelectField(props: { id: string; label: string; options: [string, string][] }) {
  return (
    <label class="field">
      <span>{props.label}</span>
      <select id={props.id} name={props.id}>
        {props.options.map(([value, label]) => (
          <option value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}

function HomePage() {
  return (
    <>
      <section class="desk-intro">
        <div>
          <p class="eyebrow">AUDIO USE LOG</p>
          <h1>使った音に、根拠を添える。</h1>
          <p class="lead">
            案件ごとに配布元、確認日、利用条件、必要な表記をひとつの控えへ。記録はこの端末だけに残ります。
          </p>
        </div>
        <PatchDiagram />
      </section>

      <section class="signal-board" aria-label="控えの状態">
        <div>
          <span class="signal-lamp lamp-total" />
          <small>登録</small>
          <strong id="count-total">0</strong>
        </div>
        <div>
          <span class="signal-lamp lamp-ready" />
          <small>確認済み</small>
          <strong id="count-ready">0</strong>
        </div>
        <div>
          <span class="signal-lamp lamp-review" />
          <small>再確認</small>
          <strong id="count-review">0</strong>
        </div>
        <div>
          <span class="signal-lamp lamp-blocked" />
          <small>利用不可</small>
          <strong id="count-blocked">0</strong>
        </div>
      </section>

      <div aria-live="polite" class="notice" id="notice" />

      <div class="workspace-grid">
        <aside class="project-console">
          <div class="panel-heading">
            <span class="panel-index">01</span>
            <div>
              <p class="eyebrow">PROJECT RACK</p>
              <h2>案件</h2>
            </div>
          </div>
          <div class="project-rail" id="project-rail" />
          <label class="field compact-field">
            <span>表示する案件</span>
            <select id="project-filter">
              <option value="">すべての案件</option>
            </select>
          </label>
          <p class="panel-note">案件名が同じ控えを束ねて表示します。</p>
        </aside>

        <section class="entry-console" aria-labelledby="form-title">
          <div class="panel-heading">
            <span class="panel-index">02</span>
            <div>
              <p class="eyebrow">TRACK INPUT</p>
              <h2 id="form-title">音源を控える</h2>
            </div>
            <span class="record-limit" id="record-limit">
              0 / 200
            </span>
          </div>
          <form id="record-form" novalidate>
            <input id="edit-id" name="edit-id" type="hidden" />
            <div class="field-grid">
              <label class="field">
                <span>
                  案件名 <em>必須</em>
                </span>
                <input
                  autocomplete="off"
                  id="project"
                  maxlength={100}
                  placeholder="例：商品紹介動画"
                />
                <small class="field-error" id="project-error" />
              </label>
              <label class="field">
                <span>
                  曲名・音名 <em>必須</em>
                </span>
                <input autocomplete="off" id="title" maxlength={160} placeholder="例：朝の支度" />
                <small class="field-error" id="title-error" />
              </label>
              <label class="field">
                <span>作者</span>
                <input
                  autocomplete="off"
                  id="author"
                  maxlength={120}
                  placeholder="作者・配布者名"
                />
              </label>
              <label class="field">
                <span>
                  配布元 <em>必須</em>
                </span>
                <input
                  autocomplete="off"
                  id="source-name"
                  maxlength={100}
                  placeholder="例：DOVA-SYNDROME"
                />
                <small class="field-error" id="source-name-error" />
              </label>
              <label class="field field-wide">
                <span>
                  配布元URL <em>必須</em>
                </span>
                <input
                  autocomplete="off"
                  id="source-url"
                  inputmode="url"
                  maxlength={500}
                  placeholder="https://"
                  type="url"
                />
                <small class="field-error" id="source-url-error" />
              </label>
              <label class="field">
                <span>
                  条件を確認した日 <em>必須</em>
                </span>
                <input id="checked-on" type="date" />
                <small class="field-error" id="checked-on-error" />
              </label>
            </div>

            <fieldset class="condition-deck">
              <legend>利用条件</legend>
              <SelectField
                id="commercial"
                label="商用利用"
                options={[
                  ["unknown", "未確認"],
                  ["allowed", "利用可"],
                  ["blocked", "利用不可"],
                ]}
              />
              <SelectField
                id="credit"
                label="クレジット"
                options={[
                  ["unknown", "未確認"],
                  ["required", "表記必要"],
                  ["optional", "表記任意"],
                ]}
              />
              <SelectField
                id="content-id"
                label="Content ID・権利申立"
                options={[
                  ["unknown", "未確認"],
                  ["clear", "注意事項なし"],
                  ["caution", "要確認"],
                ]}
              />
            </fieldset>

            <div class="field-grid">
              <label class="field field-wide">
                <span>クレジット表記</span>
                <input
                  autocomplete="off"
                  id="credit-line"
                  maxlength={300}
                  placeholder="例：BGM：曲名 / 作者名"
                />
                <small class="field-error" id="credit-line-error" />
              </label>
              <label class="field field-wide">
                <span>確認メモ</span>
                <textarea
                  id="memo"
                  maxlength={600}
                  placeholder="使用場面、禁止事項、申立が来た場合の確認先など"
                />
              </label>
            </div>
            <div class="form-actions">
              <button class="secondary-button" id="load-sample" type="button">
                見本を入れる
              </button>
              <span class="action-spacer" />
              <button class="secondary-button" hidden id="cancel-edit" type="button">
                編集をやめる
              </button>
              <button id="save-record" type="submit">
                控えに追加
              </button>
            </div>
          </form>
        </section>
      </div>

      <section class="records-console" aria-labelledby="records-title">
        <div class="panel-heading">
          <span class="panel-index">03</span>
          <div>
            <p class="eyebrow">PATCHED TRACKS</p>
            <h2 id="records-title">音源の控え</h2>
          </div>
        </div>
        <div class="empty-state" id="empty-state">
          <span class="empty-reel" aria-hidden="true">
            <i />
          </span>
          <p>まだ音源がつながっていません。</p>
          <small>上の入力台から追加すると、条件の状態がここに並びます。</small>
        </div>
        <div class="record-list" id="record-list" />
      </section>

      <section class="output-console" aria-labelledby="output-title">
        <div class="panel-heading">
          <span class="panel-index">04</span>
          <div>
            <p class="eyebrow">OUTPUT DECK</p>
            <h2 id="output-title">表記と控えを書き出す</h2>
          </div>
        </div>
        <div class="output-grid">
          <div>
            <label class="field" for="credit-preview">
              <span>クレジット欄</span>
            </label>
            <textarea id="credit-preview" readonly />
            <button disabled id="copy-credits" type="button">
              クレジットをコピー
            </button>
          </div>
          <div class="export-rack">
            <button class="export-card" disabled id="export-csv" type="button">
              <span class="file-mark">CSV</span>
              <b>一覧を書き出す</b>
              <small>選択中の案件を表計算用に保存</small>
            </button>
            <button class="export-card" disabled id="export-json" type="button">
              <span class="file-mark">JSON</span>
              <b>控えをバックアップ</b>
              <small>全件を別の端末へ移せる形式で保存</small>
            </button>
            <label class="export-card import-card">
              <span class="file-mark">読込</span>
              <b>バックアップを戻す</b>
              <small>同じIDの控えは読み込んだ内容で更新</small>
              <input accept=".json,application/json" id="import-json" type="file" />
            </label>
          </div>
        </div>
      </section>
      <script src="/app.js" type="module" />
    </>
  );
}

function SourceCard(props: { guide: SourceGuide }) {
  return (
    <article class="source-card">
      <div class="source-card-top">
        <span class="source-jack" aria-hidden="true" />
        <div>
          <h2>{props.guide.name}</h2>
          <p>{props.guide.summary}</p>
        </div>
      </div>
      <small>最終確認 {props.guide.checkedOn}</small>
      <div class="source-actions">
        <a href={"/sources/" + props.guide.slug}>確認項目を見る</a>
        <a data-official-source href={props.guide.source} rel="noopener noreferrer" target="_blank">
          公式ページ ↗
        </a>
      </div>
    </article>
  );
}

function SourceDetail(props: { guide: SourceGuide }) {
  return (
    <div class="content-shell">
      <p class="eyebrow">SOURCE CHECK</p>
      <h1>{props.guide.name} の確認控え</h1>
      <div class="source-meter">
        <span class="source-jack" />
        <div>
          <small>このページの確認日</small>
          <strong>{props.guide.checkedOn}</strong>
        </div>
      </div>
      <section class="content-card">
        <h2>記録前に見るところ</h2>
        <ol class="check-list">
          {props.guide.points.map((point) => (
            <li>{point}</li>
          ))}
        </ol>
      </section>
      <section class="content-card warning-card">
        <h2>元ページが判断の基準です</h2>
        <p>
          利用条件は更新されることがあります。ここにある確認項目だけで利用可否を判断せず、使う音源の個別条件と配布元の最新ページを確認してください。
        </p>
        <a
          class="button"
          data-official-source
          href={props.guide.source}
          rel="noopener noreferrer"
          target="_blank"
        >
          {props.guide.name} の公式ページを開く
        </a>
      </section>
      <p>
        <a href="/">控え台へ戻る</a>
      </p>
    </div>
  );
}

app.use("*", async (c, next) => {
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
});

app.get("/", (c) =>
  c.html(
    <Layout
      canonical="/"
      description="使った音源の配布元、確認日、利用条件、クレジットを案件ごとに端末内で整理・書き出しできます。"
      title="音源の利用条件を、案件ごとに控える｜音源控え"
    >
      <HomePage />
    </Layout>,
  ),
);

app.get("/sources", (c) =>
  c.html(
    <Layout
      canonical="/sources"
      description="音源配布元の公式利用条件を確認するときの要点と元ページ。"
      title="配布元の確認｜音源控え"
    >
      <div class="content-shell wide-shell">
        <p class="eyebrow">SOURCE PATCHBAY</p>
        <h1>配布元ごとの確認口。</h1>
        <p class="lead">控えへ記録する前に見る項目を、公式ページへの導線と一緒に並べています。</p>
        <div class="source-grid">
          {sourceGuides.map((guide) => (
            <SourceCard guide={guide} />
          ))}
        </div>
        <section class="content-card warning-card">
          <h2>一覧にない配布元も記録できます</h2>
          <p>
            配布元名とURLを控え、商用利用、表記、Content
            IDなどの注意事項を元ページで確認してください。音源控えは利用許可や権利状態を判定しません。
          </p>
        </section>
      </div>
    </Layout>,
  ),
);

app.get("/sources/:slug", (c) => {
  const guide = sourceGuides.find((item) => item.slug === c.req.param("slug"));
  if (!guide) return c.notFound();
  return c.html(
    <Layout
      canonical={"/sources/" + guide.slug}
      description={guide.summary}
      title={guide.name + " の確認控え｜音源控え"}
    >
      <SourceDetail guide={guide} />
    </Layout>,
  );
});

app.get("/guide", (c) =>
  c.html(
    <Layout
      canonical="/guide"
      description="音源控えへ利用条件を記録し、公開前に再確認して書き出す手順。"
      title="使い方｜音源控え"
    >
      <div class="content-shell">
        <p class="eyebrow">PATCH ORDER</p>
        <h1>配布元から、公開欄までつなぐ。</h1>
        <div class="guide-path">
          <article class="content-card">
            <span class="path-number">1</span>
            <h2>元ページを開く</h2>
            <p>使う音源の個別ページと、配布元の最新利用条件を開きます。</p>
          </article>
          <article class="content-card">
            <span class="path-number">2</span>
            <h2>条件を控える</h2>
            <p>案件、音源、確認日、商用利用、表記、権利申立の注意事項を記録します。</p>
          </article>
          <article class="content-card">
            <span class="path-number">3</span>
            <h2>公開前に見る</h2>
            <p>未確認・要確認・90日超の札を見直し、必要なクレジットをコピーします。</p>
          </article>
          <article class="content-card">
            <span class="path-number">4</span>
            <h2>控えを残す</h2>
            <p>CSVを案件資料へ添え、JSONをバックアップとして安全な場所へ保存します。</p>
          </article>
        </div>
        <section class="content-card warning-card">
          <h2>音源控えがしないこと</h2>
          <p>
            音声ファイルの保存、利用許可の判定、権利者の確認、申立への法的助言は行いません。迷う条件は配布元や権利者へ確認してください。
          </p>
        </section>
      </div>
    </Layout>,
  ),
);

app.get("/privacy", (c) =>
  c.html(
    <Layout
      canonical="/privacy"
      description="音源控えが端末に保存する内容と、匿名利用計測の範囲。"
      title="データの扱い｜音源控え"
    >
      <div class="content-shell">
        <p class="eyebrow">DATA BOUNDARY</p>
        <h1>控えの中身は、この端末だけに。</h1>
        <section class="content-card">
          <h2>端末に保存するもの</h2>
          <p>
            案件名、曲名・音名、作者、配布元、URL、確認日、選んだ利用条件、クレジット表記、確認メモをlocalStorageへ保存します。Cookieは使いません。
          </p>
        </section>
        <section class="content-card">
          <h2>送らないもの</h2>
          <p>
            控えへ入力した内容、音声ファイル、書き出したCSV・JSON、クリップボードの内容、IPアドレス、User-Agent、位置情報を製品の利用記録として送信・保存しません。
          </p>
        </section>
        <section class="content-card">
          <h2>数えるもの</h2>
          <p>
            無作為な匿名IDのハッシュ、訪問、追加・更新・削除、見本利用、案件切替、コピー、書き出し、読込、公式ページ確認、再訪の種類、JST日付、自動QA区分だけをD1へ保存し、45日後に削除します。
          </p>
        </section>
        <section class="content-card">
          <h2>消去と移動</h2>
          <p>
            ブラウザのサイトデータを削除すると控えも消えます。別の端末へ移す前にJSONを書き出してください。共有端末では、入力内容を残したままにしないでください。
          </p>
        </section>
      </div>
    </Layout>,
  ),
);

app.get("/healthz", (c) => c.json({ ok: true, sources: sourceGuides.length }));

app.get("/sitemap.xml", (c) => {
  const paths = [
    "/",
    "/guide",
    "/sources",
    "/privacy",
    ...sourceGuides.map((guide) => "/sources/" + guide.slug),
  ];
  c.header("Content-Type", "application/xml; charset=UTF-8");
  c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return c.body(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      paths.map((path) => "  <url><loc>" + canonicalOrigin + path + "</loc></url>").join("\n") +
      "\n</urlset>",
  );
});

app.post("/api/events", async (c) => {
  c.header("Cache-Control", "no-store");
  const origin = c.req.header("Origin");
  if (!origin || origin !== new URL(c.req.url).origin)
    return c.json({ error: "invalid_origin" }, 403);
  if (
    (c.req.header("Content-Type") ?? "").split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  )
    return c.json({ error: "unsupported_media_type" }, 415);
  const contentLength = Number(c.req.header("Content-Length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > 256)
    return c.json({ error: "payload_too_large" }, 413);
  const session = c.req.header("X-Ongen-Hikae-Session") ?? "";
  if (!sessionPattern.test(session)) return c.json({ error: "invalid_session" }, 400);

  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (JSON.stringify(input).length > 256) return c.json({ error: "payload_too_large" }, 413);
  if (!input || typeof input !== "object" || Array.isArray(input))
    return c.json({ error: "invalid_payload" }, 400);
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== "detail" || keys[1] !== "name")
    return c.json({ error: "invalid_shape" }, 400);
  const { detail, name } = input as { detail: unknown; name: unknown };
  if (typeof name !== "string" || !eventNames.has(name) || detail !== "")
    return c.json({ error: "invalid_event" }, 400);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session));
  const sessionHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const isQa = c.req.header("X-Ongen-Hikae-QA") === "1" ? 1 : 0;
  await c.env.DB.prepare(
    "INSERT INTO product_events(name,session_hash,detail,day,is_qa) VALUES(?,?,?,?,?)",
  )
    .bind(name, sessionHash, null, day, isQa)
    .run();
  return c.body(null, 202);
});

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) return c.json({ error: "not_found" }, 404);
  return c.html(
    <Layout
      canonical={c.req.path}
      description="ページが見つかりません。"
      noindex
      title="見つかりません｜音源控え"
    >
      <div class="content-shell">
        <p class="eyebrow">404</p>
        <h1>その差込口は見つかりません。</h1>
        <p>
          <a class="button" href="/">
            控え台へ戻る
          </a>
        </p>
      </div>
    </Layout>,
    404,
  );
});

export const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (_event, env) => {
  await env.DB.prepare(
    "DELETE FROM product_events WHERE created_at < unixepoch() - (45 * 86400)",
  ).run();
};

export default { fetch: app.fetch, scheduled } satisfies ExportedHandler<Bindings>;
export { app };
