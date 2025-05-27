#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuração
const SESSION_DIR = './sessions';
const testClientId = 'test-proxy-instance';
const testProxyUrl = 'socks5://testuser:testpass@proxy.example.com:1080';

console.log('🧪 Teste de Persistência de Proxy - HiveWP API\n');

// Função para ler metadados
function readInstanceMetadata(clientId) {
  try {
    const metadataPath = path.join(SESSION_DIR, clientId, 'instance_metadata.json');
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (error) {
    console.error(`❌ Erro ao ler metadados: ${error.message}`);
  }
  return null;
}

// Função para salvar metadados
function saveInstanceMetadata(clientId, metadata) {
  try {
    const sessionPath = path.join(SESSION_DIR, clientId);
    
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    
    const metadataPath = path.join(sessionPath, 'instance_metadata.json');
    
    let existingData = {};
    if (fs.existsSync(metadataPath)) {
      existingData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    
    const combinedData = {
      ...existingData,
      ...metadata,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(combinedData, null, 2));
    console.log(`✅ Metadados salvos para: ${clientId}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao salvar metadados: ${error.message}`);
    return false;
  }
}

// Teste de API
async function testProxyAPI() {
  console.log('📡 Testando API...');
  
  const apiKey = process.env.API_KEY || 'your_api_key';
  const apiUrl = 'http://localhost:3000';
  
  try {
    // Teste 1: Criar instância com proxy
    console.log('1️⃣ Criando instância com proxy...');
    
    const createResponse = await fetch(`${apiUrl}/api/whatsapp/instance/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        clientId: testClientId,
        proxyUrl: testProxyUrl,
        ignoreGroups: true
      })
    });
    
    const createData = await createResponse.json();
    console.log('Resposta da criação:', createData);
    
    // Teste 2: Verificar se foi salvo nos metadados
    console.log('\n2️⃣ Verificando metadados salvos...');
    const metadata = readInstanceMetadata(testClientId);
    if (metadata && metadata.proxyUrl === testProxyUrl) {
      console.log('✅ Proxy URL salvo corretamente nos metadados');
      console.log(`   Proxy: ${metadata.proxyUrl}`);
    } else {
      console.log('❌ Proxy URL não encontrado nos metadados');
      console.log('   Metadados encontrados:', metadata);
    }
    
    // Teste 3: Verificar lista de instâncias
    console.log('\n3️⃣ Verificando lista de instâncias...');
    const listResponse = await fetch(`${apiUrl}/api/whatsapp/instances`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const listData = await listResponse.json();
    const instance = listData.instances?.find(i => i.id === testClientId);
    
    if (instance && instance.config && instance.config.proxyUrl === testProxyUrl) {
      console.log('✅ Proxy URL presente na lista de instâncias');
      console.log(`   Config: ${JSON.stringify(instance.config, null, 2)}`);
    } else {
      console.log('❌ Proxy URL não encontrado na lista de instâncias');
      console.log('   Instância encontrada:', instance);
    }
    
    // Teste 4: Atualizar proxy
    console.log('\n4️⃣ Atualizando proxy...');
    const newProxyUrl = 'http://newproxy.example.com:8080';
    
    const updateResponse = await fetch(`${apiUrl}/api/whatsapp/instance/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        clientId: testClientId,
        proxyUrl: newProxyUrl
      })
    });
    
    const updateData = await updateResponse.json();
    console.log('Resposta da atualização:', updateData);
    
    // Verificar se foi atualizado
    const updatedMetadata = readInstanceMetadata(testClientId);
    if (updatedMetadata && updatedMetadata.proxyUrl === newProxyUrl) {
      console.log('✅ Proxy URL atualizado corretamente');
      console.log(`   Novo proxy: ${updatedMetadata.proxyUrl}`);
    } else {
      console.log('❌ Proxy URL não foi atualizado');
    }
    
    // Limpeza
    console.log('\n🧹 Limpando instância de teste...');
    await fetch(`${apiUrl}/api/whatsapp/instance/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ clientId: testClientId })
    });
    
  } catch (error) {
    console.error('❌ Erro no teste de API:', error.message);
  }
}

// Teste local de metadados
function testLocalMetadata() {
  console.log('📁 Testando salvamento local de metadados...');
  
  // Salvar metadados de teste
  const testMetadata = {
    ignoreGroups: true,
    webhookUrl: 'https://test.example.com/webhook',
    proxyUrl: testProxyUrl,
    created: new Date().toISOString(),
    status: 'test'
  };
  
  console.log('💾 Salvando metadados de teste...');
  if (saveInstanceMetadata(testClientId, testMetadata)) {
    console.log('✅ Metadados salvos com sucesso');
    
    // Ler de volta
    console.log('📖 Lendo metadados...');
    const readMetadata = readInstanceMetadata(testClientId);
    
    if (readMetadata && readMetadata.proxyUrl === testProxyUrl) {
      console.log('✅ Proxy URL lido corretamente dos metadados');
      console.log(`   Proxy lido: ${readMetadata.proxyUrl}`);
    } else {
      console.log('❌ Problema ao ler proxy URL dos metadados');
      console.log('   Dados lidos:', readMetadata);
    }
    
    // Limpar arquivo de teste
    const testPath = path.join(SESSION_DIR, testClientId);
    if (fs.existsSync(testPath)) {
      fs.rmSync(testPath, { recursive: true });
      console.log('🧹 Arquivo de teste removido');
    }
  }
}

// Executar testes
async function runTests() {
  console.log('🚀 Iniciando testes...\n');
  
  // Teste 1: Metadados locais
  testLocalMetadata();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 2: API (se servidor estiver rodando)
  await testProxyAPI();
  
  console.log('\n✨ Testes concluídos!');
}

// Verificar se é execução direta
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { readInstanceMetadata, saveInstanceMetadata, testProxyAPI, testLocalMetadata }; 