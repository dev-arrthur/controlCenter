'use strict';

require('dotenv/config');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
}
function required(name) {
  const value = arg(name);
  if (!value) throw new Error(`Informe --${name}`);
  return value.trim();
}

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'controlcenter_portal';
  if (!uri) throw new Error('Configure MONGODB_URI antes de executar.');

  const companyCode = required('company-code').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const companyName = required('company-name');
  const name = required('name');
  const email = required('email').toLowerCase();
  const password = required('password');
  const phone = arg('phone').trim();

  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('A senha deve ter pelo menos 10 caracteres, com letras e números.');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  const emailOwner = await db.collection('users').findOne({ email, role: { $in: ['client', 'client_admin'] } });
  if (emailOwner) throw new Error('Este e-mail já possui um acesso de cliente. O login agora usa apenas e-mail e senha, portanto o e-mail precisa ser único.');

  const orgResult = await db.collection('organizations').findOneAndUpdate(
    { code: companyCode },
    {
      $set: { name: companyName, kind: 'client', active: true, updatedAt: now },
      $setOnInsert: { code: companyCode, supportTier: '', createdAt: now }
    },
    { upsert: true, returnDocument: 'after' }
  );
  const organization = orgResult?.value || orgResult;
  const passwordHash = await bcrypt.hash(password, 12);

  await db.collection('users').insertOne({
    organizationId: organization._id,
    name,
    phone,
    email,
    passwordHash,
    role: 'client',
    active: true,
    forcePasswordChange: false,
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now
  });

  console.log('\nCliente criado com sucesso.');
  console.log(`Empresa: ${companyName}`);
  console.log(`Usuário: ${email}`);
  console.log('O usuário entra em workspace/client/loginClient.html apenas com e-mail e senha.\n');
  await client.close();
})().catch(error => {
  console.error(`\nErro: ${error.message}\n`);
  process.exit(1);
});
