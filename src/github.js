// src/github.js
import { ghHeaders, utf8ToBase64, base64ToUtf8 } from './helpers.js';

export async function githubGetFile(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return { content: null, sha: null, exists: false };
  if (!res.ok) throw new Error("GitHub GET error " + res.status + ": " + await res.text());
  const data = await res.json();
  return { content: base64ToUtf8(data.content), sha: data.sha, exists: true };
}

export async function githubGetFileRaw(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return { sha: null, exists: false };
  if (!res.ok) throw new Error("GitHub GET error " + res.status + ": " + await res.text());
  const data = await res.json();
  return { sha: data.sha, exists: true, contentBase64: data.content };
}

export async function githubPutFile(env, path, contentStr, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = { message: message || "Update " + path, content: utf8ToBase64(contentStr), branch: branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("GitHub PUT error " + res.status + ": " + await res.text());
  return await res.json();
}

export async function githubPutFileBase64(env, path, base64Content, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = { message: message || "Add " + path, content: base64Content, branch: branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("GitHub PUT error " + res.status + ": " + await res.text());
  return await res.json();
}

export async function githubRunWorkflow(env) {
  const branch = env.GITHUB_BRANCH || "main";
  const workflowFile = env.WORKFLOW_FILE;
  if (!workflowFile) throw new Error("WORKFLOW_FILE env var is not set");
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/actions/workflows/" + encodeURIComponent(workflowFile) + "/dispatches";
  const res = await fetch(url, { method: "POST", headers: ghHeaders(env), body: JSON.stringify({ ref: branch }) });
  if (res.status !== 204) throw new Error("GitHub workflow dispatch error " + res.status + ": " + await res.text());
  return true;
}

export async function githubListFiles(env, folder) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(folder) + "?ref=" + branch;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return { files: [], exists: false };
  if (!res.ok) throw new Error("GitHub list error " + res.status + ": " + await res.text());
  const data = await res.json();
  const files = data.filter(item => item.type === "file" && item.name.endsWith(".log")).map(item => ({ name: item.name, path: item.path, sha: item.sha, size: item.size, download_url: item.download_url }));
  return { files, exists: true };
}

// src/github.js - إضافة في نهاية الملف

export async function githubDeleteFile(env, path, sha, message) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = "https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + "/contents/" + encodeURIComponent(path);
  const body = { message: message || "Delete " + path, sha: sha, branch: branch };
  const res = await fetch(url, { method: "DELETE", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("GitHub DELETE error " + res.status + ": " + await res.text());
  return await res.json();
}
