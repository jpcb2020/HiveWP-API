#!/bin/bash

# 🚀 Script de Teste Automatizado - HiveWP API Otimizada
# Este script testa o sistema com múltiplas instâncias progressivamente

# Configurações
API_KEY="teste123_substitua_por_chave_forte"
BASE_URL="http://localhost:3000"
MAX_INSTANCES=10

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir status
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Verificar se o servidor está rodando
check_server() {
    print_status "Verificando se o servidor está rodando..."
    
    if curl -s -f "$BASE_URL/monitoring/health" > /dev/null; then
        print_success "Servidor está online"
        return 0
    else
        print_error "Servidor não está acessível em $BASE_URL"
        echo "Execute primeiro: npm start"
        exit 1
    fi
}

# Verificar autenticação
check_auth() {
    print_status "Testando autenticação..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/api/status")
    
    if [ "$response" -eq 200 ]; then
        print_success "Autenticação funcionando"
    else
        print_error "Falha na autenticação (HTTP $response)"
        echo "Verifique a API_KEY no arquivo .env"
        exit 1
    fi
}

# Criar instância de teste
create_instance() {
    local client_id=$1
    print_status "Criando instância: $client_id"
    
    response=$(curl -s -X POST "$BASE_URL/api/whatsapp/instance/init" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d "{
            \"clientId\": \"$client_id\",
            \"ignoreGroups\": true
        }")
    
    if echo "$response" | grep -q '"success": *true'; then
        print_success "Instância $client_id criada"
        return 0
    else
        print_error "Falha ao criar instância $client_id"
        echo "Resposta: $response"
        return 1
    fi
}

# Verificar status de instância
check_instance_status() {
    local client_id=$1
    
    response=$(curl -s "$BASE_URL/api/whatsapp/status?clientId=$client_id" \
        -H "Authorization: Bearer $API_KEY")
    
    echo "$response"
}

# Obter métricas do sistema
get_metrics() {
    print_status "Obtendo métricas do sistema..."
    
    curl -s "$BASE_URL/monitoring/metrics" \
        -H "Authorization: Bearer $API_KEY" | \
        jq -r '
        "📊 MÉTRICAS DO SISTEMA:",
        "├─ Uptime: \(.system.uptime)s",
        "├─ Requisições/min: \(.requests.requestsPerMinute)",
        "├─ Taxa de erro: \(.requests.errorRate)",
        "├─ Instâncias: \(.instances.total) (\(.instances.connected) conectadas)",
        "├─ Memória: \(.performance.memory.heapUsed)MB/\(.performance.memory.heapTotal)MB",
        "├─ Response time médio: \(.performance.avgResponseTime)ms",
        "└─ Cache hit rate: \(.cache.numberCache.hitRate)"
        ' 2>/dev/null || echo "Erro ao obter métricas"
}

# Testar cache de números
test_cache() {
    print_status "Testando cache de validação de números..."
    
    # Primeira chamada (cache miss)
    start_time=$(date +%s%3N)
    curl -s -X POST "$BASE_URL/api/whatsapp/check-number" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d '{
            "clientId": "teste1",
            "phoneNumber": "5511999999999"
        }' > /dev/null
    end_time=$(date +%s%3N)
    first_call=$((end_time - start_time))
    
    # Segunda chamada (cache hit)
    start_time=$(date +%s%3N)
    curl -s -X POST "$BASE_URL/api/whatsapp/check-number" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d '{
            "clientId": "teste1",
            "phoneNumber": "5511999999999"
        }' > /dev/null
    end_time=$(date +%s%3N)
    second_call=$((end_time - start_time))
    
    print_success "Cache teste:"
    echo "  ├─ 1ª chamada (miss): ${first_call}ms"
    echo "  └─ 2ª chamada (hit):  ${second_call}ms"
    
    if [ $second_call -lt $first_call ]; then
        print_success "Cache funcionando (2ª chamada mais rápida)"
    else
        print_warning "Cache pode não estar funcionando corretamente"
    fi
}

# Teste de rate limiting
test_rate_limiting() {
    print_status "Testando rate limiting..."
    
    success_count=0
    rate_limited_count=0
    
    for i in {1..15}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$BASE_URL/api/whatsapp/send/text" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $API_KEY" \
            -d '{
                "clientId": "teste1",
                "phoneNumber": "5511999999999",
                "message": "Teste rate limiting #'$i'"
            }')
        
        if [ "$response" -eq 200 ]; then
            ((success_count++))
        elif [ "$response" -eq 429 ]; then
            ((rate_limited_count++))
        fi
        
        sleep 0.1
    done
    
    print_success "Rate limiting teste:"
    echo "  ├─ Sucessos: $success_count"
    echo "  └─ Rate limited: $rate_limited_count"
    
    if [ $rate_limited_count -gt 0 ]; then
        print_success "Rate limiting funcionando"
    else
        print_warning "Rate limiting pode estar muito permissivo"
    fi
}

# Função principal
main() {
    echo -e "${BLUE}"
    echo "🚀 TESTE AUTOMATIZADO - HIVEWP API OTIMIZADA"
    echo "============================================="
    echo -e "${NC}"
    
    # Verificações iniciais
    check_server
    check_auth
    
    echo ""
    print_status "Iniciando teste com $MAX_INSTANCES instâncias..."
    
    # Criar instâncias progressivamente
    for i in $(seq 1 $MAX_INSTANCES); do
        create_instance "teste$i"
        
        # A cada 5 instâncias, verificar métricas
        if [ $((i % 5)) -eq 0 ]; then
            echo ""
            get_metrics
            echo ""
        fi
        
        sleep 1
    done
    
    echo ""
    print_status "Executando testes de funcionalidade..."
    
    # Testes específicos
    test_cache
    echo ""
    test_rate_limiting
    echo ""
    
    # Métricas finais
    get_metrics
    
    echo ""
    print_status "Verificando instâncias criadas..."
    
    # Listar todas as instâncias
    response=$(curl -s "$BASE_URL/api/whatsapp/instances" \
        -H "Authorization: Bearer $API_KEY")
    
    instance_count=$(echo "$response" | jq '.instances | length' 2>/dev/null || echo "0")
    print_success "Total de instâncias ativas: $instance_count"
    
    echo ""
    echo -e "${GREEN}🎯 TESTE CONCLUÍDO!${NC}"
    echo ""
    echo "📋 PRÓXIMOS PASSOS:"
    echo "1. Conectar as instâncias escaneando QR codes"
    echo "2. Testar envio de mensagens reais"
    echo "3. Monitorar performance com: $BASE_URL/monitoring/metrics"
    echo "4. Escalar gradualmente até 100 instâncias"
    echo ""
    echo "🌐 Acesse o dashboard: $BASE_URL"
}

# Verificar dependências
command -v curl >/dev/null 2>&1 || { print_error "curl é necessário mas não está instalado."; exit 1; }
command -v jq >/dev/null 2>&1 || { print_warning "jq não está instalado. Instale para métricas formatadas."; }

# Executar
main 