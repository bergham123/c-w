// worker.js

import { HTML_PAGE } from "./src/html.js";
import { LiveLogs } from "./src/liveLogs.js";

import {
  handleLoad,
  handleSave,
  handleRunWorkflow,
  handleUploadImage,
  handleGetLogs,
  handleGetLogContent,
  handleGetStats,
  handleLoadSchedule,
  handleSaveSchedule,
  handleListImages,
  handleDeleteImage,
  handleLiveLog,
  handleLiveLogGet
} from "./src/handlers.js";

export { LiveLogs };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // الصفحة الرئيسية
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, {
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      });
    }

    // Messages
    if (url.pathname === "/api/load" && request.method === "GET")
      return handleLoad(request, env);

    if (url.pathname === "/api/save" && request.method === "POST")
      return handleSave(request, env);

    // GitHub Workflow
    if (url.pathname === "/api/run-workflow" && request.method === "POST")
      return handleRunWorkflow(request, env);

    // Upload Image
    if (url.pathname === "/api/upload-image" && request.method === "POST")
      return handleUploadImage(request, env);

    // Logs
    if (url.pathname === "/api/logs" && request.method === "GET")
      return handleGetLogs(request, env);

    if (url.pathname === "/api/log-content" && request.method === "GET")
      return handleGetLogContent(request, env);

    // Live Logs
    if (url.pathname === "/api/live-log" && request.method === "POST")
      return handleLiveLog(request, env);

    if (url.pathname === "/api/live-log" && request.method === "GET")
      return handleLiveLogGet(request, env);

    // Schedule
    if (url.pathname === "/api/schedule" && request.method === "GET")
      return handleLoadSchedule(request, env);

    if (url.pathname === "/api/schedule" && request.method === "POST")
      return handleSaveSchedule(request, env);

    // Stats
    if (url.pathname === "/api/stats" && request.method === "GET")
      return handleGetStats(request, env);

    // Images
    if (url.pathname === "/api/images" && request.method === "GET")
      return handleListImages(request, env);

    if (url.pathname === "/api/delete-image" && request.method === "POST")
      return handleDeleteImage(request, env);

    return new Response("Not found", {
      status: 404
    });
  }
};
