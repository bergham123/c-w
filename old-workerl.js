/**
 * Cloudflare Worker - GitHub Manager Pro (معدل)
 * - تم إصلاح دوال قراءة وكتابة cron لتكون أكثر مرونة
 * - زر "تحديث" يستخدم القيم المدخلة ويعدل/يضيف cron
 * - زر "تحميل حالي" يعرض الوقت الحالي بشكل صحيح
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
  if (res.status === 404) return { content: null, sha: null, exists: false };
  if (!res.ok) throw new Error("GitHub GET error " + res.status + ": " + await res.text());
  const data = await res.json();
  return { content: base64ToUtf8(data.content), sha: data.sha, exists: true };
}

async function githubGetFileRaw(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return { sha: null, exists: false };
  if (!res.ok) throw new Error("GitHub GET error " + res.status + ": " + await res.text());
  const data = await res.json();
  return { sha: data.sha, exists: true, contentBase64: data.content };
}

async function githubPutFile(env, path, contentStr, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = { message: message || "Update " + path, content: utf8ToBase64(contentStr), branch: branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("GitHub PUT error " + res.status + ": " + await res.text());
  return await res.json();
}

async function githubPutFileBase64(env, path, base64Content, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = { message: message || "Add " + path, content: base64Content, branch: branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("GitHub PUT error " + res.status + ": " + await res.text());
  return await res.json();
}

async function githubRunWorkflow(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const workflowFile = env.WORKFLOW_FILE;
  if (!workflowFile) throw new Error("WORKFLOW_FILE env var is not set");
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/actions/workflows/" + encodeURIComponent(workflowFile) + "/dispatches";
  const res = await fetch(url, { method: "POST", headers: ghHeaders(env), body: JSON.stringify({ ref: branch }) });
  if (res.status !== 204) throw new Error("GitHub workflow dispatch error " + res.status + ": " + await res.text());
  return true;
}

async function githubListFiles(env, folder) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(folder) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return { files: [], exists: false };
  if (!res.ok) throw new Error("GitHub list error " + res.status + ": " + await res.text());
  const data = await res.json();
  const files = data.filter(item => item.type === "file" && item.name.endsWith(".log")).map(item => ({ name: item.name, path: item.path, sha: item.sha, size: item.size, download_url: item.download_url }));
  return { files, exists: true };
}

async function handleGetLogs(request, env) {
  try {
    const { files } = await githubListFiles(env, "logs");
    return jsonResponse({ ok: true, files });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

async function handleGetLogContent(request, env) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get("file");
    if (!filename) return jsonResponse({ ok: false, error: "Missing file parameter" }, 400);
    const { content } = await githubGetFile(env, "logs/" + filename);
    return jsonResponse({ ok: true, content });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

// ========== دوال الجدولة المعدلة ==========
function extractCron(yamlText) {
  if (!yamlText) return null;
  // البحث عن cron: متبوعاً بقيمة بين تنصيص مفردة أو مزدوجة أو بدون تنصيص
  // السماح بمسافات قبل وبعد النقطتين
  const match = yamlText.match(/cron\s*:\s*['"]?([^'"\n]+)['"]?/);
  return match ? match[1].trim() : null;
}

function hasSchedule(yamlText) {
  if (!yamlText) return false;
  // نبحث عن سطر يبدأ بمسافات ثم "schedule:" (للتأكد من أنها ليست في تعليق أو كلمة أخرى)
  return /^\s*schedule:/m.test(yamlText);
}

function setCron(yamlText, newCron) {
  // إذا كان الملف فارغاً أو لا يحتوي على on: نضيف هيكلاً كاملاً
  if (!yamlText || yamlText.trim() === "") {
    return "on:\n  schedule:\n    - cron: '" + newCron + "'\n  workflow_dispatch:";
  }

  // البحث عن سطر on:
  const lines = yamlText.split("\n");
  let onIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*on:/.test(lines[i])) { onIndex = i; break; }
  }

  // إذا لم نجد on: نضيفها في البداية
  if (onIndex === -1) {
    return "on:\n  schedule:\n    - cron: '" + newCron + "'\n  workflow_dispatch:\n" + yamlText;
  }

  // التحقق من وجود schedule:
  if (hasSchedule(yamlText)) {
    // البحث عن سطر cron: واستبداله
    const cronRegex = /(cron\s*:\s*)['"]?([^'"\n]*)['"]?/;
    if (cronRegex.test(yamlText)) {
      // استبدال أول cron يظهر بعد schedule (نستبدل كل المطابقات؟ نفضل استبدال الأول)
      return yamlText.replace(cronRegex, "$1'" + newCron + "'");
    } else {
      // يوجد schedule: لكن لا يوجد cron: -> نضيف سطر cron تحت schedule
      // نبحث عن موضع schedule: ونضيف بعدها سطر جديد
      const scheduleIndex = lines.findIndex(line => /^\s*schedule:/.test(line));
      if (scheduleIndex !== -1) {
        // نضيف سطر cron بعد سطر schedule مباشرة (مع مسافة بادئة أكبر)
        lines.splice(scheduleIndex + 1, 0, "    - cron: '" + newCron + "'");
        return lines.join("\n");
      }
      // إذا لم نجد schedule رغم أن hasSchedule قال true (تناقض) نضيفها
      // لكننا سنضيفها مع on:
      return yamlText.replace(/on:/, "on:\n  schedule:\n    - cron: '" + newCron + "'");
    }
  } else {
    // لا يوجد schedule: نضيفها تحت on: مباشرة
    // نبحث عن السطر الذي يلي on: ونضيف بعدها
    const afterOn = lines.slice(onIndex + 1);
    // نجد أول سطر غير فارغ أو نهاية
    // نضيف في السطر التالي بعد on: مع مسافة بادئة
    const indent = "  "; // مسافتين
    const newLines = [
      ...lines.slice(0, onIndex + 1),
      indent + "schedule:",
      indent + "  - cron: '" + newCron + "'",
      ...afterOn
    ];
    return newLines.join("\n");
  }
}

async function handleLoadSchedule(request, env) {
  try {
    const { content, exists } = await githubGetFile(env, getWorkflowPath(env));
    if (!exists || !content) return jsonResponse({ ok: true, cron: null, hasSchedule: false });
    const cron = extractCron(content);
    const hasSched = hasSchedule(content);
    return jsonResponse({ ok: true, cron: cron, hasSchedule: hasSched });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

async function handleSaveSchedule(request, env) {
  try {
    const body = await request.json();
    const { action, cron } = body;
    const path = getWorkflowPath(env);
    const current = await githubGetFile(env, path);
    let yamlContent = current.content || "";
    
    if (action === 'remove') {
      // إذا أردنا حذف الجدولة (لكننا أزلنا الزر) لكن نتركها للتوافق
      // يمكن تنفيذها إذا أردنا لاحقاً
      // لكننا لن نستخدمها حالياً
      return jsonResponse({ ok: false, error: "Remove action not supported" }, 400);
    } else if (action === 'add' || action === 'update') {
      if (!cron || !/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(cron)) {
        return jsonResponse({ ok: false, error: "cron must have 5 space-separated fields" }, 400);
      }
      yamlContent = setCron(yamlContent, cron);
    } else {
      return jsonResponse({ ok: false, error: "Invalid action" }, 400);
    }
    
    const result = await githubPutFile(env, path, yamlContent, current.sha, "Update schedule via web editor");
    return jsonResponse({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

async function handleGetStats(request, env) {
  try {
    const { content, exists } = await githubGetFile(env, "aggregate.json");
    if (!exists || !content) return jsonResponse({ ok: true, data: [] });
    try {
      const data = JSON.parse(content);
      return jsonResponse({ ok: true, data: Array.isArray(data) ? data : [] });
    } catch (e) { return jsonResponse({ ok: false, error: "Invalid JSON format" }, 500); }
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

function linesToJsonArray(text) {
  return JSON.stringify(text.split("\n").map(l => l.trim()).filter(l => l.length > 0), null, 2);
}

function jsonToLines(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
    return JSON.stringify(parsed, null, 2);
  } catch (e) { return jsonStr; }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

async function handleLoad(request, env) {
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "messages" && type !== "contacts") return jsonResponse({ error: "type must be messages or contacts" }, 400);
  try {
    const { content } = await githubGetFile(env, getPath(env, type));
    return jsonResponse({ ok: true, text: jsonToLines(content) });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

async function handleSave(request, env) {
  try {
    const { type, text } = await request.json();
    if (type !== "messages" && type !== "contacts") return jsonResponse({ error: "type must be messages or contacts" }, 400);
    const path = getPath(env, type);
    const current = await githubGetFile(env, path);
    const result = await githubPutFile(env, path, linesToJsonArray(text || ""), current.sha, "Update " + path);
    return jsonResponse({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

async function handleRunWorkflow(request, env) {
  try { await githubRunWorkflow(env); return jsonResponse({ ok: true }); }
  catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

async function handleUploadImage(request, env) {
  try {
    const { filename, dataBase64 } = await request.json();
    if (!filename || !dataBase64) return jsonResponse({ ok: false, error: "filename and dataBase64 are required" }, 400);
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = getImagesDir(env) + "/" + Date.now() + "_" + safeName;
    const existing = await githubGetFileRaw(env, path);
    const result = await githubPutFileBase64(env, path, dataBase64, existing.sha, "Add image " + safeName);
    return jsonResponse({ ok: true, path, commit: result.commit && result.commit.sha });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

// ========== HTML (نفسه مع أزرار محدثة) ==========
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GitHub Manager Pro</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  /* نفس الستايلات السابقة، لا تغيير */
  :root {
    --bg-main: #0f172a;
    --card-bg: rgba(30, 41, 59, 0.7);
    --border-color: rgba(255, 255, 255, 0.1);
    --text-main: #f1f5f9;
    --text-muted: #94a3b8;
    --accent: #8b5cf6;
    --accent-glow: rgba(139, 92, 246, 0.4);
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', sans-serif;
    background: var(--bg-main);
    background-image: 
      radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
      radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 40%);
    color: var(--text-main);
    min-height: 100vh;
    padding: 20px;
  }
  .container {
    max-width: 1200px;
    margin: auto;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    padding: 30px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
  }
  .logo-area { display: flex; align-items: center; gap: 15px; }
  .logo-icon {
    width: 50px; height: 50px;
    background: linear-gradient(135deg, var(--accent), #3b82f6);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; color: white;
    box-shadow: 0 8px 20px var(--accent-glow);
  }
  .logo-text { font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
  .logo-text span { background: linear-gradient(to right, var(--accent), #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
  
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 24px;
    transition: all 0.3s ease;
  }
  .card:hover { border-color: rgba(139, 92, 246, 0.4); box-shadow: 0 0 25px rgba(139, 92, 246, 0.1); }
  .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .card-header i { font-size: 20px; color: var(--accent); }
  .card-header h2 { font-size: 18px; font-weight: 700; }
  .card-hint { color: var(--text-muted); font-size: 13px; margin-bottom: 16px; }
  
  textarea {
    width: 100%;
    min-height: 160px;
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 12px;
    font-family: 'Consolas', monospace;
    font-size: 13px;
    resize: vertical;
    direction: ltr; text-align: left;
  }
  textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  
  .btn-row { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .btn {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: 10px 20px;
    border-radius: 10px;
    cursor: pointer;
    font-family: 'Tajawal', sans-serif;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .btn:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-2px); }
  .btn-primary { background: linear-gradient(135deg, var(--accent), #6366f1); border: none; box-shadow: 0 4px 15px var(--accent-glow); }
  .btn-primary:hover { box-shadow: 0 6px 20px var(--accent-glow); }
  .btn-success { background: linear-gradient(135deg, var(--success), #059669); border: none; }
  .btn-danger { background: linear-gradient(135deg, var(--danger), #dc2626); border: none; }
  .btn-warning { background: linear-gradient(135deg, var(--warning), #d97706); border: none; }
  
  .status { margin-top: 10px; font-size: 12px; min-height: 18px; color: var(--text-muted); }
  .status.ok { color: var(--success); }
  .status.err { color: var(--danger); }

  .schedule-status { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .schedule-status.active { background: rgba(16, 185, 129, 0.2); color: var(--success); border: 1px solid var(--success); }
  .schedule-status.inactive { background: rgba(239, 68, 68, 0.2); color: var(--danger); border: 1px solid var(--danger); }
  
  .schedule-inputs { display: flex; gap: 12px; margin-bottom: 16px; }
  .schedule-inputs label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: var(--text-muted); }
  .schedule-inputs input {
    width: 80px; background: rgba(15, 23, 42, 0.8); color: var(--text-main);
    border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; text-align: center;
    font-family: 'Tajawal'; font-size: 16px;
  }

  .stats-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
  .stats-table th { text-align: right; padding: 10px; background: rgba(255,255,255,0.03); color: var(--text-muted); border-bottom: 1px solid var(--border-color); }
  .stats-table td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  
  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
    z-index: 999; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: rgba(30, 41, 59, 0.95); border: 1px solid var(--border-color);
    border-radius: 20px; max-width: 900px; width: 100%; max-height: 80vh;
    padding: 24px; display: flex; flex-direction: column; gap: 16px;
  }
  .log-files-list { display: flex; gap: 10px; flex-wrap: wrap; }
  .log-file-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 20px; cursor: pointer; }
  .log-file-btn.active { background: var(--accent); border-color: var(--accent); }
  .log-content { background: #0f172a; border-radius: 12px; padding: 16px; overflow-y: auto; font-family: monospace; font-size: 13px; flex-grow: 1; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo-area">
      <div class="logo-icon"><i class="fas fa-cogs"></i></div>
      <div class="logo-text">مدير <span>GitHub</span> برو</div>
    </div>
  </div>
  
  <div class="grid">
    <!-- الرسائل -->
    <div class="card">
      <div class="card-header"><i class="fas fa-comment-dots"></i><h2>الرسائل</h2></div>
      <div class="card-hint">كل رسالة في سطر، تُحفظ كـ JSON array</div>
      <textarea id="messagesArea" placeholder="اكتب رسالة في كل سطر..."></textarea>
      <div class="btn-row">
        <button class="btn" id="loadMessagesBtn"><i class="fas fa-download"></i> تحميل</button>
        <button class="btn btn-primary" id="saveMessagesBtn"><i class="fas fa-save"></i> حفظ</button>
      </div>
      <div class="status" id="messagesStatus"></div>
    </div>

    <!-- جهات الاتصال -->
    <div class="card">
      <div class="card-header"><i class="fas fa-address-book"></i><h2>جهات الاتصال</h2></div>
      <div class="card-hint">كل رقم في سطر، يُحفظ كـ JSON array</div>
      <textarea id="contactsArea" placeholder="اكتب رقم في كل سطر..."></textarea>
      <div class="btn-row">
        <button class="btn" id="loadContactsBtn"><i class="fas fa-download"></i> تحميل</button>
        <button class="btn btn-primary" id="saveContactsBtn"><i class="fas fa-save"></i> حفظ</button>
      </div>
      <div class="status" id="contactsStatus"></div>
    </div>

    <!-- الجدولة (زرين فقط) -->
    <div class="card">
      <div class="card-header"><i class="fas fa-clock"></i><h2>توقيت التشغيل التلقائي</h2></div>
      <div class="card-hint">تعديل جدولة الـ workflow (Cron)</div>
      <div style="margin-bottom: 15px;">
        <span class="schedule-status inactive" id="scheduleIndicator">غير مفعل</span>
        <span id="currentCronDisplay" style="font-size:12px;color:var(--text-muted);margin-right:10px;"></span>
      </div>
      <div class="schedule-inputs">
        <label>الساعة (0-23)<input type="number" id="hourInput" min="0" max="23" value="10" /></label>
        <label>الدقيقة (0-59)<input type="number" id="minuteInput" min="0" max="59" value="0" /></label>
      </div>
      <div class="btn-row">
        <button class="btn" id="loadScheduleBtn"><i class="fas fa-history"></i> تحميل حالي</button>
        <button class="btn btn-warning" id="updateScheduleBtn"><i class="fas fa-sync-alt"></i> تحديث</button>
      </div>
      <div class="status" id="scheduleStatus"></div>
    </div>

    <!-- الصور -->
    <div class="card">
      <div class="card-header"><i class="fas fa-images"></i><h2>رفع الصور</h2></div>
      <div class="card-hint">ستُرفع إلى مجلد <code>images/</code></div>
      <div style="background: rgba(15, 23, 42, 0.8); padding: 15px; border-radius: 12px; border: 1px dashed var(--border-color);">
        <input type="file" id="imagesInput" accept="image/*" multiple style="width:100%; margin-bottom: 10px;" />
        <div id="imagePreviewArea" style="display:flex; flex-wrap:wrap; gap:10px;"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="uploadImagesBtn"><i class="fas fa-upload"></i> رفع الصور</button>
      </div>
      <div class="file-list" id="imagesList" style="margin-top:10px; font-size:12px; color:var(--text-muted);"></div>
      <div class="status" id="imagesStatus"></div>
    </div>
  </div>

  <!-- الإحصائيات والرسوم البيانية -->
  <div class="card" style="margin-top: 24px;">
    <div class="card-header"><i class="fas fa-chart-line"></i><h2>إحصائيات الإرسال</h2></div>
    <div class="card-hint">عرض تقرير المحاولات والنجاح والفشل مع رسم بياني تفاعلي</div>
    <button class="btn btn-primary" id="loadStatsBtn"><i class="fas fa-database"></i> تحميل الإحصائيات</button>
    
    <div id="statsContainer" style="display:none; margin-top: 20px;">
      <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
        <table class="stats-table">
          <thead><tr><th>التاريخ</th><th>محاولات</th><th>نجاح</th><th>فشل</th></tr></thead>
          <tbody id="statsBody"></tbody>
        </table>
      </div>
      <div style="background: rgba(15, 23, 42, 0.8); border-radius: 12px; padding: 20px; height: 350px;">
        <canvas id="statsChart"></canvas>
      </div>
    </div>
    <div class="status" id="statsStatus"></div>
  </div>

  <!-- السجلات والتشغيل -->
  <div class="grid" style="margin-top: 24px; grid-template-columns: 2fr 1fr;">
    <div class="card">
      <div class="card-header"><i class="fas fa-terminal"></i><h2>سجلات التشغيل</h2></div>
      <div class="btn-row">
        <button class="btn" id="viewLogsBtn"><i class="fas fa-folder-open"></i> عرض السجلات</button>
      </div>
      <div class="status" id="logsStatus"></div>
    </div>
    <div class="card" style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <div class="card-header" style="margin-bottom: 15px;"><i class="fas fa-bolt"></i><h2>تشغيل يدوي</h2></div>
      <button class="btn btn-primary" id="runWorkflowBtn" style="width: 100%; justify-content: center; padding: 15px;"><i class="fas fa-play"></i> تشغيل الـ Workflow</button>
      <div class="status" id="workflowStatus" style="text-align: center;"></div>
    </div>
  </div>
</div>

<!-- مودال السجلات -->
<div class="modal-overlay" id="logsModal">
  <div class="modal">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2 style="color: var(--accent);"><i class="fas fa-clipboard-list"></i> السجلات</h2>
      <button class="btn" id="closeLogsModal"><i class="fas fa-times"></i></button>
    </div>
    <div class="log-files-list" id="logFilesList"></div>
    <div class="log-content" id="logContent">اختر ملف سجل لعرض محتواه...</div>
  </div>
</div>

<script>
// ===== Helpers =====
function setStatus(el, msg, type) { el.textContent = msg; el.className = "status" + (type ? " " + type : ""); }

// ===== Messages & Contacts =====
async function loadFile(type, areaEl, statusEl) {
  setStatus(statusEl, "جاري التحميل...", "");
  try {
    const res = await fetch("/api/load?type=" + type);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    areaEl.value = data.text;
    setStatus(statusEl, "تم التحميل ✓", "ok");
  } catch (err) { setStatus(statusEl, "خطأ: " + err.message, "err"); }
}
async function saveFile(type, areaEl, statusEl) {
  setStatus(statusEl, "جاري الحفظ...", "");
  try {
    const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, text: areaEl.value }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    setStatus(statusEl, "تم الحفظ ✓", "ok");
  } catch (err) { setStatus(statusEl, "خطأ: " + err.message, "err"); }
}
document.getElementById("loadMessagesBtn").onclick = () => loadFile("messages", document.getElementById("messagesArea"), document.getElementById("messagesStatus"));
document.getElementById("saveMessagesBtn").onclick = () => saveFile("messages", document.getElementById("messagesArea"), document.getElementById("messagesStatus"));
document.getElementById("loadContactsBtn").onclick = () => loadFile("contacts", document.getElementById("contactsArea"), document.getElementById("contactsStatus"));
document.getElementById("saveContactsBtn").onclick = () => saveFile("contacts", document.getElementById("contactsArea"), document.getElementById("contactsStatus"));

// ===== Images =====
const imagesInput = document.getElementById("imagesInput");
const previewArea = document.getElementById("imagePreviewArea");
let selectedFiles = [];
imagesInput.addEventListener("change", function(e) {
  selectedFiles = Array.from(this.files);
  renderPreviews();
});
function renderPreviews() {
  previewArea.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      const div = document.createElement("div");
      div.style.cssText = "width:80px; height:80px; border-radius:10px; overflow:hidden; position:relative; border:2px solid var(--border-color);";
      div.innerHTML = '<img src="' + ev.target.result + '" style="width:100%; height:100%; object-fit:cover;" />' +
                      '<button data-index="' + index + '" style="position:absolute; top:2px; right:2px; background:var(--danger); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px;">X</button>';
      previewArea.appendChild(div);
      div.querySelector("button").onclick = function() {
        selectedFiles.splice(index, 1);
        renderPreviews();
      };
    };
    reader.readAsDataURL(file);
  });
}
document.getElementById("uploadImagesBtn").onclick = async function() {
  if (selectedFiles.length === 0) { setStatus(document.getElementById("imagesStatus"), "اختر صورة أولاً", "err"); return; }
  let success = 0;
  for (const file of selectedFiles) {
    try {
      const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.onerror = reject; r.readAsDataURL(file); });
      const res = await fetch("/api/upload-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, dataBase64: base64 }) });
      const data = await res.json();
      if (data.ok) success++;
    } catch (err) {}
  }
  setStatus(document.getElementById("imagesStatus"), success + "/" + selectedFiles.length + " تم رفعها", success === selectedFiles.length ? "ok" : "err");
  if (success === selectedFiles.length) { selectedFiles = []; imagesInput.value = ""; renderPreviews(); }
};

// ===== Workflow =====
document.getElementById("runWorkflowBtn").onclick = async function() {
  const st = document.getElementById("workflowStatus");
  setStatus(st, "جاري التشغيل...", "");
  try {
    const res = await fetch("/api/run-workflow", { method: "POST" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    setStatus(st, "تم التشغيل ✓", "ok");
  } catch (err) { setStatus(st, "خطأ: " + err.message, "err"); }
};

// ===== Logs =====
const logsModal = document.getElementById("logsModal");
document.getElementById("viewLogsBtn").onclick = async function() {
  logsModal.classList.add("active");
  const list = document.getElementById("logFilesList");
  list.innerHTML = "<span style='color:var(--text-muted)'>جاري التحميل...</span>";
  try {
    const res = await fetch("/api/logs");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    list.innerHTML = "";
    if (data.files.length === 0) { list.innerHTML = "<span style='color:var(--text-muted)'>لا توجد سجلات</span>"; return; }
    data.files.forEach(file => {
      const btn = document.createElement("button");
      btn.className = "log-file-btn";
      btn.textContent = file.name;
      btn.onclick = async () => {
        document.querySelectorAll(".log-file-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const contentEl = document.getElementById("logContent");
        contentEl.textContent = "جاري التحميل...";
        try {
          const r = await fetch("/api/log-content?file=" + encodeURIComponent(file.name));
          const d = await r.json();
          if (!d.ok) throw new Error(d.error);
          contentEl.textContent = d.content || " فارغ ";
        } catch (err) { contentEl.textContent = "خطأ: " + err.message; }
      };
      list.appendChild(btn);
    });
  } catch (err) { list.innerHTML = "<span style='color:var(--danger)'>خطأ: " + err.message + "</span>"; }
};
document.getElementById("closeLogsModal").onclick = () => logsModal.classList.remove("active");
logsModal.addEventListener("click", e => { if (e.target === logsModal) logsModal.classList.remove("active"); });

// ===== Schedule (زرين فقط) =====
const scheduleStatus = document.getElementById("scheduleStatus");
const hourInput = document.getElementById("hourInput");
const minuteInput = document.getElementById("minuteInput");

async function loadSchedule() {
  setStatus(scheduleStatus, "جاري التحميل...", "");
  try {
    const res = await fetch("/api/schedule");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const ind = document.getElementById("scheduleIndicator");
    const disp = document.getElementById("currentCronDisplay");
    if (data.hasSchedule && data.cron) {
      ind.textContent = "مفعل"; ind.className = "schedule-status active";
      disp.textContent = "التوقيت: " + data.cron;
      const parts = data.cron.trim().split(/\s+/);
      if (parts.length >= 2) { minuteInput.value = parts[0]; hourInput.value = parts[1]; }
      setStatus(scheduleStatus, "تم التحميل ✓", "ok");
    } else {
      ind.textContent = "غير مفعل"; ind.className = "schedule-status inactive";
      disp.textContent = "(لا توجد جدولة)";
      setStatus(scheduleStatus, "الجدولة غير مفعلة", "");
    }
  } catch (err) { setStatus(scheduleStatus, "خطأ: " + err.message, "err"); }
}

async function saveSchedule(cron) {
  setStatus(scheduleStatus, "جاري الحفظ...", "");
  try {
    const res = await fetch("/api/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", cron: cron })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    setStatus(scheduleStatus, "تم التحديث ✓ (" + cron + ")", "ok");
    loadSchedule();
  } catch (err) { setStatus(scheduleStatus, "خطأ: " + err.message, "err"); }
}

document.getElementById("loadScheduleBtn").onclick = loadSchedule;

document.getElementById("updateScheduleBtn").onclick = function() {
  const h = parseInt(hourInput.value, 10);
  const m = parseInt(minuteInput.value, 10);
  if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
    setStatus(scheduleStatus, "أدخل قيم صحيحة (0-23 ساعة، 0-59 دقيقة)", "err");
    return;
  }
  const cron = m + " " + h + " * * *";
  saveSchedule(cron);
};

loadSchedule(); // تحميل تلقائي عند بدء الصفحة

// ===== Statistics & Charts =====
let statsChartInstance = null;
document.getElementById("loadStatsBtn").onclick = async function() {
  const st = document.getElementById("statsStatus");
  setStatus(st, "جاري تحميل البيانات...", "");
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    if (data.data.length === 0) { setStatus(st, "لا توجد إحصائيات", "err"); return; }
    
    document.getElementById("statsContainer").style.display = "block";
    setStatus(st, "✓ تم التحميل", "ok");
    
    const tbody = document.getElementById("statsBody");
    tbody.innerHTML = "";
    let totalAtt = 0, totalSuc = 0, totalFail = 0;
    
    data.data.forEach(row => {
      totalAtt += row.attempted || 0;
      totalSuc += row.success || 0;
      totalFail += row.failed || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + row.date + "</td><td>" + (row.attempted||0) + "</td><td style='color:var(--success)'>" + (row.success||0) + "</td><td style='color:var(--danger)'>" + (row.failed||0) + "</td>";
      tbody.appendChild(tr);
    });
    
    const trTotal = document.createElement("tr");
    trTotal.style.fontWeight = "bold";
    trTotal.style.borderTop = "2px solid var(--accent)";
    trTotal.innerHTML = "<td>المجموع</td><td>" + totalAtt + "</td><td style='color:var(--success)'>" + totalSuc + "</td><td style='color:var(--danger)'>" + totalFail + "</td>";
    tbody.appendChild(trTotal);
    
    // Chart.js
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (statsChartInstance) statsChartInstance.destroy();
    
    statsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.data.map(r => r.date),
        datasets: [
          { label: 'محاولات', data: data.data.map(r => r.attempted||0), backgroundColor: 'rgba(139, 92, 246, 0.6)', borderColor: 'rgba(139, 92, 246, 1)', borderWidth: 1, borderRadius: 6 },
          { label: 'نجاح', data: data.data.map(r => r.success||0), backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1, borderRadius: 6 },
          { label: 'فشل', data: data.data.map(r => r.failed||0), backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 1, borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f1f5f9', font: { family: 'Tajawal', size: 14 } } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Tajawal' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8', font: { family: 'Tajawal' } }, grid: { display: false } }
        }
      }
    });
  } catch (err) { setStatus(st, "خطأ: " + err.message, "err"); }
};
</script>
</body>
</html>
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/api/load" && request.method === "GET") return handleLoad(request, env);
    if (url.pathname === "/api/save" && request.method === "POST") return handleSave(request, env);
    if (url.pathname === "/api/run-workflow" && request.method === "POST") return handleRunWorkflow(request, env);
    if (url.pathname === "/api/upload-image" && request.method === "POST") return handleUploadImage(request, env);
    if (url.pathname === "/api/logs" && request.method === "GET") return handleGetLogs(request, env);
    if (url.pathname === "/api/log-content" && request.method === "GET") return handleGetLogContent(request, env);
    if (url.pathname === "/api/schedule" && request.method === "GET") return handleLoadSchedule(request, env);
    if (url.pathname === "/api/schedule" && request.method === "POST") return handleSaveSchedule(request, env);
    if (url.pathname === "/api/stats" && request.method === "GET") return handleGetStats(request, env);

    return new Response("Not found", { status: 404 });
  },
};
