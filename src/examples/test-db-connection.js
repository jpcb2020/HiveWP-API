/**
 * Script para testar a conexão com o banco de dados PostgreSQL
 * Execute com: node src/examples/test-db-connection.js
 */

const db = require('../config/database');

async function testConnection() {
  try {
    console.log('Iniciando teste de conexão com PostgreSQL...');
    
    // Tentar conectar ao banco de dados
    await db.connect();

    // Verificar o status da conexão
    const status = await db.checkStatus();
    console.log('Status da conexão:', status);
    
    // Executar uma consulta simples para verificar se está funcionando
    const result = await db.query('SELECT NOW() as current_time');
    console.log('Hora atual do banco de dados:', result.rows[0].current_time);
    
    // Testar se a tabela 'teste' existe
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'teste'
        ) as exists
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('Tabela "teste" existe! Buscando registros...');
        const testeData = await db.query('SELECT * FROM teste LIMIT 5');
        console.log('Dados da tabela "teste":', testeData.rows);
      } else {
        console.log('Tabela "teste" não existe. Criando tabela de exemplo...');
        await createTestTable();
      }
    } catch (err) {
      console.error('Erro ao verificar tabela:', err.message);
    }
    
    // Encerrar a conexão
    await db.end();
    console.log('Teste de conexão finalizado com sucesso!');
  } catch (error) {
    console.error('Erro durante o teste de conexão:', error);
  }
}

async function createTestTable() {
  try {
    // Criar tabela de teste
    await db.query(`
      CREATE TABLE IF NOT EXISTS teste (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        descricao TEXT,
        valor NUMERIC(15,2),
        ativo BOOLEAN DEFAULT true,
        data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela "teste" criada com sucesso!');
    
    // Inserir alguns dados de exemplo
    await db.query(`
      INSERT INTO teste (nome, descricao, valor)
      VALUES 
        ('Exemplo 1', 'Descrição do exemplo 1', 10.50),
        ('Exemplo 2', 'Descrição do exemplo 2', 25.99),
        ('Exemplo 3', 'Descrição do exemplo 3', 199.99)
    `);
    console.log('Dados de exemplo inseridos na tabela "teste"!');
    
    // Mostrar os dados inseridos
    const testeData = await db.query('SELECT * FROM teste');
    console.log('Dados inseridos:', testeData.rows);
  } catch (error) {
    console.error('Erro ao criar tabela de teste:', error);
  }
}

// Executar o teste
testConnection();
