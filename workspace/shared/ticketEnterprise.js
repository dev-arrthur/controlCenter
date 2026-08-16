(function(global){
  'use strict';

  const ticketId = new URLSearchParams(location.search).get('id');
  if (!ticketId) return;
  const isAdmin = document.body.classList.contains('admin-portal');
  const roleKind = isAdmin ? 'admin' : 'client';
  let attachments = [];
  let refreshTimer = null;
  let pollingTimer = null;
  let socket = null;
  let socketReady = false;

  function escapeHtml(value='') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
  function notify(message, type='error') {
    if (typeof global.toast === 'function') return global.toast(message, type);
    let alert = document.querySelector('.enterprise-inline-alert');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'enterprise-inline-alert';
      document.querySelector('.portal-content')?.prepend(alert);
    }
    alert.textContent = message;
    alert.dataset.type = type;
    setTimeout(() => alert.remove(), 5000);
  }
  async function api(url, options={}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      method: options.method || 'GET',
      headers: { 'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.');
      error.code = payload?.error?.code || `HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }
  async function uploadFiles({ messageId, input }) {
    const files = [...(input?.files || [])];
    if (!files.length) return [];
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    const uploaded = [];
    for (const file of files) {
      if (!allowed.includes(file.type)) throw new Error(`${file.name}: formato não permitido. Use JPG, PNG, WEBP ou PDF.`);
      if (file.size > 3 * 1024 * 1024) throw new Error(`${file.name}: o limite é 3 MB por arquivo.`);
      const dataBase64 = await fileToBase64(file);
      const result = await api(`/api/attachment?action=upload&ticketId=${encodeURIComponent(ticketId)}&portal=${encodeURIComponent(roleKind)}`, {
        method:'POST',
        body: { messageId, fileName:file.name, contentType:file.type, dataBase64 }
      });
      uploaded.push(result.attachment);
    }
    input.value = '';
    await refreshAttachments();
    return uploaded;
  }
  function attachmentMarkup(item) {
    const image = item.contentType?.startsWith('image/');
    if (image) {
      return `<a class="attachment-preview" href="${escapeHtml(item.downloadUrl)}" target="_blank" rel="noopener" title="Abrir ${escapeHtml(item.fileName)}">
        <img src="${escapeHtml(item.downloadUrl)}" alt="${escapeHtml(item.fileName)}" loading="lazy">
        <span><strong>${escapeHtml(item.fileName)}</strong><small>${formatBytes(item.size)} • ver original</small></span>
      </a>`;
    }
    return `<a class="attachment-file" href="${escapeHtml(item.downloadUrl)}" target="_blank" rel="noopener">
      <i class="bi bi-file-earmark-pdf"></i><span><strong>${escapeHtml(item.fileName)}</strong><small>${formatBytes(item.size)} • PDF</small></span><i class="bi bi-box-arrow-up-right"></i>
    </a>`;
  }
  function decorateMessages() {
    document.querySelectorAll('.message-attachments[data-enterprise="1"]').forEach(el => el.remove());
    const grouped = new Map();
    for (const item of attachments) {
      if (!item.messageId) continue;
      if (!grouped.has(item.messageId)) grouped.set(item.messageId, []);
      grouped.get(item.messageId).push(item);
    }
    for (const [messageId, items] of grouped) {
      const message = document.querySelector(`.message[data-message-id="${CSS.escape(messageId)}"]`);
      const bubble = message?.querySelector('.message-bubble');
      if (!bubble) continue;
      const wrap = document.createElement('div');
      wrap.className = 'message-attachments';
      wrap.dataset.enterprise = '1';
      wrap.innerHTML = items.map(attachmentMarkup).join('');
      bubble.appendChild(wrap);
    }
  }
  async function refreshAttachments() {
    try {
      const data = await api(`/api/attachment?action=list&ticketId=${encodeURIComponent(ticketId)}&portal=${encodeURIComponent(roleKind)}`);
      attachments = data.attachments || [];
      decorateMessages();
      let storageReady = data.storageConfigured !== false;
      if (!storageReady) {
        try {
          const health = await api('/api/attachment?action=health');
          storageReady = health?.storage?.connected === true;
        } catch {}
      }
      document.querySelectorAll('[data-attachment-storage-state]').forEach(el => {
        el.hidden = storageReady;
      });
      return attachments;
    } catch (error) {
      if (error.status !== 401) console.warn('ATTACHMENTS', error.message);
      return [];
    }
  }
  async function refreshTicket() {
    if (typeof global.CCRefreshTicket === 'function') {
      try { await global.CCRefreshTicket(); } catch {}
    }
    await refreshAttachments();
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshTicket, 180);
  }
  function startPolling() {
    if (pollingTimer) return;
    pollingTimer = setInterval(() => {
      if (!document.hidden && !socketReady) scheduleRefresh();
    }, 10000);
  }
  function connectRealtime() {
    if (!global.io || socket) { startPolling(); return; }
    try {
      socket = global.io({
        path:'/api/socket',
        transports:['websocket','polling'],
        withCredentials:true,
        reconnection:true,
        reconnectionAttempts:Infinity,
        reconnectionDelay:800,
        reconnectionDelayMax:5000,
        timeout:8000
      });
      socket.on('connect', () => {
        socketReady = true;
        document.querySelectorAll('[data-realtime-state]').forEach(el => { el.dataset.state='online'; el.textContent='Tempo real ativo'; });
        socket.emit('join-ticket', ticketId, result => {
          if (!result?.ok) socketReady = false;
        });
      });
      socket.on('disconnect', () => {
        socketReady = false;
        document.querySelectorAll('[data-realtime-state]').forEach(el => { el.dataset.state='offline'; el.textContent='Reconectando'; });
        startPolling();
      });
      socket.on('connect_error', () => { socketReady = false; startPolling(); });
      socket.on('ticket:message', scheduleRefresh);
      socket.on('ticket:updated', scheduleRefresh);
      socket.on('ticket:attachment', scheduleRefresh);
    } catch {
      socketReady = false;
      startPolling();
    }
  }

  global.CCAttachments = { uploadFiles, refresh:refreshAttachments, decorate:decorateMessages };

  const observer = new MutationObserver(() => decorateMessages());
  document.addEventListener('DOMContentLoaded', () => {
    const messages = document.getElementById('messages');
    if (messages) observer.observe(messages, { childList:true, subtree:true });
    refreshAttachments();
    connectRealtime();
  });
  global.addEventListener('cc:ticket-ready', () => {
    refreshAttachments();
    connectRealtime();
  });
  global.addEventListener('beforeunload', () => {
    if (socket) socket.emit('leave-ticket', ticketId);
    if (pollingTimer) clearInterval(pollingTimer);
  });
})(window);
