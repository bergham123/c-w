

import { 
  githubGetFile, githubPutFile, githubRunWorkflow, githubListFiles, 
  githubGetFileRaw, githubPutFileBase64, githubDeleteFile 
} from './github.js';
import { jsonResponse, getPath, getImagesDir, linesToJsonArray, jsonToLines, getImagesListPath } from './helpers.js';
import { handleLoadSchedule, handleSaveSchedule } from './schedule.js';

// ===== دوال جديدة لإدارة images.json =====
export async function handleLoadImagesList(request, env) {
  try {
    const { content } = await githubGetFile(env, getImagesListPath(env));
    return jsonResponse({ ok: true, text: jsonToLines(content) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

export async function handleSaveImagesList(request, env) {
  try {
    const { text } = await request.json();
    const path = getImagesListPath(env);
    const current = await githubGetFile(env, path);
    const result = await githubPutFile(env, path, linesToJsonArray(text || ""), current.sha, "Update images list");
    return jsonResponse({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// ===== تعديل handleLoad و handleSave ليدعما type="images" =====
export async function handleLoad(request, env) {
  const type = new URL(request.url).searchParams.get("type");
  if (!["messages", "contacts", "images"].includes(type)) {
    return jsonResponse({ error: "type must be messages, contacts or images" }, 400);
  }
  try {
    const { content } = await githubGetFile(env, getPath(env, type));
    return jsonResponse({ ok: true, text: jsonToLines(content) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

export async function handleSave(request, env) {
  try {
    const { type, text } = await request.json();
    if (!["messages", "contacts", "images"].includes(type)) {
      return jsonResponse({ error: "type must be messages, contacts or images" }, 400);
    }
    const path = getPath(env, type);
    const current = await githubGetFile(env, path);
    const result = await githubPutFile(env, path, linesToJsonArray(text || ""), current.sha, "Update " + path);
    return jsonResponse({ ok: true, commit: result.commit && result.commit.sha });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// ===== تعديل handleUploadImage =====
export async function handleUploadImage(request, env) {
  try {
    const { filename, dataBase64 } = await request.json();
    if (!filename || !dataBase64) {
      return jsonResponse({ ok: false, error: "filename and dataBase64 are required" }, 400);
    }

    // قراءة images.json الحالي للتحقق من العدد
    const imagesListPath = getImagesListPath(env);
    const listFile = await githubGetFile(env, imagesListPath);
    let imagesList = [];
    if (listFile.exists && listFile.content) {
      try {
        imagesList = JSON.parse(listFile.content);
        if (!Array.isArray(imagesList)) imagesList = [];
      } catch (e) { imagesList = []; }
    }

    if (imagesList.length >= 3) {
      return jsonResponse({ ok: false, error: "لا يمكن رفع أكثر من 3 صور. قم بحذف بعض الصور أولاً." }, 400);
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const imagePath = getImagesDir(env) + "/" + timestamp + "_" + safeName;

    // رفع الصورة
    const existing = await githubGetFileRaw(env, imagePath);
    const result = await githubPutFileBase64(env, imagePath, dataBase64, existing.sha, "Add image " + safeName);

    // تحديث images.json
    imagesList.push(imagePath);
    await githubPutFile(env, imagesListPath, JSON.stringify(imagesList, null, 2), listFile.sha, "Update images list after upload");

    return jsonResponse({ ok: true, path: imagePath, commit: result.commit && result.commit.sha });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// ===== تعديل handleDeleteImage =====
export async function handleDeleteImage(request, env) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return jsonResponse({ ok: false, error: "filename is required" }, 400);
    }
    const path = getImagesDir(env) + "/" + filename;

    // جلب sha للملف
    const fileInfo = await githubGetFileRaw(env, path);
    if (!fileInfo.exists) {
      return jsonResponse({ ok: false, error: "File not found" }, 404);
    }

    // حذف الملف
    await githubDeleteFile(env, path, fileInfo.sha, "Delete image " + filename);

    // تحديث images.json
    const imagesListPath = getImagesListPath(env);
    const listFile = await githubGetFile(env, imagesListPath);
    if (listFile.exists && listFile.content) {
      let imagesList = [];
      try {
        imagesList = JSON.parse(listFile.content);
        if (!Array.isArray(imagesList)) imagesList = [];
      } catch (e) { imagesList = []; }
      const newList = imagesList.filter(item => item !== path);
      await githubPutFile(env, imagesListPath, JSON.stringify(newList, null, 2), listFile.sha, "Update images list after delete");
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// ===== تعديل handleListImages لقراءة من images.json =====
export async function handleListImages(request, env) {
  try {
    const imagesListPath = getImagesListPath(env);
    const { content, exists } = await githubGetFile(env, imagesListPath);
    if (!exists || !content) {
      return jsonResponse({ ok: true, files: [] });
    }
    let list = [];
    try {
      list = JSON.parse(content);
      if (!Array.isArray(list)) list = [];
    } catch (e) { list = []; }

    // بناء كائنات الملفات مع download_url
    const branch = env.GITHUB_BRANCH || "main";
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const files = list.map(path => {
      const name = path.split('/').pop();
      return {
        name: name,
        path: path,
        sha: null, // لا نحتاج sha هنا، سيتم جلبه عند الحذف
        size: 0,
        download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
      };
    });
    return jsonResponse({ ok: true, files });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

// دوال أخرى تبقى كما هي (handleGetLogs, handleGetLogContent, handleGetStats ...)
// ...

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

// دوال جديدة للصور
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
