#!/usr/bin/env node

/**
 * Script de inicialização automática das camadas de segurança
 * Executado automaticamente quando o servidor inicia
 */

const SecurityInitService = require('../src/services/securityInitService');

console.log('🔐 Iniciando configuração de segurança...\n');

(async () => {
  try {
    await SecurityInitService.initializeSecurity();
    console.log('\n✅ Configuração de segurança concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Falha na configuração de segurança:', error.message);
    process.exit(1);
  }
})();