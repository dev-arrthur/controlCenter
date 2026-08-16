(function(){
  'use strict';

  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const page = document.body.dataset.page || '';
  const LOGIN = '/workspace/client/loginClient.html';
  const DASH = '/workspace/client/dashboard.html';
  const STATUS_LABELS = { aberto:'Aberto', em_atendimento:'Em atendimento', aguardando_cliente:'Aguardando você', resolvido:'Resolvido', fechado:'Fechado' };
  const PRIORITY_LABELS = { baixa:'Baixa', media:'Média', alta:'Alta', urgente:'Urgente' };
  const CATEGORY_LABELS = { suporte:'Suporte', rede:'Rede', wifi:'Wi-Fi', servidor:'Servidor', seguranca:'Segurança', backup:'Backup', email:'E-mail', acesso:'Acesso', equipamento:'Equipamento', outro:'Outro' };

  function escapeHtml(value='') {
    return String(value).replace(/[&<>'\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','\"':'&quot;'}[char]));
  }
  function initials(name='') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase() || 'CC'; }
  function date(value, withTime=false) {
    if (!value) return '—';
    const parsed = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', withTime ? {dateStyle:'short',timeStyle:'short'} : {dateStyle:'short'}).format(parsed);
  }
  function toast(message, type='success') {
    let wrap = $('.portal-toast-wrap');
    if (!wrap) { wrap=document.createElement('div'); wrap.className='portal-toast-wrap'; document.body.appendChild(wrap); }
    const el=document.createElement('div'); el.className=`portal-toast ${type}`; el.innerHTML=`<i class="bi ${type==='error'?'bi-exclamation-circle':'bi-check-circle'}"></i><span>${escapeHtml(message)}</span>`; wrap.appendChild(el); setTimeout(()=>el.remove(),4200);
  }
  function loading(show) {
    let el=$('.loading-overlay');
    if(show && !el){el=document.createElement('div');el.className='loading-overlay';el.innerHTML='<div class="loading-spinner"></div>';document.body.appendChild(el)}
    if(!show && el) el.remove();
  }
  function statusPill(status){ return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status]||status)}</span>`; }
  function priorityPill(priority){ return `<span class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(PRIORITY_LABELS[priority]||priority)}</span>`; }

  async function ensureAuth() {
    try {
      const result=await CCApi.me();
      window.CCUser=result.user;
      hydrateShell(result.user);
      return result.user;
    } catch(error) {
      if(error.status===401) location.replace(`${LOGIN}?expired=1`);
      else toast(error.message,'error');
      throw error;
    }
  }

  function hydrateShell(user) {
    $$('.js-user-name').forEach(el=>el.textContent=user.name);
    $$('.js-user-email').forEach(el=>el.textContent=user.email);
    $$('.js-org-name').forEach(el=>el.textContent=user.organization.name);
    $$('.js-user-initials').forEach(el=>el.textContent=initials(user.name));
    const activeNav=page==='ticket'?'tickets':page; $$('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===activeNav));

    $('#sidebarToggle')?.addEventListener('click',()=>$('#portalSidebar')?.classList.toggle('open'));
    document.addEventListener('click',e=>{
      const sidebar=$('#portalSidebar');
      if(innerWidth<=900 && sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !$('#sidebarToggle')?.contains(e.target)) sidebar.classList.remove('open');
    });
    $('#logoutButton')?.addEventListener('click',async()=>{try{await CCApi.logout()}catch{} location.replace(LOGIN)});
  }

  async function initLogin() {
    const params=new URLSearchParams(location.search);
    if(params.get('expired')) { const alert=$('#loginAlert'); if(alert){alert.textContent='Sua sessão expirou. Entre novamente para continuar.';alert.classList.add('show')} }
    $('#togglePassword')?.addEventListener('click',()=>{const input=$('#password');input.type=input.type==='password'?'text':'password';$('#togglePassword i').className=`bi ${input.type==='password'?'bi-eye':'bi-eye-slash'}`});
    $('#loginForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const alert=$('#loginAlert'); alert?.classList.remove('show');
      const button=$('#loginSubmit'); button.disabled=true; button.innerHTML='<span class="spinner-border"></span> Entrando...';
      try{
        await CCApi.login({email:$('#email').value,password:$('#password').value});
        location.replace(DASH);
      }catch(error){if(alert){alert.textContent=error.message;alert.classList.add('show')} button.disabled=false;button.innerHTML='Entrar no portal <i class="bi bi-arrow-right"></i>'}
    });
    $('#forgotLink')?.addEventListener('click',e=>{e.preventDefault();window.open('https://wa.me/5532984683427?text=Olá%20ControlCenter!%20Preciso%20de%20ajuda%20para%20recuperar%20meu%20acesso%20ao%20Portal%20do%20Cliente.','_blank','noopener')});
  }

  function ticketRow(ticket) {
    return `<tr data-href="ticket.html?id=${encodeURIComponent(ticket.id)}">
      <td><span class="ticket-title">${escapeHtml(ticket.title)}</span><span class="ticket-number">${escapeHtml(ticket.ticketNumber)}</span></td>
      <td>${escapeHtml(CATEGORY_LABELS[ticket.category]||ticket.category)}</td>
      <td>${priorityPill(ticket.priority)}</td>
      <td>${statusPill(ticket.status)}</td>
      <td>${date(ticket.updatedAt,true)}</td>
      <td><i class="bi bi-chevron-right"></i></td>
    </tr>`;
  }
  function bindRows(){ $$('tr[data-href]').forEach(row=>{row.style.cursor='pointer';row.onclick=()=>location.href=row.dataset.href}); }

  async function initDashboard() {
    const data=await CCApi.dashboard();
    const map={activeTickets:data.stats.ativos,openTickets:data.stats.abertos,inProgressTickets:data.stats.emAtendimento,waitingTickets:data.stats.aguardandoCliente};
    Object.entries(map).forEach(([id,value])=>{const el=$(`#${id}`);if(el)el.textContent=value});
    const tbody=$('#recentTicketsBody');
    if(!tbody)return;
    if(!data.recentTickets.length){tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><i class="bi bi-inbox"></i><h3>Nenhum chamado ainda</h3><p>Quando precisar, abra seu primeiro chamado por aqui.</p><a class="primary-action" href="newTicket.html"><i class="bi bi-plus-lg"></i>Abrir chamado</a></div></td></tr>';return}
    tbody.innerHTML=data.recentTickets.map(ticketRow).join('');bindRows();
  }

  async function initTickets() {
    let currentPage=1;
    const load=async()=>{
      const params={page:currentPage,search:$('#ticketSearch')?.value||'',status:$('#statusFilter')?.value||''};
      const tbody=$('#ticketsBody'); tbody.innerHTML='<tr><td colspan="6" style="padding:35px;text-align:center;color:#89939b">Carregando chamados...</td></tr>';
      try{
        const data=await CCApi.tickets(params);
        if(!data.tickets.length){tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><i class="bi bi-ticket-perforated"></i><h3>Nenhum chamado encontrado</h3><p>Ajuste os filtros ou abra um novo chamado.</p></div></td></tr>'}
        else {tbody.innerHTML=data.tickets.map(ticketRow).join('');bindRows()}
        $('#paginationInfo').textContent=`Página ${data.pagination.page} de ${data.pagination.pages} • ${data.pagination.total} chamado(s)`;
        $('#prevPage').disabled=data.pagination.page<=1;$('#nextPage').disabled=data.pagination.page>=data.pagination.pages;
      }catch(error){tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state"><i class="bi bi-exclamation-circle"></i><h3>Não foi possível carregar</h3><p>${escapeHtml(error.message)}</p></div></td></tr>`}
    };
    let timer;
    $('#ticketSearch')?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{currentPage=1;load()},300)});
    $('#statusFilter')?.addEventListener('change',()=>{currentPage=1;load()});
    $('#prevPage')?.addEventListener('click',()=>{currentPage=Math.max(1,currentPage-1);load()});
    $('#nextPage')?.addEventListener('click',()=>{currentPage++;load()});
    await load();
  }

  async function initNewTicket() {
    $('#newTicketForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=$('#createTicketButton');button.disabled=true;button.textContent='Criando chamado...';
      try{
        const data=await CCApi.createTicket({title:$('#title').value,category:$('#category').value,priority:$('input[name="priority"]:checked')?.value,description:$('#description').value});
        toast(`Chamado ${data.ticket.ticketNumber} criado com sucesso.`);
        setTimeout(()=>location.href=`ticket.html?id=${encodeURIComponent(data.ticket.id)}`,500);
      }catch(error){toast(error.message,'error');button.disabled=false;button.innerHTML='<i class="bi bi-send"></i>Criar chamado'}
    });
  }

  function renderMessages(messages) {
    const wrap=$('#messages');
    wrap.innerHTML=messages.map(msg=>`<div class="message ${msg.authorType==='client'?'client':''}" data-message-id="${escapeHtml(msg.id)}"><div class="message-avatar">${escapeHtml(initials(msg.authorName))}</div><div class="message-bubble"><div class="message-meta"><strong>${escapeHtml(msg.authorName)}</strong><span>${date(msg.createdAt,true)}</span></div><p>${escapeHtml(msg.message)}</p></div></div>`).join('');
    wrap.scrollTop=wrap.scrollHeight;
  }

  async function initTicket() {
    const id=new URLSearchParams(location.search).get('id');
    if(!id){location.replace('tickets.html');return}
    const refresh=async()=>{
      const data=await CCApi.ticket(id); const t=data.ticket;
      $('#ticketTitle').textContent=t.title;$('#ticketNumber').textContent=t.ticketNumber;$('#ticketStatus').innerHTML=statusPill(t.status);$('#ticketPriority').innerHTML=priorityPill(t.priority);$('#ticketCategory').textContent=CATEGORY_LABELS[t.category]||t.category;$('#ticketCreated').textContent=date(t.createdAt,true);$('#ticketUpdated').textContent=date(t.updatedAt,true);
      renderMessages(data.messages);
      const isClosed=t.status==='fechado';$('#replySection')?.classList.toggle('hidden',isClosed);$('#closeTicket')?.classList.toggle('hidden',isClosed);$('#reopenTicket')?.classList.toggle('hidden',!['fechado','resolvido'].includes(t.status));
      if(window.CCAttachments) await window.CCAttachments.refresh();
      return t;
    };
    await refresh();
    window.CCRefreshTicket=refresh;
    window.dispatchEvent(new CustomEvent('cc:ticket-ready',{detail:{id}}));
    $('#replyForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const textarea=$('#replyMessage');const msg=textarea.value.trim();if(!msg)return;const btn=$('#sendReply');btn.disabled=true;
      try{
        const sent=await CCApi.sendMessage(id,msg);textarea.value='';
        if(window.CCAttachments){try{await window.CCAttachments.uploadFiles({messageId:sent.message.id,input:$('#replyAttachments')});}catch(uploadError){toast(`Mensagem enviada, mas o anexo falhou: ${uploadError.message}`,'error');}}
        await refresh();
      }catch(error){toast(error.message,'error')}finally{btn.disabled=false}
    });
    $('#closeTicket')?.addEventListener('click',async()=>{if(!confirm('Deseja encerrar este chamado?'))return;try{await CCApi.ticketAction(id,'close');toast('Chamado encerrado.');await refresh()}catch(error){toast(error.message,'error')}});
    $('#reopenTicket')?.addEventListener('click',async()=>{try{await CCApi.ticketAction(id,'reopen');toast('Chamado reaberto.');await refresh()}catch(error){toast(error.message,'error')}});
  }

  async function initProfile() {
    const user=window.CCUser;$('#profileName').value=user.name;$('#profileEmail').value=user.email;$('#profilePhone').value=user.phone||'';$('#profileOrg').textContent=user.organization.name;$('#profileBigInitials').textContent=initials(user.name);$('#profileDisplayName').textContent=user.name;
    $('#profileForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const data=await CCApi.updateProfile({name:$('#profileName').value,phone:$('#profilePhone').value});window.CCUser=data.user;hydrateShell(data.user);$('#profileBigInitials').textContent=initials(data.user.name);$('#profileDisplayName').textContent=data.user.name;toast('Perfil atualizado.')}catch(error){toast(error.message,'error')}});
    $('#passwordForm')?.addEventListener('submit',async e=>{e.preventDefault();const currentPassword=$('#currentPassword').value,newPassword=$('#newPassword').value,confirmPassword=$('#confirmPassword').value;if(newPassword!==confirmPassword){toast('A confirmação da nova senha não confere.','error');return}try{await CCApi.changePassword({currentPassword,newPassword});toast('Senha alterada. Entre novamente.');setTimeout(()=>location.replace(LOGIN),900)}catch(error){toast(error.message,'error')}});
  }

  async function boot() {
    if(page==='login'){await initLogin();return}
    loading(true);
    try{
      await ensureAuth();
      if(page==='dashboard') await initDashboard();
      if(page==='tickets') await initTickets();
      if(page==='new-ticket') await initNewTicket();
      if(page==='ticket') await initTicket();
      if(page==='profile') await initProfile();
    }catch(error){if(error.status!==401)console.error(error)}finally{loading(false)}
  }
  document.addEventListener('DOMContentLoaded',boot);
})();
