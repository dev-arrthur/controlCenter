(function(global){
  'use strict';
  const $ = s => document.querySelector(s);
  const ticketId = new URLSearchParams(location.search).get('id');
  let started = false;
  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function fmt(v){return v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';}
  function message(text,type='success'){
    const el=$('#transferAlert'); if(!el)return; el.textContent=text;el.dataset.type=type;el.hidden=false;clearTimeout(el._timer);el._timer=setTimeout(()=>el.hidden=true,4500);
  }
  async function load() {
    const [ticketData, historyData] = await Promise.all([global.CCAdminApi.ticket(ticketId), global.CCAdminApi.transferHistory(ticketId)]);
    const select = $('#transferAssignee');
    if (select) {
      select.innerHTML = '<option value="">Selecione o novo responsável</option>' + ticketData.team.filter(u=>u.id!==ticketData.ticket.assignedTo).map(u=>`<option value="${esc(u.id)}">${esc(u.name)} • ${u.role==='admin'?'Admin':'Suporte'}</option>`).join('');
    }
    const current=$('#currentAssignee'); if(current) current.textContent=ticketData.ticket.assignedName||'Não atribuído';
    const history=$('#transferHistory');
    if(history) history.innerHTML=historyData.transfers.length ? historyData.transfers.map(item=>`<div class="transfer-history-item"><span class="transfer-dot"></span><div><strong>${esc(item.toName||'Não atribuído')}</strong><small>Transferido por ${esc(item.byName||'Equipe')} • ${fmt(item.createdAt)}</small>${item.reason?`<p>${esc(item.reason)}</p>`:''}</div></div>`).join('') : '<div class="empty-mini">Nenhuma transferência registrada.</div>';
  }
  function bind() {
    $('#transferForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const assignedTo=$('#transferAssignee').value;
      const reason=$('#transferReason').value.trim();
      if(!assignedTo) return message('Selecione um integrante da equipe.','error');
      if(reason.length<3) return message('Informe o motivo da transferência.','error');
      const btn=$('#transferButton');btn.disabled=true;btn.textContent='Transferindo...';
      try{
        await global.CCAdminApi.transferTicket(ticketId,{assignedTo,reason});
        $('#transferReason').value='';
        message('Chamado transferido e registrado no histórico.');
        if(typeof global.CCRefreshTicket==='function') await global.CCRefreshTicket();
        await load();
      }catch(error){message(error.message,'error');}
      finally{btn.disabled=false;btn.innerHTML='<i class="bi bi-arrow-left-right"></i>Transferir chamado';}
    });
  }
  function boot(){
    if(started||document.body.dataset.page!=='admin-ticket'||!ticketId||!global.CCAdminApi)return;
    started=true;bind();load().catch(e=>message(e.message,'error'));
    global.addEventListener('cc:ticket-ready',()=>load().catch(()=>{}));
  }
  document.addEventListener('DOMContentLoaded',boot);
})(window);
