# ByeMidias — Digital Signage CMS / DOOH

Plataforma SaaS de gerenciamento de Digital Signage e DOOH para controle remoto de conteúdo em dispositivos Android.

## Arquitetura

```
apps/
  web/          → CMS Next.js (React + TypeScript + Tailwind)
  player/       → Player Android (Kotlin + Jetpack + Media3)

packages/
  shared/       → Tipos TypeScript compartilhados
  supabase/     → Migrations SQL + Edge Functions
```

## Tech Stack

| Componente | Tecnologia |
|---|---|
| CMS Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| API Layer | Next.js API Routes + Supabase Edge Functions |
| Player Android | Kotlin, Jetpack Compose, Media3/ExoPlayer, Room |
| Sync | WorkManager, version-based sync |
| State | Zustand (CMS), Room DB (Player) |

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute as migrations no SQL Editor:
   - `packages/supabase/migrations/001_initial_schema.sql`
   - `packages/supabase/migrations/002_rls_policies.sql`
   - `packages/supabase/migrations/003_seed_and_indexes.sql`
3. Crie um bucket `media` no Storage (público)
4. Copie `.env.example` para `.env.local` e preencha as credenciais

### 3. Rodar CMS

```bash
npm run dev --workspace=apps/web
```

Acesse: http://localhost:3000

### 4. Build do Player Android

```bash
cd apps/player
./gradlew assembleDebug
```

## Estrutura do Banco

### Tabelas Principais

| Tabela | Descrição |
|---|---|
| `organizations` | Empresas/organizações |
| `profiles` | Usuários (extende Supabase Auth) |
| `units` | Unidades/filiais |
| `device_groups` | Grupos de telas |
| `devices` | Dispositivos Android |
| `media` | Biblioteca de mídia |
| `playlists` | Sequências de conteúdo |
| `playlist_items` | Itens da playlist |
| `campaigns` | Campanhas agendadas |
| `campaign_targets` | Destinos das campanhas |
| `device_heartbeats` | Heartbeats dos dispositivos |
| `sync_logs` | Logs de sincronização |
| `device_commands` | Comandos remotos |
| `templates` | Templates de layout |
| `widgets` | Widgets dinâmicos |
| `audit_logs` | Logs de auditoria |

### Hierarquia

```
Plataforma
→ Parceiro White Label
  → Organização
    → Unidade
      → Grupo de Telas
        → Tela / Dispositivo
```

## Fluxo Principal

```
CMS → Campanha → Dispositivo → Download → Cache → Reprodução → Sync
```

## Funcionalidades MVP

- [x] Login/Signup (Supabase Auth)
- [x] Multi-tenancy com RLS
- [x] CRUD Organizações, Usuários, Unidades
- [x] CRUD Dispositivos com ativação
- [x] Upload de mídia (Supabase Storage)
- [x] CRUD Playlists
- [x] CRUD Campanhas com agendamento
- [x] Monitoramento online/offline
- [x] Player Android com cache offline
- [x] Sync baseado em versão
- [x] Heartbeat periódico
- [x] Modo kiosk
- [x] Auto-start no boot

## Funcionalidades Fase 2

- [ ] Editor visual de layouts
- [ ] Templates
- [ ] Widgets (clima, RSS, relógio)
- [ ] QR Code dinâmico
- [ ] Relatórios avançados
- [ ] Comandos remotos

## Funcionalidades Fase 3

- [ ] White Label completo
- [ ] DOOH / inventário publicitário
- [ ] Métricas de reprodução
- [ ] Marketplace
- [ ] Billing/assinaturas

## Comando de Ativação

O Player Android exibe um código de ativação ao iniciar. No CMS:

1. Adicionar dispositivo
2. Gerar código
3. Informar código no Player
4. Dispositivo é vinculado à organização

## Segurança

- RLS em todas as tabelas
- Isolamento por organização
- Tokens de dispositivo temporários
- URLs assinadas para arquivos
- Logs de auditoria
- Nenhuma chave secreta no frontend

## Licença

Proprietário — ByeMidias
