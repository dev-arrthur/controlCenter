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

for (const file of required.filter(f => f.endsWith('.js'))) {
  try {
    new Function(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  } catch (error) {
    console.error(`INVALID JS: ${file}: ${error.message}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Project check passed (${required.length} required files).`);
