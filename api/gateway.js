'use strict';

const portal = require('./portal');
const { ObjectId, database, requestIp, enforceRateLimit } = require('./_portal-security');

function send(res, status, code, message) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: false, error: { code, message } });
}
function ruleFor(action, method) {
  const write = !['GET','HEAD','OPTIONS'].includes(String(method || 'GET').toUpperCase());
  if (['login','admin-login'].includes(action)) return { scope:`gateway:${action}`, limit:20, windowMs:15 * 60 * 1000 };
  if (['message','admin-message'].includes(action)) return { scope:`gateway:${action}`, limit:45, windowMs:60 * 1000 };
  if (['password','admin-password'].includes(action)) return { scope:`gateway:${action}`, limit:12, windowMs:15 * 60 * 1000 };
  if (write) return { scope:'gateway:write', limit:90, windowMs:60 * 1000 };
  return { scope:'gateway:read', limit:240, windowMs:60 * 1000 };
}
async function archiveAttachments(db, ticketId) {
  if (!ObjectId.isValid(ticketId)) return;
  const oid = new ObjectId(ticketId);
  const active = await db.collection('ticket_attachments').find({ ticketId: oid }).toArray();
  if (!active.length) return;
  const archivedAt = new Date();
  for (const doc of active) {
    await db.collection('ticket_attachment_archive').replaceOne(
      { _id: doc._id },
      { ...doc, archived: true, archivedAt },
      { upsert: true }
    );
  }
  await db.collection('ticket_attachments').deleteMany({ _id: { $in: active.map(item => item._id) } });
}
function shouldArchive(action, req) {
  if (String(req.method).toUpperCase() !== 'PATCH') return false;
  const input = req.body && typeof req.body === 'object' ? req.body : {};
  return (action === 'ticket' && String(input.action || '').toLowerCase() === 'close') ||
    (action === 'admin-ticket' && String(input.status || '').toLowerCase() === 'fechado');
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return portal(req, res);
    const action = String(req.query?.action || '').toLowerCase().slice(0, 50);
    const db = await database();
    const rule = ruleFor(action, req.method);
    const limited = await enforceRateLimit(db, { ...rule, subject: requestIp(req) });
    res.setHeader('X-RateLimit-Limit', String(rule.limit));
    res.setHeader('X-RateLimit-Remaining', String(limited.remaining));
    if (!limited.allowed) {
      res.setHeader('Retry-After', String(limited.retryAfter));
      return send(res, 429, 'RATE_LIMITED', 'Muitas requisições em pouco tempo. Aguarde alguns instantes e tente novamente.');
    }
    const archiveAfter = shouldArchive(action, req);
    const result = await portal(req, res);
    if (archiveAfter && req.query?.id) {
      try { await archiveAttachments(db, req.query.id); }
      catch (error) { console.error('ATTACHMENT_ARCHIVE_AFTER_CLOSE', error.message); }
    }
    return result;
  } catch (error) {
    console.error('PORTAL_GATEWAY_ERROR', error);
    if (error.code === 'MONGODB_URI_NOT_CONFIGURED' || error.code === 'PORTAL_SECRETS_NOT_CONFIGURED') {
      return send(res, 503, 'PORTAL_NOT_CONFIGURED', 'O portal ainda não foi configurado no ambiente de hospedagem.');
    }
    return send(res, 500, 'GATEWAY_ERROR', 'Não foi possível processar a requisição agora.');
  }
};
