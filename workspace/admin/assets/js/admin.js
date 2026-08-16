(function(){
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = document.body.dataset.page || '';
  const LOGIN = '/workspace/admin/loginAdmin.html';
  const DASH = '/workspace/admin/dashboardAdmin.html';
  const RESET = '/workspace/admin/changePasswordAdmin.html';
  const STATUS_LABELS = { aberto:'Aberto', em_atendimento:'Em atendimento', aguardando_cliente:'Aguardando cliente', resolvido:'Resolvido', fechado:'Fechado' };
  const PRIORITY_LABELS = { baixa:'Baixa', media:'Média', alta:'Alta', urgente:'Urgente' };
  const CATEGORY_LABELS = { suporte:'Suporte', rede:'Rede', wifi:'Wi-Fi', servidor:'Servidor', seguranca:'Segurança', backup:'Backup', email:'E-mail', acesso:'Acesso', equipamento:'Equipamento', outro:'Outro' };

  function escapeHtml(value='') {
    return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
  }
  function initials(name='') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(v => v[0]).join('').toUpperCase() || 'CC'; }
  function fmtDate(value, withTime = false) {
    if (!value) return '—';
    const parsed = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', withTime ? { dateStyle:'short', timeStyle:'short' } : { dateStyle:'short' }).format(parsed);
  }
  function statusPill(status) { return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`; }
  function priorityPill(priority) { return `<span class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(PRIORITY_LABELS[priority] || priority)}</span>`; }
  function toast(message, type='success') {
    let wrap = $('.portal-toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'portal-toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = `portal-toast ${type}`;
    el.innerHTML = `<i class="bi ${type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'}"></i><span>${escapeHtml(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4300);
  }
  function loading(show) {
    let el = $('.loading-overlay');
    if (show && !el) { el = document.createElement('div'); el.className = 'loading-overlay'; el.innerHTML = '<div class="loading-spinner"></div>'; document.body.appendChild(el); }
    if (!show && el) el.remove();
  }

  async function currentAdmin() {
    const data = await CCAdminApi.me();
    window.CCAdmin = data.user;
    window.CCMustChangePassword = data.mustChangePassword === true;
    return data;
  }
  function hydrateShell(user) {
    $$('.js-admin-name').forEach(el => el.textContent = user.name);
    $$('.js-admin-email').forEach(el => el.textContent = user.email);
    $$('.js-admin-initials').forEach(el => el.textContent = initials(user.name));
    $$('.js-admin-role').forEach(el => el.textContent = user.role === 'admin' ? 'Administrador' : 'Suporte');
    const active = page === 'admin-ticket' ? 'admin-tickets' : page;
    $$('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === active));
    $('#sidebarToggle')?.addEventListener('click', () => $('#portalSidebar')?.classList.toggle('open'));
    document.addEventListener('click', event => {
      const sidebar = $('#portalSidebar');
      if (innerWidth <= 900 && sidebar?.classList.contains('open') && !sidebar.contains(event.target) && !$('#sidebarToggle')?.contains(event.target)) sidebar.classList.remove('open');
    });
    $('#logoutButton')?.addEventListener('click', async () => { try { await CCAdminApi.logout(); } catch {} location.replace(LOGIN); });
  }
  async function ensureAdmin() {
    try {
      const data = await currentAdmin();
      if (data.mustChangePassword && page !== 'change-password-admin') {
        location.replace(RESET);
        throw new Error('PASSWORD_CHANGE_REDIRECT');
      }
      hydrateShell(data.user);
      return data.user;
    } catch (error) {
      if (error.status === 401) location.replace(`${LOGIN}?expired=1`);
      else if (error.status === 428 || error.code === 'PASSWORD_CHANGE_REQUIRED') location.replace(RESET);
      else if (error.message !== 'PASSWORD_CHANGE_REDIRECT') toast(error.message, 'error');
      throw error;
    }
  }

  async function initLogin() {
    try {
      const data = await currentAdmin();
      location.replace(data.mustChangePassword ? RESET : DASH);
      return;
    } catch {}
    const params = new URLSearchParams(location.search);
    if (params.get('expired')) {
      const alert = $('#loginAlert');
      if (alert) { alert.textContent = 'Sua sessão administrativa expirou. Entre novamente.'; alert.classList.add('show'); }
    }
    $('#togglePassword')?.addEventListener('click', () => {
      const input = $('#password');
      input.type = input.type === 'password' ? 'text' : 'password';
      $('#togglePassword i').className = `bi ${input.type === 'password' ? 'bi-eye' : 'bi-eye-slash'}`;
    });
    $('#adminLoginForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const alert = $('#loginAlert'); alert?.classList.remove('show');
      const button = $('#loginSubmit'); button.disabled = true; button.innerHTML = '<span class="spinner-border"></span> Entrando...';
      try {
        const data = await CCAdminApi.login({ email: $('#email').value, password: $('#password').value });
        location.replace(data.mustChangePassword ? RESET : DASH);
      } catch (error) {
        if (alert) { alert.textContent = error.message; alert.classList.add('show'); }
        button.disabled = false; button.innerHTML = 'Entrar no painel <i class="bi bi-arrow-right"></i>';
      }
    });
  }

  async function initPasswordChange() {
    const data = await currentAdmin().catch(error => {
      if (error.status === 401) location.replace(LOGIN);
      throw error;
    });
    const user = data.user;
    $('.reset-admin-name') && ($('.reset-admin-name').textContent = user.name);
    $('.reset-admin-email') && ($('.reset-admin-email').textContent = user.email);
    $('#adminPasswordForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const currentPassword = $('#currentPassword').value;
      const newPassword = $('#newPassword').value;
      const confirmPassword = $('#confirmPassword').value;
      const alert = $('#passwordAlert'); alert?.classList.remove('show');
      if (newPassword !== confirmPassword) {
        if (alert) { alert.textContent = 'A confirmação da nova senha não confere.'; alert.classList.add('show'); }
        return;
      }
      const button = $('#changePasswordButton'); button.disabled = true; button.textContent = 'Salvando nova senha...';
      try {
        await CCAdminApi.changePassword({ currentPassword, newPassword });
        if (alert) { alert.textContent = 'Senha redefinida com sucesso. Faça login novamente.'; alert.classList.add('show', 'success'); }
        setTimeout(() => location.replace(LOGIN), 1100);
      } catch (error) {
        if (alert) { alert.textContent = error.message; alert.classList.add('show'); }
        button.disabled = false; button.textContent = 'Redefinir senha';
      }
    });
  }

  function adminTicketRow(ticket) {
    return `<tr data-ticket-id="${escapeHtml(ticket.id)}">
      <td><span class="ticket-title">${escapeHtml(ticket.title)}</span><span class="ticket-number">${escapeHtml(ticket.ticketNumber)}</span></td>
      <td><strong class="table-org">${escapeHtml(ticket.organizationName || 'Empresa')}</strong><span class="table-sub">${escapeHtml(ticket.requester?.name || '')}</span></td>
      <td>${priorityPill(ticket.priority)}</td>
      <td>${statusPill(ticket.status)}</td>
      <td><span>${escapeHtml(ticket.assignedName || 'Não atribuído')}</span></td>
      <td>${fmtDate(ticket.updatedAt, true)}</td>
      <td><i class="bi bi-chevron-right"></i></td>
    </tr>`;
  }
  function bindTicketRows() {
    $$('tr[data-ticket-id]').forEach(row => { row.style.cursor = 'pointer'; row.onclick = () => location.href = `ticketAdmin.html?id=${encodeURIComponent(row.dataset.ticketId)}`; });
  }

  async function initDashboard() {
    const data = await CCAdminApi.dashboard();
    const stats = {
      activeTickets: data.stats.ativos,
      openTickets: data.stats.abertos,
      inProgressTickets: data.stats.emAtendimento,
      urgentTickets: data.stats.urgentes,
      clientCount: data.stats.clientes,
      userCount: data.stats.usuarios
    };
    Object.entries(stats).forEach(([id, value]) => { const el = $(`#${id}`); if (el) el.textContent = value; });
    const tbody = $('#recentTicketsBody');
    if (!tbody) return;
    if (!data.recentTickets.length) tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-inbox"></i><h3>Nenhum chamado ainda</h3><p>Os chamados dos clientes aparecerão aqui.</p></div></td></tr>';
    else { tbody.innerHTML = data.recentTickets.map(adminTicketRow).join(''); bindTicketRows(); }
  }

  async function initTickets() {
    let currentPage = 1;
    const load = async () => {
      const params = {
        page: currentPage,
        search: $('#ticketSearch')?.value || '',
        status: $('#statusFilter')?.value || '',
        priority: $('#priorityFilter')?.value || ''
      };
      const tbody = $('#ticketsBody');
      tbody.innerHTML = '<tr><td colspan="7" style="padding:35px;text-align:center;color:#89939b">Carregando chamados...</td></tr>';
      try {
        const data = await CCAdminApi.tickets(params);
        if (!data.tickets.length) tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-ticket-perforated"></i><h3>Nenhum chamado encontrado</h3><p>Ajuste os filtros e tente novamente.</p></div></td></tr>';
        else { tbody.innerHTML = data.tickets.map(adminTicketRow).join(''); bindTicketRows(); }
        $('#paginationInfo').textContent = `Página ${data.pagination.page} de ${data.pagination.pages} • ${data.pagination.total} chamado(s)`;
        $('#prevPage').disabled = data.pagination.page <= 1;
        $('#nextPage').disabled = data.pagination.page >= data.pagination.pages;
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-exclamation-circle"></i><h3>Não foi possível carregar</h3><p>${escapeHtml(error.message)}</p></div></td></tr>`;
      }
    };
    let timer;
    $('#ticketSearch')?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { currentPage = 1; load(); }, 300); });
    $('#statusFilter')?.addEventListener('change', () => { currentPage = 1; load(); });
    $('#priorityFilter')?.addEventListener('change', () => { currentPage = 1; load(); });
    $('#prevPage')?.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); load(); });
    $('#nextPage')?.addEventListener('click', () => { currentPage++; load(); });
    await load();
  }

  function renderAdminMessages(messages) {
    const wrap = $('#messages');
    if (!wrap) return;
    wrap.innerHTML = messages.map(msg => `<div class="message ${msg.authorType === 'admin' ? 'admin-message' : 'client'} ${msg.internal ? 'internal-message' : ''}" data-message-id="${escapeHtml(msg.id)}">
      <div class="message-avatar">${escapeHtml(initials(msg.authorName))}</div>
      <div class="message-bubble">
        <div class="message-meta"><strong>${escapeHtml(msg.authorName)}</strong><span>${msg.internal ? 'Nota interna • ' : ''}${fmtDate(msg.createdAt, true)}</span></div>
        ${msg.replyTo ? `<button class="message-reply-reference" type="button" data-scroll-message="${escapeHtml(msg.replyTo.id)}"><small><i class="bi bi-reply"></i> Respondendo a ${escapeHtml(msg.replyTo.authorName)}</small><span>${escapeHtml(msg.replyTo.message)}</span></button>` : ''}
        <p>${escapeHtml(msg.message)}</p>
        ${msg.internal ? '' : `<div class="message-actions"><button class="message-reply-action" type="button" data-reply-message-id="${escapeHtml(msg.id)}" data-reply-author="${escapeHtml(msg.authorName)}" data-reply-excerpt="${escapeHtml(msg.message.slice(0,220))}"><i class="bi bi-reply"></i>Responder</button></div>`}
      </div>
    </div>`).join('');
    wrap.scrollTop = wrap.scrollHeight;
  }

  async function initTicket() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { location.replace('ticketsAdmin.html'); return; }
    let first = true;
    let currentAssigneeId = '';
    const refresh = async () => {
      const data = await CCAdminApi.ticket(id);
      const ticket = data.ticket;
      $('#ticketTitle').textContent = ticket.title;
      $('#ticketNumber').textContent = ticket.ticketNumber;
      $('#ticketNumberSide') && ($('#ticketNumberSide').textContent = ticket.ticketNumber);
      $('#ticketCompany').textContent = data.organization?.name || ticket.organizationName || 'Empresa';
      $('#ticketRequester').textContent = `${ticket.requester?.name || 'Solicitante'} • ${ticket.requester?.email || ''}`;
      $('#ticketCreated').textContent = fmtDate(ticket.createdAt, true);
      $('#ticketUpdated').textContent = fmtDate(ticket.updatedAt, true);
      $('#ticketCategory').textContent = CATEGORY_LABELS[ticket.category] || ticket.category;
      $('#ticketStatusBadge').innerHTML = statusPill(ticket.status);
      $('#ticketPriorityBadge').innerHTML = priorityPill(ticket.priority);
      renderAdminMessages(data.messages);
      if (first) {
        $('#statusControl').innerHTML = Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
        $('#priorityControl').innerHTML = Object.entries(PRIORITY_LABELS).map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
        $('#assigneeControl').innerHTML = '<option value="">Não atribuído</option>' + data.team.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>`).join('');
        first = false;
      }
      $('#statusControl').value = ticket.status;
      $('#priorityControl').value = ticket.priority;
      currentAssigneeId = ticket.assignedTo || '';
      $('#assigneeControl').value = currentAssigneeId;
      const resolveButton = $('#resolveTicket');
      if (resolveButton) resolveButton.hidden = ['resolvido','fechado'].includes(ticket.status);
      if (window.CCAttachments) await window.CCAttachments.refresh();
      return ticket;
    };
    await refresh();
    window.CCRefreshTicket = refresh;
    window.dispatchEvent(new CustomEvent('cc:ticket-ready', { detail: { id } }));

    $('#saveTicketControls')?.addEventListener('click', async () => {
      const button = $('#saveTicketControls');
      const nextAssigneeId = $('#assigneeControl').value || '';
      const assigneeChanged = nextAssigneeId !== currentAssigneeId;
      let reason = '';
      let unassign = false;
      if (assigneeChanged && currentAssigneeId) {
        reason = $('#transferReason')?.value.trim() || '';
        unassign = !nextAssigneeId;
        if (reason.length < 3) {
          toast(unassign ? 'Informe o motivo para deixar o chamado sem responsável.' : 'Informe o motivo da transferência antes de trocar o responsável.', 'error');
          $('#transferReason')?.focus();
          return;
        }
      }
      button.disabled = true;
      try {
        await CCAdminApi.updateTicket(id, { status: $('#statusControl').value, priority: $('#priorityControl').value });
        if (assigneeChanged) {
          await CCAdminApi.transferTicket(id, { assignedTo: nextAssigneeId, reason, unassign });
          if ($('#transferReason')) $('#transferReason').value = '';
        }
        toast(assigneeChanged ? 'Chamado atualizado e responsável salvo.' : 'Chamado atualizado.');
        await refresh();
        if (typeof window.CCReloadTransferPanel === 'function') await window.CCReloadTransferPanel();
      } catch (error) {
        toast(error.message, 'error');
        await refresh().catch(() => {});
      } finally { button.disabled = false; }
    });
    $('#resolveTicket')?.addEventListener('click', async () => {
      if (!confirm('Concluir este chamado como resolvido? O histórico continuará disponível e o cliente poderá visualizar a conclusão.')) return;
      const button = $('#resolveTicket');
      button.disabled = true;
      try {
        await CCAdminApi.updateTicket(id, { status: 'resolvido' });
        toast('Chamado concluído como resolvido.');
        await refresh();
      } catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; }
    });

    $('#replyForm')?.addEventListener('submit', async event => {
      event.preventDefault(); const message = $('#replyMessage').value.trim(); if (!message) return;
      const button = $('#sendReply'); button.disabled = true;
      try {
        const replyToMessageId = window.CCAttachments?.getReplyToMessageId?.() || null;
        const sent = await CCAdminApi.sendMessage(id, { message, internal:false, replyToMessageId });
        $('#replyMessage').value = '';
        window.CCAttachments?.clearReplyTarget?.();
        if (window.CCAttachments) {
          try { await window.CCAttachments.uploadFiles({ messageId: sent.message.id, input: $('#replyAttachments') }); }
          catch (uploadError) { toast(`Resposta enviada, mas o anexo falhou: ${uploadError.message}`, 'error'); }
        }
        toast('Resposta enviada ao cliente.');
        await refresh();
      }
      catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; }
    });
    $('#internalNoteForm')?.addEventListener('submit', async event => {
      event.preventDefault(); const message = $('#internalNote').value.trim(); if (!message) return;
      const button = $('#sendInternalNote'); button.disabled = true;
      try {
        const sent = await CCAdminApi.sendMessage(id, { message, internal:true });
        $('#internalNote').value = '';
        if (window.CCAttachments) {
          try { await window.CCAttachments.uploadFiles({ messageId: sent.message.id, input: $('#internalNoteAttachments') }); }
          catch (uploadError) { toast(`Nota salva, mas o anexo falhou: ${uploadError.message}`, 'error'); }
        }
        toast('Nota interna adicionada.');
        await refresh();
      }
      catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; }
    });
  }

  async function initClients() {
    let currentPage = 1;
    let selectedClientId = null;
    const loadClients = async () => {
      const tbody = $('#clientsBody');
      tbody.innerHTML = '<tr><td colspan="6" style="padding:35px;text-align:center;color:#89939b">Carregando clientes...</td></tr>';
      try {
        const data = await CCAdminApi.clients({ page: currentPage, search: $('#clientSearch')?.value || '' });
        if (!data.clients.length) tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="bi bi-buildings"></i><h3>Nenhum cliente encontrado</h3><p>Cadastre a primeira empresa pelo formulário ao lado.</p></div></td></tr>';
        else tbody.innerHTML = data.clients.map(client => `<tr>
          <td><strong class="table-org">${escapeHtml(client.name)}</strong><span class="table-sub">${escapeHtml(client.code)}</span></td>
          <td>${escapeHtml(client.supportTier || '—')}</td>
          <td>${client.activeUsers}/${client.users}</td>
          <td>${client.activeTickets}</td>
          <td><span class="admin-state ${client.active ? 'active' : 'inactive'}">${client.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><div class="row-actions"><button class="icon-action js-manage-client" data-id="${escapeHtml(client.id)}" data-name="${escapeHtml(client.name)}" type="button" title="Gerenciar usuários"><i class="bi bi-people"></i></button><button class="icon-action js-toggle-client" data-id="${escapeHtml(client.id)}" data-active="${client.active}" type="button" title="${client.active ? 'Desativar' : 'Ativar'}"><i class="bi ${client.active ? 'bi-pause-circle' : 'bi-play-circle'}"></i></button></div></td>
        </tr>`).join('');
        $('#clientsPaginationInfo').textContent = `Página ${data.pagination.page} de ${data.pagination.pages} • ${data.pagination.total} cliente(s)`;
        $('#clientsPrevPage').disabled = data.pagination.page <= 1;
        $('#clientsNextPage').disabled = data.pagination.page >= data.pagination.pages;
        $$('.js-toggle-client').forEach(button => button.onclick = async () => {
          try { await CCAdminApi.updateClient(button.dataset.id, { active: button.dataset.active !== 'true' }); toast('Status do cliente atualizado.'); await loadClients(); }
          catch (error) { toast(error.message, 'error'); }
        });
        $$('.js-manage-client').forEach(button => button.onclick = async () => { selectedClientId = button.dataset.id; $('#selectedClientName').textContent = button.dataset.name; $('#userOrganizationId').value = selectedClientId; $('#clientUsersPanel').classList.remove('hidden'); await loadUsers(); });
      } catch (error) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-exclamation-circle"></i><h3>Erro ao carregar</h3><p>${escapeHtml(error.message)}</p></div></td></tr>`; }
    };
    const loadUsers = async () => {
      if (!selectedClientId) return;
      const tbody = $('#clientUsersBody'); tbody.innerHTML = '<tr><td colspan="5" style="padding:25px;text-align:center;color:#89939b">Carregando...</td></tr>';
      try {
        const data = await CCAdminApi.users(selectedClientId);
        tbody.innerHTML = data.users.length ? data.users.map(user => `<tr>
          <td><strong>${escapeHtml(user.name)}</strong><span class="table-sub">${escapeHtml(user.email)}</span></td>
          <td>${user.lastLoginAt ? fmtDate(user.lastLoginAt, true) : 'Nunca'}</td>
          <td>${user.forcePasswordChange ? '<span class="admin-state warning">Troca pendente</span>' : '<span class="admin-state active">Normal</span>'}</td>
          <td><span class="admin-state ${user.active ? 'active' : 'inactive'}">${user.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><div class="row-actions"><button class="icon-action js-reset-user" data-id="${escapeHtml(user.id)}" type="button" title="Redefinir senha"><i class="bi bi-key"></i></button><button class="icon-action js-toggle-user" data-id="${escapeHtml(user.id)}" data-active="${user.active}" type="button" title="${user.active ? 'Desativar' : 'Ativar'}"><i class="bi ${user.active ? 'bi-person-dash' : 'bi-person-check'}"></i></button></div></td>
        </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><p>Nenhum usuário cadastrado.</p></div></td></tr>';
        $$('.js-toggle-user').forEach(button => button.onclick = async () => { try { await CCAdminApi.updateUser(button.dataset.id, { active: button.dataset.active !== 'true' }); toast('Usuário atualizado.'); await loadUsers(); } catch (error) { toast(error.message, 'error'); } });
        $$('.js-reset-user').forEach(button => button.onclick = async () => {
          const newPassword = prompt('Digite a nova senha temporária (mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo):');
          if (!newPassword) return;
          try { await CCAdminApi.updateUser(button.dataset.id, { newPassword }); toast('Senha do usuário redefinida. As sessões anteriores foram invalidadas.'); await loadUsers(); }
          catch (error) { toast(error.message, 'error'); }
        });
      } catch (error) { toast(error.message, 'error'); }
    };

    let timer;
    $('#clientSearch')?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { currentPage = 1; loadClients(); }, 300); });
    $('#clientsPrevPage')?.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); loadClients(); });
    $('#clientsNextPage')?.addEventListener('click', () => { currentPage++; loadClients(); });
    $('#createClientForm')?.addEventListener('submit', async event => {
      event.preventDefault(); const button = $('#createClientButton'); button.disabled = true;
      try {
        await CCAdminApi.createClient({ companyName: $('#companyName').value, code: $('#companyCode').value, supportTier: $('#supportTier').value, userName: $('#firstUserName').value, email: $('#firstUserEmail').value, password: $('#firstUserPassword').value });
        event.target.reset(); toast('Cliente e primeiro usuário criados.'); currentPage = 1; await loadClients();
      } catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; }
    });
    $('#createUserForm')?.addEventListener('submit', async event => {
      event.preventDefault(); if (!selectedClientId) return;
      const button = $('#createUserButton'); button.disabled = true;
      try {
        await CCAdminApi.createUser({ organizationId: selectedClientId, name: $('#newUserName').value, email: $('#newUserEmail').value, phone: $('#newUserPhone').value, password: $('#newUserPassword').value });
        event.target.reset(); $('#userOrganizationId').value = selectedClientId; toast('Novo acesso criado.'); await loadUsers(); await loadClients();
      } catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; }
    });
    await loadClients();
  }

  async function initTeam() {
    const data = await CCAdminApi.team();
    const tbody = $('#teamBody');
    tbody.innerHTML = data.team.map(user => `<tr>
      <td><span class="team-avatar">${escapeHtml(initials(user.name))}</span></td>
      <td><strong class="table-org">${escapeHtml(user.name)}</strong><span class="table-sub">${escapeHtml(user.email)}</span></td>
      <td>${user.role === 'admin' ? 'Administrador' : 'Suporte'}</td>
      <td>${user.lastLoginAt ? fmtDate(user.lastLoginAt, true) : 'Nunca'}</td>
      <td>${user.forcePasswordChange ? '<span class="admin-state warning">Redefinição pendente</span>' : '<span class="admin-state active">Acesso normal</span>'}</td>
      <td><span class="admin-state ${user.active ? 'active' : 'inactive'}">${user.active ? 'Ativo' : 'Inativo'}</span></td>
    </tr>`).join('');
  }

  async function boot() {
    if (page === 'login-admin') { await initLogin(); return; }
    if (page === 'change-password-admin') { await initPasswordChange(); return; }
    loading(true);
    try {
      await ensureAdmin();
      if (page === 'admin-dashboard') await initDashboard();
      if (page === 'admin-tickets') await initTickets();
      if (page === 'admin-ticket') await initTicket();
      if (page === 'admin-clients') await initClients();
      if (page === 'admin-team') await initTeam();
    } catch (error) {
      if (error.status !== 401 && error.message !== 'PASSWORD_CHANGE_REDIRECT') console.error(error);
    } finally { loading(false); }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
