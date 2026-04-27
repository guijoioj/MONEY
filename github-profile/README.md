# ⚔️ Berserk GitHub Profile

Perfil do GitHub personalizado com o tema **Berserk (Guts - Black Swordsman)**, criado para destacar os repositórios **SoftHair** e **softhair-mobile**.

![Preview](./assets/images/preview.png)

## 🎨 Features

### Visual Design
- **Tema Berserk**: Cores preto, vermelho sangue e prata
- **Partículas de Aura Negra**: Efeito animado de fundo
- **Dragon Slayer SVG**: Espada animada no banner
- **Fontes customizadas**: Bangers, Creepster e Fira Code

### Addons Interativos
1. **🐍 Dragon Slayer Game** - Snake game temático (cobra = Dragon Slayer, comida = Apóstolos)
2. **💀 Terminal Interativo** - Comandos: `help`, `about`, `skills`, `projects`, `contact`
3. **📊 GitHub Stats** - Estatísticas em tempo real via API
4. **📜 Quotes do Berserk** - Carousel com frases icônicas do Guts
5. **👁️ Visit Counter** - Contador de visitas persistente
6. **⚡ Skill Bars Animadas** - Barras de progresso com animação

## 📁 Estrutura

```
github-profile/
├── index.html              # Página principal
├── css/
│   ├── main.css           # Estilos principais
│   └── animations.css     # Animações e keyframes
├── js/
│   ├── main.js            # Entry point
│   ├── particles.js       # Sistema de partículas
│   ├── terminal.js        # Terminal interativo
│   ├── snake-game.js      # Jogo da cobrinha
│   ├── github-stats.js    # Integração com API do GitHub
│   └── animations.js      # Controlador de animações
├── assets/
│   ├── images/            # Imagens e banners
│   └── icons/             # Ícones SVG
└── README.md              # Este arquivo
```

## 🚀 Deploy

### GitHub Pages (Recomendado)

1. Crie um repositório chamado `seu-username.github.io`
2. Faça push do código:
```bash
git init
git add .
git commit -m "Initial commit - Berserk Profile"
git branch -M main
git remote add origin https://github.com/guijoioj/guijoioj.github.io.git
git push -u origin main
```
3. Acesse `https://guijoioj.github.io`

### Vercel

```bash
npm i -g vercel
vercel --prod
```

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=.
```

## 🎮 Comandos do Terminal

| Comando | Descrição |
|---------|-----------|
| `help` | Lista todos os comandos |
| `about` | Sobre o desenvolvedor |
| `skills` | Lista de habilidades |
| `projects` | Projetos principais |
| `contact` | Informações de contato |
| `github` | Abre perfil do GitHub |
| `clear` | Limpa o terminal |
| `date` | Mostra data atual |
| `echo [texto]` | Repete o texto |

## 🎮 Dragon Slayer Game

### Controles
- **WASD** ou **Setas** para mover
- Derrote os apóstolos (comida vermelha)
- Cada apóstolo derrotado: +10 pontos
- A velocidade aumenta com o score

### High Score
O recorde é salvo no `localStorage` do navegador.

## 🎨 Personalização

### Cores do Tema
Edite as variáveis CSS em `css/main.css`:

```css
:root {
    --primary: #8B0000;           /* Vermelho sangue */
    --primary-dark: #5c0000;
    --primary-light: #c41e1e;
    --secondary: #0a0a0a;         /* Preto */
    --accent: #C0C0C0;            /* Prata */
    --glow: #ff0000;              /* Brilho */
}
```

### Bio e Links
Edite em `js/github-stats.js`:
```javascript
const GITHUB_USERNAME = 'guijoioj'; // Seu username
```

### Quotes do Berserk
Edite em `index.html`:
```html
<div class="quote-item active">
    <blockquote class="quote">
        "Sua frase aqui"
    </blockquote>
    <cite class="quote-author">— Guts</cite>
</div>
```

### Skills
Edite em `index.html` na seção `.skills-grid`:
```html
<div class="skill-item">
    <div class="skill-header">
        <span class="skill-name">Nome da Skill</span>
        <span class="skill-percent">90%</span>
    </div>
    <div class="skill-bar">
        <div class="skill-progress" data-progress="90"></div>
    </div>
</div>
```

## 📊 Integrações

### GitHub API
- Busca dados do usuário: `GET /users/{username}`
- Busca repositórios: `GET /users/{username}/repos`
- Rate limit: 60 requests/hora (sem auth)

### localStorage
- High score do jogo
- Contador de visitas

## 🔧 Troubleshooting

### Stats não carregam
- Verifique o console do navegador
- O username deve estar correto em `js/github-stats.js`
- Rate limit do GitHub pode estar ativo

### Jogo não funciona
- Verifique se o canvas está visível
- Limpe o cache do navegador
- Teste em outro navegador

### Partículas não aparecem
- Verifique se o WebGL está habilitado
- Alguns adblocks podem bloquear o canvas

## 📱 Responsividade

O perfil é totalmente responsivo:
- **Desktop**: Layout de 2 colunas completo
- **Tablet**: Layout de 2 colunas compacto
- **Mobile**: Layout de 1 coluna com menu adaptativo

## 🎯 Performance

### Lighthouse Score (alvo)
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90

### Otimizações incluídas
- Lazy loading de imagens
- CSS minificado
- JS modular (ES6 modules)
- Animações com GPU acceleration
- Reduzidas animações para `prefers-reduced-motion`

## 📝 Licença

MIT License - Sinta-se livre para usar e modificar.

---

**Forjado no Abismo do Código** © 2026

*"Lute. Até você morrer. Lute até vencer!"* — Guts
