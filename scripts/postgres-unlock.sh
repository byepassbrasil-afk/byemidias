#!/bin/bash
# Script para liberar PostgreSQL para conexões externas
# Executar NO SERVIDOR (Dokploy/Terminal)

echo "=== Liberando PostgreSQL para conexões externas ==="

# 1. Encontrar arquivos de configuração
echo ""
echo "1. Procurando arquivos de configuração..."
PG_HBA=$(find / -name "pg_hba.conf" 2>/dev/null | head -1)
PG_CONF=$(find / -name "postgresql.conf" 2>/dev/null | head -1)
echo "   pg_hba.conf: $PG_HBA"
echo "   postgresql.conf: $PG_CONF"

if [ -z "$PG_HBA" ] || [ -z "$PG_CONF" ]; then
    echo ""
    echo "❌ Não encontrou os arquivos. Tentando outros métodos..."

    # Tenta localizar pelo processo
    PG_DIR=$(dirname $(find /proc -name environ 2>/dev/null | head -1 | xargs dirname 2>/dev/null) 2>/dev/null
    echo "   PG_DIR: $PG_DIR"

    # Método alternativo: procurar em /var/lib ou /etc
    for dir in /var/lib/postgresql /var/lib/pgsql /etc/postgresql; do
        if [ -d "$dir" ]; then
            echo "   Encontrado: $dir"
            find $dir -name "pg_hba.conf" 2>/dev/null
            find $dir -name "postgresql.conf" 2>/dev/null
        fi
    done
fi

# 2. Encontrar o caminho do socket ou PID do PostgreSQL
echo ""
echo "2. Status do PostgreSQL..."
sudo systemctl status postgresql 2>/dev/null | head -5 || echo "   systemctl não disponível (pode estar em container)"

# Tenta encontrar o processo postgres
PG_PID=$(pgrep -fa postgres | head -3)
echo "   Processos postgres:"
echo "$PG_PID" | head -3

# 3. Informações de rede
echo ""
echo "3. Informações de rede..."
sudo ss -tlnp 2>/dev/null | grep 5432 || echo "   Porta 5432 não está escutando em ss"

echo ""
echo "=== FIM ==="
echo ""
echo "Por favor, cole a SAÍDA COMPLETA deste script aqui."
echo "Preciso ver os caminhos encontrados para dar os próximos comandos."
