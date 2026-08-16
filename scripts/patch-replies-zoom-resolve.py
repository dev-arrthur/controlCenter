from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'PATTERN NOT FOUND [{label}] in {path}')
    p.write_text(text.replace(old, new, 1))

# -----------------------------------------------------------------------------
# Backend: replies vinculadas ao mesmo chamado + serialização da referência
# -----------------------------------------------------------------------------
portal = Path('api/portal.js')
text = portal.read_text()
marker = "}\nasync function enrichTickets(database, tickets) {"
helper = """}\nfunction serializeMessages(messages) {\n  const byId = new Map(messages.map(message => [String(message._id), message]));\n  return messages.map(message => {\n    const parent = message.replyToMessageId ? byId.get(String(message.replyToMessageId)) : null;\n    return {\n      id: String(message._id),\n      authorType: message.authorType,\n      authorName: message.authorName,\n      message: message.message,\n      internal: message.internal === true,\n      createdAt: message.createdAt,\n      replyTo: parent ? {\n        id: String(parent._id),\n        authorType: parent.authorType,\n        authorName: parent.authorName,\n        message: cleanText(parent.message, 220),\n        internal: parent.internal === true\n      } : null\n    };\n  });\n}\nasync function enrichTickets(database, tickets) {"""
if marker not in text:
    raise SystemExit('serializeMessages insertion marker not found')
text = text.replace(marker, helper, 1)

old = "return ok(res, { ticket: serializeTicket(ticket), messages: messages.map(m => ({ id: String(m._id), authorType: m.authorType, authorName: m.authorName, message: m.message, createdAt: m.createdAt })) });"
new = "return ok(res, { ticket: serializeTicket(ticket), messages: serializeMessages(messages) });"
if old not in text:
    raise SystemExit('client message serialization pattern not found')
text = text.replace(old, new, 1)

old = "messages: messages.map(m => ({ id: String(m._id), authorType: m.authorType, authorName: m.authorName, message: m.message, internal: m.internal === true, createdAt: m.createdAt })),"
new = "messages: serializeMessages(messages),"
if old not in text:
    raise SystemExit('admin message serialization pattern not found')
text = text.replace(old, new, 1)

old = """  const input = await parseBody(req);\n  const message = cleanText(input.message, 5000);\n  if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.');\n  const now = new Date();\n  const inserted = await session.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: session.organization._id, authorId: session.user._id, authorType: 'client', authorName: session.user.name, message, internal: false, createdAt: now });"""
new = """  const input = await parseBody(req);\n  const message = cleanText(input.message, 5000);\n  if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.');\n  let replyTo = null;\n  if (input.replyToMessageId) {\n    const replyId = objectId(input.replyToMessageId);\n    if (!replyId) return fail(res, 422, 'INVALID_REPLY_TARGET', 'A mensagem selecionada para resposta é inválida.');\n    replyTo = await session.db.collection('ticket_messages').findOne({ _id: replyId, ticketId: id, organizationId: session.organization._id, internal: { $ne: true } });\n    if (!replyTo) return fail(res, 404, 'REPLY_TARGET_NOT_FOUND', 'A mensagem selecionada não pertence a este chamado ou não está disponível.');\n  }\n  const now = new Date();\n  const inserted = await session.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: session.organization._id, authorId: session.user._id, authorType: 'client', authorName: session.user.name, message, replyToMessageId: replyTo?._id || null, internal: false, createdAt: now });"""
if old not in text:
    raise SystemExit('client actionMessage pattern not found')
text = text.replace(old, new, 1)

old = "return ok(res, { message: { id: String(inserted.insertedId), authorType: 'client', authorName: session.user.name, message, createdAt: now } }, 201);"
new = "return ok(res, { message: { id: String(inserted.insertedId), authorType: 'client', authorName: session.user.name, message, replyTo: replyTo ? { id: String(replyTo._id), authorName: replyTo.authorName, message: cleanText(replyTo.message, 220) } : null, createdAt: now } }, 201);"
if old not in text:
    raise SystemExit('client actionMessage return pattern not found')
text = text.replace(old, new, 1)

old = """  const input = await parseBody(req);\n  const message = cleanText(input.message, 5000);\n  const internal = input.internal === true;\n  if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.');\n  if (!internal && ticket.status === 'fechado') return fail(res, 409, 'TICKET_CLOSED', 'Reabra o chamado antes de responder ao cliente.');\n  const now = new Date();\n  const inserted = await session.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: ticket.organizationId, authorId: session.user._id, authorType: 'admin', authorName: session.user.name, message, internal, createdAt: now });"""
new = """  const input = await parseBody(req);\n  const message = cleanText(input.message, 5000);\n  const internal = input.internal === true;\n  if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.');\n  if (!internal && ticket.status === 'fechado') return fail(res, 409, 'TICKET_CLOSED', 'Reabra o chamado antes de responder ao cliente.');\n  let replyTo = null;\n  if (input.replyToMessageId) {\n    const replyId = objectId(input.replyToMessageId);\n    if (!replyId) return fail(res, 422, 'INVALID_REPLY_TARGET', 'A mensagem selecionada para resposta é inválida.');\n    const replyFilter = { _id: replyId, ticketId: id, organizationId: ticket.organizationId };\n    if (!internal) replyFilter.internal = { $ne: true };\n    replyTo = await session.db.collection('ticket_messages').findOne(replyFilter);\n    if (!replyTo) return fail(res, 404, 'REPLY_TARGET_NOT_FOUND', 'A mensagem selecionada não pertence a este chamado ou não pode ser citada nesta resposta.');\n  }\n  const now = new Date();\n  const inserted = await session.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: ticket.organizationId, authorId: session.user._id, authorType: 'admin', authorName: session.user.name, message, replyToMessageId: replyTo?._id || null, internal, createdAt: now });"""
if old not in text:
    raise SystemExit('admin actionMessage pattern not found')
text = text.replace(old, new, 1)

old = "return ok(res, { message: { id: String(inserted.insertedId), authorType: 'admin', authorName: session.user.name, message, internal, createdAt: now } }, 201);"
new = "return ok(res, { message: { id: String(inserted.insertedId), authorType: 'admin', authorName: session.user.name, message, internal, replyTo: replyTo ? { id: String(replyTo._id), authorName: replyTo.authorName, message: cleanText(replyTo.message, 220), internal: replyTo.internal === true } : null, createdAt: now } }, 201);"
if old not in text:
    raise SystemExit('admin actionMessage return pattern not found')
text = text.replace(old, new, 1)

old = "await audit(session.db, { organizationId: ticket.organizationId, userId: session.user._id, action: 'ticket.updated_by_admin', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber, changes: Object.keys(update).filter(k => k !== 'updatedAt') } });"
new = "const updateAuditAction = update.status === 'resolvido' && ticket.status !== 'resolvido' ? 'ticket.resolved_by_admin' : (update.status === 'fechado' && ticket.status !== 'fechado' ? 'ticket.closed_by_admin' : 'ticket.updated_by_admin');\n  await audit(session.db, { organizationId: ticket.organizationId, userId: session.user._id, action: updateAuditAction, entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber, changes: Object.keys(update).filter(k => k !== 'updatedAt') } });"
if old not in text:
    raise SystemExit('admin audit pattern not found')
text = text.replace(old, new, 1)
portal.write_text(text)

# -----------------------------------------------------------------------------
# API cliente aceita body com replyToMessageId
# -----------------------------------------------------------------------------
replace_once(
    'workspace/client/assets/js/api.js',
    "sendMessage: (id, message) => request(`/api/portal?action=message&id=${encodeURIComponent(id)}`, { method:'POST', body:{ message } }),",
    "sendMessage: (id, body) => request(`/api/portal?action=message&id=${encodeURIComponent(id)}`, { method:'POST', body: typeof body === 'string' ? { message: body } : body }),",
    'client api sendMessage'
)

# -----------------------------------------------------------------------------
# Renderização cliente: citação + botão responder + envio vinculado
# -----------------------------------------------------------------------------
replace_once(
    'workspace/client/assets/js/portal.js',
    "wrap.innerHTML=messages.map(msg=>`<div class=\"message ${msg.authorType==='client'?'client':''}\" data-message-id=\"${escapeHtml(msg.id)}\"><div class=\"message-avatar\">${escapeHtml(initials(msg.authorName))}</div><div class=\"message-bubble\"><div class=\"message-meta\"><strong>${escapeHtml(msg.authorName)}</strong><span>${date(msg.createdAt,true)}</span></div><p>${escapeHtml(msg.message)}</p></div></div>`).join('');",
    "wrap.innerHTML=messages.map(msg=>`<div class=\"message ${msg.authorType==='client'?'client':''}\" data-message-id=\"${escapeHtml(msg.id)}\"><div class=\"message-avatar\">${escapeHtml(initials(msg.authorName))}</div><div class=\"message-bubble\"><div class=\"message-meta\"><strong>${escapeHtml(msg.authorName)}</strong><span>${date(msg.createdAt,true)}</span></div>${msg.replyTo?`<button class=\"message-reply-reference\" type=\"button\" data-scroll-message=\"${escapeHtml(msg.replyTo.id)}\"><small><i class=\"bi bi-reply\"></i> Respondendo a ${escapeHtml(msg.replyTo.authorName)}</small><span>${escapeHtml(msg.replyTo.message)}</span></button>`:''}<p>${escapeHtml(msg.message)}</p><div class=\"message-actions\"><button class=\"message-reply-action\" type=\"button\" data-reply-message-id=\"${escapeHtml(msg.id)}\" data-reply-author=\"${escapeHtml(msg.authorName)}\" data-reply-excerpt=\"${escapeHtml(msg.message.slice(0,220))}\"><i class=\"bi bi-reply\"></i>Responder</button></div></div></div>`).join('');",
    'client render replies'
)
replace_once(
    'workspace/client/assets/js/portal.js',
    "const sent=await CCApi.sendMessage(id,msg);textarea.value='';",
    "const replyToMessageId=window.CCAttachments?.getReplyToMessageId?.()||null;const sent=await CCApi.sendMessage(id,{message:msg,replyToMessageId});textarea.value='';window.CCAttachments?.clearReplyTarget?.();",
    'client send reply target'
)

# -----------------------------------------------------------------------------
# Admin: citação + botão responder + concluir chamado
# -----------------------------------------------------------------------------
replace_once(
    'workspace/admin/assets/js/admin.js',
    """      <div class=\"message-bubble\">\n        <div class=\"message-meta\"><strong>${escapeHtml(msg.authorName)}</strong><span>${msg.internal ? 'Nota interna • ' : ''}${fmtDate(msg.createdAt, true)}</span></div>\n        <p>${escapeHtml(msg.message)}</p>\n      </div>""",
    """      <div class=\"message-bubble\">\n        <div class=\"message-meta\"><strong>${escapeHtml(msg.authorName)}</strong><span>${msg.internal ? 'Nota interna • ' : ''}${fmtDate(msg.createdAt, true)}</span></div>\n        ${msg.replyTo ? `<button class=\"message-reply-reference\" type=\"button\" data-scroll-message=\"${escapeHtml(msg.replyTo.id)}\"><small><i class=\"bi bi-reply\"></i> Respondendo a ${escapeHtml(msg.replyTo.authorName)}</small><span>${escapeHtml(msg.replyTo.message)}</span></button>` : ''}\n        <p>${escapeHtml(msg.message)}</p>\n        ${msg.internal ? '' : `<div class=\"message-actions\"><button class=\"message-reply-action\" type=\"button\" data-reply-message-id=\"${escapeHtml(msg.id)}\" data-reply-author=\"${escapeHtml(msg.authorName)}\" data-reply-excerpt=\"${escapeHtml(msg.message.slice(0,220))}\"><i class=\"bi bi-reply\"></i>Responder</button></div>`}\n      </div>""",
    'admin render replies'
)
replace_once(
    'workspace/admin/assets/js/admin.js',
    "$('#assigneeControl').value = currentAssigneeId;\n      if (window.CCAttachments) await window.CCAttachments.refresh();",
    "$('#assigneeControl').value = currentAssigneeId;\n      const resolveButton = $('#resolveTicket');\n      if (resolveButton) resolveButton.hidden = ['resolvido','fechado'].includes(ticket.status);\n      if (window.CCAttachments) await window.CCAttachments.refresh();",
    'admin resolve state'
)
replace_once(
    'workspace/admin/assets/js/admin.js',
    "const sent = await CCAdminApi.sendMessage(id, { message, internal:false });\n        $('#replyMessage').value = '';",
    "const replyToMessageId = window.CCAttachments?.getReplyToMessageId?.() || null;\n        const sent = await CCAdminApi.sendMessage(id, { message, internal:false, replyToMessageId });\n        $('#replyMessage').value = '';\n        window.CCAttachments?.clearReplyTarget?.();",
    'admin send reply target'
)
replace_once(
    'workspace/admin/assets/js/admin.js',
    """    $('#replyForm')?.addEventListener('submit', async event => {""",
    """    $('#resolveTicket')?.addEventListener('click', async () => {\n      if (!confirm('Concluir este chamado como resolvido? O histórico continuará disponível e o cliente poderá visualizar a conclusão.')) return;\n      const button = $('#resolveTicket');\n      button.disabled = true;\n      try {\n        await CCAdminApi.updateTicket(id, { status: 'resolvido' });\n        toast('Chamado concluído como resolvido.');\n        await refresh();\n      } catch (error) { toast(error.message, 'error'); }\n      finally { button.disabled = false; }\n    });\n\n    $('#replyForm')?.addEventListener('submit', async event => {""",
    'admin resolve handler'
)

replace_once(
    'workspace/admin/ticketAdmin.html',
    '<button id="saveTicketControls" class="primary-action" type="button"><i class="bi bi-check2"></i>Salvar alterações</button>',
    '<button id="saveTicketControls" class="primary-action" type="button"><i class="bi bi-check2"></i>Salvar alterações</button><button id="resolveTicket" class="resolve-action" type="button"><i class="bi bi-check2-circle"></i>Concluir chamado</button>',
    'admin resolve button'
)

# -----------------------------------------------------------------------------
# Shared: zoom + seleção de mensagem para resposta + navegação da citação
# -----------------------------------------------------------------------------
shared = Path('workspace/shared/ticketEnterprise.js')
text = shared.read_text()
text = text.replace("  let socketReady = false;", "  let socketReady = false;\n  let imageZoom = 1;\n  let replyTarget = null;", 1)

old = """        <div class=\"attachment-image-modal-head\">\n          <div><small>ANEXO DO CHAMADO</small><strong id=\"attachmentImageModalTitle\">Imagem</strong><span id=\"attachmentImageModalSize\"></span></div>\n          <button type=\"button\" class=\"attachment-image-modal-close\" data-image-modal-close aria-label=\"Fechar imagem\"><i class=\"bi bi-x-lg\"></i></button>\n        </div>\n        <div class=\"attachment-image-modal-body\"><img id=\"attachmentImageModalPreview\" alt=\"\"></div>"""
new = """        <div class=\"attachment-image-modal-head\">\n          <div><small>ANEXO DO CHAMADO</small><strong id=\"attachmentImageModalTitle\">Imagem</strong><span id=\"attachmentImageModalSize\"></span></div>\n          <div class=\"attachment-image-modal-tools\" aria-label=\"Controles de zoom\">\n            <button type=\"button\" data-image-zoom-out aria-label=\"Diminuir zoom\"><i class=\"bi bi-dash-lg\"></i></button>\n            <button type=\"button\" data-image-zoom-reset aria-label=\"Restaurar zoom\"><span data-image-zoom-label>100%</span></button>\n            <button type=\"button\" data-image-zoom-in aria-label=\"Aumentar zoom\"><i class=\"bi bi-plus-lg\"></i></button>\n          </div>\n          <button type=\"button\" class=\"attachment-image-modal-close\" data-image-modal-close aria-label=\"Fechar imagem\"><i class=\"bi bi-x-lg\"></i></button>\n        </div>\n        <div class=\"attachment-image-modal-body\"><div class=\"attachment-image-stage\"><img id=\"attachmentImageModalPreview\" alt=\"\"></div></div>"""
if old not in text:
    raise SystemExit('image modal markup pattern not found')
text = text.replace(old, new, 1)

old = """    modal.addEventListener('click', event => {\n      if (event.target.closest('[data-image-modal-close]')) closeImageModal();\n    });\n    return modal;"""
new = """    modal.addEventListener('click', event => {\n      if (event.target.closest('[data-image-modal-close]')) return closeImageModal();\n      if (event.target.closest('[data-image-zoom-in]')) return setImageZoom(imageZoom + 0.25);\n      if (event.target.closest('[data-image-zoom-out]')) return setImageZoom(imageZoom - 0.25);\n      if (event.target.closest('[data-image-zoom-reset]')) return setImageZoom(1);\n    });\n    const body = modal.querySelector('.attachment-image-modal-body');\n    body?.addEventListener('wheel', event => {\n      if (!modal.classList.contains('open')) return;\n      event.preventDefault();\n      setImageZoom(imageZoom + (event.deltaY < 0 ? 0.15 : -0.15));\n    }, { passive:false });\n    modal.querySelector('#attachmentImageModalPreview')?.addEventListener('dblclick', () => setImageZoom(1));\n    return modal;"""
if old not in text:
    raise SystemExit('image modal events pattern not found')
text = text.replace(old, new, 1)

old = """  function openImageModal(trigger) {"""
new = """  function setImageZoom(value) {\n    imageZoom = Math.max(0.5, Math.min(4, Math.round(value * 20) / 20));\n    const modal = document.getElementById('attachmentImageModal');\n    const image = modal?.querySelector('#attachmentImageModalPreview');\n    const label = modal?.querySelector('[data-image-zoom-label]');\n    if (image) image.style.transform = `scale(${imageZoom})`;\n    if (label) label.textContent = `${Math.round(imageZoom * 100)}%`;\n  }\n  function openImageModal(trigger) {"""
if old not in text:
    raise SystemExit('openImageModal marker not found')
text = text.replace(old, new, 1)

old = """    image.src = src;\n    image.alt = name;\n    title.textContent = name;"""
new = """    image.src = src;\n    image.alt = name;\n    setImageZoom(1);\n    title.textContent = name;"""
if old not in text:
    raise SystemExit('image modal reset zoom pattern not found')
text = text.replace(old, new, 1)

insert_marker = """  function attachmentSignature(items) {"""
reply_helpers = """  function renderReplyTarget() {\n    const textarea = document.querySelector('#replyMessage');\n    if (!textarea) return;\n    let preview = document.querySelector('.reply-target-preview');\n    if (!replyTarget) { if (preview) preview.remove(); return; }\n    if (!preview) {\n      preview = document.createElement('div');\n      preview.className = 'reply-target-preview';\n      textarea.insertAdjacentElement('beforebegin', preview);\n    }\n    preview.innerHTML = `<div><small><i class=\"bi bi-reply\"></i> Respondendo a ${escapeHtml(replyTarget.author)}</small><strong>${escapeHtml(replyTarget.excerpt)}</strong></div><button type=\"button\" data-reply-cancel aria-label=\"Cancelar resposta\"><i class=\"bi bi-x-lg\"></i></button>`;\n  }\n  function setReplyTarget(trigger) {\n    replyTarget = {\n      id: trigger.dataset.replyMessageId || '',\n      author: trigger.dataset.replyAuthor || 'Mensagem',\n      excerpt: trigger.dataset.replyExcerpt || ''\n    };\n    renderReplyTarget();\n    document.querySelector('#replyMessage')?.focus();\n    document.querySelector('#replyMessage')?.scrollIntoView({ behavior:'smooth', block:'center' });\n  }\n  function clearReplyTarget() {\n    replyTarget = null;\n    renderReplyTarget();\n  }\n  function bindMessageReplies() {\n    if (document.documentElement.dataset.replyBinding === '1') return;\n    document.documentElement.dataset.replyBinding = '1';\n    document.addEventListener('click', event => {\n      const reply = event.target.closest('[data-reply-message-id]');\n      if (reply) { event.preventDefault(); setReplyTarget(reply); return; }\n      if (event.target.closest('[data-reply-cancel]')) { event.preventDefault(); clearReplyTarget(); return; }\n      const reference = event.target.closest('[data-scroll-message]');\n      if (reference) {\n        event.preventDefault();\n        const target = document.querySelector(`.message[data-message-id=\"${CSS.escape(reference.dataset.scrollMessage || '')}\"]`);\n        if (!target) return;\n        target.scrollIntoView({ behavior:'smooth', block:'center' });\n        target.classList.remove('message-highlight');\n        requestAnimationFrame(() => target.classList.add('message-highlight'));\n        setTimeout(() => target.classList.remove('message-highlight'), 1800);\n      }\n    });\n  }\n  function attachmentSignature(items) {"""
if insert_marker not in text:
    raise SystemExit('reply helpers insertion marker not found')
text = text.replace(insert_marker, reply_helpers, 1)

old = "global.CCAttachments = { uploadFiles, refresh:refreshAttachments, decorate:decorateMessages };"
new = "global.CCAttachments = { uploadFiles, refresh:refreshAttachments, decorate:decorateMessages, getReplyToMessageId:() => replyTarget?.id || null, clearReplyTarget };"
if old not in text:
    raise SystemExit('CCAttachments export pattern not found')
text = text.replace(old, new, 1)

old = """    bindAttachmentInputs();\n    bindImageModal();\n    refreshAttachments();"""
new = """    bindAttachmentInputs();\n    bindImageModal();\n    bindMessageReplies();\n    refreshAttachments();"""
if old not in text:
    raise SystemExit('DOMContentLoaded shared pattern not found')
text = text.replace(old, new, 1)
shared.write_text(text)

# -----------------------------------------------------------------------------
# CSS: reply UI, resolve action and image zoom controls
# -----------------------------------------------------------------------------
css = Path('workspace/shared/portalEnterprise.css')
css.write_text(css.read_text() + r'''\n.message-actions{display:flex;justify-content:flex-end;margin-top:7px}.message-reply-action{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:#6f7f8c;font:inherit;font-size:10px;font-weight:800;cursor:pointer;padding:4px 6px;border-radius:7px}.message-reply-action:hover{background:#edf5fc;color:#174f82}.message-reply-reference{display:block;width:100%;text-align:left;border:0;border-left:3px solid #6ea2cf;border-radius:8px;background:rgba(23,79,130,.06);padding:8px 10px;margin:8px 0;color:#30404d;cursor:pointer}.message-reply-reference small{display:block;color:#174f82;font-size:9px;font-weight:800;margin-bottom:3px}.message-reply-reference span{display:block;font-size:10px;line-height:1.45;color:#687681;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reply-target-preview{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;padding:10px 12px;border:1px solid #d5e4f0;border-left:3px solid #174f82;border-radius:10px;background:#f7fbff}.reply-target-preview>div{min-width:0}.reply-target-preview small{display:block;color:#174f82;font-size:9px;font-weight:800}.reply-target-preview strong{display:block;margin-top:3px;font-size:10px;color:#65737e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reply-target-preview button{border:0;background:transparent;color:#667785;cursor:pointer;padding:5px}.message-highlight .message-bubble{animation:ccMessageHighlight 1.8s ease}@keyframes ccMessageHighlight{0%,100%{box-shadow:none}20%{box-shadow:0 0 0 4px rgba(23,79,130,.18)}}.resolve-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:8px;min-height:42px;padding:10px 14px;border:1px solid #a7dfc0;border-radius:10px;background:#ecfdf3;color:#067647;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.resolve-action:hover{background:#dff8e9}.resolve-action:disabled{opacity:.6;cursor:not-allowed}.resolve-action[hidden]{display:none!important}.attachment-image-modal-head{gap:12px}.attachment-image-modal-tools{display:inline-flex;align-items:center;gap:4px;margin-left:auto;padding:4px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.06)}.attachment-image-modal-tools button{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:32px;border:0;border-radius:7px;background:transparent;color:#fff;cursor:pointer;font:inherit;font-size:12px;font-weight:800}.attachment-image-modal-tools button:hover{background:rgba(255,255,255,.13)}.attachment-image-modal-tools [data-image-zoom-reset]{min-width:58px}.attachment-image-modal-body{overflow:auto}.attachment-image-stage{min-width:100%;min-height:100%;display:grid;place-items:center;padding:6px}.attachment-image-modal-body img{transition:transform .15s ease;transform-origin:center center;cursor:zoom-in;user-select:none}.attachment-image-modal-body img[style*="scale(4"]{cursor:zoom-out}@media(max-width:700px){.attachment-image-modal-head{flex-wrap:wrap}.attachment-image-modal-tools{order:3;width:100%;justify-content:center;margin-left:0}.message-actions{justify-content:flex-start}}''')

print('Patch applied successfully')
