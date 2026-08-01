export const storageKey = "ongen_hikae_records_v1";
export const schemaVersion = 1;
export const maxRecords = 200;

export const labels = Object.freeze({
  commercial: {
    allowed: "利用可",
    blocked: "利用不可",
    unknown: "未確認",
  },
  contentId: {
    clear: "注意事項なし",
    caution: "要確認",
    unknown: "未確認",
  },
  credit: {
    required: "表記必要",
    optional: "表記任意",
    unknown: "未確認",
  },
});

const allowedValues = Object.freeze({
  commercial: new Set(Object.keys(labels.commercial)),
  contentId: new Set(Object.keys(labels.contentId)),
  credit: new Set(Object.keys(labels.credit)),
});

function text(value, length) {
  return typeof value === "string" ? value.trim().slice(0, length) : "";
}

function choice(value, field) {
  return typeof value === "string" && allowedValues[field].has(value) ? value : "unknown";
}

export function normalizeUrl(value) {
  const candidate = text(value, 500);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export function normalizeDate(value) {
  const candidate = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const date = new Date(candidate + "T00:00:00Z");
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== candidate
    ? ""
    : candidate;
}

export function normalizeRecord(input, createId = () => crypto.randomUUID()) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    author: text(source.author, 120),
    checkedOn: normalizeDate(source.checkedOn),
    commercial: choice(source.commercial, "commercial"),
    contentId: choice(source.contentId, "contentId"),
    credit: choice(source.credit, "credit"),
    creditLine: text(source.creditLine, 300),
    id: /^[0-9a-f-]{36}$/i.test(String(source.id ?? "")) ? String(source.id) : createId(),
    memo: text(source.memo, 600),
    project: text(source.project, 100),
    sourceName: text(source.sourceName, 100),
    sourceUrl: normalizeUrl(source.sourceUrl),
    title: text(source.title, 160),
    updatedAt: normalizeDate(source.updatedAt) || new Date().toISOString().slice(0, 10),
  };
}

export function validateRecord(record) {
  const errors = {};
  if (!record.project) errors.project = "案件名を入力してください。";
  if (!record.title) errors.title = "曲名・音名を入力してください。";
  if (!record.sourceName) errors.sourceName = "配布元を入力してください。";
  if (!record.sourceUrl) errors.sourceUrl = "https:// から始まる配布元URLを入力してください。";
  if (!record.checkedOn) errors.checkedOn = "確認日を入力してください。";
  if (record.credit === "required" && !record.creditLine)
    errors.creditLine = "必要なクレジット表記を入力してください。";
  return errors;
}

export function daysSince(date, today = new Date().toISOString().slice(0, 10)) {
  const start = Date.parse(date + "T00:00:00Z");
  const end = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end)) return Infinity;
  return Math.floor((end - start) / 86400000);
}

export function recordStatus(record, today) {
  if (record.commercial === "blocked") {
    return { key: "blocked", label: "利用不可", reason: "利用条件が「利用不可」です" };
  }
  if (
    record.commercial === "unknown" ||
    record.credit === "unknown" ||
    record.contentId === "unknown"
  ) {
    return { key: "review", label: "未確認あり", reason: "未確認の利用条件があります" };
  }
  if (record.contentId === "caution") {
    return { key: "review", label: "要確認", reason: "Content IDなどの注意事項があります" };
  }
  if (daysSince(record.checkedOn, today) > 90) {
    return { key: "stale", label: "再確認", reason: "確認から90日を超えています" };
  }
  return { key: "ready", label: "確認済み", reason: "入力された条件に未確認項目はありません" };
}

export function summarize(records, today) {
  return records.reduce(
    (summary, record) => {
      const key = recordStatus(record, today).key;
      summary.total += 1;
      summary[key] += 1;
      return summary;
    },
    { blocked: 0, ready: 0, review: 0, stale: 0, total: 0 },
  );
}

export function listProjects(records) {
  return [...new Set(records.map((record) => record.project).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

export function buildCreditText(records, project = "") {
  const selected = records.filter((record) => !project || record.project === project);
  if (!selected.length) return "";
  const lines = [];
  const projectName =
    project ||
    (new Set(selected.map((record) => record.project)).size === 1 ? selected[0].project : "全案件");
  lines.push("【使用音源】" + projectName, "");
  for (const record of selected) {
    const credit = record.creditLine || [record.title, record.author].filter(Boolean).join(" / ");
    lines.push("・" + credit);
    lines.push("  " + record.sourceUrl);
  }
  lines.push("", "確認日: " + new Date().toISOString().slice(0, 10));
  return lines.join("\n");
}

function spreadsheetSafe(value) {
  const stringValue = String(value ?? "");
  return /^[=+\-@]/.test(stringValue) ? "'" + stringValue : stringValue;
}

function csvCell(value) {
  return '"' + spreadsheetSafe(value).replaceAll('"', '""') + '"';
}

export function buildCsv(records) {
  const fields = [
    ["案件", "project"],
    ["曲名・音名", "title"],
    ["作者", "author"],
    ["配布元", "sourceName"],
    ["配布元URL", "sourceUrl"],
    ["確認日", "checkedOn"],
    ["商用利用", "commercial"],
    ["クレジット", "credit"],
    ["Content ID等", "contentId"],
    ["表記文", "creditLine"],
    ["メモ", "memo"],
  ];
  const header = fields.map(([label]) => csvCell(label)).join(",");
  const body = records.map((record) =>
    fields
      .map(([, key]) => {
        const dictionary = labels[key];
        return csvCell(dictionary ? dictionary[record[key]] : record[key]);
      })
      .join(","),
  );
  return "\uFEFF" + [header, ...body].join("\r\n");
}

export function buildJson(records) {
  return JSON.stringify(
    {
      app: "音源控え",
      exportedAt: new Date().toISOString(),
      records,
      schemaVersion,
    },
    null,
    2,
  );
}

export function parseImport(input, createId = () => crypto.randomUUID()) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("ファイルの形式を確認してください。");
  if (parsed.app !== "音源控え" || parsed.schemaVersion !== schemaVersion)
    throw new Error("音源控えから書き出したJSONではありません。");
  if (!Array.isArray(parsed.records) || parsed.records.length > maxRecords)
    throw new Error("記録数は200件以内にしてください。");
  return parsed.records.map((record) => {
    const normalized = normalizeRecord(record, createId);
    if (Object.keys(validateRecord(normalized)).length)
      throw new Error("必須項目が欠けている記録があります。");
    return normalized;
  });
}

export function mergeRecords(current, incoming) {
  const merged = new Map(current.map((record) => [record.id, record]));
  for (const record of incoming) merged.set(record.id, record);
  return [...merged.values()].slice(0, maxRecords);
}
