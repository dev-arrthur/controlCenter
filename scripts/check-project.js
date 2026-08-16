'use strict';

const fs = require('fs');
const path = require('path');

const required = [
  'workspace/client/loginClient.html',
  'workspace/client/dashboard.html',
  'workspace/client/tickets.html',
  'workspace/client/newTicket.html',
  'workspace/client/ticket.html',
  'workspace/client/profile.html',
  'workspace/client/assets/css/portal.css',
  'workspace/client/assets/js/api.js',
  'workspace/client/assets/js/portal.js',
  'workspace/admin/loginAdmin.html',
  'workspace/admin/changePasswordAdmin.html',
  'workspace/admin/dashboardAdmin.html',
  'workspace/admin/ticketsAdmin.html',
  'workspace/admin/ticketAdmin.html',
  'workspace/admin/clientsAdmin.html',
  'workspace/admin/teamAdmin.html',
  'workspace/admin/assets/css/admin.css',
  'workspace/admin/assets/js/apiAdmin.js',
  'workspace/admin/assets/js/admin.js',
  'workspace/admin/assets/js/teamAccess.js',
  'workspace/admin/assets/js/ticketTransfer.js',
  'workspace/shared/ticketEnterprise.js',
  'workspace/shared/portalEnterprise.css',
  'scripts/seed-dev-users.js',
  'scripts/create-client.js',
  'api/portal.js',
  'api/gateway.js',
  'api/_portal-security.js',
  'api/admin-enterprise.js',
  'api/attachment.js',
  'api/socket.js',
  'vercel.json',
  'package.json'
];

let failed = false;
for (const file of required) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${file}`);
    failed = true;
  }
}

for (const file of required.filter(file => file.endsWith('.js'))) {
  try { new Function(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')); }
  catch (error) { console.error(`INVALID JS: ${file}: ${error.message}`); failed = true; }
}

try {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  if (packageJson.scripts?.predev !== 'node scripts/seed-dev-users.js') {
    console.error('INVALID: npm run dev must execute the one-time access seed through predev.');
    failed = true;
  }
  for (const dependency of ['@vercel/blob', 'socket.io', 'bcryptjs', 'jsonwebtoken', 'mongodb']) {
    if (!packageJson.dependencies?.[dependency]) {
      console.error(`INVALID: dependency ${dependency} is required.`);
      failed = true;
    }
  }

  const vercel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'));
  const exposedAdmin = (vercel.rewrites || []).some(rule => String(rule.destination || '').includes('/workspace/admin/'));
  if (exposedAdmin) {
    console.error('INVALID: admin workspace must not have a public rewrite/alias.');
    failed = true;
  }
  const gateway = (vercel.rewrites || []).find(rule => rule.source === '/api/portal');
  if (gateway?.destination !== '/api/gateway') {
    console.error('INVALID: /api/portal must pass through the persistent rate-limit gateway.');
    failed = true;
  }
  if (!vercel.functions?.['api/socket.js'] || !vercel.functions?.['api/attachment.js']) {
    console.error('INVALID: realtime and attachment functions must be declared in vercel.json.');
    failed = true;
  }
} catch (error) {
  console.error(`INVALID JSON: ${error.message}`);
  failed = true;
}

const clientLogin = fs.readFileSync(path.resolve(process.cwd(), 'workspace/client/loginClient.html'), 'utf8');
if (/Código da empresa/i.test(clientLogin)) {
  console.error('INVALID: client login still asks for company code.');
  failed = true;
}

const portalBackend = fs.readFileSync(path.resolve(process.cwd(), 'api/portal.js'), 'utf8');
if (/passwordHash\s*:\s*[^a]/.test(portalBackend) && /passwordHash\s*=\s*[^a]/.test(portalBackend)) {
  console.warn('CHECK: review password hash assignments manually.');
}
const attachmentBackend = fs.readFileSync(path.resolve(process.cwd(), 'api/attachment.js'), 'utf8');
if (!attachmentBackend.includes("access: 'private'") || !attachmentBackend.includes("createHash('sha256')")) {
  console.error('INVALID: attachments must use private storage and SHA-256 integrity.');
  failed = true;
}
const enterpriseBackend = fs.readFileSync(path.resolve(process.cwd(), 'api/admin-enterprise.js'), 'utf8');
if (!enterpriseBackend.includes('bcrypt.hash') || !enterpriseBackend.includes('forcePasswordChange:true')) {
  console.error('INVALID: team access creation must hash passwords and force first-login reset.');
  failed = true;
}
const gatewayBackend = fs.readFileSync(path.resolve(process.cwd(), 'api/gateway.js'), 'utf8');
if (!gatewayBackend.includes('enforceRateLimit') || !gatewayBackend.includes("'RATE_LIMITED'")) {
  console.error('INVALID: persistent request rate limiting is required.');
  failed = true;
}

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (/\.(html|js|css|md|json)$/.test(entry.name)) list.push(full);
  }
  return list;
}
const publicFiles = [path.resolve(process.cwd(), 'index.html'), ...walk(path.resolve(process.cwd(), 'pages')), ...walk(path.resolve(process.cwd(), 'workspace/client'))];
for (const file of publicFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/workspace\/admin|loginAdmin\.html|dashboardAdmin\.html/.test(text)) {
    console.error(`ADMIN ROUTE EXPOSED: ${path.relative(process.cwd(), file)}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Project check passed (${required.length} required files, admin route not exposed, enterprise controls enabled).`);
