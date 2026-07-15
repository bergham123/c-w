/**
 * Cloudflare Worker - GitHub JSON Editor
 * -----------------------------------------------------
 * - Serves a single HTML page (index) with:
 *    - Messages section: Load / Edit(textarea) / Save -> updates  message.json in the repo
 *    - Contacts section:  Load / Edit(textarea) / Save -> updates accounts.json in the repo
 *    - Run Workflow button -> triggers a GitHub Actions workflow_dispatch (independent button)
 *
 * Required environment variables / secrets (set in Cloudflare dashboard or wrangler secrets):
 *    GITHUB_TOKEN      -> GitHub Personal Access Token (needs "repo" + "workflow" scopes)
 *    GITHUB_OWNER      -> GitHub username or org, e.g. "myuser"
 *    GITHUB_REPO       -> repo name, e.g. "my-repo"
 *    GITHUB_BRANCH     -> (optional) branch name, default "main"
 *    WORKFLOW_FILE     -> workflow file name inside .github/workflows/, e.g. "run.yml"
 *    MESSAGES_PATH     -> (optional) path of messages file in repo, default " message.json"
 *    CONTACTS_PATH     -> (optional) path of contacts file in repo, default "accounts.json"
 */

function ghHeaders(env) {
  return {
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "cf-worker-json-editor",
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

function getPath(env, type) {
  if (type === "messages") return env.MESSAGES_PATH || " message.json";
  if (type === "contacts") return env.CONTACTS_PATH || "accounts.json";
  throw new Error("Unknown type: " + type);
}

// Base64 helpers that support UTF-8 (Arabic text etc.)
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

async function githubGetFile(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) {
    return { content: "[]", sha: null, exists: false };
  }
  if (!res.ok) {
    throw new Error(`GitHub GET error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const content = base64ToUtf8(data.content);
  return { content, sha: data.sha, exists: true };
}

async function githubPutFile(env, path, contentStr, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: message || `Update ${path} via web editor`,
    content: utf8ToBase64(contentStr),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GitHub PUT error ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

async function githubRunWorkflow(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const workflowFile = env.WORKFLOW_FILE;
  if (!workflowFile) throw new Error("WORKFLOW_FILE env var is not set");
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: ghHeaders(env),
    body: JSON.stringify({ ref: branch }),
  });
  if (res.status !== 204) {
    throw new Error(`GitHub workflow dispatch error ${res.status}: ${await res.text()}`);
  }
  return true;
}

// Convert raw textarea text (one item per line) into a JSON array string
function linesToJsonArray(text) {
  const items = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return JSON.stringify(items, null, 2);
}

// Convert stored JSON (array or anything) back into plain lines for the textarea
function jsonToLines(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join("\n");
    }
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // Not valid JSON yet (e.g. empty file) - show raw
    return jsonStr;
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleLoad(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "messages" && type !== "contacts") {
    return jsonResponse({ error: "type must be messages or contacts" }, 400);
  }
  try {
    const path = getPath(env, type);
    const { content } = await githubGetFile(env, path);
    return jsonResponse({ ok: true, text: jsonToLines(content) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

async function handleSave(request, env) {
  try {
    const body = await request.json();
    const { type, text } = body;
    if (type !== "messages" && type !== "contacts") {
      return jsonResponse({ error: "type must be messages or contacts" }, 400);
    }
    const path = getPath(env, type);
    const jsonStr = linesToJsonArray(text || "");
    const current = await githubGetFile(env, path);
    const result = await githubPutFile(
      env,
      path,
      jsonStr,
      current.sha,
      `Update ${path} via web editor`
    );
    return jsonResponse({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

async function handleRunWorkflow(request, env) {
  try {
    await githubRunWorkflow(env);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GitHub JSON Editor</title>
<style>
  :root {
    --bg: #0f1115;
    --panel: #171a21;
    --border: #2a2e38;
    --text: #e8eaed;
    --muted: #9aa0ac;
    --accent: #4f8cff;
    --accent-hover: #3d76e0;
    --green: #34c77b;
    --red: #ff5c5c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px;
  }
  h1 {
    font-size: 20px;
    margin-bottom: 4px;
  }
  .sub {
    color: var(--muted);
    margin-bottom: 24px;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 800px) {
    .grid { grid-template-columns: 1fr; }
  }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
  }
  .panel h2 {
    font-size: 15px;
    margin: 0 0 4px 0;
  }
  .panel .hint {
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 10px;
  }
  textarea {
    width: 100%;
    min-height: 220px;
    background: #0c0e12;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    font-family: "Consolas", monospace;
    font-size: 13px;
    resize: vertical;
    direction: ltr;
    text-align: left;
  }
  .btn-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  button {
    background: var(--accent);
    color: white;
    border: none;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
  button:hover { background: var(--accent-hover); }
  button.secondary {
    background: #2a2e38;
  }
  button.secondary:hover { background: #383e4c; }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .status {
    margin-top: 8px;
    font-size: 12px;
    min-height: 16px;
  }
  .status.ok { color: var(--green); }
  .status.err { color: var(--red); }
  .workflow-panel {
    margin-top: 20px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .workflow-panel h2 {
    font-size: 15px;
    margin: 0;
  }
  .workflow-panel .hint {
    color: var(--muted);
    font-size: 12px;
  }
</style>
</head>
<body>
  <h1>محرر ملفات JSON على GitHub</h1>
  <div class="sub">عدّل  message.json و accounts.json مباشرة من المستودع، وشغّل الـ workflow بزر منفصل.</div>

  <div class="grid">
    <div class="panel">
      <h2>Messages</h2>
      <div class="hint">كل رسالة فسطر وحدو (حتى 3 رسائل مثلا) — تلقائيًا كتتحول لـ JSON array</div>
      <textarea id="messagesArea" placeholder="اكتب رسالة فكل سطر..."></textarea>
      <div class="btn-row">
        <button class="secondary" id="loadMessagesBtn">Load</button>
        <button id="saveMessagesBtn">Save / Update</button>
      </div>
      <div class="status" id="messagesStatus"></div>
    </div>

    <div class="panel">
      <h2>Contacts</h2>
      <div class="hint">كل رقم فسطر وحدو — تلقائيًا كيتحول لـ JSON array</div>
      <textarea id="contactsArea" placeholder="اكتب رقم فكل سطر..."></textarea>
      <div class="btn-row">
        <button class="secondary" id="loadContactsBtn">Load</button>
        <button id="saveContactsBtn">Save / Update</button>
      </div>
      <div class="status" id="contactsStatus"></div>
    </div>
  </div>

  <div class="workflow-panel">
    <div>
      <h2>GitHub Actions Workflow</h2>
      <div class="hint">هاد الزر خدامتو وحدو، مايتوقفش على messages ولا contacts</div>
    </div>
    <div>
      <button id="runWorkflowBtn">▶ Run Workflow</button>
      <div class="status" id="workflowStatus"></div>
    </div>
  </div>

<script>
  function setStatus(el, msg, type) {
    el.textContent = msg;
    el.className = "status" + (type ? " " + type : "");
  }

  async function loadFile(type, areaEl, statusEl) {
    setStatus(statusEl, "كيتحمل...", "");
    try {
      const res = await fetch("/api/load?type=" + type);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "خطأ غير معروف");
      areaEl.value = data.text;
      setStatus(statusEl, "تم التحميل ✔", "ok");
    } catch (err) {
      setStatus(statusEl, "خطأ: " + err.message, "err");
    }
  }

  async function saveFile(type, areaEl, statusEl) {
    setStatus(statusEl, "كيتسجل...", "");
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text: areaEl.value }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "خطأ غير معروف");
      setStatus(statusEl, "تم الحفظ ✔ (commit تم)", "ok");
    } catch (err) {
      setStatus(statusEl, "خطأ: " + err.message, "err");
    }
  }

  const messagesArea = document.getElementById("messagesArea");
  const messagesStatus = document.getElementById("messagesStatus");
  document.getElementById("loadMessagesBtn").onclick = () => loadFile("messages", messagesArea, messagesStatus);
  document.getElementById("saveMessagesBtn").onclick = () => saveFile("messages", messagesArea, messagesStatus);

  const contactsArea = document.getElementById("contactsArea");
  const contactsStatus = document.getElementById("contactsStatus");
  document.getElementById("loadContactsBtn").onclick = () => loadFile("contacts", contactsArea, contactsStatus);
  document.getElementById("saveContactsBtn").onclick = () => saveFile("contacts", contactsArea, contactsStatus);

  const workflowStatus = document.getElementById("workflowStatus");
  document.getElementById("runWorkflowBtn").onclick = async () => {
    setStatus(workflowStatus, "كيتشغل...", "");
    try {
      const res = await fetch("/api/run-workflow", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "خطأ غير معروف");
      setStatus(workflowStatus, "تم تشغيل الـ workflow ✔", "ok");
    } catch (err) {
      setStatus(workflowStatus, "خطأ: " + err.message, "err");
    }
  };
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/load" && request.method === "GET") {
      return handleLoad(request, env);
    }

    if (url.pathname === "/api/save" && request.method === "POST") {
      return handleSave(request, env);
    }

    if (url.pathname === "/api/run-workflow" && request.method === "POST") {
      return handleRunWorkflow(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
