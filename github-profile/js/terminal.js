/**
 * BERSERK PROFILE - TERMINAL INTERATIVO
 * Simula terminal com comandos customizados
 */

class Terminal {
    constructor() {
        this.input = document.getElementById('terminal-input');
        this.body = document.getElementById('terminal-body');
        this.history = [];
        this.historyIndex = -1;

        this.commands = {
            help: this.showHelp.bind(this),
            about: this.showAbout.bind(this),
            skills: this.showSkills.bind(this),
            projects: this.showProjects.bind(this),
            contact: this.showContact.bind(this),
            clear: this.clear.bind(this),
            echo: this.echo.bind(this),
            date: this.showDate.bind(this),
            github: this.showGithub.bind(this)
        };

        this.bindEvents();
    }

    bindEvents() {
        if (!this.input) return;

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = this.input.value.trim();
                if (command) {
                    this.execute(command);
                    this.history.push(command);
                    this.historyIndex = this.history.length;
                }
                this.input.value = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.input.value = this.history[this.historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.input.value = this.history[this.historyIndex];
                } else {
                    this.historyIndex = this.history.length;
                    this.input.value = '';
                }
            }
        });
    }

    execute(input) {
        const parts = input.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        this.printOutput(`root@berserk:~$ ${input}`, 'command');

        if (this.commands[cmd]) {
            this.commands[cmd](args);
        } else if (cmd) {
            this.printOutput(`Comando não encontrado: ${cmd}. Digite 'help' para ajuda.`, 'error');
        }
    }

    printOutput(text, type = 'output') {
        const line = document.createElement('div');
        line.className = `terminal-line terminal-output`;

        if (type === 'command') {
            line.innerHTML = `<span class="prompt">root@berserk:~$</span><span>${text.replace(`root@berserk:~$ `, '')}</span>`;
        } else if (type === 'error') {
            line.innerHTML = `<span style="color: var(--primary-light);">${text}</span>`;
        } else {
            line.innerHTML = `<span>${text}</span>`;
        }

        this.body.insertBefore(line, this.body.querySelector('.input-line'));
        this.body.scrollTop = this.body.scrollHeight;
    }

    printHTML(html) {
        const line = document.createElement('div');
        line.className = 'terminal-line terminal-output';
        line.innerHTML = html;
        this.body.insertBefore(line, this.body.querySelector('.input-line'));
    }

    showHelp() {
        const helpText = `
<div style="color: var(--text); line-height: 1.8;">
<span style="color: var(--primary-light);">Comandos disponíveis:</span><br>
  <span class="cmd-highlight">about</span>      - Sobre o desenvolvedor<br>
  <span class="cmd-highlight">skills</span>     - Lista de habilidades<br>
  <span class="cmd-highlight">projects</span>   - Projetos principais<br>
  <span class="cmd-highlight">contact</span>    - Informações de contato<br>
  <span class="cmd-highlight">github</span>     - Link do GitHub<br>
  <span class="cmd-highlight">clear</span>      - Limpar terminal<br>
  <span class="cmd-highlight">date</span>       - Mostrar data atual<br>
  <span class="cmd-highlight">echo [txt]</span> - Repetir texto<br>
</div>`;
        this.printHTML(helpText);
    }

    showAbout() {
        const aboutText = `
<div style="color: var(--text); line-height: 1.6; max-width: 500px;">
<span style="color: var(--primary-light); font-family: var(--font-title); font-size: 1.2rem;">
⚔️ Black Swordsman Developer
</span><br><br>
Desenvolvedor full-stack especializado em criar ecossistemas digitais.<br>
Criador do <span style="color: var(--primary-light);">SoftHair</span> - sistema de gestão para salões de beleza.<br><br>
<span style="color: var(--accent);">"Lute até vencer."</span>
</div>`;
        this.printHTML(aboutText);
    }

    showSkills() {
        const skills = [
            { name: 'JavaScript/TypeScript', level: 'Avançado' },
            { name: 'React/React Native', level: 'Avançado' },
            { name: 'Node.js', level: 'Avançado' },
            { name: 'PostgreSQL', level: 'Intermediário' },
            { name: 'Electron', level: 'Intermediário' },
            { name: 'DevOps/CI/CD', level: 'Intermediário' }
        ];

        let html = '<div style="color: var(--text);">';
        skills.forEach(skill => {
            html += `  <span style="color: var(--primary-light);">●</span> ${skill.name}: ${skill.level}<br>`;
        });
        html += '</div>';
        this.printHTML(html);
    }

    showProjects() {
        const projects = `
<div style="color: var(--text); line-height: 1.8;">
<span style="color: var(--primary-light); font-family: var(--font-title);">⚔️ SoftHair Ecosystem</span><br><br>
<span style="color: var(--accent);">SoftHair</span><br>
  Desktop app (Electron + React) para gestão de salões<br>
  Backend: Node.js + Express + PostgreSQL<br>
  <a href="https://github.com/guijoioj/SoftHair" target="_blank" style="color: var(--primary-light);">github.com/guijoioj/SoftHair</a><br><br>
<span style="color: var(--accent);">softhair-mobile</span><br>
  App mobile (React Native + Expo) para clientes e profissionais<br>
  <a href="https://github.com/guijoioj/softhair-mobile" target="_blank" style="color: var(--primary-light);">github.com/guijoioj/softhair-mobile</a>
</div>`;
        this.printHTML(projects);
    }

    showContact() {
        const contact = `
<div style="color: var(--text); line-height: 1.8;">
<span style="color: var(--primary-light);">Email:</span> em breve<br>
<span style="color: var(--primary-light);">GitHub:</span> github.com/guijoioj<br>
<span style="color: var(--primary-light);">Local:</span> Brasil<br><br>
<span style="color: var(--accent);">"Estou sempre aberto a novos desafios."</span>
</div>`;
        this.printHTML(contact);
    }

    clear() {
        const inputs = this.body.querySelectorAll('.input-line');
        this.body.innerHTML = '';
        inputs.forEach(input => this.body.appendChild(input));
    }

    echo(args) {
        this.printOutput(args.join(' ') || '(vazio)');
    }

    showDate() {
        this.printOutput(new Date().toLocaleString('pt-BR'));
    }

    showGithub() {
        this.printOutput('Abrindo GitHub...', 'output');
        window.open('https://github.com/guijoioj', '_blank');
    }
}

// Initialize terminal
document.addEventListener('DOMContentLoaded', () => {
    new Terminal();
});

export { Terminal };
