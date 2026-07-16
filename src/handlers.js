// src/handlers.js
import { githubGetFile, githubPutFile, githubRunWorkflow, githubListFiles, githubGetFileRaw, githubPutFileBase64 } from './github.js';
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

export async function handleRunWorkflow(request, env) {
  try { await githubRunWorkflow(env); return jsonResponse({ ok: true }); }
  catch (err) { return jsonResponse({ ok: false, error: String(err.message || err) }, 500); }
}

export async function handleUploadImage(request, env) {
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

// إعادة تصدير معالجات الجدولة لتكون متاحة للاستيراد من worker.js
export { handleLoadSchedule, handleSaveSchedule };
