document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('status').textContent = 'System Ready ✅';

    document.getElementById('loadAccounts').addEventListener('click', loadAccounts);
    document.getElementById('clearAccounts').addEventListener('click', () => document.getElementById('accounts').value = '');
    document.getElementById('loadMessages').addEventListener('click', loadMessages);
    document.getElementById('clearMessages').addEventListener('click', () => document.getElementById('messages').value = '');
    document.getElementById('saveAll').addEventListener('click', saveAll);
    document.getElementById('runWorkflow').addEventListener('click', runWorkflow);

    loadAccounts();
    loadMessages();
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
        addLog('❌ Error loading accounts: ' + err.message);
    }
}

async function loadMessages() {
    try {
        const data = await fetchAPI('load-messages');
        document.getElementById('messages').value = data.join('\n');
        addLog('Messages loaded ✅');
    } catch (err) {
        addLog('❌ Error loading messages: ' + err.message);
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

function addLog(msg) {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.prepend(entry);
    if (logs.children.length > 50) logs.removeChild(logs.lastChild);
}
