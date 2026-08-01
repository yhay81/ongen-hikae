const sessionKey = "ongen_hikae_session";
const seenKey = "ongen_hikae_seen";
const automatedQa =
  new URLSearchParams(window.location.search).get("qa") === "1" || navigator.webdriver === true;

function createSession() {
  if (automatedQa) return crypto.randomUUID();
  const existing = localStorage.getItem(sessionKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(sessionKey, created);
  return created;
}

const session = createSession();

export async function recordEvent(name) {
  const headers = {
    "Content-Type": "application/json",
    "X-Ongen-Hikae-Session": session,
  };
  if (automatedQa) headers["X-Ongen-Hikae-QA"] = "1";
  try {
    await fetch("/api/events", {
      body: JSON.stringify({ detail: "", name }),
      headers,
      keepalive: true,
      method: "POST",
    });
  } catch {
    // 計測できない場合も、道具の機能はすべて使えます。
  }
}

const previouslySeen = !automatedQa && localStorage.getItem(seenKey) === "1";
void recordEvent("visited");
if (previouslySeen) void recordEvent("returned");
if (!automatedQa) localStorage.setItem(seenKey, "1");

document.querySelectorAll("[data-official-source]").forEach((link) => {
  link.addEventListener("click", () => void recordEvent("source_opened"));
});

if ("serviceWorker" in navigator && !automatedQa) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
