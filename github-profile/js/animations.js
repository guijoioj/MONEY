/**
 * BERSERK PROFILE - ANIMATIONS CONTROLLER
 * Gerencia animações de scroll, quotes e efeitos visuais
 */

class AnimationsController {
    constructor() {
        this.initScrollAnimations();
        this.initQuotesCarousel();
        this.initSkillBars();
        this.initVisitCounter();
        this.setCurrentYear();
    }

    // Scroll-triggered animations
    initScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        document.querySelectorAll('.card').forEach(card => {
            card.classList.add('scroll-reveal');
            observer.observe(card);
        });
    }

    // Quotes carousel
    initQuotesCarousel() {
        const quotes = document.querySelectorAll('.quote-item');
        const dots = document.querySelectorAll('.quote-dots .dot');
        let currentIndex = 0;

        const showQuote = (index) => {
            quotes.forEach((quote, i) => {
                quote.classList.remove('active');
                if (dots[i]) dots[i].classList.remove('active');
            });

            quotes[index].classList.add('active');
            if (dots[index]) dots[index].classList.add('active');
        };

        // Click on dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                currentIndex = index;
                showQuote(currentIndex);
            });
        });

        // Auto-rotate
        setInterval(() => {
            currentIndex = (currentIndex + 1) % quotes.length;
            showQuote(currentIndex);
        }, 5000);
    }

    // Skill bars animation
    initSkillBars() {
        const skillBars = document.querySelectorAll('.skill-progress');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const progress = entry.target.dataset.progress;
                    entry.target.style.width = `${progress}%`;
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        skillBars.forEach(bar => observer.observe(bar));
    }

    // Visit counter
    async initVisitCounter() {
        const counterKey = 'berserk_profile_visits';
        let count = parseInt(localStorage.getItem(counterKey) || '0');

        // Increment only once per session
        if (!sessionStorage.getItem('visited')) {
            count++;
            localStorage.setItem(counterKey, count.toString());
            sessionStorage.setItem('visited', 'true');
        }

        this.animateCounter(count);
    }

    animateCounter(count) {
        const digits = count.toString().padStart(5, '0').split('');
        const elements = [
            document.getElementById('counter-1'),
            document.getElementById('counter-2'),
            document.getElementById('counter-3'),
            document.getElementById('counter-4'),
            document.getElementById('counter-5')
        ];

        digits.forEach((digit, index) => {
            if (elements[index]) {
                elements[index].textContent = digit;
            }
        });
    }

    // Set current year in footer
    setCurrentYear() {
        const yearEl = document.getElementById('current-year');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new AnimationsController();
});

export { AnimationsController };
