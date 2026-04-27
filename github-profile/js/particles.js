/**
 * BERSERK PROFILE - PARTICLES SYSTEM
 * Efeito de partículas de aura negra/brasas
 */

class ParticlesSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.maxParticles = 80;

        this.resize();
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle(x, y) {
        return {
            x: x || Math.random() * this.canvas.width,
            y: y || Math.random() * this.canvas.height,
            size: Math.random() * 3 + 1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5 - 0.3,
            opacity: Math.random() * 0.5 + 0.2,
            fadeSpeed: Math.random() * 0.003 + 0.002,
            color: this.getRandomColor()
        };
    }

    getRandomColor() {
        // Cores de aura: vermelho escuro, preto, cinza
        const colors = [
            'rgba(139, 0, 0, ',    // Vermelho sangue
            'rgba(92, 0, 0, ',     // Vermelho escuro
            'rgba(196, 30, 30, ',  // Vermelho claro
            'rgba(100, 100, 100, ' // Cinza
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        // Adicionar nova partícula ocasionalmente
        if (this.particles.length < this.maxParticles && Math.random() < 0.05) {
            this.particles.push(this.createParticle());
        }

        this.particles.forEach((particle, index) => {
            // Atualizar posição
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            particle.opacity -= particle.fadeSpeed;

            // Remover partícula desaparecida
            if (particle.opacity <= 0) {
                this.particles.splice(index, 1);
                this.particles.push(this.createParticle());
            }

            // Wrap around screen
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color + particle.opacity + ')';
            this.ctx.fill();

            // Glow effect
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
        });

        this.ctx.shadowBlur = 0;
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    // Add burst effect on click
    addBurst(x, y, count = 20) {
        for (let i = 0; i < count; i++) {
            const particle = {
                x: x,
                y: y,
                size: Math.random() * 4 + 2,
                speedX: (Math.random() - 0.5) * 4,
                speedY: (Math.random() - 0.5) * 4,
                opacity: 0.8,
                fadeSpeed: 0.02,
                color: this.getRandomColor()
            };
            this.particles.push(particle);
        }
    }
}

// Initialize particles
document.addEventListener('DOMContentLoaded', () => {
    new ParticlesSystem('particles-canvas');

    // Burst on click
    document.addEventListener('click', (e) => {
        // Only trigger on canvas clicks, not UI elements
        if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
            // Optional: add burst effect on click
        }
    });
});

export { ParticlesSystem };
