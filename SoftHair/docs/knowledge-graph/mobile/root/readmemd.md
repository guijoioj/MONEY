# README.md

**Repository:** Mobile
**File:** `README.md`
**Language:** `markdown`

---

#mobile #source

## Resumo

Arquivo `README.md` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/produtos|produtos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/state|state]]

- [[desktop/entities/sistema-de-administrao-de-salo-de-beleza-b8fe2e43|Sistema de Administração de Salão de Beleza]]

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```markdown
# SoftHair Mobile

App mobile do sistema SoftHair — desenvolvido em React Native com Expo.

## Para clientes
- Solicitar agendamentos (aprovados pela recepcionista)
- Loja de produtos de beleza com carrinho e checkout
- Acompanhar status de pedidos em tempo real

## Para profissionais
- Agenda do dia sincronizada com o sistema web
- Bater ponto (clock in/out por atendimento)
- Ver comissões e enviar aviso de atraso

## Stack
- React Native + Expo SDK 51
- Expo Router (file-based routing)
- Zustand (estado global)
- TanStack Query v5 (data fetching)
- NativeWind v4 (Tailwind para RN)
- WebSocket (notificações em tempo real)

## Backend
O backend está em [guijoioj/SoftHair](https://github.com/guijoioj/SoftHair).

## Como rodar
```bash
npm install
npx expo start
```

Configure `services/api.ts` com o IP da máquina onde o backend está rodando.
```
