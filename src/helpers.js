export function ghHeaders(env) {
  return {
    "Authorization": "Bearer " + env.GITHUB_TOKEN,
    "User-Agent": "cf-worker-json-editor",
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export function getPath(env, type) {
  if (type === "messages") return env.MESSAGES_PATH || "message.json";
  if (type === "contacts") return env.CONTACTS_PATH || "accounts.json";
  if (type === "images") return env.IMAGES_LIST_PATH || "images.json";
  throw new Error("Unknown type: " + type);
}

export function getWorkflowPath(env) {
  const file = env.WORKFLOW_FILE || "send.yaml";
  return file.includes("/") ? file : ".github/workflows/" + file;
}

export function getImagesDir(env) {
  return (env.IMAGES_DIR || "images").replace(/^\/+|\/+$/g, "");
}

export function getImagesListPath(env) {
  return env.IMAGES_LIST_PATH || "images.json";
}

export function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

export function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

export function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export function linesToJsonArray(text) {
  return JSON.stringify(text.split("\n").map(l => l.trim()).filter(l => l.length > 0), null, 2);
}

export function jsonToLines(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
    return JSON.stringify(parsed, null, 2);
  } catch (e) { return jsonStr; }
}
