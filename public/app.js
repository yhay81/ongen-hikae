import {
  buildCreditText,
  buildCsv,
  buildJson,
  labels,
  listProjects,
  maxRecords,
  mergeRecords,
  normalizeRecord,
  parseImport,
  recordStatus,
  storageKey,
  summarize,
  validateRecord,
} from "./app-core.js";
import { recordEvent } from "./common.js";

const byId = (id) => document.getElementById(id);
const automatedQa =
  new URLSearchParams(window.location.search).get("qa") === "1" || navigator.webdriver === true;
let records = [];
let projectFilter = "";

function loadRecords() {
  if (automatedQa) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, maxRecords).map((record) => normalizeRecord(record));
  } catch {
    return [];
  }
}

function saveRecords() {
  if (automatedQa) return true;
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
    return true;
  } catch {
    announce("端末へ保存できませんでした。空き容量やブラウザ設定を確認してください。", true);
    return false;
  }
}

function announce(message, isError = false) {
  const region = byId("notice");
  region.textContent = message;
  region.dataset.tone = isError ? "error" : "ok";
}

function setText(id, value) {
  byId(id).textContent = String(value);
}

function setFieldError(field, message) {
  const input = byId(field);
  const error = byId(field + "-error");
  if (!input || !error) return;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  error.textContent = message || "";
}

function formValue(id) {
  return byId(id).value;
}

function readForm() {
  return normalizeRecord({
    author: formValue("author"),
    checkedOn: formValue("checked-on"),
    commercial: formValue("commercial"),
    contentId: formValue("content-id"),
    credit: formValue("credit"),
    creditLine: formValue("credit-line"),
    id: formValue("edit-id") || undefined,
    memo: formValue("memo"),
    project: formValue("project"),
    sourceName: formValue("source-name"),
    sourceUrl: formValue("source-url"),
    title: formValue("title"),
  });
}

function resetForm() {
  byId("record-form").reset();
  byId("edit-id").value = "";
  byId("checked-on").value = new Date().toISOString().slice(0, 10);
  byId("form-title").textContent = "音源を控える";
  byId("save-record").textContent = "控えに追加";
  byId("cancel-edit").hidden = true;
  document.querySelectorAll(".field-error").forEach((element) => {
    element.textContent = "";
  });
  document.querySelectorAll("[aria-invalid]").forEach((element) => {
    element.setAttribute("aria-invalid", "false");
  });
}

function fillForm(record) {
  byId("edit-id").value = record.id;
  byId("project").value = record.project;
  byId("title").value = record.title;
  byId("author").value = record.author;
  byId("source-name").value = record.sourceName;
  byId("source-url").value = record.sourceUrl;
  byId("checked-on").value = record.checkedOn;
  byId("commercial").value = record.commercial;
  byId("credit").value = record.credit;
  byId("content-id").value = record.contentId;
  byId("credit-line").value = record.creditLine;
  byId("memo").value = record.memo;
  byId("form-title").textContent = "控えを編集";
  byId("save-record").textContent = "変更を保存";
  byId("cancel-edit").hidden = false;
  byId("record-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = "condition-chip " + className;
  badge.textContent = text;
  return badge;
}

function makeRecordCard(record) {
  const status = recordStatus(record);
  const article = document.createElement("article");
  article.className = "record-card";
  article.dataset.status = status.key;

  const stripe = document.createElement("span");
  stripe.className = "signal-stripe";
  stripe.setAttribute("aria-hidden", "true");
  article.append(stripe);

  const header = document.createElement("header");
  const heading = document.createElement("div");
  const project = document.createElement("small");
  project.textContent = record.project;
  const title = document.createElement("h3");
  title.textContent = record.title;
  const author = document.createElement("p");
  author.textContent = record.author || "作者名の記録なし";
  heading.append(project, title, author);
  header.append(heading, makeBadge(status.label, "status-" + status.key));
  article.append(header);

  const source = document.createElement("a");
  source.href = record.sourceUrl;
  source.rel = "noopener noreferrer";
  source.target = "_blank";
  source.textContent = record.sourceName + " ↗";
  source.dataset.officialSource = "";
  source.addEventListener("click", () => void recordEvent("source_opened"));
  article.append(source);

  const conditions = document.createElement("div");
  conditions.className = "condition-row";
  conditions.append(
    makeBadge("商用 " + labels.commercial[record.commercial], "neutral"),
    makeBadge("表記 " + labels.credit[record.credit], "neutral"),
    makeBadge("権利申立 " + labels.contentId[record.contentId], "neutral"),
  );
  article.append(conditions);

  const checked = document.createElement("p");
  checked.className = "checked-line";
  checked.textContent = "確認 " + record.checkedOn + "　" + status.reason;
  article.append(checked);

  if (record.creditLine) {
    const credit = document.createElement("p");
    credit.className = "credit-line";
    credit.textContent = record.creditLine;
    article.append(credit);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "text-button";
  edit.textContent = "編集";
  edit.addEventListener("click", () => fillForm(record));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button danger-button";
  remove.textContent = "削除";
  remove.addEventListener("click", () => {
    if (!window.confirm("「" + record.title + "」の控えを削除しますか？")) return;
    records = records.filter((item) => item.id !== record.id);
    saveRecords();
    render();
    void recordEvent("record_removed");
    announce("控えを削除しました。");
  });
  actions.append(edit, remove);
  article.append(actions);
  return article;
}

function renderProjects() {
  const projects = listProjects(records);
  if (projectFilter && !projects.includes(projectFilter)) projectFilter = "";
  const select = byId("project-filter");
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "すべての案件";
  select.append(all);
  for (const project of projects) {
    const option = document.createElement("option");
    option.value = project;
    option.textContent = project;
    select.append(option);
  }
  select.value = projectFilter;

  const rail = byId("project-rail");
  rail.replaceChildren();
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = projectFilter ? "" : "active";
  allButton.textContent = "全体 " + records.length;
  allButton.addEventListener("click", () => applyProjectFilter(""));
  rail.append(allButton);
  for (const project of projects) {
    const count = records.filter((record) => record.project === project).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = projectFilter === project ? "active" : "";
    button.textContent = project + " " + count;
    button.addEventListener("click", () => applyProjectFilter(project));
    rail.append(button);
  }
}

function applyProjectFilter(project) {
  projectFilter = project;
  render();
  void recordEvent("project_filtered");
}

function render() {
  renderProjects();
  const selected = records.filter((record) => !projectFilter || record.project === projectFilter);
  const summary = summarize(selected);
  setText("count-total", summary.total);
  setText("count-ready", summary.ready);
  setText("count-review", summary.review + summary.stale);
  setText("count-blocked", summary.blocked);

  const list = byId("record-list");
  list.replaceChildren();
  byId("empty-state").hidden = selected.length > 0;
  for (const record of selected) list.append(makeRecordCard(record));

  const creditText = buildCreditText(selected, projectFilter);
  byId("credit-preview").value = creditText;
  byId("copy-credits").disabled = !creditText;
  byId("export-csv").disabled = !selected.length;
  byId("export-json").disabled = !records.length;
  byId("record-limit").textContent = records.length + " / " + maxRecords;
}

function download(name, type, contents) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([contents], { type }));
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const temporary = document.createElement("textarea");
  temporary.value = value;
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.append(temporary);
  temporary.select();
  document.execCommand("copy");
  temporary.remove();
}

byId("record-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (records.length >= maxRecords && !formValue("edit-id")) {
    announce("控えは200件までです。JSONを書き出してから整理してください。", true);
    return;
  }
  const record = readForm();
  const errors = validateRecord(record);
  for (const field of [
    "project",
    "title",
    "source-name",
    "source-url",
    "checked-on",
    "credit-line",
  ]) {
    const key = field.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    setFieldError(field, errors[key]);
  }
  if (Object.keys(errors).length) {
    announce("入力を確認してください。", true);
    const first = Object.keys(errors)[0];
    const id = first.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    byId(id)?.focus();
    return;
  }

  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
    void recordEvent("record_updated");
    announce("控えを更新しました。");
  } else {
    records.unshift(record);
    void recordEvent("record_added");
    announce("音源を控えました。");
  }
  if (!saveRecords()) return;
  resetForm();
  render();
});

byId("cancel-edit").addEventListener("click", resetForm);
byId("project-filter").addEventListener("change", (event) =>
  applyProjectFilter(event.target.value),
);

byId("load-sample").addEventListener("click", () => {
  if (records.length >= maxRecords) return;
  const sample = normalizeRecord({
    author: "配布者名",
    checkedOn: new Date().toISOString().slice(0, 10),
    commercial: "allowed",
    contentId: "caution",
    credit: "required",
    creditLine: "BGM：朝の支度 / 配布者名",
    memo: "動画公開前にContent IDの注意事項を再確認",
    project: "商品紹介動画",
    sourceName: "配布サイト",
    sourceUrl: "https://example.com/music/morning",
    title: "朝の支度",
  });
  records.unshift(sample);
  saveRecords();
  projectFilter = sample.project;
  render();
  void recordEvent("sample_loaded");
  announce("見本を追加しました。自由に編集・削除できます。");
});

byId("copy-credits").addEventListener("click", async () => {
  try {
    await copyText(byId("credit-preview").value);
    void recordEvent("credits_copied");
    announce("クレジット欄をコピーしました。");
  } catch {
    announce("コピーできませんでした。欄を選択してコピーしてください。", true);
  }
});

byId("export-csv").addEventListener("click", () => {
  const selected = records.filter((record) => !projectFilter || record.project === projectFilter);
  download("ongen-hikae.csv", "text/csv;charset=utf-8", buildCsv(selected));
  void recordEvent("csv_exported");
  announce("CSVを書き出しました。");
});

byId("export-json").addEventListener("click", () => {
  download("ongen-hikae-backup.json", "application/json;charset=utf-8", buildJson(records));
  void recordEvent("json_exported");
  announce("バックアップJSONを書き出しました。");
});

byId("import-json").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 1048576) {
    announce("1MB以内のJSONを選んでください。", true);
    return;
  }
  try {
    const imported = parseImport(await file.text());
    const merged = mergeRecords(records, imported);
    if (merged.length < records.length + imported.length)
      announce("同じIDの控えは新しい内容で上書きしました。");
    records = merged;
    saveRecords();
    render();
    void recordEvent("json_imported");
    announce(imported.length + "件を読み込みました。");
  } catch (error) {
    announce(error instanceof Error ? error.message : "JSONを読み込めませんでした。", true);
  }
});

records = loadRecords();
resetForm();
render();
