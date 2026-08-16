# Portal do Cliente — ControlCenter

Portal B2B de chamados em **Node.js + MongoDB**, preparado para deploy na **Vercel**.

## Estrutura

- `workspace/client/loginClient.html` — acesso da Área do Cliente.
- `workspace/client/dashboard.html` — visão geral dos chamados.
- `workspace/client/tickets.html` — lista, busca e filtros.
- `workspace/client/newTicket.html` — abertura de chamado.
- `workspace/client/ticket.html` — acompanhamento e conversa do chamado.
- `workspace/client/profile.html` — dados do usuário e troca de senha.
- `api/portal.js` — API serverless Node.js para autenticação, dashboard, chamados, mensagens e perfil.

## Banco de dados

O portal usa as coleções:

- `organizations`
- `users`
- `tickets`
- `ticket_messages`
- `audit_logs`
- `auth_attempts`
- `counters`

O acesso é multiempresa. O login utiliza **código da empresa + e-mail + senha**, e todas as consultas de chamados são isoladas por `organizationId` no backend.

## Configuração na Vercel

1. Crie um cluster no MongoDB Atlas.
2. Importe este repositório na Vercel.
3. Em **Settings > Environment Variables**, cadastre:
   - `MONGODB_URI`
   - `MONGODB_DB=controlcenter_portal`
   - `JWT_SECRET` com uma chave aleatória longa (mínimo recomendado: 32 caracteres)
   - `SESSION_COOKIE=cc_client_session` (opcional)
   - `SESSION_HOURS=8` (opcional)
4. Faça o deploy.
5. Teste `/api/portal?action=health`.

## Criar o primeiro cliente

Copie `.env.example` para `.env`, configure o MongoDB e execute:

```bash
npm install
npm run create-client -- \
  --company-code maximum \
  --company-name "Maximum Assessoria Contábil" \
  --name "Nome do usuário" \
  --email usuario@empresa.com.br \
  --password "SenhaSegura123"
```

Depois o acesso ocorre em `workspace/client/loginClient.html` usando o código da empresa, o e-mail e a senha cadastrados.

## Segurança implementada

- senhas com bcrypt (cost 12);
- sessão JWT em cookie `HttpOnly`;
- `SameSite=Lax` e `Secure` em produção;
- isolamento por organização no backend;
- bloqueio temporário após tentativas repetidas de login;
- verificação de origem em operações de escrita;
- logs de auditoria;
- invalidação das sessões após troca de senha;
- headers de segurança configurados no `vercel.json`;
- nenhuma credencial fica armazenada no frontend.

## Anexos

Uploads de arquivos não foram gravados diretamente no filesystem porque funções serverless da Vercel não possuem armazenamento persistente. A próxima camada para anexos deve usar **Vercel Blob, Amazon S3 ou serviço equivalente**, registrando no MongoDB apenas os metadados e URLs dos arquivos.

## Desenvolvimento local

```bash
npm install
vercel dev
```

ou:

```bash
npm run dev
```

Antes de publicar, rode:

```bash
npm run check
```
