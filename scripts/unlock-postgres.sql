-- ================================================
-- Script SQL para liberar PostgreSQL para conexões externas
-- Executar: psql -U postgres -d postgres -f unlock-postgres.sql
-- Ou colar linha por linha no terminal psql
-- ================================================

-- PASSO 1: Configurar listen_addresses para aceitar conexões de qualquer IP
ALTER SYSTEM SET listen_addresses = '*';

-- PASSO 2: Recarregar configuração (não reinicia, só recarrega)
SELECT pg_reload_conf();

-- PASSO 3: Mostrar configuração atual (para confirmar)
SHOW listen_addresses;

-- PASSO 4: Ver regras atuais do pg_hba.conf
SELECT * FROM pg_hba_file_rules;

-- ================================================
-- NOTA: Se o PASSO 1 der erro de permissão,
-- executar como superuser (postgres do sistema)
-- ================================================
