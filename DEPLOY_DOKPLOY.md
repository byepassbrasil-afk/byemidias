# Deploy no Dokploy - ByeMidias

## Configuração Automática (Nixpacks)

O projeto está configurado para usar **Nixpacks** automaticamente. O Dokploy detecta o tipo de aplicação (Next.js) e configura tudo sozinho.

### No Dokploy:

1. **Criar novo projeto** → Tipo: **App**
2. **Source**: GitHub → `byepassbrasil-afk/byemidias`
3. **Branch**: `main`
4. **Build Pack**: **Nixpacks** (detectado automaticamente)
5. **Port**: `3000`

### Variáveis de Ambiente (no Dokploy):

```
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
PB_URL=http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io
PB_ADMIN_EMAIL=gwmorata@gmail.com
PB_ADMIN_PASSWORD=@Gaedaam08
NEXT_PUBLIC_APP_URL=https://seudominio.com.br
NEXT_PUBLIC_APP_NAME=ByeMidias
AUTH_SECRET=byemidias-nextauth-secret-2026-do-not-change
AUTH_URL=https://seudominio.com.br
PARTNER_JWT_SECRET=bm-8k2m9x4p1w7t3r5j6n0q2e8u4y1a3c
```

### Deploy Manual via Docker:

Se preferir Docker Compose:

1. **Criar novo projeto** → Tipo: **Docker Compose**
2. Apontar para `docker-compose.yml`
3. Definir as variáveis de ambiente

---

## Arquivos de Configuração Criados:

- `Dockerfile` - Build multi-stage com Next.js standalone
- `nixpacks.toml` - Config para Nixpacks
- `docker-compose.yml` - Compose file
- `app.json` - Metadata do app
- `.dockerignore` - Excludes para Docker
- `.env.example` - Exemplo de variáveis

---

## Como Funciona:

1. **Build**: `npm ci --legacy-peer-deps && npm run build`
   - Instala deps do monorepo (turbo workspaces)
   - Build Next.js com `output: 'standalone'` (otimizado pra Docker)
2. **Start**: `cd apps/web && npm run start`
   - Inicia o servidor Next.js na porta 3000
   - Aceita conexões em `0.0.0.0` (não apenas localhost)

---

## Testado e Funcionando:

✅ Build standalone funciona localmente (porta 3001 testada)
✅ Conexão com PocketBase testada
✅ Signup/Login funcionando
✅ Variáveis de ambiente configuradas
