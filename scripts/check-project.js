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
  'scripts/seed-dev-users.js',
  'scripts/create-client.js',
  'api/portal.js',
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
  const vercel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'));
  const exposedAdmin = (vercel.rewrites || []).some(rule => String(rule.destination || '').includes('/workspace/admin/'));
  if (exposedAdmin) {
    console.error('INVALID: admin workspace must not have a public rewrite/alias.');
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
console.log(`Project check passed (${required.length} required files, admin route not exposed).`);
