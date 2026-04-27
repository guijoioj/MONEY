/**
 * BERSERK PROFILE - DRAGON SLAYER GAME
 * Snake game com tema Berserk
 * Cobra = Dragon Slayer, Comida = Apóstolos/Behemits
 */

class SnakeGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 15;
        this.tileCount = 20;
        this.canvas.width = this.gridSize * this.tileCount;
        this.canvas.height = this.gridSize * this.tileCount;

        this.reset();
        this.bindEvents();
        this.draw();
    }

    reset() {
        this.snake = [{ x: 10, y: 10 }];
        this.food = this.spawnFood();
        this.velocity = { x: 0, y: 0 };
        this.score = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.speed = 100;
        this.lastUpdate = 0;
    }

    spawnFood() {
        return {
            x: Math.floor(Math.random() * this.tileCount),
            y: Math.floor(Math.random() * this.tileCount)
        };
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted && !this.gameOver) {
                this.gameStarted = true;
            }

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    if (this.velocity.y !== 1) {
                        this.velocity = { x: 0, y: -1 };
                    }
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    if (this.velocity.y !== -1) {
                        this.velocity = { x: 0, y: 1 };
                    }
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    if (this.velocity.x !== 1) {
                        this.velocity = { x: -1, y: 0 };
                    }
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    if (this.velocity.x !== -1) {
                        this.velocity = { x: 1, y: 0 };
                    }
                    break;
            }
        });
    }

    update(currentTime) {
        if (this.gameOver || !this.gameStarted) return;

        if (currentTime - this.lastUpdate < this.speed) return;
        this.lastUpdate = currentTime;

        // Move snake
        const head = {
            x: this.snake[0].x + this.velocity.x,
            y: this.snake[0].y + this.velocity.y
        };

        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCount ||
            head.y < 0 || head.y >= this.tileCount) {
            this.gameOver = true;
            this.showGameOver();
            return;
        }

        // Check self collision
        for (let segment of this.snake) {
            if (head.x === segment.x && head.y === segment.y) {
                this.gameOver = true;
                this.showGameOver();
                return;
            }
        }

        this.snake.unshift(head);

        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.food = this.spawnFood();
            this.speed = Math.max(50, this.speed - 2);
            this.updateScore();
        } else {
            this.snake.pop();
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.tileCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.canvas.width, i * this.gridSize);
            this.ctx.stroke();
        }

        // Draw food (Apostle/Behemit)
        this.ctx.fillStyle = '#8B0000';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2,
            this.food.y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Draw snake (Dragon Slayer segments)
        this.snake.forEach((segment, index) => {
            const isHead = index === 0;
            const gradient = this.ctx.createLinearGradient(
                segment.x * this.gridSize,
                segment.y * this.gridSize,
                (segment.x + 1) * this.gridSize,
                (segment.y + 1) * this.gridSize
            );

            if (isHead) {
                gradient.addColorStop(0, '#C0C0C0');
                gradient.addColorStop(1, '#808080');
            } else {
                gradient.addColorStop(0, '#808080');
                gradient.addColorStop(1, '#505050');
            }

            this.ctx.fillStyle = gradient;
            this.ctx.shadowBlur = isHead ? 10 : 5;
            this.ctx.shadowColor = '#ff0000';
            this.ctx.fillRect(
                segment.x * this.gridSize + 1,
                segment.y * this.gridSize + 1,
                this.gridSize - 2,
                this.gridSize - 2
            );

            // Draw eyes on head
            if (isHead) {
                this.ctx.fillStyle = '#8B0000';
                this.ctx.shadowBlur = 5;
                const eyeSize = 3;
                const eyeOffset = 4;

                if (this.velocity.x === 1) { // Right
                    this.ctx.fillRect(segment.x * this.gridSize + this.gridSize - eyeOffset, segment.y * this.gridSize + 4, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + this.gridSize - eyeOffset, segment.y * this.gridSize + this.gridSize - 7, eyeSize, eyeSize);
                } else if (this.velocity.x === -1) { // Left
                    this.ctx.fillRect(segment.x * this.gridSize + eyeOffset - 3, segment.y * this.gridSize + 4, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + eyeOffset - 3, segment.y * this.gridSize + this.gridSize - 7, eyeSize, eyeSize);
                } else if (this.velocity.y === -1) { // Up
                    this.ctx.fillRect(segment.x * this.gridSize + 4, segment.y * this.gridSize + eyeOffset - 3, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + this.gridSize - 7, segment.y * this.gridSize + eyeOffset - 3, eyeSize, eyeSize);
                } else { // Down or default
                    this.ctx.fillRect(segment.x * this.gridSize + 4, segment.y * this.gridSize + this.gridSize - eyeOffset, eyeSize, eyeSize);
                    this.ctx.fillRect(segment.x * this.gridSize + this.gridSize - 7, segment.y * this.gridSize + this.gridSize - eyeOffset, eyeSize, eyeSize);
                }
            }
        });
        this.ctx.shadowBlur = 0;
    }

    gameLoop(currentTime) {
        this.update(currentTime);
        this.draw();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    start() {
        this.reset();
        this.gameStarted = true;
        this.velocity = { x: 1, y: 0 }; // Start moving right
        this.hideOverlay();
        this.updateScore();
    }

    showGameOver() {
        const overlay = document.getElementById('game-overlay');
        const message = overlay.querySelector('.game-message');
        const score = overlay.querySelector('.game-score');
        const btn = document.getElementById('game-start-btn');

        message.textContent = '☠️ DERROTA!';
        message.style.color = '#ff0000';
        score.textContent = `Score: ${this.score}`;
        btn.textContent = 'Tentar Novamente';

        overlay.classList.remove('hidden');

        // Save high score
        const highScore = localStorage.getItem('dragonSlayerHighScore') || 0;
        if (this.score > highScore) {
            localStorage.setItem('dragonSlayerHighScore', this.score);
        }
    }

    hideOverlay() {
        const overlay = document.getElementById('game-overlay');
        overlay.classList.add('hidden');
    }

    updateScore() {
        const scoreElement = document.getElementById('game-score');
        if (scoreElement) {
            scoreElement.textContent = this.score;
        }
    }

    startGame() {
        this.start();
    }
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    const game = new SnakeGame('snake-canvas');

    const startBtn = document.getElementById('game-start-btn');
    const startGameBtn = document.getElementById('start-game');

    if (startBtn) {
        startBtn.addEventListener('click', () => game.startGame());
    }

    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            game.startGame();
            startGameBtn.textContent = 'Reiniciar Jogo';
        });
    }

    // Start game loop
    game.gameLoop(0);
});

export { SnakeGame };
