-- ================================================
-- Script SQL para configurar PostgreSQL aceitar conexões externas
-- Executar DENTRO do psql:
--    psql -U postgres -d postgres
-- ================================================

-- PASSO 1: Configurar listen_addresses (aceita qualquer IP)
ALTER SYSTEM SET listen_addresses = '*';

-- PASSO 2: Recarregar sem reiniciar (já aplica)
SELECT pg_reload_conf();

-- PASSO 3: Verificar se aplicou
SHOW listen_addresses;

-- PASSO 4: Ver regras atuais do pg_hba.conf
SELECT * FROM pg_hba_file_rules WHERE type = 'host';

-- PASSO 5: Adicionar regra para aceitar conexões externas (se não existir)
-- Executa APENAS se o resultado acima não mostrar 0.0.0.0/0
INSERT INTO pg_hba_file_rules (type, database, user, address, netmask, auth_method, options, comment)
VALUES ('host', 'all', 'all', '0.0.0.0', '0.0.0.0', 'md5', NULL, 'Allow external connections')
ON CONFLICT DO NOTHING;

SELECT pg_reload_conf();

-- ================================================
-- SE DER ERRO DE PERMISSÃO (no Docker):
-- O arquivo pg_hba.conf precisa ser editado manualmente
-- ================================================
