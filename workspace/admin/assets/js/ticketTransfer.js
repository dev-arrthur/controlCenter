(function(global){
  'use strict';
  const $ = s => document.querySelector(s);
  const ticketId = new URLSearchParams(location.search).get('id');
  let started = false;
  let loading = false;
  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function fmt(v){return v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';}
  function message(text,type='success'){const el=$('#transferAlert');if(!el)return;el.textContent=text;el.dataset.type=type;el.hidden=false;clearTimeout(el._timer);el._timer=setTimeout(()=>el.hidden=true,4500);}
  async function load(){
    if(loading||!ticketId||!global.CCAdminApi)return;loading=true;
    try{
      const [ticketData,historyData]=await Promise.all([global.CCAdminApi.ticket(ticketId),global.CCAdminApi.transferHistory(ticketId)]);
      const currentId=ticketData.ticket.assignedTo||'';
      const select=$('#transferAssignee');
      if(select){
        const options=ticketData.team.filter(u=>u.id!==currentId).map(u=>`<option value="${esc(u.id)}">${esc(u.name)} • ${u.role==='admin'?'Admin':'Suporte'}</option>`).join('');
        const unassign=currentId?'<option value="__unassign__">Deixar sem responsável</option>':'';
        select.innerHTML='<option value="">Selecione o novo responsável</option>'+options+unassign;
      }
      const current=$('#currentAssignee');if(current)current.textContent=ticketData.ticket.assignedName||'Não atribuído';
      const history=$('#transferHistory');
      if(history)history.innerHTML=historyData.transfers.length?historyData.transfers.map(item=>`<div class="transfer-history-item"><span class="transfer-dot"></span><div><strong>${esc(item.toName||'Não atribuído')}</strong><small>${esc(item.eventLabel||'Transferência')} por ${esc(item.byName||'Equipe')} • ${fmt(item.createdAt)}</small>${item.reason?`<p>${esc(item.reason)}</p>`:''}</div></div>`).join(''):'<div class="empty-mini">Nenhuma atribuição ou transferência registrada.</div>';
    }finally{loading=false;}
  }
  function bind(){
    $('#transferForm')?.addEventListener('submit',async event=>{
      event.preventDefault();const raw=$('#transferAssignee').value;const unassign=raw==='__unassign__';const assignedTo=unassign?'':raw;const reason=$('#transferReason').value.trim();
      if(!raw)return message('Selecione um integrante da equipe ou a opção de deixar sem responsável.','error');
      if(reason.length<3)return message('Informe o motivo da alteração de responsável.','error');
      const btn=$('#transferButton');btn.disabled=true;btn.textContent=unassign?'Removendo responsável...':'Transferindo...';
      try{await global.CCAdminApi.transferTicket(ticketId,{assignedTo,reason,unassign});$('#transferReason').value='';message(unassign?'Chamado ficou sem responsável e a alteração foi auditada.':'Responsável alterado e registrado no histórico.');if(typeof global.CCRefreshTicket==='function')await global.CCRefreshTicket();await load();}
      catch(error){message(error.message,'error');}
      finally{btn.disabled=false;btn.innerHTML='<i class="bi bi-arrow-left-right"></i>Transferir chamado';}
    });
  }
  function boot(){if(started||document.body.dataset.page!=='admin-ticket'||!ticketId||!global.CCAdminApi)return;started=true;bind();load().catch(e=>message(e.message,'error'));}
  global.CCReloadTransferPanel=load;
  document.addEventListener('DOMContentLoaded',boot);
  global.addEventListener('cc:ticket-ready',()=>load().catch(()=>{}));
})(window);
