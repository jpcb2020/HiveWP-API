/**
 * Configuração e conexão com o banco de dados PostgreSQL
 * Este módulo fornece funcionalidades para conectar, consultar e encerrar conexões com o PostgreSQL
 */

require('dotenv').config();
const { Client, Pool } = require('pg');

// Configuração do banco de dados PostgreSQL
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Parâmetros adicionais para melhorar o desempenho e confiabilidade
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX || '20'), // tamanho máximo do pool de conexões
  min: parseInt(process.env.DB_POOL_MIN || '10'), // tamanho mínimo do pool de conexões
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // tempo em ms que uma conexão pode ficar ociosa
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000') // tempo em ms para timeout de conexão
};

// Cliente para consultas únicas ou operações de conexão
const client = new Client(dbConfig);

// Pool de conexões para gerenciar múltiplas conexões simultâneas
const pool = new Pool(dbConfig);

// Monitorar erros do pool para evitar falhas silenciosas
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões:', err);
});

/**
 * Módulo de banco de dados
 */
module.exports = {
  // Expor o cliente e o pool para uso avançado se necessário
  client,
  pool,
  
  /**
   * Estabelece uma conexão com o banco de dados PostgreSQL
   * @returns {Promise<Client>} Cliente PostgreSQL conectado
   */
  connect: async () => {
    try {
      await client.connect();
      console.log('Conectado ao PostgreSQL');
      return client;
    } catch (error) {
      console.error('Erro ao conectar ao PostgreSQL:', error.stack);
      throw error;
    }
  },
  
  /**
   * Executa uma consulta SQL no banco de dados
   * @param {string} text - Consulta SQL a ser executada
   * @param {Array} params - Parâmetros para a consulta (opcional)
   * @returns {Promise<Object>} Resultado da consulta
   */
  query: async (text, params) => {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Erro ao executar query:', error.stack);
      throw error;
    }
  },
  
  /**
   * Encerra todas as conexões com o banco de dados
   */
  end: async () => {
    try {
      await client.end();
      await pool.end();
      console.log('Conexão com PostgreSQL encerrada');
    } catch (error) {
      console.error('Erro ao encerrar conexão com PostgreSQL:', error.stack);
    }
  },
  
  /**
   * Verifica o status da conexão com o banco de dados
   * @returns {Promise<Object>} Informações sobre o status da conexão
   */
  checkStatus: async () => {
    try {
      const connected = client._connected || false;
      const poolStatus = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
      
      return { connected, poolStatus };
    } catch (error) {
      console.error('Erro ao verificar status da conexão:', error.stack);
      return { connected: false, error: error.message };
    }
  }
};
