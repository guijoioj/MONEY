---
type: directive
audit-ignore: true
note: "Os wikilinks abaixo são EXEMPLOS dentro de blocos de template, não links reais. Auditorias devem ignorar este arquivo."
---

# Diretiva: Enriquecimento do Knowledge Graph

## Objetivo
Enriquecer as notas do Obsidian Knowledge Graph do projeto SoftHair, transformando dumps genéricos do LightRAG em documentação real com valor para um second brain.

## Escopo — O que ENRIQUECER

### ✅ ENRIQUECER (alto valor para o second brain)

1. **Source Notes** (182 notas) — Notas com `#source` tag que representam arquivos reais de código
   - Adicionar resumo descritivo real (não genérico)
   - Adicionar entidades vinculadas com links `[[...]]`
   - Adicionar arquivos relacionados (dependências)
   - **Incluir código completo** no final em bloco ```javascript
   - Path: `server/routes/`, `server/services/`, `server/models/`, `server/root/`, `server/config/`, `desktop/backend/`, `desktop/frontend/`, `mobile/app/`, etc.

2. **Domain Notes** (15 notas) — Mapas de domínio funcional
   - Adicionar descrição do domínio
   - Listar todas as rotas/endpoints do domínio
   - Listar services e models envolvidos
   - Path: `domains/`

3. **Concept Notes** (112 notas) — Conceitos canônicos
   - Adicionar definição clara do conceito
   - Adicionar contexto de uso no projeto
   - Path: `concepts/`

### ❌ NÃO ENRIQUECER (baixo valor / poluição)

1. **Entity Notes** (289 notas) — Entidades atômicas auto-geradas pelo LightRAG
   - São referências como `cors-275c8b63.md`, `pool-b165f349.md`
   - Já servem como nós de ligação no graph
   - Enriquecê-las seria redundante e criaria ruído
   - **MOTIVO:** São derivadas das source notes. O valor está na source note, não na entity.

2. **Templates** (5 notas) — Modelos para novas notas
3. **Periodic** (5 notas) — Notas periódicas vazias
4. **Index files** — Já são auto-gerados

## Total estimado: ~309 notas a enriquecer (182 source + 15 domain + 112 concept)

## Formato Padrão de Enriquecimento

### Para Source Notes:
```markdown
# Nome do Arquivo

**Repository:** Server|Desktop|Mobile
**File:** `caminho/do/arquivo`
**Language:** `javascript`

---

#repo #source #tags-relevantes

## Resumo
[Descrição real de 2-3 linhas do que o arquivo faz]

## Explicação
[Detalhes técnicos, fluxos, diagramas mermaid se aplicável]

## Entidades
- [[link/para/entidade|Nome]]

## Domínios
- [[domains/dominio|dominio]]

## Arquivos Relacionados
- [[link/para/arquivo|nome.js]] — descrição da relação

## Conteúdo
```javascript
// código completo do arquivo
```
```

### Para Domain Notes:
```markdown
# Nome do Domínio

## Descrição
[O que este domínio abrange no sistema]

## Endpoints
| Método | Rota | Descrição |

## Arquivos do Domínio
- Services
- Routes
- Models

## Fluxos Principais
[Diagrama mermaid do fluxo principal]
```

### Para Concept Notes:
```markdown
# Nome do Conceito

**Type:** `canonical-concept`

## Definição
[O que é este conceito no contexto do SoftHair]

## Uso no Projeto
[Onde e como é usado]

## Entidades Agrupadas
- [[links]]
```

## Execução
- Script: `execution/enrich_knowledge_graph.py`
- 15 workers paralelos
- Lê o arquivo .md original, o arquivo de código correspondente, e gera nota enriquecida
- Edge case: Se não encontrar o arquivo de código, mantém a nota original
