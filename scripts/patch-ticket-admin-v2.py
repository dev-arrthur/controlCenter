from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Stable attachment rendering + selected-file preview + no self-triggering observer.
p = Path('workspace/shared/ticketEnterprise.js')
text = p.read_text(encoding='utf-8')
old = '''  function decorateMessages() {\n    document.querySelectorAll('.message-attachments[data-enterprise="1"]').forEach(el => el.remove());\n    const grouped = new Map();\n    for (const item of attachments) {\n      if (!item.messageId) continue;\n      if (!grouped.has(item.messageId)) grouped.set(item.messageId, []);\n      grouped.get(item.messageId).push(item);\n    }\n    for (const [messageId, items] of grouped) {\n      const message = document.querySelector(`.message[data-message-id="${CSS.escape(messageId)}"]`);\n      const bubble = message?.querySelector('.message-bubble');\n      if (!bubble) continue;\n      const wrap = document.createElement('div');\n      wrap.className = 'message-attachments';\n      wrap.dataset.enterprise = '1';\n      wrap.innerHTML = items.map(attachmentMarkup).join('');\n      bubble.appendChild(wrap);\n    }\n  }'''
new = '''  function attachmentSignature(items) {\n    return items.map(item => `${item.id}:${item.sha256 || ''}:${item.archived ? '1' : '0'}`).join('|');\n  }\n  function decorateMessages() {\n    const grouped = new Map();\n    for (const item of attachments) {\n      if (!item.messageId) continue;\n      if (!grouped.has(item.messageId)) grouped.set(item.messageId, []);\n      grouped.get(item.messageId).push(item);\n    }\n    document.querySelectorAll('.message[data-message-id]').forEach(message => {\n      const messageId = message.dataset.messageId || '';\n      const bubble = message.querySelector('.message-bubble');\n      if (!bubble) return;\n      const items = grouped.get(messageId) || [];\n      let wrap = bubble.querySelector(':scope > .message-attachments[data-enterprise="1"]');\n      if (!items.length) { if (wrap) wrap.remove(); return; }\n      const signature = attachmentSignature(items);\n      if (!wrap) {\n        wrap = document.createElement('div');\n        wrap.className = 'message-attachments';\n        wrap.dataset.enterprise = '1';\n        bubble.appendChild(wrap);\n      }\n      if (wrap.dataset.signature === signature) return;\n      wrap.dataset.signature = signature;\n      wrap.innerHTML = items.map(attachmentMarkup).join('');\n    });\n  }\n  function renderSelectedFiles(input) {\n    if (!input) return;\n    let box = input.parentElement?.querySelector('.selected-attachments');\n    const files = [...(input.files || [])];\n    if (!files.length) { if (box) box.remove(); return; }\n    if (!box) { box = document.createElement('div'); box.className = 'selected-attachments'; input.insertAdjacentElement('afterend', box); }\n    box.innerHTML = files.map(file => `<span><i class="bi bi-paperclip"></i>${escapeHtml(file.name)} <small>${formatBytes(file.size)}</small></span>`).join('');\n  }\n  function bindAttachmentInputs() {\n    document.querySelectorAll('.attachment-picker input[type=file]').forEach(input => {\n      if (input.dataset.attachmentBound === '1') return;\n      input.dataset.attachmentBound = '1';\n      input.addEventListener('change', () => renderSelectedFiles(input));\n      renderSelectedFiles(input);\n    });\n  }'''
if old not in text: raise SystemExit('decorateMessages block not found')
text = text.replace(old, new, 1)
text = text.replace("    input.value = '';\n    await refreshAttachments();\n    return uploaded;", "    input.value = '';\n    renderSelectedFiles(input);\n    await refreshAttachments();\n    return uploaded;", 1)
text = text.replace("  async function refreshTicket() {\n    if (typeof global.CCRefreshTicket === 'function') {\n      try { await global.CCRefreshTicket(); } catch {}\n    }\n    await refreshAttachments();\n  }", "  async function refreshTicket() {\n    if (typeof global.CCRefreshTicket === 'function') {\n      try { await global.CCRefreshTicket(); return; } catch {}\n    }\n    await refreshAttachments();\n  }", 1)
old = "  const observer = new MutationObserver(() => decorateMessages());\n  document.addEventListener('DOMContentLoaded', () => {\n    const messages = document.getElementById('messages');\n    if (messages) observer.observe(messages, { childList:true, subtree:true });\n    refreshAttachments();\n    connectRealtime();\n  });"
new = "  document.addEventListener('DOMContentLoaded', () => {\n    bindAttachmentInputs();\n    refreshAttachments();\n    connectRealtime();\n  });"
if old not in text: raise SystemExit('observer block not found')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

p = Path('workspace/shared/portalEnterprise.css')
text = p.read_text(encoding='utf-8')
addon = '.selected-attachments{display:flex;flex-wrap:wrap;gap:6px;width:100%;margin-top:5px}.selected-attachments span{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:8px;background:#edf5fc;color:#174f82;font-size:10px;font-weight:700;max-width:100%}.selected-attachments span small{display:inline!important;color:#71808d!important;font-size:9px!important;font-weight:600}.selected-attachments i{font-size:11px}'
if addon not in text: text += addon
p.write_text(text, encoding='utf-8')

replace_once('workspace/admin/ticketAdmin.html','<label>Responsável atual<select id="assigneeControl" disabled></select></label><button id="saveTicketControls" class="primary-action" type="button"><i class="bi bi-check2"></i>Salvar status e prioridade</button>','<label>Responsável<select id="assigneeControl"></select><small style="font-weight:500;text-transform:none;letter-spacing:0;color:#82909a">Na primeira atribuição, basta selecionar e salvar. Para trocar um responsável existente, informe o motivo no bloco de transferência.</small></label><button id="saveTicketControls" class="primary-action" type="button"><i class="bi bi-check2"></i>Salvar alterações</button>')

p = Path('workspace/admin/assets/js/admin.js')
text = p.read_text(encoding='utf-8')
text = text.replace("    let first = true;\n    const refresh = async () => {", "    let first = true;\n    let currentAssigneeId = '';\n    const refresh = async () => {", 1)
text = text.replace("      $('#assigneeControl').value = ticket.assignedTo || '';\n      if (window.CCAttachments) await window.CCAttachments.refresh();", "      currentAssigneeId = ticket.assignedTo || '';\n      $('#assigneeControl').value = currentAssigneeId;\n      if (window.CCAttachments) await window.CCAttachments.refresh();", 1)
old = '''    $('#saveTicketControls')?.addEventListener('click', async () => {\n      const button = $('#saveTicketControls'); button.disabled = true;\n      try {\n        await CCAdminApi.updateTicket(id, { status: $('#statusControl').value, priority: $('#priorityControl').value });\n        toast('Chamado atualizado.'); await refresh();\n      } catch (error) { toast(error.message, 'error'); }\n      finally { button.disabled = false; }\n    });'''
new = '''    $('#saveTicketControls')?.addEventListener('click', async () => {\n      const button = $('#saveTicketControls');\n      const nextAssigneeId = $('#assigneeControl').value || '';\n      const assigneeChanged = nextAssigneeId !== currentAssigneeId;\n      let reason = '';\n      let unassign = false;\n      if (assigneeChanged && currentAssigneeId) {\n        reason = $('#transferReason')?.value.trim() || '';\n        unassign = !nextAssigneeId;\n        if (reason.length < 3) {\n          toast(unassign ? 'Informe o motivo para deixar o chamado sem responsável.' : 'Informe o motivo da transferência antes de trocar o responsável.', 'error');\n          $('#transferReason')?.focus();\n          return;\n        }\n      }\n      button.disabled = true;\n      try {\n        await CCAdminApi.updateTicket(id, { status: $('#statusControl').value, priority: $('#priorityControl').value });\n        if (assigneeChanged) {\n          await CCAdminApi.transferTicket(id, { assignedTo: nextAssigneeId, reason, unassign });\n          if ($('#transferReason')) $('#transferReason').value = '';\n        }\n        toast(assigneeChanged ? 'Chamado atualizado e responsável salvo.' : 'Chamado atualizado.');\n        await refresh();\n        if (typeof window.CCReloadTransferPanel === 'function') await window.CCReloadTransferPanel();\n      } catch (error) {\n        toast(error.message, 'error');\n        await refresh().catch(() => {});\n      } finally { button.disabled = false; }\n    });'''
if old not in text: raise SystemExit('save controls block not found')
text = text.replace(old, new, 1)
text = text.replace('Digite a nova senha temporária (mínimo 10 caracteres, com letras e números):','Digite a nova senha temporária (mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo):')
p.write_text(text, encoding='utf-8')

Path('workspace/admin/assets/js/ticketTransfer.js').write_text(r'''(function(global){
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
''',encoding='utf-8')

p=Path('api/admin-enterprise.js')
text=p.read_text(encoding='utf-8')
old="async function requireSession(req,res){const session=await authenticateCookieHeader(req.headers.cookie||'');if(!session||session.kind!=='admin')return fail(res,401,'UNAUTHENTICATED','Sessão administrativa expirada ou inválida.');if(session.user.forcePasswordChange===true)return fail(res,428,'PASSWORD_CHANGE_REQUIRED','Redefina sua senha antes de continuar.');return session;}"
new="async function requireSession(req,res){const session=await authenticateCookieHeader(req.headers.cookie||'');if(!session||session.kind!=='admin'){fail(res,401,'UNAUTHENTICATED','Sessão administrativa expirada ou inválida.');return null;}if(session.user.forcePasswordChange===true){fail(res,428,'PASSWORD_CHANGE_REQUIRED','Redefina sua senha antes de continuar.');return null;}return session;}"
if old not in text:raise SystemExit('requireSession anchor not found')
text=text.replace(old,new,1)
start=text.index('async function transfer(req,res,session){')
end=text.index('\nmodule.exports=async function handler',start)
transfer=r'''async function transfer(req,res,session){
  const id=ObjectId.isValid(req.query.id)?String(req.query.id):null;if(!id)return fail(res,400,'INVALID_TICKET','Chamado inválido.');
  const ticket=await authorizeTicket(session,id);if(!ticket)return fail(res,404,'TICKET_NOT_FOUND','Chamado não encontrado.');
  if(req.method==='GET'){
    const history=await session.db.collection('ticket_transfers').find({ticketId:ticket._id}).sort({createdAt:-1}).limit(30).toArray();
    return ok(res,{transfers:history.map(item=>({id:String(item._id),fromId:item.fromId?String(item.fromId):null,fromName:item.fromName||'',toId:item.toId?String(item.toId):null,toName:item.toName||'',byId:String(item.byId),byName:item.byName,reason:item.reason,eventType:item.eventType||'transfer',eventLabel:item.eventLabel||'Transferência',createdAt:item.createdAt}))});
  }
  if(req.method!=='POST')return fail(res,405,'METHOD_NOT_ALLOWED','Método não permitido.');
  if(!sameOrigin(req))return fail(res,403,'INVALID_ORIGIN','Origem não permitida.');
  const rate=await limit(session,req,'ticket-transfer',40,10*60*1000);if(!rate.allowed){res.setHeader('Retry-After',String(rate.retryAfter));return fail(res,429,'RATE_LIMITED','Muitas alterações de responsável em pouco tempo.');}
  const input=await parseBody(req);const reason=clean(input.reason,500);const wantsUnassign=input.unassign===true;let assignee=null;
  if(!wantsUnassign){const assignedId=ObjectId.isValid(input.assignedTo)?new ObjectId(input.assignedTo):null;if(!assignedId)return fail(res,422,'INVALID_ASSIGNEE','Selecione o novo responsável.');if(ticket.assignedTo&&String(ticket.assignedTo)===String(assignedId))return fail(res,409,'ALREADY_ASSIGNED','Este integrante já é o responsável pelo chamado.');assignee=await session.db.collection('users').findOne({_id:assignedId,role:{$in:ADMIN_ROLES},active:true});if(!assignee)return fail(res,422,'INVALID_ASSIGNEE','O novo responsável não está ativo na equipe.');}
  else if(!ticket.assignedTo)return fail(res,409,'ALREADY_UNASSIGNED','Este chamado já está sem responsável.');
  const isInitialAssignment=!ticket.assignedTo&&!wantsUnassign;
  if(!isInitialAssignment&&reason.length<3)return fail(res,422,'TRANSFER_REASON_REQUIRED',wantsUnassign?'Informe o motivo para deixar o chamado sem responsável.':'Informe o motivo da transferência.');
  const effectiveReason=reason||(isInitialAssignment?'Atribuição inicial pelo painel administrativo.':'Alteração de responsável.');
  const previous=ticket.assignedTo?await session.db.collection('users').findOne({_id:ticket.assignedTo}):null;const now=new Date();
  const eventType=wantsUnassign?'unassign':(isInitialAssignment?'assign':'transfer');const eventLabel=wantsUnassign?'Desatribuição':(isInitialAssignment?'Atribuição inicial':'Transferência');
  const set={assignedTo:assignee?assignee._id:null,assignedAt:assignee?now:null,assignedBy:session.user._id,updatedAt:now};if(assignee&&ticket.status==='aberto')set.status='em_atendimento';
  await session.db.collection('tickets').updateOne({_id:ticket._id},{$set:set});
  const log={ticketId:ticket._id,organizationId:ticket.organizationId,fromId:previous?previous._id:null,fromName:previous?.name||'',toId:assignee?assignee._id:null,toName:assignee?.name||'Não atribuído',byId:session.user._id,byName:session.user.name,reason:effectiveReason,eventType,eventLabel,createdAt:now};
  const inserted=await session.db.collection('ticket_transfers').insertOne(log);log._id=inserted.insertedId;
  await audit(session.db,{organizationId:ticket.organizationId,userId:session.user._id,action:`ticket.${eventType}`,entityType:'ticket',entityId:ticket._id,metadata:{ticketNumber:ticket.ticketNumber,from:previous?hashSensitive(String(previous._id),'user-id'):null,to:assignee?hashSensitive(String(assignee._id),'user-id'):null,reason:effectiveReason}});
  return ok(res,{transfer:{id:String(log._id),fromName:log.fromName,toName:log.toName,byName:log.byName,reason:effectiveReason,eventType,eventLabel,createdAt:now},assignment:{assignedTo:assignee?String(assignee._id):null,assignedName:assignee?.name||''}});
}
'''
text=text[:start]+transfer+text[end:]
text=text.replace("const session=await requireSession(req,res);if(!session||session.ok===false)return;","const session=await requireSession(req,res);if(!session)return;",1)
p.write_text(text,encoding='utf-8')
print('Patch applied successfully')
