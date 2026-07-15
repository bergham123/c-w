/**
 * Cloudflare Worker - GitHub Manager Pro
 * --------------------------------------
 * - Messages: Load / Edit / Save
 * - Contacts: Load / Edit / Save
 * - Images: Preview & Upload to images/
 * - Logs: View logs from /logs/ folder
 * - Run Workflow: Trigger GitHub Actions
 * - Authentication: Email + Password (env vars)
 */

function ghHeaders(env) {
  return {
    "Authorization": "Bearer " + env.GITHUB_TOKEN,
    "User-Agent": "cf-worker-json-editor",
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

function getPath(env, type) {
  if (type === "messages") return env.MESSAGES_PATH || "message.json";
  if (type === "contacts") return env.CONTACTS_PATH || "accounts.json";
  throw new Error("Unknown type: " + type);
}

function getWorkflowPath(env) {
  const file = env.WORKFLOW_FILE || "send.yaml";
  return file.includes("/") ? file : ".github/workflows/" + file;
}

function getImagesDir(env) {
  return (env.IMAGES_DIR || "images").replace(/^\/+|\/+$/g, "");
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

async function githubGetFile(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) {
    return { content: "[]", sha: null, exists: false };
  }
  if (!res.ok) {
    throw new Error("GitHub GET error " + res.status + ": " + await res.text());
  }
  const data = await res.json();
  const content = base64ToUtf8(data.content);
  return { content, sha: data.sha, exists: true };
}

async function githubGetFileRaw(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) {
    return { sha: null, exists: false };
  }
  if (!res.ok) {
    throw new Error("GitHub GET error " + res.status + ": " + await res.text());
  }
  const data = await res.json();
  return { sha: data.sha, exists: true, contentBase64: data.content };
}

async function githubPutFile(env, path, contentStr, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = {
    message: message || "Update " + path + " via web editor",
    content: utf8ToBase64(contentStr),
    branch: branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("GitHub PUT error " + res.status + ": " + await res.text());
  }
  return await res.json();
}

async function githubPutFileBase64(env, path, base64Content, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = {
    message: message || "Add " + path + " via web editor",
    content: base64Content,
    branch: branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("GitHub PUT error " + res.status + ": " + await res.text());
  }
  return await res.json();
}

async function githubRunWorkflow(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const workflowFile = env.WORKFLOW_FILE;
  if (!workflowFile) throw new Error("WORKFLOW_FILE env var is not set");
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/actions/workflows/" + encodeURIComponent(workflowFile) + "/dispatches";
  const res = await fetch(url, {
    method: "POST",
    headers: ghHeaders(env),
    body: JSON.stringify({ ref: branch }),
  });
  if (res.status !== 204) {
    throw new Error("GitHub workflow dispatch error " + res.status + ": " + await res.text());
  }
  return true;
}

// ========== دوال السجلات (Logs) ==========
async function githubListFiles(env, folder) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(folder) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) {
    return { files: [], exists: false };
  }
  if (!res.ok) {
    throw new Error("GitHub list error " + res.status + ": " + await res.text());
  }
  const data = await res.json();
  const files = data
    .filter(item => item.type === "file" && item.name.endsWith(".log"))
    .map(item => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      download_url: item.download_url,
    }));
  return { files, exists: true };
}

async function handleGetLogs(request, env) {
  try {
    const { files } = await githubListFiles(env, "logs");
    return jsonResponse({ ok: true, files: files });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

async function handleGetLogContent(request, env) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get("file");
    if (!filename) {
      return jsonResponse({ ok: false, error: "Missing file parameter" }, 400);
    }
    const path = "logs/" + filename;
    const { content } = await githubGetFile(env, path);
    return jsonResponse({ ok: true, content: content });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// ========== دوال المصادقة ==========
function checkAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }
  const base64 = authHeader.split(" ")[1];
  const [email, password] = atob(base64).split(":");
  return email === env.ADMIN_EMAIL && password === env.ADMIN_PASSWORD;
}

// ========== باقي الدوال (Messages, Contacts, Images, Workflow) ==========
function linesToJsonArray(text) {
  const items = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return JSON.stringify(items, null, 2);
}

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
    return jsonStr;
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status: status,
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
      "Update " + path + " via web editor"
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

async function handleUploadImage(request, env) {
  try {
    const body = await request.json();
    const { filename, dataBase64 } = body;
    if (!filename || !dataBase64) {
      return jsonResponse({ ok: false, error: "filename and dataBase64 are required" }, 400);
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = getImagesDir(env);
    const path = dir + "/" + Date.now() + "_" + safeName;

    const existing = await githubGetFileRaw(env, path);
    const result = await githubPutFileBase64(
      env,
      path,
      dataBase64,
      existing.sha,
      "Add image " + safeName + " via web editor"
    );
    return jsonResponse({ ok: true, path: path, commit: result.commit && result.commit.sha });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// ========== HTML الرئيسي (مكتوب باستخدام Array join لتجنب مشاكل backticks) ==========
const HTML_PAGE = [
  '<!DOCTYPE html>',
  '<html lang="ar" dir="rtl">',
  '<head>',
  '<meta charset="UTF-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<title>مدير GitHub</title>',
  '<style>',
  '  /* ===== إعدادات عامة ===== */',
  '  * { box-sizing: border-box; margin: 0; padding: 0; }',
  '  body {',
  '    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;',
  '    background: #0b0e14;',
  '    color: #e8eaed;',
  '    min-height: 100vh;',
  '    display: flex;',
  '    align-items: center;',
  '    justify-content: center;',
  '    padding: 20px;',
  '  }',
  '  .container {',
  '    max-width: 1100px;',
  '    width: 100%;',
  '    background: #141922;',
  '    border-radius: 24px;',
  '    padding: 30px;',
  '    box-shadow: 0 20px 60px rgba(0,0,0,0.7);',
  '    border: 1px solid #2a303d;',
  '  }',
  '  .header {',
  '    display: flex;',
  '    justify-content: space-between;',
  '    align-items: center;',
  '    margin-bottom: 28px;',
  '    flex-wrap: wrap;',
  '    gap: 12px;',
  '  }',
  '  .logo-area {',
  '    display: flex;',
  '    align-items: center;',
  '    gap: 12px;',
  '  }',
  '  .logo-icon { font-size: 28px; }',
  '  .logo-text {',
  '    font-size: 20px;',
  '    font-weight: 700;',
  '    color: #f0f4ff;',
  '    letter-spacing: 0.5px;',
  '  }',
  '  .logo-text span { color: #6c8cff; }',
  '  .user-area {',
  '    display: flex;',
  '    align-items: center;',
  '    gap: 14px;',
  '    font-size: 13px;',
  '    background: #1e2533;',
  '    padding: 8px 16px 8px 12px;',
  '    border-radius: 40px;',
  '    border: 1px solid #2f384a;',
  '  }',
  '  .user-email { color: #b0c4e8; }',
  '  .logout-btn {',
  '    background: none;',
  '    border: none;',
  '    color: #ff6b6b;',
  '    cursor: pointer;',
  '    font-size: 13px;',
  '    font-weight: 600;',
  '    padding: 4px 8px;',
  '    border-radius: 6px;',
  '    transition: 0.2s;',
  '  }',
  '  .logout-btn:hover { background: #2a1a1a; }',
  '  .grid {',
  '    display: grid;',
  '    grid-template-columns: 1fr 1fr;',
  '    gap: 22px;',
  '    margin-top: 6px;',
  '  }',
  '  @media (max-width: 750px) { .grid { grid-template-columns: 1fr; } }',
  '  .card {',
  '    background: #1a212e;',
  '    border: 1px solid #2b3445;',
  '    border-radius: 18px;',
  '    padding: 20px 20px 18px;',
  '    transition: 0.25s;',
  '  }',
  '  .card:hover {',
  '    border-color: #4a5a7a;',
  '    box-shadow: 0 6px 20px rgba(0,20,60,0.3);',
  '  }',
  '  .card-header {',
  '    display: flex;',
  '    align-items: center;',
  '    gap: 10px;',
  '    margin-bottom: 4px;',
  '  }',
  '  .card-header .icon { font-size: 22px; }',
  '  .card-header h2 {',
  '    font-size: 17px;',
  '    font-weight: 600;',
  '    color: #eef2f9;',
  '  }',
  '  .card-hint {',
  '    color: #8899bb;',
  '    font-size: 12px;',
  '    margin: 2px 0 12px 32px;',
  '  }',
  '  textarea {',
  '    width: 100%;',
  '    min-height: 180px;',
  '    background: #0e131f;',
  '    color: #e0e8f5;',
  '    border: 1px solid #283040;',
  '    border-radius: 12px;',
  '    padding: 12px;',
  '    font-family: "Consolas", monospace;',
  '    font-size: 13px;',
  '    resize: vertical;',
  '    direction: ltr;',
  '    text-align: left;',
  '  }',
  '  textarea:focus {',
  '    outline: none;',
  '    border-color: #5a7cff;',
  '    box-shadow: 0 0 0 3px rgba(90,124,255,0.15);',
  '  }',
  '  .btn-row {',
  '    display: flex;',
  '    gap: 10px;',
  '    margin-top: 12px;',
  '    flex-wrap: wrap;',
  '  }',
  '  .btn {',
  '    background: #3a4d72;',
  '    color: white;',
  '    border: none;',
  '    padding: 8px 18px;',
  '    border-radius: 30px;',
  '    cursor: pointer;',
  '    font-size: 13px;',
  '    font-weight: 600;',
  '    transition: 0.2s;',
  '    display: inline-flex;',
  '    align-items: center;',
  '    gap: 6px;',
  '  }',
  '  .btn:hover {',
  '    background: #4d62a0;',
  '    transform: scale(1.02);',
  '  }',
  '  .btn-secondary { background: #293241; }',
  '  .btn-secondary:hover { background: #3a455a; }',
  '  .btn-success { background: #2a8b5e; }',
  '  .btn-success:hover { background: #34a872; }',
  '  .btn-danger { background: #a03a3a; }',
  '  .btn-danger:hover { background: #c44a4a; }',
  '  .btn-outline {',
  '    background: transparent;',
  '    border: 1px solid #4a5a7a;',
  '  }',
  '  .btn-outline:hover { background: #1f2838; }',
  '  .status {',
  '    margin-top: 10px;',
  '    font-size: 12px;',
  '    min-height: 18px;',
  '    color: #a0b4d0;',
  '  }',
  '  .status.ok { color: #4cdb8c; }',
  '  .status.err { color: #ff6b6b; }',
  '  .image-preview-area {',
  '    display: flex;',
  '    flex-wrap: wrap;',
  '    gap: 12px;',
  '    margin: 12px 0;',
  '    max-height: 260px;',
  '    overflow-y: auto;',
  '    padding: 4px 2px;',
  '  }',
  '  .image-preview-item {',
  '    width: 90px;',
  '    height: 90px;',
  '    border-radius: 12px;',
  '    overflow: hidden;',
  '    border: 2px solid #2f384a;',
  '    position: relative;',
  '    background: #0e131f;',
  '    display: flex;',
  '    align-items: center;',
  '    justify-content: center;',
  '    transition: 0.2s;',
  '  }',
  '  .image-preview-item img {',
  '    width: 100%;',
  '    height: 100%;',
  '    object-fit: cover;',
  '  }',
  '  .image-preview-item .file-name {',
  '    position: absolute;',
  '    bottom: 0;',
  '    left: 0;',
  '    right: 0;',
  '    background: rgba(0,0,0,0.75);',
  '    color: #ddd;',
  '    font-size: 9px;',
  '    padding: 2px 4px;',
  '    text-align: center;',
  '    white-space: nowrap;',
  '    overflow: hidden;',
  '    text-overflow: ellipsis;',
  '  }',
  '  .image-preview-item .remove-img {',
  '    position: absolute;',
  '    top: 2px;',
  '    right: 2px;',
  '    background: #cc3333;',
  '    color: white;',
  '    border: none;',
  '    border-radius: 50%;',
  '    width: 20px;',
  '    height: 20px;',
  '    font-size: 12px;',
  '    cursor: pointer;',
  '    display: flex;',
  '    align-items: center;',
  '    justify-content: center;',
  '  }',
  '  .file-input-wrapper {',
  '    display: flex;',
  '    gap: 10px;',
  '    align-items: center;',
  '    flex-wrap: wrap;',
  '  }',
  '  .file-input-wrapper input[type="file"] {',
  '    color: #b0c4e8;',
  '    font-size: 12px;',
  '    background: #0e131f;',
  '    padding: 6px;',
  '    border-radius: 8px;',
  '    border: 1px solid #2f384a;',
  '    width: 100%;',
  '    max-width: 260px;',
  '  }',
  '  .file-list {',
  '    margin-top: 8px;',
  '    font-size: 12px;',
  '    color: #8899bb;',
  '    display: flex;',
  '    flex-direction: column;',
  '    gap: 4px;',
  '  }',
  '  .workflow-bar {',
  '    margin-top: 24px;',
  '    background: #1a212e;',
  '    border: 1px solid #2b3445;',
  '    border-radius: 18px;',
  '    padding: 16px 22px;',
  '    display: flex;',
  '    align-items: center;',
  '    justify-content: space-between;',
  '    flex-wrap: wrap;',
  '    gap: 14px;',
  '  }',
  '  .workflow-bar .left {',
  '    display: flex;',
  '    align-items: center;',
  '    gap: 12px;',
  '  }',
  '  .workflow-bar .left .icon { font-size: 24px; }',
  '  .workflow-bar .left h3 {',
  '    font-size: 16px;',
  '    font-weight: 500;',
  '  }',
  '  .workflow-bar .left .hint {',
  '    font-size: 12px;',
  '    color: #8899bb;',
  '  }',
  '  .workflow-bar .actions {',
  '    display: flex;',
  '    gap: 10px;',
  '    align-items: center;',
  '  }',
  '  .modal-overlay {',
  '    display: none;',
  '    position: fixed;',
  '    top: 0; left: 0; right: 0; bottom: 0;',
  '    background: rgba(0,0,0,0.7);',
  '    backdrop-filter: blur(4px);',
  '    z-index: 999;',
  '    align-items: center;',
  '    justify-content: center;',
  '    padding: 20px;',
  '  }',
  '  .modal-overlay.active { display: flex; }',
  '  .modal {',
  '    background: #161e2c;',
  '    border-radius: 24px;',
  '    max-width: 800px;',
  '    width: 100%;',
  '    max-height: 85vh;',
  '    padding: 24px 28px;',
  '    border: 1px solid #33405a;',
  '    box-shadow: 0 30px 80px rgba(0,0,0,0.8);',
  '    display: flex;',
  '    flex-direction: column;',
  '  }',
  '  .modal-header {',
  '    display: flex;',
  '    justify-content: space-between;',
  '    align-items: center;',
  '    margin-bottom: 16px;',
  '  }',
  '  .modal-header h2 { font-size: 20px; }',
  '  .modal-close {',
  '    background: none;',
  '    border: none;',
  '    color: #aabbdd;',
  '    font-size: 28px;',
  '    cursor: pointer;',
  '  }',
  '  .modal-close:hover { color: white; }',
  '  .log-files-list {',
  '    display: flex;',
  '    gap: 10px;',
  '    flex-wrap: wrap;',
  '    margin-bottom: 16px;',
  '  }',
  '  .log-files-list .log-file-btn {',
  '    background: #1f2838;',
  '    border: 1px solid #33405a;',
  '    color: #c0d0e8;',
  '    padding: 6px 16px;',
  '    border-radius: 30px;',
  '    cursor: pointer;',
  '    font-size: 13px;',
  '    transition: 0.2s;',
  '  }',
  '  .log-files-list .log-file-btn:hover { background: #2a3650; }',
  '  .log-files-list .log-file-btn.active {',
  '    background: #3a5a8a;',
  '    border-color: #5a7cff;',
  '  }',
  '  .log-content {',
  '    background: #0b111d;',
  '    border-radius: 14px;',
  '    padding: 16px;',
  '    font-family: "Consolas", monospace;',
  '    font-size: 12px;',
  '    white-space: pre-wrap;',
  '    word-break: break-word;',
  '    max-height: 400px;',
  '    overflow-y: auto;',
  '    border: 1px solid #283040;',
  '    color: #c8d8f0;',
  '    line-height: 1.7;',
  '  }',
  '  .log-content .log-line {',
  '    padding: 2px 0;',
  '    border-bottom: 1px solid #1a2436;',
  '  }',
  '  .log-content .log-line .time { color: #6a8aaa; }',
  '  .log-content .log-line .emoji { margin: 0 4px; }',
  '  .login-container {',
  '    max-width: 400px;',
  '    width: 100%;',
  '    background: #141922;',
  '    border-radius: 24px;',
  '    padding: 40px 30px;',
  '    border: 1px solid #2a303d;',
  '    text-align: center;',
  '  }',
  '  .login-container .logo { font-size: 48px; margin-bottom: 10px; }',
  '  .login-container h2 { margin-bottom: 24px; color: #eef2f9; }',
  '  .login-container input {',
  '    width: 100%;',
  '    padding: 12px 16px;',
  '    margin-bottom: 14px;',
  '    background: #0e131f;',
  '    border: 1px solid #2f384a;',
  '    border-radius: 12px;',
  '    color: white;',
  '    font-size: 14px;',
  '    direction: ltr;',
  '  }',
  '  .login-container input:focus {',
  '    outline: none;',
  '    border-color: #5a7cff;',
  '  }',
  '  .login-container .btn {',
  '    width: 100%;',
  '    justify-content: center;',
  '    padding: 12px;',
  '    font-size: 15px;',
  '    background: #3a5a8a;',
  '  }',
  '  .login-container .btn:hover { background: #4d72a8; }',
  '  .login-error {',
  '    color: #ff6b6b;',
  '    font-size: 13px;',
  '    margin-top: 10px;',
  '    min-height: 20px;',
  '  }',
  '</style>',
  '</head>',
  '<body>',
  '<!-- ===== واجهة تسجيل الدخول ===== -->',
  '<div id="loginScreen" class="login-container" style="display:none;">',
  '  <div class="logo">🔐</div>',
  '  <h2>تسجيل الدخول</h2>',
  '  <input type="email" id="loginEmail" placeholder="البريد الإلكتروني" dir="ltr" />',
  '  <input type="password" id="loginPassword" placeholder="كلمة المرور" dir="ltr" />',
  '  <button class="btn" id="loginBtn">دخول</button>',
  '  <div id="loginError" class="login-error"></div>',
  '</div>',
  '<!-- ===== الواجهة الرئيسية ===== -->',
  '<div id="mainApp" class="container" style="display:none;">',
  '  <div class="header">',
  '    <div class="logo-area">',
  '      <span class="logo-icon">⚙️</span>',
  '      <div class="logo-text">مدير <span>GitHub</span></div>',
  '    </div>',
  '    <div class="user-area">',
  '      <span class="user-email" id="userEmailDisplay">admin@example.com</span>',
  '      <button class="logout-btn" id="logoutBtn">🚪 خروج</button>',
  '    </div>',
  '  </div>',
  '  <div class="grid">',
  '    <div class="card">',
  '      <div class="card-header">',
  '        <span class="icon">💬</span>',
  '        <h2>الرسائل</h2>',
  '      </div>',
  '      <div class="card-hint">كل رسالة في سطر، تُحفظ كـ JSON array</div>',
  '      <textarea id="messagesArea" placeholder="اكتب رسالة في كل سطر..."></textarea>',
  '      <div class="btn-row">',
  '        <button class="btn btn-secondary" id="loadMessagesBtn">📥 تحميل</button>',
  '        <button class="btn btn-success" id="saveMessagesBtn">💾 حفظ</button>',
  '      </div>',
  '      <div class="status" id="messagesStatus"></div>',
  '    </div>',
  '    <div class="card">',
  '      <div class="card-header">',
  '        <span class="icon">📞</span>',
  '        <h2>جهات الاتصال</h2>',
  '      </div>',
  '      <div class="card-hint">كل رقم في سطر، يُحفظ كـ JSON array</div>',
  '      <textarea id="contactsArea" placeholder="اكتب رقم في كل سطر..."></textarea>',
  '      <div class="btn-row">',
  '        <button class="btn btn-secondary" id="loadContactsBtn">📥 تحميل</button>',
  '        <button class="btn btn-success" id="saveContactsBtn">💾 حفظ</button>',
  '      </div>',
  '      <div class="status" id="contactsStatus"></div>',
  '    </div>',
  '    <div class="card">',
  '      <div class="card-header">',
  '        <span class="icon">🖼️</span>',
  '        <h2>الصور</h2>',
  '      </div>',
  '      <div class="card-hint">اختر صورة أو أكثر، ستُرفع إلى مجلد <code>images/</code></div>',
  '      <div class="file-input-wrapper">',
  '        <input type="file" id="imagesInput" accept="image/*" multiple />',
  '        <button class="btn" id="uploadImagesBtn">⬆ رفع</button>',
  '      </div>',
  '      <div class="image-preview-area" id="imagePreviewArea"></div>',
  '      <div class="status" id="imagesStatus"></div>',
  '      <div class="file-list" id="imagesList"></div>',
  '    </div>',
  '    <div class="card">',
  '      <div class="card-header">',
  '        <span class="icon">📋</span>',
  '        <h2>سجلات التشغيل</h2>',
  '      </div>',
  '      <div class="card-hint">عرض سجلات الـ workflow من مجلد <code>logs/</code></div>',
  '      <div class="btn-row">',
  '        <button class="btn btn-secondary" id="viewLogsBtn">📂 عرض السجلات</button>',
  '        <button class="btn btn-outline" id="refreshLogsBtn">🔄 تحديث</button>',
  '      </div>',
  '      <div class="status" id="logsStatus"></div>',
  '    </div>',
  '  </div>',
  '  <div class="workflow-bar">',
  '    <div class="left">',
  '      <span class="icon">⚡</span>',
  '      <div>',
  '        <h3>GitHub Actions</h3>',
  '        <div class="hint">تشغيل الـ workflow يدوياً</div>',
  '      </div>',
  '    </div>',
  '    <div class="actions">',
  '      <button class="btn" id="runWorkflowBtn">▶ تشغيل</button>',
  '      <div class="status" id="workflowStatus" style="margin:0;"></div>',
  '    </div>',
  '  </div>',
  '</div>',
  '<!-- ===== مودال السجلات ===== -->',
  '<div class="modal-overlay" id="logsModal">',
  '  <div class="modal">',
  '    <div class="modal-header">',
  '      <h2>📋 سجلات التشغيل</h2>',
  '      <button class="modal-close" id="closeLogsModal">✕</button>',
  '    </div>',
  '    <div class="log-files-list" id="logFilesList"></div>',
  '    <div class="log-content" id="logContent">اختر ملف سجل من الأعلى لعرض محتواه...</div>',
  '  </div>',
  '</div>',
  '<script>',
  '// ===== متغيرات عامة =====',
  'let selectedLogFile = null;',
  '// ===== دوال المساعدة =====',
  'function setStatus(el, msg, type) {',
  '  el.textContent = msg;',
  '  el.className = "status" + (type ? " " + type : "");',
  '}',
  '// ===== المصادقة =====',
  'function checkAuth() {',
  '  const auth = sessionStorage.getItem("auth");',
  '  if (auth) {',
  '    try {',
  '      const data = JSON.parse(auth);',
  '      if (data.email && data.password) return data;',
  '    } catch(e) {}',
  '  }',
  '  return null;',
  '}',
  'function doLogin(email, password) {',
  '  sessionStorage.setItem("auth", JSON.stringify({ email, password }));',
  '  showApp();',
  '}',
  'function doLogout() {',
  '  sessionStorage.removeItem("auth");',
  '  showLogin();',
  '}',
  'function showLogin() {',
  '  document.getElementById("loginScreen").style.display = "block";',
  '  document.getElementById("mainApp").style.display = "none";',
  '  document.getElementById("loginError").textContent = "";',
  '}',
  'function showApp() {',
  '  const auth = checkAuth();',
  '  if (!auth) { showLogin(); return; }',
  '  document.getElementById("loginScreen").style.display = "none";',
  '  document.getElementById("mainApp").style.display = "block";',
  '  document.getElementById("userEmailDisplay").textContent = auth.email;',
  '}',
  'document.getElementById("loginBtn").onclick = function() {',
  '  const email = document.getElementById("loginEmail").value.trim();',
  '  const password = document.getElementById("loginPassword").value.trim();',
  '  if (!email || !password) {',
  '    document.getElementById("loginError").textContent = "الرجاء إدخال البريد وكلمة المرور";',
  '    return;',
  '  }',
  '  fetch("/api/auth", {',
  '    method: "POST",',
  '    headers: { "Content-Type": "application/json" },',
  '    body: JSON.stringify({ email, password })',
  '  })',
  '  .then(res => res.json())',
  '  .then(data => {',
  '    if (data.ok) { doLogin(email, password); }',
  '    else { document.getElementById("loginError").textContent = data.error || "بيانات غير صحيحة"; }',
  '  })',
  '  .catch(() => { document.getElementById("loginError").textContent = "خطأ في الاتصال"; });',
  '};',
  'document.getElementById("loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("loginBtn").click(); });',
  'document.getElementById("loginEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("loginBtn").click(); });',
  'document.getElementById("logoutBtn").onclick = doLogout;',
  'const auth = checkAuth();',
  'if (auth) { showApp(); } else { showLogin(); }',
  'function getHeaders() {',
  '  const auth = checkAuth();',
  '  return {',
  '    "Content-Type": "application/json",',
  '    "Authorization": "Basic " + btoa(auth.email + ":" + auth.password)',
  '  };',
  '}',
  'async function apiCall(url, options = {}) {',
  '  const headers = getHeaders();',
  '  const res = await fetch(url, {',
  '    ...options,',
  '    headers: { ...headers, ...(options.headers || {}) }',
  '  });',
  '  if (res.status === 401) { doLogout(); throw new Error("انتهت الجلسة، الرجاء تسجيل الدخول مجدداً"); }',
  '  return res;',
  '}',
  'async function loadFile(type, areaEl, statusEl) {',
  '  setStatus(statusEl, "جاري التحميل...", "");',
  '  try {',
  '    const res = await apiCall("/api/load?type=" + type);',
  '    const data = await res.json();',
  '    if (!data.ok) throw new Error(data.error || "خطأ غير معروف");',
  '    areaEl.value = data.text;',
  '    setStatus(statusEl, "تم التحميل ✓", "ok");',
  '  } catch (err) {',
  '    setStatus(statusEl, "خطأ: " + err.message, "err");',
  '  }',
  '}',
  'async function saveFile(type, areaEl, statusEl) {',
  '  setStatus(statusEl, "جاري الحفظ...", "");',
  '  try {',
  '    const res = await apiCall("/api/save", {',
  '      method: "POST",',
  '      body: JSON.stringify({ type, text: areaEl.value })',
  '    });',
  '    const data = await res.json();',
  '    if (!data.ok) throw new Error(data.error || "خطأ غير معروف");',
  '    setStatus(statusEl, "تم الحفظ ✓ (commit)", "ok");',
  '  } catch (err) {',
  '    setStatus(statusEl, "خطأ: " + err.message, "err");',
  '  }',
  '}',
  'document.getElementById("loadMessagesBtn").onclick = () => loadFile("messages", document.getElementById("messagesArea"), document.getElementById("messagesStatus"));',
  'document.getElementById("saveMessagesBtn").onclick = () => saveFile("messages", document.getElementById("messagesArea"), document.getElementById("messagesStatus"));',
  'document.getElementById("loadContactsBtn").onclick = () => loadFile("contacts", document.getElementById("contactsArea"), document.getElementById("contactsStatus"));',
  'document.getElementById("saveContactsBtn").onclick = () => saveFile("contacts", document.getElementById("contactsArea"), document.getElementById("contactsStatus"));',
  'const imagesInput = document.getElementById("imagesInput");',
  'const previewArea = document.getElementById("imagePreviewArea");',
  'let selectedFiles = [];',
  'imagesInput.addEventListener("change", function(e) {',
  '  selectedFiles = Array.from(this.files);',
  '  renderPreviews();',
  '});',
  'function renderPreviews() {',
  '  previewArea.innerHTML = "";',
  '  selectedFiles.forEach((file, index) => {',
  '    const reader = new FileReader();',
  '    reader.onload = function(ev) {',
  '      const div = document.createElement("div");',
  '      div.className = "image-preview-item";',
  '      div.innerHTML = "<img src=\\"" + ev.target.result + "\\" alt=\\"" + file.name + "\\" />" +',
  '                      "<span class=\\"file-name\\">" + file.name + "</span>" +',
  '                      "<button class=\\"remove-img\\" data-index=\\"" + index + "\\">✕</button>";',
  '      previewArea.appendChild(div);',
  '      div.querySelector(".remove-img").onclick = function() {',
  '        selectedFiles.splice(index, 1);',
  '        renderPreviews();',
  '        const dt = new DataTransfer();',
  '        selectedFiles.forEach(f => dt.items.add(f));',
  '        imagesInput.files = dt.files;',
  '      };',
  '    };',
  '    reader.readAsDataURL(file);',
  '  });',
  '}',
  'document.getElementById("uploadImagesBtn").onclick = async function() {',
  '  const files = selectedFiles;',
  '  if (!files || files.length === 0) {',
  '    setStatus(document.getElementById("imagesStatus"), "اختر صورة أولاً", "err");',
  '    return;',
  '  }',
  '  const listEl = document.getElementById("imagesList");',
  '  listEl.innerHTML = "";',
  '  setStatus(document.getElementById("imagesStatus"), "جاري رفع " + files.length + " صورة...", "");',
  '  let success = 0;',
  '  for (const file of files) {',
  '    const line = document.createElement("div");',
  '    line.textContent = file.name + " ...";',
  '    listEl.appendChild(line);',
  '    try {',
  '      const base64 = await fileToBase64(file);',
  '      const res = await apiCall("/api/upload-image", {',
  '        method: "POST",',
  '        body: JSON.stringify({ filename: file.name, dataBase64: base64 })',
  '      });',
  '      const data = await res.json();',
  '      if (!data.ok) throw new Error(data.error || "خطأ");',
  '      line.textContent = "✓ " + file.name + " -> " + data.path;',
  '      success++;',
  '    } catch (err) {',
  '      line.textContent = "✘ " + file.name + " : " + err.message;',
  '    }',
  '  }',
  '  setStatus(document.getElementById("imagesStatus"), success + "/" + files.length + " صورة تم رفعها", success === files.length ? "ok" : "err");',
  '  if (success === files.length) {',
  '    selectedFiles = [];',
  '    imagesInput.value = "";',
  '    renderPreviews();',
  '  }',
  '};',
  'function fileToBase64(file) {',
  '  return new Promise((resolve, reject) => {',
  '    const reader = new FileReader();',
  '    reader.onload = () => resolve(reader.result.split(",")[1]);',
  '    reader.onerror = reject;',
  '    reader.readAsDataURL(file);',
  '  });',
  '}',
  'document.getElementById("runWorkflowBtn").onclick = async function() {',
  '  const statusEl = document.getElementById("workflowStatus");',
  '  setStatus(statusEl, "جاري التشغيل...", "");',
  '  try {',
  '    const res = await apiCall("/api/run-workflow", { method: "POST" });',
  '    const data = await res.json();',
  '    if (!data.ok) throw new Error(data.error || "خطأ غير معروف");',
  '    setStatus(statusEl, "تم التشغيل ✓", "ok");',
  '  } catch (err) {',
  '    setStatus(statusEl, "خطأ: " + err.message, "err");',
  '  }',
  '};',
  'const logsModal = document.getElementById("logsModal");',
  'const logFilesList = document.getElementById("logFilesList");',
  'const logContent = document.getElementById("logContent");',
  'document.getElementById("viewLogsBtn").onclick = function() {',
  '  logsModal.classList.add("active");',
  '  loadLogFiles();',
  '};',
  'document.getElementById("closeLogsModal").onclick = function() {',
  '  logsModal.classList.remove("active");',
  '};',
  'document.getElementById("refreshLogsBtn").onclick = function() {',
  '  loadLogFiles();',
  '};',
  'logsModal.addEventListener("click", function(e) {',
  '  if (e.target === this) this.classList.remove("active");',
  '});',
  'async function loadLogFiles() {',
  '  setStatus(document.getElementById("logsStatus"), "جاري تحميل السجلات...", "");',
  '  try {',
  '    const res = await apiCall("/api/logs");',
  '    const data = await res.json();',
  '    if (!data.ok) throw new Error(data.error || "خطأ");',
  '    logFilesList.innerHTML = "";',
  '    data.files.forEach(file => {',
  '      const btn = document.createElement("button");',
  '      btn.className = "log-file-btn";',
  '      btn.textContent = file.name;',
  '      btn.onclick = () => loadLogContent(file.name);',
  '      logFilesList.appendChild(btn);',
  '    });',
  '    if (data.files.length === 0) {',
  '      logFilesList.innerHTML = "<span style=\\"color:#8899bb;\\">لا توجد سجلات</span>";',
  '      logContent.textContent = "لا توجد ملفات سجل.";',
  '    }',
  '    setStatus(document.getElementById("logsStatus"), "✓ تم التحميل", "ok");',
  '  } catch (err) {',
  '    setStatus(document.getElementById("logsStatus"), "خطأ: " + err.message, "err");',
  '  }',
  '}',
  'async function loadLogContent(filename) {',
  '  logContent.textContent = "جاري التحميل...";',
  '  try {',
  '    const res = await apiCall("/api/log-content?file=" + encodeURIComponent(filename));',
  '    const data = await res.json();',
  '    if (!data.ok) throw new Error(data.error || "خطأ");',
  '    const lines = data.content.split("\\n").filter(l => l.trim());',
  '    let html = "";',
  '    lines.forEach(line => {',
  '      let color = "#c8d8f0";',
  '      if (line.includes("🚀")) color = "#6ac8ff";',
  '      else if (line.includes("✅")) color = "#4cdb8c";',
  '      else if (line.includes("⏳")) color = "#f0c060";',
  '      else if (line.includes("❌") || line.includes("خطأ")) color = "#ff6b6b";',
  '      else if (line.includes("📌")) color = "#b090d0";',
  '      html += "<div class=\\"log-line\\" style=\\"color:" + color + "\\">" + line + "</div>";',
  '    });',
  '    logContent.innerHTML = html || "المحتوى فارغ";',
  '  } catch (err) {',
  '    logContent.textContent = "خطأ: " + err.message;',
  '  }',
  '}',
  'document.addEventListener("keydown", function(e) {',
  '  if (e.key === "Escape") { logsModal.classList.remove("active"); }',
  '});',
  '</script>',
  '</body>',
  '</html>'
].join("\n");

// ========== معالج الـ Worker الرئيسي ==========
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // مسار المصادقة (غير محمي)
    if (url.pathname === "/api/auth" && request.method === "POST") {
      try {
        const { email, password } = await request.json();
        if (email === env.ADMIN_EMAIL && password === env.ADMIN_PASSWORD) {
          return jsonResponse({ ok: true });
        }
        return jsonResponse({ ok: false, error: "بيانات غير صحيحة" }, 401);
      } catch {
        return jsonResponse({ ok: false, error: "طلب غير صحيح" }, 400);
      }
    }

    // التحقق من المصادقة لباقي الطلبات
    const authHeader = request.headers.get("Authorization");
    let isAuthenticated = false;
    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const base64 = authHeader.split(" ")[1];
        const [email, password] = atob(base64).split(":");
        if (email === env.ADMIN_EMAIL && password === env.ADMIN_PASSWORD) {
          isAuthenticated = true;
        }
      } catch(e) {}
    }

    if (!isAuthenticated && url.pathname !== "/api/auth") {
      return new Response(HTML_PAGE, {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ===== المسارات المحمية =====
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

    if (url.pathname === "/api/upload-image" && request.method === "POST") {
      return handleUploadImage(request, env);
    }

    if (url.pathname === "/api/logs" && request.method === "GET") {
      return handleGetLogs(request, env);
    }

    if (url.pathname === "/api/log-content" && request.method === "GET") {
      return handleGetLogContent(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
