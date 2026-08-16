'use strict';

require('dotenv').config();
const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'controlcenter_portal';
const SEED_ID = 'initial-access-users-v1';

const HASHES = {
  gledson: '$2a$12$43Sm0UQmY5VCKdqWeb6j/uZBniKsz6M9eG2n.FsAjDK9MKhZsVH5u',
  arthur: '$2a$12$4VZoTYyB8Cm4dHbRl4brb.xDwetxp6faczzABkCuMPCFGoawGvW1W',
  teste: '$2a$12$Kpf5yK..gBqGb7Y2QSEbmu2h9OKzdQ86ec4XCt.o3wWBr2bqGU51G'
};

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('\n[seed] MONGODB_URI não configurado. Crie o .env antes de executar npm run dev.\n');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(DB_NAME);
  const seeds = db.collection('system_seeds');

  const done = await seeds.findOne({ _id: SEED_ID });
  if (done) {
    console.log(`[seed] ${SEED_ID} já foi aplicado em ${done.appliedAt?.toISOString?.() || done.appliedAt}. Nenhum usuário foi recriado.`);
    await client.close();
    return;
  }

  const now = new Date();
  const organizations = db.collection('organizations');
  const users = db.collection('users');

  const internal = await organizations.findOneAndUpdate(
    { code: 'controlcenter-internal' },
    {
      $setOnInsert: {
        name: 'ControlCenter',
        code: 'controlcenter-internal',
        kind: 'internal',
        supportTier: 'Equipe interna',
        active: true,
        createdAt: now
      },
      $set: { updatedAt: now }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const testOrg = await organizations.findOneAndUpdate(
    { code: 'cliente-teste' },
    {
      $setOnInsert: {
        name: 'Cliente Teste',
        code: 'cliente-teste',
        kind: 'client',
        supportTier: 'Ambiente de testes',
        active: true,
        createdAt: now
      },
      $set: { updatedAt: now }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const internalOrg = internal?.value || internal;
  const clientOrg = testOrg?.value || testOrg;

  if (!internalOrg?._id || !clientOrg?._id) throw new Error('Não foi possível criar as organizações iniciais.');

  const accounts = [
    {
      organizationId: internalOrg._id,
      name: 'Gledson',
      email: 'gledson@controlcentertech.com.br',
      role: 'admin',
      passwordHash: HASHES.gledson,
      forcePasswordChange: true
    },
    {
      organizationId: internalOrg._id,
      name: 'Arthur',
      email: 'arthur@thynkxp.com.br',
      role: 'admin',
      passwordHash: HASHES.arthur,
      forcePasswordChange: false
    },
    {
      organizationId: clientOrg._id,
      name: 'Usuário Teste',
      email: 'teste@gmail.com',
      role: 'client',
      passwordHash: HASHES.teste,
      forcePasswordChange: false
    }
  ];

  for (const account of accounts) {
    await users.updateOne(
      { email: account.email, role: account.role },
      {
        $setOnInsert: {
          organizationId: account.organizationId,
          name: account.name,
          email: account.email,
          role: account.role,
          passwordHash: account.passwordHash,
          phone: '',
          active: true,
          forcePasswordChange: account.forcePasswordChange,
          sessionVersion: 1,
          createdAt: now
        },
        $set: {
          organizationId: account.organizationId,
          active: true,
          forcePasswordChange: account.forcePasswordChange,
          updatedAt: now
        }
      },
      { upsert: true }
    );
  }

  await seeds.insertOne({ _id: SEED_ID, appliedAt: now, accounts: accounts.map(a => a.email) });

  console.log('[seed] Acessos iniciais criados com sucesso. Este seed não será executado novamente neste banco.');
  console.log('[seed] Admins: gledson@controlcentertech.com.br, arthur@thynkxp.com.br');
  console.log('[seed] Cliente: teste@gmail.com');

  await client.close();
}

main().catch(error => {
  console.error('[seed] Falha ao preparar usuários iniciais:', error.message);
  process.exit(1);
});
