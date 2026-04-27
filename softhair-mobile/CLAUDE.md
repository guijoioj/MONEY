# CLAUDE.md — softhair-mobile

> Você está no repositório **MOBILE** do ecossistema SoftHair.
> Este arquivo herda automaticamente as regras do `MONEY\CLAUDE.md` (umbrella).

## Escopo deste repo

App mobile do SoftHair em **Expo + React Native + expo-router**. Dois perfis de uso:

- **Cliente**: explora salões, agenda, compra produtos, acompanha histórico.
- **Profissional**: bate ponto, vê agenda, gerencia perfil.

```
softhair-mobile\
├── app\                    # expo-router (file-based)
│   ├── (auth)\             # login / cadastro
│   ├── (cliente)\
│   │   ├── (tabs)\         # agendar, carrinho, loja
│   │   ├── produto\[id].tsx
│   │   └── salao\
│   └── (profissional)\
│       └── (tabs)\         # ponto
├── components\
├── services\               # api.ts (axios)
├── store\                  # state global
└── hooks\
```

## Regra obrigatória antes de mexer em código

O vault vive em `..\SoftHair\docs\knowledge-graph\`. Caminho absoluto:
`C:\Users\guise\Documents\MONEY\SoftHair\docs\knowledge-graph`

1. Leia `knowledge-graph\CLAUDE.md` integralmente.
2. Siga a ordem: `AI-CONTEXT.md` → `domains\<x>` → `concepts\<x>` → arquivo-fonte.
3. Cite as notas consultadas ao propor mudanças.

## Mapa do vault relevante a este repo

- `domains\mobile-ui`, `domains\state`, `domains\sync`, `domains\auth`, `domains\agendamentos`, `domains\clientes`, `domains\produtos`, `domains\profissionais`, `domains\saloes`, `domains\servicos`
- Arquivos-fonte mapeados em `mobile\app\`, `mobile\components\`, `mobile\hooks\`, `mobile\store\`, `mobile\services\`, `mobile\root\`, `mobile\entities\` (no vault)
- Entradas-fonte importantes:
  - `app\(auth)\login.tsx` ↔ `[[mobile/app/app-auth-logintsx]]`
  - `services\api.ts` ↔ `[[mobile/services/services-apits]]`

## Comandos de dev

```bash
cd C:\Users\guise\Documents\MONEY\softhair-mobile && npx expo start
```

## Stack específica

- React Native + Expo SDK
- expo-router (file-based)
- NativeWind (TailwindCSS for RN)
- TanStack React Query
- axios (em `services/api.ts`)
- AsyncStorage
- expo-notifications
- expo-image-picker

## Convenções (resumo — detalhe completo no umbrella)

- Roteamento file-based — usar grupos `(auth)`, `(cliente)`, `(profissional)`.
- Todo state de servidor passa por React Query — nada de useState pra dados de API.
- Toda chamada HTTP via `services/api.ts` — proibido axios inline.
- Estilização só com NativeWind/Tailwind classes — sem StyleSheet inline.
- Tratar loading e error em toda screen.

## API de destino

O app consome a API em `SOFT-HAIR-SERVER\` (não o backend do desktop). Conferir `services/api.ts` pra base URL.
