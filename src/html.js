// src/html.js
export const HTML_PAGE = `<!DOCTYPE html>
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

  /* معرض الصور */
  #imageGallery { margin-top: 16px; }
  #imageList { display: flex; flex-wrap: wrap; gap: 12px; }
  .image-item { position: relative; width: 100px; height: 100px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color); flex-shrink: 0; }
  .image-item img { width: 100%; height: 100%; object-fit: cover; }
  .image-item .delete-btn {
    position: absolute; top: 4px; right: 4px;
    background: var(--danger); border: none; color: white;
    border-radius: 50%; width: 28px; height: 28px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
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

    <!-- الجدولة (مع توضيح توقيت المغرب) -->
    <div class="card">
      <div class="card-header"><i class="fas fa-clock"></i><h2>توقيت التشغيل التلقائي</h2></div>
      <div class="card-hint">تعديل جدولة الـ workflow (Cron) - الوقت المدخل هو بتوقيت المغرب (سيتم تحويله تلقائياً إلى UTC بطرح ساعتين)</div>
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

    <!-- الصور + معرض + حذف -->
    <div class="card">
      <div class="card-header"><i class="fas fa-images"></i><h2>رفع الصور</h2></div>
      <div class="card-hint">ستُرفع إلى مجلد <code>images/</code> - الحد الأقصى 3 صور</div>
      <div style="background: rgba(15, 23, 42, 0.8); padding: 15px; border-radius: 12px; border: 1px dashed var(--border-color);">
        <input type="file" id="imagesInput" accept="image/*" multiple style="width:100%; margin-bottom: 10px;" />
        <div id="imagePreviewArea" style="display:flex; flex-wrap:wrap; gap:10px;"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="uploadImagesBtn"><i class="fas fa-upload"></i> رفع الصور</button>
        <button class="btn" id="refreshImagesBtn"><i class="fas fa-sync"></i> تحديث القائمة</button>
      </div>
      <!-- معرض الصور -->
      <div id="imageGallery" style="display: none; margin-top: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:14px; color:var(--text-muted);">الصور الموجودة (<span id="imageCount">0</span>/3)</span>
        </div>
        <div id="imageList"></div>
      </div>
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

// تحميل قائمة الصور
async function loadImages() {
  const gallery = document.getElementById('imageGallery');
  const list = document.getElementById('imageList');
  const countSpan = document.getElementById('imageCount');
  
  try {
    const res = await fetch('/api/images');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    
    const files = data.files || [];
    countSpan.textContent = files.length;
    
    if (files.length === 0) {
      gallery.style.display = 'none';
      return;
    }
    
    gallery.style.display = 'block';
    list.innerHTML = '';
    
    files.forEach(file => {
      const div = document.createElement('div');
      div.className = 'image-item';
      
      const img = document.createElement('img');
      img.src = file.download_url || \`https://raw.githubusercontent.com/\${window.ENV?.GITHUB_OWNER || 'bergham123'}/\${window.ENV?.GITHUB_REPO || 'wtsc'}/main/images/\${file.name}\`;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.onclick = async () => {
        if (!confirm(\`تأكيد حذف الصورة "\${file.name}"؟\`)) return;
        try {
          const resDel = await fetch('/api/delete-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, sha: file.sha })
          });
          const dataDel = await resDel.json();
          if (!dataDel.ok) throw new Error(dataDel.error);
          // إزالة العنصر
          div.remove();
          // تحديث العدد
          const newCount = parseInt(countSpan.textContent) - 1;
          countSpan.textContent = newCount;
          if (newCount === 0) gallery.style.display = 'none';
          setStatus(document.getElementById('imagesStatus'), 'تم حذف الصورة ✓', 'ok');
        } catch (err) {
          setStatus(document.getElementById('imagesStatus'), 'خطأ في الحذف: ' + err.message, 'err');
        }
      };
      
      div.appendChild(img);
      div.appendChild(deleteBtn);
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Error loading images:', err);
    gallery.style.display = 'none';
  }
}

document.getElementById('refreshImagesBtn').onclick = loadImages;

// رفع الصور مع التحقق من الحد الأقصى
document.getElementById('uploadImagesBtn').onclick = async function() {
  if (selectedFiles.length === 0) { 
    setStatus(document.getElementById('imagesStatus'), 'اختر صورة أولاً', 'err'); 
    return; 
  }
  
  // تحقق من العدد الحالي أولاً
  try {
    const resCheck = await fetch('/api/images');
    const dataCheck = await resCheck.json();
    if (!dataCheck.ok) throw new Error(dataCheck.error);
    const currentCount = dataCheck.files ? dataCheck.files.length : 0;
    if (currentCount >= 3) {
      setStatus(document.getElementById('imagesStatus'), 'لا يمكن رفع أكثر من 3 صور. قم بحذف بعض الصور أولاً.', 'err');
      return;
    }
    const remaining = 3 - currentCount;
    if (selectedFiles.length > remaining) {
      setStatus(document.getElementById('imagesStatus'), \`يمكنك رفع \${remaining} صورة فقط (الحد الأقصى 3)\`, 'err');
      return;
    }
  } catch (err) {
    setStatus(document.getElementById('imagesStatus'), 'خطأ في التحقق من عدد الصور: ' + err.message, 'err');
    return;
  }

  let success = 0;
  for (const file of selectedFiles) {
    try {
      const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.onerror = reject; r.readAsDataURL(file); });
      const res = await fetch("/api/upload-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, dataBase64: base64 }) });
      const data = await res.json();
      if (data.ok) success++;
    } catch (err) {}
  }
  setStatus(document.getElementById('imagesStatus'), success + "/" + selectedFiles.length + " تم رفعها", success === selectedFiles.length ? "ok" : "err");
  if (success === selectedFiles.length) { selectedFiles = []; imagesInput.value = ""; renderPreviews(); }
  // تحديث قائمة الصور بعد الرفع
  loadImages();
};

// تحميل الصور تلقائياً
loadImages();

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

// ===== Schedule (مع توقيت المغرب) =====
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
      disp.textContent = "التوقيت (المغرب): " + data.cron;
      const parts = data.cron.trim().split(/\\s+/);
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

loadSchedule(); // تحميل تلقائي

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
