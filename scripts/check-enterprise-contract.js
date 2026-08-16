'use strict';

const fs = require('fs');

const read = file => fs.readFileSync(file, 'utf8');
const must = (condition, message) => {
  if (!condition) {
    console.error(`ENTERPRISE CONTRACT FAILED: ${message}`);
    process.exitCode = 1;
  }
};

const security = read('api/_portal-security.js');
const attachment = read('api/attachment.js');
const enterprise = read('api/admin-enterprise.js');
const gateway = read('api/gateway.js');
const portal = read('api/portal.js');
const clientJs = read('workspace/client/assets/js/portal.js');
const adminJs = read('workspace/admin/assets/js/admin.js');
const clientTicket = read('workspace/client/ticket.html');
const vercel = JSON.parse(read('vercel.json'));

must(security.includes("createHmac('sha256'"), 'rate-limit/sensitive identifiers must use HMAC-SHA256');
must(security.includes("collection('rate_limits')"), 'rate limiting must be persisted in MongoDB');
must(enterprise.includes('bcrypt.hash'), 'team passwords must be bcrypt hashed');
must(enterprise.includes('forcePasswordChange:true'), 'new team access must force password reset');
must(enterprise.includes('LAST_ADMIN'), 'last active admin must be protected');
must(attachment.includes("access: 'private'"), 'attachments must use private Blob storage');
must(attachment.includes("createHash('sha256'"), 'attachments must record SHA-256 integrity');
must(attachment.includes('MAX_FILE_BYTES = 3 * 1024 * 1024'), 'attachment size limit must be enforced');
must(attachment.includes('BLOB_READ_WRITE_TOKEN'), 'Blob read-write token must be supported explicitly');
must(attachment.includes('VERCEL_OIDC_TOKEN') && attachment.includes('BLOB_STORE_ID'), 'Blob OIDC fallback must be supported');
must(attachment.includes("action === 'health'"), 'attachment storage must expose a safe health check');
must(attachment.includes('cleanupOrphanBlob'), 'orphan blobs must be cleaned when metadata persistence fails');
must(attachment.includes("retention: 'permanent-ticket-record'"), 'attachment retention policy must be persisted');
must(attachment.includes("collection('ticket_attachments').insertOne"), 'active attachment metadata must be persisted in MongoDB');
must(attachment.includes("collection('ticket_attachment_archive')"), 'closed attachment metadata must be archived');
must(gateway.includes('enforceRateLimit'), 'portal gateway must enforce persistent rate limits');
must(gateway.includes('ticket_attachment_archive'), 'closed-ticket attachment metadata must be archived');
must(portal.includes('TRANSFER_ENDPOINT_REQUIRED'), 'direct assignment must be blocked in legacy admin ticket route');
must(portal.includes('password.length >= 8'), 'portal passwords must require at least 8 characters');
must(clientJs.includes('data-message-id'), 'client messages must expose internal message ids for authorized attachment decoration');
must(adminJs.includes('data-message-id'), 'admin messages must expose internal message ids for authorized attachment decoration');
must(adminJs.includes('CCAttachments.uploadFiles'), 'admin replies must support attachments');
must(clientJs.includes('CCAttachments.uploadFiles'), 'client replies must support attachments');
must(!clientTicket.includes('sha384-8A7DTQ'), 'invalid Socket.IO SRI must not remain');
must((vercel.rewrites || []).some(rule => rule.source === '/api/portal' && rule.destination === '/api/gateway'), 'existing portal route must pass through gateway');
must(!(vercel.rewrites || []).some(rule => String(rule.destination || '').includes('/workspace/admin/')), 'admin workspace must not be publicly aliased');

if (!process.exitCode) console.log('Enterprise security contract passed.');
