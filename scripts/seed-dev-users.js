'use strict';

require('dotenv').config();
const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'controlcenter_portal';
const SEED_ID = 'initial-access-users-v2-client-login-repair';
const CLIENT_ROLES = ['client', 'client_admin'];

const HASHES = {
  gledson: '$2a$12$43Sm0UQmY5VCKdqWeb6j/uZBniKsz6M9eG2n.FsAjDK9MKhZsVH5u',
  arthur: '$2a$12$4VZoTYyB8Cm4dHbRl4brb.xDwetxp6faczzABkCuMPCFGoawGvW1W',
  teste: '$2a$12$Kpf5yK..gBqGb7Y2QSEbmu2h9OKzdQ86ec4XCt.o3wWBr2bqGU51G'
};

async function ensureAdmin(users, organizationId, account, now) {
  const existing = await users.findOne({ email: account.email, role: { $in: ['admin', 'support'] } });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      { $set: { organizationId, role: 'admin', active: true, updatedAt: now } }
    );
    return { created: false, id: existing._id };
  }

  const result = await users.insertOne({
    organizationId,
    name: account.name,
    email: account.email,
    role: 'admin',
    passwordHash: account.passwordHash,
    phone: '',
    active: true,
    forcePasswordChange: account.forcePasswordChange,
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now
  });
  return { created: true, id: result.insertedId };
}

async function ensureTestClient(users, organizationId, now) {
  const email = 'teste@gmail.com';
  const existing = await users
    .find({ email, role: { $in: CLIENT_ROLES } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  let target = existing.find(user => String(user.organizationId) === String(organizationId)) || existing[0] || null;

  if (!target) {
    const result = await users.insertOne({
      organizationId,
      name: 'Usuário Teste',
      email,
      role: 'client',
      passwordHash: HASHES.teste,
      phone: '',
      active: true,
      forcePasswordChange: false,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now
    });
    target = { _id: result.insertedId };
  } else {
    // Reparação v2: este acesso de teste deve ser CLIENT e usar a credencial inicial definida.
    // A atualização acontece uma única vez porque este script é protegido por system_seeds/SEED_ID.
    await users.updateOne(
      { _id: target._id },
      {
        $set: {
          organizationId,
          name: target.name || 'Usuário Teste',
          email,
          role: 'client',
          passwordHash: HASHES.teste,
          active: true,
          forcePasswordChange: false,
          updatedAt: now
        },
        $setOnInsert: { sessionVersion: 1, createdAt: now }
      },
      { upsert: false }
    );
  }

  // Se uma execução antiga tiver deixado o mesmo e-mail de teste em mais de uma empresa,
  // desativa apenas as cópias extras desse usuário de teste para evitar ACCOUNT_AMBIGUOUS.
  await users.updateMany(
    { _id: { $ne: target._id }, email, role: { $in: CLIENT_ROLES } },
    { $set: { active: false, updatedAt: now } }
  );

  return target._id;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('\n[seed] MONGODB_URI não configurado. Configure o .env/Vercel antes de iniciar o portal.\n');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(DB_NAME);
  const seeds = db.collection('system_seeds');

  const done = await seeds.findOne({ _id: SEED_ID });
  if (done) {
    console.log(`[seed] ${SEED_ID} já foi aplicado. Nenhuma credencial foi recriada ou redefinida.`);
    await client.close();
    return;
  }

  const now = new Date();
  const organizations = db.collection('organizations');
  const users = db.collection('users');

  const internalResult = await organizations.findOneAndUpdate(
    { code: 'controlcenter-internal' },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        name: 'ControlCenter',
        code: 'controlcenter-internal',
        kind: 'internal',
        supportTier: 'Equipe interna',
        active: true,
        updatedAt: now
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const testOrgResult = await organizations.findOneAndUpdate(
    { code: 'cliente-teste' },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        name: 'Cliente Teste',
        code: 'cliente-teste',
        kind: 'client',
        supportTier: 'Ambiente de testes',
        active: true,
        updatedAt: now
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const internalOrg = internalResult?.value || internalResult;
  const testOrg = testOrgResult?.value || testOrgResult;
  if (!internalOrg?._id || !testOrg?._id) throw new Error('Não foi possível preparar as organizações iniciais.');

  await ensureAdmin(users, internalOrg._id, {
    name: 'Gledson',
    email: 'gledson@controlcentertech.com.br',
    passwordHash: HASHES.gledson,
    forcePasswordChange: true
  }, now);

  await ensureAdmin(users, internalOrg._id, {
    name: 'Arthur',
    email: 'arthur@thynkxp.com.br',
    passwordHash: HASHES.arthur,
    forcePasswordChange: false
  }, now);

  await ensureTestClient(users, testOrg._id, now);

  await seeds.insertOne({
    _id: SEED_ID,
    appliedAt: now,
    purpose: 'Reparar o acesso inicial do cliente de teste e manter os admins existentes sem resetar suas senhas.',
    accounts: [
      'gledson@controlcentertech.com.br',
      'arthur@thynkxp.com.br',
      'teste@gmail.com'
    ]
  });

  console.log('[seed] Migração v2 aplicada com sucesso e marcada como concluída.');
  console.log('[seed] teste@gmail.com confirmado como role=client na organização Cliente Teste.');
  console.log('[seed] Nas próximas execuções este seed será ignorado e não redefinirá credenciais.');

  await client.close();
}

main().catch(error => {
  console.error('[seed] Falha ao preparar usuários iniciais:', error.message);
  process.exit(1);
});
