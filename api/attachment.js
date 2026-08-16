'use strict';

const crypto = require('crypto');
const { Readable } = require('node:stream');
const {
  ObjectId,
  authenticateCookieHeader,
  authorizeTicket,
  requestIp,
  enforceRateLimit,
  audit
} = require('./_portal-security');

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function json(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(payload);
}
function ok(res, data = {}, status = 200) { return json(res, status, { ok: true, ...data }); }
function fail(res, status, code, message) { return json(res, status, { ok: false, error: { code, message } }); }
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return !host || new URL(origin).host === host;
  } catch { return false; }
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 5 * 1024 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function safeName(value) {
  const raw = String(value || 'arquivo').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return (cleaned || 'arquivo').slice(0, 100);
}
function validMagic(buffer, type) {
  if (type === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (type === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (type === 'application/pdf') return buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-';
  return false;
}
function publicAttachment(doc) {
  return {
    id: String(doc._id),
    ticketId: String(doc.ticketId),
    messageId: doc.messageId ? String(doc.messageId) : null,
    fileName: doc.fileName,
    contentType: doc.contentType,
    size: doc.size,
    sha256: doc.sha256,
    uploaderName: doc.uploaderName,
    uploaderType: doc.uploaderType,
    internal: doc.internal === true,
    archived: doc.archived === true,
    createdAt: doc.createdAt,
    downloadUrl: `/api/attachment?action=download&id=${encodeURIComponent(String(doc._id))}`
  };
}
async function archiveTicketAttachmentMetadata(db, ticketId) {
  const active = await db.collection('ticket_attachments').find({ ticketId }).toArray();
  if (!active.length) return;
  const archivedAt = new Date();
  for (const doc of active) {
    await db.collection('ticket_attachment_archive').replaceOne(
      { _id: doc._id },
      { ...doc, archived: true, archivedAt },
      { upsert: true }
    );
  }
  await db.collection('ticket_attachments').deleteMany({ _id: { $in: active.map(doc => doc._id) } });
}
async function rate(session, req, scope, limit, windowMs) {
  const result = await enforceRateLimit(session.db, {
    scope,
    subject: `${session.kind}:${String(session.user._id)}:${requestIp(req)}`,
    limit,
    windowMs
  });
  return result;
}

module.exports = async function handler(req, res) {
  try {
    const action = String(req.query.action || 'list').toLowerCase();
    const session = await authenticateCookieHeader(req.headers.cookie || '');
    if (!session) return fail(res, 401, 'UNAUTHENTICATED', 'Sessão expirada ou inválida.');

    const baseLimit = await rate(session, req, 'attachment-api', 90, 60 * 1000);
    if (!baseLimit.allowed) {
      res.setHeader('Retry-After', String(baseLimit.retryAfter));
      return fail(res, 429, 'RATE_LIMITED', 'Muitas requisições. Aguarde alguns instantes.');
    }

    if (action === 'list' && req.method === 'GET') {
      const ticket = await authorizeTicket(session, req.query.ticketId);
      if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');
      if (ticket.status === 'fechado') await archiveTicketAttachmentMetadata(session.db, ticket._id);
      const [active, archived] = await Promise.all([
        session.db.collection('ticket_attachments').find({ ticketId: ticket._id }).sort({ createdAt: 1 }).toArray(),
        session.db.collection('ticket_attachment_archive').find({ ticketId: ticket._id }).sort({ createdAt: 1 }).toArray()
      ]);
      const docs = [...active, ...archived]
        .filter(item => session.kind === 'admin' || item.internal !== true)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return ok(res, { attachments: docs.map(publicAttachment), storageConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
    }

    if (action === 'upload' && req.method === 'POST') {
      if (!sameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
      if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(res, 503, 'ATTACHMENT_STORAGE_NOT_CONFIGURED', 'O armazenamento privado de anexos ainda não foi configurado na Vercel.');
      const uploadLimit = await rate(session, req, 'attachment-upload', 12, 10 * 60 * 1000);
      if (!uploadLimit.allowed) {
        res.setHeader('Retry-After', String(uploadLimit.retryAfter));
        return fail(res, 429, 'UPLOAD_RATE_LIMITED', 'Limite de anexos atingido. Aguarde antes de enviar novos arquivos.');
      }

      const ticket = await authorizeTicket(session, req.query.ticketId);
      if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');
      if (ticket.status === 'fechado') return fail(res, 409, 'TICKET_CLOSED', 'Reabra o chamado antes de enviar anexos.');

      const input = await body(req);
      const fileName = safeName(input.fileName);
      const contentType = String(input.contentType || '').toLowerCase();
      if (!ALLOWED_TYPES.has(contentType)) return fail(res, 415, 'UNSUPPORTED_FILE_TYPE', 'Envie somente JPG, PNG, WEBP ou PDF.');
      const encoded = String(input.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
      let buffer;
      try { buffer = Buffer.from(encoded, 'base64'); } catch { buffer = null; }
      if (!buffer || !buffer.length) return fail(res, 422, 'INVALID_FILE', 'O arquivo enviado é inválido.');
      if (buffer.length > MAX_FILE_BYTES) return fail(res, 413, 'FILE_TOO_LARGE', 'O anexo deve ter no máximo 3 MB.');
      if (!validMagic(buffer, contentType)) return fail(res, 415, 'FILE_SIGNATURE_MISMATCH', 'O conteúdo do arquivo não corresponde ao tipo informado.');

      const messageId = ObjectId.isValid(input.messageId) ? new ObjectId(input.messageId) : null;
      if (!messageId) return fail(res, 422, 'MESSAGE_REQUIRED', 'O anexo precisa estar associado a uma mensagem do chamado.');
      const message = await session.db.collection('ticket_messages').findOne({ _id: messageId, ticketId: ticket._id });
      if (!message) return fail(res, 404, 'MESSAGE_NOT_FOUND', 'Mensagem não encontrada.');
      if (String(message.authorId || '') !== String(session.user._id)) return fail(res, 403, 'MESSAGE_OWNER_REQUIRED', 'O anexo só pode ser associado à mensagem que você acabou de enviar.');
      if (session.kind === 'client' && message.internal === true) return fail(res, 403, 'INTERNAL_MESSAGE', 'Operação não permitida.');

      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const { put } = await import('@vercel/blob');
      const path = `tickets/${ticket.ticketNumber}/attachments/${Date.now()}-${fileName}`;
      const blob = await put(path, buffer, {
        access: 'private',
        contentType,
        addRandomSuffix: true
      });
      const now = new Date();
      const doc = {
        ticketId: ticket._id,
        organizationId: ticket.organizationId,
        messageId,
        uploaderId: session.user._id,
        uploaderType: session.kind,
        uploaderName: session.user.name,
        internal: message.internal === true,
        fileName,
        contentType,
        size: buffer.length,
        sha256: hash,
        blobPathname: blob.pathname,
        blobUrl: blob.url,
        storage: 'vercel-blob-private',
        archived: false,
        createdAt: now
      };
      const inserted = await session.db.collection('ticket_attachments').insertOne(doc);
      doc._id = inserted.insertedId;
      await audit(session.db, {
        organizationId: ticket.organizationId,
        userId: session.user._id,
        action: 'ticket.attachment.uploaded',
        entityType: 'ticket_attachment',
        entityId: doc._id,
        metadata: { ticketNumber: ticket.ticketNumber, contentType, size: buffer.length, sha256: hash }
      });
      return ok(res, { attachment: publicAttachment(doc) }, 201);
    }

    if (action === 'download' && req.method === 'GET') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(res, 503, 'ATTACHMENT_STORAGE_NOT_CONFIGURED', 'O armazenamento privado de anexos ainda não foi configurado na Vercel.');
      const id = ObjectId.isValid(req.query.id) ? new ObjectId(req.query.id) : null;
      if (!id) return fail(res, 400, 'INVALID_ATTACHMENT', 'Anexo inválido.');
      let attachment = await session.db.collection('ticket_attachments').findOne({ _id: id });
      if (!attachment) attachment = await session.db.collection('ticket_attachment_archive').findOne({ _id: id });
      if (!attachment) return fail(res, 404, 'ATTACHMENT_NOT_FOUND', 'Anexo não encontrado.');
      const ticket = await authorizeTicket(session, String(attachment.ticketId));
      if (!ticket || (session.kind === 'client' && attachment.internal === true)) return fail(res, 404, 'ATTACHMENT_NOT_FOUND', 'Anexo não encontrado.');

      const { get } = await import('@vercel/blob');
      const result = await get(attachment.blobPathname, {
        access: 'private',
        ifNoneMatch: req.headers['if-none-match'] || undefined
      });
      if (!result) return fail(res, 404, 'BLOB_NOT_FOUND', 'Arquivo não encontrado no armazenamento.');
      if (result.statusCode === 304) {
        res.status(304);
        res.setHeader('ETag', result.blob.etag);
        res.setHeader('Cache-Control', 'private, no-cache');
        return res.end();
      }
      if (result.statusCode !== 200) return fail(res, 404, 'BLOB_NOT_FOUND', 'Arquivo não encontrado no armazenamento.');
      const encodedName = encodeURIComponent(attachment.fileName).replace(/'/g, '%27');
      res.status(200);
      res.setHeader('Content-Type', result.blob.contentType || attachment.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('ETag', result.blob.etag);
      return Readable.fromWeb(result.stream).pipe(res);
    }

    return fail(res, 404, 'NOT_FOUND', 'Rota de anexo não encontrada.');
  } catch (error) {
    console.error('ATTACHMENT_API_ERROR', error);
    if (error.message === 'PAYLOAD_TOO_LARGE') return fail(res, 413, 'PAYLOAD_TOO_LARGE', 'Arquivo muito grande.');
    if (error.code === 'MONGODB_URI_NOT_CONFIGURED' || error.code === 'PORTAL_SECRETS_NOT_CONFIGURED') return fail(res, 503, 'PORTAL_NOT_CONFIGURED', 'O portal ainda não foi configurado no ambiente de hospedagem.');
    return fail(res, 500, 'INTERNAL_ERROR', 'Não foi possível processar o anexo agora.');
  }
};
