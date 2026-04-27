# 💬 AI-Prompt — Templates rápidos para invocar o segundo cérebro

> Cole o trecho que se aplica no início da sua mensagem para a IA.
> Em conversas longas, basta colar uma vez por sessão.

---

## 🔑 Snippet universal (cole no começo de qualquer sessão nova)

```
Você tem acesso ao meu segundo cérebro em
C:\Users\guise\Documents\MONEY\SoftHair\docs\knowledge-graph

Antes de qualquer tarefa, leia CLAUDE.md desta pasta e siga as regras dele.
Use HOME.md → AI-CONTEXT.md → domains/<domínio> → concepts/<conceito>
antes de abrir qualquer arquivo-fonte.
```

---

## 🛠️ Para mexer em código do sistema

```
Tarefa no SoftHair: <descreva o que quer>.
Antes de propor mudança, consulte o vault:
1. Abra o domínio relevante em domains/.
2. Abra os concepts/ envolvidos.
3. Cite as notas que você consultou na resposta.
```

---

## ❓ Para perguntar como algo funciona

```
Como funciona <X> no SoftHair?
Responda usando concepts/<x> e relações listadas na nota.
Não abra arquivos-fonte se a nota já basta.
```

---

## 📝 Para criar uma nota nova

```
Crie nota sobre <tema> em <concepts/ | 03-Resources/ | 01-Projects/>.
Use Templates/<tipo>.md como base.
Atualize o INDEX da pasta com o link da nova nota.
Use frontmatter YAML mínimo (type, created, tags).
```

---

## 📅 Para Daily/Weekly/etc

```
Crie a Daily de hoje usando Templates/Daily.md.
Salve em Periodic/Daily/YYYY-MM-DD.md.
Puxe pendências de 01-Projects/INDEX e da Weekly atual.
```

---

## 🚫 Para tarefas FORA do sistema

Não precisa de prompt especial — fale normalmente. A IA só consulta o vault
quando o pedido toca termos do SoftHair ou do LifeOS (ver CLAUDE.md §2).
