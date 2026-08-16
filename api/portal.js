'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_NAME = process.env.MONGODB_DB || 'controlcenter_portal';
const CLIENT_COOKIE = process.env.SESSION_COOKIE || 'cc_client_session';
const ADMIN_COOKIE = process.env.ADMIN_SESSION_COOKIE || 'cc_admin_session';
const SESSION_HOURS = Math.max(1, Math.min(Number(process.env.SESSION_HOURS || 8), 72));
const STATUSES = ['aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado'];
const PRIORITIES = ['baixa', 'media', 'alta', 'urgente'];
const CATEGORIES = ['suporte', 'rede', 'wifi', 'servidor', 'seguranca', 'backup', 'email', 'acesso', 'equipamento', 'outro'];
const ADMIN_ROLES = ['admin', 'support'];
const CLIENT_ROLES = ['client', 'client_admin'];

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
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
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
  if (!value || value.length < 32) {
    const error = new Error('JWT_SECRET_NOT_CONFIGURED');
    error.code = 'JWT_SECRET_NOT_CONFIGURED';
    throw error;
  }
  return value;
}
function parseCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((out, part) => {
    const i = part.indexOf('=');
    if (i < 0) return out;
    const key = part.slice(0, i).trim();
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim());
    return out;
  }, {});
}
function setCookie(res, name, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`);
}
function clearCookie(res, name) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function ensureIndexes(database) {
  if (global.__ccPortalMongo.indexesReady) return;
  await Promise.all([
    database.collection('organizations').createIndex({ code: 1 }, { unique: true }),
    database.collection('users').createIndex({ organizationId: 1, email: 1 }, { unique: true }),
    database.collection('users').createIndex({ email: 1, role: 1 }),
    database.collection('tickets').createIndex({ organizationId: 1, updatedAt: -1 }),
    database.collection('tickets').createIndex({ organizationId: 1, status: 1, updatedAt: -1 }),
    database.collection('tickets').createIndex({ status: 1, priority: 1, updatedAt: -1 }),
    database.collection('tickets').createIndex({ assignedTo: 1, updatedAt: -1 }),
    database.collection('tickets').createIndex({ ticketNumber: 1 }, { unique: true }),
    database.collection('ticket_messages').createIndex({ ticketId: 1, createdAt: 1 }),
    database.collection('audit_logs').createIndex({ organizationId: 1, createdAt: -1 }),
    database.collection('auth_attempts').createIndex({ updatedAt: 1 }, { expireAfterSeconds: 86400 })
  ]);
  global.__ccPortalMongo.indexesReady = true;
}
async function db() {
  if (!process.env.MONGODB_URI) {
    const error = new Error('MONGODB_URI_NOT_CONFIGURED');
    error.code = 'MONGODB_URI_NOT_CONFIGURED';
    throw error;
  }
  if (!global.__ccPortalMongo.promise) {
    global.__ccPortalMongo.client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    global.__ccPortalMongo.promise = global.__ccPortalMongo.client.connect();
  }
  const database = (await global.__ccPortalMongo.promise).db(DB_NAME);
  await ensureIndexes(database);
  return database;
}

function publicClientUser(user, organization) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    organization: {
      id: String(organization._id),
      name: organization.name,
      code: organization.code,
      supportTier: organization.supportTier || ''
    }
  };
}
function publicAdminUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    forcePasswordChange: user.forcePasswordChange === true,
    lastLoginAt: user.lastLoginAt || null
  };
}
function clientToken(user) {
  return jwt.sign(
    { sub: String(user._id), oid: String(user.organizationId), role: user.role, kind: 'client', sv: Number(user.sessionVersion || 1) },
    secret(),
    { expiresIn: `${SESSION_HOURS}h`, issuer: 'controlcenter-portal', audience: 'controlcenter-client' }
  );
}
function adminToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, kind: 'admin', sv: Number(user.sessionVersion || 1) },
    secret(),
    { expiresIn: `${SESSION_HOURS}h`, issuer: 'controlcenter-portal', audience: 'controlcenter-admin' }
  );
}
async function authClient(req) {
  const token = parseCookies(req)[CLIENT_COOKIE];
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, secret(), { issuer: 'controlcenter-portal', audience: 'controlcenter-client' }); } catch { return null; }
  if (payload.kind !== 'client' || !ObjectId.isValid(payload.sub) || !ObjectId.isValid(payload.oid)) return null;
  const database = await db();
  const user = await database.collection('users').findOne({
    _id: new ObjectId(payload.sub),
    organizationId: new ObjectId(payload.oid),
    role: { $in: CLIENT_ROLES },
    active: true
  });
  if (!user || Number(user.sessionVersion || 1) !== Number(payload.sv || 1)) return null;
  const organization = await database.collection('organizations').findOne({ _id: user.organizationId, active: { $ne: false } });
  return organization ? { db: database, user, organization } : null;
}
async function authAdmin(req) {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, secret(), { issuer: 'controlcenter-portal', audience: 'controlcenter-admin' }); } catch { return null; }
  if (payload.kind !== 'admin' || !ObjectId.isValid(payload.sub) || !ADMIN_ROLES.includes(payload.role)) return null;
  const database = await db();
  const user = await database.collection('users').findOne({
    _id: new ObjectId(payload.sub),
    role: { $in: ADMIN_ROLES },
    active: true
  });
  if (!user || Number(user.sessionVersion || 1) !== Number(payload.sv || 1)) return null;
  return { db: database, user };
}
async function requireClient(req, res) {
  const session = await authClient(req);
  if (!session) {
    clearCookie(res, CLIENT_COOKIE);
    fail(res, 401, 'UNAUTHENTICATED', 'Sessão expirada ou inválida.');
    return null;
  }
  return session;
}
async function requireAdmin(req, res, allowPasswordChange = false) {
  const session = await authAdmin(req);
  if (!session) {
    clearCookie(res, ADMIN_COOKIE);
    fail(res, 401, 'UNAUTHENTICATED', 'Sessão administrativa expirada ou inválida.');
    return null;
  }
  if (session.user.forcePasswordChange === true && !allowPasswordChange) {
    fail(res, 428, 'PASSWORD_CHANGE_REQUIRED', 'Redefina sua senha antes de acessar o portal administrativo.');
    return null;
  }
  return session;
}

async function audit(database, data) {
  try { await database.collection('audit_logs').insertOne({ ...data, createdAt: new Date() }); }
  catch (error) { console.error('AUDIT', error.message); }
}
function hashKey(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
async function guardLogin(database, req, scope, email) {
  const key = hashKey(`${scope}|${email}|${requestIp(req)}`);
  const now = new Date();
  const record = await database.collection('auth_attempts').findOne({ _id: key });
  if (record?.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, key, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  return { allowed: true, key };
}
async function loginFailure(database, key) {
  const now = new Date();
  const old = await database.collection('auth_attempts').findOne({ _id: key });
  const recent = old?.windowStartedAt && now - old.windowStartedAt < 15 * 60 * 1000;
  const failures = recent ? Number(old.failures || 0) + 1 : 1;
  await database.collection('auth_attempts').updateOne(
    { _id: key },
    { $set: { failures, windowStartedAt: recent ? old.windowStartedAt : now, blockedUntil: failures >= 6 ? new Date(now.getTime() + 15 * 60 * 1000) : null, updatedAt: now } },
    { upsert: true }
  );
}
async function nextTicketNumber(database) {
  const year = new Date().getFullYear();
  const result = await database.collection('counters').findOneAndUpdate(
    { _id: `tickets:${year}` },
    { $inc: { seq: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = Number(result?.seq || result?.value?.seq || 1);
  return `CC-${year}-${String(seq).padStart(6, '0')}`;
}
function serializeTicket(ticket) {
  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    requester: ticket.requester,
    assignedTo: ticket.assignedTo ? String(ticket.assignedTo) : null,
    assignedName: ticket.assignedName || '',
    organizationId: ticket.organizationId ? String(ticket.organizationId) : null,
    organizationName: ticket.organizationName || '',
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt || null,
    closedAt: ticket.closedAt || null,
    lastMessageAt: ticket.lastMessageAt || ticket.createdAt
  };
}
async function enrichTickets(database, tickets) {
  if (!tickets.length) return [];
  const orgIds = [...new Set(tickets.map(t => String(t.organizationId)).filter(Boolean))].map(id => new ObjectId(id));
  const adminIds = [...new Set(tickets.map(t => t.assignedTo ? String(t.assignedTo) : '').filter(Boolean))].map(id => new ObjectId(id));
  const [orgs, admins] = await Promise.all([
    orgIds.length ? database.collection('organizations').find({ _id: { $in: orgIds } }).project({ name: 1 }).toArray() : [],
    adminIds.length ? database.collection('users').find({ _id: { $in: adminIds } }).project({ name: 1 }).toArray() : []
  ]);
  const orgMap = new Map(orgs.map(o => [String(o._id), o.name]));
  const adminMap = new Map(admins.map(u => [String(u._id), u.name]));
  return tickets.map(t => serializeTicket({ ...t, organizationName: orgMap.get(String(t.organizationId)) || 'Empresa', assignedName: t.assignedTo ? (adminMap.get(String(t.assignedTo)) || '') : '' }));
}
function validNewPassword(password) {
  return typeof password === 'string' && password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
async function uniqueOrganizationCode(database, preferred, name) {
  const base = normalizeCode(preferred) || normalizeCode(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')) || `cliente-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (await database.collection('organizations').findOne({ code: candidate })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

// CLIENTE --------------------------------------------------------------------
async function actionLogin(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  if (!validEmail(email) || !password) return fail(res, 400, 'INVALID_CREDENTIALS', 'Informe e-mail e senha.');

  const database = await db();
  const guard = await guardLogin(database, req, 'client', email);
  if (!guard.allowed) {
    res.setHeader('Retry-After', String(guard.retryAfter || 900));
    return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas de acesso. Aguarde alguns minutos.');
  }

  const matches = await database.collection('users').find({ email, role: { $in: CLIENT_ROLES }, active: true }).limit(2).toArray();
  if (matches.length > 1) return fail(res, 409, 'ACCOUNT_AMBIGUOUS', 'Este e-mail está vinculado a mais de uma empresa. Fale com a ControlCenter para ajustar o acesso.');
  const user = matches[0] || null;
  const organization = user ? await database.collection('organizations').findOne({ _id: user.organizationId, active: { $ne: false } }) : null;
  const valid = user && organization ? await bcrypt.compare(password, user.passwordHash || '') : false;
  if (!user || !organization || !valid) {
    await loginFailure(database, guard.key);
    return fail(res, 401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }

  await database.collection('auth_attempts').deleteOne({ _id: guard.key });
  await database.collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });
  setCookie(res, CLIENT_COOKIE, clientToken(user));
  await audit(database, { organizationId: organization._id, userId: user._id, action: 'auth.client.login', entityType: 'user', entityId: user._id });
  return ok(res, { user: publicClientUser(user, organization) });
}
async function actionMe(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const session = await requireClient(req, res);
  if (!session) return;
  return ok(res, { user: publicClientUser(session.user, session.organization) });
}
async function actionLogout(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  clearCookie(res, CLIENT_COOKIE);
  return ok(res);
}
async function actionDashboard(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const session = await requireClient(req, res);
  if (!session) return;
  const tickets = session.db.collection('tickets');
  const oid = session.organization._id;
  const [abertos, emAtendimento, aguardandoCliente, recentes] = await Promise.all([
    tickets.countDocuments({ organizationId: oid, status: 'aberto' }),
    tickets.countDocuments({ organizationId: oid, status: 'em_atendimento' }),
    tickets.countDocuments({ organizationId: oid, status: 'aguardando_cliente' }),
    tickets.find({ organizationId: oid }).sort({ updatedAt: -1 }).limit(6).toArray()
  ]);
  return ok(res, { stats: { abertos, emAtendimento, aguardandoCliente, ativos: abertos + emAtendimento + aguardandoCliente }, recentTickets: recentes.map(serializeTicket) });
}
async function actionTickets(req, res) {
  const session = await requireClient(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const status = cleanText(req.query.status || '', 30).toLowerCase();
    const search = cleanText(req.query.search || '', 100);
    const page = Math.max(1, Math.min(Number(req.query.page || 1), 1000));
    const limit = 20;
    const filter = { organizationId: session.organization._id };
    if (status && STATUSES.includes(status)) filter.status = status;
    if (search) {
      const regex = escapeRegex(search);
      filter.$or = [{ ticketNumber: { $regex: regex, $options: 'i' } }, { title: { $regex: regex, $options: 'i' } }];
    }
    const [items, total] = await Promise.all([
      session.db.collection('tickets').find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      session.db.collection('tickets').countDocuments(filter)
    ]);
    return ok(res, { tickets: items.map(serializeTicket), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  }
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req);
  const title = cleanText(input.title, 140);
  const description = cleanText(input.description, 5000);
  const category = cleanText(input.category, 30).toLowerCase();
  const priority = cleanText(input.priority, 20).toLowerCase();
  const errors = {};
  if (title.length < 5) errors.title = 'Informe um título com pelo menos 5 caracteres.';
  if (description.length < 15) errors.description = 'Descreva o chamado com pelo menos 15 caracteres.';
  if (!CATEGORIES.includes(category)) errors.category = 'Categoria inválida.';
  if (!PRIORITIES.includes(priority)) errors.priority = 'Prioridade inválida.';
  if (Object.keys(errors).length) return fail(res, 422, 'VALIDATION_ERROR', 'Revise os campos do chamado.', errors);

  const now = new Date();
  const ticket = {
    ticketNumber: await nextTicketNumber(session.db),
    organizationId: session.organization._id,
    createdBy: session.user._id,
    requester: { userId: String(session.user._id), name: session.user.name, email: session.user.email },
    title,
    description,
    category,
    priority,
    status: 'aberto',
    assignedTo: null,
    channel: 'portal_cliente',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now
  };
  const inserted = await session.db.collection('tickets').insertOne(ticket);
  ticket._id = inserted.insertedId;
  await session.db.collection('ticket_messages').insertOne({ ticketId: ticket._id, organizationId: session.organization._id, authorId: session.user._id, authorType: 'client', authorName: session.user.name, message: description, internal: false, createdAt: now });
  await audit(session.db, { organizationId: session.organization._id, userId: session.user._id, action: 'ticket.created', entityType: 'ticket', entityId: ticket._id, metadata: { ticketNumber: ticket.ticketNumber, priority, category } });
  return ok(res, { ticket: serializeTicket(ticket) }, 201);
}
async function actionTicket(req, res) {
  const session = await requireClient(req, res);
  if (!session) return;
  const id = objectId(req.query.id);
  if (!id) return fail(res, 400, 'INVALID_TICKET', 'Chamado inválido.');
  const filter = { _id: id, organizationId: session.organization._id };
  const ticket = await session.db.collection('tickets').findOne(filter);
  if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');

  if (req.method === 'GET') {
    const messages = await session.db.collection('ticket_messages').find({ ticketId: id, organizationId: session.organization._id, internal: { $ne: true } }).sort({ createdAt: 1 }).toArray();
    return ok(res, { ticket: serializeTicket(ticket), messages: messages.map(m => ({ id: String(m._id), authorType: m.authorType, authorName: m.authorName, message: m.message, createdAt: m.createdAt })) });
  }
  if (req.method !== 'PATCH') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req);
  const action = cleanText(input.action, 30).toLowerCase();
  let status;
  if (action === 'close' && ticket.status !== 'fechado') status = 'fechado';
  if (action === 'reopen' && ['resolvido', 'fechado'].includes(ticket.status)) status = 'aberto';
  if (!status) return fail(res, 422, 'INVALID_ACTION', 'Ação não permitida para o estado atual.');
  const now = new Date();
  const update = { status, updatedAt: now, closedAt: status === 'fechado' ? now : null };
  if (status === 'aberto') update.resolvedAt = null;
  await session.db.collection('tickets').updateOne(filter, { $set: update });
  const updated = await session.db.collection('tickets').findOne(filter);
  await audit(session.db, { organizationId: session.organization._id, userId: session.user._id, action: status === 'fechado' ? 'ticket.closed_by_client' : 'ticket.reopened_by_client', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber } });
  return ok(res, { ticket: serializeTicket(updated) });
}
async function actionMessage(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const session = await requireClient(req, res);
  if (!session) return;
  const id = objectId(req.query.id);
  if (!id) return fail(res, 400, 'INVALID_TICKET', 'Chamado inválido.');
  const ticket = await session.db.collection('tickets').findOne({ _id: id, organizationId: session.organization._id });
  if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');
  if (ticket.status === 'fechado') return fail(res, 409, 'TICKET_CLOSED', 'Reabra o chamado antes de responder.');
  const input = await parseBody(req);
  const message = cleanText(input.message, 5000);
  if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.');
  const now = new Date();
  const inserted = await session.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: session.organization._id, authorId: session.user._id, authorType: 'client', authorName: session.user.name, message, internal: false, createdAt: now });
  await session.db.collection('tickets').updateOne({ _id: id }, { $set: { updatedAt: now, lastMessageAt: now, ...(ticket.status === 'aguardando_cliente' ? { status: 'aberto' } : {}) } });
  await audit(session.db, { organizationId: session.organization._id, userId: session.user._id, action: 'ticket.message.client', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber } });
  return ok(res, { message: { id: String(inserted.insertedId), authorType: 'client', authorName: session.user.name, message, createdAt: now } }, 201);
}
async function actionProfile(req, res) {
  const session = await requireClient(req, res);
  if (!session) return;
  if (req.method === 'GET') return ok(res, { user: publicClientUser(session.user, session.organization) });
  if (req.method !== 'PATCH') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req);
  const name = cleanText(input.name, 120);
  const phone = cleanText(input.phone, 40);
  if (name.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Informe seu nome.');
  await session.db.collection('users').updateOne({ _id: session.user._id }, { $set: { name, phone, updatedAt: new Date() } });
  const updated = await session.db.collection('users').findOne({ _id: session.user._id });
  return ok(res, { user: publicClientUser(updated, session.organization) });
}
async function actionPassword(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const session = await requireClient(req, res);
  if (!session) return;
  const input = await parseBody(req);
  const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : '';
  if (!validNewPassword(newPassword)) return fail(res, 422, 'WEAK_PASSWORD', 'A nova senha deve ter pelo menos 10 caracteres, com letras e números.');
  if (!(await bcrypt.compare(currentPassword, session.user.passwordHash || ''))) return fail(res, 401, 'INVALID_PASSWORD', 'A senha atual está incorreta.');
  await session.db.collection('users').updateOne({ _id: session.user._id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date() }, $inc: { sessionVersion: 1 } });
  clearCookie(res, CLIENT_COOKIE);
  return ok(res, { relogin: true });
}

// ADMIN ----------------------------------------------------------------------
async function actionAdminLogin(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  if (!validEmail(email) || !password) return fail(res, 400, 'INVALID_CREDENTIALS', 'Informe e-mail e senha.');

  const database = await db();
  const guard = await guardLogin(database, req, 'admin', email);
  if (!guard.allowed) {
    res.setHeader('Retry-After', String(guard.retryAfter || 900));
    return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas de acesso. Aguarde alguns minutos.');
  }
  const user = await database.collection('users').findOne({ email, role: { $in: ADMIN_ROLES }, active: true });
  const valid = user ? await bcrypt.compare(password, user.passwordHash || '') : false;
  if (!user || !valid) {
    await loginFailure(database, guard.key);
    return fail(res, 401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }
  await database.collection('auth_attempts').deleteOne({ _id: guard.key });
  await database.collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });
  setCookie(res, ADMIN_COOKIE, adminToken(user));
  await audit(database, { organizationId: user.organizationId || null, userId: user._id, action: 'auth.admin.login', entityType: 'user', entityId: user._id });
  return ok(res, { user: publicAdminUser(user), mustChangePassword: user.forcePasswordChange === true });
}
async function actionAdminMe(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const session = await requireAdmin(req, res, true);
  if (!session) return;
  return ok(res, { user: publicAdminUser(session.user), mustChangePassword: session.user.forcePasswordChange === true });
}
async function actionAdminLogout(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  clearCookie(res, ADMIN_COOKIE);
  return ok(res);
}
async function actionAdminPassword(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const session = await requireAdmin(req, res, true);
  if (!session) return;
  const input = await parseBody(req);
  const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : '';
  if (!validNewPassword(newPassword)) return fail(res, 422, 'WEAK_PASSWORD', 'A nova senha deve ter pelo menos 10 caracteres, com letras e números.');
  if (!(await bcrypt.compare(currentPassword, session.user.passwordHash || ''))) return fail(res, 401, 'INVALID_PASSWORD', 'A senha atual está incorreta.');
  await session.db.collection('users').updateOne(
    { _id: session.user._id },
    { $set: { passwordHash: await bcrypt.hash(newPassword, 12), forcePasswordChange: false, updatedAt: new Date() }, $inc: { sessionVersion: 1 } }
  );
  await audit(session.db, { organizationId: session.user.organizationId || null, userId: session.user._id, action: 'auth.admin.password_changed', entityType: 'user', entityId: session.user._id });
  clearCookie(res, ADMIN_COOKIE);
  return ok(res, { relogin: true });
}
async function actionAdminDashboard(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const session = await requireAdmin(req, res);
  if (!session) return;
  const tickets = session.db.collection('tickets');
  const active = { $in: ['aberto', 'em_atendimento', 'aguardando_cliente'] };
  const [abertos, emAtendimento, aguardandoCliente, urgentes, clientes, usuarios, recentes] = await Promise.all([
    tickets.countDocuments({ status: 'aberto' }),
    tickets.countDocuments({ status: 'em_atendimento' }),
    tickets.countDocuments({ status: 'aguardando_cliente' }),
    tickets.countDocuments({ status: active, priority: 'urgente' }),
    session.db.collection('organizations').countDocuments({ code: { $ne: 'controlcenter-internal' }, active: { $ne: false }, $or: [{ kind: 'client' }, { kind: { $exists: false } }] }),
    session.db.collection('users').countDocuments({ role: { $in: CLIENT_ROLES }, active: true }),
    tickets.find({}).sort({ updatedAt: -1 }).limit(8).toArray()
  ]);
  const recentTickets = await enrichTickets(session.db, recentes);
  return ok(res, {
    stats: {
      ativos: abertos + emAtendimento + aguardandoCliente,
      abertos,
      emAtendimento,
      aguardandoCliente,
      urgentes,
      clientes,
      usuarios
    },
    recentTickets
  });
}
async function actionAdminTickets(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const status = cleanText(req.query.status || '', 30).toLowerCase();
  const priority = cleanText(req.query.priority || '', 20).toLowerCase();
  const organizationId = objectId(req.query.organizationId);
  const search = cleanText(req.query.search || '', 120);
  const page = Math.max(1, Math.min(Number(req.query.page || 1), 1000));
  const limit = 25;
  const filter = {};
  if (status && STATUSES.includes(status)) filter.status = status;
  if (priority && PRIORITIES.includes(priority)) filter.priority = priority;
  if (organizationId) filter.organizationId = organizationId;
  if (search) {
    const regex = escapeRegex(search);
    filter.$or = [
      { ticketNumber: { $regex: regex, $options: 'i' } },
      { title: { $regex: regex, $options: 'i' } },
      { 'requester.name': { $regex: regex, $options: 'i' } },
      { 'requester.email': { $regex: regex, $options: 'i' } }
    ];
  }
  const [items, total] = await Promise.all([
    session.db.collection('tickets').find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    session.db.collection('tickets').countDocuments(filter)
  ]);
  return ok(res, { tickets: await enrichTickets(session.db, items), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}
async function actionAdminTicket(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  const id = objectId(req.query.id);
  if (!id) return fail(res, 400, 'INVALID_TICKET', 'Chamado inválido.');
  const ticket = await session.db.collection('tickets').findOne({ _id: id });
  if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');

  if (req.method === 'GET') {
    const [messages, org, team, enriched] = await Promise.all([
      session.db.collection('ticket_messages').find({ ticketId: id }).sort({ createdAt: 1 }).toArray(),
      session.db.collection('organizations').findOne({ _id: ticket.organizationId }),
      session.db.collection('users').find({ role: { $in: ADMIN_ROLES }, active: true }).project({ name: 1, email: 1, role: 1 }).sort({ name: 1 }).toArray(),
      enrichTickets(session.db, [ticket])
    ]);
    return ok(res, {
      ticket: enriched[0],
      organization: org ? { id: String(org._id), name: org.name, code: org.code, supportTier: org.supportTier || '' } : null,
      messages: messages.map(m => ({ id: String(m._id), authorType: m.authorType, authorName: m.authorName, message: m.message, internal: m.internal === true, createdAt: m.createdAt })),
      team: team.map(u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role }))
    });
  }
  if (req.method !== 'PATCH') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const input = await parseBody(req);
  const update = { updatedAt: new Date() };
  if (input.status !== undefined) {
    const status = cleanText(input.status, 30).toLowerCase();
    if (!STATUSES.includes(status)) return fail(res, 422, 'INVALID_STATUS', 'Status inválido.');
    update.status = status;
    update.resolvedAt = status === 'resolvido' ? new Date() : (['aberto', 'em_atendimento', 'aguardando_cliente'].includes(status) ? null : ticket.resolvedAt || null);
    update.closedAt = status === 'fechado' ? new Date() : (status !== 'fechado' ? null : ticket.closedAt || null);
  }
  if (input.priority !== undefined) {
    const priority = cleanText(input.priority, 20).toLowerCase();
    if (!PRIORITIES.includes(priority)) return fail(res, 422, 'INVALID_PRIORITY', 'Prioridade inválida.');
    update.priority = priority;
  }
  if (input.assignedTo !== undefined) {
    if (!input.assignedTo) {
      update.assignedTo = null;
    } else {
      const assignedId = objectId(input.assignedTo);
      const assignee = assignedId ? await session.db.collection('users').findOne({ _id: assignedId, role: { $in: ADMIN_ROLES }, active: true }) : null;
      if (!assignee) return fail(res, 422, 'INVALID_ASSIGNEE', 'Responsável inválido.');
      update.assignedTo = assignee._id;
      if (!update.status && ticket.status === 'aberto') update.status = 'em_atendimento';
    }
  }
  if (Object.keys(update).length === 1) return fail(res, 422, 'NO_CHANGES', 'Nenhuma alteração foi informada.');
  await session.db.collection('tickets').updateOne({ _id: id }, { $set: update });
  const updated = await session.db.collection('tickets').findOne({ _id: id });
  await audit(session.db, { organizationId: ticket.organizationId, userId: session.user._id, action: 'ticket.updated_by_admin', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber, changes: Object.keys(update).filter(k => k !== 'updatedAt') } });
  return ok(res, { ticket: (await enrichTickets(session.db, [updated]))[0] });
}
async function actionAdminMessage(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
  const session = await requireAdmin(req, res);
  if (!session) return;
  const id = objectId(req.query.id);
  if (!id) return fail(res, 400, 'INVALID_TICKET', 'Chamado inválido.');
  const ticket = await session.db.collection('tickets').findOne({ _id: id });
  if (!ticket) return fail(res, 404, 'TICKET_NOT_FOUND', 'Chamado não encontrado.');
  const input = await parseBody(req);
  const message = cleanText(input.message, 5000);
  const internal = input.internal === true;
  if (message.length < 2) return fail(res, 422, 'VALIDATION_ERROR', 'Digite uma mensagem.');
  if (!internal && ticket.status === 'fechado') return fail(res, 409, 'TICKET_CLOSED', 'Reabra o chamado antes de responder ao cliente.');
  const now = new Date();
  const inserted = await session.db.collection('ticket_messages').insertOne({ ticketId: id, organizationId: ticket.organizationId, authorId: session.user._id, authorType: 'admin', authorName: session.user.name, message, internal, createdAt: now });
  const ticketUpdate = { updatedAt: now, lastMessageAt: now };
  if (!internal && !['resolvido', 'fechado'].includes(ticket.status)) ticketUpdate.status = 'aguardando_cliente';
  await session.db.collection('tickets').updateOne({ _id: id }, { $set: ticketUpdate });
  await audit(session.db, { organizationId: ticket.organizationId, userId: session.user._id, action: internal ? 'ticket.note.internal' : 'ticket.message.admin', entityType: 'ticket', entityId: id, metadata: { ticketNumber: ticket.ticketNumber } });
  return ok(res, { message: { id: String(inserted.insertedId), authorType: 'admin', authorName: session.user.name, message, internal, createdAt: now } }, 201);
}
async function actionAdminClients(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const search = cleanText(req.query.search || '', 120);
    const page = Math.max(1, Math.min(Number(req.query.page || 1), 1000));
    const limit = 20;
    const filter = { code: { $ne: 'controlcenter-internal' }, $or: [{ kind: 'client' }, { kind: { $exists: false } }] };
    if (search) {
      const regex = escapeRegex(search);
      filter.$or = [{ name: { $regex: regex, $options: 'i' } }, { code: { $regex: regex, $options: 'i' } }];
    }
    const [orgs, total] = await Promise.all([
      session.db.collection('organizations').find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
      session.db.collection('organizations').countDocuments(filter)
    ]);
    const ids = orgs.map(o => o._id);
    const [userCounts, ticketCounts] = await Promise.all([
      ids.length ? session.db.collection('users').aggregate([{ $match: { organizationId: { $in: ids }, role: { $in: CLIENT_ROLES } } }, { $group: { _id: '$organizationId', total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }]).toArray() : [],
      ids.length ? session.db.collection('tickets').aggregate([{ $match: { organizationId: { $in: ids }, status: { $in: ['aberto', 'em_atendimento', 'aguardando_cliente'] } } }, { $group: { _id: '$organizationId', active: { $sum: 1 } } }]).toArray() : []
    ]);
    const userMap = new Map(userCounts.map(x => [String(x._id), x]));
    const ticketMap = new Map(ticketCounts.map(x => [String(x._id), x.active]));
    return ok(res, {
      clients: orgs.map(o => ({
        id: String(o._id), name: o.name, code: o.code, supportTier: o.supportTier || '', active: o.active !== false,
        users: userMap.get(String(o._id))?.total || 0, activeUsers: userMap.get(String(o._id))?.active || 0,
        activeTickets: ticketMap.get(String(o._id)) || 0, createdAt: o.createdAt
      })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    });
  }
  if (req.method === 'POST') {
    if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
    const input = await parseBody(req);
    const companyName = cleanText(input.companyName, 160);
    const supportTier = cleanText(input.supportTier, 80);
    const userName = cleanText(input.userName, 120);
    const email = normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';
    if (companyName.length < 2 || userName.length < 2 || !validEmail(email) || !validNewPassword(password)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'Informe empresa, usuário, e-mail válido e uma senha com pelo menos 10 caracteres, letras e números.');
    }
    const exists = await session.db.collection('users').findOne({ email, role: { $in: CLIENT_ROLES } });
    if (exists) return fail(res, 409, 'EMAIL_ALREADY_USED', 'Este e-mail já possui acesso de cliente.');
    const now = new Date();
    const code = await uniqueOrganizationCode(session.db, input.code, companyName);
    const orgResult = await session.db.collection('organizations').insertOne({ name: companyName, code, kind: 'client', supportTier, active: true, createdAt: now, updatedAt: now });
    const userResult = await session.db.collection('users').insertOne({ organizationId: orgResult.insertedId, name: userName, email, phone: '', passwordHash: await bcrypt.hash(password, 12), role: 'client', active: true, forcePasswordChange: false, sessionVersion: 1, createdAt: now, updatedAt: now });
    await audit(session.db, { organizationId: orgResult.insertedId, userId: session.user._id, action: 'organization.created', entityType: 'organization', entityId: orgResult.insertedId, metadata: { email } });
    return ok(res, { client: { id: String(orgResult.insertedId), name: companyName, code, supportTier, active: true }, userId: String(userResult.insertedId) }, 201);
  }
  if (req.method === 'PATCH') {
    if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
    const id = objectId(req.query.id);
    if (!id) return fail(res, 400, 'INVALID_CLIENT', 'Cliente inválido.');
    const input = await parseBody(req);
    if (typeof input.active !== 'boolean') return fail(res, 422, 'VALIDATION_ERROR', 'Informe o status do cliente.');
    const result = await session.db.collection('organizations').findOneAndUpdate({ _id: id, code: { $ne: 'controlcenter-internal' } }, { $set: { active: input.active, updatedAt: new Date() } }, { returnDocument: 'after' });
    const client = result?.value || result;
    if (!client) return fail(res, 404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.');
    await audit(session.db, { organizationId: id, userId: session.user._id, action: input.active ? 'organization.activated' : 'organization.deactivated', entityType: 'organization', entityId: id });
    return ok(res, { client: { id: String(client._id), name: client.name, active: client.active !== false } });
  }
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
}
async function actionAdminUsers(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method === 'GET') {
    const organizationId = objectId(req.query.organizationId);
    if (!organizationId) return fail(res, 400, 'INVALID_CLIENT', 'Cliente inválido.');
    const organization = await session.db.collection('organizations').findOne({ _id: organizationId, code: { $ne: 'controlcenter-internal' } });
    if (!organization) return fail(res, 404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.');
    const users = await session.db.collection('users').find({ organizationId, role: { $in: CLIENT_ROLES } }).project({ passwordHash: 0 }).sort({ name: 1 }).toArray();
    return ok(res, { organization: { id: String(organization._id), name: organization.name, active: organization.active !== false }, users: users.map(u => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || '', active: u.active !== false, forcePasswordChange: u.forcePasswordChange === true, lastLoginAt: u.lastLoginAt || null })) });
  }
  if (req.method === 'POST') {
    if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
    const input = await parseBody(req);
    const organizationId = objectId(input.organizationId);
    const name = cleanText(input.name, 120);
    const email = normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';
    const organization = organizationId ? await session.db.collection('organizations').findOne({ _id: organizationId, code: { $ne: 'controlcenter-internal' } }) : null;
    if (!organization || name.length < 2 || !validEmail(email) || !validNewPassword(password)) return fail(res, 422, 'VALIDATION_ERROR', 'Dados do usuário inválidos.');
    if (await session.db.collection('users').findOne({ email, role: { $in: CLIENT_ROLES } })) return fail(res, 409, 'EMAIL_ALREADY_USED', 'Este e-mail já possui acesso de cliente.');
    const now = new Date();
    const result = await session.db.collection('users').insertOne({ organizationId, name, email, phone: cleanText(input.phone, 40), passwordHash: await bcrypt.hash(password, 12), role: 'client', active: true, forcePasswordChange: false, sessionVersion: 1, createdAt: now, updatedAt: now });
    await audit(session.db, { organizationId, userId: session.user._id, action: 'client_user.created', entityType: 'user', entityId: result.insertedId, metadata: { email } });
    return ok(res, { userId: String(result.insertedId) }, 201);
  }
  if (req.method === 'PATCH') {
    if (!assertSameOrigin(req)) return fail(res, 403, 'INVALID_ORIGIN', 'Origem não permitida.');
    const id = objectId(req.query.id);
    if (!id) return fail(res, 400, 'INVALID_USER', 'Usuário inválido.');
    const user = await session.db.collection('users').findOne({ _id: id, role: { $in: CLIENT_ROLES } });
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    const input = await parseBody(req);
    const set = { updatedAt: new Date() };
    let incSession = false;
    if (typeof input.active === 'boolean') { set.active = input.active; if (!input.active) incSession = true; }
    if (typeof input.forcePasswordChange === 'boolean') set.forcePasswordChange = input.forcePasswordChange;
    if (input.newPassword !== undefined) {
      if (!validNewPassword(input.newPassword)) return fail(res, 422, 'WEAK_PASSWORD', 'A senha temporária deve ter pelo menos 10 caracteres, com letras e números.');
      set.passwordHash = await bcrypt.hash(input.newPassword, 12);
      set.forcePasswordChange = false;
      incSession = true;
    }
    if (Object.keys(set).length === 1) return fail(res, 422, 'NO_CHANGES', 'Nenhuma alteração foi informada.');
    const update = { $set: set };
    if (incSession) update.$inc = { sessionVersion: 1 };
    await session.db.collection('users').updateOne({ _id: id }, update);
    await audit(session.db, { organizationId: user.organizationId, userId: session.user._id, action: 'client_user.updated', entityType: 'user', entityId: id });
    return ok(res);
  }
  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
}
async function actionAdminTeam(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
  const session = await requireAdmin(req, res);
  if (!session) return;
  const users = await session.db.collection('users').find({ role: { $in: ADMIN_ROLES } }).project({ passwordHash: 0 }).sort({ name: 1 }).toArray();
  return ok(res, { team: users.map(u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, active: u.active !== false, forcePasswordChange: u.forcePasswordChange === true, lastLoginAt: u.lastLoginAt || null })) });
}
async function actionHealth(req, res) {
  const database = await db();
  await database.command({ ping: 1 });
  return ok(res, { service: 'controlcenter-portal', database: 'connected', timestamp: new Date().toISOString() });
}

module.exports = async function handler(req, res) {
  const action = cleanText(req.query.action || '', 50).toLowerCase();
  try {
    const routes = {
      login: actionLogin,
      me: actionMe,
      logout: actionLogout,
      dashboard: actionDashboard,
      tickets: actionTickets,
      ticket: actionTicket,
      message: actionMessage,
      profile: actionProfile,
      password: actionPassword,
      'admin-login': actionAdminLogin,
      'admin-me': actionAdminMe,
      'admin-logout': actionAdminLogout,
      'admin-password': actionAdminPassword,
      'admin-dashboard': actionAdminDashboard,
      'admin-tickets': actionAdminTickets,
      'admin-ticket': actionAdminTicket,
      'admin-message': actionAdminMessage,
      'admin-clients': actionAdminClients,
      'admin-users': actionAdminUsers,
      'admin-team': actionAdminTeam,
      health: actionHealth
    };
    if (!routes[action]) return fail(res, 404, 'NOT_FOUND', 'Rota do portal não encontrada.');
    return await routes[action](req, res);
  } catch (error) {
    console.error('PORTAL_API_ERROR', action, error);
    if (error.code === 'MONGODB_URI_NOT_CONFIGURED' || error.code === 'JWT_SECRET_NOT_CONFIGURED') return fail(res, 503, 'PORTAL_NOT_CONFIGURED', 'O portal ainda não foi configurado no ambiente de hospedagem.');
    if (error.code === 11000) return fail(res, 409, 'DUPLICATE_DATA', 'Já existe um cadastro com estes dados.');
    return fail(res, 500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação agora.');
  }
};
