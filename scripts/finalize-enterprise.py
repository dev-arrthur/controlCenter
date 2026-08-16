from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'patch target not found: {label}')
    return text.replace(old, new, 1)


# Client: remove invalid/invented SRI from Socket.IO CDN include.
p = Path('workspace/client/ticket.html')
s = p.read_text()
s = re.sub(
    r'<script src="https://cdn\.socket\.io/4\.8\.1/socket\.io\.min\.js"[^>]*></script>',
    '<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>',
    s,
    count=1,
)
p.write_text(s)

# Admin ticket: message ids, audited assignment flow, attachments and realtime hook.
p = Path('workspace/admin/assets/js/admin.js')
s = p.read_text()
s = replace_once(
    s,
    '''<div class="message ${msg.authorType === 'admin' ? 'admin-message' : 'client'} ${msg.internal ? 'internal-message' : ''}">''',
    '''<div class="message ${msg.authorType === 'admin' ? 'admin-message' : 'client'} ${msg.internal ? 'internal-message' : ''}" data-message-id="${escapeHtml(msg.id)}">''',
    'admin message id',
)
s = replace_once(
    s,
    """      $('#assigneeControl').value = ticket.assignedTo || '';
      return ticket;""",
    """      $('#assigneeControl').value = ticket.assignedTo || '';
      if (window.CCAttachments) await window.CCAttachments.refresh();
      return ticket;""",
    'admin attachment refresh',
)
s = replace_once(
    s,
    """    await refresh();

    $('#saveTicketControls')?.addEventListener('click', async () => {""",
    """    await refresh();
    window.CCRefreshTicket = refresh;
    window.dispatchEvent(new CustomEvent('cc:ticket-ready', { detail: { id } }));

    $('#saveTicketControls')?.addEventListener('click', async () => {""",
    'admin realtime refresh export',
)
s = replace_once(
    s,
    """await CCAdminApi.updateTicket(id, { status: $('#statusControl').value, priority: $('#priorityControl').value, assignedTo: $('#assigneeControl').value || null });""",
    """await CCAdminApi.updateTicket(id, { status: $('#statusControl').value, priority: $('#priorityControl').value });""",
    'remove direct assignee update',
)
s = replace_once(
    s,
    """      try { await CCAdminApi.sendMessage(id, { message, internal:false }); $('#replyMessage').value = ''; toast('Resposta enviada ao cliente.'); await refresh(); }
      catch (error) { toast(error.message, 'error'); }""",
    """      try {
        const sent = await CCAdminApi.sendMessage(id, { message, internal:false });
        $('#replyMessage').value = '';
        if (window.CCAttachments) {
          try { await window.CCAttachments.uploadFiles({ messageId: sent.message.id, input: $('#replyAttachments') }); }
          catch (uploadError) { toast(`Resposta enviada, mas o anexo falhou: ${uploadError.message}`, 'error'); }
        }
        toast('Resposta enviada ao cliente.');
        await refresh();
      }
      catch (error) { toast(error.message, 'error'); }""",
    'admin reply attachments',
)
s = replace_once(
    s,
    """      try { await CCAdminApi.sendMessage(id, { message, internal:true }); $('#internalNote').value = ''; toast('Nota interna adicionada.'); await refresh(); }
      catch (error) { toast(error.message, 'error'); }""",
    """      try {
        const sent = await CCAdminApi.sendMessage(id, { message, internal:true });
        $('#internalNote').value = '';
        if (window.CCAttachments) {
          try { await window.CCAttachments.uploadFiles({ messageId: sent.message.id, input: $('#internalNoteAttachments') }); }
          catch (uploadError) { toast(`Nota salva, mas o anexo falhou: ${uploadError.message}`, 'error'); }
        }
        toast('Nota interna adicionada.');
        await refresh();
      }
      catch (error) { toast(error.message, 'error'); }""",
    'admin internal attachments',
)
p.write_text(s)

# Backend: stronger passwords and assignment only through audited transfer endpoint.
p = Path('api/portal.js')
s = p.read_text()
s = replace_once(
    s,
    "function validNewPassword(password) {\n  return typeof password === 'string' && password.length >= 10 && /[A-Za-z]/.test(password) && /\\d/.test(password);\n}",
    "function validNewPassword(password) {\n  return typeof password === 'string' && password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\\d/.test(password) && /[^A-Za-z0-9]/.test(password);\n}",
    'strong password validator',
)
s = s.replace(
    'A nova senha deve ter pelo menos 10 caracteres, com letras e números.',
    'A nova senha deve ter pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
)
s = s.replace(
    'Informe empresa, usuário, e-mail válido e uma senha com pelo menos 10 caracteres, letras e números.',
    'Informe empresa, usuário, e-mail válido e uma senha com pelo menos 12 caracteres, maiúscula, minúscula, número e símbolo.',
)
s = s.replace(
    'A senha temporária deve ter pelo menos 10 caracteres, com letras e números.',
    'A senha temporária deve ter pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
)
s = replace_once(
    s,
    """  if (input.assignedTo !== undefined) {
    if (!input.assignedTo) {
      update.assignedTo = null;
    } else {
      const assignedId = objectId(input.assignedTo);
      const assignee = assignedId ? await session.db.collection('users').findOne({ _id: assignedId, role: { $in: ADMIN_ROLES }, active: true }) : null;
      if (!assignee) return fail(res, 422, 'INVALID_ASSIGNEE', 'Responsável inválido.');
      update.assignedTo = assignee._id;
      if (!update.status && ticket.status === 'aberto') update.status = 'em_atendimento';
    }
  }""",
    """  if (input.assignedTo !== undefined) {
    return fail(res, 409, 'TRANSFER_ENDPOINT_REQUIRED', 'Use o fluxo de transferência auditada para alterar o responsável pelo chamado.');
  }""",
    'force audited transfer endpoint',
)
p.write_text(s)

print('enterprise final patches applied')
