import { 
  githubGetFile, githubPutFile, githubRunWorkflow, githubListFiles, 
  githubGetFileRaw, githubPutFileBase64, githubDeleteFile 
} from './github.js';
import { jsonResponse, getPath, getImagesDir, linesToJsonArray, jsonToLines } from './helpers.js';
import { handleLoadSchedule, handleSaveSchedule } from './schedule.js';

export async function handleLoad(request, env) {
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "messages" && type !== "contacts") return jsonResponse({ error: "type must be messages or contacts" }, 400);
  try {
    const { content } = await githubGetFile(env, getPath(env, type));
    return jsonResponse({ ok: true, text: jsonToLines(content) });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleSave(request, env) {
  try {
    const { type, text } = await request.json();
    if (type !== "messages" && type !== "contacts") return jsonResponse({ error: "type must be messages or contacts" }, 400);
    const path = getPath(env, type);
    const current = await githubGetFile(env, path);
    const result = await githubPutFile(env, path, linesToJsonArray(text || ""), current.sha, "Update " + path);
    return jsonResponse({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

// تعديل دالة run workflow لتعيد run_id
export async function handleRunWorkflow(request, env) {
  try {
    // تشغيل الـ workflow
    await githubRunWorkflow(env);
    // بعد التشغيل، نجلب أحدث تشغيل للحصول على run_id
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;
    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`;
    const res = await fetch(runsUrl, {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json" }
    });
    if (!res.ok) throw new Error("Failed to fetch runs");
    const data = await res.json();
    const runs = data.workflow_runs || [];
    if (runs.length === 0) throw new Error("No runs found");
    const runId = runs[0].id;
    return jsonResponse({ ok: true, run_id: runId });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// دالة جديدة لجلب سجلات تشغيل معين
export async function handleWorkflowLogs(request, env) {
  try {
    const url = new URL(request.url);
    const runId = url.searchParams.get("run_id");
    if (!runId) return jsonResponse({ ok: false, error: "Missing run_id" }, 400);
    
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const token = env.GITHUB_TOKEN;
    
    // جلب السجلات النصية (محاولة 1)
    const logsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/attempts/1/logs`;
    const res = await fetch(logsUrl, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.status === 404) {
      // قد يكون التشغيل لم يبدأ بعد
      return jsonResponse({ ok: true, logs: "", status: "pending" });
    }
    if (!res.ok) throw new Error(`Logs fetch error: ${res.status}`);
    const text = await res.text();
    return jsonResponse({ ok: true, logs: text, status: "running" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

export async function handleUploadImage(request, env) {
  try {
    const { filename, dataBase64 } = await request.json();
    if (!filename || !dataBase64) return jsonResponse({ ok: false, error: "filename and dataBase64 are required" }, 400);
    
    const { files } = await githubListFiles(env, getImagesDir(env));
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    const currentImages = files.filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return imageExtensions.includes(ext);
    });
    
    if (currentImages.length >= 3) {
      return jsonResponse({ ok: false, error: "لا يمكن رفع أكثر من 3 صور. قم بحذف بعض الصور أولاً." }, 400);
    }
    
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = getImagesDir(env) + "/" + Date.now() + "_" + safeName;
    const existing = await githubGetFileRaw(env, path);
    const result = await githubPutFileBase64(env, path, dataBase64, existing.sha, "Add image " + safeName);
    return jsonResponse({ ok: true, path, commit: result.commit && result.commit.sha });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleGetLogs(request, env) {
  try {
    const { files } = await githubListFiles(env, "logs");
    return jsonResponse({ ok: true, files });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleGetLogContent(request, env) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get("file");
    if (!filename) return jsonResponse({ ok: false, error: "Missing file parameter" }, 400);
    const { content } = await githubGetFile(env, "logs/" + filename);
    return jsonResponse({ ok: true, content });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleGetStats(request, env) {
  try {
    const { content, exists } = await githubGetFile(env, "aggregate.json");
    if (!exists || !content) return jsonResponse({ ok: true, data: [] });
    try {
      const data = JSON.parse(content);
      return jsonResponse({ ok: true, data: Array.isArray(data) ? data : [] });
    } catch (e) { return jsonResponse({ ok: false, error: "Invalid JSON format" }, 500); }
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleListImages(request, env) {
  try {
    const { files } = await githubListFiles(env, getImagesDir(env));
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    const imageFiles = files.filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return imageExtensions.includes(ext);
    });
    return jsonResponse({ ok: true, files: imageFiles });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleDeleteImage(request, env) {
  try {
    const { filename, sha } = await request.json();
    if (!filename || !sha) return jsonResponse({ ok: false, error: "filename and sha are required" }, 400);
    const path = getImagesDir(env) + "/" + filename;
    await githubDeleteFile(env, path, sha, "Delete image " + filename);
    return jsonResponse({ ok: true });
  } catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export { handleLoadSchedule, handleSaveSchedule };
