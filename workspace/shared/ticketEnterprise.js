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
  let imageZoom = 1;
  let replyTarget = null;

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
    renderSelectedFiles(input);
    await refreshAttachments();
    return uploaded;
  }
  function attachmentMarkup(item) {
    const image = item.contentType?.startsWith('image/');
    if (image) {
      return `<button class="attachment-preview attachment-image-open" type="button" data-image-preview="1" data-image-src="${escapeHtml(item.downloadUrl)}" data-image-name="${escapeHtml(item.fileName)}" data-image-size="${escapeHtml(formatBytes(item.size))}" title="Visualizar ${escapeHtml(item.fileName)}">
        <img src="${escapeHtml(item.downloadUrl)}" alt="${escapeHtml(item.fileName)}" loading="lazy">
        <span><strong>${escapeHtml(item.fileName)}</strong><small>${formatBytes(item.size)}</small></span>
        <i class="bi bi-arrows-fullscreen attachment-preview-open-icon" aria-hidden="true"></i>
      </button>`;
    }
    return `<a class="attachment-file" href="${escapeHtml(item.downloadUrl)}" target="_blank" rel="noopener">
      <i class="bi bi-file-earmark-pdf"></i><span><strong>${escapeHtml(item.fileName)}</strong><small>${formatBytes(item.size)} • PDF</small></span><i class="bi bi-box-arrow-up-right"></i>
    </a>`;
  }

  function ensureImageModal() {
    let modal = document.getElementById('attachmentImageModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'attachmentImageModal';
    modal.className = 'attachment-image-modal';
    modal.hidden = true;
    modal.innerHTML = `<div class="attachment-image-modal-backdrop" data-image-modal-close></div>
      <div class="attachment-image-modal-card" role="dialog" aria-modal="true" aria-labelledby="attachmentImageModalTitle">
        <div class="attachment-image-modal-head">
          <div><small>ANEXO DO CHAMADO</small><strong id="attachmentImageModalTitle">Imagem</strong><span id="attachmentImageModalSize"></span></div>
          <div class="attachment-image-modal-tools" aria-label="Controles de zoom">
            <button type="button" data-image-zoom-out aria-label="Diminuir zoom"><i class="bi bi-dash-lg"></i></button>
            <button type="button" data-image-zoom-reset aria-label="Restaurar zoom"><span data-image-zoom-label>100%</span></button>
            <button type="button" data-image-zoom-in aria-label="Aumentar zoom"><i class="bi bi-plus-lg"></i></button>
          </div>
          <button type="button" class="attachment-image-modal-close" data-image-modal-close aria-label="Fechar imagem"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="attachment-image-modal-body"><div class="attachment-image-stage"><img id="attachmentImageModalPreview" alt=""></div></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target.closest('[data-image-modal-close]')) return closeImageModal();
      if (event.target.closest('[data-image-zoom-in]')) return setImageZoom(imageZoom + 0.25);
      if (event.target.closest('[data-image-zoom-out]')) return setImageZoom(imageZoom - 0.25);
      if (event.target.closest('[data-image-zoom-reset]')) return setImageZoom(1);
    });
    const body = modal.querySelector('.attachment-image-modal-body');
    body?.addEventListener('wheel', event => {
      if (!modal.classList.contains('open')) return;
      event.preventDefault();
      setImageZoom(imageZoom + (event.deltaY < 0 ? 0.15 : -0.15));
    }, { passive:false });
    modal.querySelector('#attachmentImageModalPreview')?.addEventListener('dblclick', () => setImageZoom(1));
    return modal;
  }
  function setImageZoom(value) {
    imageZoom = Math.max(0.5, Math.min(4, Math.round(value * 20) / 20));
    const modal = document.getElementById('attachmentImageModal');
    const image = modal?.querySelector('#attachmentImageModalPreview');
    const label = modal?.querySelector('[data-image-zoom-label]');
    if (image) image.style.transform = `scale(${imageZoom})`;
    if (label) label.textContent = `${Math.round(imageZoom * 100)}%`;
  }
  function openImageModal(trigger) {
    const modal = ensureImageModal();
    const image = modal.querySelector('#attachmentImageModalPreview');
    const title = modal.querySelector('#attachmentImageModalTitle');
    const size = modal.querySelector('#attachmentImageModalSize');
    const src = trigger.dataset.imageSrc || '';
    const name = trigger.dataset.imageName || 'Imagem';
    image.src = src;
    image.alt = name;
    setImageZoom(1);
    title.textContent = name;
    size.textContent = trigger.dataset.imageSize || '';
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    document.body.classList.add('attachment-modal-open');
    modal.querySelector('.attachment-image-modal-close')?.focus();
  }
  function closeImageModal() {
    const modal = document.getElementById('attachmentImageModal');
    if (!modal || modal.hidden) return;
    modal.classList.remove('open');
    document.body.classList.remove('attachment-modal-open');
    setTimeout(() => {
      modal.hidden = true;
      const image = modal.querySelector('#attachmentImageModalPreview');
      if (image) image.src = '';
    }, 180);
  }
  function bindImageModal() {
    if (document.documentElement.dataset.attachmentModalBound === '1') return;
    document.documentElement.dataset.attachmentModalBound = '1';
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-image-preview="1"]');
      if (!trigger) return;
      event.preventDefault();
      openImageModal(trigger);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeImageModal();
    });
  }
  function renderReplyTarget() {
    const textarea = document.querySelector('#replyMessage');
    if (!textarea) return;
    let preview = document.querySelector('.reply-target-preview');
    if (!replyTarget) { if (preview) preview.remove(); return; }
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'reply-target-preview';
      textarea.insertAdjacentElement('beforebegin', preview);
    }
    preview.innerHTML = `<div><small><i class="bi bi-reply"></i> Respondendo a ${escapeHtml(replyTarget.author)}</small><strong>${escapeHtml(replyTarget.excerpt)}</strong></div><button type="button" data-reply-cancel aria-label="Cancelar resposta"><i class="bi bi-x-lg"></i></button>`;
  }
  function setReplyTarget(trigger) {
    replyTarget = {
      id: trigger.dataset.replyMessageId || '',
      author: trigger.dataset.replyAuthor || 'Mensagem',
      excerpt: trigger.dataset.replyExcerpt || ''
    };
    renderReplyTarget();
    document.querySelector('#replyMessage')?.focus();
    document.querySelector('#replyMessage')?.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  function clearReplyTarget() {
    replyTarget = null;
    renderReplyTarget();
  }
  function bindMessageReplies() {
    if (document.documentElement.dataset.replyBinding === '1') return;
    document.documentElement.dataset.replyBinding = '1';
    document.addEventListener('click', event => {
      const reply = event.target.closest('[data-reply-message-id]');
      if (reply) { event.preventDefault(); setReplyTarget(reply); return; }
      if (event.target.closest('[data-reply-cancel]')) { event.preventDefault(); clearReplyTarget(); return; }
      const reference = event.target.closest('[data-scroll-message]');
      if (reference) {
        event.preventDefault();
        const target = document.querySelector(`.message[data-message-id="${CSS.escape(reference.dataset.scrollMessage || '')}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior:'smooth', block:'center' });
        target.classList.remove('message-highlight');
        requestAnimationFrame(() => target.classList.add('message-highlight'));
        setTimeout(() => target.classList.remove('message-highlight'), 1800);
      }
    });
  }
  function attachmentSignature(items) {
    return items.map(item => `${item.id}:${item.sha256 || ''}:${item.archived ? '1' : '0'}`).join('|');
  }
  function decorateMessages() {
    const grouped = new Map();
    for (const item of attachments) {
      if (!item.messageId) continue;
      if (!grouped.has(item.messageId)) grouped.set(item.messageId, []);
      grouped.get(item.messageId).push(item);
    }
    document.querySelectorAll('.message[data-message-id]').forEach(message => {
      const messageId = message.dataset.messageId || '';
      const bubble = message.querySelector('.message-bubble');
      if (!bubble) return;
      const items = grouped.get(messageId) || [];
      let wrap = bubble.querySelector(':scope > .message-attachments[data-enterprise="1"]');
      if (!items.length) { if (wrap) wrap.remove(); return; }
      const signature = attachmentSignature(items);
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'message-attachments';
        wrap.dataset.enterprise = '1';
        bubble.appendChild(wrap);
      }
      if (wrap.dataset.signature === signature) return;
      wrap.dataset.signature = signature;
      wrap.innerHTML = items.map(attachmentMarkup).join('');
    });
  }
  function renderSelectedFiles(input) {
    if (!input) return;
    let box = input.parentElement?.querySelector('.selected-attachments');
    const files = [...(input.files || [])];
    if (!files.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'selected-attachments'; input.insertAdjacentElement('afterend', box); }
    box.innerHTML = files.map(file => `<span><i class="bi bi-paperclip"></i>${escapeHtml(file.name)} <small>${formatBytes(file.size)}</small></span>`).join('');
  }
  function bindAttachmentInputs() {
    document.querySelectorAll('.attachment-picker input[type=file]').forEach(input => {
      if (input.dataset.attachmentBound === '1') return;
      input.dataset.attachmentBound = '1';
      input.addEventListener('change', () => renderSelectedFiles(input));
      renderSelectedFiles(input);
    });
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
      try { await global.CCRefreshTicket(); return; } catch {}
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

  global.CCAttachments = { uploadFiles, refresh:refreshAttachments, decorate:decorateMessages, getReplyToMessageId:() => replyTarget?.id || null, clearReplyTarget };

  document.addEventListener('DOMContentLoaded', () => {
    bindAttachmentInputs();
    bindImageModal();
    bindMessageReplies();
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
