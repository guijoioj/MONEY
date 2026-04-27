# MONEY - Sistema de Gerenciamento de Salão de Beleza

Este repositório contém o ecossistema completo do projeto SoftHair, incluindo:

## 📋 Estrutura do Projeto

- **SoftHair/**: Aplicação desktop Electron com backend Node.js/Express e frontend React
  - Backend PostgreSQL com API REST
  - Frontend React + Vite + TailwindCSS
  - Desktop app com Electron

- **softhair-mobile/**: Aplicação móvel React Native + Expo
  - App para clientes e profissionais
  - Integração com o backend principal

- **SOFT-HAIR-SERVER/**: Servidor adicional/possível microserviço

## 🔒 Segurança

O sistema possui implementações de segurança profissionais incluindo:
- ✅ Remoção de credenciais hardcoded
- ✅ Política de senhas fortalecida (8+ caracteres com complexidade)
- ✅ Armazenamento seguro de tokens (memória/não persistente)
- ✅ MFA (Multi-Factor Authentication)
- ✅ Headers de segurança HTTP (HSTS, CSP, etc.)
- ✅ Rate limiting
- ✅ Criptografia de dados no mobile

## 🚀 Tecnologias Utilizadas

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT para autenticação
- Helmet para segurança

### Frontend
- React 18
- Vite
- TailwindCSS
- Electron

### Mobile
- React Native
- Expo
- TypeScript

## 📚 Documentação

Cada subdiretório possui sua própria documentação específica. Consulte os arquivos README locais para instruções de configuração e execução.

## 🔄 Atualizações Recentes

- Implementação completa de segurança
- Correções de bugs críticos
- Melhorias na estabilidade do sistema
