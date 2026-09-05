/**
 * CyberHUD Task Matrix Engine
 * Daily task manager with priority, categories, streaks, and focus timer hooks
 */
class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.currentCategory = 'all';
        this.streakData = {
            count: 0,
            lastCompletedDate: null
        };

        this.load();
        this.checkStreak();
    }

    load() {
        const taskKey = window.authManager ? window.authManager.getScopedKey('cyberhud_tasks') : 'cyberhud_tasks';
        const streakKey = window.authManager ? window.authManager.getScopedKey('cyberhud_streak') : 'cyberhud_streak';

        let savedTasks = localStorage.getItem(taskKey);
        if (!savedTasks && localStorage.getItem('cyberhud_tasks')) {
            savedTasks = localStorage.getItem('cyberhud_tasks');
        }

        if (savedTasks) {
            try {
                this.tasks = JSON.parse(savedTasks);
            } catch (e) {
                this.tasks = [];
            }
        } else {
            // Default sample tasks
            this.tasks = [
                {
                    id: 'task_' + Date.now() + '_1',
                    title: 'Quantum Physics Formula Revision',
                    category: 'Study',
                    priority: 'high',
                    dueDate: new Date().toISOString().split('T')[0],
                    dueTime: '15:00',
                    completed: false,
                    createdAt: Date.now() - 3600000,
                    timeSpentMinutes: 25
                },
                {
                    id: 'task_' + Date.now() + '_2',
                    title: 'Practice 25 Mock MCQs (Calculus & Mechanics)',
                    category: 'Exam Prep',
                    priority: 'urgent',
                    dueDate: new Date().toISOString().split('T')[0],
                    dueTime: '18:30',
                    completed: false,
                    createdAt: Date.now() - 7200000,
                    timeSpentMinutes: 0
                },
                {
                    id: 'task_' + Date.now() + '_3',
                    title: 'Stark Arc Reactor Algorithm Optimization',
                    category: 'Coding',
                    priority: 'medium',
                    dueDate: new Date().toISOString().split('T')[0],
                    dueTime: '21:00',
                    completed: true,
                    createdAt: Date.now() - 10800000,
                    timeSpentMinutes: 45
                }
            ];
            this.save();
        }

        let savedStreak = localStorage.getItem(streakKey);
        if (!savedStreak && localStorage.getItem('cyberhud_streak')) {
            savedStreak = localStorage.getItem('cyberhud_streak');
        }
        if (savedStreak) {
            try {
                this.streakData = JSON.parse(savedStreak);
            } catch (e) {
                this.streakData = { count: 0, lastCompletedDate: null };
            }
        } else {
            this.streakData = { count: 0, lastCompletedDate: null };
        }
    }

    save() {
        const taskKey = window.authManager ? window.authManager.getScopedKey('cyberhud_tasks') : 'cyberhud_tasks';
        const streakKey = window.authManager ? window.authManager.getScopedKey('cyberhud_streak') : 'cyberhud_streak';
        localStorage.setItem(taskKey, JSON.stringify(this.tasks));
        localStorage.setItem(streakKey, JSON.stringify(this.streakData));
    }

    reloadForUser() {
        this.load();
        this.checkStreak();
        this.render();
        this.updateTelemetry();
    }

    checkStreak() {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (this.streakData.lastCompletedDate) {
            if (this.streakData.lastCompletedDate === today) {
                // Streak maintained today
            } else if (this.streakData.lastCompletedDate === yesterday) {
                // Streak valid from yesterday
            } else {
                // Streak lapsed
                const hasTodayComplete = this.tasks.some(t => t.completed && t.completedAt && t.completedAt.startsWith(today));
                if (!hasTodayComplete) {
                    this.streakData.count = 0;
                    this.save();
                }
            }
        }
    }

    addTask(title, category = 'Study', priority = 'medium', dueDate = '', dueTime = '') {
        if (!title.trim()) return null;

        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: title.trim(),
            category: category || 'Study',
            priority: priority || 'medium',
            dueDate: dueDate || new Date().toISOString().split('T')[0],
            dueTime: dueTime || '',
            completed: false,
            createdAt: Date.now(),
            completedAt: null,
            timeSpentMinutes: 0
        };

        this.tasks.unshift(newTask);
        this.save();
        if (window.authManager) window.authManager.awardXP(10, 'Directive Created');
        if (window.soundFX) window.soundFX.playClick();
        this.render();
        this.updateTelemetry();
        return newTask;
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        task.completed = !task.completed;
        const today = new Date().toISOString().split('T')[0];

        if (task.completed) {
            task.completedAt = new Date().toISOString();
            if (window.soundFX) window.soundFX.playSuccess();
            this.triggerConfetti();
            if (window.authManager) window.authManager.awardXP(25, 'Directive Completed');

            // Update streak
            if (this.streakData.lastCompletedDate !== today) {
                this.streakData.count = (this.streakData.count || 0) + 1;
                this.streakData.lastCompletedDate = today;
                this.save();
                if (window.authManager) window.authManager.awardXP(50, 'Daily Streak Active');
            }
        } else {
            task.completedAt = null;
            if (window.soundFX) window.soundFX.playClick();
        }

        this.save();
        this.render();
        this.updateTelemetry();
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
        if (window.soundFX) window.soundFX.playClick();
        this.render();
        this.updateTelemetry();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    }

    setCategory(category) {
        this.currentCategory = category;
        this.render();
    }

    getFilteredTasks() {
        const today = new Date().toISOString().split('T')[0];
        return this.tasks.filter(task => {
            // Status filter
            if (this.currentFilter === 'pending' && task.completed) return false;
            if (this.currentFilter === 'completed' && !task.completed) return false;
            if (this.currentFilter === 'today' && task.dueDate !== today) return false;

            // Category filter
            if (this.currentCategory !== 'all' && task.category !== this.currentCategory) return false;

            return true;
        });
    }

    addTimeToTask(taskId, minutes) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.timeSpentMinutes = (task.timeSpentMinutes || 0) + minutes;
            this.save();
            this.render();
            this.updateTelemetry();
        }
    }

    triggerConfetti() {
        // Futuristic mini burst
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#00f0ff', '#ffd700', '#ff3366', '#00ff88', '#ffffff'];
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12 - 4,
                size: Math.random() * 5 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: Math.random() * 0.02 + 0.015
            });
        }

        function anim() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // gravity
                p.alpha -= p.decay;
                if (p.alpha > 0) {
                    alive = true;
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.alpha;
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                }
            }
            if (alive) {
                requestAnimationFrame(anim);
            } else {
                canvas.remove();
            }
        }
        anim();
    }

    render() {
        const container = document.getElementById('taskListContainer');
        if (!container) return;

        const filtered = this.getFilteredTasks();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i data-lucide="shield-check"></i></div>
                    <h3>ALL PROTOCOLS ACTIVE</h3>
                    <p>No tasks matching the selected filters. Ready to initialize new directives.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = filtered.map(t => {
            const priorityClass = `priority-${t.priority}`;
            const isDone = t.completed;
            const dueDisplay = t.dueTime ? `${t.dueDate} @ ${t.dueTime}` : (t.dueDate || 'No Deadline');
            const timeTracked = t.timeSpentMinutes ? `⏱️ ${t.timeSpentMinutes}m logged` : '';

            return `
                <div class="task-card ${isDone ? 'task-done' : ''}" data-id="${t.id}">
                    <div class="task-status-line ${priorityClass}"></div>
                    <div class="task-checkbox-wrap" onclick="taskManager.toggleTask('${t.id}')">
                        <div class="task-checkbox ${isDone ? 'checked' : ''}">
                            <i data-lucide="check"></i>
                        </div>
                    </div>
                    <div class="task-content">
                        <div class="task-header-row">
                            <span class="task-title ${isDone ? 'strikethrough' : ''}">${this.escapeHtml(t.title)}</span>
                            <span class="task-badge ${priorityClass}">${t.priority.toUpperCase()}</span>
                        </div>
                        <div class="task-meta-row">
                            <span class="meta-tag"><i data-lucide="tag"></i> ${t.category}</span>
                            <span class="meta-tag"><i data-lucide="calendar"></i> ${dueDisplay}</span>
                            ${timeTracked ? `<span class="meta-tag meta-time"><i data-lucide="clock"></i> ${timeTracked}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        ${!isDone ? `
                            <button class="btn-icon-hud" title="Launch Focus Timer for this Task" onclick="app.launchTaskTimer('${t.id}')">
                                <i data-lucide="play"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon-hud btn-delete" title="Delete Task" onclick="taskManager.deleteTask('${t.id}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    updateTelemetry() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const totalFocus = this.tasks.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0);

        const elCompleted = document.getElementById('telemetryCompletedTasks');
        if (elCompleted) elCompleted.textContent = `${completed}/${total}`;

        const elPending = document.getElementById('telemetryPendingTasks');
        if (elPending) elPending.textContent = pending;

        const elStreak = document.getElementById('telemetryStreak');
        if (elStreak) elStreak.textContent = `${this.streakData.count || 0} 🔥`;

        const elFocusTotal = document.getElementById('telemetryFocusTotal');
        if (elFocusTotal) elFocusTotal.textContent = `${totalFocus}m`;
        
        // Progress bar in task section
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const progressBar = document.getElementById('taskProgressBar');
        const progressText = document.getElementById('taskProgressText');
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
        if (progressText) progressText.textContent = `${progressPercent}% COMPLETED`;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.TaskManager = TaskManager;
