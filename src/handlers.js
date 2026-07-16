// src/handlers.js
import { 
  githubGetFile, githubPutFile, githubRunWorkflow, githubListFiles, 
  githubGetFileRaw, githubPutFileBase64, githubDeleteFile 
} from './github.js';
import { jsonResponse, getPath, getImagesDir, linesToJsonArray, jsonToLines } from './helpers.js';
import { handleLoadSchedule, handleSaveSchedule } from './schedule.js';

// ===== دوال موجودة سابقاً =====
export async function handleLoad(request, env) { ... } // نفس الكود
export async function handleSave(request, env) { ... } // نفس الكود
export async function handleRunWorkflow(request, env) { ... } // نفس الكود
export async function handleGetLogs(request, env) { ... } // نفس الكود
export async function handleGetLogContent(request, env) { ... } // نفس الكود
export async function handleGetStats(request, env) { ... } // نفس الكود

// ===== دالة رفع الصور المعدلة (ضعها هنا) =====
export async function handleUploadImage(request, env) {
  try {
    const { filename, dataBase64 } = await request.json();
    if (!filename || !dataBase64) return jsonResponse({ ok: false, error: "filename and dataBase64 are required" }, 400);
    
    // جلب قائمة الصور الحالية
    const { files } = await githubListFiles(env, getImagesDir(env));
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    const currentImages = files.filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return imageExtensions.includes(ext);
    });
    
    // التحقق من العدد
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

// ===== دوال جديدة لعرض وحذف الصور =====
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

// إعادة تصدير معالجات الجدولة
export { handleLoadSchedule, handleSaveSchedule };
