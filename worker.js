// worker.js - المدخل الرئيسي

import { HTML_PAGE } from "./src/html.js";

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

  // Live Logs
  handleLiveLog,
  handleLiveLogGet

} from "./src/handlers.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    if (url.pathname === "/api/load" && request.method === "GET")
      return handleLoad(request, env);

    if (url.pathname === "/api/save" && request.method === "POST")
      return handleSave(request, env);

    if (url.pathname === "/api/run-workflow" && request.method === "POST")
      return handleRunWorkflow(request, env);

    if (url.pathname === "/api/upload-image" && request.method === "POST")
      return handleUploadImage(request, env);

    if (url.pathname === "/api/logs" && request.method === "GET")
      return handleGetLogs(request, env);

    if (url.pathname === "/api/log-content" && request.method === "GET")
      return handleGetLogContent(request, env);

    if (url.pathname === "/api/schedule" && request.method === "GET")
      return handleLoadSchedule(request, env);

    if (url.pathname === "/api/schedule" && request.method === "POST")
      return handleSaveSchedule(request, env);

    if (url.pathname === "/api/stats" && request.method === "GET")
      return handleGetStats(request, env);

    if (url.pathname === "/api/images" && request.method === "GET")
      return handleListImages(request, env);

    if (url.pathname === "/api/delete-image" && request.method === "POST")
      return handleDeleteImage(request, env);

    // ==========================
    // Live Console Logs
    // ==========================

    if (url.pathname === "/api/live-log" && request.method === "POST")
      return handleLiveLog(request, env);

    if (url.pathname === "/api/live-log" && request.method === "GET")
      return handleLiveLogGet(request, env);

    return new Response("Not found", {
      status: 404,
    });
  },
};
