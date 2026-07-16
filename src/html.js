// src/html.js
export const HTML_PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WhatsApp Manager Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root {
    --bg-main: #111B21;
    --card-bg: #202C33;
    --border-color: #2A3942;
    --text-main: #E9EDEF;
    --text-muted: #8696A0;
    --accent: #25D366;
    --accent-glow: rgba(37, 211, 102, 0.2);
    --success: #25D366;
    --danger: #F15C6D;
    --warning: #FFB100;
    --input-bg: #2A3942;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', sans-serif;
    background: var(--bg-main);
    color: var(--text-main);
    min-height: 100vh;
    display: flex;
    gap: 0;
  }

  /* Sidebar Styles */
  .sidebar {
    width: 300px;
    background: var(--card-bg);
    height: 100vh;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    padding: 24px;
    border-left: 1px solid var(--border-color);
    flex-shrink: 0;
    transition: transform 0.3s ease;
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
  }
  .logo-icon {
    width: 40px; height: 40px;
    background: var(--accent);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; color: #111B21;
  }
  .logo-text { font-size: 18px; font-weight: 800; }
  .logo-text span { color: var(--accent); }
  
  .nav-cards {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex-grow: 1;
  }
  .sidebar-card {
    background: var(--bg-main);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 16px;
    transition: border-color 0.3s;
  }
  .sidebar-card:hover { border-color: var(--accent); }

  /* Main Content Styles */
  .main-content {
    flex: 1;
    padding: 30px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: calc(100% - 300px);
    width: 100%;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  @media (max-width: 1024px) {
    body { flex-direction: column; }
    .sidebar { width: 100%; height: auto; position: relative; border-left: none; border-bottom: 1px solid var(--border-color); }
    .main-content { max-width: 100%; padding: 20px; }
    .content-grid { grid-template-columns: 1fr; }
  }

  .card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
    transition: border-color 0.3s ease;
  }
  .card:hover { border-color: rgba(37, 211, 102, 0.4); }
  .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .card-header i { font-size: 18px; color: var(--accent); }
  .card-header h2 { font-size: 16px; font-weight: 700; }
  .card-hint { color: var(--text-muted); font-size: 12px; margin-bottom: 16px; }
  
  textarea {
    width: 100%;
    min-height: 140px;
    background: var(--input-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    font-family: 'Consolas', monospace;
    font-size: 13px;
    resize: vertical;
    direction: ltr; text-align: left;
  }
  textarea:focus { outline: none; border-color: var(--accent); }
  
  .btn-row { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .btn {
    background: var(--input-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Tajawal', sans-serif;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    display: inline-flex; align-items: center; gap: 8px;
    width: 100%;
    justify-content: center;
  }
  .btn:hover { background: var(--border-color); }
  .btn-primary { background: var(--accent); color: #111B21; border: none; font-weight: 700; }
  .btn-primary:hover { background: #1FB855; box-shadow: 0 4px 12px var(--accent-glow); }
  .btn-warning { background: var(--warning); border: none; color: #111B21; font-weight: 700; }
  
  .status { margin-top: 10px; font-size: 12px; min-height: 18px; color: var(--text-muted); text-align: center; }
  .status.ok { color: var(--success); }
  .status.err { color: var(--danger); }

  .schedule-status { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-block; margin-bottom: 10px; }
  .schedule-status.active { background: rgba(37, 211, 102, 0.15); color: var(--success); border: 1px solid rgba(37, 211, 102, 0.3); }
  .schedule-status.inactive { background: rgba(241, 92, 109, 0.15); color: var(--danger); border: 1px solid rgba(241, 92, 109, 0.3); }
  
  .schedule-inputs { display: flex; gap: 12px; margin-bottom: 12px; justify-content: center; }
  .schedule-inputs label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--text-muted); align-items: center; }
  .schedule-inputs input {
    width: 70px; background: var(--input-bg); color: var(--text-main);
    border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; text-align: center;
    font-family: 'Tajawal'; font-size: 16px;
  }

  .stats-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
  .stats-table th { text-align: right; padding: 12px; background: var(--input-bg); color: var(--text-muted); border-bottom: 1px solid var(--border-color); font-weight: 500; }
  .stats-table td { padding: 12px; border-bottom: 1px solid var(--border-color); color: var(--text-main); }
  .stats-table tr:last-child td { border-bottom: none; }
  
  .modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
    z-index: 999; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: var(--card-bg); border: 1px solid var(--border-color);
    border-radius: 12px; max-width: 900px; width: 100%; max-height: 80vh;
    padding: 24px; display: flex; flex-direction: column; gap: 16px;
  }
  .log-files-list { display: flex; gap: 10px; flex-wrap: wrap; }
  .log-file-btn { background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
  .log-file-btn:hover { background: var(--border-color); }
  .log-file-btn.active { background: var(--accent); border-color: var(--accent); color: #111B21; font-weight: 700; }
  .log-content { background: var(--bg-main); border-radius: 8px; padding: 16px; overflow-y: auto; font-family: 'Consolas', monospace; font-size: 13px; flex-grow: 1; border: 1px solid var(--border-color); }

  .image-item {
    position: relative;
    width: 90px;
    height: 90px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }
  .image-item img { width: 100%; height: 100%; object-fit: cover; }
  .image-item .delete-btn {
    position: absolute; top: 4px; right: 4px;
    background: var(--danger); border: none; color: white;
    border-radius: 50%; width: 24px; height: 24px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  #imageGallery { margin-top: 16px; }
  #imageList { display: flex; flex-wrap: wrap; gap: 12px; }
</style>
</head>
<body>

  <!-- ========= SIDEBAR ========= -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo-icon"><i class="fab fa-whatsapp"></i></div>
      <div class="logo-text">مدير <span>واتساب</span></div>
    </div>

    <div class="nav-cards">
      <!-- Manual Run -->
      <div class="sidebar-card">
        <div class="card-header"><i class="fas fa-bolt"></i><h2>تشغيل يدوي</h2></div>
        <div class="btn-row" style="margin-top: 12px;">
          <button class="btn btn-primary" id="runWorkflowBtn"><i class="fas fa-play"></i> تشغيل الـ Workflow</button>
        </div>
        <div class="status" id="workflowStatus"></div>
      </div>

      <!-- Logs -->
      <div class="sidebar-card">
        <div class="card-header"><i class="fas fa-terminal"></i><h2>السجلات</h2></div>
        <div class="btn-row" style="margin-top: 12px;">
          <button class="btn" id="viewLogsBtn"><i class="fas fa-folder-open"></i> عرض السجلات</button>
        </div>
        <div class="status" id="logsStatus"></div>
      </div>

      <!-- Schedule -->
      <div class="sidebar-card">
        <div class="card-header"><i class="fas fa-clock"></i><h2>الجدولة</h2></div>
        <div class="card-hint">وقت المغرب (-2 ساعة UTC)</div>
        <div>
          <span class="schedule-status inactive" id="scheduleIndicator">غير مفعل</span>
          <span id="currentCronDisplay" style="font-size:12px;color:var(--text-muted);display:block;margin-top:5px;"></span>
        </div>
        <div class="schedule-inputs">
          <label>الساعة<input type="number" id="hourInput" min="0" max="23" value="10" /></label>
          <label>الدقيقة<input type="number" id="minuteInput" min="0" max="59" value="0" /></label>
        </div>
        <div class="btn-row">
          <button class="btn" id="loadScheduleBtn"><i class="fas fa-history"></i> تحميل</button>
          <button class="btn btn-warning" id="updateScheduleBtn"><i class="fas fa-sync-alt"></i> تحديث</button>
        </div>
        <div class="status" id="scheduleStatus"></div>
      </div>
    </div>
  </aside>

  <!-- ========= MAIN CONTENT ========= -->
  <main class="main-content">
    
    <!-- Statistics Card (Full Width) -->
    <div class="card">
      <div class="card-header"><i class="fas fa-chart-line"></i><h2>إحصائيات الإرسال</h2></div>
      <div class="btn-row" style="margin-top: 0; margin-bottom: 16px;">
        <button class="btn btn-primary" id="loadStatsBtn" style="width: auto;"><i class="fas fa-database"></i> تحميل الإحصائيات</button>
      </div>
      <div id="statsContainer" style="display:none;">
        <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
          <table class="stats-table">
            <thead><tr><th>التاريخ</th><th>محاولات</th><th>نجاح</th><th>فشل</th></tr></thead>
            <tbody id="statsBody"></tbody>
          </table>
        </div>
        <div style="background: var(--bg-main); border-radius: 8px; padding: 20px; height: 300px;">
          <canvas id="statsChart"></canvas>
        </div>
      </div>
      <div class="status" id="statsStatus"></div>
    </div>

    <div class="content-grid">
      <!-- Messages Card -->
      <div class="card">
        <div class="card-header"><i class="fas fa-comment-dots"></i><h2>الرسائل</h2></div>
        <div class="card-hint">كل رسالة في سطر</div>
        <textarea id="messagesArea" placeholder="اكتب رسالة في كل سطر..."></textarea>
        <div class="btn-row">
          <button class="btn" id="loadMessagesBtn"><i class="fas fa-download"></i> تحميل</button>
          <button class="btn btn-primary" id="saveMessagesBtn"><i class="fas fa-save"></i> حفظ</button>
        </div>
        <div class="status" id="messagesStatus"></div>
      </div>

      <!-- Contacts Card -->
      <div class="card">
        <div class="card-header"><i class="fas fa-address-book"></i><h2>جهات الاتصال</h2></div>
        <div class="card-hint">كل رقم في سطر</div>
        <textarea id="contactsArea" placeholder="اكتب رقم في كل سطر..."></textarea>
        <div class="btn-row">
          <button class="btn" id="loadContactsBtn"><i class="fas fa-download"></i> تحميل</button>
          <button class="btn btn-primary" id="saveContactsBtn"><i class="fas fa-save"></i> حفظ</button>
        </div>
        <div class="status" id="contactsStatus"></div>
      </div>
    </div>

    <!-- Images Card (Full Width under grid) -->
    <div class="card">
      <div class="card-header"><i class="fas fa-images"></i><h2>رفع الصور</h2></div>
      <div class="card-hint">الحد الأقصى 3 صور</div>
      <div style="background: var(--bg-main); padding: 15px; border-radius: 8px; border: 1px dashed var(--border-color);">
        <input type="file" id="imagesInput" accept="image/*" multiple style="width:100%; margin-bottom: 10px;" />
        <div id="imagePreviewArea" style="display:flex; flex-wrap:wrap; gap:10px;"></div>
      </div>
      <div class="btn-row" style="justify-content: flex-start;">
        <button class="btn btn-primary" id="uploadImagesBtn" style="width: auto;"><i class="fas fa-upload"></i> رفع الصور</button>
        <button class="btn" id="refreshImagesBtn" style="width: auto;"><i class="fas fa-sync"></i> تحديث القائمة</button>
      </div>
      <div id="imageGallery" style="display: none; margin-top: 16px;">
        <div style="margin-bottom:10px;">
          <span style="font-size:14px; color:var(--text-muted);">الصور الموجودة (<span id="imageCount">0</span>/3)</span>
        </div>
        <div id="imageList"></div>
      </div>
      <div class="status" id="imagesStatus"></div>
    </div>

  </main>

  <!-- ========= MODALS ========= -->
  <div class="modal-overlay" id="logsModal">
    <div class="modal">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="color: var(--accent);"><i class="fas fa-clipboard-list"></i> السجلات</h2>
        <button class="btn" id="closeLogsModal" style="width: auto;"><i class="fas fa-times"></i> إغلاق</button>
      </div>
      <div class="log-files-list" id="logFilesList"></div>
      <div class="log-content" id="logContent">اختر ملف سجل لعرض محتواه...</div>
    </div>
  </div>

<script>
function setStatus(el, msg, type) { el.textContent = msg; el.className = "status" + (type ? " " + type : ""); }

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
      div.style.cssText = "width:80px; height:80px; border-radius:8px; overflow:hidden; position:relative; border:1px solid var(--border-color);";
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
    if (files.length === 0) { gallery.style.display = 'none'; return; }
    gallery.style.display = 'block';
    list.innerHTML = '';
    files.forEach(file => {
      const div = document.createElement('div');
      div.className = 'image-item';
      const img = document.createElement('img');
      img.src = file.download_url || \`https://raw.githubusercontent.com/bergham123/wtsc/main/images/\${file.name}\`;
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
          div.remove();
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

document.getElementById('uploadImagesBtn').onclick = async function() {
  if (selectedFiles.length === 0) { setStatus(document.getElementById('imagesStatus'), 'اختر صورة أولاً', 'err'); return; }
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
  loadImages();
};

loadImages();

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
    const res = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", cron: cron }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    setStatus(scheduleStatus, "تم التحديث ✓", "ok");
    loadSchedule();
  } catch (err) { setStatus(scheduleStatus, "خطأ: " + err.message, "err"); }
}
document.getElementById("loadScheduleBtn").onclick = loadSchedule;
document.getElementById("updateScheduleBtn").onclick = function() {
  const h = parseInt(hourInput.value, 10);
  const m = parseInt(minuteInput.value, 10);
  if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
    setStatus(scheduleStatus, "أدخل قيم صحيحة", "err");
    return;
  }
  const cron = m + " " + h + " * * *";
  saveSchedule(cron);
};
loadSchedule();

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
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (statsChartInstance) statsChartInstance.destroy();
    statsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.data.map(r => r.date),
        datasets: [
          { label: 'محاولات', data: data.data.map(r => r.attempted||0), backgroundColor: 'rgba(53, 114, 238, 0.6)', borderColor: 'rgba(53, 114, 238, 1)', borderWidth: 1, borderRadius: 4 },
          { label: 'نجاح', data: data.data.map(r => r.success||0), backgroundColor: 'rgba(37, 211, 102, 0.6)', borderColor: 'rgba(37, 211, 102, 1)', borderWidth: 1, borderRadius: 4 },
          { label: 'فشل', data: data.data.map(r => r.failed||0), backgroundColor: 'rgba(241, 92, 109, 0.6)', borderColor: 'rgba(241, 92, 109, 1)', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#E9EDEF', font: { family: 'Tajawal', size: 14 } } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#8696A0', font: { family: 'Tajawal' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#8696A0', font: { family: 'Tajawal' } }, grid: { display: false } }
        }
      }
    });
  } catch (err) { setStatus(st, "خطأ: " + err.message, "err"); }
};
</script>
</body>
</html>
`;
