# Portal do Cliente — ControlCenter

Portal B2B de chamados em **Node.js + MongoDB**, preparado para deploy na **Vercel**.

## Portal do Cliente

- `workspace/client/loginClient.html` — acesso por **e-mail + senha**.
- `workspace/client/dashboard.html` — visão geral dos chamados.
- `workspace/client/tickets.html` — lista, busca e filtros.
- `workspace/client/newTicket.html` — abertura de chamado.
- `workspace/client/ticket.html` — acompanhamento e conversa do chamado.
- `workspace/client/profile.html` — dados do usuário e troca de senha.
- `api/portal.js` — API serverless Node.js para autenticação, dashboards, chamados, mensagens, clientes e operação interna.

O cliente não precisa mais informar código da empresa. O backend encontra o usuário pelo e-mail e carrega a organização vinculada ao cadastro. Para evitar ambiguidade, cada e-mail de usuário cliente deve ser único no portal.

## Banco de dados

O portal usa as coleções:

- `organizations`
- `users`
- `tickets`
- `ticket_messages`
- `audit_logs`
- `auth_attempts`
- `counters`
- `system_seeds`

Os chamados continuam isolados por `organizationId` no backend. Usuários clientes nunca consultam dados de outra empresa.

## Ambiente administrativo

Existe um workspace administrativo separado para a equipe ControlCenter. Ele **não possui link na landing page, navbar, footer, Portal do Cliente nem alias público na Vercel**. A proteção real é feita por autenticação, sessão administrativa separada e validação de `role` no backend; ocultar o caminho não é tratado como mecanismo de segurança.

O ambiente interno permite acompanhar a fila completa, atribuir responsáveis, alterar status e prioridade, responder clientes, registrar notas internas, cadastrar empresas e gerenciar acessos.

## Configuração na Vercel

1. Crie um cluster no MongoDB Atlas.
2. Importe este repositório na Vercel.
3. Em **Settings > Environment Variables**, cadastre:
   - `MONGODB_URI`
   - `MONGODB_DB=controlcenter_portal`
   - `JWT_SECRET` com uma chave aleatória longa (mínimo recomendado: 32 caracteres)
   - `SESSION_COOKIE=cc_client_session` (opcional)
   - `ADMIN_SESSION_COOKIE=cc_admin_session` (opcional)
   - `SESSION_HOURS=8` (opcional)
4. Faça o deploy.
5. Teste `/api/portal?action=health`.

## Seed inicial no desenvolvimento

Ao executar:

```bash
npm run dev
```

o npm executa primeiro `scripts/seed-dev-users.js`. Esse seed cria os acessos iniciais solicitados e registra `initial-access-users-v1` em `system_seeds`. Depois de concluído com sucesso, ele **não recria nem redefine esses usuários em execuções futuras**.

As senhas iniciais não ficam em texto puro no repositório: o seed armazena apenas hashes bcrypt previamente gerados.

O primeiro administrador marcado com senha temporária recebe `forcePasswordChange=true` e não consegue acessar as áreas administrativas antes de redefinir a senha.

## Criar clientes adicionais

O painel administrativo permite criar empresas e usuários. O script legado também continua disponível:

```bash
npm run create-client -- \
  --company-code empresa \
  --company-name "Empresa Exemplo" \
  --name "Nome do usuário" \
  --email usuario@empresa.com.br \
  --password "SenhaSegura123"
```

Depois o usuário entra em `workspace/client/loginClient.html` apenas com e-mail e senha.

## Segurança implementada

- senhas com bcrypt;
- sessão de cliente e sessão administrativa em cookies `HttpOnly` separados;
- `SameSite=Lax` e `Secure` em produção;
- isolamento de chamados por organização;
- autorização administrativa por `role` no backend;
- bloqueio temporário após tentativas repetidas de login;
- verificação de origem em operações de escrita;
- logs de auditoria;
- invalidação das sessões após troca de senha;
- troca de senha obrigatória para acessos temporários;
- headers de segurança configurados no `vercel.json`;
- nenhuma credencial fica armazenada no frontend.

## Anexos

Uploads de arquivos não são gravados diretamente no filesystem porque funções serverless da Vercel não possuem armazenamento persistente. Para anexos, use **Vercel Blob, Amazon S3 ou serviço equivalente**, registrando no MongoDB apenas os metadados e URLs.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Antes de publicar, rode:

```bash
npm run check
```
