'use strict';

const http = require('node:http');
const { Server } = require('socket.io');
const {
  authenticateCookieHeader,
  authorizeTicket,
  database,
  enforceRateLimit,
  hashSensitive
} = require('./_portal-security');

if (!global.__ccSocketServer) {
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ ok: true, service: 'controlcenter-realtime' }));
  });

  const io = new Server(server, {
    path: '/api/socket',
    serveClient: false,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 64 * 1024,
    cors: { origin: false, credentials: true }
  });

  io.use(async (socket, next) => {
    try {
      const session = await authenticateCookieHeader(socket.handshake.headers.cookie || '');
      if (!session) return next(new Error('UNAUTHENTICATED'));
      const ip = String(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown').split(',')[0].trim();
      const limit = await enforceRateLimit(session.db, {
        scope: 'socket-connect',
        subject: `${session.kind}:${String(session.user._id)}:${ip}`,
        limit: 30,
        windowMs: 60 * 1000
      });
      if (!limit.allowed) return next(new Error('RATE_LIMITED'));
      socket.data.session = session;
      socket.data.userKey = hashSensitive(`${session.kind}:${String(session.user._id)}`, 'socket-user');
      return next();
    } catch (error) {
      console.error('SOCKET_AUTH_ERROR', error.message);
      return next(new Error('AUTH_ERROR'));
    }
  });

  io.on('connection', socket => {
    socket.on('join-ticket', async (ticketId, ack) => {
      try {
        const session = socket.data.session;
        const limit = await enforceRateLimit(session.db, {
          scope: 'socket-join-ticket',
          subject: socket.data.userKey,
          limit: 120,
          windowMs: 60 * 1000
        });
        if (!limit.allowed) return typeof ack === 'function' && ack({ ok: false, code: 'RATE_LIMITED' });
        const ticket = await authorizeTicket(session, ticketId);
        if (!ticket) return typeof ack === 'function' && ack({ ok: false, code: 'TICKET_NOT_FOUND' });
        const room = `ticket:${String(ticket._id)}:${session.kind}`;
        socket.join(room);
        socket.data.ticketId = String(ticket._id);
        return typeof ack === 'function' && ack({ ok: true, ticketId: String(ticket._id), realtime: true });
      } catch (error) {
        console.error('SOCKET_JOIN_ERROR', error.message);
        return typeof ack === 'function' && ack({ ok: false, code: 'JOIN_ERROR' });
      }
    });

    socket.on('leave-ticket', ticketId => {
      const session = socket.data.session;
      const id = String(ticketId || socket.data.ticketId || '');
      if (!id || !session) return;
      socket.leave(`ticket:${id}:${session.kind}`);
    });
  });

  global.__ccSocketServer = { server, io };
}

async function startChangeStreams() {
  if (global.__ccSocketWatchersStarting || global.__ccSocketWatchers) return;
  global.__ccSocketWatchersStarting = true;
  try {
    const db = await database();
    const io = global.__ccSocketServer.io;
    const watchers = [];

    const messageStream = db.collection('ticket_messages').watch([
      { $match: { operationType: 'insert' } }
    ], { fullDocument: 'updateLookup' });
    messageStream.on('change', change => {
      const doc = change.fullDocument;
      if (!doc?.ticketId) return;
      const id = String(doc.ticketId);
      const payload = {
        type: 'message',
        ticketId: id,
        messageId: String(doc._id),
        internal: doc.internal === true,
        at: doc.createdAt || new Date()
      };
      io.to(`ticket:${id}:admin`).emit('ticket:message', payload);
      if (doc.internal !== true) io.to(`ticket:${id}:client`).emit('ticket:message', payload);
    });
    messageStream.on('error', error => console.error('SOCKET_MESSAGE_STREAM_ERROR', error.message));
    watchers.push(messageStream);

    const ticketStream = db.collection('tickets').watch([
      { $match: { operationType: { $in: ['update', 'replace'] } } }
    ], { fullDocument: 'updateLookup' });
    ticketStream.on('change', change => {
      const doc = change.fullDocument;
      if (!doc?._id) return;
      const id = String(doc._id);
      const payload = { type: 'ticket', ticketId: id, status: doc.status, updatedAt: doc.updatedAt || new Date() };
      io.to(`ticket:${id}:admin`).emit('ticket:updated', payload);
      io.to(`ticket:${id}:client`).emit('ticket:updated', payload);
    });
    ticketStream.on('error', error => console.error('SOCKET_TICKET_STREAM_ERROR', error.message));
    watchers.push(ticketStream);

    const attachmentStream = db.collection('ticket_attachments').watch([
      { $match: { operationType: 'insert' } }
    ], { fullDocument: 'updateLookup' });
    attachmentStream.on('change', change => {
      const doc = change.fullDocument;
      if (!doc?.ticketId) return;
      const id = String(doc.ticketId);
      const payload = { type: 'attachment', ticketId: id, attachmentId: String(doc._id), internal: doc.internal === true, at: doc.createdAt || new Date() };
      io.to(`ticket:${id}:admin`).emit('ticket:attachment', payload);
      if (doc.internal !== true) io.to(`ticket:${id}:client`).emit('ticket:attachment', payload);
    });
    attachmentStream.on('error', error => console.error('SOCKET_ATTACHMENT_STREAM_ERROR', error.message));
    watchers.push(attachmentStream);

    global.__ccSocketWatchers = watchers;
  } catch (error) {
    console.error('SOCKET_CHANGE_STREAM_ERROR', error.message);
    global.__ccSocketWatchers = null;
  } finally {
    global.__ccSocketWatchersStarting = false;
  }
}

startChangeStreams();

module.exports = global.__ccSocketServer.server;
