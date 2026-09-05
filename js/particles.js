/**
 * CyberHUD Holographic Particle & Grid Canvas Engine
 */
class HudBackground {
    constructor(canvasId = 'bgCanvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 50;
        this.mouse = { x: null, y: null, radius: 150 };
        this.animationId = null;
        this.themeColor = '#00f0ff'; // Default cyan
        this.accentColor = '#ffd700'; // Gold

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        this.createParticles();
        this.animate();
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setTheme(color, accent) {
        this.themeColor = color || '#00f0ff';
        this.accentColor = accent || '#ffd700';
    }

    createParticles() {
        this.particles = [];
        const count = Math.min(Math.floor((this.canvas.width * this.canvas.height) / 22000), 75);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 0.6,
                speedY: (Math.random() - 0.5) * 0.6,
                opacity: Math.random() * 0.5 + 0.2,
                ringPulse: Math.random() * Math.PI * 2,
                isSpecial: Math.random() > 0.85
            });
        }
    }

    drawGrid() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const gridSize = 60;

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.025)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = 0; x < w; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }

    animate() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();

        // Draw and connect particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // Movement
            p.x += p.speedX;
            p.y += p.speedY;
            p.ringPulse += 0.02;

            // Bounce on bounds
            if (p.x < 0 || p.x > this.canvas.width) p.speedX *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.speedY *= -1;

            // Mouse interaction
            if (this.mouse.x !== null) {
                const dx = this.mouse.x - p.x;
                const dy = this.mouse.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const force = (1 - dist / this.mouse.radius) * 0.8;
                    p.x -= (dx / dist) * force * 2;
                    p.y -= (dy / dist) * force * 2;
                }
            }

            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.isSpecial ? this.accentColor : this.themeColor;
            ctx.globalAlpha = p.opacity;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.isSpecial ? this.accentColor : this.themeColor;
            ctx.fill();

            // Arc ring if special
            if (p.isSpecial) {
                ctx.beginPath();
                const radius = p.size * 3 + Math.sin(p.ringPulse) * 2;
                ctx.arc(p.x, p.y, Math.max(radius, 2), 0, Math.PI * 2);
                ctx.strokeStyle = this.themeColor;
                ctx.lineWidth = 0.7;
                ctx.globalAlpha = 0.25;
                ctx.stroke();
            }

            // Connect nearby particles
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 110) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = this.themeColor;
                    ctx.globalAlpha = (1 - dist / 110) * 0.15;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

window.HudBackground = HudBackground;
