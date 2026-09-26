# Deploy no Dokploy - ByeMidias

Monorepo Next.js (turbo workspaces). O Dokploy precisa rodar o build **na raiz do repositorio**.

## Por que Heroku Buildpacks nao funciona nesta VPS

```
image with reference heroku/heroku:24 was found but does not provide
the specified platform (linux/amd64)
```

A VPS e **ARM64** (aarch64). A imagem base `heroku/heroku:24` e publicada
apenas para `linux/amd64`, entao o buildpack sempre falha no export - antes
mesmo de rodar qualquer comando do projeto. Nao ha como corrigir pelo codigo.

Build types que funcionam em ARM64: **Nixpacks** e **Dockerfile**.

---

## Opcao A - Nixpacks (build type: Nixpacks)

1. Dokploy -> **Create -> Application**
2. **Source**: GitHub -> `byepassbrasil-afk/byemidias`
3. **Branch**: `main`
4. **Root Directory**: `/` (raiz do repo - obrigatorio, o app fica em `apps/web`)
5. **Build Type**: `Nixpacks`
6. **Port**: `3000`
7. **Health Check Path**: `/`
8. Variáveis de ambiente (aba Environment) - ver lista abaixo
9. **Deploy**

O `nixpacks.toml` da raiz ja esta pronto: instala com `--include=dev`
(sem isso o `NODE_ENV=production` remove typescript/tailwind e o build quebra),
cacheia `/root/.npm` e sobe com `next start -H 0.0.0.0 -p ${PORT}`.

## Opcao B - Dockerfile (build type: Dockerfile / Custom) - recomendado

Mais rapido e previsivel: build multi-stage com `output: 'standalone'`,
sem Next.js completo na imagem final.

1. Mesmos passos 1-3
2. **Build Type**: `Dockerfile`
3. **Dockerfile**: `/Dockerfile` (raiz)
4. **Docker Context**: `/` (raiz - o build precisa do monorepo inteiro)
5. **Port**: `3000`
6. Se o Dokploy pedir **Build Args**, copie as vars `NEXT_PUBLIC_*` da lista abaixo
   (elas sao inlinadas no build, nao existem em runtime)
7. **Deploy**

## Variaveis de ambiente

```
NODE_ENV=production
PORT=3000

# --- PocketBase ---
PB_URL=
PB_ADMIN_EMAIL=
PB_ADMIN_PASSWORD=

# --- Auth (runtime) ---
AUTH_SECRET=
AUTH_URL=https://seudominio.com.br
PARTNER_JWT_SECRET=

# --- Supabase ---
SUPABASE_SERVICE_ROLE_KEY=

# --- Public (INLINADAS NO BUILD - defina antes do build) ---
NEXT_PUBLIC_APP_URL=https://seudominio.com.br
NEXT_PUBLIC_APP_NAME=ByeMidias
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_*` sao substituidas em tempo de build. Se nao estiverem definidas
no Dokploy antes do build, o app sobe com `undefined` embutido no bundle e so
funciona depois de redeploy. Para build local com Dockerfile:

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://seudominio.com.br \
  --build-arg NEXT_PUBLIC_APP_NAME=ByeMidias \
  -t byemidias .
docker run -p 3000:3000 --env-file .env byemidias
```

## Health check

O app precisa responder HTTP na porta configurada. Docker usa
`http://127.0.0.1:3000/`; no Nixpacks/Heroku, `/`.

## Docker Compose (alternativa)

`docker-compose.yml` na raiz tambem funciona (Dokploy -> Create -> Compose),
apontando para o arquivo, com as mesmas variaveis acima.

## Arquivos de configuracao

| Arquivo | Papel |
| --- | --- |
| `nixpacks.toml` | build type Nixpacks (ARM64-safe) |
| `Dockerfile` | build type Dockerfile / Compose (multi-arch) |
| `.dockerignore` | corta contexto de build (player Android, .next, .gradle) |
| `docker-compose.yml` | deploy via Compose |
| `app.json` | metadata do app (provider nixpacks) |
| `.env.example` | lista de variaveis |

## Troubleshooting

**`no suitable export target found: heroku/heroku`** - build type ainda e
Heroku Buildpacks. Troque para Nixpacks ou Dockerfile.

**`Module not found: Can't resolve 'tailwindcss'` no build** - devDependencies
foram removidos. Confirme `--include=dev` no `npm ci` (esta no `nixpacks.toml`).

**Site sobe mas fica carregando / dados vazios** - `NEXT_PUBLIC_*` nao estavam
definidas no momento do build. Defina e redeploy.

**Porta errada** - Dokploy injeta `PORT`; o start usa `${PORT:-3000}` e faz
bind em `0.0.0.0`. No Docker, o `EXPOSE 3000` e o `ENV PORT` do Dockerfile
garantem o bind correto.
