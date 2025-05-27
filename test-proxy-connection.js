#!/usr/bin/env node

const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');

// Proxy fornecido pelo usuário
const proxyUrl = 'http://bkmwheyo:1yqw0s7zvv18@23.129.253.74:6692';

console.log('🔍 Testando Proxy do Usuário\n');
console.log(`📡 Proxy: ${proxyUrl.replace(/:([^:]+)@/, ':****@')}\n`);

// Função para testar IP sem proxy
async function testWithoutProxy() {
    return new Promise((resolve, reject) => {
        console.log('1️⃣ Testando conexão SEM proxy...');
        
        const options = {
            hostname: 'httpbin.org',
            port: 443,
            path: '/ip',
            method: 'GET',
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`✅ IP sem proxy: ${result.origin}`);
                    resolve(result.origin);
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

// Função para testar IP com proxy
async function testWithProxy() {
    return new Promise((resolve, reject) => {
        console.log('\n2️⃣ Testando conexão COM proxy...');
        
        try {
            const agent = new HttpsProxyAgent(proxyUrl);
            
            const options = {
                hostname: 'httpbin.org',
                port: 443,
                path: '/ip',
                method: 'GET',
                agent: agent
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log(`✅ IP com proxy: ${result.origin}`);
                        resolve(result.origin);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
            
            req.on('error', (err) => {
                console.log(`❌ Erro de conexão: ${err.message}`);
                reject(err);
            });
            
            req.setTimeout(15000, () => {
                console.log('⏰ Timeout na conexão com proxy');
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            req.end();
        } catch (err) {
            console.log(`❌ Erro ao configurar proxy: ${err.message}`);
            reject(err);
        }
    });
}

// Função para obter informações de localização
async function getLocationInfo(ip) {
    return new Promise((resolve, reject) => {
        console.log(`\n3️⃣ Obtendo localização para IP: ${ip}...`);
        
        const options = {
            hostname: 'ipapi.co',
            port: 443,
            path: `/${ip}/json/`,
            method: 'GET',
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const location = JSON.parse(data);
                    console.log(`📍 Localização: ${location.city}, ${location.region}, ${location.country}`);
                    console.log(`🌐 ISP: ${location.org}`);
                    resolve(location);
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout location'));
        });
        req.end();
    });
}

// Função para testar conectividade básica do proxy
async function testProxyConnectivity() {
    return new Promise((resolve, reject) => {
        console.log('\n🔌 Testando conectividade básica do proxy...');
        
        const net = require('net');
        const url = new URL(proxyUrl);
        
        const socket = net.createConnection({
            host: url.hostname,
            port: parseInt(url.port)
        });
        
        socket.on('connect', () => {
            console.log('✅ Proxy está acessível');
            socket.destroy();
            resolve(true);
        });
        
        socket.on('error', (err) => {
            console.log(`❌ Proxy não acessível: ${err.message}`);
            socket.destroy();
            reject(err);
        });
        
        socket.setTimeout(5000, () => {
            console.log('⏰ Timeout ao conectar com proxy');
            socket.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// Executar todos os testes
async function runAllTests() {
    try {
        // Teste 1: Conectividade do proxy
        await testProxyConnectivity();
        
        // Teste 2: IP sem proxy
        const ipWithoutProxy = await testWithoutProxy();
        await getLocationInfo(ipWithoutProxy);
        
        // Teste 3: IP com proxy
        const ipWithProxy = await testWithProxy();
        await getLocationInfo(ipWithProxy);
        
        // Análise
        console.log('\n📊 ANÁLISE DOS RESULTADOS:');
        if (ipWithoutProxy === ipWithProxy) {
            console.log('❌ PROBLEMA: IPs são iguais - proxy não está funcionando');
            console.log('💡 Possíveis causas:');
            console.log('   - Proxy inválido ou expirado');
            console.log('   - Credenciais incorretas');
            console.log('   - Proxy não suporta HTTPS');
            console.log('   - Firewall bloqueando conexão');
        } else {
            console.log('✅ SUCESSO: IPs são diferentes - proxy está funcionando');
            console.log(`   📍 Sem proxy: ${ipWithoutProxy}`);
            console.log(`   📍 Com proxy: ${ipWithProxy}`);
        }
        
    } catch (error) {
        console.error('\n❌ Erro durante os testes:', error.message);
        
        console.log('\n🔧 SUGESTÕES DE CORREÇÃO:');
        console.log('1. Verificar se as credenciais estão corretas');
        console.log('2. Testar se o proxy funciona em outros programas');
        console.log('3. Verificar se o proxy suporta protocolo HTTPS');
        console.log('4. Tentar um proxy SOCKS5 se disponível');
        console.log('5. Verificar firewall e antivírus');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runAllTests();
}

module.exports = { testWithoutProxy, testWithProxy, getLocationInfo }; 