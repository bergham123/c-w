// dashboard.js - نسخة مبسطة بلا توكن
document.addEventListener('DOMContentLoaded', () => {
    // نحيدو التحقق من التوكن
    // نعرضو الحالة
    document.getElementById('status').textContent = 'System Ready ✅';

    // Load buttons
    document.getElementById('loadAccounts').addEventListener('click', loadAccounts);
    document.getElementById('clearAccounts').addEventListener('click', () => document.getElementById('accounts').value = '');
    document.getElementById('loadMessages').addEventListener('click', loadMessages);
    document.getElementById('clearMessages').addEventListener('click', () => document.getElementById('messages').value = '');
    document.getElementById('saveAll').addEventListener('click', saveAll);
    document.getElementById('runWorkflow').addEventListener('click', runWorkflow);
    document.getElementById('uploadImageBtn').addEventListener('click', uploadImage);
    document.getElementById('setScheduleBtn').addEventListener('click', setSchedule);
    document.getElementById('loadScheduleBtn').addEventListener('click', loadSchedule);
    document.getElementById('logout').addEventListener('click', () => {
        // مجرد توجيه للصفحة الرئيسية (أو نحيدو الزر)
        window.location.href = 'index.html';
    });

    // تحميل البيانات عند بدء التشغيل
    loadAccounts();
    loadMessages();
    loadSchedule();
});

async function fetchAPI(endpoint, options = {}) {
    const res = await fetch(`/api/${endpoint}`, {
        ...options,
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${text}`);
    }
    return res.json();
}

async function loadAccounts() {
    try {
        const data = await fetchAPI('load-accounts');
        document.getElementById('accounts').value = data.join('\n');
        addLog('Accounts loaded ✅');
    } catch (err) {
        addLog('Error loading accounts: ' + err.message);
    }
}

async function loadMessages() {
    try {
        const data = await fetchAPI('load-messages');
        document.getElementById('messages').value = data.join('\n');
        addLog('Messages loaded ✅');
    } catch (err) {
        addLog('Error loading messages: ' + err.message);
    }
}

async function loadSchedule() {
    try {
        const data = await fetchAPI('load-schedule');
        document.getElementById('scheduleTime').value = data.time || '';
        document.getElementById('scheduleStatus').textContent = data.time ? `Current schedule: ${data.time}` : 'No schedule set';
    } catch (err) {
        addLog('Error loading schedule: ' + err.message);
    }
}

async function saveAll() {
    const accounts = document.getElementById('accounts').value.split('\n').filter(s => s.trim() !== '');
    const messages = document.getElementById('messages').value.split('\n').filter(s => s.trim() !== '');
    if (!accounts.length || !messages.length) {
        addLog('⚠️ Please enter at least one account and one message.');
        return;
    }
    try {
        await fetchAPI('save-all', {
            method: 'POST',
            body: JSON.stringify({ accounts, messages })
        });
        addLog('✅ All saved successfully!');
        document.getElementById('runWorkflow').disabled = false;
    } catch (err) {
        addLog('❌ Error saving: ' + err.message);
    }
}

async function runWorkflow() {
    try {
        await fetchAPI('run-workflow', { method: 'POST' });
        addLog('🚀 Workflow triggered!');
    } catch (err) {
        addLog('❌ Workflow error: ' + err.message);
    }
}

async function uploadImage() {
    const input = document.getElementById('imageInput');
    const file = input.files[0];
    if (!file) {
        addLog('⚠️ Please select an image.');
        return;
    }
    try {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            const result = await fetchAPI('upload-image', {
                method: 'POST',
                body: JSON.stringify({ filename: file.name, base64 })
            });
            document.getElementById('uploadResult').textContent = `✅ Image uploaded: ${result.url}`;
            addLog('🖼️ Image uploaded: ' + result.url);
        };
        reader.readAsDataURL(file);
    } catch (err) {
        addLog('❌ Upload error: ' + err.message);
    }
}

async function setSchedule() {
    const time = document.getElementById('scheduleTime').value;
    if (!time) {
        addLog('⚠️ Please select a time.');
        return;
    }
    try {
        await fetchAPI('set-schedule', {
            method: 'POST',
            body: JSON.stringify({ time })
        });
        addLog(`⏰ Schedule set to ${time}`);
        document.getElementById('scheduleStatus').textContent = `✅ Schedule set to ${time}`;
    } catch (err) {
        addLog('❌ Schedule error: ' + err.message);
    }
}

function addLog(msg) {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.prepend(entry);
    if (logs.children.length > 50) logs.removeChild(logs.lastChild);
}
