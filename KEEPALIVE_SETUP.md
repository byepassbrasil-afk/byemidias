# Keepalive Setup - Prevent Supabase Hibernation

## O que é?
Supabase free tier hibernates o banco após 7 dias sem atividade.
Este keepalive mantém o banco ativo fazendo queries periódicas.

## Opção 1: Vercel Cron (recomendado)
Adicione ao `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/keepalive",
      "schedule": "0 0 */3 * *"
    }
  ]
}
```

## Opção 2: Cron externo gratuito
Acesse https://cron-job.org e crie uma conta grátis.

### Configuração:
1. Crie uma nova conta
2. Adicione um novo cron job:
   - **URL**: `https://seu-app.vercel.app/api/keepalive`
   - **Schedule**: A cada 3 dias (ou `0 */3 * * *`)
   - **Method**: GET
3. Ative o cron

## Opção 3: Supabase Edge Function
```bash
cd packages/supabase
supabase functions deploy keepalive
supabase functions schedule keepalive --cron "0 */3 * * *"
```

## Verificar se está funcionando
Acesse: `https://seu-app.vercel.app/api/keepalive`

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-08-17T12:00:00.000Z",
  "device_count": 5,
  "response_ms": 45
}
```

## Monitoramento
Consulte os logs de keepalive no banco:
```sql
SELECT * FROM keepalive_log ORDER BY checked_at DESC LIMIT 10;
```
