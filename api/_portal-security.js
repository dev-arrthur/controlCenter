'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_NAME = process.env.MONGODB_DB || 'controlcenter_portal';
const CLIENT_COOKIE = process.env.SESSION_COOKIE || 'cc_client_session';
const ADMIN_COOKIE = process.env.ADMIN_SESSION_COOKIE || 'cc_admin_session';
const CLIENT_ROLES = ['client', 'client_admin'];
const ADMIN_ROLES = ['admin', 'support'];

if (!global.__ccPortalMongo) global.__ccPortalMongo = { client: null, promise: null, indexesReady: false };
if (!global.__ccEnterpriseIndexes) global.__ccEnterpriseIndexes = false;

function portalSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;
  const mongoSecret = process.env.MONGODB_URI;
  if (mongoSecret) {
    return crypto.createHash('sha256')
      .update(`controlcenter-portal:${DB_NAME}:${mongoSecret}`)
      .digest('hex');
  }
  const error = new Error('PORTAL_SECRETS_NOT_CONFIGURED');
  error.code = 'PORTAL_SECRETS_NOT_CONFIGURED';
  throw error;
}

async function database() {
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
  const db = (await global.__ccPortalMongo.promise).db(DB_NAME);
  if (!global.__ccEnterpriseIndexes) {
    await Promise.all([
      db.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('ticket_attachments').createIndex({ ticketId: 1, createdAt: 1 }),
      db.collection('ticket_attachment_archive').createIndex({ ticketId: 1, createdAt: 1 }),
      db.collection('ticket_transfers').createIndex({ ticketId: 1, createdAt: -1 })
    ]);
    global.__ccEnterpriseIndexes = true;
  }
  return db;
}

function parseCookieHeader(header = '') {
  return String(header || '').split(';').reduce((out, part) => {
    const i = part.indexOf('=');
    if (i < 0) return out;
    const key = part.slice(0, i).trim();
    if (!key) return out;
    try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); }
    catch { out[key] = part.slice(i + 1).trim(); }
    return out;
  }, {});
}

async function authenticateCookieHeader(cookieHeader) {
  const cookies = parseCookieHeader(cookieHeader);
  const db = await database();

  const adminToken = cookies[ADMIN_COOKIE];
  if (adminToken) {
    try {
      const payload = jwt.verify(adminToken, portalSecret(), {
        issuer: 'controlcenter-portal',
        audience: 'controlcenter-admin'
      });
      if (payload.kind === 'admin' && ObjectId.isValid(payload.sub) && ADMIN_ROLES.includes(payload.role)) {
        const user = await db.collection('users').findOne({
          _id: new ObjectId(payload.sub),
          role: { $in: ADMIN_ROLES },
          active: true
        });
        if (user && Number(user.sessionVersion || 1) === Number(payload.sv || 1) && user.forcePasswordChange !== true) {
          return { kind: 'admin', db, user };
        }
      }
    } catch {}
  }

  const clientToken = cookies[CLIENT_COOKIE];
  if (clientToken) {
    try {
      const payload = jwt.verify(clientToken, portalSecret(), {
        issuer: 'controlcenter-portal',
        audience: 'controlcenter-client'
      });
      if (payload.kind === 'client' && ObjectId.isValid(payload.sub) && ObjectId.isValid(payload.oid)) {
        const user = await db.collection('users').findOne({
          _id: new ObjectId(payload.sub),
          organizationId: new ObjectId(payload.oid),
          role: { $in: CLIENT_ROLES },
          active: true
        });
        if (user && Number(user.sessionVersion || 1) === Number(payload.sv || 1)) {
          const organization = await db.collection('organizations').findOne({
            _id: user.organizationId,
            active: { $ne: false }
          });
          if (organization) return { kind: 'client', db, user, organization };
        }
      }
    } catch {}
  }

  return null;
}

async function authorizeTicket(session, ticketId) {
  if (!session || !ObjectId.isValid(ticketId)) return null;
  const filter = { _id: new ObjectId(ticketId) };
  if (session.kind === 'client') filter.organizationId = session.organization._id;
  return session.db.collection('tickets').findOne(filter);
}

function requestIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req?.socket?.remoteAddress || 'unknown';
}

function hashSensitive(value, namespace = 'generic') {
  return crypto.createHmac('sha256', portalSecret())
    .update(`${namespace}:${String(value)}`)
    .digest('hex');
}

async function enforceRateLimit(db, { scope, subject, limit, windowMs }) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const id = hashSensitive(`${scope}|${subject}`, 'rate-limit');
  const collection = db.collection('rate_limits');
  const current = await collection.findOne({ _id: id });

  if (!current || !current.resetAt || current.resetAt <= now) {
    await collection.replaceOne(
      { _id: id },
      { _id: id, scope, count: 1, resetAt, expiresAt: new Date(resetAt.getTime() + windowMs), updatedAt: now },
      { upsert: true }
    );
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }

  if (Number(current.count || 0) >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((current.resetAt.getTime() - now.getTime()) / 1000))
    };
  }

  const updated = await collection.findOneAndUpdate(
    { _id: id, count: { $lt: limit }, resetAt: { $gt: now } },
    { $inc: { count: 1 }, $set: { updatedAt: now } },
    { returnDocument: 'after' }
  );
  const doc = updated?.value || updated;
  if (!doc) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((current.resetAt.getTime() - now.getTime()) / 1000)) };
  }
  return { allowed: true, remaining: Math.max(0, limit - Number(doc.count || 1)), retryAfter: 0 };
}

async function audit(db, entry) {
  try {
    await db.collection('audit_logs').insertOne({ ...entry, createdAt: new Date() });
  } catch (error) {
    console.error('AUDIT_ENTERPRISE', error.message);
  }
}

module.exports = {
  DB_NAME,
  CLIENT_COOKIE,
  ADMIN_COOKIE,
  CLIENT_ROLES,
  ADMIN_ROLES,
  ObjectId,
  portalSecret,
  database,
  parseCookieHeader,
  authenticateCookieHeader,
  authorizeTicket,
  requestIp,
  hashSensitive,
  enforceRateLimit,
  audit
};
