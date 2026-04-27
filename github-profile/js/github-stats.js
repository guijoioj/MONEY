/**
 * BERSERK PROFILE - GITHUB STATS
 * Fetch de dados da API do GitHub
 */

const GITHUB_USERNAME = 'guijoioj';

class GitHubStats {
    constructor() {
        this.userData = null;
        this.reposData = null;
        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.fetchUserData(),
                this.fetchReposData()
            ]);
            this.updateUI();
        } catch (error) {
            console.error('Erro ao buscar dados do GitHub:', error);
            this.showFallback();
        }
    }

    async fetchUserData() {
        const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`);
        if (!response.ok) throw new Error('Falha ao buscar dados do usuário');
        this.userData = await response.json();
    }

    async fetchReposData() {
        const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`);
        if (!response.ok) throw new Error('Falha ao buscar repositórios');
        this.reposData = await response.json();
    }

    updateUI() {
        this.updateProfileStats();
        this.updateRepoStats();
        this.updateLanguages();
    }

    updateProfileStats() {
        if (!this.userData) return;

        this.animateCounter('repos-count', this.userData.public_repos || 0);
        this.animateCounter('followers-count', this.userData.followers || 0);
        this.animateCounter('following-count', this.userData.following || 0);

        // Update bio if empty
        const bioElement = document.getElementById('typing-bio');
        if (bioElement && !bioElement.textContent.trim()) {
            this.typeWriter(this.userData.bio || 'Criador do SoftHair Ecosystem ⚔️');
        }
    }

    updateRepoStats() {
        if (!this.reposData) return;

        // SoftHair stats
        const softHair = this.reposData.find(r => r.name === 'SoftHair');
        if (softHair) {
            this.animateCounter('softhair-stars', softHair.stargazers_count);
            this.animateCounter('softhair-forks', softHair.forks_count);
        }

        // softhair-mobile stats
        const mobile = this.reposData.find(r => r.name === 'softhair-mobile');
        if (mobile) {
            this.animateCounter('mobile-stars', mobile.stargazers_count);
            this.animateCounter('mobile-forks', mobile.forks_count);
        }
    }

    updateLanguages() {
        if (!this.reposData) return;

        // Aggregate languages from all repos
        const languages = {};
        this.reposData.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
        });

        // Sort by count
        const sorted = Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        const total = sorted.reduce((sum, [, count]) => sum + count, 0);

        this.renderLanguagesChart(sorted, total);
    }

    renderLanguagesChart(languages, total) {
        const container = document.getElementById('languages-chart');
        if (!container) return;

        const colors = {
            JavaScript: '#f7df1e',
            TypeScript: '#3178c6',
            HTML: '#e34c26',
            CSS: '#563d7c',
            Python: '#3776ab',
            Java: '#b07219',
            Ruby: '#701516',
            Go: '#00add8',
            Rust: '#dea584',
            Shell: '#89e051',
            Default: '#C0C0C0'
        };

        let html = '';
        languages.forEach(([lang, count]) => {
            const percent = Math.round((count / total) * 100);
            const color = colors[lang] || colors.Default;

            html += `
                <div class="language-item">
                    <span class="language-label">${lang}</span>
                    <div class="language-bar">
                        <div class="language-fill" style="width: ${percent}%; background: ${color};"></div>
                    </div>
                    <span class="language-percent">${percent}%</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    animateCounter(elementId, target) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const duration = 1500;
        const start = 0;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out quart
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (target - start) * eased);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    typeWriter(text) {
        const element = document.getElementById('typing-bio');
        if (!element) return;

        let index = 0;
        const speed = 50;

        const type = () => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(type, speed);
            }
        };

        type();
    }

    showFallback() {
        // Fallback values if API fails
        const fallbacks = {
            'repos-count': '2',
            'followers-count': '0',
            'following-count': '0',
            'softhair-stars': '⚔️',
            'softhair-forks': '⚔️',
            'mobile-stars': '⚔️',
            'mobile-forks': '⚔️'
        };

        Object.entries(fallbacks).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        const bio = document.getElementById('typing-bio');
        if (bio) bio.textContent = 'Criador do SoftHair Ecosystem ⚔️';

        const languages = document.getElementById('languages-chart');
        if (languages) {
            languages.innerHTML = `
                <div class="language-item">
                    <span class="language-label">JavaScript</span>
                    <div class="language-bar">
                        <div class="language-fill" style="width: 40%;"></div>
                    </div>
                    <span class="language-percent">40%</span>
                </div>
                <div class="language-item">
                    <span class="language-label">TypeScript</span>
                    <div class="language-bar">
                        <div class="language-fill" style="width: 30%;"></div>
                    </div>
                    <span class="language-percent">30%</span>
                </div>
                <div class="language-item">
                    <span class="language-label">CSS</span>
                    <div class="language-bar">
                        <div class="language-fill" style="width: 20%;"></div>
                    </div>
                    <span class="language-percent">20%</span>
                </div>
                <div class="language-item">
                    <span class="language-label">Other</span>
                    <div class="language-bar">
                        <div class="language-fill" style="width: 10%;"></div>
                    </div>
                    <span class="language-percent">10%</span>
                </div>
            `;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new GitHubStats();
});

export { GitHubStats, GITHUB_USERNAME };
