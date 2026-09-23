#!/bin/bash
# ================================================
# Script para liberar PostgreSQL para conexões externas
# Executar DENTRO do container PostgreSQL (Docker)
# ================================================

set -e

echo "=== Liberando PostgreSQL para conexões externas ==="

# Encontrar arquivos de configuração
echo "[1] Encontrando arquivos..."
PG_HBA=$(find / -name "pg_hba.conf" 2>/dev/null | grep -v "conf.d" | head -1)
PG_CONF=$(find / -name "postgresql.conf" 2>/dev/null | grep -v "conf.d" | head -1)

echo "   pg_hba.conf: $PG_HBA"
echo "   postgresql.conf: $PG_CONF"

if [ -z "$PG_HBA" ]; then
    echo "❌ pg_hba.conf não encontrado"
    exit 1
fi

# Fazer backup
echo "[2] Fazendo backup..."
cp "$PG_HBA" "${PG_HBA}.backup.$(date +%s)"
echo "   Backup: ${PG_HBA}.backup.$(date +%s)"

# Editar pg_hba.conf - adicionar linha para aceitar conexões externas
echo "[3] Adicionando regra para conexões externas em pg_hba.conf..."
if ! grep -q "0.0.0.0/0" "$PG_HBA"; then
    echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA"
    echo "host    all             all             ::0/0                    md5" >> "$PG_HBA"
    echo "   ✅ Linha adicionada"
else
    echo "   ℹ️  Regra já existe"
fi

# Editar postgresql.conf - mudar listen_addresses
if [ -n "$PG_CONF" ]; then
    echo "[4] Configurando listen_addresses em postgresql.conf..."
    if grep -q "^#listen_addresses" "$PG_CONF"; then
        sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
        echo "   ✅ listen_addresses = '*' (descomentado)"
    elif grep -q "^listen_addresses" "$PG_CONF"; then
        sed -i "s/^listen_addresses = '.*'/listen_addresses = '*'/" "$PG_CONF"
        echo "   ✅ listen_addresses = '*' (alterado)"
    else
        echo "listen_addresses = '*'" >> "$PG_CONF"
        echo "   ✅ listen_addresses = '*' (adicionado)"
    fi
fi

# Recarregar PostgreSQL
echo "[5] Recarregando PostgreSQL..."
if command -v psql &> /dev/null; then
    psql -U postgres -c "SELECT pg_reload_conf();"
    echo "   ✅ Configuração recarregada"
else
    echo "   ⚠️  psql não encontrado, reinicie o container pelo Dokploy"
fi

# Mostrar configuração atual
echo ""
echo "=== Configuração atual ==="
echo "listen_addresses:"
psql -U postgres -c "SHOW listen_addresses;" 2>/dev/null || echo "   (não foi possível mostrar)"

echo ""
echo "Regras pg_hba (host only):"
psql -U postgres -c "SELECT type, database, user, address, auth_method FROM pg_hba_file_rules WHERE type = 'host';" 2>/dev/null || echo "   (não foi possível mostrar)"

echo ""
echo "=== Concluído! ==="
echo "Se ainda não funcionar, reinicie o container pelo Dokploy."
