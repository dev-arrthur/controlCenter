'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_NAME = process.env.MONGODB_DB || 'controlcenter_portal';
const COOKIE_NAME = process.env.SESSION_COOKIE || 'cc_client_session';
const SESSION_HOURS = Math.max(1, Math.min(Number(process.env.SESSION_HOURS || 8), 72));
const STATUSES = ['aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado'];
const PRIORITIES = ['baixa', 'media', 'alta', 'urgente'];
const CATEGORIES = ['suporte', 'rede', 'wifi', 'servidor', 'seguranca', 'backup', 'email', 'acesso', 'equipamento', 'outro'];

if (!global.__ccPortalMongo) global.__ccPortalMongo = { client: null, promise: null, indexesReady: false };

function send(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(payload);
}
function ok(res, data = {}, status = 200) { return send(res, status, { ok: true, ...data }); }
function fail(res, status, code, message, details) {
  const payload = { ok: false, error: { code, message } };
  if (details !== undefined) payload.error.details = details;
  return send(res, status, payload);
}
function cleanText(value, max = 500) { return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : ''; }
function normalizeEmail(value) { return cleanText(value, 180).toLowerCase(); }
function normalizeCode(value) { return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, ''); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function objectId(value) { return ObjectId.isValid(value) ? new ObjectId(value) : null; }
function requestIp(req) {
  const value = req.headers['x-forwarded-for'];
  return typeof value === 'string' && value ? value.split(',')[0].trim() : (req.socket?.remoteAddress || 'unknown');
}
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return !host || new URL(origin).host === host;
  } catch { return false; }
}
async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 128 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) { const error = new Error('JWT_SECRET_NOT_CONFIGURED'); error.code = 'JWT_SECRET_NOT_CONFIGURED'; throw error; }
  return value;
}
function parseCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((out, part) => {
    const i = part.indexOf('='); if (i < 0) return out;
    const k = part.slice(0, i).trim(); if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim()); return out;
  }, {});
}
function setCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`);
}
function clearCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
async function ensureIndexes(db) {
  if (global.__ccPortalMongo.indexesReady) return;
  await Promise.all([
    db.collection('organizations').createIndex({ code: 1 }, { unique: true }),
    db.collection('users').createIndex({ organizationId: 1, email: 1 }, { unique: true }),
    db.collection('tickets').createIndex({ organizationId: 1, updatedAt: -1 }),
    db.collection('tickets').createIndex({ organizationId: 1, status: 1, updatedAt: -1 }),
    db.collection('tickets').createIndex({ ticketNumber: 1 }, { unique: true }),
    db.collection('ticket_messages').createIndex({ ticketId: 1, createdAt: 1 }),
    db.collection('audit_logs').createIndex({ organizationId: 1, createdAt: -1 }),
    db.collection('auth_attempts').createIndex({ updatedAt: 1 }, { expireAfterSeconds: 86400 })
  ]);
  global.__ccPortalMongo.indexesReady = true;
}
async function db() {
  if (!process.env.MONGODB_URI) { const error = new Error('MONGODB_URI_NOT_CONFIGURED'); error.code = 'MONGODB_URI_NOT_CONFIGURED'; throw error; }
  if (!global.__ccPortalMongo.promise) {
    global.__ccPortalMongo.client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
    global.__ccPortalMongo.promise = global.__ccPortalMongo.client.connect();
  }
  const database = (await global.__ccPortalMongo.promise).db(DB_NAME);
  await ensureIndexes(database);
  return database;
}
function publicUser(user, organization) {
  return { id: String(user._id), name: user.name, email: user.email, phone: user.phone || '', role: user.role, organization: { id: String(organization._id), name: organization.name, code: organization.code, supportTier: organization.supportTier || '' } };
}
async function auth(req) {
  const token = parseCookies(req)[COOKIE_NAME]; if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, secret(), { issuer: 'controlcenter-client-portal', audience: 'controlcenter-client' }); } catch { return null; }
  if (!ObjectId.isValid(payload.sub) || !ObjectId.isValid(payload.oid)) return null;
  const database = await db();
  const user = await database.collection('users').findOne({ _id: new ObjectId(payload.sub), organizationId: new ObjectId(payload.oid), active: true });
  if (!user || Number(user.sessionVersion || 1) !== Number(payload.sv || 1)) return null;
  const organization = await database.collection('organizations').findOne({ _id: user.organizationId, active: { $ne: false } });
  return organization ? { db: database, user, organization } : null;
}
function tokenFor(user) {
  return jwt.sign({ sub: String(user._id), oid: String(user.organizationId), role: user.role, sv: Number(user.sessionVersion || 1) }, secret(), { expiresIn: `${SESSION_HOURS}h`, issuer: 'controlcenter-client-portal', audience: 'controlcenter-client' });
}
async function audit(database, data) {
  try { await database.collection('audit_logs').insertOne({ ...data, createdAt: new Date() }); } catch (error) { console.error('AUDIT', error.message); }
}
function hashKey(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
async function guardLogin(database, req, org, email) {
  const key = hashKey(`${org}|${email}|${requestIp(req)}`); const now = new Date();
  const r = await database.collection('auth_attempts').findOne({ _id: key });
  if (r?.blockedUntil && r.blockedUntil > now) return { allowed: false, key, retryAfter: Math.ceil((r.blockedUntil - now) / 1000) };
  return { allowed: true, key };
}
async function loginFailure(database, key) {
  const now = new Date(); const old = await database.collection('auth_attempts').findOne({ _id: key });
  const recent = old?.windowStartedAt && now - old.windowStartedAt < 15 * 60 * 1000;
  const failures = recent ? Number(old.failures || 0) + 1 : 1;
  await database.collection('auth_attempts').updateOne({ _id: key }, { $set: { failures, windowStartedAt: recent ? old.windowStartedAt : now, blockedUntil: failures >= 6 ? new Date(now.getTime() + 15 * 60 * 1000) : null, updatedAt: now } }, { upsert: true });
}
async function nextTicketNumber(database) {
  const year = new Date().getFullYear();
  const r = await database.collection('counters').findOneAndUpdate({ _id: `tickets:${year}` }, { $inc: { seq: 1 }, $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: 'after' });
  const seq = Number(r?.seq || r?.value?.seq || 1); return `CC-${year}-${String(seq).padStart(6, '0')}`;
}
function serializeTicket(t) {
  return { id: String(t._id), ticketNumber: t.ticketNumber, title: t.title, description: t.description, category: t.category, priority: t.priority, status: t.status, requester: t.requester, createdAt: t.createdAt, updatedAt: t.updatedAt, resolvedAt: t.resolvedAt || null, closedAt: t.closedAt || null, lastMessageAt: t.lastMessageAt || t.createdAt };
}
async function requireClient(req, res) {
  const session = await auth(req); if (!session) { clearCookie(res); fail(res, 401, 'UNAUTHENTICATED', 'Sessão expirada ou inválida.'); return null; } return session;
}

async function actionLogin(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req); const organizationCode = normalizeCode(input.organizationCode); const email = normalizeEmail(input.email); const password = typeof input.password === 'string' ? input.password : '';
  if (!organizationCode || !validEmail(email) || !password) return fail(res, 400, 'INVALID_CREDENTIALS', 'Informe empresa, e-mail e senha.');
  const database = await db(); const guard = await guardLogin(database, req, organizationCode, email);
  if (!guard.allowed) { res.setHeader('Retry-After', String(guard.retryAfter || 900)); return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas de acesso. Aguarde alguns minutos.'); }
  const organization = await database.collection('organizations').findOne({ code: organizationCode, active: { $ne: false } });
  const user = organization ? await database.collection('users').findOne({ organizationId: organization._id, email, active: true }) : null;
  const valid = user ? await bcrypt.compare(password, user.passwordHash || '') : false;
  if (!organization || !user || !valid) { await loginFailure(database, guard.key); return fail(res, 401, 'INVALID_CREDENTIALS', 'Empresa, e-mail ou senha inválidos.'); }
  await database.collection('auth_attempts').deleteOne({ _id: guard.key });
  await database.collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });
  setCookie(res, tokenFor(user));
  await audit(database, { organizationId: organization._id, userId: user._id, action: 'auth.login', entityType: 'user', entityId: user._id });
  return ok(res, { user: publicUser(user, organization) });
}
async function actionMe(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const s = await requireClient(req, res); if (!s) return; return ok(res, { user: publicUser(s.user, s.organization) });
}
async function actionLogout(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  clearCookie(res); return ok(res);
}
async function actionDashboard(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const s = await requireClient(req, res); if (!s) return; const tickets = s.db.collection('tickets'); const oid = s.organization._id;
  const [abertos, emAtendimento, aguardandoCliente, recentes] = await Promise.all([tickets.countDocuments({ organizationId: oid, status: 'aberto' }), tickets.countDocuments({ organizationId: oid, status: 'em_atendimento' }), tickets.countDocuments({ organizationId: oid, status: 'aguardando_cliente' }), tickets.find({ organizationId: oid }).sort({ updatedAt: -1 }).limit(6).toArray()]);
  return ok(res, { stats: { abertos, emAtendimento, aguardandoCliente, ativos: abertos + emAtendimento + aguardandoCliente }, recentTickets: recentes.map(serializeTicket) });
}
async function actionTickets(req, res) {
  const s = await requireClient(req, res); if (!s) return;
  if (req.method === 'GET') {
    const status = cleanText(req.query.status || '', 30).toLowerCase(); const search = cleanText(req.query.search || '', 100); const page = Math.max(1, Math.min(Number(req.query.page || 1), 1000)); const limit = 20;
    const filter = { organizationId: s.organization._id }; if (status && STATUSES.includes(status)) filter.status = status;
    if (search) { const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ ticketNumber: { $regex: escaped, $options: 'i' } }, { title: { $regex: escaped, $options: 'i' } }]; }
    const [items, total] = await Promise.all([s.db.collection('tickets').find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(), s.db.collection('tickets').countDocuments(filter)]);
    return ok(res, { tickets: items.map(serializeTicket), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  }
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req); const title = cleanText(input.title, 140); const description = cleanText(input.description, 5000); const category = cleanText(input.category, 30).toLowerCase(); const priority = cleanText(input.priority, 20).toLowerCase(); const errors = {};
  if (title.length < 5) errors.title = 'Informe um título com pelo menos 5 caracteres.'; if (description.length < 15) errors.description = 'Descreva o chamado com pelo menos 15 caracteres.'; if (!CATEGORIES.includes(category)) errors.category = 'Categoria inválida.'; if (!PRIORITIES.includes(priority)) errors.priority = 'Prioridade inválida.';
  if (Object.keys(errors).length) return fail(res, 422, 'VALIDATION_ERROR', 'Revise os campos do chamado.', errors);
  const now = new Date(); const ticket = { ticketNumber: await nextTicketNumber(s.db), organizationId: s.organization._id, createdBy: s.user._id, requester: { userId: String(s.user._id), name: s.user.name, email: s.user.email }, title, description, category, priority, status: 'aberto', channel: 'portal_cliente', createdAt: now, updatedAt: now, lastMessageAt: now };
  const inserted = await s.db.collection('tickets').insertOne(ticket); ticket._id = inserted.insertedId;
  await s.db.collection('ticket_messages').insertOne({ ticketId: ticket._id, organizationId: s.organization._id, authorId: s.user._id, authorType: 'client', authorName: s.user.name, message: description, internal: false, createdAt: now });
  await audit(s.db, { organizationId: s.organization._id, userId: s.user._id, action: 'ticket.created', entityType: 'ticket', entityId: ticket._id, metadata: { ticketNumber: ticket.ticketNumber, priority, category } });
  return ok(res, { ticket: serializeTicket(ticket) }, 201);
}
async function actionTicket(req, res) {
  const s = await requireClient(req, res); if (!s) return; const id = objectId(req.query.id); if (!id) return fail(res, 400, 'INVALID_TICKET', 'Chamado inválido.');
  const filter = { _id: id, organizationId: s.organization._id }; const ticket = await s.db.collection('tickets').findOne(filter); if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');
  if (req.method === 'GET') {
    const messages = await s.db.collection('ticket_messages').find({ ticketId: id, organizationId: s.organization._id, internal: { $ne: true } }).sort({ createdAt: 1 }).toArray();
    return ok(res, { ticket: serializeTicket(ticket), messages: messages.map(m => ({ id: String(m._id), authorType: m.authorType, authorName: m.authorName, message: m.message, createdAt: m.createdAt })) });
  }
  if (req.method !== 'PATCH') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req); const action = cleanText(input.action, 30).toLowerCase(); let status;
  if (action === 'close' && ticket.status !== 'fechado') status = 'fechado'; if (action === 'reopen' && ['resolvido', 'fechado'].includes(ticket.status)) status = 'aberto'; if (!status) return fail(res, 422, 'INVALID_ACTION', 'Ação não permitida para o estado atual.');
  const now = new Date(); const update = { status, updatedAt: now, closedAt: status === 'fechado' ? now : null }; await s.db.collection('tickets').updateOne(filter, { $set: update }); const updated = await s.db.collection('tickets').findOne(filter);
  await audit(s.db, { organizationId: s.organization._id, userId: s.user._id, action: status === 'fechado' ? 'ticket.closed_by_client' : 'ticket.reopened_by_client', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber } });
  return ok(res, { ticket: serializeTicket(updated) });
}
async function actionMessage(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.'); if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const s = await requireClient(req, res); if (!s) return; const id = objectId(req.query.id); if (!id) return fail(res, 400, 'INVALID_TICKET', 'Chamado inválido.');
  const ticket = await s.db.collection('tickets').findOne({ _id: id, organizationId: s.organization._id }); if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.'); if (ticket.status === 'fechado') return fail(res, 409, 'TICKET_CLOSED', 'Reabra o chamado antes de responder.');
  const input = await parseBody(req); const message = cleanText(input.message, 5000); if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.'); const now = new Date();
  const inserted = await s.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: s.organization._id, authorId: s.user._id, authorType: 'client', authorName: s.user.name, message, internal: false, createdAt: now });
  await s.db.collection('tickets').updateOne({ _id: id }, { $set: { updatedAt: now, lastMessageAt: now, ...(ticket.status === 'aguardando_cliente' ? { status: 'aberto' } : {}) } });
  await audit(s.db, { organizationId: s.organization._id, userId: s.user._id, action: 'ticket.message.client', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber } });
  return ok(res, { message: { id: String(inserted.insertedId), authorType: 'client', authorName: s.user.name, message, createdAt: now } }, 201);
}
async function actionProfile(req, res) {
  const s = await requireClient(req, res); if (!s) return; if (req.method === 'GET') return ok(res, { user: publicUser(s.user, s.organization) }); if (req.method !== 'PATCH') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.'); if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req); const name = cleanText(input.name, 120); const phone = cleanText(input.phone, 40); if (name.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Informe seu nome.');
  await s.db.collection('users').updateOne({ _id: s.user._id }, { $set: { name, phone, updatedAt: new Date() } }); const updated = await s.db.collection('users').findOne({ _id: s.user._id }); return ok(res, { user: publicUser(updated, s.organization) });
}
async function actionPassword(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.'); if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.'); const s = await requireClient(req, res); if (!s) return;
  const input = await parseBody(req); const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : ''; const newPassword = typeof input.newPassword === 'string' ? input.newPassword : '';
  if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return fail(res, 422, 'WEAK_PASSWORD', 'A nova senha deve ter pelo menos 10 caracteres, com letras e números.'); if (!(await bcrypt.compare(currentPassword, s.user.passwordHash || ''))) return fail(res, 401, 'INVALID_PASSWORD', 'A senha atual está incorreta.');
  await s.db.collection('users').updateOne({ _id: s.user._id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date() }, $inc: { sessionVersion: 1 } }); clearCookie(res); return ok(res, { relogin: true });
}
async function actionHealth(req, res) { const database = await db(); await database.command({ ping: 1 }); return ok(res, { service: 'controlcenter-client-portal', database: 'connected', timestamp: new Date().toISOString() }); }

module.exports = async function handler(req, res) {
  const action = cleanText(req.query.action || '', 40).toLowerCase();
  try {
    const routes = { login: actionLogin, me: actionMe, logout: actionLogout, dashboard: actionDashboard, tickets: actionTickets, ticket: actionTicket, message: actionMessage, profile: actionProfile, password: actionPassword, health: actionHealth };
    if (!routes[action]) return fail(res, 404, 'NOT_FOUND', 'Rota do portal não encontrada.');
    return await routes[action](req, res);
  } catch (error) {
    console.error('PORTAL_API_ERROR', action, error);
    if (error.code === 'MONGODB_URI_NOT_CONFIGURED' || error.code === 'JWT_SECRET_NOT_CONFIGURED') return fail(res, 503, 'PORTAL_NOT_CONFIGURED', 'O portal ainda não foi configurado no ambiente de hospedagem.');
    return fail(res, 500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação agora.');
  }
};
